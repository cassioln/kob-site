<?php

declare(strict_types=1);

/**
 * Cliente do Mercado Pago (Orders API, Pix).
 * O Access Token é privado e vive apenas no servidor.
 */

const MP_ORDERS_URL = 'https://api.mercadopago.com/v1/orders';

final class MercadoPagoError extends RuntimeException
{
    /**
     * Status HTTP que a nossa API deve devolver ao cliente.
     *
     * Declarado à moda antiga porque o host roda PHP 8.0.10, e
     * `public readonly` em parâmetro de construtor exige PHP 8.1+.
     */
    public int $httpStatus;

    public function __construct(string $message, int $httpStatus = 502)
    {
        parent::__construct($message);
        $this->httpStatus = $httpStatus;
    }
}

function mp_request(string $method, string $url, ?array $payload, array $extraHeaders = []): array
{
    $config = bus_config();
    $token = (string) $config['mp_access_token'];
    if ($token === '' || $token === 'APP_USR_REPLACE_ME') {
        throw new MercadoPagoError('MERCADOPAGO_ACCESS_TOKEN não configurado.', 503);
    }

    $headers = array_merge([
        'Accept: application/json',
        'Content-Type: application/json',
        'Authorization: Bearer ' . $token,
    ], $extraHeaders);

    $handle = curl_init($url);
    curl_setopt_array($handle, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 25,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);
    if ($payload !== null) {
        curl_setopt($handle, CURLOPT_POSTFIELDS, json_encode($payload, JSON_UNESCAPED_UNICODE));
    }

    $body = curl_exec($handle);
    $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    $curlError = curl_error($handle);

    if ($body === false) {
        throw new MercadoPagoError('Falha de rede ao falar com o Mercado Pago: ' . $curlError, 503);
    }

    $decoded = json_decode((string) $body, true);
    if (!is_array($decoded)) {
        $decoded = [];
    }

    if ($status >= 400) {
        // O motivo real vem no corpo (ex.: invalid_email_for_sandbox). Sem
        // registrá-lo, todo erro do provedor virava "recusou a operação" e a
        // depuração ficava cega. Vai para o log do servidor, nunca para o
        // cliente — a mensagem devolvida ao usuário segue genérica.
        $detalhe = '';
        if (isset($decoded['errors'][0]['code'])) {
            $detalhe = (string) $decoded['errors'][0]['code'];
        } elseif (isset($decoded['error'])) {
            $detalhe = (string) $decoded['error'];
        }
        error_log(sprintf(
            '[kob-bus][mercadopago] HTTP %d%s',
            $status,
            $detalhe !== '' ? ' code=' . $detalhe : ''
        ));

        if ($status === 429) {
            throw new MercadoPagoError('O Mercado Pago atingiu o limite temporário de requisições. Tente novamente em instantes.', 503);
        }
        throw new MercadoPagoError('O Mercado Pago recusou a criação do pagamento.', $status >= 500 ? 502 : 502);
    }

    return $decoded;
}

/**
 * Detecta se o token em uso é de TESTE.
 *
 * O prefixo não serve para isso: tanto o token de teste quanto o de produção
 * começam com `APP_USR`. Quem diz a verdade é a tag `test_user` em
 * GET /users/me. O resultado fica em cache no processo porque o webhook e a
 * criação de order rodam em requisições separadas e curtas.
 */
function mp_is_sandbox(): bool
{
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }

    try {
        $config = bus_config();
        $mode = strtolower((string) ($config['mp_mode'] ?? $config['mp_environment'] ?? ''));
        if ($mode === 'production' || $mode === 'prod') {
            $cached = false;
            return $cached;
        }
        if ($mode === 'test' || $mode === 'sandbox') {
            $cached = true;
            return $cached;
        }

        $me = mp_request('GET', 'https://api.mercadopago.com/users/me', null);
        $tags = $me['tags'] ?? [];
        $cached = is_array($tags) && in_array('test_user', $tags, true);
    } catch (Throwable $error) {
        // Falha na detecção nunca deve virar comportamento de teste em produção.
        $cached = false;
    }

    return $cached;
}

/**
 * Cria a order Pix e devolve os dados públicos do pagamento.
 *
 * @param list<array{full_name: string}> $passengers Para montar items[].
 */
