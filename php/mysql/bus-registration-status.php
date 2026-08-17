<?php

declare(strict_types=1);

// validation.php é agnóstica de banco: reaproveitamos a lib existente.
require_once dirname(__DIR__) . '/lib/validation.php';
require_once __DIR__ . '/lib/db.php';
require_once dirname(__DIR__) . '/lib/mercadopago.php';
require_once __DIR__ . '/lib/confirmation-mailer.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    json_response(405, ['error' => 'Método não permitido.']);
    exit;
}

/**
 * Reconciliação: pergunta ao Mercado Pago quando o webhook não chegou.
 *
 * O webhook é o caminho normal, mas não é garantido — em sandbox ele não chega,
 * e em produção pode falhar (a própria documentação do Mercado Pago recomenda
 * um fallback por consulta). Sem isto, um pagamento aprovado ficava preso em
 * `payment_pending` para sempre e a vaga nunca confirmava.
 *
 * Regras que protegem a API e o banco:
 * - só reconsulta reservas ainda pendentes que tenham order vinculada;
 * - respeita uma carência inicial: o webhook tem chance de chegar primeiro;
 * - respeita um intervalo mínimo entre consultas, senão o polling de 5s da
 *   página viraria uma consulta por segundo ao provedor;
 * - a decisão continua sendo do servidor do Mercado Pago. Aqui nada é assumido.
 *
 * As idades vêm calculadas pelo próprio MySQL, contra `UTC_TIMESTAMP()`.
 *
 * Dois relógios diferentes conviviam aqui: a sessão do banco roda em UTC-3
 * (`@@session.time_zone = SYSTEM`, offset medido: -10800s), enquanto o PHP
 * grava as datas em UTC. Comparar `created_at` com `NOW()` dava idade de -10698
 * segundos, então a carência nunca era satisfeita e a reconciliação nunca
 * rodava. Com `UTC_TIMESTAMP()` a mesma linha dava 102s, o valor real.
 *
 * Por isso, ao gravar, a coluna também recebe `UTC_TIMESTAMP()` e não `NOW()`.
 *
 * @return array{status: string, status_detail: ?string}|null Estado novo, ou null.
 */
function reconcile_pending_registration(PDO $pdo, array $registration): ?array
{
    // Sem order no provedor não há o que reconsultar (ex.: falha na criação).
    if (empty($registration['mercadopago_order_id'])) {
        return null;
    }

    $CARENCIA_SEGUNDOS = 20;   // tempo para o webhook chegar primeiro
    $INTERVALO_SEGUNDOS = 25;  // mínimo entre duas consultas ao provedor

    $idade = (int) ($registration['idade_segundos'] ?? 0);
    if ($idade < $CARENCIA_SEGUNDOS) {
        return null;
    }

    $desdeUltima = $registration['segundos_desde_reconciliacao'];
    if ($desdeUltima !== null && (int) $desdeUltima < $INTERVALO_SEGUNDOS) {
        return null;
    }

    // Marca a tentativa ANTES de consultar: se a chamada travar ou falhar, o
    // intervalo mínimo continua valendo e o provedor não é martelado.
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

    // E-mail de confirmação. Este é o caminho que de fato dispara em ambiente de
    // teste, já que o Mercado Pago não entrega webhook automático em sandbox.
    // Falha de e-mail não pode derrubar a consulta de status: a pessoa está com a
    // página aberta esperando ver a vaga confirmada.
    if ($status === 'confirmed') {
        try {
            bus_send_confirmation_email($pdo, bus_config(), (string) $registration['id']);
        } catch (Throwable $mailError) {
            log_failure('confirmation-email', $mailError);
        }
    }

    return ['status' => $status, 'status_detail' => $detail];
}

try {
    $id = $_GET['id'] ?? null;
    if (!is_uuid($id)) {
        json_response(400, ['error' => 'Cadastro inválido.']);
        exit;
    }

    $pdo = bus_pdo();
    // As idades são calculadas pelo banco em UTC — o mesmo relógio que o PHP
    // usa para gravar as datas. Ver o comentário de reconcile_pending_registration().
    $query = $pdo->prepare(
        'SELECT id, status, status_detail, mercadopago_order_id,
                TIMESTAMPDIFF(SECOND, created_at, UTC_TIMESTAMP()) AS idade_segundos,
                TIMESTAMPDIFF(SECOND, reconciled_at, UTC_TIMESTAMP()) AS segundos_desde_reconciliacao
           FROM bus_registrations
          WHERE id = :id
          LIMIT 1'
    );
    $query->execute([':id' => $id]);
    $registration = $query->fetch();

    if (!$registration) {
        json_response(404, ['error' => 'Cadastro não encontrado.']);
        exit;
    }

    $status = (string) $registration['status'];
    $detail = $registration['status_detail'] ?: null;

    if ($status === 'payment_pending') {
        try {
            $novo = reconcile_pending_registration($pdo, $registration);
            if ($novo !== null) {
                $status = $novo['status'];
                $detail = $novo['status_detail'];
            }
        } catch (Throwable $reconcileError) {
            // Falha na reconciliação não pode derrubar a consulta de status: a
            // página continua exibindo o estado conhecido e tenta de novo.
            log_failure('bus-registration-status/reconcile', $reconcileError);
        }
    }

    // Só o estado operacional. Nunca CPF, nome, e-mail ou WhatsApp.
    json_response(200, [
        'status' => $status,
        'statusDetail' => $detail ?: null,
    ]);
} catch (Throwable $error) {
    log_failure('bus-registration-status', $error);
    json_response(503, ['error' => 'Consulta temporariamente indisponível.']);
}
