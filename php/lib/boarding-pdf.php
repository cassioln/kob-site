<?php

declare(strict_types=1);

/**
 * Lista de embarque em PDF A4 retrato, organizada em blocos por reserva.
 *
 * É o documento que a organização leva na porta do ônibus, muitas vezes sem
 * sinal de internet. Por isso:
 *  - somente reservas com pagamento aprovado (uma lista com pendentes levaria a
 *    contar passageiro que talvez não apareça);
 *  - um bloco por reserva, contato responsável primeiro e destacado, porque na
 *    conferência a pergunta é "quem responde por esse grupo?";
 *  - preto e branco, para imprimir em qualquer impressora.
 */

require_once __DIR__ . '/pdf.php';
require_once __DIR__ . '/receipt-pdf.php';

const EMBARQUE_LINHA = 15.5;
// Rodape real: regua em MARGEM+26 (82.7pt) mais o texto abaixo. Reservar
// menos que isso faz o ultimo bloco da pagina colidir com a numeracao.
const EMBARQUE_RODAPE = 104.0;

/**
 * @param list<array{
 *   code: string, valor: string, pagantes: int, criancas: int, pago_em: ?string,
 *   passageiros: list<array{nome: string, cpf: string, whatsapp: ?string, responsavel: bool}>
 * }> $reservas
 */
