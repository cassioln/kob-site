<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/boarding-rollcall-xlsx.php';

$manifest = ['generated_at' => '2026-10-16T13:00:00Z', 'people' => [
    ['registration_id' => 'a', 'code' => '00000001', 'name' => '=TESTE Nome & Acentuação', 'group' => null, 'contact' => 'Solo', 'bus_number' => 1, 'vip' => false,
        'outbound' => ['present' => true, 'checked_at' => '2026-10-16T12:00:00Z'], 'return' => ['present' => false]],
    ['registration_id' => 'b', 'code' => '00000002', 'name' => 'Pessoa VIP Teste', 'bus_number' => 2, 'vip' => true,
        'outbound' => ['present' => false], 'return' => ['present' => true, 'checked_at' => '2026-10-16T13:00:00Z']],
]];
foreach (['pt', 'en', 'es'] as $lang) {
    $bytes = bus_rollcall_xlsx($manifest, $lang);
    $path = tempnam(sys_get_temp_dir(), 'kob-rollcall-');
    file_put_contents($path, $bytes);
    $zip = new ZipArchive();
    if ($zip->open($path) !== true) throw new RuntimeException('Invalid Excel ZIP');
    $xml = $zip->getFromName('xl/worksheets/sheet1.xml');
    $zip->close(); unlink($path);
    foreach (['00000001', '00000002', 'Pessoa VIP Teste', '09:00:00', '10:00:00', bus_rollcall_words($lang)['outbound'], bus_rollcall_words($lang)['return']] as $value) {
        if (!str_contains($xml, $value)) throw new RuntimeException('Missing Excel content: ' . $value);
    }
    if (str_contains($xml, '<f>') || !str_contains($xml, '=TESTE Nome &amp; Acentuação')) throw new RuntimeException('Passenger text must not become a formula');
    if (getenv('KOB_ROLLCALL_XLSX_OUTPUT')) file_put_contents(getenv('KOB_ROLLCALL_XLSX_OUTPUT') . '-' . $lang . '.xlsx', $bytes);
}
fwrite(STDOUT, "PASS: Excel pt/en/es, complete states, codes, times and safe text\n");
