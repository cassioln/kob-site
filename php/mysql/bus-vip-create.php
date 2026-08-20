<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/lib/validation.php';
require_once dirname(__DIR__) . '/lib/bus-fleet.php';
require_once dirname(__DIR__) . '/lib/vip-reservations.php';
require_once __DIR__ . '/lib/db.php';

$config = bus_config();
if (!bus_check_admin_token($config)) {
    json_response(403, ['error' => 'Acesso negado.']);
    exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    json_response(405, ['error' => 'Method Not Allowed']);
    exit;
}

$pdo = null;
$transactionOpen = false;

try {
    $body = read_json_body();
    $vips = vip_normalize_batch($body['vips'] ?? null);
    $pdo = bus_pdo();
    bus_fleet_ensure_assignment_status($pdo);

    // Instalações antigas podem ainda não ter executado a migration 003.
    $pdo->exec("CREATE TABLE IF NOT EXISTS bus_settings (
        setting_key VARCHAR(64) PRIMARY KEY,
        setting_value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("INSERT IGNORE INTO bus_settings (setting_key, setting_value) VALUES ('vip_seats', '0')");
    bus_fleet_clear_legacy_vip_settings($pdo);

    $pdo->beginTransaction();
    $transactionOpen = true;

    $cpfs = array_column($vips, 'cpf');
    $placeholders = implode(',', array_fill(0, count($cpfs), '?'));
    $existing = $pdo->prepare("SELECT cpf FROM bus_passengers WHERE cpf IN ({$placeholders}) FOR UPDATE");
    $existing->execute($cpfs);
    if ($existing->fetchColumn() !== false) {
        throw new ValidationError('Já existe uma reserva com um dos CPFs informados.');
    }

    $legacyVip = bus_fleet_load_legacy_vip_settings($pdo, true);
    $legacyOccupancy = bus_fleet_vip_occupancy($legacyVip['effective_assignments']);
    $batchOccupancy = [];
    $created = [];

    $insertRegistration = $pdo->prepare(
        'INSERT INTO bus_registrations
            (id, external_reference, primary_name, primary_cpf, email, whatsapp,
             passenger_count, children_count, group_name, amount_cents, currency,
             status, status_detail, bus_number, fleet_assignment_status, is_vip)
         VALUES (?, ?, ?, ?, ?, ?, 1, 0, NULL, 0, \'BRL\', \'confirmed\', ?, ?, ?, 1)'
    );
    $insertPassenger = $pdo->prepare(
        'INSERT INTO bus_passengers
            (registration_id, `position`, full_name, cpf, whatsapp, email, is_primary, is_minor, is_child_lap)
         VALUES (?, 1, ?, ?, ?, ?, 1, 0, 0)'
    );

    foreach ($vips as $vip) {
        $bus = $vip['bus_number'];
        if ($bus !== null) {
            if (!array_key_exists($bus, $batchOccupancy)) {
                $batchOccupancy[$bus] = bus_fleet_bus_occupancy($pdo, $bus, null, true)
                    + (int) ($legacyOccupancy[$bus] ?? 0);
            }
            if ($batchOccupancy[$bus] + 1 > 46) {
                throw new ValidationError(
                    'O Ônibus ' . $bus . ' não tem capacidade suficiente ('
                    . max(0, 46 - $batchOccupancy[$bus])
                    . ' vagas restantes; é necessária 1).'
                );
            }
            $batchOccupancy[$bus]++;
        }

        $id = uuid_v4();
        $externalReference = 'kob_admin_vip_' . $id;
        $assignmentStatus = $bus === null ? 'waiting' : 'assigned';
        $insertRegistration->execute([
            $id,
            $externalReference,
            $vip['full_name'],
            $vip['cpf'],
            $vip['email'],
            $vip['whatsapp'],
            'Reserva VIP administrativa',
            $bus,
            $assignmentStatus,
        ]);
        $insertPassenger->execute([
            $id,
            $vip['full_name'],
            $vip['cpf'],
            $vip['whatsapp'] !== '' ? $vip['whatsapp'] : null,
            $vip['email'] !== '' ? $vip['email'] : null,
        ]);

        $created[] = [
            'id' => $id,
            'code' => strtoupper(substr($id, 0, 8)),
            'responsavel' => $vip['full_name'],
            'bus_number' => $bus,
            'is_vip' => true,
        ];
    }

    $pdo->commit();
    $transactionOpen = false;
    json_response(201, ['success' => true, 'vips' => $created]);
} catch (ValidationError $e) {
    if ($transactionOpen && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    json_response(400, ['error' => $e->getMessage()]);
} catch (Throwable $e) {
    if ($transactionOpen && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    log_failure('bus-vip-create', $e);
    json_response(500, ['error' => 'Não foi possível criar as reservas VIP.']);
}
