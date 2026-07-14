import { test, expect } from '@playwright/test';
import {
  blockAnalyticsNetwork,
  getConsentCommands,
  getControlEvents,
  startFresh
} from './helpers/analytics.js';

test.beforeEach(async ({ page }) => {
  await blockAnalyticsNetwork(page);
  await startFresh(page);
});

test('aceite persiste e restauração é enfileirada uma vez após o GTM ser solicitado', async ({ page }) => {
  await page.locator('[data-cookie-action="accept"]').click();
  await expect(page.locator('[data-cookie-consent]')).toBeHidden();
  expect(await getControlEvents(page, 'cookie_consent_accepted')).toHaveLength(1);
  const commands = await getConsentCommands(page);
  expect(commands.some((command) => command[0] === 'consent'
    && command[1] === 'update'
    && command[2].analytics_storage === 'granted')).toBe(false);

  await page.reload();
  await page.keyboard.press('Tab');
  await expect.poll(async () => (await getControlEvents(page, 'cookie_consent_restored')).length).toBe(1);
  const [restored] = await getControlEvents(page, 'cookie_consent_restored');
  expect(restored).toMatchObject({
    cookie_consent_status: 'accepted',
    cookie_consent_analytics: true,
    cookie_consent_marketing: false
  });
});

test('rejeição persiste e mantém todos os storages opcionais negados', async ({ page }) => {
  await page.locator('[data-cookie-action="deny"]').click();
  await expect(page.locator('[data-cookie-consent]')).toBeHidden();
  expect(await getControlEvents(page, 'cookie_consent_denied')).toHaveLength(1);

  const commands = await getConsentCommands(page);
  expect(commands.at(-1)).toEqual(['consent', 'update', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied'
  }]);

  await page.reload();
  const state = await page.evaluate(() => window.KOBCookieConsent.getConsentState());
  expect(state).toMatchObject({ status: 'denied', analytics: false, marketing: false });
});

test('revogação posterior emite atualização negada e evento de preferências', async ({ page }) => {
  await page.locator('[data-cookie-action="accept"]').click();
  await expect(page.locator('[data-cookie-consent]')).toBeHidden();
  await page.evaluate(() => window.KOBCookieConsent.openCookiePreferences());

  const analyticsToggle = page.locator('[data-cookie-category="analytics"]');
  await expect(analyticsToggle).toBeChecked();
  await analyticsToggle.uncheck();
  await page.locator('[data-cookie-action="save"]').click();

  await expect.poll(async () => (await getControlEvents(page, 'cookie_consent_denied')).length).toBe(1);
  const updates = await getControlEvents(page, 'cookie_preferences_updated');
  expect(updates.at(-1)).toMatchObject({
    cookie_consent_source: 'custom',
    cookie_consent_analytics: false,
    cookie_consent_marketing: false
  });
  const commands = await getConsentCommands(page);
  expect(commands.at(-1)[2].analytics_storage).toBe('denied');
});
