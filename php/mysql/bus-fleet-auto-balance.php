<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/lib/validation.php';
require_once dirname(__DIR__) . '/lib/bus-fleet.php';
require_once __DIR__ . '/lib/db.php';

$config = bus_config();
$tokenEsperado = $config['manifest_token'] ?? '';
$tokenRecebido = (string) ($_GET['token'] ?? ($_SERVER['HTTP_X_ADMIN_TOKEN'] ?? ''));

if (
    !is_string($tokenEsperado) || $tokenEsperado === ''
    || $tokenRecebido === ''
    || !hash_equals($tokenEsperado, $tokenRecebido)
) {
    json_response(403, ['error' => 'Acesso negado.']);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    json_response(405, ['error' => 'Method Not Allowed']);
    exit;
}

$pdo = null;
$transacaoAberta = false;

try {
    $body = read_json_body();
    $mode = (string) ($body['mode'] ?? '');
    if (!in_array($mode, ['preview', 'apply'], true)) {
        throw new ValidationError('Modo de distribuição inválido.');
    }

    $pdo = bus_pdo();
    bus_fleet_ensure_assignment_status($pdo);
    if ($mode === 'preview') {
        $snapshot = bus_fleet_load_balance_snapshot($pdo);
        $plan = bus_fleet_build_balance_plan($snapshot);
        json_response(200, [
            'success' => true,
            'mode' => 'preview',
            'plan' => $plan,
        ]);
        exit;
    }

    $receivedSignature = (string) ($body['signature'] ?? '');
    if (!preg_match('/\A[a-f0-9]{64}\z/i', $receivedSignature)) {
        throw new ValidationError('Assinatura da prévia inválida.');
    }

    $pdo->beginTransaction();
    $transacaoAberta = true;
    $snapshot = bus_fleet_load_balance_snapshot($pdo, true);
    $plan = bus_fleet_build_balance_plan($snapshot);

    if (!hash_equals($receivedSignature, $plan['signature'])) {
        $pdo->rollBack();
        $transacaoAberta = false;
        json_response(409, ['error' => 'A distribuição mudou desde a prévia. Gere uma nova simulação.']);
        exit;
    }

    $updateAssigned = $pdo->prepare(
        "UPDATE bus_registrations
            SET bus_number = ?, fleet_assignment_status = 'assigned', updated_at = UTC_TIMESTAMP()
          WHERE id = ? AND status = 'confirmed'"
    );
    $updateWaiting = $pdo->prepare(
        "UPDATE bus_registrations
            SET bus_number = NULL, fleet_assignment_status = 'waiting', updated_at = UTC_TIMESTAMP()
          WHERE id = ? AND status = 'confirmed'"
    );

    foreach ($plan['moves'] as $move) {
        $registrationId = (string) $move['registration_id'];
        if ($move['to_bus'] === null) {
            $updateWaiting->execute([$registrationId]);
            $affected = $updateWaiting->rowCount();
        } else {
            $updateAssigned->execute([(int) $move['to_bus'], $registrationId]);
            $affected = $updateAssigned->rowCount();
        }
        if ($affected !== 1) {
            throw new RuntimeException('A reserva mudou durante a aplicação da distribuição.');
        }
    }

    $pdo->commit();
    $transacaoAberta = false;
    json_response(200, [
        'success' => true,
        'mode' => 'apply',
        'plan' => $plan,
    ]);
} catch (ValidationError $e) {
    if ($transacaoAberta && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    json_response(400, ['error' => $e->getMessage()]);
} catch (Throwable $e) {
    if ($transacaoAberta && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    log_failure('bus-fleet-auto-balance', $e);
    json_response(500, ['error' => 'Não foi possível aplicar a distribuição automática.']);
}
