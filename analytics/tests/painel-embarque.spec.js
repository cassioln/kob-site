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

test('embarque é a primeira aba e salva presença por passageiro e trecho @smoke', async ({ page, context }) => {
  const api = await mockPanel(context);
  await page.goto('/painel-onibus.html');
  await expect(page.getByRole('tab').first()).toHaveText('Lista de embarque');
  await expect(page.getByRole('tab').first()).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#aba-reservas')).toBeHidden();
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

test('sincroniza automaticamente apenas com a aba ativa e limpa dados ao sair', async ({ page, context }) => {
  const api = await mockPanel(context);
  await page.clock.install();
  await page.goto('/painel-onibus.html');
  await expect(page.locator('[data-check="1"]')).toBeVisible();
  api.manifest.people[0].outbound = { present: true, revision: 1, checked_at: '2026-11-20T09:00:00Z' };
  await page.clock.fastForward(8100);
  await expect(page.locator('[data-check="1"]')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('tab', { name: 'Reservas', exact: true }).click();
  api.manifest.people[0].outbound = { present: false, revision: 2, checked_at: null };
  await page.clock.fastForward(8100);
  await expect(page.locator('[data-check="1"]')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('tab', { name: 'Lista de embarque', exact: true }).click();
  await expect(page.locator('[data-check="1"]')).toHaveAttribute('aria-pressed', 'false');
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
    await expect(page.locator('#aba-embarque h2')).toHaveText(title);
    await expect(page.locator('[data-check="1"]')).toHaveAttribute('aria-label', save);
    await page.getByRole('tab').first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Reservas', exact: true })).toBeFocused();
    await page.keyboard.press('Home');
    await expect(page.getByRole('tab').first()).toBeFocused();
    await expect(page.locator('#aba-embarque')).toBeVisible();
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
