<?php

declare(strict_types=1);

// Libs agnósticas de banco continuam vindo de php/lib/.
require dirname(__DIR__) . '/lib/validation.php';
require __DIR__ . '/lib/db.php';
require dirname(__DIR__) . '/lib/mercadopago.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    json_response(405, ['error' => 'Método não permitido.']);
    exit;
}

try {
    $payload = read_json_body();
    $orderId = $payload['data']['id'] ?? $payload['id'] ?? null;
    if (!is_string($orderId) && !is_int($orderId)) {
        // Probe de alcance do painel (POST sem corpo) não é erro do integrador:
        // responder 400 faz a URL parecer inválida na validação. Nada foi
        // alterado, então 200 é a resposta honesta.
        json_response(200, ['received' => true, 'ignored' => 'missing_order_id']);
        exit;
    }

    // A notificação é apenas um gatilho. A verdade vem da consulta autenticada,
    // então um webhook forjado não confirma vaga nenhuma.
    //
    // O painel do Mercado Pago valida a URL enviando uma notificação de teste
    // com um id que não existe. Se respondermos erro, ele recusa o cadastro do
    // webhook. Por isso a consulta falha em 200: nada foi alterado, e não há o
    // que reenviar quando a order simplesmente não existe.
    try {
        $order = mp_get_order((string) $orderId);
    } catch (Throwable $lookupError) {
        log_failure('mercadopago-webhook/lookup', $lookupError);
        json_response(200, ['received' => true, 'ignored' => 'order_not_found']);
        exit;
    }

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

    // MySQL não aceita ISO-8601 com offset em DATETIME: usamos 'Y-m-d H:i:s'.
    $paidAt = in_array($status, ['paid_awaiting_proof', 'confirmed'], true) ? gmdate('Y-m-d H:i:s') : null;
    $update = $pdo->prepare(
        'UPDATE bus_registrations
            SET status = :status,
                status_detail = :detail,
                mercadopago_order_id = COALESCE(:order, mercadopago_order_id),
                mercadopago_payment_id = COALESCE(:payment, mercadopago_payment_id),
                paid_at = COALESCE(:paid, paid_at),
                updated_at = UTC_TIMESTAMP()
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
