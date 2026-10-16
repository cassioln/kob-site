<?php

declare(strict_types=1);

require_once __DIR__ . '/validation.php';

function bus_boarding_ensure_schema(PDO $pdo): void
{
    // A manually provisioned table must also work for a runtime user without
    // CREATE permission. Avoid DDL and metadata locks on every polling request.
    try {
        $pdo->query('SELECT 1 FROM bus_boarding_checkins LIMIT 0');
        return;
    } catch (PDOException $e) {
        if ($e->getCode() !== '42S02') throw $e;
    }
    // php/db is deliberately excluded from FTP deployment. Keep the runtime
    // bootstrap here; 009_bus_boarding_checkins.sql is the manual migration.
    $pdo->exec("CREATE TABLE IF NOT EXISTS bus_boarding_checkins (
        passenger_id BIGINT NOT NULL,
        leg ENUM('outbound', 'return') NOT NULL,
        present TINYINT(1) NOT NULL DEFAULT 0,
        checked_at DATETIME NULL COMMENT 'UTC',
        revision INT UNSIGNED NOT NULL DEFAULT 0,
        PRIMARY KEY (passenger_id, leg),
        CONSTRAINT bus_boarding_passenger_fk FOREIGN KEY (passenger_id)
            REFERENCES bus_passengers (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function bus_boarding_validate(array $body): array
{
    $id = $body['passenger_id'] ?? null;
    if (!is_string($id) || !preg_match('/^[1-9][0-9]{0,17}$/D', $id)
        || !in_array($body['leg'] ?? null, ['outbound', 'return'], true)
        || !is_bool($body['present'] ?? null)
        || !is_int($body['expected_revision'] ?? null)
        || $body['expected_revision'] < 0 || $body['expected_revision'] > 4294967294
        || !is_int($body['bus_number'] ?? null) || $body['bus_number'] < 1) {
        throw new ValidationError('invalid_checkin');
    }
    return $body;
}

function bus_boarding_state(?array $row): array
{
    return [
        'present' => (bool) ($row['present'] ?? false),
        'checked_at' => !empty($row['checked_at'])
            ? str_replace(' ', 'T', $row['checked_at']) . 'Z' : null,
        'revision' => (int) ($row['revision'] ?? 0),
    ];
}

function bus_boarding_manifest(PDO $pdo): array
{
    $rows = $pdo->query('SELECT p.id AS passenger_id, p.full_name, p.cpf,
            p.is_primary, p.is_minor, p.is_child_lap, p.`position`,
            r.id AS registration_id, r.primary_name, r.group_name, r.bus_number, r.is_vip,
            c.leg, c.present, c.checked_at, c.revision
        FROM bus_registrations r
        JOIN bus_passengers p ON p.registration_id = r.id
        LEFT JOIN bus_boarding_checkins c ON c.passenger_id = p.id
        WHERE r.status = "confirmed" AND r.bus_number IS NOT NULL
        ORDER BY r.bus_number, r.is_vip DESC, r.paid_at, r.created_at, r.id, p.`position`, c.leg')
        ->fetchAll(PDO::FETCH_ASSOC);
    $people = [];
    foreach ($rows as $row) {
        $id = (string) $row['passenger_id'];
        if (!isset($people[$id])) {
            $people[$id] = [
                'id' => $id,
                'registration_id' => $row['registration_id'],
                'code' => strtoupper(substr($row['registration_id'], 0, 8)),
                'name' => $row['full_name'],
                'cpf' => $row['cpf'],
                'contact' => $row['primary_name'],
                'group' => $row['group_name'],
                'bus_number' => (int) $row['bus_number'],
                'vip' => (bool) $row['is_vip'],
                'primary' => (bool) $row['is_primary'],
                'minor' => (bool) $row['is_minor'],
                'lap_child' => (bool) $row['is_child_lap'],
                'outbound' => bus_boarding_state(null),
                'return' => bus_boarding_state(null),
            ];
        }
        if ($row['leg'] !== null) {
            $people[$id][$row['leg']] = bus_boarding_state($row);
        }
    }
    $waiting = (int) $pdo->query('SELECT COUNT(*) FROM bus_passengers p
        JOIN bus_registrations r ON r.id = p.registration_id
        WHERE r.status = "confirmed" AND r.bus_number IS NULL')->fetchColumn();
    return ['people' => array_values($people), 'waiting' => $waiting, 'generated_at' => gmdate('c')];
}

/** The registration lock serializes check-ins with fleet moves, refunds and deletion. */
function bus_boarding_save(PDO $pdo, array $body): array
{
    $body = bus_boarding_validate($body);
    $pdo->beginTransaction();
    try {
        $find = $pdo->prepare('SELECT r.id, r.status, r.bus_number FROM bus_registrations r
            JOIN bus_passengers p ON p.registration_id = r.id WHERE p.id = ? FOR UPDATE');
        $find->execute([$body['passenger_id']]);
        $registration = $find->fetch(PDO::FETCH_ASSOC);
        if (!$registration || $registration['status'] !== 'confirmed'
            || (int) $registration['bus_number'] !== $body['bus_number']) {
            $pdo->rollBack();
            return ['status' => 409, 'error' => 'manifest_changed'];
        }
        $insert = $pdo->prepare('INSERT IGNORE INTO bus_boarding_checkins (passenger_id, leg) VALUES (?, ?)');
        $insert->execute([$body['passenger_id'], $body['leg']]);
        $find = $pdo->prepare('SELECT present, checked_at, revision FROM bus_boarding_checkins
            WHERE passenger_id = ? AND leg = ? FOR UPDATE');
        $find->execute([$body['passenger_id'], $body['leg']]);
        $current = $find->fetch(PDO::FETCH_ASSOC);
        if ((int) $current['revision'] !== $body['expected_revision']) {
            $pdo->rollBack();
            return ['status' => 409, 'error' => 'revision_conflict', 'checkin' => bus_boarding_state($current)];
        }
        if ((bool) $current['present'] !== $body['present']) {
            $update = $pdo->prepare('UPDATE bus_boarding_checkins
                SET present = ?, checked_at = ?, revision = revision + 1
                WHERE passenger_id = ? AND leg = ?');
            $update->execute([$body['present'] ? 1 : 0,
                $body['present'] ? gmdate('Y-m-d H:i:s') : null, $body['passenger_id'], $body['leg']]);
        }
        $find->execute([$body['passenger_id'], $body['leg']]);
        $saved = $find->fetch(PDO::FETCH_ASSOC);
        $pdo->commit();
        return ['status' => 200, 'checkin' => bus_boarding_state($saved)];
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}
