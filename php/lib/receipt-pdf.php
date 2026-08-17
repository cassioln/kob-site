<?php

declare(strict_types=1);

require_once __DIR__ . '/pdf.php';

/**
 * Monta o comprovante de reserva em PDF A4, preto e branco.
 *
 * Espelha o CONTEÚDO da versão impressa da página (`@media print` em
 * onibus.css): mesmo cabeçalho, mesma tabela de dados, mesmo manifesto numerado,
 * mesmo rodapé. Não é pixel-a-pixel — o gerador não interpreta CSS — mas segue
 * as mesmas decisões: monocromático, tabelado, sem elementos decorativos.
 *
 * Sem CPF, por decisão do produto: o comprovante circula por foto no WhatsApp e o
 * código da reserva já identifica o grupo sem expor dado sensível.
 *
 * @param array{
 *   code: string, orderId: ?string, amount: string, passengerCount: int,
 *   childrenCount: int, contactName: string, contactWhatsapp: ?string,
 *   passengers: list<array{name: string, whatsapp: ?string}>, issuedAt: string
 * } $dados
 */
function bus_receipt_pdf(array $dados): string
{
    $blocos = [];
    $esq = PDF_MARGEM;
    $dir = PDF_A4_LARGURA - PDF_MARGEM;
    $y = PDF_A4_ALTURA - PDF_MARGEM;

    // ---- Cabeçalho ----
    $blocos[] = ['tipo' => 'texto', 'x' => $esq, 'y' => $y, 'texto' => 'KRIATIVOS ON BOARD 2026 — TRANSPORTE FRETADO',
                 'tamanho' => 9, 'negrito' => true, 'espacamento' => 0.6];
    $y -= 8;
    $blocos[] = ['tipo' => 'linha', 'x1' => $esq, 'y1' => $y, 'x2' => $dir, 'y2' => $y, 'espessura' => 1.2];

    $y -= 34;
    $blocos[] = ['tipo' => 'texto', 'x' => $esq, 'y' => $y, 'texto' => 'Comprovante de reserva',
                 'tamanho' => 21, 'negrito' => true];

    $y -= 18;
    $blocos[] = ['tipo' => 'texto', 'x' => $esq, 'y' => $y,
                 'texto' => 'Pagamento confirmado. Apresente este comprovante no embarque.',
                 'tamanho' => 10];

    // ---- Tabela de dados ----
    $y -= 30;
    $linhas = [
        ['Código da reserva', $dados['code']],
        ['Valor pago', 'R$ ' . str_replace('.', ',', $dados['amount'])],
        ['Passageiros pagantes', (string) $dados['passengerCount']],
    ];
    if ($dados['childrenCount'] > 0) {
        $linhas[] = ['Crianças de até 5 anos', $dados['childrenCount'] . ' (não pagante, no colo)'];
    }
    $linhas[] = ['Rota', 'Barra Funda (SP) — Porto de Santos'];
    if (!empty($dados['orderId'])) {
        $linhas[] = ['Transação (Mercado Pago)', $dados['orderId']];
    }
    $linhas[] = ['Emitido em', $dados['issuedAt']];

    $alturaLinha = 22.0;
    $topoTabela = $y;
    $colRotulo = $esq + 8;
    $colValor = $esq + 190;

    foreach ($linhas as $i => [$rotulo, $valor]) {
        $baseY = $topoTabela - ($i * $alturaLinha);
        // Régua superior de cada linha: a moldura completa é fechada depois.
        $blocos[] = ['tipo' => 'linha', 'x1' => $esq, 'y1' => $baseY, 'x2' => $dir, 'y2' => $baseY,
                     'espessura' => 0.5];
        $blocos[] = ['tipo' => 'texto', 'x' => $colRotulo, 'y' => $baseY - 15, 'texto' => $rotulo,
                     'tamanho' => 9];
        $blocos[] = ['tipo' => 'texto', 'x' => $colValor, 'y' => $baseY - 15, 'texto' => $valor,
                     'tamanho' => 10, 'negrito' => true];
    }
    $fimTabela = $topoTabela - (count($linhas) * $alturaLinha);
    $blocos[] = ['tipo' => 'linha', 'x1' => $esq, 'y1' => $fimTabela, 'x2' => $dir, 'y2' => $fimTabela,
                 'espessura' => 0.5];
    // Verticais fechando a moldura.
    $blocos[] = ['tipo' => 'linha', 'x1' => $esq, 'y1' => $topoTabela, 'x2' => $esq, 'y2' => $fimTabela,
                 'espessura' => 0.5];
    $blocos[] = ['tipo' => 'linha', 'x1' => $dir, 'y1' => $topoTabela, 'x2' => $dir, 'y2' => $fimTabela,
                 'espessura' => 0.5];

    // ---- Manifesto ----
    $y = $fimTabela - 38;
    $blocos[] = ['tipo' => 'texto', 'x' => $esq, 'y' => $y, 'texto' => 'QUEM EMBARCA',
                 'tamanho' => 10, 'negrito' => true, 'espacamento' => 0.5];
    $y -= 6;
    $blocos[] = ['tipo' => 'linha', 'x1' => $esq, 'y1' => $y, 'x2' => $dir, 'y2' => $y, 'espessura' => 0.8];

    $y -= 20;
    foreach ($dados['passengers'] as $i => $passageiro) {
        $numero = $i + 1;
        $blocos[] = ['tipo' => 'texto', 'x' => $esq, 'y' => $y, 'texto' => $numero . '.',
                     'tamanho' => 10, 'negrito' => true];
        $blocos[] = ['tipo' => 'texto', 'x' => $esq + 20, 'y' => $y, 'texto' => $passageiro['name'],
                     'tamanho' => 10];

        // Telefone à direita, quando informado: quem confere a lista no embarque
        // precisa do contato ao lado do nome.
        $telefone = $passageiro['whatsapp'] ?? '';
        $formatado = $telefone !== '' ? bus_format_phone($telefone) : 'telefone não informado';
        $largura = pdf_largura_texto($formatado, 9);
        $blocos[] = ['tipo' => 'texto', 'x' => $dir - $largura - 4, 'y' => $y,
                     'texto' => $formatado, 'tamanho' => 9];

        $y -= 17;
        if ($y < PDF_MARGEM + 80) {
            break; // Não invade o rodapé; grupos gigantes ficariam em outra via.
        }
    }

    if ($dados['childrenCount'] > 0) {
        $y -= 8;
        $blocos[] = ['tipo' => 'texto', 'x' => $esq, 'y' => $y,
                     'texto' => '+ ' . $dados['childrenCount'] . ' criança(s) de até 5 anos, no colo de um responsável.',
                     'tamanho' => 9];
    }

    // ---- Rodapé ----
    $rodape = PDF_MARGEM + 30;
    $blocos[] = ['tipo' => 'linha', 'x1' => $esq, 'y1' => $rodape + 14, 'x2' => $dir, 'y2' => $rodape + 14,
                 'espessura' => 0.5];
    $blocos[] = ['tipo' => 'texto', 'x' => $esq, 'y' => $rodape,
                 'texto' => 'Via do passageiro — página 1 de 1', 'tamanho' => 8];
    $aviso = 'O ônibus só será contratado se o mínimo de passageiros for atingido.';
    $blocos[] = ['tipo' => 'texto', 'x' => $dir - pdf_largura_texto($aviso, 8) - 4, 'y' => $rodape,
                 'texto' => $aviso, 'tamanho' => 8];

    return pdf_montar(pdf_conteudo($blocos));
}

