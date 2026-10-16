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
async function mockPanel(context, manifest = fixture(), options = {}) {
  const writes = [];
  await context.route('**/api/bus-admin-data*', route => route.fulfill({ json: { reservas: [], resumo: {}, frota: { capacidade: 46, minimo: 40, onibus: [] } } }));
  await context.route('**/api/bus-admin-reconcile*', route => route.fulfill({ json: { updated: 0 } }));
  await context.route('**/api/bus-boarding', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: manifest });
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

test('embarque abre como slider padrão e salva presença por passageiro e trecho @smoke', async ({ page, context }) => {
  const api = await mockPanel(context);
  await page.goto('/painel-onibus.html');
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
  expect(api.writes[0].body).toEqual({ passenger_id: '1', leg: 'outbound', present: true, expected_revision: 0, bus_number: 1 });
  expect(api.writes[0].headers['x-admin-token']).toBe('dev-token');
  expect(api.writes[0].url).not.toContain('token=');
  await page.locator('[data-leg="return"]').click();
  await expect(ana).toHaveAttribute('aria-pressed', 'false');
  await ana.click();
  await expect(ana).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(ana).toHaveAttribute('aria-pressed', 'true');
  await ana.click();
  await expect(ana).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#embarque-present')).toHaveText('0');
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual(['kob_admin_token']);
});

test('confirma somente após o servidor e impede duplo toque @smoke', async ({ page, context }) => {
  let release;
  const wait = new Promise(resolve => { release = resolve; });
  const api = await mockPanel(context, fixture(), { delay: () => wait });
  await page.goto('/painel-onibus.html');
  const ana = page.locator('[data-check="1"]');
  await ana.focus();
  await page.keyboard.press('Space');
  await expect(ana).toBeDisabled();
  await expect(ana).toHaveText('Salvando…');
  await expect(ana).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#embarque-present')).toHaveText('0');
  release();
  await expect(ana).toHaveAttribute('aria-pressed', 'true');
  await expect(ana).toBeFocused();
  expect(api.writes).toHaveLength(1);
});

test('preserva foco na próxima pessoa quando o filtro remove a presença salva @smoke', async ({ page, context }) => {
  await mockPanel(context);
  await page.goto('/painel-onibus.html');
  await page.locator('[data-presence="missing"]').click();
  await page.locator('[data-check="1"]').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('[data-check="1"]')).toHaveCount(0);
  await expect(page.locator('[data-check="2"]')).toBeFocused();
});

test('tablet mantém contadores visíveis durante a chamada @smoke', async ({ page, context }) => {
  await mockPanel(context);
  await page.setViewportSize({ width: 820, height: 700 });
  await page.goto('/painel-onibus.html');
  await page.locator('[data-check="3"]').scrollIntoViewIfNeeded();
  const summary = await page.locator('.embarque-overview').boundingBox();
  expect(summary.y).toBeGreaterThanOrEqual(0);
  expect(summary.y + summary.height).toBeLessThan(700);
  expect(await page.locator('#embarque-scroll').evaluate(node => node.scrollTop)).toBeGreaterThan(0);
});

