<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/xlsx.php';

// 1. Testa a geração do XLSX e a estrutura dos estilos gerados
$colunas = [
    ['titulo' => 'Reserva', 'largura' => 13],
    ['titulo' => 'Grupo', 'largura' => 22],
    ['titulo' => 'Nº', 'largura' => 5],
    ['titulo' => 'Passageiro', 'largura' => 30],
    ['titulo' => 'CPF', 'largura' => 16],
    ['titulo' => 'Faixa Etária', 'largura' => 18],
    ['titulo' => 'WhatsApp', 'largura' => 17],
    ['titulo' => 'E-mail', 'largura' => 30],
    ['titulo' => 'Responsável', 'largura' => 30],
    ['titulo' => 'Ônibus', 'largura' => 12],
    ['titulo' => 'Qtd Pessoas', 'largura' => 13],
    ['titulo' => 'Valor pago', 'largura' => 13],
    ['titulo' => 'Status', 'largura' => 22],
    ['titulo' => 'Desistência', 'largura' => 26],
    ['titulo' => 'Pago em', 'largura' => 17],
    ['titulo' => 'Transação', 'largura' => 34],
];

$linhas = [
    // Linha 1: Responsável aprovado (roxo claro no responsável, centralizado no Nº)
    [
        'estilo' => 'responsavel',
        'celulas' => [
            'RES00001',
            'Grupo Alpha',
            ['tipo' => 'numero', 'v' => 1, 'estilo' => 'centralizado'],
            'Passageiro 1',
            '111.111.111-11',
            '18 anos ou mais',
            '(11) 99999-1111',
            'p1@teste.com',
            'Passageiro 1',
            ['tipo' => 'texto', 'v' => 'Ônibus 1', 'estilo' => 'texto'],
            '2',
            'R$ 240,00',
            ['v' => 'Pagamento aprovado', 'estilo' => 'status_ok'],
            '',
            '20/08/2026 10:00',
            'ORD-001',
        ],
    ],
    // Linha 2: Acompanhante aprovado (normal, Nº centralizado)
    [
        'estilo' => 'normal',
        'celulas' => [
            'RES00001',
            'Grupo Alpha',
            ['tipo' => 'numero', 'v' => 2, 'estilo' => 'centralizado'],
            'Passageiro 2',
            '222.222.222-22',
            '18 anos ou mais',
            '(11) 99999-2222',
            'p2@teste.com',
            'Passageiro 1',
            ['tipo' => 'texto', 'v' => 'Ônibus 1', 'estilo' => 'texto'],
            '',
            '',
            '',
            '',
            '',
            '',
        ],
    ],
    // Linha 3: Responsável cancelado/falha (fundo vermelho claro, Nº centralizado)
    [
        'estilo' => 'falha_responsavel',
        'celulas' => [
            'RES00002',
            'Grupo Beta',
            ['tipo' => 'numero', 'v' => 1, 'estilo' => 'centralizado'],
            'Passageiro Cancelado 1',
            '333.333.333-33',
            '18 anos ou mais',
            '(11) 99999-3333',
            'p3@teste.com',
            'Passageiro Cancelado 1',
            ['tipo' => 'texto', 'v' => '—', 'estilo' => 'texto'],
            '2',
            'R$ 240,00',
            ['v' => 'Pagamento cancelado', 'estilo' => 'status_falha'],
            '',
            '',
            'ORD-002',
        ],
    ],
    // Linha 4: Acompanhante cancelado/falha (fundo vermelho claro, Nº centralizado)
    [
        'estilo' => 'falha',
        'celulas' => [
            'RES00002',
            'Grupo Beta',
            ['tipo' => 'numero', 'v' => 2, 'estilo' => 'centralizado'],
            'Passageiro Cancelado 2',
            '444.444.444-44',
            '18 anos ou mais',
            '(11) 99999-4444',
            'p4@teste.com',
            'Passageiro Cancelado 1',
            ['tipo' => 'texto', 'v' => '—', 'estilo' => 'texto'],
            '',
            '',
            '',
            '',
            '',
            '',
        ],
    ],
    // Linha 5: Passageiro desistente (cinza tachado, Nº centralizado, coluna Desistência)
    [
        'estilo' => 'desistente',
        'celulas' => [
            'RES00001',
            'Grupo Alpha',
            ['tipo' => 'numero', 'v' => 3, 'estilo' => 'centralizado'],
            'Passageiro Desistente',
            '555.555.555-55',
            '18 anos ou mais',
            '(11) 99999-5555',
            'p5@teste.com',
            'Passageiro 1',
            ['tipo' => 'texto', 'v' => 'Ônibus 1', 'estilo' => 'texto'],
            '',
            '',
            '',
            'Desistiu em 16/10/2026 15:00 · Mudou de planos',
            '',
            '',
        ],
    ],
    // Linha 6: primeiro passageiro (não responsável) desistiu numa reserva
    // ativa: células do passageiro tachadas com a borda de início de grupo;
    // as da reserva (Responsável, Ônibus, Qtd, Valor, Status, Pago em,
    // Transação) sem risco.
    [
        'estilo' => 'desistente_grupo',
        'celulas' => [
            'RES00003',
            'Grupo Gama',
            ['tipo' => 'numero', 'v' => 1, 'estilo' => 'centralizado'],
            'Passageiro Desistente Primeiro',
            '666.666.666-66',
            '18 anos ou mais',
            '(11) 99999-6666',
            'p6@teste.com',
            ['v' => 'Responsável Gama', 'estilo' => 'grupo'],
            ['v' => 'Ônibus 2', 'estilo' => 'grupo'],
            ['v' => '1', 'estilo' => 'grupo'],
            ['v' => 'R$ 240,00', 'estilo' => 'grupo'],
            ['v' => 'Pagamento aprovado', 'estilo' => 'status_ok'],
            'Desistiu em 16/10/2026 15:00',
            ['v' => '20/08/2026 10:00', 'estilo' => 'grupo'],
            ['v' => 'ORD-003', 'estilo' => 'grupo'],
        ],
    ],
];

