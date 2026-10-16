import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const emptyState = () => ({ present: false, revision: 0, checked_at: null });
function fixture() {
  return {
    waiting: 1,
    people: [
      { id: '1', registration_id: 'group-a', code: 'GRUPOAAA', name: 'Ana de Souza', contact: 'Ana de Souza', cpf: '111.111.111-11', group: 'Tripulação dos Dados', bus_number: 1, primary: true, outbound: emptyState(), return: emptyState() },
      { id: '2', registration_id: 'group-a', code: 'GRUPOAAA', name: 'José de Souza', contact: 'Ana de Souza', group: 'Tripulação dos Dados', bus_number: 1, lap_child: true, outbound: emptyState(), return: emptyState() },
      { id: '3', registration_id: 'group-b', code: 'GRUPOBBB', name: 'Maria Oliveira', contact: 'Maria Oliveira', group: null, bus_number: 2, vip: true, outbound: emptyState(), return: emptyState() }
    ]
  };
}
// O painel completo não abre a chamada sozinho: entra e clica no botão do cabeçalho.
async function gotoBoarding(page, url = '/painel-onibus.html') {
  await page.goto(url);
  const opener = page.locator('#embarque-open');
  await expect(opener).toBeVisible();
  await opener.click();
  await expect(page.locator('#embarque-sidebar')).toHaveClass(/is-open/);
}
async function openExport(page) {
  const toggle = page.locator('#embarque-export-toggle');
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  await expect(page.locator('#embarque-export-controls')).not.toHaveAttribute('inert', '');
}
async function mockPanel(context, manifest = fixture(), options = {}) {
  const writes = [];
  await context.route('**/api/bus-admin-data*', route => route.fulfill({ json: { reservas: [], resumo: {}, frota: { capacidade: 46, minimo: 40, onibus: [] } } }));
  await context.route('**/api/bus-admin-reconcile*', route => route.fulfill({ json: { updated: 0 } }));
  await context.route('**/api/bus-boarding', async route => {
    if (route.request().method() === 'GET') {
      if (options.readDelay) await new Promise(resolve => setTimeout(resolve, options.readDelay));
      return route.fulfill({ json: manifest });
    }
    const body = route.request().postDataJSON();
    writes.push({ body, headers: route.request().headers(), url: route.request().url() });
    if (options.fail) return route.fulfill({ status: 503, json: { error: 'boarding_unavailable' } });
    if (options.delay) await options.delay();
    const person = manifest.people.find(p => p.id === body.passenger_id);
    if (person[body.leg].revision !== body.expected_revision) {
      return route.fulfill({ status: 409, json: { error: 'revision_conflict', checkin: person[body.leg] } });
    }
    person[body.leg] = { present: body.present, revision: body.expected_revision + 1, checked_at: body.present ? '2026-11-20T09:00:00Z' : null };
    return route.fulfill({ json: { checkin: person[body.leg] } });
  });
  return { manifest, writes };
}

test('embarque abre só pelo botão do cabeçalho e salva presença por passageiro e trecho @smoke', async ({ page, context }) => {
  const api = await mockPanel(context);
  await page.goto('/painel-onibus.html');
  const opener = page.locator('#embarque-open');
  await expect(opener).toBeVisible();
  await expect(opener).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#embarque-sidebar')).not.toBeVisible();
  await opener.click();
  await expect(page.locator('#embarque-sidebar')).toBeVisible();
  await expect(page.locator('#embarque-sidebar')).toHaveClass(/is-open/);
  await expect(page.locator('.painel-abas [role="tab"]')).toHaveCount(2);
  await expect(page.locator('[data-aba="embarque"]')).toHaveCount(0);
  await expect(page.locator('[data-aba="reservas"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#embarque-expected')).toHaveText('3');
  await expect(page.locator('#embarque-missing')).toHaveText('3');
  await expect(page.locator('.embarque-group')).toHaveCount(2);
  await expect(page.getByText('Criança de colo', { exact: true })).toBeVisible();
  const ana = page.locator('[data-check="1"]');
  await ana.click();
  await expect(ana).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#embarque-present')).toHaveText('1');
  await expect(page.locator('[data-person="1"]')).not.toHaveClass(/is-queued/);
  expect(api.writes[0].body).toEqual({ passenger_id: '1', leg: 'outbound', present: true, expected_revision: 0, bus_number: 1 });
  expect(api.writes[0].headers['x-admin-token']).toBe('dev-token');
  expect(api.writes[0].url).not.toContain('token=');
  await page.locator('[data-leg="return"]').click();
  await expect(ana).toHaveAttribute('aria-pressed', 'false');
  await ana.click();
  await expect(ana).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-person="1"]')).not.toHaveClass(/is-queued/);
  await page.reload();
  await page.locator('#embarque-open').click();
  await expect(ana).toHaveAttribute('aria-pressed', 'true');
  await ana.click();
  await expect(ana).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#embarque-present')).toHaveText('0');
  await expect(page.locator('[data-person="1"]')).not.toHaveClass(/is-queued/);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual(['kob_admin_token']);
});

test('identifica seleção pendente até confirmar no banco e impede duplo toque @smoke', async ({ page, context }) => {
  let release;
  const wait = new Promise(resolve => { release = resolve; });
  const api = await mockPanel(context, fixture(), { delay: () => wait });
  await gotoBoarding(page, '/painel-onibus.html');
  const ana = page.locator('[data-check="1"]');
  await ana.focus();
  await page.keyboard.press('Space');
  await expect(ana).toBeDisabled();
  await expect(ana).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('[data-person="1"] .embarque-person__detail')).toHaveText('Enviando ao banco…');
  await expect(ana).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#embarque-present')).toHaveText('1');
  await expect(page.locator('[data-person="1"]')).toHaveClass(/is-queued/);
  release();
  await expect(ana).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-person="1"]')).not.toHaveClass(/is-queued/);
  await expect(ana).toBeFocused();
  expect(api.writes).toHaveLength(1);
});

test('preserva foco na próxima pessoa quando o filtro remove a presença salva @smoke', async ({ page, context }) => {
  await mockPanel(context);
  await gotoBoarding(page, '/painel-onibus.html');
  await page.locator('[data-presence="missing"]').click();
  await page.locator('[data-check="1"]').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('[data-check="1"]')).toHaveCount(0);
  await expect(page.locator('[data-check="2"]')).toBeFocused();
});

