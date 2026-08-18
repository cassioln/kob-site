import { expect, test } from '@playwright/test';
import { blockAnalyticsNetwork } from './helpers/analytics.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('hrefs do WhatsApp permanecem fail-closed se o bundle principal falhar', async ({ page }) => {
  await blockAnalyticsNetwork(page);
  await page.route('**/assets/js/main.js*', (route) => route.abort('failed'));
  await page.goto('/');

  const ctas = page.locator('a[data-analytics-channel="whatsapp"]:not(#cabinModalCta)');
  await expect(ctas).toHaveCount(10);
  const unsafeHrefCount = await ctas.evaluateAll((links) => links.filter((link) => {
    const destination = new URL(link.href);
    return destination.origin !== window.location.origin
      || destination.pathname !== '/whatsapp.html'
      || destination.searchParams.has('phone')
      || destination.searchParams.has('text');
  }).length);

  expect(unsafeHrefCount).toBe(0);

  const fallbackNavigation = await page.evaluate(() => {
    const opened = [];
    window.open = (url) => {
      opened.push(String(url));
      return null;
    };
    document.querySelector('[data-analytics-cta-id="hero_reserve"]').click();
    const destination = new URL(opened[0]);
    return {
      openedCount: opened.length,
      hasPhone: destination.searchParams.has('phone'),
      hasText: destination.searchParams.has('text')
    };
  });
  expect(fallbackNavigation).toEqual({ openedCount: 1, hasPhone: true, hasText: true });
});

test('fallback inline preserva teclado, modificador e link seguro para menu/copiar', async ({ page }) => {
  await blockAnalyticsNetwork(page);
  await page.route('**/assets/js/main.js*', (route) => route.abort('failed'));
  await page.goto('/');

  await page.evaluate(() => {
    window.__kobNavigationEvidence = [];
    window.open = (url) => {
      const destination = new URL(url);
      window.__kobNavigationEvidence.push({
        host: destination.host,
        hasPhone: destination.searchParams.has('phone'),
        hasText: destination.searchParams.has('text')
      });
      return null;
    };
  });

  const cta = page.locator('[data-analytics-cta-id="hero_reserve"]');
  const safeHref = '/whatsapp.html?cta=hero_reserve';
  await expect(cta).toHaveAttribute('href', safeHref);

  await cta.scrollIntoViewIfNeeded();
  await cta.click({ button: 'right' });
  expect(await page.evaluate(() => window.__kobNavigationEvidence.length)).toBe(0);
  await expect(cta).toHaveAttribute('href', safeHref);

  await cta.click();
  await cta.focus();
  await cta.press('Enter');

  const evidence = await page.evaluate(() => window.__kobNavigationEvidence);
  expect(evidence).toEqual([
    { host: 'api.whatsapp.com', hasPhone: true, hasText: true },
    { host: 'api.whatsapp.com', hasPhone: true, hasText: true }
  ]);
  await expect(cta).toHaveAttribute('href', safeHref);
});

test('redirect same-origin preserva clique do meio sem expor PII no href', async ({ page, context }) => {
  await blockAnalyticsNetwork(page);
  await page.route('**/assets/js/main.js*', (route) => route.abort('failed'));
  await context.route('**/whatsapp.html*', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><title>redirect seguro</title>'
  }));
  await page.goto('/');

  const cta = page.locator('[data-analytics-cta-id="hero_reserve"]');
  const safeHref = await cta.getAttribute('href');
  expect(safeHref).toBe('/whatsapp.html?cta=hero_reserve');

  const popupPromise = context.waitForEvent('page');
  await cta.click({ button: 'middle' });
  const popup = await popupPromise;
  await popup.waitForURL('**/whatsapp.html?cta=hero_reserve');
  expect(new URL(popup.url()).pathname).toBe('/whatsapp.html');
  expect(new URL(popup.url()).searchParams.get('cta')).toBe('hero_reserve');
  await popup.close();
});
