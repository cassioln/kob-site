<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/bus-fleet.php';

function expect_true(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

function expect_same(mixed $expected, mixed $actual, string $message): void
{
    if ($expected !== $actual) {
        fwrite(STDERR, "FAIL: {$message}\nExpected: " . var_export($expected, true)
            . "\nActual: " . var_export($actual, true) . "\n");
        exit(1);
    }
}

expect_same(1, bus_fleet_seat_count(1, 1), 'criança de colo não deve consumir assento');
expect_same(2, bus_fleet_seat_count(2, 3), 'a capacidade deve considerar apenas pagantes');

function snapshot(array $groups, array $vipOccupancy = []): array
{
    return [
        'buses' => [
            ['number' => 1],
            ['number' => 2],
        ],
        'groups' => $groups,
        'vip_occupancy' => $vipOccupancy,
    ];
}

$plan = bus_fleet_build_balance_plan(snapshot([
    ['id' => 'a', 'size' => 2, 'bus_number' => 1, 'fleet_assignment_status' => 'assigned', 'paid_at' => '2026-08-01 09:00:00', 'is_vip' => false],
    ['id' => 'b', 'size' => 4, 'bus_number' => 1, 'fleet_assignment_status' => 'assigned', 'paid_at' => '2026-08-01 10:00:00', 'is_vip' => false],
    ['id' => 'c', 'size' => 40, 'bus_number' => 1, 'fleet_assignment_status' => 'assigned', 'paid_at' => '2026-08-01 11:00:00', 'is_vip' => false],
    ['id' => 'd', 'size' => 34, 'bus_number' => 2, 'fleet_assignment_status' => 'assigned', 'paid_at' => '2026-08-01 12:00:00', 'is_vip' => false],
]));

expect_same(2, $plan['proposed']['closed'], 'two buses should close after moving whole groups');
expect_same(2, count($plan['moves']), 'the 2-person and 4-person groups should move together');
expect_true($plan['waiting'] === [], 'no group should wait when both buses can close');

$vipPlan = bus_fleet_build_balance_plan(snapshot([
    ['id' => 'g1', 'size' => 6, 'bus_number' => 1, 'fleet_assignment_status' => 'assigned', 'paid_at' => '2026-08-01 09:00:00', 'is_vip' => false],
    ['id' => 'g2', 'size' => 34, 'bus_number' => 2, 'fleet_assignment_status' => 'assigned', 'paid_at' => '2026-08-01 10:00:00', 'is_vip' => false],
], [1 => 40]));

expect_true(array_column($vipPlan['moves'], 'registration_id') === ['g1'], 'only non-VIP groups may move');
expect_same(40, $vipPlan['buses'][1]['vip_occupancy'], 'VIP occupancy must remain fixed');

$priorityPlan = bus_fleet_build_balance_plan(snapshot([
    ['id' => 'old', 'size' => 35, 'bus_number' => 1, 'fleet_assignment_status' => 'assigned', 'paid_at' => '2026-08-01 09:00:00', 'is_vip' => false],
    ['id' => 'mid', 'size' => 5, 'bus_number' => 1, 'fleet_assignment_status' => 'assigned', 'paid_at' => '2026-08-02 09:00:00', 'is_vip' => false],
    ['id' => 'new', 'size' => 10, 'bus_number' => 2, 'fleet_assignment_status' => 'assigned', 'paid_at' => '2026-08-03 09:00:00', 'is_vip' => false],
]));

expect_true(!in_array('old', $priorityPlan['waiting'], true), 'oldest approved payment must be preserved first');
expect_true(!in_array('mid', $priorityPlan['waiting'], true), 'middle approved payment must beat the newest group');
expect_true(in_array('new', $priorityPlan['waiting'], true), 'newest group waits when there is no second closed bus');

$indivisiblePlan = bus_fleet_build_balance_plan(snapshot([
    ['id' => 'source-base', 'size' => 39, 'bus_number' => 1, 'fleet_assignment_status' => 'assigned', 'paid_at' => '2026-08-01 09:00:00', 'is_vip' => false],
    ['id' => 'whole-group', 'size' => 7, 'bus_number' => 1, 'fleet_assignment_status' => 'assigned', 'paid_at' => '2026-08-01 10:00:00', 'is_vip' => false],
    ['id' => 'destination', 'size' => 34, 'bus_number' => 2, 'fleet_assignment_status' => 'assigned', 'paid_at' => '2026-08-01 11:00:00', 'is_vip' => false],
]));

expect_true(
    !array_filter($indivisiblePlan['moves'], static fn (array $move): bool => $move['registration_id'] === 'whole-group' && $move['size'] !== 7),
    'a group must never be represented as a partial move'
);

$oversizedPlan = bus_fleet_build_balance_plan(snapshot([
    ['id' => 'too-large', 'size' => 47, 'bus_number' => 1, 'fleet_assignment_status' => 'assigned', 'paid_at' => '2026-08-01 09:00:00', 'is_vip' => false],
]));
expect_true(in_array('too-large', $oversizedPlan['waiting'], true), 'a group above capacity must wait intact');

$signatureA = bus_fleet_balance_signature(snapshot([]));
$signatureB = bus_fleet_balance_signature(snapshot([]));
expect_same($signatureA, $signatureB, 'same snapshot must produce a stable signature');

fwrite(STDOUT, "PASS: fleet balance pure-function tests\n");