test('tablet mantém contadores visíveis durante a chamada @smoke', async ({ page, context }) => {
  await mockPanel(context);
  await page.setViewportSize({ width: 820, height: 700 });
  await gotoBoarding(page, '/painel-onibus.html');
  await page.locator('[data-check="3"]').scrollIntoViewIfNeeded();
  const summary = await page.locator('.embarque-overview').boundingBox();
  expect(summary.y).toBeGreaterThanOrEqual(0);
  expect(summary.y + summary.height).toBeLessThan(700);
  expect(await page.locator('#embarque-scroll').evaluate(node => node.scrollTop)).toBeGreaterThan(0);
});

test('filtra ônibus, grupos, faltantes e nomes sem acentos', async ({ page, context }) => {
  await mockPanel(context);
  await gotoBoarding(page, '/painel-onibus.html');
  await page.locator('[data-check="1"]').click();
  await page.locator('[data-presence="missing"]').click();
  await expect(page.locator('.embarque-person')).toHaveCount(2);
  await page.locator('#embarque-buses').selectOption('1');
  await expect(page.locator('.embarque-person')).toHaveCount(1);
  await expect(page.locator('#embarque-expected')).toHaveText('2');
  await expect(page.locator('#embarque-missing')).toHaveText('1');
  await page.locator('#embarque-search').fill('jose');
  await expect(page.locator('.embarque-person')).toHaveCount(1);
  await page.locator('#embarque-search').fill('inexistente');
  await expect(page.locator('#embarque-empty')).toBeVisible();
  await page.locator('#embarque-clear').click();
  await expect(page.locator('.embarque-person')).toHaveCount(3);
});

