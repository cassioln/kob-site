<?php

declare(strict_types=1);

/**
 * Reconciliação de reservas que ficaram pendentes após um webhook não chegar.
 *
 * A fonte de verdade continua sendo a Order do Mercado Pago. Esta rotina só
 * atualiza a reserva quando a consulta autenticada ao provedor informar uma
 * mudança de status.
 */

require_once __DIR__ . '/db.php';
require_once dirname(__DIR__, 2) . '/lib/mercadopago.php';
require_once __DIR__ . '/confirmation-mailer.php';
require_once __DIR__ . '/group-assign.php';
require_once dirname(__DIR__, 2) . '/lib/bus-fleet.php';

const BUS_RECONCILIATION_GRACE_SECONDS = 20;
const BUS_RECONCILIATION_INTERVAL_SECONDS = 25;
const BUS_RECONCILIATION_BATCH_SIZE = 10;

/**
 * Decide se uma pendência pode consultar o Mercado Pago sem desrespeitar a
 * carência inicial ou o intervalo mínimo entre reconciliações.
 */
function bus_reconciliation_is_due(array $registration): bool
{
    if (empty($registration['mercadopago_order_id'])) {
        return false;
    }

    if ((int) ($registration['idade_segundos'] ?? 0) < BUS_RECONCILIATION_GRACE_SECONDS) {
        return false;
    }

    $sinceLast = $registration['segundos_desde_reconciliacao'] ?? null;
    return $sinceLast === null || (int) $sinceLast >= BUS_RECONCILIATION_INTERVAL_SECONDS;
}

/**
 * Reconsulta uma reserva pendente e executa os efeitos já usados pelo webhook
 * quando o pagamento foi confirmado: nome do grupo, frota e e-mails.
 *
 * @return array{status: string, status_detail: ?string}|null
 */
function bus_reconcile_pending_registration(PDO $pdo, array $registration): ?array
{
    if (!bus_reconciliation_is_due($registration)) {
        return null;
    }

    $touch = $pdo->prepare('UPDATE bus_registrations SET reconciled_at = UTC_TIMESTAMP() WHERE id = :id');
    $touch->execute([':id' => $registration['id']]);

    $order = mp_get_order((string) $registration['mercadopago_order_id']);
    $status = map_provider_status($order);
    if ($status === $registration['status']) {
        return null;
    }

    $detail = $order['paymentStatusDetail'] ?? $order['orderStatusDetail'] ?? null;
    $paidAt = in_array($status, ['paid_awaiting_proof', 'confirmed'], true) ? gmdate('Y-m-d H:i:s') : null;

    $update = $pdo->prepare(
        'UPDATE bus_registrations
            SET status = :status,
                status_detail = :detail,
                mercadopago_payment_id = COALESCE(:payment, mercadopago_payment_id),
                paid_at = COALESCE(:paid, paid_at),
                updated_at = UTC_TIMESTAMP()
          WHERE id = :id'
    );
    $update->execute([
        ':status' => $status,
        ':detail' => $detail,
        ':payment' => $order['paymentId'] ?? null,
        ':paid' => $paidAt,
        ':id' => $registration['id'],
    ]);

    if ($status === 'confirmed') {
        try {
            bus_garantir_nome_grupo($pdo, (string) $registration['id']);
        } catch (Throwable $groupError) {
            log_failure('group-name', $groupError);
        }

        try {
            bus_assign_fleet($pdo, (string) $registration['id']);
        } catch (Throwable $fleetError) {
            log_failure('bus-fleet', $fleetError);
        }

        try {
            bus_send_confirmation_email($pdo, bus_config(), (string) $registration['id']);
        } catch (Throwable $mailError) {
            log_failure('confirmation-email', $mailError);
        }
    }

    return ['status' => $status, 'status_detail' => $detail];
}

/**
 * Processa um lote pequeno de pendências elegíveis para não atrasar o painel
 * nem criar um pico de consultas ao provedor.
 *
 * @return array{checked: int, updated: int}
 */
function bus_reconcile_pending_batch(PDO $pdo, int $limit = BUS_RECONCILIATION_BATCH_SIZE): array
{
    $limit = max(1, min(BUS_RECONCILIATION_BATCH_SIZE, $limit));
    $rows = $pdo->query(
        "SELECT id, status, mercadopago_order_id,
                TIMESTAMPDIFF(SECOND, created_at, UTC_TIMESTAMP()) AS idade_segundos,
                TIMESTAMPDIFF(SECOND, reconciled_at, UTC_TIMESTAMP()) AS segundos_desde_reconciliacao
           FROM bus_registrations
          WHERE status = 'payment_pending'
            AND mercadopago_order_id IS NOT NULL
            AND TIMESTAMPDIFF(SECOND, created_at, UTC_TIMESTAMP()) >= " . BUS_RECONCILIATION_GRACE_SECONDS . "
            AND (reconciled_at IS NULL OR TIMESTAMPDIFF(SECOND, reconciled_at, UTC_TIMESTAMP()) >= " . BUS_RECONCILIATION_INTERVAL_SECONDS . ")
          ORDER BY created_at ASC
          LIMIT " . $limit
    )->fetchAll(PDO::FETCH_ASSOC);

    $updated = 0;
    foreach ($rows as $registration) {
        try {
            if (bus_reconcile_pending_registration($pdo, $registration) !== null) {
                $updated++;
            }
        } catch (Throwable $error) {
            log_failure('bus-admin-reconcile', $error);
        }
    }

    return ['checked' => count($rows), 'updated' => $updated];
}
