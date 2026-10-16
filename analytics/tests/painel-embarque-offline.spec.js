import { test, expect } from '@playwright/test';
import { boardingHttp } from '../helpers/boarding-http.mjs';
let closeHttp;
test.afterEach(async () => { if (closeHttp) { await closeHttp(); closeHttp = null; } });

function manifest() {
  const state = () => ({ present: false, revision: 0, checked_at: null });
  return { waiting: 0, people: [
    { id: '1', registration_id: 'a', code: 'SOLO0001', name: 'Ana Offline', cpf: '123.456.789-01', bus_number: 1, outbound: state(), return: state() },
    { id: '2', registration_id: 'b', code: 'VIP00002', name: 'José Tablet', vip: true, bus_number: 2, outbound: state(), return: state() }
  ] };
}
async function mock(context) {
  const api = { data: manifest(), posts: [], fail: false, reject: false, lost: false, hold: null, financial: 0 };
  if (context.browser().browserType().name() === 'webkit') { closeHttp = await boardingHttp(api); return api; }
  await context.route('**/api/bus-admin-data*', route => { api.financial++; return route.fulfill({ json: { reservas: [], resumo: {}, frota: { onibus: [] } } }); });
  await context.route('**/api/bus-admin-reconcile*', route => route.fulfill({ json: {} }));
  await context.route('**/api/bus-boarding', async route => {
    if (api.reject) return route.fulfill({ status: 404, json: { error: 'not_found' } });
    if (route.request().method() === 'GET') return route.fulfill({ json: api.data });
    const body = route.request().postDataJSON(); api.posts.push(body);
    if (api.hold) await api.hold;
    if (api.fail) return route.fulfill({ status: 503, json: { error: 'boarding_unavailable' } });
    const person = api.data.people.find(p => p.id === body.passenger_id);
    if (!person || person.bus_number !== body.bus_number) return route.fulfill({ status: 409, json: { error: 'manifest_changed' } });
    if (person[body.leg].revision !== body.expected_revision) return route.fulfill({ status: 409, json: { error: 'revision_conflict', checkin: person[body.leg] } });
    person[body.leg] = { present: body.present, revision: body.expected_revision + 1, checked_at: '2026-10-16T15:00:00Z' };
    if (api.lost) { api.lost = false; return route.abort(); }
    return route.fulfill({ json: { checkin: person[body.leg] } });
  });
  return api;
}
async function ready(page, lang = 'pt') {
  await page.goto('/painel-onibus.html?chamada=1&lang=' + lang);
  await expect(page.locator('[data-check="1"]')).toBeEnabled();
  await expect(page.locator('#embarque-update')).toHaveAttribute('aria-busy', 'false');
}
async function records(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('kob-boarding-offline', 1);
    request.onerror = reject;
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('sessions'), get = tx.objectStore('sessions').getAll();
      get.onsuccess = () => resolve(get.result); tx.oncomplete = () => db.close();
    };
  }));
}
async function pending(page, length) {
  await expect.poll(async () => (await records(page))[0]?.pending.length).toBe(length);
}
async function network(context, api, offline) {
  if (context.browser().browserType().name() !== 'webkit') return context.setOffline(offline);
  // Playwright #42775: setOffline prevents WebKit SW navigation even for literal responses.
  // Drop actual HTTP connections instead, preserving the real worker/cache path.
  api.down = offline;
  if (!offline) for (const page of context.pages()) await page.locator('#embarque-update').click();
}

test('fila grava antes da rede, identifica pendência e preserva ida/volta @smoke', async ({ page, context }) => {
  const api = await mock(context); await ready(page);
  let release; api.hold = new Promise(resolve => { release = resolve; });
  await page.locator('[data-check="1"]').click();
  await pending(page, 1);
  await expect(page.locator('[data-check="1"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-person="1"]')).toHaveClass(/is-queued/);
  expect(await page.locator('#embarque-sidebar').evaluate(node => node.scrollTop)).toBe(0);
  expect((await page.locator('.embarque-header').boundingBox()).y).toBeGreaterThanOrEqual(0);
  await expect(page.locator('#embarque-connection')).toContainText('pendente');
  await expect(page.locator('[data-boarding-export="pdf"]')).toBeDisabled();
  release(); await pending(page, 0);
  await expect(page.locator('[data-person="1"]')).not.toHaveClass(/is-queued/);
  expect(api.data.people[0].outbound.present).toBe(true);
  expect(api.data.people[0].return.present).toBe(false);
  const cached = JSON.stringify(await records(page));
  expect(cached).not.toContain('123.456'); expect(cached).not.toContain('dev-token');
});