test('duas sessões convergem quando a intenção já está salva no banco', async ({ browser }) => {
  const first = await browser.newContext();
  const second = await browser.newContext();
  const manifest = fixture();
  await mockPanel(first, manifest);
  await mockPanel(second, manifest);
  const a = await first.newPage(), b = await second.newPage();
  await Promise.all([gotoBoarding(a), gotoBoarding(b)]);
  await expect(b.locator('[data-check="1"]')).toHaveAttribute('aria-pressed', 'false');
  await a.locator('[data-check="1"]').click();
  await expect(a.locator('[data-check="1"]')).toHaveAttribute('aria-pressed', 'true');
  await b.locator('[data-check="1"]').click();
  await expect(b.locator('[data-check="1"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(b.locator('[data-person="1"]')).not.toHaveClass(/is-queued/);
  await a.locator('[data-check="2"]').click();
  await expect(a.locator('[data-check="2"]')).toHaveAttribute('aria-pressed', 'true');
  await b.locator('#embarque-update').click();
  await expect(b.locator('[data-check="2"]')).toHaveAttribute('aria-pressed', 'true');
  await first.close(); await second.close();
});

test('erro de gravação e falta de conexão mantêm marcação identificada como pendente', async ({ page, context }) => {
  await mockPanel(context, fixture(), { fail: true });
  await gotoBoarding(page, '/painel-onibus.html');
  await page.locator('[data-check="1"]').click();
  await expect(page.locator('#embarque-connection')).toContainText('pendente de envio');
  await expect(page.locator('[data-check="1"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-person="1"]')).toHaveClass(/is-queued/);
  await expect(page.locator('[data-boarding-export="pdf"]')).toBeDisabled();
  await expect(page.locator('#embarque-update')).toBeEnabled();
  await page.locator('#embarque-update').click();
  await expect(page.locator('[data-check="1"]')).toBeEnabled();
  await context.setOffline(true);
  await expect(page.locator('#embarque-sync')).toContainText('Sem conexão');
  await expect(page.locator('[data-check="1"]')).toBeEnabled();
  await context.setOffline(false);
  await expect(page.locator('[data-check="1"]')).toBeEnabled();
});

test('sincroniza automaticamente apenas com slider aberto e limpa dados ao sair', async ({ page, context }) => {
  const api = await mockPanel(context);
  await page.clock.install();
  await gotoBoarding(page, '/painel-onibus.html');
  await expect(page.locator('[data-check="1"]')).toBeVisible();
  api.manifest.people[0].outbound = { present: true, revision: 1, checked_at: '2026-11-20T09:00:00Z' };
  await page.clock.fastForward(8100);
  await expect(page.locator('[data-check="1"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#embarque-close').click();
  await page.clock.fastForward(350);
  api.manifest.people[0].outbound = { present: false, revision: 2, checked_at: null };
  await page.clock.fastForward(8100);
  await expect(page.locator('[data-check="1"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#embarque-open').click();
  await expect(page.locator('[data-check="1"]')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#embarque-close').click();
  await page.clock.fastForward(350);
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(page.locator('#embarque-list')).toBeEmpty();
});

test('dicionários têm as mesmas chaves e parâmetros em pt/en/es', () => {
  const sandbox = { window: {} };
  vm.runInNewContext(readFileSync('assets/js/painel-embarque-i18n.js', 'utf8'), sandbox);
  const messages = sandbox.window.KobBoardingMessages;
  const params = text => [...text.matchAll(/\{\w+\}/g)].map(match => match[0]).sort();
  for (const lang of ['en', 'es']) {
    expect(Object.keys(messages[lang]).sort()).toEqual(Object.keys(messages.pt).sort());
    for (const key of Object.keys(messages.pt)) expect(params(messages[lang][key])).toEqual(params(messages.pt[key]));
  }
});

for (const [lang, title, save] of [ ['pt', 'Chamada de embarque', 'Confirmar embarque de Ana de Souza'], ['en', 'Boarding roll call', 'Check in Ana de Souza'], ['es', 'Control de embarque', 'Confirmar embarque de Ana de Souza'] ]) {
  test(`chamada acessível em ${lang}, teclado e tela pequena @smoke`, async ({ page, context }) => {
    await mockPanel(context);
    await page.setViewportSize({ width: lang === 'pt' ? 390 : 320, height: 844 });
    await gotoBoarding(page, `/painel-onibus.html?lang=${lang}`);
    await expect(page.locator('#embarque-sidebar h2')).toHaveText(title);
    await expect(page.locator('[data-check="1"]')).toHaveAttribute('aria-label', save + ' · ' + { pt: 'Ida', en: 'Outbound', es: 'Ida' }[lang]);
    await expect(page.locator('#embarque-sync')).toHaveCSS('text-align', 'right');
    await expect(page.locator('#embarque-sync')).not.toContainText('·');
    await expect(page.locator('#embarque-language, #embarque-pdf')).toHaveCount(0);
    const refresh = page.locator('#embarque-update');
    const refreshLabel = { pt: 'Atualizar', en: 'Refresh', es: 'Actualizar' }[lang];
    await expect(refresh).toHaveAttribute('aria-label', refreshLabel);
    await expect(refresh).toHaveAttribute('title', refreshLabel);
    await expect(refresh.locator('svg')).toHaveCount(1);
    await expect(page.locator('.embarque-header [data-leg] svg')).toHaveCount(2);
    const busSelect = page.locator('#embarque-buses');
    await expect(busSelect).toHaveCSS('font-size', lang === 'pt' ? '13px' : '12px');
    await expect(busSelect.locator('option').first()).toHaveCSS('font-size', '18px');
    expect(await busSelect.evaluate(el => el.offsetHeight)).toBe(await page.locator('.embarque-trip .embarque-segment').evaluate(el => el.offsetHeight));
    if (lang === 'es') {
      const allBuses = busSelect.locator('option[value="all"]');
      await expect(allBuses).toHaveAttribute('label', 'Todos');
      await expect(allBuses).toHaveAttribute('aria-label', 'Todos los autobuses');
      await expect(busSelect).toHaveAttribute('title', 'Todos los autobuses');
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(allBuses).toHaveAttribute('label', 'Todos los autobuses');
      await page.setViewportSize({ width: 320, height: 844 });
      await expect(allBuses).toHaveAttribute('label', 'Todos');
      await expect(busSelect).toHaveValue('all');
    }
    await page.locator('[data-leg="return"]').click();
    await expect(page.locator('#embarque-progress-outbound-label')).toHaveText({ pt: 'Ida: 0/3', en: 'Outbound: 0/3', es: 'Ida: 0/3' }[lang]);
    await expect(page.locator('#embarque-progress-return-label')).toHaveText({ pt: 'Volta: 0/3', en: 'Return: 0/3', es: 'Vuelta: 0/3' }[lang]);
    await page.locator('[data-leg="outbound"]').click();
    await expect(page.locator('.embarque-header [data-leg="outbound"]')).toContainText({ pt: 'Ida', en: 'Outbound', es: 'Ida' }[lang]);
    const positions = await page.locator('.embarque-header').evaluate(header => {
      const button = header.querySelector('#embarque-update').getBoundingClientRect();
      const close = header.querySelector('#embarque-close').getBoundingClientRect();
      const rect = header.getBoundingClientRect();
      const bus = header.querySelector('#embarque-buses').getBoundingClientRect();
      const legs = header.querySelector('.embarque-segment').getBoundingClientRect();
      return { aligned: button.y === close.y, busRight: bus.left >= legs.right, inside: button.right <= rect.right && button.left >= rect.left,
        noOverflow: header.scrollWidth <= header.clientWidth };
    });
    expect(positions).toEqual({ aligned: true, busRight: true, inside: true, noOverflow: true });
    await page.locator('#embarque-close').focus();
    await page.keyboard.press('Escape');
    await expect(page.locator('#embarque-sidebar')).not.toBeVisible();
    await expect(page.locator('#embarque-open')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#embarque-sidebar')).toBeVisible();
    await expect(page.locator('#embarque-close')).toBeFocused();
    await expect.poll(async () => Math.abs((await page.locator('#embarque-sidebar').boundingBox()).y)).toBeLessThan(.5);
    const dimensions = await page.locator('[data-check="1"]').boundingBox();
    expect(dimensions.height).toBeGreaterThanOrEqual(48);
    const overflow = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth, viewport: innerWidth,
      elements: Array.from(document.querySelectorAll('body *')).filter(node => {
        const rect = node.getBoundingClientRect(); return rect.width > 0 && rect.right > innerWidth + .5;
      }).slice(0, 12).map(node => ({ tag: node.tagName, id: node.id, class: node.className.baseVal || node.className,
        right: node.getBoundingClientRect().right, width: node.getBoundingClientRect().width }))
    }));
    expect(overflow.width, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.viewport);
  });
}

test('filtro de reservas não amplia a página em 320 px com opções longas @smoke', async ({ page, context }) => {
  await mockPanel(context);
  await page.setViewportSize({ width: 320, height: 844 });
  await gotoBoarding(page, '/painel-onibus.html?lang=en');
  await expect(page.locator('#embarque-expected')).toHaveText('3');
  await page.locator('#embarque-close').click();
  await expect(page.locator('#embarque-sidebar')).not.toBeVisible();
  await page.locator('#filtro-onibus').evaluate(select => {
    const option = document.createElement('option');
    option.value = 'fixture'; option.textContent = 'Ônibus 1234 · 999 passageiros para conferir';
    select.appendChild(option);
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  expect((await page.locator('.filtro-onibus').boundingBox()).width).toBeLessThanOrEqual(288);
  await page.locator('#filtro-onibus').selectOption('fixture');
  await expect(page.locator('#filtro-onibus')).toHaveValue('fixture');
});

test('lista vazia orienta a alocação sem controles de presença', async ({ page, context }) => {
  await mockPanel(context, { people: [], waiting: 0 });
  await gotoBoarding(page, '/painel-onibus.html');
  await expect(page.locator('#embarque-empty')).toContainText('Nenhum passageiro com ônibus confirmado');
  await expect(page.locator('[data-check]')).toHaveCount(0);
  await expect(page.locator('#embarque-expected')).toHaveText('0');
});

test('VIPs de reservas diferentes ficam juntos por ônibus e mantêm check individual @smoke', async ({ page, context }) => {
  const data = fixture();
  for (const [id, bus, vip] of [['4', 2, true], ['5', 1, true], ['6', 2, false]]) {
    data.people.push({ id, registration_id: `reserva-${id}`, code: `CODIGO0${id}`, name: `Pessoa Teste ${id}`, group: null,
      bus_number: bus, vip, outbound: emptyState(), return: emptyState() });
  }
  const api = await mockPanel(context, data);
  await gotoBoarding(page, '/painel-onibus.html');
  await expect(page.locator('[data-vip-group]')).toHaveCount(2);
  await expect(page.locator('[data-vip-group="2"] .embarque-person')).toHaveCount(2);
  await expect(page.locator('[data-vip-group="1"] .embarque-person')).toHaveCount(1);
  await expect(page.locator('[data-vip-group="2"]')).toContainText('Reserva CODIGO04');
  await page.locator('[data-check="4"]').click();
  await expect(page.locator('[data-vip-group="2"] .embarque-group__count')).toHaveText('1 de 2 a bordo');
  await expect(page.locator('[data-check="3"]')).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => api.writes.length).toBe(1);
  expect(api.writes[0].body.passenger_id).toBe('4');
  await page.locator('#embarque-search').fill('vip');
  await expect(page.locator('.embarque-person')).toHaveCount(3);
  await page.locator('#embarque-search').fill('CODIGO04');
  await expect(page.locator('.embarque-person')).toHaveCount(1);
  await expect(page.locator('[data-vip-group="2"] .embarque-group__count')).toHaveText('1 de 2 a bordo');
});

test('slider mantém foco, fecha por backdrop e não reabre em atualização das reservas @smoke', async ({ page, context }) => {
  await mockPanel(context);
  await gotoBoarding(page, '/painel-onibus.html');
  const drawer = page.locator('#embarque-sidebar');
  await expect(drawer).toHaveClass(/is-open/);
  await expect(page.locator('[data-check="3"]')).toBeVisible();
  await expect(page.locator('.embarque-header')).toHaveCSS('background-color', 'rgb(4, 29, 58)');
  await expect(page.locator('.embarque-mascot')).toHaveAttribute('src', 'assets/images/manual/kriativa-checklist.png');
  for (const id of ['#embarque-update', '#embarque-close']) {
    await expect(page.locator(id)).toHaveCSS('background-color', 'rgb(22, 59, 96)');
    await expect(page.locator(id)).toHaveCSS('color', 'rgb(255, 255, 255)');
    await page.locator(id).hover();
    await expect(page.locator(id)).toHaveCSS('background-color', 'rgb(40, 86, 125)');
  }
  await page.locator('#embarque-offline-toggle').focus();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#embarque-export-toggle')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#embarque-offline-toggle')).toBeFocused();
  await openExport(page);
  await page.locator('#embarque-offline-toggle').focus();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('[data-boarding-export="pdf"]')).toBeFocused();
  await page.mouse.click(900, 400);
  await expect(drawer).not.toBeVisible();
  await expect(page.locator('#embarque-open')).toBeFocused();
  await page.locator('#recarregar').click();
  await expect(page.locator('#recarregar')).not.toHaveAttribute('aria-busy', 'true');
  await expect(drawer).not.toBeVisible();
  await page.locator('#embarque-open').click();
  await expect(drawer).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(drawer).not.toBeVisible();
  await expect(drawer).toHaveAttribute('aria-hidden', 'true');
  await expect(drawer).toHaveAttribute('inert', '');
});


test('presença usa tabs com setas e ônibus fica no select do cabeçalho @smoke', async ({ page, context }) => {
  const data = fixture();
  data.people[0].outbound = { present: true, revision: 1, checked_at: '2026-10-15T10:00:00Z' };
  await mockPanel(context, data);
  await page.setViewportSize({ width: 320, height: 740 });
  await gotoBoarding(page, '/painel-onibus.html');
  const tabs = page.locator('#embarque-filters');
  await expect(tabs).toHaveAttribute('role', 'tablist');
  const all = tabs.getByRole('tab', { name: 'Todos', exact: true });
  await expect(all).toHaveAttribute('aria-selected', 'true');
  await expect(all).toHaveCSS('border-radius', '0px');
  await all.focus();
  await page.keyboard.press('ArrowRight');
  const missing = tabs.locator('[data-presence="missing"]');
  await expect(missing).toBeFocused();
  await expect(missing).toHaveAttribute('aria-selected', 'true');
  await expect(all).toHaveAttribute('tabindex', '-1');
  await expect(page.locator('#embarque-results')).toHaveAttribute('aria-labelledby', 'embarque-presence-missing');
  await expect(page.locator('.embarque-person')).toHaveCount(2);
  await expect(page.locator('#embarque-expected')).toHaveText('3');
  await page.keyboard.press('End');
  await expect(tabs.locator('[data-presence="present"]')).toBeFocused();
  await expect(page.locator('.embarque-person')).toHaveCount(1);
  await page.keyboard.press('ArrowRight');
  await expect(all).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(tabs.locator('[data-presence="present"]')).toBeFocused();
  await page.keyboard.press('Home');
  await expect(all).toBeFocused();
  const bus = page.locator('.embarque-header #embarque-buses');
  await expect(bus).toHaveAttribute('aria-label', 'Filtrar por ônibus');
  await bus.selectOption('2');
  await expect(bus).toHaveValue('2');
  await expect(page.locator('#embarque-expected')).toHaveText('1');
  await expect(page.locator('.embarque-person')).toHaveCount(1);
  const refresh = page.locator('#embarque-update');
  // Measure fixed controls after the drawer's entrance has settled.
  await expect.poll(async () => (await page.locator('#embarque-sidebar').boundingBox()).y).toBeLessThan(.01);
  const before = await bus.boundingBox();
  await page.locator('#embarque-scroll').evaluate(el => { el.scrollTop = el.scrollHeight; });
  const after = await bus.boundingBox();
  expect(after.y).toBeCloseTo(before.y, 1);
  await expect(page.locator('.embarque-header [data-leg="return"]')).toBeInViewport();
  await refresh.click();
  await expect(refresh).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#embarque-sync')).toContainText('Sincronizado');
});

test('barra compara ida e volta nos dois trechos, preservando ambos por ônibus @smoke', async ({ page, context }) => {
  const data = fixture();
  for (const person of data.people.filter(person => ['1', '3'].includes(person.id))) {
    person.outbound = { present: true, checked_at: '2026-10-15T10:00:00Z', revision: 1 };
  }
  await mockPanel(context, data);
  await gotoBoarding(page, '/painel-onibus.html');
  const current = page.locator('#embarque-progress');
  const outbound = page.locator('#embarque-progress-outbound');
  await expect(current).toHaveJSProperty('value', 0);
  await expect(current).toHaveJSProperty('max', 3);
  await expect(outbound).toHaveJSProperty('value', 2);
  await expect(outbound).toBeVisible();
  await expect(page.locator('#embarque-progress-legend')).toBeVisible();
  await expect(page.locator('#embarque-progress-text')).toHaveText('2 de 3 a bordo');
  await page.locator('[data-leg="return"]').click();
  await expect(current).toHaveJSProperty('value', 0);
  await expect(outbound).toBeVisible();
  await expect(outbound).toHaveJSProperty('value', 2);
  await expect(outbound).toHaveAttribute('aria-label', 'Ida: 2 de 3 a bordo');
  await expect(current).toHaveAttribute('aria-label', 'Volta: 0 de 3 a bordo');
  await expect(page.locator('#embarque-progress-outbound-label')).toHaveText('Ida: 2/3');
  await expect(page.locator('#embarque-progress-return-label')).toHaveText('Volta: 0/3');
  await page.locator('[data-check="1"]').click();
  await expect(current).toHaveJSProperty('value', 1);
  await expect(outbound).toHaveJSProperty('value', 2);
  await page.locator('#embarque-buses').selectOption('1');
  await expect(current).toHaveJSProperty('value', 1);
  await expect(outbound).toHaveJSProperty('value', 1);
  await expect(outbound).toHaveJSProperty('max', 2);
  await page.locator('[data-check="2"]').click();
  await expect(current).toHaveJSProperty('value', 2);
  await expect(outbound).toHaveJSProperty('value', 1);
  await expect(page.locator('#embarque-progress-return-label')).toHaveText('Volta: 2/2');
  const layers = await page.locator('#embarque-progress-track').evaluate(track => {
    const base = track.querySelector('#embarque-progress-outbound');
    const top = track.querySelector('#embarque-progress');
    const a=base.getBoundingClientRect(), b=top.getBoundingClientRect();
    return { sameWidth: a.width === b.width, overBase: b.y > a.y && b.bottom < a.bottom,
      baseColor:getComputedStyle(base).getPropertyValue('--embarque-fill').trim(),
      topColor:getComputedStyle(top).getPropertyValue('--embarque-fill').trim() };
  });
  expect(layers.sameWidth && layers.overBase).toBe(true);
  expect(layers.baseColor).not.toBe(layers.topColor);
  await page.locator('[data-leg="outbound"]').click();
  await expect(current).toHaveJSProperty('value', 2);
  await expect(outbound).toHaveJSProperty('value', 1);
  await expect(outbound).toBeVisible();
  await expect(page.locator('#embarque-progress-legend')).toBeVisible();
  await expect(page.locator('#embarque-progress-text')).toHaveText('1 de 2 a bordo');
  await page.reload();
  await page.locator('#embarque-open').click();
  await expect(current).toHaveJSProperty('value', 2);
  await page.locator('[data-leg="return"]').click();
  await expect(current).toHaveJSProperty('value', 2);
  await expect(outbound).toHaveJSProperty('value', 2);
});


test('linha aciona só o trecho ativo, com dois checks grandes e o outro esmaecido @smoke', async ({ page, context }) => {
  const api = await mockPanel(context, fixture(), { readDelay: 50 });
  await gotoBoarding(page, '/painel-onibus.html');
  const row = page.locator('[data-person="1"]');
  const outbound = row.locator('[data-check-leg="outbound"]');
  const back = row.locator('[data-check-leg="return"]');
  await expect(row.locator('.embarque-check')).toHaveCount(2);
  await expect(outbound).toBeEnabled();
  await expect(back).toBeDisabled();
  // The slider translation can introduce tiny float errors in boundingBox dimensions.
  const box = await outbound.evaluate(node => ({ width: node.offsetWidth, height: node.offsetHeight }));
  expect(box.width).toBeGreaterThanOrEqual(60);
  expect(box.height).toBeGreaterThanOrEqual(80);
  const icon = await outbound.locator('svg').evaluate(node => ({ width: node.clientWidth }));
  expect(icon.width).toBeGreaterThanOrEqual(40);
  await row.locator('strong').click();
  await expect(outbound).toHaveAttribute('aria-pressed', 'true');
  await expect(back).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => api.writes.length).toBe(1);
  expect(api.writes[0].body.leg).toBe('outbound');
  await page.locator('[data-leg="return"]').click();
  await expect(outbound).toBeDisabled();
  await expect(back).toBeEnabled();
  const opacities = await row.locator('.embarque-check').evaluateAll(nodes => nodes.map(node => Number(getComputedStyle(node).opacity)));
  expect(opacities[0]).toBeLessThan(opacities[1]);
  const inactive = await outbound.boundingBox();
  await page.mouse.click(inactive.x + inactive.width / 2, inactive.y + inactive.height / 2);
  expect(api.writes).toHaveLength(1);
  await row.locator('strong').click();
  await expect(back).toHaveAttribute('aria-pressed', 'true');
  await expect(outbound).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => api.writes.length).toBe(2);
  expect(api.writes[1].body.leg).toBe('return');
  await back.click();
  await expect(back).toHaveAttribute('aria-pressed', 'false');
  await expect(outbound).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => api.writes.length).toBe(3);
  await page.locator('[data-leg="outbound"]').click();
  await expect(outbound).toBeEnabled();
  await expect(back).toBeDisabled();
  await expect(outbound).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#embarque-progress-outbound')).toHaveJSProperty('value', 1);
  await expect(page.locator('#embarque-progress')).toHaveJSProperty('value', 0);
});

