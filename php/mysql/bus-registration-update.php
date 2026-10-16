<?php

declare(strict_types=1);

/**
 * Edição de reserva pelo painel: dados dos passageiros, grupo, responsável e
 * desistência. Regras em php/lib/registration-edit.php (plano puro) e
 * php/lib/registration-edit-apply.php (gravação com locks).
 *
 * 409 quando o conflito é com o estado atual (code: stale, capacity, locked,
 * cpf_in_use); 400 para dado inválido. O e-mail para a organização sai depois
 * do commit e uma falha nele não desfaz o salvamento.
 */

require_once dirname(__DIR__) . '/lib/validation.php';
require_once dirname(__DIR__) . '/lib/bus-fleet.php';
require_once dirname(__DIR__) . '/lib/registration-edit-apply.php';
require_once dirname(__DIR__) . '/lib/registration-edit-email.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/confirmation-mailer.php';

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
$result = null;
try {
    $body = read_json_body();
    $registrationId = trim((string) ($body['registration_id'] ?? ''));
    if (!preg_match('/\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/i', $registrationId)) {
        throw new ValidationError('ID da reserva inválido.');
    }
    $body['registration_id'] = $registrationId;

    $pdo = bus_pdo();
    bus_fleet_ensure_assignment_status($pdo);
    // Antes da transação: DDL faz commit implícito.
    bus_registration_edit_ensure_schema($pdo);

    // Uma segunda tentativa em deadlock/lock wait timeout (check-in do embarque
    // concorrente). A segunda falha cai no 500 abaixo.
    for ($attempt = 1; ; $attempt++) {
        try {
            $pdo->beginTransaction();
            $transactionOpen = true;

            $result = bus_registration_edit_apply($pdo, $body, gmdate('Y-m-d H:i:s'));

            $pdo->commit();
            $transactionOpen = false;
            break;
        } catch (PDOException $e) {
            if ($attempt >= 2 || !bus_registration_edit_is_retryable($e)) {
                throw $e;
            }
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            $transactionOpen = false;
        }
    }
} catch (RegistrationEditConflict $e) {
    if ($transactionOpen && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    json_response(409, ['error' => $e->getMessage(), 'code' => $e->conflictCode]);
    exit;
} catch (ValidationError $e) {
    if ($transactionOpen && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    json_response(400, ['error' => $e->getMessage()]);
    exit;
} catch (Throwable $e) {
    if ($transactionOpen && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    log_failure('bus-registration-update', $e);
    json_response(500, ['error' => 'Não foi possível salvar a reserva.']);
    exit;
}

json_response(200, [
    'success' => true,
    'registration_id' => $registrationId,
    'updated_at' => $result['updated_at'],
]);

if ($result['plan']['notify']) {
    // Resposta já pronta: o painel não espera o SMTP (retry de até 6 s).
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    }
    try {
        $context = bus_registration_edit_email_context($result['registration'], $result['plan'], $result['waiting']);
        bus_enviar_com_retry(
            $config,
            BUS_EMAIL_ADMIN,
            'Administrativo Kriativos On Board',
            bus_registration_edit_email_subject($context['code']),
            bus_registration_edit_email_html($context),
            bus_registration_edit_email_text($context)
        );
    } catch (Throwable $e) {
        log_failure('registration-edit-email', $e);
    }
}
