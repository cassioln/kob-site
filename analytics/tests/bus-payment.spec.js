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

  // 3 pagantes x R$ 120. A criança é adicional e não paga.
  await expect(page.locator('#bus-total')).toHaveText('R$ 360,00');
  // 4 pessoas a bordo: 3 pagantes + 1 criança no colo.
  await expect(page.locator('#bus-summary-count')).toHaveText('4 passageiros');
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

test('confirma a vaga automaticamente quando o pagamento é identificado', async ({ page }) => {
  // O comprovante deixou de ser exigido: o webhook consulta a order na API do
  // Mercado Pago e o polling da página reflete 'confirmed' sem upload nenhum.
  let statusChecks = 0;
  await page.route('**/api/create-pix-order', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(fakePixResponse())
    });
  });
  await page.route('**/api/bus-registration-status**', async (route) => {
    statusChecks += 1;
    // Primeira consulta ainda pendente; depois o pagamento é identificado.
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: statusChecks > 1 ? 'confirmed' : 'payment_pending' })
    });
  });

  await page.goto('/onibus.html');
  await page.getByLabel('Nome completo (contato principal)').fill('Maria de Souza');
  await page.getByLabel('CPF do contato principal').fill(primaryCpf);
  await page.getByLabel('E-mail').fill('maria@example.com');
  await page.getByLabel('WhatsApp').fill('11942554141');
  await page.getByLabel(/Li e concordo com as condições/i).check();
  await page.getByRole('button', { name: /continuar para o pagamento pix/i }).click();

  await expect(page.locator('#payment-panel')).toBeVisible();

  // Não deve existir mais nenhuma etapa de envio de comprovante.
  await expect(page.locator('#proof-form')).toHaveCount(0);
  await expect(page.locator('#proof-file')).toHaveCount(0);

  // O polling avança sozinho: a seção de confirmação SUBSTITUI o painel de
  // pagamento, em vez de deixar o QR no ar com um aviso discreto ao lado.
  await expect(page.locator('#confirmation-panel')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#payment-panel')).toBeHidden();

  // Dados do grupo aparecem na confirmação.
  await expect(page.locator('#confirmed-passengers li')).toHaveCount(1);
  await expect(page.locator('#confirmed-passengers li').first()).toContainText('Maria de Souza');
  // O valor exibido é o que o servidor devolveu (fakePixResponse: 240.00),
  // não um cálculo do navegador.
  await expect(page.locator('#confirmed-amount')).toHaveText('R$ 240,00');
  await expect(page.locator('#confirmed-code')).not.toHaveText('—');

  // O contador de tempo perde sentido depois de pago.
  await expect(page.locator('#pix-expiry')).toBeHidden();
});

test('janela de 10 minutos abre o aviso e não confirma nada sozinha', async ({ page }) => {
  // O contador é uma janela de atenção, não a validade real do Pix (24h).
  // A prova é dupla: ele conta em mm:ss e, ao zerar, pergunta se a pessoa ainda
  // está lá — sem nunca decidir o estado da reserva por conta própria.
  let statusChecks = 0;
  await page.route('**/api/create-pix-order', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(fakePixResponse())
    });
  });
  await page.route('**/api/bus-registration-status**', async (route) => {
    statusChecks += 1;
    // O servidor insiste em "pendente", mesmo após a janela zerar.
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'payment_pending' })
    });
  });

  await page.goto('/onibus.html');
  await page.getByLabel('Nome completo (contato principal)').fill('Maria de Souza');
  await page.getByLabel('CPF do contato principal').fill(primaryCpf);
  await page.getByLabel('E-mail').fill('maria@example.com');
  await page.getByLabel('WhatsApp').fill('11942554141');
  await page.getByLabel(/Li e concordo com as condições/i).check();
  await page.getByRole('button', { name: /continuar para o pagamento pix/i }).click();

  // O contador aparece em mm:ss, começando nos 10 minutos.
  await expect(page.locator('#pix-expiry')).toBeVisible();
  await expect(page.locator('#pix-expiry-countdown')).toHaveText(/^\d{2}:\d{2}$/);

  // Avança o relógio da página em 10 minutos em vez de esperar de verdade.
  await page.evaluate(() => {
    const real = Date.now;
    let offset = 0;
    window.__advance = (ms) => { offset += ms; };
    Date.now = () => real.call(Date) + offset;
    window.__advance(10 * 60 * 1000 + 1000);
  });

  // Ao zerar: contador em 00:00 e o diálogo pergunta se a pessoa continua ali.
  await expect(page.locator('#pix-expiry-countdown')).toHaveText('00:00', { timeout: 10000 });
  await expect(page.locator('#pix-expiry')).toHaveAttribute('data-state', 'expired');
  await expect(page.locator('#still-here-dialog')).toBeVisible();

  // O ponto central: zerar NÃO confirma nem cancela por conta própria.
  await expect(page.locator('#confirmation-panel')).toBeHidden();
  expect(statusChecks).toBeGreaterThan(0);

  // "Continuar pagamento" devolve outros 10 minutos e fecha o aviso.
  await page.locator('#still-here-continue').click();
  await expect(page.locator('#still-here-dialog')).toBeHidden();
  await expect(page.locator('#pix-expiry-countdown')).toHaveText(/^(10:00|09:\d{2})$/);
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

