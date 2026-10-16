<?php

declare(strict_types=1);

/**
 * Colunas de desistência e log de edição das reservas.
 *
 * Idempotente e tolerante à falta de permissão DDL: com o schema já aplicado
 * (migration 010 ou execução anterior) só faz um SELECT de sondagem, sem DDL e
 * sem metadata locks a cada requisição. php/db fica fora do deploy por FTP,
 * então este bootstrap é o caminho de produção; 010_registration_edit.sql é a
 * migration manual equivalente.
 */
function bus_registration_edit_ensure_schema(PDO $pdo): void
{
    try {
        $pdo->query('SELECT withdrawn_at, withdrawal_reason FROM bus_passengers LIMIT 0');
        $pdo->query('SELECT withdrawn_at, withdrawn_bus_number, withdrawn_fleet_status
            FROM bus_registrations LIMIT 0');
        $pdo->query('SELECT 1 FROM bus_registration_edits LIMIT 0');
        return;
    } catch (PDOException $e) {
        // 42S02 tabela ausente, 42S22 coluna ausente. Qualquer outro erro é real.
        if (!in_array($e->getCode(), ['42S02', '42S22'], true)) throw $e;
    }

    // MySQL 5.7 não aceita ADD COLUMN IF NOT EXISTS: cada coluna é um ALTER
    // próprio, e a falha de uma (já existe, sem permissão) não bloqueia as demais.
    $columns = [
        "ALTER TABLE bus_passengers ADD COLUMN withdrawn_at DATETIME NULL AFTER is_child_lap",
        "ALTER TABLE bus_passengers ADD COLUMN withdrawal_reason VARCHAR(500) NULL AFTER withdrawn_at",
        "ALTER TABLE bus_registrations ADD COLUMN withdrawn_at DATETIME NULL AFTER paid_at",
        "ALTER TABLE bus_registrations ADD COLUMN withdrawn_bus_number TINYINT UNSIGNED NULL AFTER withdrawn_at",
        "ALTER TABLE bus_registrations ADD COLUMN withdrawn_fleet_status ENUM('assigned', 'waiting') NULL AFTER withdrawn_bus_number",
    ];
    foreach ($columns as $ddl) {
        try {
            $pdo->exec($ddl);
        } catch (Throwable $e) {
            // A coluna já existe ou a instalação não permite DDL neste momento.
        }
    }

    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS bus_registration_edits (
            id BIGINT NOT NULL AUTO_INCREMENT,
            registration_id CHAR(36) NOT NULL,
            edited_at DATETIME NOT NULL COMMENT 'UTC',
            changes LONGTEXT NOT NULL COMMENT 'JSON serializado',
            PRIMARY KEY (id),
            KEY bus_registration_edits_registration_idx (registration_id, edited_at),
            CONSTRAINT bus_registration_edits_registration_fk
                FOREIGN KEY (registration_id) REFERENCES bus_registrations (id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    } catch (Throwable $e) {
        // A tabela já existe ou a instalação não permite DDL neste momento.
    }
}
