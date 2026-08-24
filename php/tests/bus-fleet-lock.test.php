<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/bus-fleet.php';

function lock_expect_same(mixed $expected, mixed $actual, string $message): void
{
    if ($expected !== $actual) {
        fwrite(STDERR, "FAIL: {$message}. Expected " . var_export($expected, true) . ", got " . var_export($actual, true) . "\n");
        exit(1);
    }
}

// 1. Teste de isolamento de ônibus bloqueados no auto-balanceamento
$snapshot = [
    'buses' => [
        ['number' => 1],
        ['number' => 2],
    ],
    'locked_buses' => [1],
    'vip_assignments' => [],
    'vip_occupancy' => [1 => 0, 2 => 0],
    'groups' => [
        [
            'id' => 'g1',
            'size' => 40,
            'bus_number' => 1,
            'fleet_assignment_status' => 'assigned',
            'paid_at' => '2026-08-01 10:00:00',
            'is_vip' => false,
        ],
        [
            'id' => 'g2',
            'size' => 40,
            'bus_number' => null,
            'fleet_assignment_status' => 'waiting',
            'paid_at' => '2026-08-01 11:00:00',
            'is_vip' => false,
        ],
    ],
];

// Com o Ônibus 1 bloqueado com 40 vagas ocupadas por g1, o g2 deve ir para o Ônibus 2, sem mover o g1
$plan = bus_fleet_build_balance_plan($snapshot, 46, 40);

lock_expect_same(2, $plan['proposed']['closed'], 'Ônibus 1 e 2 devem ficar fechados');
lock_expect_same(['g2'], array_column($plan['moves'], 'registration_id'), 'Apenas g2 deve ter movimento gerado (para o Ônibus 2); g1 permanece inalterado');
lock_expect_same(2, $plan['moves'][0]['to_bus'], 'g2 deve ser alocado no Ônibus 2');

// 2. Teste de assinatura com locked_buses
$sig1 = bus_fleet_balance_signature($snapshot);
$snapshot2 = $snapshot;
$snapshot2['locked_buses'] = [1, 2];
$sig2 = bus_fleet_balance_signature($snapshot2);

lock_expect_same(false, $sig1 === $sig2, 'Assinatura deve variar quando a lista de bloqueios mudar');

fwrite(STDOUT, "PASS: fleet lock tests\n");