test('comprovante impresso sai em A4 monocromático, sem sobras da página', async ({ page }) => {
  // O `@media print` já regrediu duas vezes: um seletor supunha uma hierarquia
  // inexistente (o cabeçalho do formulário imprimia em roxo) e `body *` não
  // alcança pseudo-elementos (o contador do manifesto imprimia em roxo).
  // Este teste tranca as duas coisas.
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
  await expect(page.locator('#confirmation-panel')).toBeVisible({ timeout: 15000 });

  // Botões lado a lado na tela (mesma linha, larguras equivalentes).
  const acoes = await page.evaluate(() => {
    const els = [...document.querySelectorAll('.bus-confirmed__actions .btn')];
    return els.map((e) => {
      const r = e.getBoundingClientRect();
      return { top: Math.round(r.top), width: Math.round(r.width) };
    });
  });
  expect(acoes).toHaveLength(2);
  expect(Math.abs(acoes[0].top - acoes[1].top)).toBeLessThanOrEqual(2);
  expect(Math.abs(acoes[0].width - acoes[1].width)).toBeLessThanOrEqual(2);

  await page.emulateMedia({ media: 'print' });

  // Nada da página fora do comprovante deve imprimir.
  for (const sel of ['#bus-form', '#payment-panel', '.bus-confirmed__actions',
                     '.bus-confirmed__seal', '.bus-section-heading--form']) {
    await expect(page.locator(sel)).toBeHidden();
  }
  // A data de emissão só existe no documento.
  await expect(page.locator('.bus-confirmed__printonly')).toBeVisible();
  await expect(page.locator('#confirmed-issued')).not.toHaveText('—');

  // Monocromia: elementos E pseudo-elementos.
  const cores = await page.evaluate(() => {
    const fora = [];
    const nodes = document.querySelectorAll('#confirmation-panel, #confirmation-panel *');
    nodes.forEach((el) => {
      const alvos = [getComputedStyle(el)];
      ['::before', '::after'].forEach((p) => {
        const cs = getComputedStyle(el, p);
        if (cs.content && cs.content !== 'none' && cs.content !== 'normal') alvos.push(cs);
      });
      alvos.forEach((cs) => {
        const m = cs.color.match(/\d+/g);
        if (!m) return;
        const [r, g, b] = m.map(Number);
        // Preto ou cinza puro passam; qualquer matiz reprova.
        if (Math.max(r, g, b) - Math.min(r, g, b) > 8) fora.push(cs.color);
      });
    });
    return fora;
  });
  expect(cores, `cores cromáticas no comprovante: ${cores.join(', ')}`).toEqual([]);

  // A4 retrato: 210 x 297 mm.
  const pdf = await page.pdf({ format: 'A4', printBackground: false });
  const texto = pdf.toString('latin1');
  const box = texto.match(/\/MediaBox\s*\[([^\]]+)\]/);
  expect(box).not.toBeNull();
  const [x1, y1, x2, y2] = box[1].trim().split(/\s+/).map(Number);
  const mmW = ((x2 - x1) / 72) * 25.4;
  const mmH = ((y2 - y1) / 72) * 25.4;
  expect(Math.abs(mmW - 210)).toBeLessThan(1.5);
  expect(Math.abs(mmH - 297)).toBeLessThan(1.5);
  // Uma página só.
  expect((texto.match(/\/Type\s*\/Page[^s]/g) || []).length).toBe(1);
});
