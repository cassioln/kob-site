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
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    json_response(405, ['error' => 'Method Not Allowed']);
    exit;
}

$pdo = null;
$transactionOpen = false;
try {
    $body = read_json_body();
    $registrationId = trim((string) ($body['registration_id'] ?? ''));
    if (!preg_match('/\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/i', $registrationId)) {
        throw new ValidationError('ID da reserva VIP inválido.');
    }

    $pdo = bus_pdo();
    bus_fleet_ensure_assignment_status($pdo);
    $pdo->beginTransaction();
    $transactionOpen = true;

    $find = $pdo->prepare('SELECT is_vip FROM bus_registrations WHERE id = ? FOR UPDATE');
    $find->execute([$registrationId]);
    $isVip = $find->fetchColumn();
    if ($isVip === false) {
        throw new ValidationError('Reserva não encontrada.');
    }
    if ((int) $isVip !== 1) {
        throw new ValidationError('Somente reservas VIP podem ser removidas por esta ação.');
    }

    $delete = $pdo->prepare('DELETE FROM bus_registrations WHERE id = ? AND is_vip = 1');
    $delete->execute([$registrationId]);
    if ($delete->rowCount() !== 1) {
        throw new RuntimeException('A reserva VIP não pôde ser removida.');
    }

    $pdo->commit();
    $transactionOpen = false;
    json_response(200, ['success' => true, 'registration_id' => $registrationId]);
} catch (ValidationError $e) {
    if ($transactionOpen && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    json_response(400, ['error' => $e->getMessage()]);
} catch (Throwable $e) {
    if ($transactionOpen && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    log_failure('bus-vip-delete', $e);
    json_response(500, ['error' => 'Não foi possível remover a reserva VIP.']);
}