function mp_create_pix_order(
    string $totalAmount,
    string $externalReference,
    string $payerEmail,
    string $idempotencyKey,
    array $payerData = [],
    int $passengerCount = 1
): array {
    $unitPrice = number_format((float) $totalAmount / max(1, $passengerCount), 2, '.', '');

    $payer = ['email' => $payerEmail];

    // Nome e sobrenome separados: o Mercado Pago usa isso na análise de risco.
    if (!empty($payerData['fullName'])) {
        $parts = preg_split('/\s+/', trim($payerData['fullName']), 2);
        $payer['first_name'] = $parts[0];
        if (!empty($parts[1])) {
            $payer['last_name'] = $parts[1];
        }
    }

    if (!empty($payerData['cpf'])) {
        $payer['identification'] = [
            'type' => 'CPF',
            'number' => $payerData['cpf'],
        ];
    }

    if (!empty($payerData['whatsapp'])) {
        // O Mercado Pago espera DDD e número separados.
        $digits = preg_replace('/\D+/', '', $payerData['whatsapp']);
        if (strlen($digits) >= 10) {
            $payer['phone'] = [
                'area_code' => substr($digits, 0, 2),
                'number' => substr($digits, 2),
            ];
        }
    }

    // Em ambiente de teste o Pix NÃO pode ser pago: não há como escanear o QR
    // com um app real. A documentação oficial resolve isso com um valor mágico
    // em payer.first_name — `APRO` faz a order nascer em action_required e o
    // pagamento virar aprovado sozinho, disparando o webhook de verdade.
    // Em produção o nome real do pagador é preservado.
    // https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/integration-test/pix
    if (mp_is_sandbox()) {
        $payer['first_name'] = 'APRO';
    }

    $order = mp_request('POST', MP_ORDERS_URL, [
        'type' => 'online',
        'total_amount' => $totalAmount,
        'external_reference' => $externalReference,
        'processing_mode' => 'automatic',
        'transactions' => [
            'payments' => [[
                'amount' => $totalAmount,
                'payment_method' => [
                    'id' => 'pix',
                    'type' => 'bank_transfer',
                    // Texto que identifica a compra no extrato do pagador.
                    // O lugar é AQUI, dentro de payment_method: na raiz da order
                    // e no nível do payment a API responde 400
                    // unsupported_properties (medido). A referência oficial
                    // documenta como transactions.payments.payment_method
                    // .statement_descriptor, até 50 caracteres.
                    'statement_descriptor' => 'KRIATIVOSONBOARD',
                ],
            ]],
        ],
        'payer' => $payer,
        // Identifica a compra na fatura e no app do Mercado Pago.
        'items' => [[
            'title' => 'Onibus fretado Kriativos On Board 2026',
            'unit_price' => $unitPrice,
            'quantity' => $passengerCount,
            'external_code' => 'kob-bus-2026',
            'category_id' => 'services',
        ]],
    ], ['X-Idempotency-Key: ' . $idempotencyKey]);

    $payment = $order['transactions']['payments'][0] ?? null;
    $method = $payment['payment_method'] ?? null;
    if (empty($order['id']) || empty($payment['id']) || empty($method['qr_code']) || empty($method['qr_code_base64'])) {
        throw new MercadoPagoError('O Mercado Pago não retornou os dados do Pix.');
    }

    return [
        'orderId' => (string) $order['id'],
        'paymentId' => (string) $payment['id'],
        'status' => (string) ($payment['status'] ?? $order['status'] ?? 'action_required'),
        'qrCode' => (string) $method['qr_code'],
        'qrCodeBase64' => (string) $method['qr_code_base64'],
        'ticketUrl' => isset($method['ticket_url']) ? (string) $method['ticket_url'] : null,
        // O Pix expira (medido: 24h após a criação). A validade vem no payment,
        // não na order nem no payment_method. Sem repassar isso, o usuário fica
        // olhando um QR morto sem saber.
        'expiresAt' => isset($payment['date_of_expiration']) ? (string) $payment['date_of_expiration'] : null,
    ];
}

/**
 * Consulta a order no Mercado Pago — fonte de verdade para o webhook.
 */
function mp_get_order(string $orderId): array
{
    $order = mp_request('GET', MP_ORDERS_URL . '/' . rawurlencode($orderId), null);
    $payment = $order['transactions']['payments'][0] ?? [];

    return [
        'orderId' => (string) ($order['id'] ?? $orderId),
        'externalReference' => isset($order['external_reference']) ? (string) $order['external_reference'] : null,
        'orderStatus' => isset($order['status']) ? (string) $order['status'] : null,
        'orderStatusDetail' => isset($order['status_detail']) ? (string) $order['status_detail'] : null,
        'paymentId' => isset($payment['id']) ? (string) $payment['id'] : null,
        'paymentStatus' => isset($payment['status']) ? (string) $payment['status'] : null,
        'paymentStatusDetail' => isset($payment['status_detail']) ? (string) $payment['status_detail'] : null,
    ];
}

/**
 * Traduz o estado do provedor para o estado interno da reserva.
 *
 * Antes o pagamento era declarado manualmente pelo usuário (Google Forms) e
 * um comprovante era a única evidência disponível, então "pago" não bastava
 * para confirmar vaga. Agora o webhook consulta a order diretamente na API
 * do Mercado Pago — fonte mais confiável que um arquivo enviado pelo
 * cliente — então o pagamento aprovado confirma a vaga sem exigir upload.
 */
function map_provider_status(array $order): string
{
    $payment = strtolower((string) ($order['paymentStatus'] ?? ''));
    $orderStatus = strtolower((string) ($order['orderStatus'] ?? ''));

    if (in_array($payment, ['approved', 'processed', 'paid'], true) || $orderStatus === 'processed') {
        return 'confirmed';
    }

    // Expirado entra como CANCELADO de propósito. Para a organização os dois
    // significam a mesma coisa na prática: a ordem encerrou sem pagamento e a
    // vaga não está reservada. Manter um status separado só para "expirou"
    // exigiria migrar o ENUM sem mudar nenhuma decisão operacional.
    $encerrados = ['cancelled', 'canceled', 'expired', 'refunded'];
    if (in_array($payment, $encerrados, true) || in_array($orderStatus, $encerrados, true)) {
        return ($payment === 'refunded' || $orderStatus === 'refunded') ? 'refunded' : 'cancelled';
    }

    // `rejected` caía em payment_pending, então um pagamento recusado ficava
    // "aguardando" para sempre no painel. Agora vira falha, que é o que é.
    if (in_array($payment, ['rejected', 'failed'], true) || $orderStatus === 'failed') {
        return 'payment_failed';
    }

    return 'payment_pending';
}
