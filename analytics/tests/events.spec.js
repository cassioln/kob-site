import { test, expect } from '@playwright/test';
import {
  acceptAnalytics,
  assertNoPii,
  assertSchema,
  blockAnalyticsNetwork,
  getBusinessEvents,
  startFresh
} from './helpers/analytics.js';

test.beforeEach(async ({ page }) => {
  await blockAnalyticsNetwork(page);
  await startFresh(page);
  await acceptAnalytics(page);
});

test('seções altas disparam uma vez por marco de negócio', async ({ page }) => {
  await page.locator('#valores').scrollIntoViewIfNeeded();
  await expect.poll(async () => (await getBusinessEvents(page, 'kob_section_view')).filter((event) => event.section_id === 'valores').length).toBe(1);

  await page.locator('#evento').scrollIntoViewIfNeeded();
  await page.locator('#valores').scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);

  const valuesEvents = (await getBusinessEvents(page, 'kob_section_view')).filter((event) => event.section_id === 'valores');
  expect(valuesEvents).toHaveLength(1);
  assertSchema(valuesEvents[0]);
});

test('cabines e bebidas emitem listas uma vez e sem preços ambíguos', async ({ page }) => {
  await page.locator('#valores').scrollIntoViewIfNeeded();
  await expect.poll(async () => (await getBusinessEvents(page, 'view_item_list')).filter((event) => event.item_list_id === 'cabins_2026').length).toBe(1);
  expect((await getBusinessEvents(page, 'view_item_list')).some((event) => event.item_list_id === 'drink_packages_2026')).toBe(false);

  await page.getByRole('tab', { name: 'Pacotes de bebidas' }).click();
  await expect.poll(async () => (await getBusinessEvents(page, 'view_item_list')).filter((event) => event.item_list_id === 'drink_packages_2026').length).toBe(1);
  await page.getByRole('tab', { name: 'Cabines' }).click();
  await page.getByRole('tab', { name: 'Pacotes de bebidas' }).click();

  const lists = await getBusinessEvents(page, 'view_item_list');
  expect(lists.filter((event) => event.item_list_id === 'cabins_2026')).toHaveLength(1);
  expect(lists.filter((event) => event.item_list_id === 'drink_packages_2026')).toHaveLength(1);
  lists.forEach((payload) => {
    expect(payload).not.toHaveProperty('value');
    expect(payload).not.toHaveProperty('currency');
    assertSchema(payload);
    assertNoPii(payload);
  });
});

test('busca do FAQ permanece local e não emite o evento adiado', async ({ page }) => {
  await page.locator('#faq-search').fill('documentos');
  await page.waitForTimeout(750);

  const faqEvents = await page.evaluate(() => (window.dataLayer || [])
    .filter((entry) => entry?.event === 'kob_faq_search'));
  expect(faqEvents).toEqual([]);
});

test('abrir uma dúvida emite kob_faq_open uma vez, sem texto e com id estável', async ({ page }) => {
  const details = page.locator('#faq-comida details').first();
  await details.locator('summary').click();
  await expect(details).toHaveJSProperty('open', true);

  await expect.poll(async () => (await getBusinessEvents(page, 'kob_faq_open')).length).toBe(1);
  const [payload] = await getBusinessEvents(page, 'kob_faq_open');
  expect(payload).toMatchObject({ faq_category: 'comida' });
  expect(payload.faq_id).toMatch(/^comida_\d{2}$/);
  assertSchema(payload);
  assertNoPii(payload);
  // O texto da pergunta nunca deve viajar no payload.
  const summaryText = await details.locator('summary').innerText();
  expect(JSON.stringify(payload)).not.toContain(summaryText.trim());

  // Fechar e reabrir a mesma dúvida não deve duplicar (exact-once por page view).
  await details.locator('summary').click();
  await expect(details).toHaveJSProperty('open', false);
  await details.locator('summary').click();
  await expect(details).toHaveJSProperty('open', true);
  await page.waitForTimeout(150);
  expect((await getBusinessEvents(page, 'kob_faq_open')).filter((e) => e.faq_id === payload.faq_id)).toHaveLength(1);
});

test('fechar uma dúvida não emite kob_faq_open e cada dúvida tem id próprio', async ({ page }) => {
  const first = page.locator('#faq-embarque details').first();
  const second = page.locator('#faq-embarque details').nth(1);
  await first.locator('summary').click();
  await second.locator('summary').click();
  await expect.poll(async () => (await getBusinessEvents(page, 'kob_faq_open')).length).toBe(2);

  const events = await getBusinessEvents(page, 'kob_faq_open');
  const ids = events.map((e) => e.faq_id);
  expect(new Set(ids).size).toBe(2);
  events.forEach((payload) => {
    expect(payload.faq_category).toBe('embarque');
    assertSchema(payload);
    assertNoPii(payload);
  });

  // Fechar não deve gerar novo evento.
  await first.locator('summary').click();
  await page.waitForTimeout(150);
  expect((await getBusinessEvents(page, 'kob_faq_open'))).toHaveLength(2);
});