foreach ($linhas as $n => $linha) {
    if (count($linha['celulas']) !== count($colunas)) {
        fwrite(STDERR, 'FAIL: linha ' . ($n + 1) . ' tem ' . count($linha['celulas'])
            . ' células, esperado ' . count($colunas) . "\n");
        exit(1);
    }
}

$bytes = xlsx_build([
    'nome' => 'Passageiros',
    'titulo' => 'Kriativos On Board 2026',
    'subtitulo' => 'Teste Unitario',
    'colunas' => $colunas,
    'linhas' => $linhas,
]);

if (strlen($bytes) < 100) {
    fwrite(STDERR, "FAIL: xlsx_build gerou arquivo muito pequeno ou vazio\n");
    exit(1);
}

// Abre o ZIP e analisa a planilha
$temp = tempnam(sys_get_temp_dir(), 'testxlsx');
file_put_contents($temp, $bytes);

$zip = new ZipArchive();
if ($zip->open($temp) !== true) {
    fwrite(STDERR, "FAIL: não conseguiu abrir o ZIP gerado\n");
    @unlink($temp);
    exit(1);
}

$sheetXml = $zip->getFromName('xl/worksheets/sheet1.xml');
$stylesXml = $zip->getFromName('xl/styles.xml');
$zip->close();
@unlink($temp);

if ($sheetXml === false || $stylesXml === false) {
    fwrite(STDERR, "FAIL: sheet1.xml ou styles.xml não encontrados no ZIP\n");
    exit(1);
}

