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

  // Etapa 1: Contato Principal
  await page.getByLabel('Nome completo (contato principal)').fill('Maria de Souza');
  await page.getByLabel('CPF do contato principal').fill(primaryCpf);
  await page.locator('#primary-birth').fill('15/05/1990');
  await page.locator('#primary-email').fill('maria@example.com');
  await page.locator('#primary-whatsapp').fill('11942554141');
  await page.getByRole('button', { name: /continuar: tamanho do grupo/i }).click();

  // Etapa 2: Vagas do Grupo
  await expect(page.locator('[data-wizard-step="2"]')).toBeVisible();
  await page.getByLabel(/Quantas pessoas vão com você/i).fill('3');
  await page.getByLabel(/Crianças de até 5 anos/i).fill('1');
  await page.getByRole('button', { name: /continuar: passageiros/i }).click();

  // Etapa 3: Dados dos Passageiros
  await expect(page.locator('[data-wizard-step="3"]')).toBeVisible();
  await expect(page.locator('#passenger-fields .bus-passenger')).toHaveCount(2);
  await page.getByLabel('Nome completo do passageiro 2').fill('João de Souza');
  await page.getByLabel('CPF do passageiro 2').fill(passengerTwoCpf);
  await page.getByLabel('Nome completo do passageiro 3').fill('Ana de Souza');
  await page.getByLabel('CPF do passageiro 3').fill(passengerThreeCpf);
  await page.getByLabel('Nome completo da criança 1').fill('Pedro de Souza');
  await page.getByLabel('CPF da criança 1').fill('10000000019');
  await page.getByRole('button', { name: /continuar para revisão/i }).click();

  // Etapa 4: Revisão do Pedido
  await expect(page.locator('[data-wizard-step="4"]')).toBeVisible();
  await expect(page.locator('#review-passengers-list .bus-review-card__item')).toHaveCount(4);
  await expect(page.locator('#review-total-amount')).toHaveText('R$ 360,00');
  await page.getByLabel(/Li e concordo com as condições/i).check();

  // 3 pagantes x R$ 120. A criança é adicional e não paga.
  await expect(page.locator('#bus-total')).toHaveText('R$ 360,00');
  // 4 pessoas a bordo: 3 pagantes + 1 criança no colo.
  await expect(page.locator('#bus-summary-count')).toHaveText('4 passageiros');
  await page.getByRole('button', { name: /gerar pagamento pix/i }).click();

  await expect.poll(() => requestBody).not.toBeNull();
  expect(requestBody).toMatchObject({
    passenger_count: 3,
    children_count: 1,
    contact: {
      full_name: 'Maria de Souza',
      cpf: primaryCpf,
      birth_date: '1990-05-15',
      email: 'maria@example.com',
      whatsapp: '11942554141'
    }
  });
  expect(requestBody.passengers).toHaveLength(3);
  expect(requestBody.children).toHaveLength(1);
  expect(requestBody).not.toHaveProperty('total_amount');

  await expect(page.locator('#payment-panel')).toBeVisible();
  await expect(page.locator('#pix-qr')).toHaveAttribute('src', 'data:image/png;base64,aGVsbG8=');
  await expect(page.locator('#pix-copy-code')).toHaveValue(/000201/);
  await expect(page.locator('#bus-form')).toBeHidden();
});

test('confirma a vaga automaticamente quando o pagamento é identificado', async ({ page }) => {
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
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: statusChecks > 1 ? 'confirmed' : 'payment_pending' })
    });
  });

  await page.goto('/onibus.html');
  await page.getByLabel('Nome completo (contato principal)').fill('Maria de Souza');
  await page.getByLabel('CPF do contato principal').fill(primaryCpf);
  await page.locator('#primary-birth').fill('15/05/1990');
  await page.locator('#primary-email').fill('maria@example.com');
  await page.locator('#primary-whatsapp').fill('11942554141');
  await page.getByRole('button', { name: /continuar: tamanho do grupo/i }).click();

  // 1 passageiro pula direto para a revisão
  await page.getByRole('button', { name: /continuar para revisão/i }).click();
  await page.getByLabel(/Li e concordo com as condições/i).check();
  await page.getByRole('button', { name: /gerar pagamento pix/i }).click();

  await expect(page.locator('#payment-panel')).toBeVisible();
  await expect(page.locator('#proof-form')).toHaveCount(0);
  await expect(page.locator('#proof-file')).toHaveCount(0);

  await expect(page.locator('#confirmation-panel')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#payment-panel')).toBeHidden();

  await expect(page.locator('#confirmed-passengers li')).toHaveCount(1);
  await expect(page.locator('#confirmed-passengers li').first()).toContainText('Maria de Souza');
  await expect(page.locator('#confirmed-amount')).toHaveText('R$ 240,00');
  await expect(page.locator('#confirmed-code')).not.toHaveText('—');
  await expect(page.locator('#pix-expiry')).toBeHidden();
});

