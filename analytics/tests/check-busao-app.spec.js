import { test, expect } from '@playwright/test';
import { boardingHttp } from '../helpers/boarding-http.mjs';

// App instalado "Check Busão KOB": abre pelo atalho (?chamada=1), funciona sem
// rede e reenvia as marcações. Roda no Chromium (Android) e no WebKit (iPhone).
let closeHttp;
test.afterEach(async () => { if (closeHttp) { await closeHttp(); closeHttp = null; } });

const state = () => ({ present: false, revision: 0, checked_at: null });
const isWebkit = context => context.browser().browserType().name() === 'webkit';

async function mock(context) {
  const api = { data: { waiting: 0, people: [
    { id: '1', registration_id: 'a', code: 'GRUPOAAA', name: 'Ana Offline', contact: 'Ana Offline', group: 'Lords of Waterdeep', primary: true, bus_number: 1, outbound: state(), return: state() },
    { id: '2', registration_id: 'a', code: 'GRUPOAAA', name: 'Bia Offline', contact: 'Ana Offline', group: 'Lords of Waterdeep', lap_child: true, bus_number: 1, outbound: state(), return: state() }
  ] }, posts: [], financial: 0, down: false };
  if (isWebkit(context)) { closeHttp = await boardingHttp(api); return api; }
  await context.route('**/api/bus-admin-data*', route => { api.financial++; return route.fulfill({ json: { reservas: [], resumo: {}, frota: { onibus: [] } } }); });
  await context.route('**/api/bus-admin-reconcile*', route => route.fulfill({ json: {} }));
  await context.route('**/api/bus-boarding', route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: api.data });
    const body = route.request().postDataJSON(); api.posts.push(body);
    const person = api.data.people.find(p => p.id === body.passenger_id);
    person[body.leg] = { present: body.present, revision: body.expected_revision + 1, checked_at: '2026-11-20T09:00:00Z' };
    return route.fulfill({ json: { checkin: person[body.leg] } });
  });
  return api;
}
async function setNetwork(context, page, api, offline) {
  // Playwright #42775: no WebKit o setOffline impede o service worker de responder à
  // navegação. Derrubar o servidor HTTP reproduz a falta de sinal sem esse bloqueio.
  if (!isWebkit(context)) return context.setOffline(offline);
  api.down = offline;
  if (!offline) await page.locator('#embarque-update').click();
}
async function pendingCount(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('kob-boarding-offline', 1);
    request.onerror = reject;
    request.onsuccess = () => {
      const tx = request.result.transaction('sessions'), get = tx.objectStore('sessions').getAll();
      get.onsuccess = () => resolve(get.result[0]?.pending.length ?? 0); tx.oncomplete = () => request.result.close();
    };
  }));
}

test('manifesto e ícones do Check Busão KOB nos três idiomas @smoke', async ({ page, context }) => {
  await mock(context);
  await page.addInitScript(() => localStorage.setItem('kob_admin_token', 'dev-token'));
  for (const lang of ['pt', 'en', 'es']) {
    await page.goto('/painel-onibus.html?chamada=1&lang=' + lang);
    const href = await page.locator('#embarque-manifest').getAttribute('href');
    const manifest = await (await page.request.get('/' + href)).json();
    expect(manifest.name).toBe('Check Busão KOB');
    expect(manifest.short_name).toBe('Check Busão KOB');
    expect(manifest.start_url).toBe('/painel-onibus.html?chamada=1&lang=' + lang);
    for (const icon of manifest.icons) {
      const response = await page.request.get(icon.src);
      expect(response.ok(), icon.src).toBe(true);
      expect(response.headers()['content-type']).toContain('image/png');
    }
    expect(manifest.icons.map(icon => icon.purpose || 'any')).toEqual(expect.arrayContaining(['any', 'maskable']));
  }
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', 'Check Busão KOB');
  const touch = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  expect((await page.request.get('/' + touch)).ok()).toBe(true);
});

test('atalho abre sem sinal, guarda marcações e reenvia ao voltar a conexão @smoke', async ({ page, context }) => {
  const api = await mock(context);
  await page.addInitScript(() => localStorage.setItem('kob_admin_token', 'dev-token'));

  // 1º acesso com internet: o atalho abre a chamada direto e prepara o offline.
  await page.goto('/painel-onibus.html?chamada=1&lang=pt');
  await expect(page.locator('#embarque-sidebar')).toHaveClass(/is-open/);
  await expect(page.locator('[data-check="1"]')).toBeEnabled();
  await expect(page.locator('#embarque-offline-toggle')).toHaveAttribute('data-ready', 'true', { timeout: 25000 });
  await page.locator('#embarque-offline-toggle').click();
  await expect(page.locator('#embarque-offline-state')).toHaveText('Pronto neste dispositivo');
  await page.locator('#embarque-offline-toggle').click();
  await page.evaluate(() => navigator.serviceWorker.ready);

  // Sem sinal: um novo documento abre pelo service worker, sem dados financeiros.
  await setNetwork(context, page, api, true);
  const next = await context.newPage();
  await page.close();
  await next.goto('/painel-onibus.html?chamada=1&lang=pt');
  await expect(next.locator('#embarque-sidebar')).toHaveClass(/is-open/);
  await expect(next.locator('[data-check="1"]')).toBeEnabled();
  await expect(next.locator('[data-person="1"]')).toContainText('Ana Offline');
  await next.locator('[data-check="1"]').click();
  await next.locator('[data-leg="return"]').click();
  await next.locator('[data-check="1"]').click();
  await expect.poll(() => pendingCount(next)).toBe(2);
  await expect(next.locator('[data-person="1"]')).toHaveClass(/is-queued/);
  await expect(next.locator('[data-person="1"] .embarque-person__detail')).toHaveText('Aguardando conexão');
  await expect(next.locator('#embarque-offline-badge')).toHaveText('2');
  expect(api.posts).toHaveLength(0);
  expect(api.financial).toBe(0);

  // Reabrir o app ainda sem sinal mantém a fila.
  await next.reload();
  await expect(next.locator('[data-check="1"]')).toBeEnabled();
  await expect.poll(() => pendingCount(next)).toBe(2);

  // Conexão de volta: as duas marcações chegam ao banco e a fila zera.
  await setNetwork(context, next, api, false);
  await expect.poll(() => pendingCount(next), { timeout: 20000 }).toBe(0);
  expect(api.posts.map(post => post.leg).sort()).toEqual(['outbound', 'return']);
  expect(api.data.people[0].outbound.present).toBe(true);
  expect(api.data.people[0].return.present).toBe(true);
  await expect(next.locator('[data-person="1"]')).not.toHaveClass(/is-queued/);
  await expect(next.locator('#embarque-offline-badge')).toBeHidden();
});