test('filtra ônibus, grupos, faltantes e nomes sem acentos', async ({ page, context }) => {
  await mockPanel(context);
  await page.goto('/painel-onibus.html');
  await page.locator('[data-check="1"]').click();
  await page.locator('[data-presence="missing"]').click();
  await expect(page.locator('.embarque-person')).toHaveCount(2);
  await page.locator('[data-bus="1"]').click();
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

test('duas sessões sincronizam e detectam revisão desatualizada', async ({ browser }) => {
  const first = await browser.newContext();
  const second = await browser.newContext();
  const manifest = fixture();
  await mockPanel(first, manifest);
  await mockPanel(second, manifest);
  const a = await first.newPage(), b = await second.newPage();
  await Promise.all([a.goto('/painel-onibus.html'), b.goto('/painel-onibus.html')]);
  await expect(b.locator('[data-check="1"]')).toHaveAttribute('aria-pressed', 'false');
  await a.locator('[data-check="1"]').click();
  await expect(a.locator('[data-check="1"]')).toHaveAttribute('aria-pressed', 'true');
  await b.locator('[data-check="1"]').click();
  await expect(b.locator('#embarque-error')).toContainText('Outra pessoa atualizou');
  await expect(b.locator('[data-check="1"]')).toHaveAttribute('aria-pressed', 'true');
  await a.locator('[data-check="2"]').click();
  await expect(a.locator('[data-check="2"]')).toHaveAttribute('aria-pressed', 'true');
  await b.locator('#embarque-update').click();
  await expect(b.locator('[data-check="2"]')).toHaveAttribute('aria-pressed', 'true');
  await first.close(); await second.close();
});

test('erro de gravação e falta de conexão não geram presença falsa', async ({ page, context }) => {
  await mockPanel(context, fixture(), { fail: true });
  await page.goto('/painel-onibus.html');
  await page.locator('[data-check="1"]').click();
  await expect(page.locator('#embarque-error')).toContainText('Não foi possível confirmar a gravação');
  await expect(page.locator('[data-check="1"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#embarque-present')).toHaveText('0');
  await expect(page.locator('[data-check="1"]')).toBeDisabled();
  await page.locator('#embarque-retry').click();
  await expect(page.locator('[data-check="1"]')).toBeEnabled();
  await context.setOffline(true);
  await expect(page.locator('#embarque-sync')).toContainText('Sem conexão');
  await expect(page.locator('[data-check="1"]')).toBeDisabled();
  await context.setOffline(false);
  await expect(page.locator('[data-check="1"]')).toBeEnabled();
});

test('sincroniza automaticamente apenas com slider aberto e limpa dados ao sair', async ({ page, context }) => {
  const api = await mockPanel(context);
  await page.clock.install();
  await page.goto('/painel-onibus.html');
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
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/painel-onibus.html?lang=${lang}`);
    await expect(page.locator('#embarque-sidebar h2')).toHaveText(title);
    await expect(page.locator('[data-check="1"]')).toHaveAttribute('aria-label', save);
    await expect(page.locator('#embarque-language, #embarque-pdf')).toHaveCount(0);
    const refresh = page.locator('#embarque-update');
    const refreshLabel = { pt: 'Atualizar', en: 'Refresh', es: 'Actualizar' }[lang];
    await expect(refresh).toHaveAttribute('aria-label', refreshLabel);
    await expect(refresh).toHaveAttribute('title', refreshLabel);
    await expect(refresh.locator('svg')).toHaveCount(1);
    await expect(page.locator('.embarque-header [data-leg] svg')).toHaveCount(2);
    await expect(page.locator('.embarque-header [data-leg="outbound"]')).toContainText({ pt: 'Ida', en: 'Outbound', es: 'Ida' }[lang]);
    const positions = await page.locator('.embarque-header').evaluate(header => {
      const button = header.querySelector('#embarque-update').getBoundingClientRect();
      const close = header.querySelector('#embarque-close').getBoundingClientRect();
      const rect = header.getBoundingClientRect();
      return { aligned: button.y === close.y, inside: button.right <= rect.right && button.left >= rect.left,
        noOverflow: header.scrollWidth <= header.clientWidth };
    });
    expect(positions).toEqual({ aligned: true, inside: true, noOverflow: true });
    await page.locator('#embarque-close').focus();
    await page.keyboard.press('Escape');
    await expect(page.locator('#embarque-sidebar')).not.toBeVisible();
    await expect(page.locator('#embarque-open')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#embarque-sidebar')).toBeVisible();
    await expect(page.locator('#embarque-close')).toBeFocused();
    const dimensions = await page.locator('[data-check="1"]').boundingBox();
    expect(dimensions.height).toBeGreaterThanOrEqual(48);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('lista vazia orienta a alocação sem controles de presença', async ({ page, context }) => {
  await mockPanel(context, { people: [], waiting: 0 });
  await page.goto('/painel-onibus.html');
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
  await page.goto('/painel-onibus.html');
  await expect(page.locator('[data-vip-group]')).toHaveCount(2);
  await expect(page.locator('[data-vip-group="2"] .embarque-person')).toHaveCount(2);
  await expect(page.locator('[data-vip-group="1"] .embarque-person')).toHaveCount(1);
  await expect(page.locator('[data-vip-group="2"]')).toContainText('Reserva CODIGO04');
  await page.locator('[data-check="4"]').click();
  await expect(page.locator('[data-vip-group="2"] .embarque-group__count')).toHaveText('1 de 2 a bordo');
  await expect(page.locator('[data-check="3"]')).toHaveAttribute('aria-pressed', 'false');
  expect(api.writes[0].body.passenger_id).toBe('4');
  await page.locator('#embarque-search').fill('vip');
  await expect(page.locator('.embarque-person')).toHaveCount(3);
  await page.locator('#embarque-search').fill('CODIGO04');
  await expect(page.locator('.embarque-person')).toHaveCount(1);
  await expect(page.locator('[data-vip-group="2"] .embarque-group__count')).toHaveText('1 de 2 a bordo');
});

test('slider mantém foco, fecha por backdrop e não reabre em atualização das reservas @smoke', async ({ page, context }) => {
  await mockPanel(context);
  await page.goto('/painel-onibus.html');
  const drawer = page.locator('#embarque-sidebar');
  await expect(drawer).toHaveClass(/is-open/);
  await expect(page.locator('[data-check="3"]')).toBeVisible();
  await expect(page.locator('.embarque-header')).toHaveCSS('background-color', 'rgb(4, 29, 58)');
  await expect(page.locator('.embarque-mascot')).toHaveAttribute('src', 'assets/images/manual/kriativa-checklist.png');
  await page.locator('#embarque-update').focus();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('[data-check="3"]')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#embarque-update')).toBeFocused();
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


test('ônibus usam tabs com navegação por setas e controles fixos no cabeçalho @smoke', async ({ page, context }) => {
  await mockPanel(context);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/painel-onibus.html');
  const tabs = page.locator('#embarque-buses');
  await expect(tabs).toHaveAttribute('role', 'tablist');
  const all = tabs.getByRole('tab', { name: /Todos os ônibus/ });
  await expect(all).toHaveAttribute('aria-selected', 'true');
  await expect(all).toHaveCSS('border-radius', '0px');
  await all.focus();
  await page.keyboard.press('ArrowRight');
  const first = tabs.locator('[data-bus="1"]');
  await expect(first).toBeFocused();
  await expect(first).toHaveAttribute('aria-selected', 'true');
  await expect(all).toHaveAttribute('tabindex', '-1');
  await expect(page.locator('#embarque-results')).toHaveAttribute('aria-labelledby', 'embarque-bus-1');
  await expect(page.locator('#embarque-expected')).toHaveText('2');
  await page.keyboard.press('End');
  await expect(tabs.locator('[data-bus="2"]')).toBeFocused();
  await expect(page.locator('#embarque-expected')).toHaveText('1');
  await page.keyboard.press('ArrowRight');
  await expect(all).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(tabs.locator('[data-bus="2"]')).toBeFocused();
  await page.keyboard.press('Home');
  await expect(all).toBeFocused();
  const refresh = page.locator('#embarque-update');
  // Measure fixed controls after the drawer's entrance has settled.
  await expect.poll(async () => (await page.locator('#embarque-sidebar').boundingBox()).y).toBeLessThan(.01);
  const before = await refresh.boundingBox();
  await page.locator('#embarque-scroll').evaluate(el => { el.scrollTop = el.scrollHeight; });
  const after = await refresh.boundingBox();
  expect(after.y).toBeCloseTo(before.y, 1);
  await expect(page.locator('.embarque-header [data-leg="return"]')).toBeInViewport();
  await refresh.click();
  await expect(refresh).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#embarque-sync')).toContainText('Sincronizado');
});
