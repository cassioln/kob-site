<?php

declare(strict_types=1);

/**
 * Gerador de PDF A4 sem dependências externas.
 *
 * Por que existe: a Locaweb não oferece nenhum caminho para converter HTML em
 * PDF. Medido no servidor — sem wkhtmltopdf, sem Chromium, sem Imagick, e
 * `exec`, `proc_open`, `shell_exec`, `popen` e `system` estão todos em
 * `disable_functions`. Também não há Composer no projeto, então bibliotecas como
 * FPDF/TCPDF/Dompdf não são uma opção sem introduzir vendor.
 *
 * O que ele faz: monta um PDF 1.4 mínimo, escrevendo os objetos na mão e usando
 * apenas as fontes base do PDF (Helvetica), que todo leitor já tem embutidas.
 * Isso dispensa embutir arquivo de fonte — o que exigiria parsing de TTF.
 *
 * O que ele NÃO faz: não renderiza HTML nem CSS. O comprovante em PDF é montado
 * a partir dos dados, com um layout próprio e deliberadamente sóbrio. Ele não é
 * pixel-a-pixel igual à versão impressa da página; é o mesmo CONTEÚDO, no mesmo
 * tom (preto e branco, tabelado, sem cor), adequado a circular por WhatsApp.
 *
 * Limitação conhecida e aceita: fontes base do PDF usam WinAnsi (cp1252), então
 * o texto é convertido de UTF-8 para cp1252. Acentuação do português passa;
 * emoji e caracteres fora do cp1252 são descartados em vez de virar lixo.
 */

const PDF_A4_LARGURA = 595.28;  // 210mm em pontos
const PDF_A4_ALTURA = 841.89;   // 297mm em pontos
const PDF_MARGEM = 56.7;        // 20mm

/**
 * Converte UTF-8 para WinAnsi, que é o encoding das fontes base do PDF.
 * Caracteres sem representação são removidos: melhor faltar um glifo do que
 * exibir um byte inválido no meio do nome de um passageiro.
 */
function pdf_texto(string $texto): string
{
    // CP1252 cobre toda a acentuação do português, então a conversão direta
    // preserva "ç", "ã", "é". `//TRANSLIT` NÃO é usado de propósito: ele
    // degradaria "Crianças" para "Criancas" em vez de converter o byte — foi
    // exatamente o defeito observado na primeira versão deste gerador.
    $convertido = @iconv('UTF-8', 'CP1252', $texto);

    if ($convertido === false) {
        // Só cai aqui se houver caractere fora do CP1252 (emoji, símbolo raro).
        // Aí sim vale transliterar, para não perder a frase inteira.
        $convertido = @iconv('UTF-8', 'CP1252//TRANSLIT//IGNORE', $texto);
    }
    if ($convertido === false) {
        $convertido = preg_replace('/[^\x20-\x7E]/', '', $texto) ?? '';
    }

    // Escapa os caracteres que têm significado sintático em string PDF.
    return str_replace(['\\', '(', ')', "\r"], ['\\\\', '\\(', '\\)', ''], $convertido);
}

/**
 * Largura aproximada de um texto em Helvetica, para centralizar e alinhar à
 * direita. Usa a média das métricas da fonte: exato o suficiente para posicionar
 * rótulos, e sem exigir a tabela AFM completa.
 */
function pdf_largura_texto(string $texto, float $tamanho, bool $negrito = false): float
{
    $fator = $negrito ? 0.58 : 0.52;

    return strlen($texto) * $tamanho * $fator;
}

/**
 * Monta o conteúdo (fluxo de comandos) de uma página.
 *
 * @param list<array{tipo: string, ...}> $blocos
 */
