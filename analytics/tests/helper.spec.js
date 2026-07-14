import { test, expect } from '@playwright/test';
import {
  assertNoPii,
  assertSchema,
  blockAnalyticsNetwork,
  getBusinessEvents,
  startFresh
} from './helpers/analytics.js';

test.beforeEach(async ({ page }) => {
  await blockAnalyticsNetwork(page);
  await startFresh(page);
});

test('expõe um helper único e omite valores ausentes', async ({ page }) => {
  await expect.poll(() => page.evaluate(() => typeof window.KOBAnalytics?.track)).toBe('function');

  await page.evaluate(() => {
    window.KOBAnalytics.track('kob_whatsapp_click', {
      cta_id: 'test_cta',
      placement: 'test_fixture',
      intent: 'support',
      item_id: '',
      item_category: null,
      ignored: undefined
    });
  });

  const [payload] = await getBusinessEvents(page, 'kob_whatsapp_click');
  expect(payload).toEqual({
    event: 'kob_whatsapp_click',
    schema_version: 1,
    cta_id: 'test_cta',
    placement: 'test_fixture',
    intent: 'support'
  });
  assertSchema(payload);
  assertNoPii(payload);
});

test('cada payload P0 capturado respeita schema e denylist de PII', async ({ page }) => {
  await page.locator('#valores').scrollIntoViewIfNeeded();
  await expect.poll(async () => (await getBusinessEvents(page)).length).toBeGreaterThan(0);

  const payloads = await getBusinessEvents(page);
  payloads.forEach((payload) => {
    assertSchema(payload);
    assertNoPii(payload);
  });
});