// 2. Valida os styles e seus índices
$indices = xlsx_estilos_indices();
$esperados = [
    'padrao', 'titulo', 'subtitulo', 'cabecalho', 'normal', 'responsavel', 'grupo',
    'status_ok', 'status_espera', 'status_falha', 'vip', 'status_vip',
    'responsavel_centralizado', 'centralizado', 'falha', 'falha_responsavel',
    'falha_centralizado', 'falha_responsavel_centralizado', 'vip_centralizado',
    'grupo_centralizado', 'falha_grupo', 'falha_grupo_centralizado',
    'desistente', 'desistente_centralizado',
    'desistente_grupo', 'desistente_grupo_centralizado'
];
foreach ($esperados as $nome) {
    if (!isset($indices[$nome])) {
        fwrite(STDERR, "FAIL: estilo '$nome' não está em xlsx_estilos_indices()\n");
        exit(1);
    }
}

// 3. Valida cabeçalhos na linha 3
$xml = new SimpleXMLElement($sheetXml);
$rows = $xml->sheetData->row;

// Verifica linha 3 (cabeçalhos)
$headerRow = $rows[2];
$colTitulos = [];
foreach ($headerRow->c as $c) {
    $colTitulos[] = (string) $c->is->t;
}

if ($colTitulos[1] !== 'Grupo' || $colTitulos[9] !== 'Ônibus') {
    fwrite(STDERR, "FAIL: ordem de colunas incorreta! Col 1: {$colTitulos[1]} (esperado Grupo), Col 9: {$colTitulos[9]} (esperado Ônibus)\n");
    exit(1);
}

// 4. Verifica linha 4 (Passageiro 1 - Responsável aprovado)
// Col C (Nº) deve ter estilo 'responsavel_centralizado' (índice 12)
$row4 = $rows[3];
$cells4 = [];
foreach ($row4->c as $c) {
    $cells4[(string)$c['r']] = ['s' => (int)$c['s'], 'v' => (string)($c->is->t ?? '')];
}
if ($cells4['C4']['s'] !== $indices['responsavel_centralizado']) {
    fwrite(STDERR, "FAIL: C4 (Nº responsável aprovado) tem estilo {$cells4['C4']['s']}, esperado {$indices['responsavel_centralizado']}\n");
    exit(1);
}

// 5. Verifica linha 5 (Passageiro 2 - Acompanhante aprovado)
// Col C (Nº) deve ter estilo 'centralizado' (índice 13)
$row5 = $rows[4];
$cells5 = [];
foreach ($row5->c as $c) {
    $cells5[(string)$c['r']] = ['s' => (int)$c['s'], 'v' => (string)($c->is->t ?? '')];
}
if ($cells5['C5']['s'] !== $indices['centralizado']) {
    fwrite(STDERR, "FAIL: C5 (Nº acompanhante) tem estilo {$cells5['C5']['s']}, esperado {$indices['centralizado']}\n");
    exit(1);
}

// 6. Verifica linha 6 (Passageiro Cancelado 1 - Responsável cancelado/falha)
// Todas as células devem ter estilo de falha_responsavel (ou falha_responsavel_centralizado para C6, ou status_falha para M6)
$row6 = $rows[5];
$cells6 = [];
foreach ($row6->c as $c) {
    $cells6[(string)$c['r']] = ['s' => (int)$c['s'], 'v' => (string)($c->is->t ?? '')];
}
if ($cells6['A6']['s'] !== $indices['falha_responsavel']) {
    fwrite(STDERR, "FAIL: A6 (responsável cancelado) tem estilo {$cells6['A6']['s']}, esperado {$indices['falha_responsavel']}\n");
    exit(1);
}
if ($cells6['C6']['s'] !== $indices['falha_responsavel_centralizado']) {
    fwrite(STDERR, "FAIL: C6 (Nº responsável cancelado) tem estilo {$cells6['C6']['s']}, esperado {$indices['falha_responsavel_centralizado']}\n");
    exit(1);
}

