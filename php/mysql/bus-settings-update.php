<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/lib/validation.php';
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

try {
    $body = read_json_body();
    
    $valueRaw = $_POST['vip_seats'] ?? ($body['vip_seats'] ?? ($body['value'] ?? null));
    if ($valueRaw === null) {
        throw new ValidationError('Quantidade de vagas VIP não informada.');
    }
    
    $value = (int) $valueRaw;
    if ($value < 0 || $value > 200) {
        throw new ValidationError('Quantidade de vagas inválida (mínimo 0, máximo 200).');
    }

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

    $stmt = $pdo->prepare('
        INSERT INTO bus_settings (setting_key, setting_value) 
        VALUES ("vip_seats", ?)
        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
    ');
    $stmt->execute([(string) $value]);

    json_response(200, ['success' => true, 'vip_seats' => $value]);
} catch (ValidationError $e) {
    json_response(400, ['error' => $e->getMessage()]);
} catch (Throwable $e) {
    log_failure('bus-settings-update', $e);
    json_response(500, ['error' => 'Erro interno ao atualizar configuração: ' . $e->getMessage()]);
}