test('janela de 10 minutos abre o aviso e não confirma nada sozinha', async ({ page }) => {
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
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'payment_pending' })
    });
  });

  await page.goto('/onibus.html');
  await page.getByLabel('Nome completo (contato principal)').fill('Maria de Souza');
  await page.getByLabel('CPF do contato principal').fill(primaryCpf);
  await page.locator('#primary-birth').fill('15/05/1990');
  await page.locator('#primary-email').fill('maria@example.com');
  await page.locator('#primary-whatsapp').fill('11942554141');
  await page.getByRole('button', { name: /continuar: tamanho do grupo/i }).click();

  await page.getByRole('button', { name: /continuar para revisão/i }).click();
  await page.getByLabel(/Li e concordo com as condições/i).check();
  await page.getByRole('button', { name: /gerar pagamento pix/i }).click();

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
  await page.locator('#primary-birth').fill('15/05/1990');
  await page.locator('#primary-email').fill('maria@example.com');
  await page.locator('#primary-whatsapp').fill('11942554141');
  await page.getByRole('button', { name: /continuar: tamanho do grupo/i }).click();

  await page.getByLabel(/Quantas pessoas vão com você/i).fill('2');
  await page.getByRole('button', { name: /continuar: passageiros/i }).click();

  // Clica em continuar sem preencher os dados do passageiro 2
  await page.getByRole('button', { name: /continuar para revisão/i }).click();

  await expect(page.locator('#bus-form-status')).toContainText(/preencha os dados do passageiro 2/i);
  expect(requestCount).toBe(0);
});

test('bloqueia envio se o contato principal for menor de 18 anos', async ({ page }) => {
  let requestCount = 0;
  await page.route('**/api/create-pix-order', async (route) => {
    requestCount += 1;
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(fakePixResponse()) });
  });

  await page.goto('/onibus.html');
  await page.getByLabel('Nome completo (contato principal)').fill('Maria de Souza');
  await page.getByLabel('CPF do contato principal').fill(primaryCpf);
  await page.locator('#primary-birth').fill('15/05/2015'); // 11 anos
  await page.locator('#primary-email').fill('maria@example.com');
  await page.locator('#primary-whatsapp').fill('11942554141');
  await page.getByRole('button', { name: /continuar: tamanho do grupo/i }).click();

  await expect(page.locator('#bus-form-status')).toContainText(/18 anos ou mais/i);
  expect(requestCount).toBe(0);
});

test('página de pagamento não inicia analytics nem expõe dados em dataLayer', async ({ page }) => {
  await page.goto('/onibus.html');
  expect(await page.evaluate(() => Boolean(window.dataLayer || window.google_tag_manager))).toBe(false);
});

test('comprovante impresso sai em A4 monocromático, sem sobras da página', async ({ page }) => {
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
  await page.locator('#primary-birth').fill('15/05/1990');
  await page.locator('#primary-email').fill('maria@example.com');
  await page.locator('#primary-whatsapp').fill('11942554141');
  await page.getByRole('button', { name: /continuar: tamanho do grupo/i }).click();

  await page.getByRole('button', { name: /continuar para revisão/i }).click();
  await page.getByLabel(/Li e concordo com as condições/i).check();
  await page.getByRole('button', { name: /gerar pagamento pix/i }).click();
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
                     '.bus-confirmed__seal', '.bus-section-heading--form', '#bus-stepper']) {
    await expect(page.locator(sel)).toBeHidden();
  }
  // Data de emissão e transação do provedor só existem no documento.
  await expect(page.locator('.bus-confirmed__printonly').first()).toBeVisible();
  await expect(page.locator('#confirmed-issued')).not.toHaveText('—');

  await expect(page.locator('#confirmed-order')).toHaveText(/^ORD[A-Z0-9]+$/);
  const cabe = await page.evaluate(() => {
    const el = document.getElementById('confirmed-order');
    const cell = el.closest('dd').getBoundingClientRect();
    return el.getBoundingClientRect().width <= cell.width + 1;
  });
  expect(cabe, 'order id não deve estourar a célula do comprovante').toBe(true);

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
  expect((texto.match(/\/Type\s*\/Page[^s]/g) || []).length).toBe(1);
});