// 7. Verifica linha 7 (Passageiro Cancelado 2 - Acompanhante cancelado/falha)
// Todas as células devem ter estilo falha (ou falha_centralizado para C7)
$row7 = $rows[6];
$cells7 = [];
foreach ($row7->c as $c) {
    $cells7[(string)$c['r']] = ['s' => (int)$c['s'], 'v' => (string)($c->is->t ?? '')];
}
if ($cells7['A7']['s'] !== $indices['falha']) {
    fwrite(STDERR, "FAIL: A7 (acompanhante cancelado) tem estilo {$cells7['A7']['s']}, esperado {$indices['falha']}\n");
    exit(1);
}
if ($cells7['C7']['s'] !== $indices['falha_centralizado']) {
    fwrite(STDERR, "FAIL: C7 (Nº acompanhante cancelado) tem estilo {$cells7['C7']['s']}, esperado {$indices['falha_centralizado']}\n");
    exit(1);
}

// 8. Verifica se o styles.xml contém preenchimento vermelho claro (FFFBEAEA) associado aos estilos de falha
$styles = new SimpleXMLElement($stylesXml);
$redFillFound = false;
$redFillIndex = -1;
$currentFillIdx = 0;
foreach ($styles->fills->fill as $f) {
    if (isset($f->patternFill->fgColor['rgb']) && (string)$f->patternFill->fgColor['rgb'] === 'FFFBEAEA') {
        $redFillFound = true;
        $redFillIndex = $currentFillIdx;
        break;
    }
    $currentFillIdx++;
}
if (!$redFillFound) {
    fwrite(STDERR, "FAIL: Fundo FFFBEAEA não encontrado no styles.xml\n");
    exit(1);
}

// Verifica se o cellXf do estilo 'falha' e 'falha_responsavel' usam $redFillIndex
$cellXfs = $styles->cellXfs->xf;
if ((int)$cellXfs[$indices['falha']]['fillId'] !== $redFillIndex) {
    fwrite(STDERR, "FAIL: estilo 'falha' tem fillId " . (int)$cellXfs[$indices['falha']]['fillId'] . ", esperado $redFillIndex\n");
    exit(1);
}
if ((int)$cellXfs[$indices['falha_responsavel']]['fillId'] !== $redFillIndex) {
    fwrite(STDERR, "FAIL: estilo 'falha_responsavel' tem fillId " . (int)$cellXfs[$indices['falha_responsavel']]['fillId'] . ", esperado $redFillIndex\n");
    exit(1);
}

