<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/registration-edit-schema.php';

function edit_expect($expected, $actual, string $message): void
{
    if ($expected !== $actual) {
        throw new RuntimeException($message . ': ' . var_export($actual, true));
    }
}

echo "PASS: registration edit schema file loads\n";

$dsn = getenv('KOB_BOARDING_TEST_DSN');
if (!$dsn) {
    echo "SKIP: MySQL integration (set KOB_BOARDING_TEST_DSN for isolated kob_boarding_test database)\n";
    exit;
}
$pdo = new PDO($dsn, 'root', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false]);
edit_expect('kob_boarding_test', $pdo->query('SELECT DATABASE()')->fetchColumn(), 'Must use isolated test database');
// Reset determinístico: o banco pode ter sobras de outra suíte ou de execução interrompida.
$pdo->exec('SET FOREIGN_KEY_CHECKS=0');
try {
    foreach ($pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN) as $table) {
        $pdo->exec('DROP TABLE `' . str_replace('`', '``', $table) . '`');
    }
} finally {
    $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
}
// Tabelas de base com as colunas reais usadas pelas tarefas de edição/desistência.
$pdo->exec("CREATE TABLE bus_registrations (
    id CHAR(36) PRIMARY KEY,
    primary_name VARCHAR(255), primary_cpf VARCHAR(14), primary_birth_date DATE NULL,
    email VARCHAR(255), whatsapp VARCHAR(32),
    passenger_count INT NOT NULL DEFAULT 1, children_count INT NOT NULL DEFAULT 0,
    group_name VARCHAR(64) NULL, is_vip TINYINT(1) NOT NULL DEFAULT 0,
    amount_cents INT NOT NULL DEFAULT 0, status VARCHAR(32),
    bus_number INT NULL,
    fleet_assignment_status ENUM('assigned', 'waiting') NOT NULL DEFAULT 'assigned',
    paid_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
$pdo->exec('CREATE TABLE bus_passengers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    registration_id CHAR(36) NOT NULL, `position` SMALLINT NOT NULL,
    full_name VARCHAR(255), cpf VARCHAR(14), whatsapp VARCHAR(11) NULL, email VARCHAR(255) NULL,
    is_primary TINYINT(1) NOT NULL DEFAULT 0, is_minor TINYINT(1) NOT NULL DEFAULT 0,
    is_child_lap TINYINT(1) NOT NULL DEFAULT 0,
    FOREIGN KEY (registration_id) REFERENCES bus_registrations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');

bus_registration_edit_ensure_schema($pdo);
bus_registration_edit_ensure_schema($pdo); // idempotente
$cols = $pdo->query("SHOW COLUMNS FROM bus_passengers LIKE 'withdraw%'")->fetchAll(PDO::FETCH_COLUMN);
sort($cols);
edit_expect(['withdrawal_reason', 'withdrawn_at'], $cols, 'Passenger withdrawal columns');
foreach (['withdrawn_at', 'withdrawn_bus_number', 'withdrawn_fleet_status'] as $c) {
    edit_expect(1, $pdo->query("SHOW COLUMNS FROM bus_registrations LIKE '$c'")->rowCount(), "Registration $c");
}
edit_expect(0, (int) $pdo->query('SELECT COUNT(*) FROM bus_registration_edits')->fetchColumn(), 'Edit log table exists');

// Usuário sem CREATE/ALTER (mesmo GRANT de bus-boarding.test.php) não quebra.
$pdo->exec("CREATE USER IF NOT EXISTS 'kob_boarding_runtime'@'%' IDENTIFIED BY ''");
$pdo->exec("GRANT SELECT, INSERT, UPDATE ON kob_boarding_test.* TO 'kob_boarding_runtime'@'%'");
$runtime = new PDO($dsn, 'kob_boarding_runtime', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
bus_registration_edit_ensure_schema($runtime);
echo "PASS: edit schema\n";