test('trocar trecho durante gravação mantém o resultado no check correto @smoke', async ({ page, context }) => {
  let release;
  const wait = new Promise(resolve => { release = resolve; });
  const api = await mockPanel(context, fixture(), { delay: () => wait });
  await gotoBoarding(page, '/painel-onibus.html');
  await page.locator('[data-person="1"] strong').click();
  await expect(page.locator('[data-person="1"] [data-check-leg="outbound"]')).toHaveAttribute('aria-busy', 'true');
  await page.locator('[data-leg="return"]').click();
  const back = page.locator('[data-person="1"] [data-check-leg="return"]');
  await expect(back).toBeEnabled();
  await back.focus();
  release();
  await expect(page.locator('[data-person="1"] [data-check-leg="outbound"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(back).toHaveAttribute('aria-pressed', 'false');
  await expect(back).toBeFocused();
  await expect(page.locator('#embarque-present')).toHaveText('0');
  await expect(page.locator('#embarque-announcement')).toContainText('Ida');
  expect(api.writes).toHaveLength(1);
});

test('rodapé exporta todos os ônibus apesar de busca e filtros e permanece fixo @smoke', async ({ page, context }) => {
  await mockPanel(context);
  await page.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => { window.copiedBoarding = text; } } }); });
  await page.setViewportSize({ width: 320, height: 740 });
  await gotoBoarding(page, '/painel-onibus.html');
  await page.locator('[data-check="1"]').click();
  await page.locator('#embarque-buses').selectOption('1');
  await page.locator('[data-presence="missing"]').click();
  await page.locator('#embarque-search').fill('José');
  const footer = page.locator('#embarque-export');
  await expect(footer).not.toContainText('Todos os ônibus · Ida e Volta');
  await expect(page.locator('#embarque-export-toggle')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#embarque-export-controls')).toHaveAttribute('inert', '');
  await openExport(page);
  await page.locator('[data-boarding-export="copy"]').click();
  const output = await page.evaluate(() => window.copiedBoarding);
  expect(output).toContain('Ana de Souza'); expect(output).toContain('José de Souza'); expect(output).toContain('Maria Oliveira');
  expect(output).toContain('[x] Ida · [ ] Volta | Ana de Souza');
  expect(output).not.toContain('111.111.111-11'); expect(output).not.toContain('dev-token');
  await expect(page.locator('#embarque-export-status')).toContainText('copiada');
  const before = await footer.boundingBox();
  await page.locator('#embarque-scroll').evaluate(el => { el.scrollTop = el.scrollHeight; });
  const after = await footer.boundingBox();
  expect(after.y).toBeCloseTo(before.y, 1);
  expect(after.y + after.height).toBeLessThanOrEqual(740);
  for (const button of await footer.locator('[data-boarding-export]').all()) {
    const rect = await button.boundingBox(); expect(rect.width).toBeGreaterThanOrEqual(44); expect(rect.height).toBeGreaterThanOrEqual(44);
  }
});