test('service worker abre nova navegação sem sinal e reenvia fila após recarregar @smoke', async ({ page, context }) => {
  const api = await mock(context); await ready(page);
  await expect(page.locator('#embarque-offline-state')).toHaveText('Pronto neste dispositivo', { timeout: 25000 });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await network(context, api, true);
  if (context.browser().browserType().name() !== 'webkit') await expect(page.locator('#embarque-sync')).toContainText('Sem conexão');
  await page.locator('[data-check="1"]').click(); await pending(page, 1);
  await page.locator('[data-leg="return"]').click();
  await page.locator('[data-check="2"]').click(); await pending(page, 2);
  await page.reload();
  await expect(page.locator('[data-check="1"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#embarque-search')).not.toHaveAttribute('placeholder', /CPF/);
  await expect(page.locator('[data-check="1"]')).toBeEnabled();
  await page.locator('[data-leg="return"]').click();
  await expect(page.locator('[data-check="2"]')).toHaveAttribute('aria-pressed', 'true');
  expect(api.posts).toHaveLength(0); expect(api.financial).toBe(0);
  await network(context, api, false); await pending(page, 0);
  expect(api.data.people[0].outbound.present).toBe(true);
  expect(api.data.people[1].return.present).toBe(true);
  expect(api.posts).toHaveLength(2);
  const cacheKeys = await page.evaluate(async () => {
    const keys = await caches.keys();
    return (await Promise.all(keys.map(async key => (await (await caches.open(key)).keys()).map(r => r.url)))).flat();
  });
  expect(cacheKeys.length).toBeGreaterThan(10);
  expect(cacheKeys.some(url => /\/api\/|token=/.test(url))).toBe(false);
});

test('alternar check offline cancela alteração ainda não enviada @smoke', async ({ page, context }) => {
  const api = await mock(context); await ready(page); await context.setOffline(true);
  await page.locator('[data-check="1"]').click(); await pending(page, 1);
  await page.locator('[data-check="1"]').click(); await pending(page, 0);
  await expect(page.locator('[data-check="1"]')).toHaveAttribute('aria-pressed', 'false');
  await context.setOffline(false); await page.locator('#embarque-update').click();
  expect(api.posts).toHaveLength(0);
});

test('resposta perdida conserva fila e reconhece gravação sem duplicar @smoke', async ({ page, context }) => {
  const api = await mock(context); await ready(page); api.lost = true;
  await page.locator('[data-check="1"]').click(); await pending(page, 1);
  await expect(page.locator('#embarque-update')).toHaveAttribute('aria-busy', 'false');
  expect(api.data.people[0].outbound.revision).toBe(1);
  await page.locator('#embarque-update').click(); await pending(page, 0);
  expect(api.posts).toHaveLength(1); expect(api.data.people[0].outbound.revision).toBe(1);
});

test('revisão divergente exige escolha e permite manter o banco @smoke', async ({ page, context }) => {
  const api = await mock(context); await ready(page); await context.setOffline(true);
  await page.locator('[data-check="1"]').click(); await pending(page, 1);
  api.data.people[0].outbound.revision = 2; // Another device checked and then unchecked.
  await context.setOffline(false);
  await expect(page.locator('#embarque-conflicts')).toContainText('Ana Offline');
  await expect(page.locator('#embarque-conflicts')).toContainText('Outra pessoa');
  expect(api.posts).toHaveLength(0);
  await page.locator('[data-resolve="server"]').click(); await pending(page, 0);
  await expect(page.locator('[data-check="1"]')).toHaveAttribute('aria-pressed', 'false');
});

