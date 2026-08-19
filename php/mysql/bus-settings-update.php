<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/lib/validation.php';
require_once __DIR__ . '/lib/db.php';

$config = bus_config();
$tokenEsperado = $config['manifest_token'] ?? '';

if (
    !is_string($tokenEsperado) || $tokenEsperado === ''
    || !hash_equals($tokenEsperado, (string) ($_SERVER['HTTP_X_ADMIN_TOKEN'] ?? ''))
) {
    json_response(403, ['error' => 'Acesso negado.']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(405, ['error' => 'Method Not Allowed']);
    exit;
}

try {
    $body = read_json_body();
    
    if (!isset($body['key']) || !is_string($body['key']) || $body['key'] !== 'vip_seats') {
        throw new ValidationError('Chave de configuração inválida.');
    }
    
    $value = (int) ($body['value'] ?? 0);
    if ($value < 0 || $value > 200) {
        throw new ValidationError('Quantidade de vagas inválida.');
    }

    $pdo = bus_pdo();
    $stmt = $pdo->prepare('UPDATE bus_settings SET setting_value = ? WHERE setting_key = ?');
    $stmt->execute([(string) $value, $body['key']]);

    json_response(200, ['success' => true]);
} catch (ValidationError $e) {
    json_response(400, ['error' => $e->getMessage()]);
} catch (Throwable $e) {
    log_failure('bus-settings-update', $e);
    json_response(503, ['error' => 'Erro interno ao atualizar configuração.']);
}