// 9. Passageiro desistente: estilo próprio (22) e Nº centralizado (23), fonte cinza tachada.
if (($indices['desistente'] ?? null) !== 22 || ($indices['desistente_centralizado'] ?? null) !== 23) {
    fwrite(STDERR, "FAIL: índices de desistente diferentes de 22/23\n");
    exit(1);
}
if ($colTitulos[12] !== 'Status' || $colTitulos[13] !== 'Desistência') {
    fwrite(STDERR, "FAIL: coluna Desistência não está logo depois de Status\n");
    exit(1);
}
$row8 = $rows[7];
$cells8 = [];
foreach ($row8->c as $c) {
    $cells8[(string)$c['r']] = ['s' => (int)$c['s'], 'v' => (string)($c->is->t ?? '')];
}
if ($cells8['A8']['s'] !== 22 || $cells8['D8']['s'] !== 22 || $cells8['J8']['s'] !== 22) {
    fwrite(STDERR, "FAIL: linha desistente não usa s=22 (A8={$cells8['A8']['s']}, D8={$cells8['D8']['s']}, J8={$cells8['J8']['s']})\n");
    exit(1);
}
if ($cells8['C8']['s'] !== 23) {
    fwrite(STDERR, "FAIL: C8 (Nº desistente) tem estilo {$cells8['C8']['s']}, esperado 23\n");
    exit(1);
}
if ($cells8['N8']['v'] !== 'Desistiu em 16/10/2026 15:00 · Mudou de planos') {
    fwrite(STDERR, "FAIL: N8 (Desistência) = '{$cells8['N8']['v']}'\n");
    exit(1);
}
if (strpos($sheetXml, '<c r="C8" s="23"') === false || strpos($sheetXml, '<c r="A8" s="22"') === false) {
    fwrite(STDERR, "FAIL: sheet1.xml não tem A8 s=\"22\" e C8 s=\"23\"\n");
    exit(1);
}
if (strpos($stylesXml, '<strike/>') === false) {
    fwrite(STDERR, "FAIL: styles.xml não contém <strike/>\n");
    exit(1);
}
$fontsXml = $styles->fonts->font;
foreach (['desistente', 'desistente_centralizado'] as $nome) {
    $xf = $cellXfs[$indices[$nome]];
    $font = $fontsXml[(int) $xf['fontId']];
    if (!isset($font->strike) || (string) $font->color['rgb'] !== 'FF94A3B8') {
        fwrite(STDERR, "FAIL: estilo '$nome' não usa fonte cinza FF94A3B8 tachada\n");
        exit(1);
    }
}
if ((string) $cellXfs[$indices['desistente_centralizado']]->alignment['horizontal'] !== 'center') {
    fwrite(STDERR, "FAIL: 'desistente_centralizado' não é centralizado\n");
    exit(1);
}
// 9b. Desistente na primeira linha do grupo de uma reserva ativa.
$row9 = $rows[8];
$cells9 = [];
foreach ($row9->c as $c) {
    $cells9[(string)$c['r']] = ['s' => (int)$c['s'], 'v' => (string)($c->is->t ?? '')];
}
if ($cells9['A9']['s'] !== $indices['desistente_grupo'] || $cells9['D9']['s'] !== $indices['desistente_grupo']
    || $cells9['C9']['s'] !== $indices['desistente_grupo_centralizado']) {
    fwrite(STDERR, "FAIL: desistente na primeira linha não usa desistente_grupo (A9={$cells9['A9']['s']}, C9={$cells9['C9']['s']}, D9={$cells9['D9']['s']})\n");
    exit(1);
}
foreach (['I9', 'J9', 'K9', 'L9', 'O9', 'P9'] as $ref) {
    if ($cells9[$ref]['s'] !== $indices['grupo']) {
        fwrite(STDERR, "FAIL: $ref (célula da reserva) tem estilo {$cells9[$ref]['s']}, esperado {$indices['grupo']} (sem risco)\n");
        exit(1);
    }
}
if ($cells9['M9']['s'] !== $indices['status_ok']) {
    fwrite(STDERR, "FAIL: M9 (Status) tem estilo {$cells9['M9']['s']}, esperado {$indices['status_ok']}\n");
    exit(1);
}
foreach (['desistente_grupo', 'desistente_grupo_centralizado'] as $nome) {
    $xf = $cellXfs[$indices[$nome]];
    $font = $fontsXml[(int) $xf['fontId']];
    $borda = $styles->borders->border[(int) $xf['borderId']];
    if (!isset($font->strike) || (string) $borda->top['style'] !== 'medium') {
        fwrite(STDERR, "FAIL: estilo '$nome' não é tachado com borda superior média\n");
        exit(1);
    }
}

if ((int) $styles->cellXfs['count'] !== count($cellXfs)) {
    fwrite(STDERR, "FAIL: cellXfs count não confere com o número de xf\n");
    exit(1);
}

// 10. Regras de exibição da desistência (painel e Excel).
require_once __DIR__ . '/../lib/registration-withdrawal-display.php';
$falhas = [];
$expect = static function ($esperado, $real, string $msg) use (&$falhas): void {
    if ($esperado !== $real) {
        $falhas[] = $msg . ': esperado ' . var_export($esperado, true) . ', recebido ' . var_export($real, true);
    }
};
$expect('Desistiu em 16/10/2026 15:00 · Mudou de planos',
    bus_withdrawal_cell_text(true, '16/10/2026 15:00', 'Mudou de planos'), 'Texto com motivo');