test('cabeçalho acompanha a etapa e o wizard reflete a navegação', async ({ page }) => {
  await page.route('**/api/create-pix-order', route => route.fulfill({
    status: 201, contentType: 'application/json', body: JSON.stringify(fakePixResponse())
  }));
  let confirmado = false;
  await page.route('**/api/bus-registration-status**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(confirmado
      ? { status: 'confirmed', statusDetail: 'accredited' }
      : { status: 'payment_pending', statusDetail: null })
  }));

  await page.goto('/onibus.html');

  // Etapa 1 do Wizard: Contato Principal
  await expect(page.locator('#step-heading')).toHaveAttribute('data-step', 'cadastro');
  await expect(page.locator('#step-eyebrow')).toHaveText(/Etapa 1 de 3/);
  await expect(page.locator('#form-title')).toHaveText(/responsável/i);

  await page.getByLabel('Nome completo (contato principal)').fill('Maria de Souza');
  await page.getByLabel('CPF do contato principal').fill(primaryCpf);
  await page.locator('#primary-birth').fill('15/05/1990');
  await page.locator('#primary-email').fill('maria@example.com');
  await page.locator('#primary-whatsapp').fill('11942554141');
  await page.getByRole('button', { name: /continuar: tamanho do grupo/i }).click();

  // Etapa 2 do Wizard: Vagas
  await expect(page.locator('[data-wizard-step="2"]')).toBeVisible();
  await page.locator('#passenger-count').fill('3');
  await page.locator('#passenger-count').dispatchEvent('input');
  await expect(page.locator('#step-eyebrow')).toHaveText(/Etapa 2 de 4/);
  await expect(page.locator('#form-title')).toHaveText(/embarcar/i);
  await page.getByRole('button', { name: /continuar: passageiros/i }).click();

  // Etapa 3 do Wizard: Passageiros
  await expect(page.locator('[data-wizard-step="3"]')).toBeVisible();
  await expect(page.locator('#step-eyebrow')).toHaveText(/Etapa 3 de 4/);
  await page.locator('#passenger-2-name').fill('Ana Souza Lima');
  await page.locator('#passenger-2-cpf').fill('111.444.777-35');
  await page.locator('#passenger-3-name').fill('Bruno Costa Reis');
  await page.locator('#passenger-3-cpf').fill('153.509.460-56');
  await page.getByRole('button', { name: /continuar para revisão/i }).click();

  // Etapa 4 do Wizard: Revisão
  await expect(page.locator('[data-wizard-step="4"]')).toBeVisible();
  await expect(page.locator('#step-eyebrow')).toHaveText(/Etapa 4 de 4/);
  await page.getByLabel(/Li e concordo/i).check();
  await page.getByRole('button', { name: /gerar pagamento pix/i }).click();

  // Etapa de Pagamento
  await expect(page.locator('#payment-panel')).toBeVisible();
  await expect(page.locator('#step-heading')).toHaveAttribute('data-step', 'pagamento');
  await expect(page.locator('#step-eyebrow')).toHaveText(/Etapa 2 de 3/);
  await expect(page.locator('#form-title')).toHaveText(/Pix/i);

  // Etapa de Confirmação
  confirmado = true;
  await expect(page.locator('#confirmation-panel')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('#step-heading')).toHaveAttribute('data-step', 'confirmacao');
  await expect(page.locator('#step-eyebrow')).toHaveText(/Etapa 3 de 3/);
  await expect(page.locator('#form-title')).toHaveText(/garantida/i);
});

