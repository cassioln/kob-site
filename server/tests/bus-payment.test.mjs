import assert from 'node:assert/strict';
import test from 'node:test';

import { createPixOrder, validateBusPayload } from '../bus-payment.mjs';
import { createMercadoPagoOrder } from '../mercadopago.mjs';
import { handleCreatePixRequest, handleMercadoPagoWebhook, handlePaymentProofRequest, handleRegistrationStatusRequest } from '../http.mjs';

const basePayload = {
  contact: {
    full_name: 'Maria de Souza',
    cpf: '52998224725',
    birth_date: '1990-05-15',
    email: 'maria@example.com',
    whatsapp: '11942554141',
    is_minor: false
  },
  passenger_count: 3,
  children_count: 1,
  passengers: [
    { full_name: 'Maria de Souza', cpf: '52998224725', is_minor: false },
    { full_name: 'João de Souza', cpf: '11144477735', is_minor: false },
    { full_name: 'Ana de Souza', cpf: '15350946056', is_minor: false }
  ],
  children: [
    { full_name: 'Pedro de Souza', cpf: '10000000019' }
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

  // 3 pagantes x R$ 120. As crianças do basePayload são adicionais e não pagam.
  assert.equal(dependencies.calls.registration.amountCents, 36000);
  assert.equal(dependencies.calls.registration.passengers.length, 3);
  assert.equal(dependencies.calls.registration.children.length, 1);
  assert.equal(dependencies.calls.registration.primaryBirthDate, '1990-05-15');
  assert.equal(dependencies.calls.payment.totalAmount, '360.00');
  assert.equal(dependencies.calls.payment.payerEmail, 'maria@example.com');
  assert.equal(dependencies.calls.payment.externalReference, dependencies.calls.registration.externalReference);
  assert.equal(result.totalAmount, '360.00');
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

test('aceita 1 pagante com 1 criança no colo', async () => {
  // Crianças são adicionais e não pagam. Com 1 pagante cabe 1 colo, então
  // este é um cadastro válido: cobra 1 passagem e leva 2 pessoas a bordo.
  const dependencies = fakeDependencies();
  const payload = structuredClone(basePayload);
  payload.passenger_count = 1;
  payload.children_count = 1;
  payload.passengers = [payload.passengers[0]];
  payload.children = [{ full_name: 'Pedro de Souza', cpf: '10000000019' }];

  const result = await createPixOrder({ payload, ...dependencies });
  assert.equal(result.totalAmount, '120.00');
  assert.notEqual(dependencies.calls.registration, null);
});

test('recusa mais crianças que pagantes: cada criança precisa de um colo', async () => {
  const dependencies = fakeDependencies();
  const payload = structuredClone(basePayload);
  payload.passenger_count = 3;
  payload.children_count = 4;
  payload.children = [
    { full_name: 'Pedro de Souza', cpf: '10000000019' },
    { full_name: 'Bia de Souza', cpf: '10000003700' },
    { full_name: 'Leo de Souza', cpf: '10000007455' },
    { full_name: 'Lia de Souza', cpf: '10000011134' }
  ];

  await assert.rejects(
    () => createPixOrder({ payload, ...dependencies }),
    /não podem passar do número de passageiros pagantes|não podem passar do número de pagantes/i
  );
  assert.equal(dependencies.calls.registration, null);
  assert.equal(dependencies.calls.payment, null);
});

test('rejeita contato principal menor de 18 anos', async () => {
  const dependencies = fakeDependencies();
  const payload = structuredClone(basePayload);
  payload.contact.birth_date = '2015-05-15'; // 11 anos

  await assert.rejects(
    () => createPixOrder({ payload, ...dependencies }),
    /O contato principal \/ responsável financeiro deve ter 18 anos ou mais/i
  );
});

test('rejeita crianças de colo além do limite de adultos pagantes no grupo', async () => {
  const dependencies = fakeDependencies();
  const payload = structuredClone(basePayload);
  payload.passenger_count = 2;
  payload.children_count = 2; // 1 adulto + 1 menor => máximo 1 criança de colo
  payload.passengers = [
    { full_name: 'Maria de Souza', cpf: '52998224725', is_minor: false },
    { full_name: 'Jovem Souza', cpf: '11144477735', is_minor: true }
  ];
  payload.children = [
    { full_name: 'Pedro de Souza', cpf: '10000000019' },
    { full_name: 'Bia de Souza', cpf: '10000003700' }
  ];

  await assert.rejects(
    () => createPixOrder({ payload, ...dependencies }),
    /não podem passar do número de pagantes maiores de 18 anos/i
  );
});

test('aceita crianças iguais aos pagantes e cobra só os pagantes', async () => {
  // Fronteira válida: 4 pagantes e 4 crianças, um colo por pagante.
  // 8 pessoas a bordo, mas o valor cobre apenas as 4 passagens.
  const dependencies = fakeDependencies();
  const payload = structuredClone(basePayload);
  payload.passenger_count = 4;
  payload.children_count = 4;
  payload.passengers = [
    { full_name: 'Maria de Souza', cpf: '52998224725', is_minor: false },
    { full_name: 'Joao Souza', cpf: '11144477735', is_minor: false },
    { full_name: 'Ana Souza', cpf: '15350946056', is_minor: false },
    { full_name: 'Lucas Souza', cpf: '01234567890', is_minor: false }
  ];
  payload.children = [
    { full_name: 'Pedro de Souza', cpf: '10000000019' },
    { full_name: 'Bia de Souza', cpf: '10000003700' },
    { full_name: 'Leo de Souza', cpf: '10000007455' },
    { full_name: 'Lia de Souza', cpf: '10000011134' }
  ];

  const result = await createPixOrder({ payload, ...dependencies });
  assert.equal(result.totalAmount, '480.00');
  assert.notEqual(dependencies.calls.registration, null);
});

test('monta a order Pix com token, idempotência e valor server-side', async () => {
  let request = null;
  const response = await createMercadoPagoOrder({
    accessToken: 'APP_USR_TEST_ONLY',
    totalAmount: '360.00',
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
  assert.equal(body.total_amount, '360.00');
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
  assert.equal(result.body.totalAmount, '360.00');
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

test('sandbox envia APRO em payer.first_name; produção preserva o nome real', async () => {
  // Em teste o Pix não é pagável (o QR não abre em app real). `APRO` é o
  // mecanismo oficial do Mercado Pago para o pagamento aprovar sozinho e
  // disparar o webhook. Em produção isso NUNCA deve sobrescrever o nome.
  const { createMercadoPagoOrder } = await import('../mercadopago.mjs');

  async function capturar(isSandbox) {
    let enviado = null;
    const fetchImpl = async (_url, init) => {
      enviado = JSON.parse(init.body);
      return {
        ok: true,
        status: 201,
        json: async () => ({
          id: 'ORD1',
          transactions: {
            payments: [{
              id: 'PAY1',
              status: 'action_required',
              payment_method: { qr_code: 'q', qr_code_base64: 'b' }
            }]
          }
        })
      };
    };
    await createMercadoPagoOrder({
      accessToken: 'token-de-teste',
      totalAmount: '360.00',
      externalReference: 'ext_1',
      payerEmail: 'maria@example.com',
      idempotencyKey: 'idem-1',
      payerData: { fullName: 'Maria de Souza', cpf: '52998224725', whatsapp: '11987654321' },
      passengerCount: 3,
      isSandbox,
      fetchImpl
    });
    return enviado;
  }

  const teste = await capturar(true);
  assert.equal(teste.payer.first_name, 'APRO');

  const producao = await capturar(false);
  assert.equal(producao.payer.first_name, 'Maria');
  assert.equal(producao.payer.last_name, 'de Souza');

  // Dados que o painel de qualidade exige, nos dois ambientes.
  assert.equal(producao.payer.identification.type, 'CPF');
  assert.equal(producao.payer.identification.number, '52998224725');
  assert.equal(producao.payer.phone.area_code, '11');
  assert.equal(producao.payer.phone.number, '987654321');
  // A Orders API rejeita statement_descriptor (400 unsupported_properties,
  // medido em produção): ele não deve ser enviado em nenhum nível.
  assert.equal(producao.statement_descriptor, undefined);
  assert.equal(producao.transactions.payments[0].statement_descriptor, undefined);
  assert.equal(producao.items[0].quantity, 3);
  // 360 / 3 passageiros = 120 por passagem.
  assert.equal(producao.items[0].unit_price, '120.00');
  assert.ok(producao.items[0].title);
});

test('WhatsApp do passageiro é opcional, mas inválido é recusado', () => {
  // Só o contato principal tem WhatsApp obrigatório. Nos passageiros extras o
  // campo serve para a organização falar direto com quem embarca — vazio precisa
  // passar, senão o campo "opcional" bloqueia o cadastro na prática.
  const base = {
    contact: {
      full_name: 'Cassio Lima do Nascimento',
      cpf: '529.982.247-25',
      birth_date: '1990-05-15',
      email: 'cassio@example.com',
      whatsapp: '(11) 98765-4321'
    },
    passenger_count: 2,
    children_count: 0
  };

  // (a) ausente e (b) string vazia: ambos viram null, sem erro.
  for (const valor of [undefined, '', '   ']) {
    const entrada = {
      ...base,
      passengers: [
        { full_name: 'Cassio Lima do Nascimento', cpf: '529.982.247-25', whatsapp: '11987654321' },
        { full_name: 'Ana Souza Lima', cpf: '111.444.777-35', ...(valor === undefined ? {} : { whatsapp: valor }) }
      ]
    };
    const ok = validateBusPayload(entrada);
    assert.equal(ok.passengers[1].whatsapp, null, `valor ${JSON.stringify(valor)} deveria virar null`);
  }

  // (c) preenchido e válido: normalizado para dígitos nacionais.
  const comNumero = validateBusPayload({
    ...base,
    passengers: [
      { full_name: 'Cassio Lima do Nascimento', cpf: '529.982.247-25', whatsapp: '11987654321' },
      { full_name: 'Ana Souza Lima', cpf: '111.444.777-35', whatsapp: '(11) 91234-5678' }
    ]
  });
  assert.equal(comNumero.passengers[1].whatsapp, '11912345678');

  // (d) preenchido e MALFORMADO: recusa. Opcional não significa "aceita lixo" —
  // guardar um telefone quebrado é pior do que não guardar telefone.
  assert.throws(() => validateBusPayload({
    ...base,
    passengers: [
      { full_name: 'Cassio Lima do Nascimento', cpf: '529.982.247-25', whatsapp: '11987654321' },
      { full_name: 'Ana Souza Lima', cpf: '111.444.777-35', whatsapp: '123' }
    ]
  }), /WhatsApp do passageiro 2 inválido/);
});