$expect('Desistiu em 16/10/2026 15:00', bus_withdrawal_cell_text(true, '16/10/2026 15:00', null), 'Texto sem motivo');
$expect('Desistiu em 16/10/2026 15:00', bus_withdrawal_cell_text(true, '16/10/2026 15:00', '   '), 'Motivo em branco');
$expect('', bus_withdrawal_cell_text(false, null, null), 'Passageiro ativo');
$pago = ['chave' => 'pago', 'rotulo' => 'Pagamento aprovado', 'tom' => 'ok'];
$expect(['chave' => 'desistente', 'rotulo' => 'Desistente', 'tom' => 'falha'],
    bus_admin_reserva_status($pago, false, true), 'Reserva desistente');
$expect(['chave' => 'desistente', 'rotulo' => 'Desistente', 'tom' => 'falha'],
    bus_admin_reserva_status($pago, true, true), 'VIP desistente');
$expect(['chave' => 'vip', 'rotulo' => 'Reserva VIP', 'tom' => 'vip'],
    bus_admin_reserva_status($pago, true, false), 'VIP ativo');
$expect($pago, bus_admin_reserva_status($pago, false, false), 'Reserva ativa');
$frota = bus_admin_fleet_passengers([
    ['posicao' => 1, 'nome' => 'Ana', 'responsavel' => true, 'menor' => false, 'crianca_colo' => false, 'desistiu' => false, 'cpf' => 'x'],
    ['posicao' => 2, 'nome' => 'Bruno', 'responsavel' => false, 'menor' => false, 'crianca_colo' => false, 'desistiu' => true],
    ['posicao' => 3, 'nome' => 'Caio', 'responsavel' => false, 'menor' => true, 'crianca_colo' => true, 'desistiu' => false],
    ['posicao' => 4, 'nome' => 'Duda', 'responsavel' => false, 'menor' => true, 'crianca_colo' => false, 'desistiu' => true],
    ['posicao' => 5, 'nome' => 'Eli', 'responsavel' => false, 'menor' => true, 'crianca_colo' => true, 'desistiu' => true],
]);
$expect([
    ['posicao' => 1, 'nome' => 'Ana', 'responsavel' => true, 'menor' => false, 'crianca_colo' => false, 'faixa' => '18 anos ou mais', 'desistiu' => false],
    ['posicao' => 2, 'nome' => 'Bruno', 'responsavel' => false, 'menor' => false, 'crianca_colo' => false, 'faixa' => '18 anos ou mais', 'desistiu' => true],
    ['posicao' => 3, 'nome' => 'Caio', 'responsavel' => false, 'menor' => true, 'crianca_colo' => true, 'faixa' => '0 a 5 anos', 'desistiu' => false],
    ['posicao' => 4, 'nome' => 'Duda', 'responsavel' => false, 'menor' => true, 'crianca_colo' => false, 'faixa' => '6 a 17 anos', 'desistiu' => true],
], $frota, 'Frota mantém desistente pagante marcado e descarta criança de colo desistente');
$expect(2, bus_admin_fleet_withdrawn_count($frota), 'Desistentes pagantes do card (adulto e menor 6 a 17)');
$expect(0, bus_admin_fleet_withdrawn_count([]), 'Card sem passageiros não tem desistentes');
$expect(0, bus_admin_fleet_withdrawn_count(array_slice($frota, 0, 1)), 'Card só com ativos não tem desistentes');
if ($falhas) {
    fwrite(STDERR, 'FAIL: ' . implode("\nFAIL: ", $falhas) . "\n");
    exit(1);
}

echo "PASS: XLSX generation tests passed successfully\n";

