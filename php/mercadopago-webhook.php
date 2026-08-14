<?php

declare(strict_types=1);

require __DIR__ . '/lib/validation.php';
require __DIR__ . '/lib/db.php';
require __DIR__ . '/lib/mercadopago.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    json_response(405, ['error' => 'Método não permitido.']);
    exit;
}

try {
    $payload = read_json_body();
    $orderId = $payload['data']['id'] ?? $payload['id'] ?? null;
    if (!is_string($orderId) && !is_int($orderId)) {
        json_response(400, ['error' => 'Identificador da order ausente.']);
        exit;
    }

    // A notificação é apenas um gatilho. A verdade vem da consulta autenticada,
    // então um webhook forjado não confirma vaga nenhuma.
    $order = mp_get_order((string) $orderId);
    if (empty($order['externalReference'])) {
        json_response(200, ['received' => true]);
        exit;
    }

    $pdo = bus_pdo();
    $find = $pdo->prepare('SELECT id, status FROM bus_registrations WHERE external_reference = :ref LIMIT 1');
    $find->execute([':ref' => $order['externalReference']]);
    $registration = $find->fetch();
    if (!$registration) {
        json_response(200, ['received' => true]);
        exit;
    }

    $status = map_provider_status($order);

    $paidAt = in_array($status, ['paid_awaiting_proof', 'confirmed'], true) ? date('c') : null;
    $update = $pdo->prepare(
        'UPDATE bus_registrations
            SET status = :status,
                status_detail = :detail,
                mercadopago_order_id = COALESCE(:order, mercadopago_order_id),
                mercadopago_payment_id = COALESCE(:payment, mercadopago_payment_id),
                paid_at = COALESCE(:paid, paid_at),
                updated_at = now()
          WHERE id = :id'
    );
    $update->execute([
        ':status' => $status,
        ':detail' => $order['paymentStatusDetail'] ?? $order['orderStatusDetail'],
        ':order' => $order['orderId'],
        ':payment' => $order['paymentId'],
        ':paid' => $paidAt,
        ':id' => $registration['id'],
    ]);

    json_response(200, ['received' => true, 'status' => $status]);
} catch (ValidationError $error) {
    json_response(400, ['error' => $error->getMessage()]);
} catch (Throwable $error) {
    log_failure('mercadopago-webhook', $error);
    // 503 sinaliza ao Mercado Pago que vale reenviar a notificação.
    json_response(503, ['error' => 'Não foi possível processar a notificação.']);
}
