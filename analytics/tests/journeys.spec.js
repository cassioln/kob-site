import { test, expect } from '@playwright/test';
import {
  acceptAnalytics,
  assertNoPii,
  assertSchema,
  blockAnalyticsNetwork,
  getBusinessEvents,
  preventExternalNavigation,
  startFresh
} from './helpers/analytics.js';

test.beforeEach(async ({ page }) => {
  await blockAnalyticsNetwork(page);
  await startFresh(page);
  await acceptAnalytics(page);
  await preventExternalNavigation(page);
});

test('Ver detalhes emite select_item e view_item para a cabine correta', async ({ page }) => {
  await page.locator('#valores').scrollIntoViewIfNeeded();
  await page.locator('.price-card__details[data-cabin="interna"]').click();
  await expect(page.locator('#cabinModal')).toBeVisible();

  const selectEvents = await getBusinessEvents(page, 'select_item');
  const viewEvents = await getBusinessEvents(page, 'view_item');
  expect(selectEvents).toHaveLength(1);
  expect(viewEvents).toHaveLength(1);
  expect(selectEvents[0].items[0]).toMatchObject({
    item_id: 'cabin_internal',
    item_name: 'Cabine interna',
    item_category: 'cabin'
  });
  expect(viewEvents[0].items).toEqual(selectEvents[0].items);
  assertSchema(selectEvents[0]);
  assertSchema(viewEvents[0]);
});

test('todos os CTAs estáticos de WhatsApp têm IDs explícitos e não vazam URL, telefone ou mensagem', async ({ page }) => {
  const ctas = page.locator('a[data-analytics-channel="whatsapp"]:not(#cabinModalCta)');
  await expect(ctas).toHaveCount(10);
  const metadata = await ctas.evaluateAll((links) => links.map((link) => ({
    channel: link.dataset.analyticsChannel,
    ctaId: link.dataset.analyticsCtaId,
    placement: link.dataset.analyticsPlacement,
    intent: link.dataset.analyticsIntent
  })));
  expect(metadata.length).toBeGreaterThan(0);
  metadata.forEach((entry) => {
    expect(entry.channel).toBe('whatsapp');
    expect(entry.ctaId).toMatch(/^[a-z][a-z0-9_]+$/);
    expect(entry.placement).toMatch(/^[a-z][a-z0-9_]+$/);
    expect(entry.intent).toMatch(/^(reservation|reservation_support|support)$/);
  });

  const sensitiveHrefCount = await ctas.evaluateAll((links) => links.filter((link) => {
    const destination = new URL(link.href);
    return destination.origin !== window.location.origin
      || destination.searchParams.has('phone')
      || destination.searchParams.has('text');
  }).length);
  expect(sensitiveHrefCount).toBe(0);

  const safeRedirects = await ctas.evaluateAll((links) => links.map((link) => {
    const destination = new URL(link.href);
    return {
      path: destination.pathname,
      cta: destination.searchParams.get('cta')
    };
  }));
  safeRedirects.forEach((entry, index) => {
    expect(entry.path).toBe('/whatsapp.html');
    expect(entry.cta).toBe(metadata[index].ctaId);
  });

  await page.evaluate(() => {
    window.__kobOpenedWhatsApp = [];
    window.open = (url) => {
      window.__kobOpenedWhatsApp.push(String(url));
      return null;
    };
  });

  await page.locator('[data-analytics-cta-id="hero_reserve"]').click();
  const runtimeDestination = await page.evaluate(() => {
    const destination = new URL(window.__kobOpenedWhatsApp[0]);
    return {
      openedCount: window.__kobOpenedWhatsApp.length,
      hasPhone: destination.searchParams.has('phone'),
      hasText: destination.searchParams.has('text')
    };
  });
  expect(runtimeDestination).toEqual({ openedCount: 1, hasPhone: true, hasText: true });

  const [payload] = await getBusinessEvents(page, 'kob_whatsapp_click');
  expect(payload).toMatchObject({
    cta_id: 'hero_reserve',
    placement: 'hero',
    intent: 'reservation'
  });
  assertSchema(payload);
  assertNoPii(payload);
});

test('CTA equivalente visível oculta o botão flutuante após sanitização', async ({ page }) => {
  await page.locator('[data-analytics-cta-id="hero_reserve"]').scrollIntoViewIfNeeded();
  await expect(page.locator('.wa-float')).toHaveAttribute('data-occluded', 'true');
});

test('CTA dinâmico do modal carrega contexto do item sem copiar o href', async ({ page }) => {
  await page.locator('#valores').scrollIntoViewIfNeeded();
  await page.locator('.price-card__details[data-cabin="janela"]').click();
  const cta = page.locator('#cabinModalCta');
  await expect(cta).toHaveAttribute('data-analytics-cta-id', 'cabin_modal_reserve');
  const hasSensitiveHref = await cta.evaluate((link) => {
    const destination = new URL(link.href);
    return destination.origin !== window.location.origin
      || destination.searchParams.has('phone')
      || destination.searchParams.has('text');
  });
  expect(hasSensitiveHref).toBe(false);
  const safeRedirect = await cta.evaluate((link) => {
    const destination = new URL(link.href);
    return {
      path: destination.pathname,
      cta: destination.searchParams.get('cta'),
      item: destination.searchParams.get('item')
    };
  });
  expect(safeRedirect).toEqual({
    path: '/whatsapp.html',
    cta: 'cabin_modal_reserve',
    item: 'cabin_ocean_view'
  });
  await cta.click();

  const events = await getBusinessEvents(page, 'kob_whatsapp_click');
  const payload = events.at(-1);
  expect(payload).toMatchObject({
    cta_id: 'cabin_modal_reserve',
    placement: 'cabin_modal',
    intent: 'reservation',
    item_id: 'cabin_ocean_view',
    item_category: 'cabin'
  });
  assertSchema(payload);
  assertNoPii(payload);
});
