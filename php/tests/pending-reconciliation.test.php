<?php

declare(strict_types=1);

require_once __DIR__ . '/../mysql/lib/pending-reconciliation.php';

function reconciliation_expect_same(mixed $expected, mixed $actual, string $message): void
{
    if ($expected !== $actual) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

$base = [
    'mercadopago_order_id' => 'ORD_TESTE',
    'idade_segundos' => 20,
    'segundos_desde_reconciliacao' => null,
];

reconciliation_expect_same(true, bus_reconciliation_is_due($base), 'reserva pendente elegível deve ser consultada');
reconciliation_expect_same(false, bus_reconciliation_is_due(array_replace($base, ['idade_segundos' => 19])), 'carência inicial deve ser respeitada');
reconciliation_expect_same(false, bus_reconciliation_is_due(array_replace($base, ['segundos_desde_reconciliacao' => 24])), 'intervalo mínimo deve ser respeitado');
reconciliation_expect_same(false, bus_reconciliation_is_due(['idade_segundos' => 90]), 'reserva sem order não pode consultar o provedor');

fwrite(STDOUT, "PASS: pending reconciliation eligibility tests\n");
