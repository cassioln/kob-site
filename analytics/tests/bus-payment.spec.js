import { expect, test } from '@playwright/test';

const primaryCpf = '52998224725';
const passengerTwoCpf = '11144477735';
const passengerThreeCpf = '15350946056';

function fakePixResponse() {
  return {
    registrationId: '00000000-0000-4000-8000-000000000001',
    orderId: 'ORD01TESTBUS2026',
    status: 'action_required',
    totalAmount: '240.00',
    qrCode: '00020126580014br.gov.bcb.pix0136test-code',
    qrCodeBase64: 'aGVsbG8=',
    ticketUrl: 'https://www.mercadopago.com.br/test-ticket'
  };
}

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('cadastra o grupo, calcula o valor e exibe o Pix', async ({ page }) => {
  let requestBody = null;
  await page.route('**/api/create-pix-order', async (route) => {
    requestBody = JSON.parse(route.request().postData() || '{}');
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(fakePixResponse())
    });
  });

  await page.goto('/onibus.html');
  await expect(page).toHaveTitle(/Ônibus.*Kriativos/i);
  await expect(page.getByRole('heading', { name: /ônibus fretado/i })).toBeVisible();
  await expect(page.locator('.bus-hero__ticket').getByText('R$ 120,00', { exact: true })).toBeVisible();
  await expect(page.locator('.bus-hero__ticket').getByText(/por pessoa pagante/i)).toBeVisible();
  await expect(page.locator('.bus-route').getByText(/Barra Funda/i)).toBeVisible();

  await page.getByLabel('Nome completo (contato principal)').fill('Maria de Souza');
  await page.getByLabel('CPF do contato principal').fill(primaryCpf);
  await page.getByLabel('E-mail').fill('maria@example.com');
  await page.getByLabel('WhatsApp').fill('11942554141');
  await page.getByLabel(/Quantas pessoas vão com você/i).fill('3');
  await page.getByLabel(/Crianças de até 5 anos/i).fill('1');

  await expect(page.locator('#passenger-fields .bus-passenger')).toHaveCount(2);
  await page.getByLabel('Nome completo do passageiro 2').fill('João de Souza');
  await page.getByLabel('CPF do passageiro 2').fill(passengerTwoCpf);
  await page.getByLabel('Nome completo do passageiro 3').fill('Ana de Souza');
  await page.getByLabel('CPF do passageiro 3').fill(passengerThreeCpf);
  await page.getByLabel(/Li e concordo com as condições/i).check();

  await expect(page.locator('#bus-total')).toHaveText('R$ 240,00');
  await page.getByRole('button', { name: /continuar para o pagamento pix/i }).click();

  await expect.poll(() => requestBody).not.toBeNull();
  expect(requestBody).toMatchObject({
    passenger_count: 3,
    children_count: 1,
    contact: {
      full_name: 'Maria de Souza',
      cpf: primaryCpf,
      email: 'maria@example.com',
      whatsapp: '11942554141'
    }
  });
  expect(requestBody.passengers).toHaveLength(3);
  expect(requestBody).not.toHaveProperty('total_amount');

  await expect(page.locator('#payment-panel')).toBeVisible();
  await expect(page.locator('#pix-qr')).toHaveAttribute('src', 'data:image/png;base64,aGVsbG8=');
  await expect(page.locator('#pix-copy-code')).toHaveValue(/000201/);
  await expect(page.locator('#bus-form')).toBeHidden();
});

test('envia comprovante válido e exibe confirmação da vaga', async ({ page }) => {
  let proofBody = null;
  let proofUploaded = false;
  await page.route('**/api/create-pix-order', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(fakePixResponse())
    });
  });
  await page.route('**/api/bus-registration-status**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: proofUploaded ? 'confirmed' : 'paid_awaiting_proof' })
    });
  });
  await page.route('**/api/bus-payment-proof', async (route) => {
    proofBody = route.request().postDataJSON();
    proofUploaded = true;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'confirmed' })
    });
  });

  await page.goto('/onibus.html');
  await page.getByLabel('Nome completo (contato principal)').fill('Maria de Souza');
  await page.getByLabel('CPF do contato principal').fill(primaryCpf);
  await page.getByLabel('E-mail').fill('maria@example.com');
  await page.getByLabel('WhatsApp').fill('11942554141');
  await page.getByLabel(/Li e concordo com as condições/i).check();
  await page.getByRole('button', { name: /continuar para o pagamento pix/i }).click();

  await expect(page.locator('#proof-form')).toBeVisible();
  await page.locator('#proof-file').setInputFiles({
    name: 'comprovante.png',
    mimeType: 'image/png',
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  });
  await page.getByRole('button', { name: /enviar comprovante/i }).click();

  await expect(page.locator('#proof-status')).toContainText(/vaga confirmada/i);
  expect(proofBody.registration_id).toBe('00000000-0000-4000-8000-000000000001');
  expect(proofBody.mime_type).toBe('image/png');
  expect(proofBody.content_base64).toBe('iVBORw0KGgo=');
  expect(proofBody).not.toHaveProperty('cpf');
});

test('impede gerar pagamento sem preencher passageiros adicionais', async ({ page }) => {
  let requestCount = 0;
  await page.route('**/api/create-pix-order', async (route) => {
    requestCount += 1;
    await route.fulfill({ status: 500, body: '{}' });
  });

  await page.goto('/onibus.html');
  await page.getByLabel('Nome completo (contato principal)').fill('Maria de Souza');
  await page.getByLabel('CPF do contato principal').fill(primaryCpf);
  await page.getByLabel('E-mail').fill('maria@example.com');
  await page.getByLabel('WhatsApp').fill('11942554141');
  await page.getByLabel(/Quantas pessoas vão com você/i).fill('2');
  await page.getByLabel(/Li e concordo com as condições/i).check();
  await page.getByRole('button', { name: /continuar para o pagamento pix/i }).click();

  await expect(page.locator('#bus-form-status')).toContainText(/preencha os dados do passageiro 2/i);
  expect(requestCount).toBe(0);
});

test('página de pagamento não inicia analytics nem expõe dados em dataLayer', async ({ page }) => {
  await page.goto('/onibus.html');
  expect(await page.evaluate(() => Boolean(window.dataLayer || window.google_tag_manager))).toBe(false);
});
