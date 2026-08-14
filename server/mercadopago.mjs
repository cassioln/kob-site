const MERCADO_PAGO_ORDERS_URL = 'https://api.mercadopago.com/v1/orders';

export class MercadoPagoError extends Error {
  constructor(message, statusCode = 502) {
    super(message);
    this.name = 'MercadoPagoError';
    this.statusCode = statusCode;
  }
}

async function readJson(response) {
  try {
    return await response.json();
  } catch (_error) {
    return null;
  }
}

function extractPixPayment(order) {
  const payment = order?.transactions?.payments?.[0];
  const paymentMethod = payment?.payment_method;
  if (!order?.id || !payment?.id || !paymentMethod?.qr_code || !paymentMethod?.qr_code_base64) {
    throw new MercadoPagoError('O Mercado Pago não retornou os dados do Pix.');
  }

  return {
    orderId: String(order.id),
    paymentId: String(payment.id),
    status: String(payment.status || order.status || 'action_required'),
    statusDetail: payment.status_detail || order.status_detail || null,
    qrCode: String(paymentMethod.qr_code),
    qrCodeBase64: String(paymentMethod.qr_code_base64),
    ticketUrl: paymentMethod.ticket_url ? String(paymentMethod.ticket_url) : null,
    // O Pix expira (medido: 24h após a criação). A validade vem no payment,
    // não na order nem no payment_method.
    expiresAt: payment.date_of_expiration ? String(payment.date_of_expiration) : null
  };
}

export async function createMercadoPagoOrder({
  accessToken,
  totalAmount,
  externalReference,
  payerEmail,
  idempotencyKey,
  fetchImpl = globalThis.fetch,
  apiUrl = MERCADO_PAGO_ORDERS_URL
}) {
  if (!accessToken) throw new MercadoPagoError('MERCADOPAGO_ACCESS_TOKEN não configurado.', 503);
  if (typeof fetchImpl !== 'function') throw new MercadoPagoError('Fetch não está disponível no servidor.', 503);

  const response = await fetchImpl(apiUrl, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'X-Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify({
      type: 'online',
      total_amount: totalAmount,
      external_reference: externalReference,
      processing_mode: 'automatic',
      transactions: {
        payments: [{
          amount: totalAmount,
          payment_method: {
            id: 'pix',
            type: 'bank_transfer'
          }
        }]
      },
      payer: { email: payerEmail }
    })
  });

  const body = await readJson(response);
  if (!response.ok) {
    const providerStatus = response.status >= 400 && response.status < 600 ? response.status : 502;
    // O motivo real vem no corpo (ex.: invalid_email_for_sandbox, que só aceita
    // e-mails @testuser.com). Sem logar isso, todo erro do provedor virava a
    // mesma frase genérica e a depuração ficava cega. O log é do servidor; a
    // mensagem devolvida ao cliente continua sem detalhe interno.
    const providerCode = body?.errors?.[0]?.code || body?.error || null;
    console.error(`[kob-bus][mercadopago] HTTP ${providerStatus}${providerCode ? ` code=${providerCode}` : ''}`);
    throw new MercadoPagoError(
      providerStatus === 429
        ? 'O Mercado Pago atingiu o limite temporário de requisições. Tente novamente em instantes.'
        : 'O Mercado Pago recusou a criação do pagamento.',
      providerStatus === 429 ? 503 : 502
    );
  }

  return extractPixPayment(body);
}

export async function getMercadoPagoOrder({
  accessToken,
  orderId,
  fetchImpl = globalThis.fetch,
  apiUrl = MERCADO_PAGO_ORDERS_URL
}) {
  if (!accessToken) throw new MercadoPagoError('MERCADOPAGO_ACCESS_TOKEN não configurado.', 503);
  const response = await fetchImpl(`${apiUrl}/${encodeURIComponent(orderId)}`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${accessToken}`
    }
  });
  const body = await readJson(response);
  if (!response.ok) throw new MercadoPagoError('Não foi possível consultar a order no Mercado Pago.', 502);

  const payment = body?.transactions?.payments?.[0] || {};
  return {
    orderId: String(body.id || orderId),
    externalReference: body.external_reference ? String(body.external_reference) : null,
    orderStatus: body.status ? String(body.status) : null,
    orderStatusDetail: body.status_detail ? String(body.status_detail) : null,
    paymentId: payment.id ? String(payment.id) : null,
    paymentStatus: payment.status ? String(payment.status) : null,
    paymentStatusDetail: payment.status_detail ? String(payment.status_detail) : null
  };
}
