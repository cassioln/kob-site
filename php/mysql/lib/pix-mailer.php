<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/lib/validation.php';
require_once __DIR__ . '/db.php';
require_once dirname(__DIR__, 2) . '/lib/smtp.php';
require_once dirname(__DIR__, 2) . '/lib/pix-email.php';
require_once __DIR__ . '/confirmation-mailer.php';

function bus_send_pix_email(PDO $pdo, array $config, string $registrationId, array $payment): array
{
    // Carrega dados da reserva
    $q = $pdo->prepare(
        'SELECT id, email, primary_name, passenger_count, children_count, group_name, amount_cents
           FROM bus_registrations
          WHERE id = :id
          LIMIT 1'
    );
    $q->execute([':id' => $registrationId]);
    $reg = $q->fetch(PDO::FETCH_ASSOC);

    if (!$reg) {
        return ['ok' => false, 'motivo' => 'nao_encontrado'];
    }

    $amount = number_format($reg['amount_cents'] / 100, 2, '.', '');

    $qp = $pdo->prepare(
        'SELECT full_name as name, cpf, whatsapp, is_child_lap
           FROM bus_passengers
          WHERE registration_id = :id ORDER BY `position`'
    );
    $qp->execute([':id' => $registrationId]);
    $passengers = $qp->fetchAll(PDO::FETCH_ASSOC);

    $dados = [
        'contactName' => $reg['primary_name'],
        'amount' => $amount,
        'passengerCount' => (int) $reg['passenger_count'],
        'childrenCount' => (int) $reg['children_count'],
        'groupName' => $reg['group_name'] ?: null,
        'passengers' => $passengers,
        'qrCode' => $payment['qrCode'],
        'qrCodeBase64' => $payment['qrCodeBase64'] ?? '',
    ];

    try {
        bus_enviar_com_retry(
            $config,
            $reg['email'],
            $reg['primary_name'],
            'Finalize sua reserva · Ônibus Kriativos On Board 2026',
            bus_pix_email_html($dados),
            bus_pix_email_text($dados)
        );
        return ['ok' => true];
    } catch (Throwable $e) {
        return ['ok' => false, 'erro' => $e->getMessage()];
    }
}
