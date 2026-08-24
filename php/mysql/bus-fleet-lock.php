<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/lib/validation.php';
require_once dirname(__DIR__) . '/lib/bus-fleet.php';
require_once __DIR__ . '/lib/db.php';

$config = bus_config();

if (!bus_check_admin_token($config)) {
    json_response(403, ['error' => 'Acesso negado.']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(405, ['error' => 'Method Not Allowed']);
    exit;
}

$pdo = null;

try {
    $body = read_json_body();
    $pdo = bus_pdo();

    // Garantir que a tabela bus_settings existe
    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS bus_settings (
                setting_key VARCHAR(64) PRIMARY KEY,
                setting_value TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");
    } catch (Throwable $e) {
        // ignora se já existe
    }

    if (isset($body['locked_buses']) && is_array($body['locked_buses'])) {
        $saved = bus_fleet_save_locked_buses($pdo, $body['locked_buses']);
        json_response(200, [
            'success' => true,
            'locked_buses' => $saved,
        ]);
        exit;
    }

    $busNumberRaw = $body['bus_number'] ?? ($_POST['bus_number'] ?? null);
    if ($busNumberRaw === null) {
        throw new ValidationError('Número de ônibus não informado.');
    }

    $busNumber = (int) $busNumberRaw;
    if ($busNumber < 1 || $busNumber > 99) {
        throw new ValidationError('Número de ônibus inválido.');
    }

    if (!array_key_exists('locked', $body) && !array_key_exists('locked', $_POST)) {
        throw new ValidationError('Status de bloqueio não informado.');
    }

    $locked = filter_var($body['locked'] ?? $_POST['locked'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
    if ($locked === null) {
        throw new ValidationError('Valor de bloqueio inválido.');
    }

    $currentLocked = bus_fleet_load_locked_buses($pdo, true);
    if ($locked) {
        if (!in_array($busNumber, $currentLocked, true)) {
            $currentLocked[] = $busNumber;
        }
    } else {
        $currentLocked = array_values(array_filter($currentLocked, static fn ($b) => (int) $b !== $busNumber));
    }

    $saved = bus_fleet_save_locked_buses($pdo, $currentLocked);

    json_response(200, [
        'success' => true,
        'bus_number' => $busNumber,
        'locked' => $locked,
        'locked_buses' => $saved,
    ]);
} catch (ValidationError $e) {
    json_response(400, ['error' => $e->getMessage()]);
} catch (Throwable $e) {
    log_failure('bus-fleet-lock', $e);
    json_response(500, ['error' => 'Erro interno ao atualizar bloqueio: ' . $e->getMessage()]);
}