function pdf_conteudo(array $blocos): string
{
    $out = [];
    foreach ($blocos as $b) {
        if ($b['tipo'] === 'texto') {
            $fonte = ($b['negrito'] ?? false) ? '/F2' : '/F1';
            $out[] = 'BT';
            $out[] = sprintf('%s %.2f Tf', $fonte, $b['tamanho']);
            if (isset($b['espacamento'])) {
                $out[] = sprintf('%.2f Tc', $b['espacamento']);
            }
            $out[] = sprintf('%.2f %.2f Td', $b['x'], $b['y']);
            $out[] = sprintf('(%s) Tj', pdf_texto($b['texto']));
            if (isset($b['espacamento'])) {
                $out[] = '0 Tc';
            }
            $out[] = 'ET';
        } elseif ($b['tipo'] === 'linha') {
            $out[] = sprintf('%.2f w', $b['espessura'] ?? 0.8);
            $out[] = sprintf(
                '%.2f %.2f m %.2f %.2f l S',
                $b['x1'],
                $b['y1'],
                $b['x2'],
                $b['y2']
            );
        } elseif ($b['tipo'] === 'imagem') {
            // `q ... Q` isola a matriz: sem o par, a transformação vazaria para
            // todo desenho seguinte e deslocaria o resto da página.
            $out[] = 'q';
            $out[] = sprintf(
                '%.2f 0 0 %.2f %.2f %.2f cm',
                $b['largura'],
                $b['altura'],
                $b['x'],
                $b['y']
            );
            $out[] = '/' . $b['nome'] . ' Do';
            $out[] = 'Q';
        } elseif ($b['tipo'] === 'retangulo') {
            $out[] = sprintf('%.2f w', $b['espessura'] ?? 0.8);
            $out[] = sprintf(
                '%.2f %.2f %.2f %.2f re S',
                $b['x'],
                $b['y'],
                $b['largura'],
                $b['altura']
            );
        }
    }

    return implode("\n", $out);
}

/**
 * Carrega uma imagem e devolve os dados prontos para virar um XObject no PDF.
 *
 * WebP não é formato que o PDF entenda: precisa ser decodificado e re-encodado.
 * Escolhi JPEG com `/DCTDecode` porque o PDF aceita o fluxo JPEG direto, sem
 * recomprimir nem inflar o arquivo (um logo de 1200x735 em RGB cru daria ~2,6 MB
 * antes do Flate; em JPEG q88 fica em dezenas de KB).
 *
 * @return array{largura:int, altura:int, dados:string, filtro:string, colorspace:string, bpc:int}|null
 */
function pdf_carregar_imagem(string $caminho): ?array
{
    if (!is_file($caminho) || !function_exists('imagecreatefromwebp')) {
        return null;
    }

    $info = @getimagesize($caminho);
    if ($info === false) {
        return null;
    }

    $img = match ($info[2]) {
        IMAGETYPE_WEBP => @imagecreatefromwebp($caminho),
        IMAGETYPE_PNG => @imagecreatefrompng($caminho),
        IMAGETYPE_JPEG => @imagecreatefromjpeg($caminho),
        default => false,
    };
    if ($img === false) {
        return null;
    }

    try {
        $largura = imagesx($img);
        $altura = imagesy($img);

        // JPEG não tem canal alfa. Se a imagem tiver transparência e for
        // encodada direto, o fundo transparente sai PRETO no PDF. Compor sobre
        // branco antes resolve, e é o que o comprovante espera (papel branco).
        $plano = imagecreatetruecolor($largura, $altura);
        if ($plano === false) {
            return null;
        }
        $branco = imagecolorallocate($plano, 255, 255, 255);
        imagefilledrectangle($plano, 0, 0, $largura, $altura, $branco);
        imagecopy($plano, $img, 0, 0, 0, 0, $largura, $altura);

        ob_start();
        $ok = imagejpeg($plano, null, 88);
        $jpeg = (string) ob_get_clean();

        if (!$ok || $jpeg === '') {
            return null;
        }

        return [
            'largura' => $largura,
            'altura' => $altura,
            'dados' => $jpeg,
            'filtro' => 'DCTDecode',
            'colorspace' => 'DeviceRGB',
            'bpc' => 8,
        ];
    } finally {
        unset($plano, $img);
    }
}

