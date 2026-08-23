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
        ],
    ],
];

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
    'grupo_centralizado', 'falha_grupo', 'falha_grupo_centralizado'
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

echo "PASS: XLSX generation tests passed successfully\n";