/**
 * Formata CPF para leitura humana (000.000.000-00).
 *
 * Fora de 11 dígitos devolve marcado, em vez de mutilar o número: um CPF com
 * tamanho errado é dado corrompido, e mostrar "00.000.000-0" fingiria que está
 * tudo bem.
 */
function bus_format_cpf(string $valor): string
{
    $d = preg_replace('/\D/', '', $valor) ?? '';
    if (strlen($d) === 11) {
        return sprintf(
            '%s.%s.%s-%s',
            substr($d, 0, 3),
            substr($d, 3, 3),
            substr($d, 6, 3),
            substr($d, 9)
        );
    }

    return $d !== '' ? $d . ' (verificar)' : '';
}

/**
 * Formata telefone nacional (10 ou 11 dígitos) para leitura humana.
 * Fora desses tamanhos devolve como veio, em vez de mutilar o número.
 */
function bus_format_phone(string $digitos): string
{
    $d = preg_replace('/\D/', '', $digitos) ?? '';

    // Prefixo do país: registros antigos guardaram o número com "55" porque a
    // normalização só passou a removê-lo depois.
    if (str_starts_with($d, '55') && (strlen($d) === 12 || strlen($d) === 13)) {
        $d = substr($d, 2);
    }

    if (strlen($d) === 11) {
        // Celular brasileiro tem o 9 como primeiro dígito do número. Um valor de
        // 11 dígitos que começa com "55" e NÃO tem o 9 na posição certa é dado
        // corrompido — medido no banco: "55119425541", que na verdade é
        // "11942554141" truncado. Formatar isso como "(55) 11942-5541" inventaria
        // um DDD que não existe, então é melhor mostrar o número cru e deixar
        // visível que o cadastro precisa de correção.
        if (str_starts_with($d, '55') && $d[2] !== '9') {
            return $d . ' (verificar)';
        }

        return sprintf('(%s) %s-%s', substr($d, 0, 2), substr($d, 2, 5), substr($d, 7));
    }
    if (strlen($d) === 10) {
        return sprintf('(%s) %s-%s', substr($d, 0, 2), substr($d, 2, 4), substr($d, 6));
    }

    return $digitos !== '' ? $digitos . ' (verificar)' : '';
}