test('layout do checkout: ritmo por escala e colunas do painel alinhadas', async ({ page }) => {
  await page.route('**/api/create-pix-order', route => route.fulfill({
    status: 201, contentType: 'application/json', body: JSON.stringify(fakePixResponse())
  }));
  await page.route('**/api/bus-registration-status**', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ status: 'payment_pending', statusDetail: null })
  }));

  await page.goto('/onibus.html');

  await page.getByLabel('Nome completo (contato principal)').fill('Maria de Souza');
  await page.getByLabel('CPF do contato principal').fill(primaryCpf);
  await page.locator('#primary-birth').fill('15/05/1990');
  await page.locator('#primary-email').fill('maria@example.com');
  await page.locator('#primary-whatsapp').fill('11942554141');
  await page.getByRole('button', { name: /continuar: tamanho do grupo/i }).click();

  await page.getByRole('button', { name: /continuar para revisão/i }).click();
  await page.getByLabel(/Li e concordo/i).check();
  await page.getByRole('button', { name: /gerar pagamento pix/i }).click();
  await expect(page.locator('#payment-panel')).toBeVisible();

  // As duas formas de pagar começam na mesma linha.
  const colunas = await page.evaluate(() => {
    const filhos = [...document.querySelector('.bus-payment-panel__body').children]
      .filter(e => e.offsetHeight);
    if (filhos.length < 2) return null;
    return {
      desalinhamento: Math.abs(
        Math.round(filhos[0].getBoundingClientRect().top - filhos[1].getBoundingClientRect().top)
      ),
      larguraAcoes: Math.round(filhos[1].getBoundingClientRect().width)
    };
  });

  if (colunas) {
    expect(colunas.desalinhamento).toBeLessThanOrEqual(2);
    expect(colunas.larguraAcoes).toBeGreaterThan(230);
  }

  await expect(page.locator('.bus-payment-panel__way-label')).toBeVisible();

  // Nenhum viewport pode gerar rolagem horizontal.
  for (const w of [390, 768, 1280]) {
    await page.setViewportSize({ width: w, height: 900 });
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `overflow horizontal em ${w}px`).toBe(0);
  }
});

test('contato em 3 linhas e WhatsApp opcional nos passageiros extras', async ({ page }) => {
  let enviado = null;
  await page.route('**/api/create-pix-order', async route => {
    enviado = JSON.parse(route.request().postData() || '{}');
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(fakePixResponse()) });
  });

  await page.goto('/onibus.html');

  // Arranjo: NOME / CPF + DATA DE NASCIMENTO / WHATSAPP + EMAIL.
  const linhas = await page.evaluate(() => {
    const campos = [...document.querySelectorAll('#bus-form [data-wizard-step="1"] .bus-field')];
    const porLinha = {};
    campos.forEach(c => {
      const y = Math.round(c.getBoundingClientRect().top);
      (porLinha[y] ||= []).push(c.querySelector('input, select')?.id);
    });
    return Object.keys(porLinha).sort((a, b) => a - b).map(y => porLinha[y]);
  });
  expect(linhas).toEqual([
    ['primary-name'],
    ['primary-cpf', 'primary-birth'],
    ['primary-whatsapp', 'primary-email']
  ]);

  await page.getByLabel('Nome completo (contato principal)').fill('Maria de Souza');
  await page.getByLabel('CPF do contato principal').fill(primaryCpf);
  await page.locator('#primary-birth').fill('15/05/1990');
  await page.locator('#primary-email').fill('maria@example.com');
  await page.locator('#primary-whatsapp').fill('11942554141');
  await page.getByRole('button', { name: /continuar: tamanho do grupo/i }).click();

  await page.locator('#passenger-count').fill('3');
  await page.locator('#passenger-count').dispatchEvent('input');
  await page.getByRole('button', { name: /continuar: passageiros/i }).click();

  // O campo existe nos extras e NÃO é obrigatório
  for (const pos of [2, 3]) {
    const campo = page.locator(`#passenger-${pos}-whatsapp`);
    await expect(campo).toBeVisible();
    expect(await campo.getAttribute('required')).toBeNull();
    await expect(page.locator(`label[for="passenger-${pos}-whatsapp"]`)).toContainText(/opcional/i);

    const campoEmail = page.locator(`#passenger-${pos}-email`);
    await expect(campoEmail).toBeVisible();
    expect(await campoEmail.getAttribute('required')).toBeNull();
    await expect(page.locator(`label[for="passenger-${pos}-email"]`)).toContainText(/opcional/i);
  }

  // Máscara igual à do contato principal.
  await page.locator('#passenger-2-whatsapp').fill('11912345678');
  await page.locator('#passenger-2-whatsapp').dispatchEvent('input');
  await expect(page.locator('#passenger-2-whatsapp')).toHaveValue('(11) 91234-5678');
  await page.locator('#passenger-2-email').fill('ana@example.com');

  await page.locator('#passenger-2-name').fill('Ana Souza Lima');
  await page.locator('#passenger-2-cpf').fill('111.444.777-35');
  await page.locator('#passenger-3-name').fill('Bruno Costa Reis');
  await page.locator('#passenger-3-cpf').fill('153.509.460-56');
  await page.getByRole('button', { name: /continuar para revisão/i }).click();

  await page.getByLabel(/Li e concordo/i).check();
  await page.getByRole('button', { name: /gerar pagamento pix/i }).click();
  await expect(page.locator('#payment-panel')).toBeVisible();

  expect(enviado.passengers[1].whatsapp).toBe('11912345678');
  expect(enviado.passengers[1].email).toBe('ana@example.com');
  expect(enviado.passengers[2].whatsapp).toBe('');
  expect(enviado.passengers[2].email).toBe('');
});