test('e-mail abre rascunho adaptado sem enviar @smoke', async ({ page, context }) => {
  await mockPanel(context);
  await page.addInitScript(() => {
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { if (this.href.startsWith('mailto:')) window.boardingMail = this.href; else click.call(this); };
  });
  await gotoBoarding(page, '/painel-onibus.html?lang=es');
  await expect(page.locator('[data-boarding-export="email"]')).toHaveText('Correo');
  await openExport(page);
  await page.locator('[data-boarding-export="email"]').click();
  const mail = new URL(await page.evaluate(() => window.boardingMail));
  expect(mail.searchParams.get('subject')).toContain('Control de embarque');
  expect(mail.searchParams.get('body')).toContain('Hola,');
  expect(mail.searchParams.get('body')).toContain('Ida: Pendiente · Vuelta: Pendiente');

});

test('PDF baixa por header autenticado com todos os ônibus e mostra erros @smoke', async ({ page, context }) => {
  await mockPanel(context);
  let pdfRequest, fail = true;
  await context.route('**/api/bus-boarding?format=pdf&lang=en', route => {
    pdfRequest = route.request();
    return fail ? route.fulfill({ status: 503, json: { error: 'boarding_unavailable' } })
      : route.fulfill({ contentType: 'application/pdf', body: '%PDF-1.4\nPDF TEST\n%%EOF' });
  });
  await gotoBoarding(page, '/painel-onibus.html?lang=en');
  await page.locator('#embarque-buses').selectOption('1');
  await openExport(page);
  await page.locator('[data-boarding-export="pdf"]').click();
  await expect(page.locator('#embarque-export-status')).toHaveText('Could not generate the PDF. Try again.');
  fail = false;
  await openExport(page);
  const download = page.waitForEvent('download');
  await page.locator('[data-boarding-export="pdf"]').click();
  expect((await download).suggestedFilename()).toBe('chamada-embarque-kob2026.pdf');
  await expect(page.locator('#embarque-export-status')).toHaveText('A4 PDF downloaded.');
  expect(pdfRequest.headers()['x-admin-token']).toBe('dev-token');
  expect(pdfRequest.url()).not.toContain('token='); expect(pdfRequest.url()).not.toContain('bus=');
  await context.setOffline(true);
  await expect(page.locator('[data-boarding-export="pdf"]')).toBeDisabled();
  await expect(page.locator('[data-boarding-export="email"]')).toHaveAttribute('aria-disabled', 'true');
});

