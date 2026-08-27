import { createHash, randomUUID } from 'node:crypto';
import {
  createMercadoPagoOrder,
  getMercadoPagoOrder,
  MercadoPagoError
} from './mercadopago.mjs';
import { createPixOrder, ValidationError } from './bus-payment.mjs';
import {
  buildCorsHeaders,
  buildPreflightResponse,
  isPreflight,
  withCorsHeaders
} from './cors.mjs';

export const MAX_PROOF_BYTES = 2 * 1024 * 1024;
const PROOF_TYPES = {
  'image/jpeg': { extension: 'jpg', signatures: [[0xff, 0xd8, 0xff]] },
  'image/png': { extension: 'png', signatures: [[0x89, 0x50, 0x4e, 0x47]] },
  'image/webp': { extension: 'webp', signatures: [[0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50]] },
  'application/pdf': { extension: 'pdf', signatures: [[0x25, 0x50, 0x44, 0x46]] }
};

export function parseJsonBody(body) {
  if (body && typeof body === 'object') return body;
  if (typeof body !== 'string' || !body.trim()) return {};
  try {
    return JSON.parse(body);
  } catch (_error) {
    throw new ValidationError('O corpo da requisição não é um JSON válido.');
  }
}

function isConfigurationError(error) {
  return error?.message === 'DATABASE_URL não configurado.'
    || error?.message === 'MERCADOPAGO_ACCESS_TOKEN não configurado.';
}

function getIdempotencyKey(headers = {}) {
  const key = headers['x-idempotency-key'] || headers['X-Idempotency-Key'];
  return typeof key === 'string' && key.length >= 8 && key.length <= 200 ? key : undefined;
}

/**
 * Métodos aceitos por cada endpoint de dados. Usado tanto no preflight quanto
 * no Access-Control-Allow-Methods das respostas reais.
 */
export const ENDPOINT_METHODS = Object.freeze({
  createPix: ['POST'],
  registrationStatus: ['GET'],
  paymentProof: ['POST']
});

export async function handleCreatePixRequest({
  method = 'POST',
  body,
  headers,
  env = process.env,
  dependencies = {}
}) {
  const cors = { headers, methods: ENDPOINT_METHODS.createPix, env };
  if (isPreflight(method)) return buildPreflightResponse(cors);
  const corsHeaders = buildCorsHeaders(cors);
  const respond = (result) => ({ ...result, headers: corsHeaders });

  if (method !== 'POST') {
    return respond({ statusCode: 405, body: { error: 'Método não permitido.' } });
  }

  let payload;
  try {
    payload = parseJsonBody(body);
  } catch (error) {
    return respond({ statusCode: 400, body: { error: error.message } });
  }

  try {
    const db = dependencies.db;
    if (!db) {
      return respond({ statusCode: 503, body: { error: 'O pagamento está temporariamente indisponível.' } });
    }
    const mercadoPago = dependencies.mercadoPago || {
      createOrder: (params) => createMercadoPagoOrder({
        ...params,
        accessToken: env.MERCADOPAGO_ACCESS_TOKEN
      })
    };
    const result = await createPixOrder({
      payload,
      db,
      mercadoPago,
      idempotencyKey: getIdempotencyKey(headers)
    });
    return respond({ statusCode: 201, body: result });
  } catch (error) {
    if (error instanceof ValidationError) {
      return respond({ statusCode: 400, body: { error: error.message } });
    }
    if (isConfigurationError(error)) {
      return respond({ statusCode: 503, body: { error: 'O pagamento está temporariamente indisponível.' } });
    }
    if (error instanceof MercadoPagoError) {
      return respond({
        statusCode: error.statusCode >= 500 ? error.statusCode : 502,
        body: { error: error.message }
      });
    }
    return respond({
      statusCode: 500,
      body: { error: 'Não foi possível iniciar o pagamento. Tente novamente.' }
    });
  }
}

