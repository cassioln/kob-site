import { expect, test } from '@playwright/test';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('redirect same-origin resolve CTA estável sem carregar analytics', async ({ page }) => {
  let redirect = null;
  await page.route(/https:\/\/api\.whatsapp\.com\/send/, (route) => {
    const destination = new URL(route.request().url());
    redirect = {
      host: destination.host,
      hasPhone: destination.searchParams.has('phone'),
      hasText: destination.searchParams.has('text')
    };
    return route.abort('blockedbyclient');
  });

  await page.goto('/whatsapp.html?cta=hero_reserve').catch(() => null);
  await expect.poll(() => redirect).not.toBeNull();
  expect(redirect).toEqual({
    host: 'api.whatsapp.com',
    hasPhone: true,
    hasText: true
  });
  expect(await page.evaluate(() => Boolean(window.dataLayer || window.google_tag_manager))).toBe(false);
});

test('redirect desconhecido retorna para reserva sem destino externo', async ({ page }) => {
  await page.goto('/whatsapp.html?cta=unknown');
  await expect(page).toHaveURL(/\/#reserve$/);
});
