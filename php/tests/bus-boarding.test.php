<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/bus-boarding.php';

function boarding_expect($expected, $actual, string $message): void
{
    if ($expected !== $actual) {
        throw new RuntimeException($message . ': ' . var_export($actual, true));
    }
}

$body = ['passenger_id' => '1', 'leg' => 'outbound', 'present' => true, 'expected_revision' => 0, 'bus_number' => 1];
boarding_expect($body, bus_boarding_validate($body), 'Valid payload');
foreach ([['passenger_id' => 1], ['passenger_id' => '../1'], ['passenger_id' => '0'],
    ['leg' => 'other'], ['present' => 'false'], ['expected_revision' => -1],
    ['expected_revision' => 1.5], ['bus_number' => null], ['bus_number' => 0]] as $invalid) {
    try {
        bus_boarding_validate(array_replace($body, $invalid));
        throw new RuntimeException('Invalid payload was accepted');
    } catch (ValidationError $expected) {
        boarding_expect('invalid_checkin', $expected->getMessage(), 'Stable validation code');
    }
}
boarding_expect(['present' => false, 'checked_at' => null, 'revision' => 0], bus_boarding_state(null), 'Default state');
boarding_expect('2026-11-20T09:00:00Z', bus_boarding_state(['checked_at' => '2026-11-20 09:00:00'])['checked_at'], 'UTC timestamp');
echo "PASS: boarding validation\n";

$dsn = getenv('KOB_BOARDING_TEST_DSN');
if (!$dsn) {
    echo "SKIP: MySQL integration (set KOB_BOARDING_TEST_DSN for isolated kob_boarding_test database)\n";
    exit;
}
$pdo = new PDO($dsn, 'root', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false]);
boarding_expect('kob_boarding_test', $pdo->query('SELECT DATABASE()')->fetchColumn(), 'Must use isolated test database');
// The isolated database may contain the full preview schema (including payment
// proof FKs), or leftovers from an interrupted run. Reset it deterministically.
$pdo->exec('SET FOREIGN_KEY_CHECKS=0');
try {
    foreach ($pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN) as $table) {
        $pdo->exec('DROP TABLE `' . str_replace('`', '``', $table) . '`');
    }
} finally {
    $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
}
$pdo->exec('CREATE TABLE bus_registrations (
    id CHAR(36) PRIMARY KEY, primary_name VARCHAR(255), group_name VARCHAR(64),
    bus_number INT NULL, is_vip TINYINT DEFAULT 0, status VARCHAR(32), paid_at DATETIME, created_at DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
$pdo->exec('CREATE TABLE bus_passengers (
    id BIGINT PRIMARY KEY, registration_id CHAR(36), full_name VARCHAR(255), cpf VARCHAR(14),
    is_primary TINYINT DEFAULT 0, is_minor TINYINT DEFAULT 0, is_child_lap TINYINT DEFAULT 0, `position` SMALLINT,
    FOREIGN KEY (registration_id) REFERENCES bus_registrations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
// As consultas do manifesto filtram withdrawn_at: o bootstrap de produção cria as colunas.
bus_registration_edit_ensure_schema($pdo);
bus_boarding_ensure_schema($pdo);
boarding_expect(0, (int) $pdo->query('SELECT COUNT(*) FROM bus_boarding_checkins')->fetchColumn(), 'Runtime bootstrap creates an empty table');
$pdo->exec('DROP TABLE bus_boarding_checkins');
$pdo->exec(file_get_contents(__DIR__ . '/../db/009_bus_boarding_checkins.sql'));
bus_boarding_ensure_schema($pdo);
$pdo->exec("CREATE USER IF NOT EXISTS 'kob_boarding_runtime'@'%' IDENTIFIED BY ''");
$pdo->exec("GRANT SELECT, INSERT, UPDATE ON kob_boarding_test.* TO 'kob_boarding_runtime'@'%'");
$runtime = new PDO($dsn, 'kob_boarding_runtime', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
bus_boarding_ensure_schema($runtime);
echo "PASS: existing table works without CREATE permission\n";
$pdo->exec("INSERT INTO bus_registrations (id, primary_name, group_name, bus_number, status) VALUES
    ('confirmed', 'Pessoa Teste', 'Grupo Teste', 1, 'confirmed'),
    ('pending', 'Pendente Teste', NULL, 1, 'payment_pending'),
    ('waiting', 'Espera Teste', NULL, NULL, 'confirmed'),
    ('vip', 'VIP Teste', NULL, 2, 'confirmed')");
$pdo->exec("UPDATE bus_registrations SET is_vip=1 WHERE id='vip'");
$pdo->exec("INSERT INTO bus_passengers (id, registration_id, full_name, `position`, is_child_lap) VALUES
    (1, 'confirmed', 'Pessoa Teste', 1, 0), (2, 'pending', 'Pendente Teste', 1, 0),
    (3, 'waiting', 'Espera Teste', 1, 0), (4, 'vip', 'VIP Teste', 1, 0),
    (5, 'confirmed', 'Criança Teste', 2, 1)");

$initial = bus_boarding_manifest($pdo);
boarding_expect(3, count($initial['people']), 'Only confirmed and assigned; include VIP and lap child');
boarding_expect(1, $initial['waiting'], 'Count unassigned people');
boarding_expect(200, bus_boarding_save($pdo, $body)['status'], 'Save outbound');
// A second connection represents another administrator's device.
$second = new PDO($dsn, 'root', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$person = array_values(array_filter(bus_boarding_manifest($second)['people'], fn ($p) => $p['id'] === '1'))[0];
boarding_expect(true, $person['outbound']['present'], 'Another connection reads committed presence');
boarding_expect(false, $person['return']['present'], 'Return is independent');
boarding_expect(1, $person['outbound']['revision'], 'Revision increments');
boarding_expect('revision_conflict', bus_boarding_save($second, $body)['error'], 'Stale second writer conflicts');
boarding_expect(200, bus_boarding_save($second, array_replace($body, ['expected_revision' => 1]))['status'], 'Repeated desired state is harmless');
boarding_expect(1, (int) $pdo->query("SELECT revision FROM bus_boarding_checkins WHERE passenger_id=1 AND leg='outbound'")->fetchColumn(), 'No-op does not increment revision');
boarding_expect(200, bus_boarding_save($pdo, array_replace($body, ['leg' => 'return']))['status'], 'Save return independently');
boarding_expect(200, bus_boarding_save($pdo, array_replace($body, ['present' => false, 'expected_revision' => 1]))['status'], 'Undo check-in');
boarding_expect(null, $pdo->query("SELECT checked_at FROM bus_boarding_checkins WHERE passenger_id=1 AND leg='outbound'")->fetchColumn(), 'Undo clears time');
foreach (['2', '3', '999'] as $ineligible) {
    boarding_expect('manifest_changed', bus_boarding_save($pdo, array_replace($body, ['passenger_id' => $ineligible]))['error'], 'Reject ineligible passenger');
}
$pdo->exec("UPDATE bus_registrations SET bus_number=2 WHERE id='confirmed'");
boarding_expect('manifest_changed', bus_boarding_save($pdo, array_replace($body, ['expected_revision' => 2]))['error'], 'Reject stale bus allocation');
$pdo->exec("DELETE FROM bus_registrations WHERE id='confirmed'");
boarding_expect(0, (int) $pdo->query('SELECT COUNT(*) FROM bus_boarding_checkins WHERE passenger_id=1')->fetchColumn(), 'Deletion cascades check-ins');
echo "PASS: MySQL persistence, separate legs, revision conflicts, eligibility and cascade\n";