test('clipboard sem permissão oferece texto completo e limpa dados ao sair', async ({ page, context }) => {
  await mockPanel(context);
  await page.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('denied'); } } }); });
  await gotoBoarding(page, '/painel-onibus.html');
  await openExport(page);
  await page.locator('[data-boarding-export="copy"]').click();
  const area = page.locator('#embarque-export-text');
  await expect(area).toBeFocused(); await expect(area).toHaveValue(/Ana de Souza/);
  await expect(area).toHaveValue(/Maria Oliveira/);
  await page.locator('#embarque-export-dismiss').click();
  await expect(page.locator('[data-boarding-export="copy"]')).toBeFocused();
  await expect(area).toHaveValue('');
  await page.locator('#embarque-close').click();
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(area).toHaveValue('');
});

test('listas extensas preservam todos no rascunho EML', async ({ page, context }) => {
  const data = fixture();
  for (let id = 4; id <= 100; id++) data.people.push({ ...data.people[0], id: String(id), name: `Passageiro de teste ${id}`, code: `COD${id}` });
  await mockPanel(context, data);
  await gotoBoarding(page, '/painel-onibus.html');
  await openExport(page);
  const download = page.waitForEvent('download');
  await page.locator('[data-boarding-export="email"]').click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('chamada-embarque-kob2026.eml');
  const eml = readFileSync(await file.path(), 'utf8');
  expect(eml).toContain('X-Unsent: 1');
  const message = Buffer.from(eml.split('\r\n\r\n')[1].replace(/\s/g, ''), 'base64').toString('utf8');
  expect(message).toContain('Passageiro de teste 100');

});