// Antes o pagamento era declarado manualmente pelo usuário (Google Forms) e
// um comprovante era a única evidência disponível, então "pago" não bastava
// para confirmar vaga. Agora o webhook consulta a order diretamente na API
// do Mercado Pago — fonte mais confiável que um arquivo enviado pelo
// cliente — então o pagamento aprovado confirma a vaga sem exigir upload.
function mapProviderStatus(order) {
  const paymentStatus = String(order.paymentStatus || '').toLowerCase();
  const orderStatus = String(order.orderStatus || '').toLowerCase();
  if (['approved', 'processed', 'paid'].includes(paymentStatus) || orderStatus === 'processed') {
    return 'confirmed';
  }
  if (['cancelled', 'canceled', 'expired', 'refunded'].includes(paymentStatus)
      || ['cancelled', 'canceled', 'expired', 'refunded'].includes(orderStatus)) {
    return orderStatus === 'refunded' || paymentStatus === 'refunded' ? 'refunded' : 'cancelled';
  }
  return 'payment_pending';
}

export async function handleMercadoPagoWebhook({
  method = 'POST',
  body,
  env = process.env,
  dependencies = {}
}) {
  // Webhook é servidor-para-servidor (Mercado Pago -> API): nenhum header de
  // CORS é emitido aqui, nem para preflight. Navegador não deve poder chamar.
  if (method !== 'POST') return { statusCode: 405, body: { error: 'Método não permitido.' } };

  let payload;
  try {
    payload = parseJsonBody(body);
  } catch (error) {
    return { statusCode: 400, body: { error: error.message } };
  }

  const orderId = payload?.data?.id || payload?.id;
  if (!orderId) return { statusCode: 400, body: { error: 'Identificador da order ausente.' } };

  try {
    const db = dependencies.db;
    if (!db) return { statusCode: 503, body: { error: 'Não foi possível processar a notificação.' } };
    const mercadoPago = dependencies.mercadoPago || {
      getOrder: (id) => getMercadoPagoOrder({
        orderId: id,
        accessToken: env.MERCADOPAGO_ACCESS_TOKEN
      })
    };
    const order = await mercadoPago.getOrder(String(orderId));
    if (!order.externalReference) return { statusCode: 200, body: { received: true } };

    const registration = await db.findByExternalReference(order.externalReference);
    if (!registration) return { statusCode: 200, body: { received: true } };

    let status = mapProviderStatus(order);
    await db.updateRegistration(registration.id, {
      status,
      statusDetail: order.paymentStatusDetail || order.orderStatusDetail || null,
      mercadopagoOrderId: order.orderId,
      mercadopagoPaymentId: order.paymentId,
      paidAt: ['paid_awaiting_proof', 'confirmed'].includes(status) ? new Date().toISOString() : null
    });
    return { statusCode: 200, body: { received: true, status } };
  } catch (_error) {
    return { statusCode: 503, body: { error: 'Não foi possível processar a notificação.' } };
  }
}

export async function handleRegistrationStatusRequest({
  method = 'GET',
  registrationId,
  headers,
  env = process.env,
  dependencies = {}
}) {
  const cors = { headers, methods: ENDPOINT_METHODS.registrationStatus, env };
  if (isPreflight(method)) return buildPreflightResponse(cors);
  const respond = (result) => withCorsHeaders(result, cors);

  if (method !== 'GET') return respond({ statusCode: 405, body: { error: 'Método não permitido.' } });
  if (!/^[0-9a-f-]{36}$/i.test(String(registrationId || ''))) {
    return respond({ statusCode: 400, body: { error: 'Cadastro inválido.' } });
  }

  try {
    const db = dependencies.db;
    if (!db || typeof db.getRegistrationStatus !== 'function') {
      return respond({ statusCode: 503, body: { error: 'Consulta temporariamente indisponível.' } });
    }
    const registration = await db.getRegistrationStatus(registrationId);
    if (!registration) return respond({ statusCode: 404, body: { error: 'Cadastro não encontrado.' } });
    return respond({
      statusCode: 200,
      body: {
        status: registration.status,
        statusDetail: registration.status_detail || null
      }
    });
  } catch (_error) {
    return respond({ statusCode: 503, body: { error: 'Consulta temporariamente indisponível.' } });
  }
}