test('exibe o bloco e nome do grupo na confirmação apenas quando groupName está presente', async ({ page }) => {
  await page.route('**/api/create-pix-order', route => route.fulfill({
    status: 201, contentType: 'application/json', body: JSON.stringify(fakePixResponse())
  }));
  await page.route('**/api/bus-registration-status**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ status: 'confirmed', groupName: 'Wingspan' })
  }));

  await page.goto('/onibus.html');
  await page.getByLabel('Nome completo (contato principal)').fill('Maria de Souza');
  await page.getByLabel('CPF do contato principal').fill(primaryCpf);
  await page.locator('#primary-birth').fill('15/05/1990');
  await page.locator('#primary-email').fill('maria@example.com');
  await page.locator('#primary-whatsapp').fill('11942554141');
  await page.getByRole('button', { name: /continuar: tamanho do grupo/i }).click();

  await page.getByRole('button', { name: /continuar para revisão/i }).click();
  await page.getByLabel(/Li e concordo/i).check();
  await page.getByRole('button', { name: /gerar pagamento pix/i }).click();

  await expect(page.locator('#confirmation-panel')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#confirmed-group')).toBeVisible();
  await expect(page.locator('#confirmed-group-name')).toHaveText('Wingspan');
  await expect(page.locator('.bus-confirmed__wa-btn')).toHaveAttribute('href', 'https://chat.whatsapp.com/DxTVSZrcKXa6WopHZkGL5N?s=cl&p=i&ilr=4');
});

test('navegação do wizard: voltar e avançar mantém dados e validações', async ({ page }) => {
  await page.goto('/onibus.html');

  // Step 1
  await page.getByLabel('Nome completo (contato principal)').fill('Carlos Silva');
  await page.getByLabel('CPF do contato principal').fill(primaryCpf);
  await page.locator('#primary-birth').fill('20/10/1985');
  await page.locator('#primary-email').fill('carlos@example.com');
  await page.locator('#primary-whatsapp').fill('11987654321');
  await page.getByRole('button', { name: /continuar: tamanho do grupo/i }).click();

  // Step 2
  await expect(page.locator('[data-wizard-step="2"]')).toBeVisible();
  await page.locator('#passenger-count').fill('2');
  await page.locator('#passenger-count').dispatchEvent('input');

  // Voltar para Step 1
  await page.getByRole('button', { name: /voltar ao contato/i }).click();
  await expect(page.locator('[data-wizard-step="1"]')).toBeVisible();
  await expect(page.getByLabel('Nome completo (contato principal)')).toHaveValue('Carlos Silva');

  // Avançar para Step 2 de novo
  await page.getByRole('button', { name: /continuar: tamanho do grupo/i }).click();
  await expect(page.locator('[data-wizard-step="2"]')).toBeVisible();
  await expect(page.locator('#passenger-count')).toHaveValue('2');

  // Avançar para Step 3
  await page.getByRole('button', { name: /continuar: passageiros/i }).click();
  await expect(page.locator('[data-wizard-step="3"]')).toBeVisible();
  await page.locator('#passenger-2-name').fill('Fernanda Silva');
  await page.locator('#passenger-2-cpf').fill(passengerTwoCpf);

  // Avançar para Step 4 (Revisão)
  await page.getByRole('button', { name: /continuar para revisão/i }).click();
  await expect(page.locator('[data-wizard-step="4"]')).toBeVisible();
  await expect(page.locator('#review-passengers-list')).toContainText('Carlos Silva');
  await expect(page.locator('#review-passengers-list')).toContainText('Fernanda Silva');

  // Voltar de Step 4 para Step 3
  await page.getByRole('button', { name: /voltar e editar/i }).click();
  await expect(page.locator('[data-wizard-step="3"]')).toBeVisible();
  await expect(page.locator('#passenger-2-name')).toHaveValue('Fernanda Silva');
});
