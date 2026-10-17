<?php

declare(strict_types=1);

require_once __DIR__ . '/registration-edit.php';
require_once __DIR__ . '/group-names.php';
require_once __DIR__ . '/bus-fleet.php';

/** Assentos físicos de cada ônibus (mesma conta de bus-vip-create e bus-fleet-assign). */
const BUS_REGISTRATION_EDIT_CAPACITY = 46;

/** Colunas de bus_registrations que o plano pode gravar. Nunca amount_cents nem status. */
const BUS_REGISTRATION_EDIT_COLUMNS = [
    'group_name', 'primary_name', 'primary_cpf', 'email', 'whatsapp', 'primary_birth_date',
    'passenger_count', 'children_count', 'bus_number', 'fleet_assignment_status',
    'withdrawn_at', 'withdrawn_bus_number', 'withdrawn_fleet_status',
];

/**
 * Grava uma edição de reserva feita no painel.
 *
 * Tudo dentro de uma transação que o chamador abriu (e que o chamador desfaz
 * se esta função lançar). O schema de desistência precisa estar garantido antes
 * do BEGIN: DDL faz commit implícito.
 *
 * Ordem dos locks: a reserva, os passageiros dela, depois bus_settings (trava e
 * VIP legado) e as reservas do ônibus de destino, como bus-fleet-assign.php.
 *
 * @return array{plan: array, waiting: int, updated_at: string, registration: array}
 *   `registration` é a linha travada ANTES da edição (o e-mail usa o ônibus antigo).
 * @throws ValidationError|RegistrationEditConflict
 */