test('conflito de ônibus exige confirmação antes de enviar com ônibus atual @smoke', async ({ page, context }) => {
  const api = await mock(context); await ready(page); await context.setOffline(true);
  await page.locator('[data-check="1"]').click(); await pending(page, 1);
  api.data.people[0].bus_number = 3;
  await context.setOffline(false);
  await expect(page.locator('#embarque-conflicts')).toContainText('Ônibus 3');
  expect(api.posts).toHaveLength(0);
  await page.locator('[data-resolve="local"]').click(); await pending(page, 0);
  expect(api.posts[0].bus_number).toBe(3);
});

test('passageiro removido não é enviado e pode descartar pendência @smoke', async ({ page, context }) => {
  const api = await mock(context); await ready(page); await context.setOffline(true);
  await page.locator('[data-check="1"]').click(); await pending(page, 1);
  api.data.people.shift(); await context.setOffline(false);
  await expect(page.locator('#embarque-conflicts')).toContainText('não está mais');
  await expect(page.locator('[data-resolve="local"]')).toHaveCount(0);
  await page.locator('[data-resolve="server"]').click(); await pending(page, 0);
  expect(api.posts).toHaveLength(0);
});

test('acesso revogado suspende fila e sair exige confirmação de descarte @smoke', async ({ page, context }) => {
  const api = await mock(context); await ready(page); await context.setOffline(true);
  await page.locator('[data-check="1"]').click(); await pending(page, 1);
  api.reject = true; await context.setOffline(false);
  await expect(page.locator('#embarque-connection')).toContainText('acesso expirou');
  await expect(page.locator('[data-check="1"]')).toBeDisabled();
  await page.locator('#embarque-close').click();
  page.once('dialog', dialog => dialog.dismiss()); await page.locator('#botao-sair').click();
  await pending(page, 1);
  page.once('dialog', dialog => dialog.accept()); await page.locator('#botao-sair').click();
  await expect.poll(async () => (await records(page)).length).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem('kob_admin_token'))).toBeNull();
});

test('abas compartilham fila e lease evita envio duplicado @smoke', async ({ page, context }) => {
  const api = await mock(context); await ready(page);
  const other = await context.newPage(); await ready(other);
  await context.setOffline(true); await page.locator('[data-check="1"]').click(); await pending(page, 1);
  await expect(other.locator('[data-check="1"]')).toHaveAttribute('aria-pressed', 'true');
  await context.setOffline(false); await pending(page, 0);
  expect(api.posts).toHaveLength(1); await other.close();
});

test('nova autenticação do mesmo acesso preserva e reenvia pendências @smoke', async ({ page, context }) => {
  const api = await mock(context); await ready(page); await context.setOffline(true);
  await page.locator('[data-check="1"]').click(); await pending(page, 1);
  api.reject = true; await context.setOffline(false);
  await expect(page.locator('#embarque-reauth')).toBeVisible();
  await page.locator('#embarque-reauth').click();
  await expect(page.locator('#form-login')).toBeVisible(); await pending(page, 1);
  api.reject = false;
  await page.locator('#token-input').fill('dev-token'); await page.locator('#form-login [type="submit"]').click();
  await pending(page, 0);
  await expect(page.locator('[data-check="1"]')).toHaveAttribute('aria-pressed', 'true');
  expect(api.posts).toHaveLength(1);
});