/**
 * Altura que preserva a proporção da imagem para uma largura dada.
 * Existe para o chamador não recalcular (e errar) a razão em cada uso.
 */
function pdf_altura_proporcional(array $imagem, float $largura): float
{
    if ($imagem['largura'] <= 0) {
        return 0.0;
    }

    return $largura * ($imagem['altura'] / $imagem['largura']);
}

/**
 * Versão multipágina: cada item de $paginas é a lista de blocos daquela página.
 *
 * A de uma página só continua existindo porque o comprovante usa aquela forma.
 * Aqui o /Pages tem N filhos, e a numeração dos objetos é calculada: são 3 fixos
 * (catálogo, pages, fontes contam 2) mais 2 por página (a página e o conteúdo),
 * mais 1 por imagem. Errar essa conta desalinha a xref e o arquivo não abre.
 *
 * @param list<list<array>> $paginas
 * @param array<string, array> $imagens
 */
function pdf_montar_multipagina(array $paginas, array $imagens = []): string
{
    if (!$paginas) {
        $paginas = [[]];
    }

    $objetos = [];
    $num = 1;

    $idCatalogo = $num++;
    $idPages = $num++;
    $idFonteNormal = $num++;
    $idFonteNegrito = $num++;

    // Imagens antes das páginas para os /Resources já poderem referenciá-las.
    $refsXObject = [];
    foreach ($imagens as $nome => $img) {
        if (!is_array($img) || empty($img['dados'])) {
            continue;
        }
        $id = $num++;
        $refsXObject[] = '/' . $nome . ' ' . $id . ' 0 R';
        $objetos[$id] = sprintf(
            "<< /Type /XObject /Subtype /Image /Width %d /Height %d /ColorSpace /%s "
            . "/BitsPerComponent %d /Filter /%s /Length %d >>\nstream\n%s\nendstream",
            $img['largura'],
            $img['altura'],
            $img['colorspace'],
            $img['bpc'],
            $img['filtro'],
            strlen($img['dados']),
            $img['dados']
        );
    }

    $recursos = sprintf('/Font << /F1 %d 0 R /F2 %d 0 R >>', $idFonteNormal, $idFonteNegrito);
    if ($refsXObject) {
        $recursos .= ' /XObject << ' . implode(' ', $refsXObject) . ' >>';
    }

    $idsPaginas = [];
    foreach ($paginas as $blocos) {
        $conteudo = pdf_conteudo($blocos);
        $idPagina = $num++;
        $idConteudo = $num++;
        $idsPaginas[] = $idPagina;

        $objetos[$idPagina] = sprintf(
            "<< /Type /Page /Parent %d 0 R /MediaBox [0 0 %.2f %.2f] "
            . "/Resources << %s >> /Contents %d 0 R >>",
            $idPages,
            PDF_A4_LARGURA,
            PDF_A4_ALTURA,
            $recursos,
            $idConteudo
        );
        $objetos[$idConteudo] = sprintf(
            "<< /Length %d >>\nstream\n%s\nendstream",
            strlen($conteudo),
            $conteudo
        );
    }

    $kids = implode(' ', array_map(static fn ($id) => $id . ' 0 R', $idsPaginas));
    $objetos[$idCatalogo] = "<< /Type /Catalog /Pages {$idPages} 0 R >>";
    $objetos[$idPages] = sprintf(
        "<< /Type /Pages /Kids [%s] /Count %d >>",
        $kids,
        count($idsPaginas)
    );
    $objetos[$idFonteNormal] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
    $objetos[$idFonteNegrito] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

    ksort($objetos);

    $pdf = "%PDF-1.4\n";
    $offsets = [];
    foreach ($objetos as $id => $corpo) {
        $offsets[$id] = strlen($pdf);
        $pdf .= "{$id} 0 obj\n{$corpo}\nendobj\n";
    }

    $inicioXref = strlen($pdf);
    $total = count($objetos) + 1;
    $pdf .= "xref\n0 {$total}\n0000000000 65535 f \n";
    foreach ($offsets as $offset) {
        $pdf .= sprintf("%010d 00000 n \n", $offset);
    }
    $pdf .= "trailer\n<< /Size {$total} /Root {$idCatalogo} 0 R >>\n";
    $pdf .= "startxref\n{$inicioXref}\n%%EOF";

    return $pdf;
}
/**
 * Empacota UMA página num arquivo PDF válido, com a tabela xref correta.
 *
 * Mantida com esta assinatura porque o comprovante (receipt-pdf.php) já a chama
 * assim. Para várias páginas use pdf_montar_multipagina().
 *
 * A xref precisa apontar o byte exato de cada objeto; errar isso produz um
 * arquivo que abre em alguns leitores e falha em outros. Por isso os offsets são
 * medidos com strlen conforme a saída é construída, nunca estimados.
 *
 * @param array<string, array> $imagens mapa nome-no-PDF => pdf_carregar_imagem()
 */
