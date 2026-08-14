import assert from 'node:assert/strict';
import test from 'node:test';

import { createPixOrder } from '../bus-payment.mjs';
import { createMercadoPagoOrder } from '../mercadopago.mjs';
import { handleCreatePixRequest, handleMercadoPagoWebhook, handlePaymentProofRequest, handleRegistrationStatusRequest } from '../http.mjs';

const basePayload = {
  contact: {
    full_name: 'Maria de Souza',
    cpf: '52998224725',
    email: 'maria@example.com',
    whatsapp: '11942554141'
  },
  passenger_count: 3,
  children_count: 1,
  passengers: [
    { full_name: 'Maria de Souza', cpf: '52998224725' },
    { full_name: 'João de Souza', cpf: '11144477735' },
    { full_name: 'Ana de Souza', cpf: '15350946056' }
  ],
  total_amount: '0.01'
};

function fakeDependencies() {
  const calls = { registration: null, payment: null, updates: [] };
  return {
    calls,
    db: {
      async createRegistration(record) {
        calls.registration = record;
        return {
          id: record.id,
          externalReference: record.externalReference
        };
      },
      async updateRegistration(id, update) {
        calls.updates.push({ id, update });
      }
    },
    mercadoPago: {
      async createOrder(params) {
        calls.payment = params;
        return {
          orderId: 'ORD01TESTBUS2026',
          paymentId: 'PAY01TESTBUS2026',
          status: 'action_required',
          qrCode: '00020126580014br.gov.bcb.pix0136test-code',
          qrCodeBase64: 'aGVsbG8=',
          ticketUrl: 'https://www.mercadopago.com.br/test-ticket'
        };
      }
    }
  };
}

test('calcula o total no servidor e salva o cadastro antes de criar o Pix', async () => {
  const dependencies = fakeDependencies();
  const result = await createPixOrder({
    payload: basePayload,
    idempotencyKey: '00000000-0000-4000-8000-000000000002',
    ...dependencies
  });

  assert.equal(dependencies.calls.registration.amountCents, 24000);
  assert.equal(dependencies.calls.registration.passengers.length, 3);
  assert.equal(dependencies.calls.payment.totalAmount, '240.00');
  assert.equal(dependencies.calls.payment.payerEmail, 'maria@example.com');
  assert.equal(dependencies.calls.payment.externalReference, dependencies.calls.registration.externalReference);
  assert.equal(result.totalAmount, '240.00');
  assert.equal(result.orderId, 'ORD01TESTBUS2026');
  assert.equal(result.registrationId, dependencies.calls.registration.id);
  assert.ok(!Object.hasOwn(result, 'cpf'));
  assert.deepEqual(dependencies.calls.updates[0].update, {
    status: 'payment_pending',
    mercadopagoOrderId: 'ORD01TESTBUS2026',
    mercadopagoPaymentId: 'PAY01TESTBUS2026'
  });
});

test('rejeita CPF inválido antes de gravar ou cobrar', async () => {
  const dependencies = fakeDependencies();
  const payload = structuredClone(basePayload);
  payload.contact.cpf = '11111111111';
  payload.passengers[0].cpf = '11111111111';

  await assert.rejects(
    () => createPixOrder({ payload, ...dependencies }),
    /CPF inválido/i
  );
  assert.equal(dependencies.calls.registration, null);
  assert.equal(dependencies.calls.payment, null);
});

test('marca o cadastro como erro se o Mercado Pago falhar', async () => {
  const dependencies = fakeDependencies();
  dependencies.mercadoPago.createOrder = async () => {
    throw new Error('Mercado Pago indisponível');
  };

  await assert.rejects(
    () => createPixOrder({ payload: basePayload, ...dependencies }),
    /Mercado Pago indisponível/i
  );
  assert.equal(dependencies.calls.updates.at(-1).update.status, 'payment_failed');
});

test('não cria cobrança para um grupo formado apenas por crianças', async () => {
  const dependencies = fakeDependencies();
  const payload = structuredClone(basePayload);
  payload.passenger_count = 1;
  payload.children_count = 1;
  payload.passengers = [payload.passengers[0]];

  await assert.rejects(
    () => createPixOrder({ payload, ...dependencies }),
    /precisa de um passageiro pagante/i
  );
  assert.equal(dependencies.calls.registration, null);
  assert.equal(dependencies.calls.payment, null);
});

test('recusa mais crianças que pagantes: cada colo precisa de um responsável', async () => {
  // 3 pessoas com 2 crianças deixaria 1 adulto com 2 colos. Limite = floor(n/2).
  const dependencies = fakeDependencies();
  const payload = structuredClone(basePayload);
  payload.passenger_count = 3;
  payload.children_count = 2;
  payload.passengers = [
    { full_name: 'Maria de Souza', cpf: '52998224725' },
    { full_name: 'Joao Souza', cpf: '11144477735' },
    { full_name: 'Ana Souza', cpf: '15350946056' }
  ];

  await assert.rejects(
    () => createPixOrder({ payload, ...dependencies }),
    /precisa de um passageiro pagante/i
  );
  assert.equal(dependencies.calls.registration, null);
});

test('aceita crianças iguais aos pagantes: 4 pessoas com 2 crianças', async () => {
  // Fronteira válida da regra: 2 crianças e 2 pagantes, um colo por adulto.
  const dependencies = fakeDependencies();
  const payload = structuredClone(basePayload);
  payload.passenger_count = 4;
  payload.children_count = 2;
  payload.passengers = [
    { full_name: 'Maria de Souza', cpf: '52998224725' },
    { full_name: 'Joao Souza', cpf: '11144477735' },
    { full_name: 'Ana Souza', cpf: '15350946056' },
    { full_name: 'Lucas Souza', cpf: '01234567890' }
  ];

  const result = await createPixOrder({ payload, ...dependencies });
  // Só os 2 pagantes entram no valor.
  assert.equal(result.totalAmount, '240.00');
  assert.notEqual(dependencies.calls.registration, null);
});