for (const [lang, pendingWord, readyWord] of [['pt', 'Pendente de envio', 'Pronto neste dispositivo'], ['en', 'Pending upload', 'Ready on this device'], ['es', 'Pendiente de envío', 'Listo en este dispositivo']]) {
  test(`offline e instalação localizados em ${lang} @smoke`, async ({ page, context }) => {
    await mock(context); await page.setViewportSize({ width: 390, height: 844 }); await ready(page, lang);
    await expect(page.locator('#embarque-offline-state')).toHaveText(readyWord, { timeout: 25000 });
    await context.setOffline(true); await page.locator('[data-check="1"]').click();
    await expect(page.locator('[data-person="1"] .embarque-person__detail')).toHaveText(pendingWord);
    await expect(page.locator('#embarque-sidebar')).toHaveAttribute('lang', lang === 'pt' ? 'pt-BR' : lang === 'en' ? 'en-US' : 'es');
    expect(await page.locator('#embarque-sidebar').evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  });
}

test('armazenamento bloqueado não confirma falsamente uma seleção @smoke', async ({ page, context }) => {
  await mock(context);
  await page.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { value: null }); });
  await page.goto('/painel-onibus.html?chamada=1');
  await expect(page.locator('#embarque-expected')).toHaveText('2');
  await expect(page.locator('#embarque-connection')).toContainText('Não foi possível salvar');
  await expect(page.locator('[data-check="1"]')).toBeDisabled();
  await expect(page.locator('[data-check="1"]')).toHaveAttribute('aria-pressed', 'false');
});

test('quota excedida no commit mantém check anterior e não envia ao banco @smoke', async ({ page, context }) => {
  const api = await mock(context); await ready(page);
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = function () { throw new DOMException('Quota full', 'QuotaExceededError'); };
  });
  await page.locator('[data-check="1"]').click();
  await expect(page.locator('#embarque-connection')).toContainText('Não foi possível salvar');
  await expect(page.locator('[data-check="1"]')).toHaveAttribute('aria-pressed', 'false');
  await pending(page, 0); expect(api.posts).toHaveLength(0);
});

test('conflito de revisão só envia intenção local depois de escolha explícita @smoke', async ({ page, context }) => {
  const api = await mock(context); await ready(page); await context.setOffline(true);
  await page.locator('[data-check="1"]').click(); await pending(page, 1);
  api.data.people[0].outbound.revision = 2;
  await context.setOffline(false);
  await expect(page.locator('#embarque-conflicts')).toBeVisible();
  expect(api.posts).toHaveLength(0);
  await page.locator('[data-resolve="local"]').click(); await pending(page, 0);
  expect(api.posts[0].expected_revision).toBe(2);
  expect(api.data.people[0].outbound.revision).toBe(3);
});

test('fechar documento e abrir outro sem rede recupera lista e fila @smoke', async ({ page, context }) => {
  const api = await mock(context); await ready(page);
  await expect(page.locator('#embarque-offline-state')).toHaveText('Pronto neste dispositivo', { timeout: 25000 });
  await network(context, api, true); await page.locator('[data-check="1"]').click(); await pending(page, 1);
  const next = await context.newPage(); await page.close();
  await next.goto('/painel-onibus.html?chamada=1');
  await expect(next.locator('[data-check="1"]')).toHaveAttribute('aria-pressed', 'true');
  await pending(next, 1);
  await network(context, api, false); await pending(next, 0);
  expect(api.posts).toHaveLength(1);
});

test('cache de outro acesso não abre lista sem primeira preparação autorizada @smoke', async ({ page, context }) => {
  const api = await mock(context); await ready(page);
  await expect(page.locator('#embarque-offline-state')).toHaveText('Pronto neste dispositivo', { timeout: 25000 });
  await page.evaluate(() => localStorage.setItem('kob_admin_token', 'another-key'));
  await network(context, api, true); await page.reload();
  await expect(page.locator('#embarque-error')).toContainText('primeira vez');
  await expect(page.locator('[data-person]')).toHaveCount(0);
  await expect(page.locator('#embarque-offline-state')).toHaveText('Ainda não preparado');
});

test('servidor indisponível conserva fila após recarga e tenta novamente @smoke', async ({ page, context }) => {
  const api = await mock(context); await ready(page); api.fail = true;
  await page.locator('[data-check="1"]').click(); await pending(page, 1);
  await expect(page.locator('#embarque-update')).toHaveAttribute('aria-busy', 'false');
  await page.reload(); await pending(page, 1);
  await expect(page.locator('[data-person="1"]')).toHaveClass(/is-queued/);
  api.fail = false;
  await expect(page.locator('#embarque-update')).toBeEnabled();
  await page.locator('#embarque-update').click(); await pending(page, 0);
  expect(api.data.people[0].outbound.present).toBe(true);
});
