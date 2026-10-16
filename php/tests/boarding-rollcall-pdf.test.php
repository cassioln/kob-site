<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/boarding-rollcall-pdf.php';

function rollcall_expect(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$manifest = ['generated_at' => '2026-10-16T13:00:00Z', 'people' => []];
for ($i = 1; $i <= 67; $i++) {
    $manifest['people'][] = ['id' => (string) $i, 'name' => 'Pessoa ' . $i . ' de Albuquerque e Vasconcelos com sobrenome longo',
        'code' => sprintf('TEST%04d', $i), 'registration_id' => $i > 65 ? 'solo-' . $i : ($i <= 35 ? 'large-group' : 'group-' . (int) ($i / 3)),
        'group' => $i > 65 ? null : ($i <= 35 ? 'Tripulação dos Dados e Aventuras' : 'Grupo ' . (int) ($i / 3)),
        'contact' => 'Responsável Teste', 'bus_number' => $i <= 50 ? 1 : 2,
        'vip' => $i > 60 && $i <= 65, 'primary' => $i % 3 === 0, 'lap_child' => $i === 2,
        'cpf' => '111.111.111-11', 'outbound' => ['present' => $i % 2 === 0], 'return' => ['present' => $i % 3 === 0]];
}
foreach (['pt', 'en', 'es'] as $lang) {
    $pages = bus_rollcall_pages($manifest, $lang);
    rollcall_expect(count($pages) > 3, 'Fixture must cross multiple pages');
    $joined = [];
    foreach ($pages as $index => $blocks) {
        $lines = [];
        foreach ($blocks as $block) {
            if ($block['tipo'] === 'texto') {
                rollcall_expect($block['y'] >= 37 && $block['y'] <= 795, 'Text escapes A4 content boundaries');
                $lines[] = $block['texto'];
            }
        }
        $joined[$index] = implode("\n", $lines);
        rollcall_expect(str_contains($joined[$index], bus_rollcall_words($lang)['outbound']), 'Repeated leg header missing');
        rollcall_expect(str_contains($joined[$index], bus_rollcall_words($lang)['page'] . ' ' . ($index + 1) . '/' . count($pages)), 'Page numbering missing');
    }
    foreach ($manifest['people'] as $person) {
        $found = array_filter($joined, static fn(string $text): bool => str_contains($text, $person['code']));
        rollcall_expect(count($found) === 1, 'Passenger split, missing or duplicated: ' . $person['code']);
        $pageText = array_values($found)[0];
        rollcall_expect(str_contains($pageText, 'Pessoa ' . $person['id'] . ' de'), 'Name and booking separated across pages');
    }
    $allText = implode("\n", $joined);
    rollcall_expect(str_contains($allText, bus_rollcall_words($lang)['continued']), 'Large group must repeat context');
    rollcall_expect(str_contains($allText, bus_rollcall_words($lang)['solo']), 'Solo bookings must be grouped');
    rollcall_expect(!str_contains($allText, '111.111.111-11'), 'CPF must not be exported');
    $pdf = bus_rollcall_pdf($manifest, $lang);
    rollcall_expect(str_starts_with($pdf, '%PDF-1.4') && str_ends_with(rtrim($pdf), '%%EOF'), 'Invalid PDF');
    rollcall_expect(str_contains($pdf, '/MediaBox [0 0 595.28 841.89]'), 'Must be A4 portrait');
    if (getenv('KOB_ROLLCALL_PDF_OUTPUT')) file_put_contents(getenv('KOB_ROLLCALL_PDF_OUTPUT') . '-' . $lang . '.pdf', $pdf);
}
$empty = bus_rollcall_pages(['people' => []]);
rollcall_expect(count($empty) === 1, 'Empty manifest must be valid');
fwrite(STDOUT, "PASS: roll call PDF pt/en/es, A4, pagination and complete passengers\n");