function pdf_montar(string $conteudo, array $imagens = []): string
{
    $objetos = [];

    // Objetos 1 a 6 são fixos. As imagens entram a partir do 7, e o número é
    // calculado, nunca embutido: hardcodar quebraria ao adicionar a segunda.
    $proximo = 7;
    $refsXObject = [];
    $objetosImagem = [];
    foreach ($imagens as $nome => $img) {
        if (!is_array($img) || empty($img['dados'])) {
            continue;
        }
        $refsXObject[] = '/' . $nome . ' ' . $proximo . ' 0 R';
        $objetosImagem[$proximo] = sprintf(
            "<< /Type /XObject /Subtype /Image /Width %d /Height %d /ColorSpace /%s "
            . "/BitsPerComponent %d /Filter /%s /Length %d >>\nstream\n%s\nendstream",
            $img['largura'],
            $img['altura'],
            $img['colorspace'],
            $img['bpc'],
            $img['filtro'],
            strlen($img['dados']),
            $img['dados']
        );
        $proximo++;
    }

    $recursos = '/Font << /F1 5 0 R /F2 6 0 R >>';
    if ($refsXObject) {
        $recursos .= ' /XObject << ' . implode(' ', $refsXObject) . ' >>';
    }

    $objetos[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    $objetos[2] = "<< /Type /Pages /Kids [3 0 R] /Count 1 >>";
    $objetos[3] = sprintf(
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %.2f %.2f] "
        . "/Resources << %s >> /Contents 4 0 R >>",
        PDF_A4_LARGURA,
        PDF_A4_ALTURA,
        $recursos
    );
    $objetos[4] = sprintf(
        "<< /Length %d >>\nstream\n%s\nendstream",
        strlen($conteudo),
        $conteudo
    );
    $objetos[5] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
    $objetos[6] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

    foreach ($objetosImagem as $num => $corpo) {
        $objetos[$num] = $corpo;
    }
    ksort($objetos);

    $pdf = "%PDF-1.4\n";
    $offsets = [];
    foreach ($objetos as $num => $corpo) {
        $offsets[$num] = strlen($pdf);
        $pdf .= "{$num} 0 obj\n{$corpo}\nendobj\n";
    }

    $inicioXref = strlen($pdf);
    $total = count($objetos) + 1;
    $pdf .= "xref\n0 {$total}\n0000000000 65535 f \n";
    foreach ($offsets as $offset) {
        $pdf .= sprintf("%010d 00000 n \n", $offset);
    }
    $pdf .= "trailer\n<< /Size {$total} /Root 1 0 R >>\n";
    $pdf .= "startxref\n{$inicioXref}\n%%EOF";

    return $pdf;
}
