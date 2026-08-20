<?php

declare(strict_types=1);

// Libs agnósticas de banco continuam vindo de php/lib/.
require_once dirname(__DIR__) . '/lib/validation.php';
require_once __DIR__ . '/lib/db.php';
require_once dirname(__DIR__) . '/lib/mercadopago.php';
require_once dirname(__DIR__) . '/lib/mp-signature.php';
require_once __DIR__ . '/lib/confirmation-mailer.php';
require_once __DIR__ . '/lib/group-assign.php';
require_once dirname(__DIR__) . '/lib/bus-fleet.php';

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

    // Origem da notificação. Descarta antes de gastar chamada ao provedor.
    // A chave é POR AMBIENTE: o painel gera uma para teste e outra para
    // produção. `mp_is_sandbox()` decide qual usar pela tag test_user da conta.
    $config = bus_config();
    $secret = mp_is_sandbox()
        ? ($config['mp_webhook_secret_test'] ?? null)
        : ($config['mp_webhook_secret'] ?? null);

    $origem = mp_webhook_origin_check($_SERVER, $_GET, is_string($secret) ? $secret : null, (string) $orderId);
    if (!$origem['ok']) {
        // 401 sem detalhe: não confirma ao remetente o que faltou.
        log_failure('mercadopago-webhook/origem', new RuntimeException('rejeitado: ' . $origem['motivo']));
        json_response(401, ['error' => 'Notificação não autenticada.']);
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

    // E-mail de confirmação: disparado só quando a vaga foi efetivamente
    // confirmada, e uma única vez por reserva (a marca fica em
    // confirmation_email_sent_at). A falha no envio NÃO derruba o webhook:
    // devolver 503 aqui faria o Mercado Pago reenviar a notificação por um
    // problema de e-mail, quando o pagamento já está gravado corretamente.
    $emailEnviado = null;
    if ($status === 'confirmed') {
        // Nome do grupo ANTES do e-mail: a mensagem cita o nome, e atribuir
        // depois faria o primeiro e-mail sair sem ele.
        try {
            bus_garantir_nome_grupo($pdo, (string) $registration['id']);
        } catch (Throwable $grupoError) {
            // Apelido do grupo não é requisito de embarque: se falhar, a reserva
            // segue confirmada e o e-mail sai sem o nome.
            log_failure('group-name', $grupoError);
        }

        try {
            bus_assign_fleet($pdo, (string) $registration['id']);
        } catch (Throwable $fleetError) {
            log_failure('bus-fleet', $fleetError);
        }

        try {
            $envio = bus_send_confirmation_email($pdo, $config, (string) $registration['id']);

            // O mailer devolve o resultado POR destinatário, porque cada um tem
            // sua própria marca de envio. Resumir tudo em "enviado" escondia o
            // caso mais comum em produção: reenvio de notificação, em que nada
            // foi enviado de novo. Um log que mente sobre isso faz perder tempo
            // procurando e-mail que nunca saiu (ou culpar o sistema por e-mail
            // duplicado que ele não mandou).
            if (!($envio['ok'] ?? false)) {
                $emailEnviado = $envio['motivo'] ?? 'nao_enviado';
            } else {
                $enviados = [];
                if (($envio['contato'] ?? '') === 'enviado') {
                    $enviados[] = 'contato';
                }
                foreach (($envio['passageiros'] ?? []) as $p) {
                    if (($p['status'] ?? '') === 'enviado') {
                        $enviados[] = 'passageiro' . $p['pos'];
                    }
                }
                if (($envio['admin'] ?? '') === 'enviado') {
                    $enviados[] = 'admin';
                }

                $emailEnviado = $enviados
                    ? implode('+', $enviados)
                    : 'nada_novo';   // reenvio: tudo já havia sido entregue

                if (!empty($envio['erros'])) {
                    $emailEnviado .= ' (com falha: ' . count($envio['erros']) . ')';
                }
            }
        } catch (Throwable $mailError) {
            log_failure('confirmation-email', $mailError);
            $emailEnviado = 'falhou';
        }
    }

    json_response(200, ['received' => true, 'status' => $status, 'email' => $emailEnviado]);
} catch (ValidationError $error) {
    json_response(400, ['error' => $error->getMessage()]);
} catch (Throwable $error) {
    log_failure('mercadopago-webhook', $error);
    // 503 sinaliza ao Mercado Pago que vale reenviar a notificação.
    json_response(503, ['error' => 'Não foi possível processar a notificação.']);
}