test('menu de ônibus compacto tem opções grandes, teclado e Escape próprio @smoke', async ({ page, context }) => {
  await mockPanel(context);
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoBoarding(page, '/painel-onibus.html');
  const picker = page.getByRole('combobox', { name: 'Filtrar por ônibus', exact: true });
  const box = await picker.boundingBox();
  expect(box.height).toBe(await page.locator('.embarque-trip .embarque-segment').evaluate(el => el.offsetHeight));
  await picker.click();
  const options = page.getByRole('listbox').getByRole('option');
  await expect(options).toHaveCount(3);
  await expect(options.first()).toHaveCSS('font-size', '18px');
  expect((await options.first().boundingBox()).height).toBeGreaterThanOrEqual(56);
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await expect(page.locator('#embarque-buses')).toHaveValue('1');
  await expect(picker).toHaveText('Ônibus 1');
  await expect(picker).toBeFocused();
  await picker.press('Space'); await picker.press('End'); await picker.press('Escape');
  await expect(picker).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#embarque-sidebar')).toBeVisible();
  await expect(page.locator('#embarque-buses')).toHaveValue('1');
  await picker.click(); await options.getByText('Ônibus 2', { exact: true }).click();
  await expect(page.locator('#embarque-buses')).toHaveValue('2');
  await expect(page.locator('#embarque-expected')).toHaveText('1');
});