function bus_boarding_pdf(array $reservas, ?array $logo = null): string
{
    $esq = PDF_MARGEM;
    $dir = PDF_A4_LARGURA - PDF_MARGEM;
    $larguraUtil = $dir - $esq;

    // Colunas do bloco: nome ocupa o resto, CPF e telefone têm largura fixa
    // porque são campos de tamanho previsível.
    $colCpf = $dir - 210;
    $colTel = $dir - 108;

    $paginas = [];
    $blocos = [];
    $y = 0.0;
    $numeroPagina = 1;
    $totalPagantes = 0;
    $totalCriancas = 0;

    foreach ($reservas as $r) {
        $totalPagantes += $r['pagantes'];
        $totalCriancas += $r['criancas'];
    }

    /**
     * Cabeçalho da página. Repetido em toda página porque folha solta se perde:
     * uma página sem título não diz de que lista ela é.
     */
    $abrirPagina = function (int $pagina) use ($esq, $dir, $logo, $reservas, $totalPagantes, $totalCriancas): array {
        $blocos = [];
        $y = PDF_A4_ALTURA - PDF_MARGEM;

        if ($logo !== null) {
            // 92pt de largura da 56.4pt de altura. Com o deslocamento abaixo,
            // sobra folga real ate a linha de resumo (medido: 2pt antes).
            $largLogo = 92.0;
            $altLogo = pdf_altura_proporcional($logo, $largLogo);
            $blocos[] = [
                'tipo' => 'imagem', 'nome' => 'Logo',
                'x' => $esq, 'y' => $y - $altLogo + 6, 'largura' => $largLogo, 'altura' => $altLogo,
            ];
            // +14 em vez de -4: a base do logo tem de ficar ACIMA do resumo,
            // com respiro. Sem isso o desenho invade a linha de texto.
            $deslocamento = $altLogo + 14;
        } else {
            $blocos[] = ['tipo' => 'texto', 'x' => $esq, 'y' => $y - 10,
                         'texto' => 'KRIATIVOS ON BOARD 2026', 'tamanho' => 11,
                         'negrito' => true, 'espacamento' => 0.8];
            $deslocamento = 22.0;
        }

        // Título e data alinhados à direita do logo, no mesmo bloco visual.
        $blocos[] = ['tipo' => 'texto', 'x' => $esq + 122, 'y' => $y - 14,
                     'texto' => 'Lista de Embarque', 'tamanho' => 19, 'negrito' => true];
        $blocos[] = ['tipo' => 'texto', 'x' => $esq + 122, 'y' => $y - 30,
                     'texto' => 'Transporte fretado - Barra Funda (SP) ao Porto de Santos',
                     'tamanho' => 9];

        $emitido = 'Gerado em ' . gmdate('d/m/Y \à\s H:i', time() - 3 * 3600);
        $blocos[] = ['tipo' => 'texto', 'x' => $dir - pdf_largura_texto($emitido, 8) - 2,
                     'y' => $y - 44, 'texto' => $emitido, 'tamanho' => 8];

        $y -= max($deslocamento, 58.0);

        // Resumo: quem confere precisa saber quantas pessoas esperar.
        $resumo = sprintf(
            '%d reserva(s) paga(s) - %d pagante(s)%s',
            count($reservas),
            $totalPagantes,
            $totalCriancas > 0 ? sprintf(' + %d crianca(s) de colo', $totalCriancas) : ''
        );
        $blocos[] = ['tipo' => 'texto', 'x' => $esq, 'y' => $y, 'texto' => $resumo,
                     'tamanho' => 10, 'negrito' => true];
        $y -= 8;
        $blocos[] = ['tipo' => 'linha', 'x1' => $esq, 'y1' => $y, 'x2' => $dir, 'y2' => $y,
                     'espessura' => 1.2];
        $y -= 22;

        return [$blocos, $y];
    };

    [$blocos, $y] = $abrirPagina($numeroPagina);

    // Estado vazio: sem nenhuma reserva paga, a folha sairia com "0 reserva(s)" e
    // a legenda do asterisco sem nada para explicar, o que parece defeito. Melhor
    // dizer o que aconteceu e o que esperar.
    if (!$reservas) {
        $blocos[] = ['tipo' => 'texto', 'x' => $esq, 'y' => $y - 6,
                     'texto' => 'Nenhuma reserva paga ainda.', 'tamanho' => 13,
                     'negrito' => true];
        $blocos[] = ['tipo' => 'texto', 'x' => $esq, 'y' => $y - 26,
                     'texto' => 'A lista passa a ser preenchida conforme os pagamentos sao confirmados.',
                     'tamanho' => 10];
        $blocos[] = ['tipo' => 'texto', 'x' => $esq, 'y' => $y - 42,
                     'texto' => 'Somente reservas com pagamento aprovado aparecem aqui.',
                     'tamanho' => 10];

        // Rodapé sem a legenda do asterisco, que aqui não explicaria nada.
        $blocos[] = ['tipo' => 'linha', 'x1' => $esq, 'y1' => PDF_MARGEM + 26,
                     'x2' => $dir, 'y2' => PDF_MARGEM + 26, 'espessura' => 0.5];
        $pag = 'Pagina 1 de 1';
        $blocos[] = ['tipo' => 'texto',
                     'x' => $dir - pdf_largura_texto($pag, 8) - 2,
                     'y' => PDF_MARGEM + 12, 'texto' => $pag, 'tamanho' => 8];

        return pdf_montar_multipagina([$blocos], $logo !== null ? ['Logo' => $logo] : []);
    }

    foreach ($reservas as $indice => $r) {
        // Altura do bloco: cabeçalho da reserva + uma linha por passageiro.
        $alturaBloco = 26 + (count($r['passageiros']) * EMBARQUE_LINHA) + 12;

        // Quebra de página ANTES do bloco, nunca no meio: um grupo partido entre
        // duas folhas é o erro que faz a organização contar passageiro duas vezes.
        if ($y - $alturaBloco < EMBARQUE_RODAPE) {
            $paginas[] = [$blocos, $numeroPagina];
            $numeroPagina++;
            [$blocos, $y] = $abrirPagina($numeroPagina);
        }

        // Cabeçalho da reserva. O nome do grupo vem ao lado do código, separado
        // por barra: na conferência a organização chama pelo nome do grupo, então
        // ele precisa estar na mesma linha do identificador.
        $tituloReserva = 'RESERVA ' . $r['code'];
        if (!empty($r['group_name'])) {
            $tituloReserva .= '  |  ' . $r['group_name'];
        }
        $blocos[] = ['tipo' => 'texto', 'x' => $esq, 'y' => $y,
                     'texto' => $tituloReserva, 'tamanho' => 10,
                     'negrito' => true, 'espacamento' => 0.5];

        $meta = sprintf(
            '%d pagante(s)%s - %s',
            $r['pagantes'],
            $r['criancas'] > 0 ? ' + ' . $r['criancas'] . ' colo' : '',
            'R$ ' . $r['valor']
        );
        $blocos[] = ['tipo' => 'texto', 'x' => $dir - pdf_largura_texto($meta, 9) - 2, 'y' => $y,
                     'texto' => $meta, 'tamanho' => 9];
        $y -= 12;

        // Régua do bloco e rótulos das colunas.
        $blocos[] = ['tipo' => 'linha', 'x1' => $esq, 'y1' => $y, 'x2' => $dir, 'y2' => $y,
                     'espessura' => 0.7];
        $y -= 12;
        $blocos[] = ['tipo' => 'texto', 'x' => $esq, 'y' => $y, 'texto' => 'Nome', 'tamanho' => 7.5];
        $blocos[] = ['tipo' => 'texto', 'x' => $colCpf, 'y' => $y, 'texto' => 'CPF', 'tamanho' => 7.5];
        $blocos[] = ['tipo' => 'texto', 'x' => $colTel, 'y' => $y, 'texto' => 'WhatsApp', 'tamanho' => 7.5];
        $y -= 13;

        // Responsável primeiro: é quem a organização procura ao conferir o grupo.
        $ordenados = $r['passageiros'];
        usort($ordenados, static fn ($a, $b) => ($b['responsavel'] ? 1 : 0) <=> ($a['responsavel'] ? 1 : 0));

        foreach ($ordenados as $p) {
            $eResp = !empty($p['responsavel']);
            $eColo = !empty($p['crianca_colo']);

            // Quadrado de conferência: a lista é usada com caneta na mão.
            $blocos[] = ['tipo' => 'retangulo', 'x' => $esq, 'y' => $y - 2,
                         'largura' => 8, 'altura' => 8, 'espessura' => 0.6];

            $nome = $p['nome'];
            $prefixo = $eResp ? '* ' : '';
            $blocos[] = ['tipo' => 'texto', 'x' => $esq + 14, 'y' => $y,
                         'texto' => $prefixo . $nome, 'tamanho' => 9.5, 'negrito' => $eResp];

            if ($eResp) {
                $tag = 'responsavel';
                $blocos[] = ['tipo' => 'texto',
                             'x' => $esq + 16 + pdf_largura_texto($prefixo . $nome, 9.5, true),
                             'y' => $y, 'texto' => $tag, 'tamanho' => 7];
            } elseif ($eColo) {
                $tag = 'colo (0 a 5 anos)';
                $blocos[] = ['tipo' => 'texto',
                             'x' => $esq + 16 + pdf_largura_texto($prefixo . $nome, 9.5, false),
                             'y' => $y, 'texto' => $tag, 'tamanho' => 7];
            }

            $blocos[] = ['tipo' => 'texto', 'x' => $colCpf, 'y' => $y,
                         'texto' => $p['cpf'] !== '' ? $p['cpf'] : '-', 'tamanho' => 9];

            $tel = ($p['whatsapp'] ?? '') !== '' ? (string) $p['whatsapp'] : 'N/A';
            $blocos[] = ['tipo' => 'texto', 'x' => $colTel, 'y' => $y, 'texto' => $tel,
                         'tamanho' => 9];

            $y -= EMBARQUE_LINHA;
        }

        // Separador entre blocos, exceto depois do último.
        if ($indice < count($reservas) - 1) {
            $y -= 4;
            $blocos[] = ['tipo' => 'linha', 'x1' => $esq, 'y1' => $y, 'x2' => $dir, 'y2' => $y,
                         'espessura' => 0.4];
            $y -= 16;
        }
    }

    $paginas[] = [$blocos, $numeroPagina];
    $totalPaginas = count($paginas);

    // Rodapé com numeração real. Só dá para escrever "x de y" depois de saber
    // quantas páginas saíram, então entra num segundo passe.
    $paginasFinais = [];
    foreach ($paginas as [$blocosPagina, $numero]) {
        $blocosPagina[] = ['tipo' => 'linha', 'x1' => $esq, 'y1' => PDF_MARGEM + 26,
                           'x2' => $dir, 'y2' => PDF_MARGEM + 26, 'espessura' => 0.5];
        $blocosPagina[] = ['tipo' => 'texto', 'x' => $esq, 'y' => PDF_MARGEM + 12,
                           'texto' => '* contato responsavel pela reserva', 'tamanho' => 7.5];
        $pag = sprintf('Pagina %d de %d', $numero, $totalPaginas);
        $blocosPagina[] = ['tipo' => 'texto',
                           'x' => $dir - pdf_largura_texto($pag, 8) - 2,
                           'y' => PDF_MARGEM + 12, 'texto' => $pag, 'tamanho' => 8];
        $paginasFinais[] = $blocosPagina;
    }

    $imagens = $logo !== null ? ['Logo' => $logo] : [];

    return pdf_montar_multipagina($paginasFinais, $imagens);
}
