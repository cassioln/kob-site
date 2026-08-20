<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/vip-reservations.php';

function vip_expect_same(mixed $expected, mixed $actual, string $message): void
{
    if ($expected !== $actual) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

$batch = vip_normalize_batch([
    [
        'full_name' => 'Maria VIP Teste',
        'cpf' => '529.982.247-25',
        'whatsapp' => '',
        'email' => '',
        'bus_number' => null,
    ],
]);

vip_expect_same('52998224725', $batch[0]['cpf'], 'CPF deve ser normalizado');
vip_expect_same('', $batch[0]['email'], 'e-mail opcional vazio');
vip_expect_same(null, $batch[0]['bus_number'], 'sem ônibus confirmado deve ser nulo');

$falhou = false;
try {
    vip_normalize_batch([
        ['full_name' => 'Maria VIP Teste', 'cpf' => '52998224725'],
        ['full_name' => 'Outra VIP Teste', 'cpf' => '52998224725'],
    ]);
} catch (ValidationError) {
    $falhou = true;
}
vip_expect_same(true, $falhou, 'CPF não pode repetir no mesmo lote');

fwrite(STDOUT, "PASS: VIP validation tests\n");
