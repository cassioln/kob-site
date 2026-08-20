<?php

declare(strict_types=1);

/**
 * Mantém compatibilidade com instalações que ainda não executaram a migration.
 * A migration versionada continua sendo a fonte oficial; este guard evita que
 * uma publicação parcial derrube o painel antes de ela ser aplicada.
 */
function bus_fleet_ensure_assignment_status(PDO $pdo): void
{
    try {
        $pdo->exec("ALTER TABLE bus_registrations
            ADD COLUMN fleet_assignment_status ENUM('assigned', 'waiting') NOT NULL DEFAULT 'assigned'
            AFTER bus_number");
    } catch (Throwable $e) {
        // A coluna já existe ou a instalação não permite DDL neste momento.
    }

    try {
        $pdo->exec('CREATE INDEX bus_registrations_fleet_assignment_status_idx
            ON bus_registrations (fleet_assignment_status, bus_number)');
    } catch (Throwable $e) {
        // O índice já existe ou a instalação não permite DDL neste momento.
    }
}

/**
 * Conta os lugares VIP fixados por ônibus sem alterar o mapa de atribuições.
 *
 * @param array<string|int, int|string> $vipAssignments
 * @return array<int, int>
 */
function bus_fleet_vip_occupancy(array $vipAssignments): array
{
    $occupancy = [];
    foreach ($vipAssignments as $busNumber) {
        $bus = (int) $busNumber;
        if ($bus < 1) {
            continue;
        }
        $occupancy[$bus] = ($occupancy[$bus] ?? 0) + 1;
    }
    ksort($occupancy, SORT_NUMERIC);
    return $occupancy;
}

/**
 * Produz a assinatura estável usada para impedir a aplicação de uma prévia velha.
 */
function bus_fleet_balance_signature(array $snapshot): string
{
    $groups = [];
    foreach ($snapshot['groups'] ?? [] as $group) {
        $groups[] = [
            'id' => (string) ($group['id'] ?? ''),
            'size' => (int) ($group['size'] ?? 0),
            'bus_number' => $group['bus_number'] !== null ? (int) $group['bus_number'] : null,
            'fleet_assignment_status' => ($group['fleet_assignment_status'] ?? 'assigned') === 'waiting' ? 'waiting' : 'assigned',
            'paid_at' => (string) ($group['paid_at'] ?? ''),
        ];
    }
    usort($groups, static fn (array $a, array $b): int => strcmp($a['id'], $b['id']));

    $buses = [];
    foreach ($snapshot['buses'] ?? [] as $bus) {
        $number = (int) ($bus['number'] ?? 0);
        if ($number >= 1) {
            $buses[] = $number;
        }
    }
    $buses = array_values(array_unique($buses));
    sort($buses, SORT_NUMERIC);

    $vipOccupancy = [];
    foreach ($snapshot['vip_occupancy'] ?? [] as $bus => $count) {
        $vipOccupancy[(int) $bus] = (int) $count;
    }
    ksort($vipOccupancy, SORT_NUMERIC);

    $canonical = [
        'buses' => $buses,
        'groups' => $groups,
        'vip_occupancy' => $vipOccupancy,
        'vip_assignments' => $snapshot['vip_assignments'] ?? [],
    ];
    ksort($canonical['vip_assignments']);

    return hash(
        'sha256',
        json_encode($canonical, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)
    );
}

/**
 * Lê o estado mínimo necessário para simular ou aplicar uma redistribuição.
 *
 * @return array<string, mixed>
 */
function bus_fleet_load_balance_snapshot(PDO $pdo, bool $forUpdate = false): array
{
    // DDL dentro de uma transação MySQL pode provocar commit implícito. O
    // endpoint de aplicação garante o schema antes de abrir o lock; a leitura
    // pública pode fazer o guard aqui sem esse risco.
    if (!$forUpdate) {
        bus_fleet_ensure_assignment_status($pdo);
    }
    $lock = $forUpdate ? ' FOR UPDATE' : '';
    $query = $pdo->query(
        'SELECT id, bus_number, fleet_assignment_status, passenger_count, children_count, paid_at, created_at
           FROM bus_registrations
          WHERE status = "confirmed"
          ORDER BY paid_at ASC, created_at ASC, id ASC' . $lock
    );
    $rows = $query->fetchAll(PDO::FETCH_ASSOC);

    $settingsQuery = $pdo->query(
        "SELECT setting_key, setting_value
           FROM bus_settings
          WHERE setting_key IN ('vip_seats', 'vip_assignments')" . $lock
    );
    $settings = $settingsQuery ? $settingsQuery->fetchAll(PDO::FETCH_KEY_PAIR) : [];
    $vipCount = max(0, (int) ($settings['vip_seats'] ?? 0));
    $vipAssignments = json_decode((string) ($settings['vip_assignments'] ?? '{}'), true);
    if (!is_array($vipAssignments)) {
        $vipAssignments = [];
    }

    // O painel trata VIP sem posição explícita como estando no ônibus 1. A
    // simulação precisa usar a mesma ocupação sem gravar essa normalização.
    $effectiveVipAssignments = $vipAssignments;
    for ($i = 1; $i <= $vipCount; $i++) {
        $vipId = 'vip_' . $i;
        if (!isset($effectiveVipAssignments[$vipId])) {
            $effectiveVipAssignments[$vipId] = 1;
        }
    }

    $buses = [];
    foreach ($rows as $row) {
        if ($row['bus_number'] !== null && (int) $row['bus_number'] >= 1) {
            $buses[(int) $row['bus_number']] = ['number' => (int) $row['bus_number']];
        }
    }
    foreach ($effectiveVipAssignments as $busNumber) {
        if ((int) $busNumber >= 1) {
            $buses[(int) $busNumber] = ['number' => (int) $busNumber];
        }
    }
    if (!$buses) {
        $buses[1] = ['number' => 1];
    }
    ksort($buses, SORT_NUMERIC);

    $groups = [];
    foreach ($rows as $row) {
        $groups[] = [
            'id' => (string) $row['id'],
            'size' => (int) $row['passenger_count'] + (int) $row['children_count'],
            'bus_number' => $row['bus_number'] !== null ? (int) $row['bus_number'] : null,
            'fleet_assignment_status' => ($row['fleet_assignment_status'] ?? 'assigned') === 'waiting' ? 'waiting' : 'assigned',
            'paid_at' => (string) ($row['paid_at'] ?? ''),
            'created_at' => (string) ($row['created_at'] ?? ''),
            'is_vip' => false,
        ];
    }

    return [
        'buses' => array_values($buses),
        'groups' => $groups,
        'vip_assignments' => $effectiveVipAssignments,
        'vip_occupancy' => bus_fleet_vip_occupancy($effectiveVipAssignments),
    ];
}

/**
 * Ordenação operacional: pagamento aprovado mais antigo primeiro.
 */
function bus_fleet_group_priority(array $group): array
{
    return [
        (string) ($group['paid_at'] ?? '9999-12-31 23:59:59'),
        (string) ($group['id'] ?? ''),
    ];
}

/**
 * Monta a melhor distribuição possível sem dividir reservas.
 *
 * O problema é uma alocação inteira pequena, então usamos busca com poda:
 * a capacidade do ônibus limita cada ramo e uma cota superior de fechamento
 * elimina estados que não podem superar o melhor plano já encontrado.
 * VIPs entram apenas como ocupação fixa.
 *
 * @return array<string, mixed>
 */
function bus_fleet_build_balance_plan(array $snapshot, int $capacity = 46, int $minimum = 40): array
{
    if ($capacity < 1 || $minimum < 1 || $minimum > $capacity) {
        throw new InvalidArgumentException('Capacidade e meta da frota são inválidas.');
    }

    $busNumbers = [];
    foreach ($snapshot['buses'] ?? [] as $bus) {
        $number = (int) ($bus['number'] ?? 0);
        if ($number >= 1) {
            $busNumbers[$number] = true;
        }
    }
    foreach ($snapshot['vip_occupancy'] ?? [] as $bus => $count) {
        if ((int) $bus >= 1) {
            $busNumbers[(int) $bus] = true;
        }
    }
    foreach ($snapshot['groups'] ?? [] as $group) {
        if (($group['bus_number'] ?? null) !== null && (int) $group['bus_number'] >= 1) {
            $busNumbers[(int) $group['bus_number']] = true;
        }
    }
    if (!$busNumbers) {
        $busNumbers[1] = true;
    }
    $busNumbers = array_keys($busNumbers);
    sort($busNumbers, SORT_NUMERIC);

    $vipOccupancy = [];
    foreach ($busNumbers as $busNumber) {
        $vipOccupancy[$busNumber] = (int) ($snapshot['vip_occupancy'][$busNumber] ?? 0);
    }

    $groups = [];
    $currentOccupancy = $vipOccupancy;
    $currentWaiting = 0;
    foreach ($snapshot['groups'] ?? [] as $rawGroup) {
        $id = (string) ($rawGroup['id'] ?? '');
        $size = (int) ($rawGroup['size'] ?? 0);
        if ($id === '' || $size < 1) {
            continue;
        }
        $initialBus = ($rawGroup['bus_number'] ?? null) !== null ? (int) $rawGroup['bus_number'] : null;
        $status = ($rawGroup['fleet_assignment_status'] ?? 'assigned') === 'waiting' ? 'waiting' : 'assigned';
        if ($status === 'assigned' && $initialBus !== null && isset($currentOccupancy[$initialBus])) {
            $currentOccupancy[$initialBus] += $size;
        } else {
            $currentWaiting++;
            $initialBus = null;
        }

        $groups[] = [
            'id' => $id,
            'size' => $size,
            'initial_bus' => $initialBus,
            'paid_at' => (string) ($rawGroup['paid_at'] ?? ''),
            'is_vip' => !empty($rawGroup['is_vip']),
        ];
    }
    usort($groups, static function (array $a, array $b): int {
        return bus_fleet_group_priority($a) <=> bus_fleet_group_priority($b);
    });
    $priorityGroups = $groups;
    $searchGroups = $groups;
    usort($searchGroups, static function (array $a, array $b): int {
        if ($a['size'] !== $b['size']) {
            return $b['size'] <=> $a['size'];
        }
        return bus_fleet_group_priority($a) <=> bus_fleet_group_priority($b);
    });

    $currentClosed = 0;
    foreach ($currentOccupancy as $occupancy) {
        if ($occupancy >= $minimum) {
            $currentClosed++;
        }
    }

    $workingOccupancy = $vipOccupancy;
    $workingAssignments = [];
    $best = null;
    $nodeCount = 0;
    $nodeLimit = 500000;
    $groupCount = count($searchGroups);
    $totalSize = array_sum(array_column($searchGroups, 'size'));
    $globalUpperClosed = min(
        count($busNumbers),
        intdiv($totalSize + array_sum($vipOccupancy), $minimum)
    );

    $scoreCandidate = static function (array $assignments, array $occupancy) use ($minimum, $currentClosed, $priorityGroups): array {
        $finalAssignments = [];
        $waiting = [];
        $closed = 0;
        foreach ($occupancy as $bus => $value) {
            if ($value >= $minimum) {
                $closed++;
            }
        }

        foreach ($priorityGroups as $group) {
            $id = $group['id'];
            if (isset($assignments[$id]) && $occupancy[$assignments[$id]] >= $minimum) {
                $finalAssignments[$id] = $assignments[$id];
            } else {
                $waiting[] = $id;
            }
        }

        $priorityVector = [];
        $movedGroups = 0;
        $distance = 0;
        foreach ($priorityGroups as $group) {
            $id = $group['id'];
            $finalBus = $finalAssignments[$id] ?? null;
            $priorityVector[] = $finalBus === null ? 0 : 1;
            if ($finalBus !== $group['initial_bus']) {
                $movedGroups++;
                if ($finalBus === null || $group['initial_bus'] === null) {
                    $distance += 99;
                } else {
                    $distance += abs($finalBus - $group['initial_bus']);
                }
            }
        }

        return [
            'closed' => $closed,
            'priority' => $priorityVector,
            'moved' => $movedGroups,
            'distance' => $distance,
            'assignments' => $finalAssignments,
            'waiting' => $waiting,
            'current_closed' => $currentClosed,
        ];
    };

    $isBetter = static function (array $candidate, ?array $incumbent): bool {
        if ($incumbent === null) {
            return true;
        }
        if ($candidate['closed'] !== $incumbent['closed']) {
            return $candidate['closed'] > $incumbent['closed'];
        }
        if ($candidate['priority'] !== $incumbent['priority']) {
            return $candidate['priority'] > $incumbent['priority'];
        }
        if ($candidate['moved'] !== $incumbent['moved']) {
            return $candidate['moved'] < $incumbent['moved'];
        }
        return $candidate['distance'] < $incumbent['distance'];
    };

    // Um plano inicial bom torna a poda útil mesmo quando há muitos grupos:
    // primeiro encontramos uma solução por heurística, depois a busca tenta
    // provar que existe uma com mais ônibus fechados.
    $buildHeuristic = static function (array $orderedGroups, string $mode) use ($vipOccupancy, $busNumbers, $capacity, $minimum, $scoreCandidate): array {
        $occupancy = $vipOccupancy;
        $assignments = [];
        foreach ($orderedGroups as $group) {
            $choices = $busNumbers;
            usort($choices, static function (int $a, int $b) use ($occupancy, $group, $minimum, $mode): int {
                if ($mode === 'current') {
                    $aCurrent = $a === $group['initial_bus'] ? 0 : 1;
                    $bCurrent = $b === $group['initial_bus'] ? 0 : 1;
                    if ($aCurrent !== $bCurrent) {
                        return $aCurrent <=> $bCurrent;
                    }
                }
                $aAfter = $occupancy[$a] + $group['size'];
                $bAfter = $occupancy[$b] + $group['size'];
                if ($mode === 'balanced') {
                    $aOpen = $occupancy[$a] >= $minimum ? 1 : 0;
                    $bOpen = $occupancy[$b] >= $minimum ? 1 : 0;
                    return [$aOpen, $aAfter, $a] <=> [$bOpen, $bAfter, $b];
                }
                $aCloses = $aAfter >= $minimum ? 0 : 1;
                $bCloses = $bAfter >= $minimum ? 0 : 1;
                return [$aCloses, -$aAfter, $a] <=> [$bCloses, -$bAfter, $b];
            });

            foreach ($choices as $bus) {
                if ($occupancy[$bus] + $group['size'] <= $capacity) {
                    $occupancy[$bus] += $group['size'];
                    $assignments[$group['id']] = $bus;
                    break;
                }
            }
        }
        return $scoreCandidate($assignments, $occupancy);
    };

    $best = null;
    foreach ([
        [$searchGroups, 'current'],
        [$searchGroups, 'best_fit'],
        [$searchGroups, 'balanced'],
        [$priorityGroups, 'current'],
        [$priorityGroups, 'balanced'],
    ] as [$orderedGroups, $mode]) {
        $candidate = $buildHeuristic($orderedGroups, $mode);
        if ($isBetter($candidate, $best)) {
            $best = $candidate;
        }
    }

    $search = function (int $index, int $remainingSize) use (&$search, &$nodeCount, $nodeLimit, $groupCount, &$searchGroups, &$workingOccupancy, &$workingAssignments, &$best, $busNumbers, $capacity, $minimum, $globalUpperClosed, $scoreCandidate, $isBetter): void {
        if (++$nodeCount > $nodeLimit) {
            return;
        }
        if ($best !== null && $best['closed'] >= $globalUpperClosed) {
            return;
        }

        $closedNow = 0;
        $deficits = [];
        foreach ($workingOccupancy as $occupancy) {
            if ($occupancy >= $minimum) {
                $closedNow++;
            } else {
                $deficits[] = $minimum - $occupancy;
            }
        }
        sort($deficits, SORT_NUMERIC);
        $potentialClosed = $closedNow;
        $remainingForClosure = $remainingSize;
        foreach ($deficits as $deficit) {
            if ($remainingForClosure < $deficit) {
                break;
            }
            $potentialClosed++;
            $remainingForClosure -= $deficit;
        }
        if ($best !== null && $potentialClosed < $best['closed']) {
            return;
        }

        if ($index >= $groupCount) {
            $candidate = $scoreCandidate($workingAssignments, $workingOccupancy);
            if ($isBetter($candidate, $best)) {
                $best = $candidate;
            }
            return;
        }

        $group = $searchGroups[$index];
        $size = $group['size'];
        $id = $group['id'];
        $nextRemaining = $remainingSize - $size;

        $choices = $busNumbers;
        usort($choices, static function (int $a, int $b) use ($workingOccupancy, $group): int {
            $aCurrent = $a === $group['initial_bus'] ? 0 : 1;
            $bCurrent = $b === $group['initial_bus'] ? 0 : 1;
            return [$aCurrent, -$workingOccupancy[$a], $a] <=> [$bCurrent, -$workingOccupancy[$b], $b];
        });

        foreach ($choices as $bus) {
            if ($workingOccupancy[$bus] + $size > $capacity) {
                continue;
            }
            $workingOccupancy[$bus] += $size;
            $workingAssignments[$id] = $bus;
            $search($index + 1, $nextRemaining);
            unset($workingAssignments[$id]);
            $workingOccupancy[$bus] -= $size;
        }

        // Waiting is always considered after physical buses so the search keeps
        // older paid groups whenever a valid closed-bus plan exists.
        $search($index + 1, $nextRemaining);
    };

    $search(0, $totalSize);

    if ($best === null) {
        $best = $scoreCandidate([], $vipOccupancy);
    }

    $afterBuses = [];
    foreach ($busNumbers as $bus) {
        $afterBuses[$bus] = [
            'before' => $currentOccupancy[$bus],
            'after' => $vipOccupancy[$bus],
            'vip_occupancy' => $vipOccupancy[$bus],
            'closed' => $vipOccupancy[$bus] >= $minimum,
        ];
    }
    $groupById = [];
    foreach ($priorityGroups as $group) {
        $groupById[$group['id']] = $group;
    }
    foreach ($best['assignments'] as $id => $bus) {
        $afterBuses[$bus]['after'] += $groupById[$id]['size'];
    }
    foreach ($afterBuses as &$busData) {
        $busData['closed'] = $busData['after'] >= $minimum;
    }
    unset($busData);

    $moves = [];
    foreach ($best['assignments'] as $id => $toBus) {
        $fromBus = $groupById[$id]['initial_bus'];
        if ($fromBus !== $toBus) {
            $moves[] = [
                'registration_id' => $id,
                'from_bus' => $fromBus,
                'to_bus' => $toBus,
                'size' => $groupById[$id]['size'],
            ];
        }
    }
    foreach ($best['waiting'] as $id) {
        $fromBus = $groupById[$id]['initial_bus'];
        if ($fromBus !== null) {
            $moves[] = [
                'registration_id' => $id,
                'from_bus' => $fromBus,
                'to_bus' => null,
                'size' => $groupById[$id]['size'],
            ];
        }
    }

    usort($moves, static fn (array $a, array $b): int => strcmp($a['registration_id'], $b['registration_id']));

    $beforeClosed = 0;
    foreach ($currentOccupancy as $occupancy) {
        if ($occupancy >= $minimum) {
            $beforeClosed++;
        }
    }
    $afterClosed = 0;
    foreach ($afterBuses as $busData) {
        if ($busData['closed']) {
            $afterClosed++;
        }
    }

    return [
        'signature' => bus_fleet_balance_signature($snapshot),
        'moves' => $moves,
        'waiting' => $best['waiting'],
        'buses' => $afterBuses,
        'current' => ['closed' => $beforeClosed, 'waiting' => $currentWaiting],
        'proposed' => ['closed' => $afterClosed, 'waiting' => count($best['waiting'])],
        'search_nodes' => $nodeCount,
    ];
}

/**
 * Auto-aloca uma reserva em um ônibus que tenha vaga.
 *
 * Chamado pelo webhook ou conciliação assim que a reserva muda para 'confirmed'.
 */
function bus_assign_fleet(PDO $pdo, string $registrationId): void
{
    bus_fleet_ensure_assignment_status($pdo);
    $find = $pdo->prepare('SELECT status, bus_number, fleet_assignment_status, passenger_count, children_count FROM bus_registrations WHERE id = :id');
    $find->execute([':id' => $registrationId]);
    $reserva = $find->fetch(PDO::FETCH_ASSOC);

    if (
        !$reserva
        || $reserva['status'] !== 'confirmed'
        || $reserva['bus_number'] !== null
        || ($reserva['fleet_assignment_status'] ?? 'assigned') === 'waiting'
    ) {
        return; // Não está confirmada ou já tem ônibus
    }

    $tamanho = (int) $reserva['passenger_count'] + (int) $reserva['children_count'];
    
    // Ler todos os ônibus que já existem e suas capacidades
    $q = $pdo->query('
        SELECT bus_number, SUM(passenger_count + children_count) as ocupacao
          FROM bus_registrations
         WHERE status = "confirmed" AND bus_number IS NOT NULL
         GROUP BY bus_number
         ORDER BY bus_number ASC
    ');
    $onibus = $q->fetchAll(PDO::FETCH_ASSOC);
    
    $ocupacao = [];
    foreach ($onibus as $o) {
        $ocupacao[(int) $o['bus_number']] = (int) $o['ocupacao'];
    }

    $busNum = 1;
    while (true) {
        $current = $ocupacao[$busNum] ?? 0;
        if ($current + $tamanho <= 46) {
            break;
        }
        $busNum++;
    }

    $update = $pdo->prepare("UPDATE bus_registrations
        SET bus_number = :bus, fleet_assignment_status = 'assigned', updated_at = UTC_TIMESTAMP()
      WHERE id = :id");
    $update->execute([':bus' => $busNum, ':id' => $registrationId]);
}
