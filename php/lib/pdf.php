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
 * Empacota os objetos num arquivo PDF válido, com a tabela xref correta.
 *
 * A xref precisa apontar o byte exato de cada objeto; errar isso produz um
 * arquivo que abre em alguns leitores e falha em outros. Por isso os offsets são
 * medidos com strlen conforme a saída é construída, nunca estimados.
 */
function pdf_montar(string $conteudo): string
{
    $objetos = [];

    $objetos[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    $objetos[2] = "<< /Type /Pages /Kids [3 0 R] /Count 1 >>";
    $objetos[3] = sprintf(
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %.2f %.2f] "
        . "/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",
        PDF_A4_LARGURA,
        PDF_A4_ALTURA
    );
    $objetos[4] = sprintf(
        "<< /Length %d >>\nstream\n%s\nendstream",
        strlen($conteudo),
        $conteudo
    );
    $objetos[5] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
    $objetos[6] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

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
