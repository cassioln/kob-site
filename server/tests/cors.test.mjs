import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ALLOWED_REQUEST_HEADERS,
  DEFAULT_ALLOWED_ORIGINS,
  buildCorsHeaders,
  buildPreflightResponse,
  getRequestOrigin,
  isOriginAllowed,
  isPreflight,
  parseAllowedOrigins
} from '../cors.mjs';
import {
  handleCreatePixRequest,
  handleMercadoPagoWebhook,
  handlePaymentProofRequest,
  handleRegistrationStatusRequest
} from '../http.mjs';

const ALLOWED = 'https://www.kriativosonboard.com.br';
const EVIL = 'https://kriativosonboard.com.br.evil.example';
const REGISTRATION_ID = '11111111-1111-4111-8111-111111111111';

const busPayload = {
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

function pixDependencies() {
  return {
    db: {
      async createRegistration(record) {
        return { id: record.id, externalReference: record.externalReference };
      },
      async updateRegistration() {}
    },
    mercadoPago: {
      async createOrder() {
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

const statusDependencies = {
  db: {
    async getRegistrationStatus() {
      return { status: 'confirmed', status_detail: 'accredited' };
    }
  }
};

const proofDependencies = {
  db: {
    async getRegistrationStatus() {
      return { status: 'paid_awaiting_proof' };
    },
    async createPaymentProof() {
      return { status: 'confirmed' };
    }
  }
};

const proofBody = {
  registration_id: REGISTRATION_ID,
  file_name: 'comprovante.png',
  mime_type: 'image/png',
  content_base64: 'iVBORw0KGgo='
};

/** Chama os três endpoints de dados com o mesmo Origin. */
async function callDataEndpoints(origin, env) {
  const headers = origin ? { origin } : {};
  return {
    pix: await handleCreatePixRequest({
      method: 'POST',
      body: JSON.stringify(busPayload),
      headers,
      env,
      dependencies: pixDependencies()
    }),
    status: await handleRegistrationStatusRequest({
      method: 'GET',
      registrationId: REGISTRATION_ID,
      headers,
      env,
      dependencies: statusDependencies
    }),
    proof: await handlePaymentProofRequest({
      method: 'POST',
      body: proofBody,
      headers,
      env,
      dependencies: proofDependencies
    })
  };
}

test('a allowlist padrão cobre o domínio de produção com e sem www', () => {
  assert.deepEqual(parseAllowedOrigins({}), [
    'https://kriativosonboard.com.br',
    'https://www.kriativosonboard.com.br'
  ]);
  assert.deepEqual([...DEFAULT_ALLOWED_ORIGINS], parseAllowedOrigins({ ALLOWED_ORIGINS: '   ' }));
  assert.ok(isOriginAllowed('https://kriativosonboard.com.br', {}));
  assert.ok(isOriginAllowed(ALLOWED, {}));
});

test('ALLOWED_ORIGINS configura a allowlist por vírgula e ignora entradas vazias', () => {
  const env = { ALLOWED_ORIGINS: 'https://staging.kriativosonboard.com.br, , https://app.example.com/,' };
  assert.deepEqual(parseAllowedOrigins(env), [
    'https://staging.kriativosonboard.com.br',
    'https://app.example.com'
  ]);
  assert.ok(isOriginAllowed('https://app.example.com', env));
  // Configurar a allowlist substitui o default: produção deixa de valer nesse env.
  assert.equal(isOriginAllowed(ALLOWED, env), false);
});

test('wildcard configurado por engano é descartado e cai no default seguro', () => {
  const env = { ALLOWED_ORIGINS: '*' };
  assert.deepEqual(parseAllowedOrigins(env), [...DEFAULT_ALLOWED_ORIGINS]);
  assert.equal(isOriginAllowed('https://qualquer-site.example', env), false);
  const corsHeaders = buildCorsHeaders({ headers: { origin: 'https://qualquer-site.example' }, env });
  assert.equal(corsHeaders['Access-Control-Allow-Origin'], undefined);
});

test('o header Origin é lido de forma case-insensitive', () => {
  assert.equal(getRequestOrigin({ Origin: ALLOWED }), ALLOWED);
  assert.equal(getRequestOrigin({ ORIGIN: ALLOWED }), ALLOWED);
  assert.equal(getRequestOrigin({ origin: `${ALLOWED}/` }), ALLOWED);
  assert.equal(getRequestOrigin({}), '');
  assert.equal(getRequestOrigin(undefined), '');
});

test('origem permitida recebe Access-Control-Allow-Origin refletido nos endpoints de dados', async () => {
  const { pix, status, proof } = await callDataEndpoints(ALLOWED, {});

  for (const [name, result] of Object.entries({ pix, status, proof })) {
    assert.equal(
      result.headers['Access-Control-Allow-Origin'],
      ALLOWED,
      `${name} deveria refletir a origem permitida`
    );
    assert.equal(result.headers['Access-Control-Allow-Headers'], ALLOWED_REQUEST_HEADERS);
    assert.match(result.headers['Access-Control-Allow-Methods'], /OPTIONS/);
  }

  // Contratos preservados.
  assert.equal(pix.statusCode, 201);
  assert.equal(pix.body.totalAmount, '360.00');
  assert.equal(status.statusCode, 200);
  assert.deepEqual(status.body, { status: 'confirmed', statusDetail: 'accredited' });
  assert.equal(proof.statusCode, 201);
  assert.deepEqual(proof.body, { status: 'confirmed' });
});

test('origem não permitida NÃO recebe Access-Control-Allow-Origin', async () => {
  const { pix, status, proof } = await callDataEndpoints(EVIL, {});

  for (const [name, result] of Object.entries({ pix, status, proof })) {
    assert.equal(
      Object.hasOwn(result.headers, 'Access-Control-Allow-Origin'),
      false,
      `${name} não deveria emitir Allow-Origin para origem estranha`
    );
    assert.equal(Object.hasOwn(result.headers, 'Access-Control-Allow-Methods'), false);
    assert.equal(Object.hasOwn(result.headers, 'Access-Control-Allow-Headers'), false);
  }

  // Sem CORS o navegador bloqueia, mas o contrato HTTP segue idêntico.
  assert.equal(pix.statusCode, 201);
  assert.equal(status.statusCode, 200);
  assert.equal(proof.statusCode, 201);
});

test('requisição sem Origin (server-to-server ou same-origin) não emite Allow-Origin', async () => {
  const { pix, status, proof } = await callDataEndpoints(undefined, {});
  for (const result of [pix, status, proof]) {
    assert.equal(Object.hasOwn(result.headers, 'Access-Control-Allow-Origin'), false);
    assert.equal(result.headers.Vary, 'Origin');
  }
});

test('preflight OPTIONS responde 204 sem corpo e com Allow-Methods/Allow-Headers', async () => {
  const headers = { origin: ALLOWED };
  const preflights = {
    pix: await handleCreatePixRequest({ method: 'OPTIONS', headers, env: {} }),
    status: await handleRegistrationStatusRequest({ method: 'OPTIONS', headers, env: {} }),
    proof: await handlePaymentProofRequest({ method: 'OPTIONS', headers, env: {} })
  };

  for (const [name, result] of Object.entries(preflights)) {
    assert.equal(result.statusCode, 204, `${name} deveria responder 204 no preflight`);
    assert.equal(result.body, null);
    assert.equal(result.headers['Access-Control-Allow-Origin'], ALLOWED);
    assert.match(result.headers['Access-Control-Allow-Methods'], /OPTIONS/);
    assert.equal(result.headers['Access-Control-Allow-Headers'], ALLOWED_REQUEST_HEADERS);
    assert.equal(result.headers.Vary, 'Origin');
  }

  assert.match(preflights.pix.headers['Access-Control-Allow-Methods'], /POST/);
  assert.match(preflights.status.headers['Access-Control-Allow-Methods'], /GET/);
  assert.match(preflights.proof.headers['Access-Control-Allow-Methods'], /POST/);
  // X-Idempotency-Key precisa ser aceito no preflight do endpoint de Pix.
  assert.match(preflights.pix.headers['Access-Control-Allow-Headers'], /X-Idempotency-Key/);
});

test('preflight de origem não permitida ainda é 204, mas sem headers de permissão', async () => {
  const result = await handleCreatePixRequest({ method: 'OPTIONS', headers: { origin: EVIL }, env: {} });
  assert.equal(result.statusCode, 204);
  assert.equal(result.body, null);
  assert.equal(Object.hasOwn(result.headers, 'Access-Control-Allow-Origin'), false);
  assert.equal(result.headers.Vary, 'Origin');
  assert.ok(isPreflight('options'));
  assert.equal(isPreflight('POST'), false);
});

test('wildcard nunca aparece em endpoint de dados, em nenhuma origem ou método', async () => {
  const origins = [ALLOWED, EVIL, 'null', '*', 'http://kriativosonboard.com.br', undefined];
  const methods = ['POST', 'GET', 'OPTIONS', 'DELETE'];
  let checks = 0;

  for (const origin of origins) {
    const headers = origin ? { origin } : {};
    for (const method of methods) {
      const results = [
        await handleCreatePixRequest({
          method, body: JSON.stringify(busPayload), headers, env: {}, dependencies: pixDependencies()
        }),
        await handleRegistrationStatusRequest({
          method, registrationId: REGISTRATION_ID, headers, env: {}, dependencies: statusDependencies
        }),
        await handlePaymentProofRequest({
          method, body: proofBody, headers, env: {}, dependencies: proofDependencies
        })
      ];
      for (const result of results) {
        const serialized = JSON.stringify(result.headers || {});
        assert.equal(
          result.headers?.['Access-Control-Allow-Origin'] === '*',
          false,
          `wildcard vazou com origin=${origin} method=${method}`
        );
        assert.equal(serialized.includes('"*"'), false);
        checks += 1;
      }
    }
  }
  assert.equal(checks, origins.length * methods.length * 3);
});

test('Vary: Origin está presente em toda resposta de endpoint de dados', async () => {
  for (const origin of [ALLOWED, EVIL]) {
    const { pix, status, proof } = await callDataEndpoints(origin, {});
    for (const result of [pix, status, proof]) {
      assert.equal(result.headers.Vary, 'Origin');
    }
  }
  // Também em respostas de erro (405 e 400).
  const notAllowed = await handleCreatePixRequest({ method: 'DELETE', headers: { origin: ALLOWED }, env: {} });
  assert.equal(notAllowed.statusCode, 405);
  assert.equal(notAllowed.headers.Vary, 'Origin');

  const badId = await handleRegistrationStatusRequest({
    method: 'GET', registrationId: 'nao-e-uuid', headers: { origin: ALLOWED }, env: {}
  });
  assert.equal(badId.statusCode, 400);
  assert.equal(badId.headers.Vary, 'Origin');
});

test('webhook do Mercado Pago não recebe CORS nem responde a preflight de navegador', async () => {
  const webhookDependencies = {
    db: {
      async findByExternalReference() { return { id: 'registration-1' }; },
      async updateRegistration() {}
    },
    mercadoPago: {
      async getOrder(orderId) {
        return {
          orderId,
          externalReference: 'kob_bus_2026_registration',
          orderStatus: 'processed',
          paymentId: 'PAY01TESTBUS2026',
          paymentStatus: 'processed',
          paymentStatusDetail: 'accredited'
        };
      }
    }
  };

  const posted = await handleMercadoPagoWebhook({
    method: 'POST',
    body: { data: { id: 'ORD01TESTBUS2026' } },
    headers: { origin: ALLOWED },
    env: {},
    dependencies: webhookDependencies
  });
  assert.equal(posted.statusCode, 200);
  assert.equal(posted.body.status, 'confirmed');
  assert.equal(posted.headers, undefined);

  const preflight = await handleMercadoPagoWebhook({
    method: 'OPTIONS',
    headers: { origin: ALLOWED },
    env: {}
  });
  assert.equal(preflight.statusCode, 405);
  assert.equal(preflight.headers, undefined);
  assert.equal(JSON.stringify(preflight).includes('Access-Control'), false);
});

test('buildPreflightResponse e buildCorsHeaders são coerentes com Max-Age', () => {
  const allowed = buildPreflightResponse({ origin: ALLOWED, methods: ['POST'], env: {} });
  assert.equal(allowed.statusCode, 204);
  assert.equal(allowed.headers['Access-Control-Max-Age'], '600');
  assert.equal(allowed.headers['Access-Control-Allow-Methods'], 'POST, OPTIONS');

  const denied = buildCorsHeaders({ origin: 'https://outro.example', env: {} });
  assert.deepEqual(denied, { Vary: 'Origin' });
});