function bus_registration_edit_apply(PDO $pdo, array $request, string $nowUtc): array
{
    $registrationId = is_string($request['registration_id'] ?? null) ? trim($request['registration_id']) : '';

    $find = $pdo->prepare(
        'SELECT id, primary_name, primary_cpf, primary_birth_date, email, whatsapp,
                passenger_count, children_count, group_name, is_vip, status,
                bus_number, fleet_assignment_status, updated_at,
                withdrawn_at, withdrawn_bus_number, withdrawn_fleet_status
           FROM bus_registrations WHERE id = ? FOR UPDATE'
    );
    $find->execute([$registrationId]);
    $registration = $find->fetch(PDO::FETCH_ASSOC);
    if (!$registration) {
        throw new ValidationError('Reserva não encontrada.');
    }

    $passengersQuery = $pdo->prepare(
        'SELECT id, `position`, full_name, cpf, whatsapp, email, is_primary, is_minor, is_child_lap,
                withdrawn_at, withdrawal_reason
           FROM bus_passengers WHERE registration_id = ? ORDER BY `position` FOR UPDATE'
    );
    $passengersQuery->execute([$registrationId]);
    $rows = $passengersQuery->fetchAll(PDO::FETCH_ASSOC);

    $ownGroup = $registration['group_name'] === null ? null : (string) $registration['group_name'];
    $namesInUse = array_values(array_filter(
        bus_nomes_em_uso($pdo),
        static fn (string $name): bool => $name !== $ownGroup
    ));

    $plan = bus_registration_edit_plan(
        ['registration' => $registration, 'passengers' => $rows],
        $request,
        $namesInUse,
        $nowUtc
    );

    // A ocupação só conta reservas confirmadas: uma reserva estornada que
    // voltasse para o ônibus ficaria com lugar sem aparecer na contagem.
    if ($plan['reactivated_registration'] && $registration['status'] !== 'confirmed') {
        throw new ValidationError('Só reservas confirmadas podem voltar para um ônibus.');
    }

    $rowsById = [];
    foreach ($rows as $row) {
        $rowsById[(string) $row['id']] = $row;
    }
    bus_registration_edit_check_cpfs($pdo, $registrationId, $rowsById, $plan, $registration['withdrawn_at'] !== null);
    bus_registration_edit_check_capacity($pdo, $registration, $plan);

    // Salvar sem mudanças não grava nada: subir updated_at faria qualquer outro
    // modal aberto nesta reserva receber um "stale" falso.
    if ($plan['changes'] !== []) {
        bus_registration_edit_write_passengers($pdo, $registrationId, $rowsById, $plan['passengers']);
        bus_registration_edit_write_registration($pdo, $registrationId, $plan['registration']);
        $pdo->prepare('INSERT INTO bus_registration_edits (registration_id, edited_at, changes) VALUES (?, ?, ?)')
            ->execute([
                $registrationId,
                $nowUtc,
                json_encode($plan['changes'], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
            ]);
    }

    $waiting = (int) $pdo->query(
        "SELECT COUNT(*) FROM bus_registrations
          WHERE fleet_assignment_status = 'waiting' AND bus_number IS NULL
            AND withdrawn_at IS NULL AND status = 'confirmed'"
    )->fetchColumn();

    $updatedAt = $pdo->prepare('SELECT updated_at FROM bus_registrations WHERE id = ?');
    $updatedAt->execute([$registrationId]);

    return [
        'plan' => $plan,
        'waiting' => $waiting,
        'updated_at' => (string) $updatedAt->fetchColumn(),
        'registration' => $registration,
    ];
}

/**
 * Erro de concorrência que vale repetir a transação inteira: 1213 (deadlock) ou
 * 1205 (lock wait timeout). A edição pode cruzar com um check-in do embarque,
 * que trava passageiro e depois reserva (ordem inversa da edição).
 */
function bus_registration_edit_is_retryable(Throwable $e): bool
{
    if (!$e instanceof PDOException) return false;
    return in_array((int) ($e->errorInfo[1] ?? 0), [1213, 1205], true);
}

/**
 * CPFs que passam a estar ativos nesta reserva: os que mudaram e os de quem
 * volta da desistência (passageiro ou reserva inteira). Outra reserva viva com
 * o mesmo CPF ativo bloqueia; passageiro desistente de outra reserva não.
 */
function bus_registration_edit_check_cpfs(PDO $pdo, string $registrationId, array $rowsById, array $plan, bool $wasWithdrawn): void
{
    $cpfs = [];
    foreach ($plan['passengers'] as $passenger) {
        if ($passenger['withdrawn_at'] !== null) continue;
        $row = $rowsById[$passenger['id']];
        $activeBefore = !$wasWithdrawn && $row['withdrawn_at'] === null;
        if ($passenger['cpf'] !== (string) $row['cpf'] || !$activeBefore) {
            $cpfs[$passenger['cpf']] = true;
        }
    }
    if ($cpfs === []) return;

    $lookup = $pdo->prepare(
        "SELECT r.id
           FROM bus_passengers p
           JOIN bus_registrations r ON r.id = p.registration_id
          WHERE p.cpf = ? AND r.id <> ?
            AND p.withdrawn_at IS NULL AND r.withdrawn_at IS NULL
            AND r.status IN ('confirmed', 'payment_pending', 'paid_awaiting_proof')
          LIMIT 1"
    );
    foreach (array_keys($cpfs) as $cpf) {
        $lookup->execute([(string) $cpf, $registrationId]);
        $other = $lookup->fetchColumn();
        $lookup->closeCursor();
        if ($other !== false) {
            throw new RegistrationEditConflict(
                'Este CPF já está na reserva #' . strtoupper(substr((string) $other, 0, 8)) . '.',
                'cpf_in_use'
            );
        }
    }
}

/**
 * Mais assentos ativos (reativação ou colo → pagante) num ônibus: o ônibus
 * precisa estar destravado e caber a reserva inteira, contando os VIPs legados.
 */
function bus_registration_edit_check_capacity(PDO $pdo, array $registration, array $plan): void
{
    if ($plan['seats_after'] <= $plan['seats_before']) return;

    $bus = array_key_exists('bus_number', $plan['registration'])
        ? $plan['registration']['bus_number']
        : $registration['bus_number'];
    if ($bus === null) return;
    $bus = (int) $bus;

    if (bus_fleet_is_bus_locked($pdo, $bus, true)) {
        throw new RegistrationEditConflict('O Ônibus ' . $bus . ' está bloqueado para alterações.', 'locked');
    }

    $legacyVip = bus_fleet_load_legacy_vip_settings($pdo, true);
    $legacyOccupancy = bus_fleet_vip_occupancy($legacyVip['effective_assignments']);
    $occupancy = bus_fleet_bus_occupancy($pdo, $bus, (string) $registration['id'], true)
        + (int) ($legacyOccupancy[$bus] ?? 0);
    if ($occupancy + $plan['seats_after'] > BUS_REGISTRATION_EDIT_CAPACITY) {
        throw new RegistrationEditConflict(
            'O Ônibus ' . $bus . ' não tem vagas suficientes ('
            . max(0, BUS_REGISTRATION_EDIT_CAPACITY - $occupancy)
            . ' livres; são necessárias ' . $plan['seats_after'] . ').',
            'capacity'
        );
    }
}

/**
 * Regrava todos os passageiros. CPFs trocados entre passageiros da mesma
 * reserva colidiriam no UNIQUE (registration_id, cpf) no meio da troca, então
 * quem muda de CPF passa antes por um valor provisório: '#' + id em base 36.
 * A coluna é VARCHAR(14): o maior BIGINT (unsigned, 20 dígitos) tem 13
 * caracteres em base 36, então o provisório cabe sempre (o id em decimal só
 * caberia até 13 dígitos). O '#' impede colidir com CPF real (só dígitos).
 */
function bus_registration_edit_write_passengers(PDO $pdo, string $registrationId, array $rowsById, array $passengers): void
{
    $placeholder = $pdo->prepare("UPDATE bus_passengers SET cpf = CONCAT('#', LOWER(CONV(id, 10, 36))) WHERE id = ? AND registration_id = ?");
    foreach ($passengers as $passenger) {
        if ($passenger['cpf'] !== (string) $rowsById[$passenger['id']]['cpf']) {
            $placeholder->execute([$passenger['id'], $registrationId]);
        }
    }

    $update = $pdo->prepare(
        'UPDATE bus_passengers
            SET full_name = ?, cpf = ?, whatsapp = ?, email = ?,
                is_primary = ?, is_minor = ?, is_child_lap = ?,
                withdrawn_at = ?, withdrawal_reason = ?
          WHERE id = ? AND registration_id = ?'
    );
    foreach ($passengers as $passenger) {
        $update->execute([
            $passenger['full_name'], $passenger['cpf'], $passenger['whatsapp'], $passenger['email'],
            $passenger['is_primary'], $passenger['is_minor'], $passenger['is_child_lap'],
            $passenger['withdrawn_at'], $passenger['withdrawal_reason'],
            $passenger['id'], $registrationId,
        ]);
    }
}

/**
 * Grava as colunas do plano e sempre `updated_at`: o schema não tem ON UPDATE,
 * e a regra de conflito (stale) depende de todo salvamento com mudança alterar
 * esse valor (salvamento sem mudança nem chega aqui).
 * DATETIME guarda segundos: dois salvamentos no mesmo segundo repetiriam o
 * valor, então o GREATEST garante que ele sempre avança.
 */
function bus_registration_edit_write_registration(PDO $pdo, string $registrationId, array $columns): void
{
    $sets = ['updated_at = GREATEST(UTC_TIMESTAMP(), updated_at + INTERVAL 1 SECOND)'];
    $params = [];
    foreach (BUS_REGISTRATION_EDIT_COLUMNS as $column) {
        if (array_key_exists($column, $columns)) {
            $sets[] = "`{$column}` = ?";
            $params[] = $columns[$column];
        }
    }
    $params[] = $registrationId;

    try {
        $pdo->prepare('UPDATE bus_registrations SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params);
    } catch (PDOException $e) {
        // 1062: o único UNIQUE que a edição mexe é group_name (outra reserva
        // pegou o nome entre a abertura do modal e o salvamento).
        if ((int) ($e->errorInfo[1] ?? 0) === 1062) {
            throw new ValidationError('Escolha um nome de grupo disponível.');
        }
        throw $e;
    }
}
