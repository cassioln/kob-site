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
    $data = validate_bus_payload($payload);

    $id = uuid_v4();
    $externalReference = 'kob_bus_2026_' . $id;
    // O valor cobrado é SEMPRE o calculado pelo servidor em validate_bus_payload():
    // (passenger_count - children_count) * BUS_PRICE_CENTS.
    $totalAmount = format_amount($data['amountCents']);

    $pdo = bus_pdo();

    // 1) Grava o cadastro ANTES de cobrar: se o Pix falhar, o cadastro existe
    //    e pode ser reconciliado; o inverso perderia os dados do grupo.
    $pdo->beginTransaction();
    $insert = $pdo->prepare(
        'INSERT INTO bus_registrations
            (id, external_reference, primary_name, primary_cpf, email, whatsapp,
             passenger_count, children_count, amount_cents, currency, status)
         VALUES (:id, :ref, :name, :cpf, :email, :whatsapp, :pax, :kids, :cents, \'BRL\', \'payment_pending\')'
    );
    $insert->execute([
        ':id' => $id,
        ':ref' => $externalReference,
        ':name' => $data['contact']['fullName'],
        ':cpf' => $data['contact']['cpf'],
        ':email' => $data['contact']['email'],
        ':whatsapp' => $data['contact']['whatsapp'],
        ':pax' => $data['passengerCount'],
        ':kids' => $data['childrenCount'],
        ':cents' => $data['amountCents'],
    ]);

    $insertPassenger = $pdo->prepare(
        'INSERT INTO bus_passengers (registration_id, position, full_name, cpf, is_primary)
         VALUES (:rid, :pos, :name, :cpf, :primary)'
    );
    foreach ($data['passengers'] as $passenger) {
        // MySQL: booleano é TINYINT(1) — 1/0 com PARAM_INT, e não 'true'/'false'.
        $insertPassenger->bindValue(':rid', $id);
        $insertPassenger->bindValue(':pos', $passenger['position'], PDO::PARAM_INT);
        $insertPassenger->bindValue(':name', $passenger['fullName']);
        $insertPassenger->bindValue(':cpf', $passenger['cpf']);
        $insertPassenger->bindValue(':primary', $passenger['position'] === 1 ? 1 : 0, PDO::PARAM_INT);
        $insertPassenger->execute();
    }
    $pdo->commit();

    // 2) Cria a cobrança Pix.
    $idempotencyKey = $_SERVER['HTTP_X_IDEMPOTENCY_KEY'] ?? '';
    if (!is_string($idempotencyKey) || strlen($idempotencyKey) < 8 || strlen($idempotencyKey) > 200) {
        $idempotencyKey = uuid_v4();
    }

    try {
        $payment = mp_create_pix_order(
            $totalAmount,
            $externalReference,
            $data['contact']['email'],
            $idempotencyKey
        );
    } catch (Throwable $error) {
        // Mercado Pago falhou => o cadastro fica marcado como payment_failed.
        $fail = $pdo->prepare('UPDATE bus_registrations SET status = \'payment_failed\', updated_at = NOW() WHERE id = :id');
        $fail->execute([':id' => $id]);
        throw $error;
    }

    $update = $pdo->prepare(
        'UPDATE bus_registrations
            SET mercadopago_order_id = :order, mercadopago_payment_id = :payment, updated_at = NOW()
          WHERE id = :id'
    );
    $update->execute([
        ':order' => $payment['orderId'],
        ':payment' => $payment['paymentId'],
        ':id' => $id,
    ]);

    // Só dados públicos. Nada de CPF, e-mail ou WhatsApp na resposta.
    json_response(201, [
        'registrationId' => $id,
        'orderId' => $payment['orderId'],
        'paymentId' => $payment['paymentId'],
        'status' => $payment['status'],
        'totalAmount' => $totalAmount,
        'qrCode' => $payment['qrCode'],
        'qrCodeBase64' => $payment['qrCodeBase64'],
        'ticketUrl' => $payment['ticketUrl'],
    ]);
} catch (ValidationError $error) {
    json_response(400, ['error' => $error->getMessage()]);
} catch (MercadoPagoError $error) {
    log_failure('create-pix-order/mp', $error);
    json_response($error->httpStatus >= 500 ? $error->httpStatus : 502, ['error' => $error->getMessage()]);
} catch (Throwable $error) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    log_failure('create-pix-order', $error);
    json_response(500, ['error' => 'Não foi possível iniciar o pagamento. Tente novamente.']);
}