function decodeProof(content, mimeType) {
  if (typeof content !== 'string' || content.length < 8 || content.length > Math.ceil(MAX_PROOF_BYTES * 4 / 3) + 8) {
    throw new ValidationError('O comprovante precisa ter entre 1 byte e 2 MB.');
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(content)) {
    throw new ValidationError('O comprovante está em um formato inválido.');
  }
  const fileData = Buffer.from(content, 'base64');
  if (!fileData.length || fileData.length > MAX_PROOF_BYTES) {
    throw new ValidationError('O comprovante precisa ter no máximo 2 MB.');
  }
  const base64 = fileData.toString('base64').replace(/=+$/, '');
  if (base64 !== content.replace(/=+$/, '')) {
    throw new ValidationError('O comprovante está em um formato inválido.');
  }
  const type = PROOF_TYPES[mimeType];
  const matchesSignature = type?.signatures.some((signature) => signature.every((byte, index) => byte === null || fileData[index] === byte));
  if (!matchesSignature) throw new ValidationError('O conteúdo do comprovante não corresponde ao tipo informado.');
  return fileData;
}

function normalizeProofFileName(value, mimeType) {
  const extension = PROOF_TYPES[mimeType].extension;
  const fileName = typeof value === 'string' ? value.trim().split(/[\\/]/).pop() : '';
  const normalized = (fileName || `comprovante.${extension}`).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  return normalized.toLowerCase().endsWith(`.${extension}`) ? normalized : `comprovante.${extension}`;
}

export async function handlePaymentProofRequest({
  method = 'POST',
  body,
  headers,
  env = process.env,
  dependencies = {}
}) {
  const cors = { headers, methods: ENDPOINT_METHODS.paymentProof, env };
  if (isPreflight(method)) return buildPreflightResponse(cors);
  const respond = (result) => withCorsHeaders(result, cors);

  if (method !== 'POST') return respond({ statusCode: 405, body: { error: 'Método não permitido.' } });
  let payload;
  try {
    payload = parseJsonBody(body);
    const registrationId = String(payload.registration_id || '');
    if (!/^[0-9a-f-]{36}$/i.test(registrationId)) throw new ValidationError('Cadastro inválido.');
    const mimeType = String(payload.mime_type || '').toLowerCase();
    if (!PROOF_TYPES[mimeType]) throw new ValidationError('Envie um comprovante em JPG, PNG, WebP ou PDF.');
    const fileData = decodeProof(payload.content_base64, mimeType);
    const db = dependencies.db;
    if (!db || typeof db.getRegistrationStatus !== 'function' || typeof db.createPaymentProof !== 'function') {
      throw new Error('Repositório de comprovante não configurado.');
    }
    const registration = await db.getRegistrationStatus(registrationId);
    if (!registration) return respond({ statusCode: 404, body: { error: 'Cadastro não encontrado.' } });
    if (['cancelled', 'refunded'].includes(registration.status)) {
      return respond({ statusCode: 409, body: { error: 'Este cadastro não aceita mais comprovantes.' } });
    }
    const proof = await db.createPaymentProof({
      id: randomUUID(),
      registrationId,
      fileName: normalizeProofFileName(payload.file_name, mimeType),
      mimeType,
      fileSize: fileData.length,
      sha256: createHash('sha256').update(fileData).digest('hex'),
      fileData
    });
    return respond({ statusCode: 201, body: { status: proof.status } });
  } catch (error) {
    if (error instanceof ValidationError) return respond({ statusCode: 400, body: { error: error.message } });
    if (isConfigurationError(error)) return respond({ statusCode: 503, body: { error: 'O upload está temporariamente indisponível.' } });
    return respond({ statusCode: 500, body: { error: 'Não foi possível receber o comprovante.' } });
  }
}