test('solo agrupa por ônibus sem converter grupos filtrados e usa os meeples da frota @smoke', async ({ page, context }) => {
  const data = fixture();
  for (const [id, bus] of [['4', 1], ['5', 1], ['6', 2]]) data.people.push({ ...data.people[0], id, bus_number: bus, registration_id: `solo-${id}`, code: `SOLO${id}`, name: `Solo ${id}`, group: null });
  await mockPanel(context, data);
  await gotoBoarding(page, '/painel-onibus.html');
  const solo = page.locator('[data-solo-group="1"]');
  await expect(solo.getByRole('heading', { name: 'Reservas solo' })).toBeVisible();
  await expect(solo.locator('[data-person]')).toHaveCount(2);
  await expect(solo.locator('[data-person="4"]')).toContainText('SOLO4');
  await expect(solo.locator('[data-person="5"]')).toContainText('SOLO5');
  await solo.locator('[data-person="4"] strong').click();
  await expect(solo.locator('[data-check="4"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(solo.locator('[data-check="5"]')).toHaveAttribute('aria-pressed', 'false');
  const shapes = page.locator('.embarque-group__meeple');
  for (const shape of await shapes.all()) await expect(shape.locator('path')).toHaveAttribute('d', await page.locator('.bus-dialog__badge-icone--vip svg path').getAttribute('d'));
  await expect(page.locator('.embarque-group__meeple--vip').first()).toHaveCSS('color', 'rgb(217, 119, 6)');
  await expect(page.locator('.embarque-group__meeple--solo').first()).toHaveCSS('color', 'rgb(0, 119, 182)');
  await expect(page.locator('.embarque-group__meeple--group').first()).toHaveCSS('color', 'rgb(123, 31, 162)');
  await page.locator('#embarque-search').fill('José');
  await expect(page.locator('[data-solo-group]')).toHaveCount(0);
  await expect(page.locator('.embarque-group h4')).toHaveText('Tripulação dos Dados');
});

test('Excel substitui WhatsApp e baixa XLSX com os dois trechos e todos os ônibus @smoke', async ({ page, context }) => {
  await mockPanel(context);
  let request;
  await context.route('**/api/bus-boarding?format=xlsx&lang=pt', route => {
    request = route.request();
    return route.fulfill({ contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', body: 'PK XLSX TEST' });
  });
  await gotoBoarding(page, '/painel-onibus.html');
  await expect(page.locator('[data-boarding-export="whatsapp"]')).toHaveCount(0);
  await page.locator('#embarque-buses').selectOption('2');
  await openExport(page);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Excel', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('chamada-embarque-kob2026.xlsx');
  await expect(page.locator('#embarque-export-status')).toHaveText('Arquivo Excel baixado.');
  expect(request.headers()['x-admin-token']).toBe('dev-token');
  expect(request.url()).not.toContain('token='); expect(request.url()).not.toContain('bus=');
});

test('exportação mostra loading central, confirma e permite fechar o aviso @smoke', async ({ page, context }) => {
  await mockPanel(context);
  let release;
  const wait = new Promise(resolve => { release = resolve; });
  await context.route('**/api/bus-boarding?format=pdf&lang=pt', async route => {
    await wait;
    return route.fulfill({ contentType: 'application/pdf', body: '%PDF-1.4\nPDF TEST\n%%EOF' });
  });
  await gotoBoarding(page, '/painel-onibus.html');
  const pdf = page.locator('[data-boarding-export="pdf"]');
  await openExport(page);
  await pdf.click();
  const feedback = page.locator('#embarque-export-feedback');
  await expect(feedback).toHaveAttribute('data-state', 'loading');
  await expect(feedback).toHaveAttribute('aria-busy', 'true');
  await expect(feedback.locator('.embarque-export-feedback__loading')).toHaveCSS('animation-name', 'embarque-spin');
  await expect.poll(async () => Math.abs((await page.locator('#embarque-sidebar').boundingBox()).x)).toBeLessThan(.5);
  const card = await page.locator('.embarque-export-feedback__card').boundingBox();
  const panel = await page.locator('#embarque-sidebar').boundingBox();
  expect(card.x + card.width / 2).toBeCloseTo(panel.x + panel.width / 2, 0);
  expect(card.y + card.height / 2).toBeCloseTo(panel.y + panel.height / 2, 0);
  await expect(page.locator('[data-boarding-export="excel"]')).toBeDisabled();
  const download = page.waitForEvent('download'); release(); await download;
  await expect(feedback).toHaveAttribute('data-state', 'success');
  await expect(feedback).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('button', { name: 'Fechar aviso', exact: true }).click();
  await expect(feedback).not.toBeVisible();
  await expect(pdf).toBeFocused();
});

for (const [lang, lead] of [['pt', 'Responsável: Ana de Souza'], ['en', 'Group lead: Ana de Souza'], ['es', 'Responsable: Ana de Souza']]) {
  test(`responsável aparece só no cabeçalho de grupos em ${lang} @smoke`, async ({ page, context }) => {
    const data = fixture();
    data.people.push({ ...data.people[0], id: '4', registration_id: 'solo', code: 'SOLO0001', name: 'Solo Teste', contact: 'Solo Teste', group: null });
    await mockPanel(context, data);
    await gotoBoarding(page, '/painel-onibus.html?lang=' + lang);
    const heading = page.locator('.embarque-group__header').filter({ hasText: 'Tripulação dos Dados' });
    await expect(heading.locator('.embarque-group__primary')).toHaveText(lead);
    await expect(heading).toContainText('GRUPOAAA');
    expect(await heading.evaluate(node => node.querySelector('.embarque-group__primary').nextElementSibling.textContent)).toContain('GRUPOAAA');
    await expect(page.locator('.embarque-person__meta')).not.toContainText([lead.split(':')[0]]);
    await expect(page.locator('[data-vip-group] .embarque-group__primary, [data-solo-group] .embarque-group__primary')).toHaveCount(0);
    const child = page.locator('[data-person="2"] strong .meeple-svg--child');
    await expect(child).toHaveCount(1);
    await expect(child).toHaveAttribute('aria-hidden', 'true');
    await expect(child).toHaveCSS('color', 'rgb(236, 72, 153)');
    await expect(child).toHaveAttribute('width', '14');
    expect(await child.locator('path').getAttribute('d')).toBe(await page.locator('.bus-dialog__badge-icone--vip path').first().getAttribute('d'));
    await expect(page.locator('[data-person="1"] .meeple-svg--child')).toHaveCount(0);
    await page.locator('#embarque-search').fill('José');
    await expect(heading.locator('.embarque-group__primary')).toHaveText(lead);
  });
}

test('atualizar gira durante a leitura e ao concluir, respeitando movimento reduzido @smoke', async ({ page, context }) => {
  const api = await mockPanel(context);
  let release, delay = false;
  await context.route('**/api/bus-boarding', async route => {
    if (!delay || route.request().method() !== 'GET') return route.fallback();
    await new Promise(resolve => { release = resolve; });
    return route.fulfill({ json: api.manifest });
  });
  await gotoBoarding(page, '/painel-onibus.html');
  const refresh = page.locator('#embarque-update');
  await expect(refresh).toHaveAttribute('aria-busy', 'false');
  delay = true; await refresh.click();
  await expect(refresh).toHaveAttribute('aria-busy', 'true');
  await expect(refresh.locator('svg')).toHaveCSS('animation-name', 'embarque-spin');
  await expect.poll(() => typeof release).toBe('function');
  release();
  await expect(refresh).toHaveAttribute('aria-busy', 'false');
  await expect(refresh.locator('svg')).toHaveCSS('animation-name', 'none');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  release = null;
  await refresh.click();
  await expect(refresh).toHaveAttribute('aria-busy', 'true');
  await expect(refresh.locator('svg')).toHaveCSS('animation-name', 'none');
  await expect.poll(() => typeof release).toBe('function');
  release();
  await expect(refresh).toHaveAttribute('aria-busy', 'false');
});

test('rodapé Exportar recolhe e sobe os botões e Ida, Volta e ônibus dividem 25/25/50 @smoke', async ({ page, context }) => {
  await mockPanel(context);
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoBoarding(page, '/painel-onibus.html');
  await expect.poll(async () => Math.abs((await page.locator('#embarque-sidebar').boundingBox()).x)).toBeLessThan(.5);
  const trip = await page.locator('.embarque-trip').boundingBox();
  const outbound = await page.locator('.embarque-trip [data-leg="outbound"]').boundingBox();
  const back = await page.locator('.embarque-trip [data-leg="return"]').boundingBox();
  const bus = await page.locator('#embarque-bus-trigger').boundingBox();
  expect(Math.abs(outbound.width - back.width)).toBeLessThan(1);
  // Cada metade desconta metade do gap de 8px entre segmento e seletor.
  expect(Math.abs(bus.width - (trip.width / 2 - 4))).toBeLessThan(1);
  expect(outbound.width).toBeLessThan(trip.width / 4);
  expect(outbound.width).toBeGreaterThan(trip.width / 4 - 12);

  const toggle = page.locator('#embarque-export-toggle');
  const controls = page.locator('#embarque-export-controls');
  await expect(toggle).toHaveAccessibleName('Exportar');
  await expect(page.locator('#embarque-export')).not.toContainText('Todos os ônibus');
  await expect(controls).toHaveAttribute('inert', '');
  expect((await controls.boundingBox())?.height ?? 0).toBeLessThan(1);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#embarque-export')).toHaveClass(/is-open/);
  await expect.poll(async () => (await controls.boundingBox()).height).toBeGreaterThan(59);
  for (const button of await controls.locator('[data-boarding-export]').all()) {
    const rect = await button.boundingBox(); expect(rect.height).toBeGreaterThanOrEqual(44);
    expect(rect.y + rect.height).toBeLessThanOrEqual(844);
  }
  await toggle.click();
  await expect(controls).toHaveAttribute('inert', '');
});

test('acesso offline vira ícone no cabeçalho com menu curto e Escape próprio @smoke', async ({ page, context }) => {
  await mockPanel(context);
  await gotoBoarding(page, '/painel-onibus.html');
  const toggle = page.locator('.embarque-header__actions #embarque-offline-toggle');
  await expect(toggle).toHaveAttribute('aria-label', 'Acesso offline');
  await expect(page.locator('#embarque-scroll .embarque-offline')).toHaveCount(0);
  await expect(page.locator('#embarque-offline-link')).toHaveCount(0);
  await expect(page.getByText('Adicione à tela inicial')).toHaveCount(0);
  const menu = page.locator('#embarque-offline-menu');
  await expect(menu).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(menu).toBeVisible();
  await expect(menu.locator('#embarque-prepare')).toHaveText('Preparar');
  expect((await menu.innerText()).length).toBeLessThan(120);
  await toggle.press('Escape');
  await expect(menu).toBeHidden();
  await expect(toggle).toBeFocused();
  await expect(page.locator('#embarque-sidebar')).toBeVisible();
  await toggle.click();
  await page.locator('#embarque-search').click();
  await expect(menu).toBeHidden();
});
