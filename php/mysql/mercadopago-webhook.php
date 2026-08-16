<?php

declare(strict_types=1);

// Libs agnósticas de banco continuam vindo de php/lib/.
require dirname(__DIR__) . '/lib/validation.php';
require __DIR__ . '/lib/db.php';
require dirname(__DIR__) . '/lib/mercadopago.php';
require dirname(__DIR__) . '/lib/mp-signature.php';

/**
 * TEMPORÁRIO — registra o resultado de cada notificação recebida.
 *
 * Existe para diagnosticar a validação do painel do Mercado Pago sem adivinhar:
 * se o simulador não enviar `x-signature`, o webhook responde 401 (fail-closed)
 * e o requisito não pontua. Este log diz qual dos dois aconteceu.
 *
 * Grava fora do document root, nunca registra a chave secreta nem o corpo
 * completo, e qualquer falha de escrita é ignorada para não afetar a resposta.
 */
function wh_log(string $evento, array $extra = []): void
{
    $linha = array_merge([
        'quando' => gmdate('c'),
        'evento' => $evento,
        'ip' => $_SERVER['REMOTE_ADDR'] ?? null,
        'ua' => substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 80),
        'tem_x_signature' => isset($_SERVER['HTTP_X_SIGNATURE']),
        'tem_x_request_id' => isset($_SERVER['HTTP_X_REQUEST_ID']),
        'query_data_id' => $_GET['data.id'] ?? null,
    ], $extra);

    @file_put_contents(
        sys_get_temp_dir() . '/kob-webhook.log',
        json_encode($linha) . "\n",
        FILE_APPEND
    );
}

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
        wh_log('sem_order_id');
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


    // TEMPORÁRIO — descobre qual variante do manifesto o Mercado Pago assina.
    // A doc manda usar `data.id` da query string, mas as notificações reais não
    // trazem query param nenhum. Em vez de adivinhar, testamos as variantes
    // plausíveis contra o v1 recebido e registramos a que casa.
    if (is_string($secret) && $secret !== '' && isset($_SERVER['HTTP_X_SIGNATURE'])) {
        $sig = mp_parse_signature_header((string) $_SERVER['HTTP_X_SIGNATURE']);
        $rid = (string) ($_SERVER['HTTP_X_REQUEST_ID'] ?? '');
        $ts = (string) $sig['ts'];
        $oid = (string) $orderId;

        $variantes = [
            // Separador correto (implode + ';' final), conforme exemplo oficial.
            'id_body_rid' => implode(';', ['id:' . strtolower($oid), 'request-id:' . $rid, 'ts:' . $ts]) . ';',
            'id_body_sem_rid' => implode(';', ['id:' . strtolower($oid), 'ts:' . $ts]) . ';',
            'sem_id_com_rid' => implode(';', ['request-id:' . $rid, 'ts:' . $ts]) . ';',
            'so_ts' => 'ts:' . $ts . ';',
            'id_maiusculo_rid' => implode(';', ['id:' . $oid, 'request-id:' . $rid, 'ts:' . $ts]) . ';',
            // Forma antiga (';' por campo) — para confirmar que era o bug.
            'antiga_ponto_virgula_por_campo' => 'id:' . strtolower($oid) . ';request-id:' . $rid . ';ts:' . $ts . ';',
        ];

        $casou = null;
        foreach ($variantes as $nome => $manifesto) {
            if (hash_equals(hash_hmac('sha256', $manifesto, $secret), strtolower((string) $sig['v1']))) {
                $casou = $nome;
                break;
            }
        }
        // Idade do ts: se o HMAC casa mas a validação reprova, a suspeita é a
        // janela de replay — o simulador pode enviar um ts fora dela.
        $idadeSeg = $ts !== '' ? abs(time() - (int) ((int) $ts / 1000)) : null;
        wh_log('diagnostico_manifesto', [
            'variante_que_casou' => $casou ?? 'NENHUMA',
            'order' => $oid,
            'rid_presente' => $rid !== '',
            'ts_recebido' => $ts,
            'idade_ts_segundos' => $idadeSeg,
            'dentro_da_janela_900s' => $idadeSeg !== null ? ($idadeSeg <= 900) : null,
        ]);
    }

    $origem = mp_webhook_origin_check($_SERVER, $_GET, is_string($secret) ? $secret : null, (string) $orderId);
    if (!$origem['ok']) {
        // 401 sem detalhe: não confirma ao remetente o que faltou.
        wh_log('rejeitado', ['motivo' => $origem['motivo'], 'order' => (string) $orderId]);
        log_failure('mercadopago-webhook/origem', new RuntimeException('rejeitado: ' . $origem['motivo']));
        json_response(401, ['error' => 'Notificação não autenticada.']);
        exit;
    }

    wh_log('aceito', ['motivo' => $origem['motivo'], 'order' => (string) $orderId]);

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