test('monta a order Pix com token, idempotência e valor server-side', async () => {
  let request = null;
  const response = await createMercadoPagoOrder({
    accessToken: 'APP_USR_TEST_ONLY',
    totalAmount: '240.00',
    externalReference: 'kob_bus_2026_registration',
    payerEmail: 'maria@example.com',
    idempotencyKey: '00000000-0000-4000-8000-000000000003',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        status: 201,
        async json() {
          return {
            id: 'ORD01TESTBUS2026',
            status: 'action_required',
            transactions: {
              payments: [{
                id: 'PAY01TESTBUS2026',
                status: 'action_required',
                payment_method: {
                  qr_code: '000201TEST',
                  qr_code_base64: 'aGVsbG8=',
                  ticket_url: 'https://mercadopago.com.br/test-ticket'
                }
              }]
            }
          };
        }
      };
    }
  });

  assert.equal(request.url, 'https://api.mercadopago.com/v1/orders');
  assert.equal(request.options.headers.Authorization, 'Bearer APP_USR_TEST_ONLY');
  assert.equal(request.options.headers['X-Idempotency-Key'], '00000000-0000-4000-8000-000000000003');
  const body = JSON.parse(request.options.body);
  assert.equal(body.total_amount, '240.00');
  assert.equal(body.external_reference, 'kob_bus_2026_registration');
  assert.equal(body.payer.email, 'maria@example.com');
  assert.equal(body.transactions.payments[0].payment_method.id, 'pix');
  assert.equal(response.qrCode, '000201TEST');
  assert.equal(response.qrCodeBase64, 'aGVsbG8=');
});

test('adaptador HTTP retorna apenas o contrato público do Pix', async () => {
  const dependencies = fakeDependencies();
  const result = await handleCreatePixRequest({
    method: 'POST',
    body: JSON.stringify(basePayload),
    headers: { 'x-idempotency-key': '00000000-0000-4000-8000-000000000004' },
    dependencies
  });

  assert.equal(result.statusCode, 201);
  assert.equal(result.body.totalAmount, '240.00');
  assert.equal(result.body.qrCode, '00020126580014br.gov.bcb.pix0136test-code');
  assert.equal(Object.hasOwn(result.body, 'cpf'), false);
  assert.equal(Object.hasOwn(result.body, 'email'), false);
});

test('webhook consulta a order e confirma a vaga direto no pagamento aprovado', async () => {
  const updates = [];
  const result = await handleMercadoPagoWebhook({
    method: 'POST',
    body: { data: { id: 'ORD01TESTBUS2026' } },
    dependencies: {
      db: {
        async findByExternalReference(reference) {
          assert.equal(reference, 'kob_bus_2026_registration');
          return { id: 'registration-1' };
        },
        async updateRegistration(id, update) {
          updates.push({ id, update });
        }
      },
      mercadoPago: {
        async getOrder(orderId) {
          assert.equal(orderId, 'ORD01TESTBUS2026');
          return {
            orderId,
            externalReference: 'kob_bus_2026_registration',
            orderStatus: 'processed',
            orderStatusDetail: null,
            paymentId: 'PAY01TESTBUS2026',
            paymentStatus: 'processed',
            paymentStatusDetail: 'accredited'
          };
        }
      }
    }
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.status, 'confirmed');
  assert.equal(updates[0].id, 'registration-1');
  assert.equal(updates[0].update.status, 'confirmed');
  assert.equal(updates[0].update.mercadopagoPaymentId, 'PAY01TESTBUS2026');
});

test('consulta de status expõe somente o estado operacional do cadastro', async () => {
  const result = await handleRegistrationStatusRequest({
    registrationId: '11111111-1111-4111-8111-111111111111',
    dependencies: {
      db: {
        async getRegistrationStatus(id) {
          assert.equal(id, '11111111-1111-4111-8111-111111111111');
          return { status: 'confirmed', status_detail: 'accredited' };
        }
      }
    }
  });

  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body, { status: 'confirmed', statusDetail: 'accredited' });
  assert.equal(Object.hasOwn(result.body, 'cpf'), false);
});

test('recebe comprovante válido e confirma a vaga após pagamento identificado', async () => {
  const captured = [];
  const result = await handlePaymentProofRequest({
    method: 'POST',
    body: {
      registration_id: '11111111-1111-4111-8111-111111111111',
      file_name: '../../comprovante.png',
      mime_type: 'image/png',
      content_base64: 'iVBORw0KGgo='
    },
    dependencies: {
      db: {
        async getRegistrationStatus() {
          return { status: 'paid_awaiting_proof' };
        },
        async createPaymentProof(proof) {
          captured.push(proof);
          return { status: 'confirmed' };
        }
      }
    }
  });

  assert.equal(result.statusCode, 201);
  assert.deepEqual(result.body, { status: 'confirmed' });
  assert.equal(captured[0].fileName, 'comprovante.png');
  assert.equal(captured[0].fileSize, 8);
  assert.equal(captured[0].fileData.toString('hex'), '89504e470d0a1a0a');
  assert.equal(captured[0].sha256.length, 64);
});

test('não aceita arquivo que declara PNG mas não tem assinatura PNG', async () => {
  const result = await handlePaymentProofRequest({
    body: {
      registration_id: '11111111-1111-4111-8111-111111111111',
      mime_type: 'image/png',
      content_base64: 'aGVsbG8='
    },
    dependencies: { db: {} }
  });

  assert.equal(result.statusCode, 400);
  assert.match(result.body.error, /não corresponde/i);
});
