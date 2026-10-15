import { expect, test } from '@playwright/test';

test.use({ trace: 'off', video: 'off' });
const locales = [
  { prefix: '', sold: 'Vagas esgotadas', summary: /esgotadas/i },
  { prefix: 'en/', sold: 'Sold out', summary: /sold out/i },
  { prefix: 'es/', sold: 'Plazas agotadas', summary: /agotadas/i }
];

for (const locale of locales) {
  for (const width of [390, 1440]) {
    test(`${locale.prefix || 'pt'} ${width}: aviso claro, cadastro desativado e links com disponibilidade`, { tag: width === 390 ? '@smoke' : [] }, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      let orders = 0;
      page.on('request', request => { if (request.url().includes('/api/create-pix-order')) orders++; });
      await page.goto(`/${locale.prefix}onibus.html?lang=${locale.prefix.slice(0, 2) || 'pt'}`);
      await expect(page.locator('#bus-sales-status')).toContainText(locale.sold);
      await expect(page.locator('#bus-sales-status')).toBeVisible();
      await expect(page.locator('#bus-form')).toBeHidden();
      await expect(page.locator('#main')).not.toContainText(/Vagas abertas|Seats Available|Plazas disponibles|50%/i);
      await expect(page.locator('#primary-name')).toBeDisabled();
      await expect(page.locator('.bus-checkout__grid')).toBeHidden();
      await page.locator('#bus-form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
      expect(orders).toBe(0);
      await page.goto(`/${locale.prefix}onibus.html?lang=${locale.prefix.slice(0, 2) || 'pt'}#passageiros`);
      await expect(page.locator('#step-heading')).toContainText(locale.summary);
      await expect(page.locator('#bus-form')).toBeHidden();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.locator('#embarque #meetingMapOpen').click();
      await expect(page.locator('#meetingMapModal')).toBeVisible();
      const mapBounds = await page.locator('#meetingMapModal').boundingBox();
      expect(mapBounds.width).toBeGreaterThan(200);
      expect(mapBounds.height).toBeGreaterThan(200);
      await page.locator('#meetingMapClose').click();
      await expect(page.locator('#meetingMapModal')).toBeHidden();
      await expect(page.locator('#meetingMapOpen')).toBeFocused();
      for (const file of ['index.html', 'manual-de-bordo.html']) {
        await page.goto(`/${locale.prefix}${file}?lang=${locale.prefix.slice(0, 2) || 'pt'}`);
        const links = page.locator('a[href*="busao.kriativosonboard.com.br"], a[href="https://kriativosonboard.com.br/onibus.html"]');
        expect(await links.count()).toBeGreaterThan(0);
        for (const link of await links.all()) await expect(link).toContainText(locale.sold);
        await expect(page.locator(file === 'index.html' ? '#faq-h06' : '#faq-o12')).toContainText(locale.summary);
      }
    });
  }

  test(`${locale.prefix || 'pt'}: cadastro também está bloqueado sem JavaScript`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(`/${locale.prefix}onibus.html`);
    await expect(page.locator('#bus-sales-status')).toContainText(locale.sold);
    await expect(page.locator('#bus-form')).toBeHidden();
    await expect(page.locator('#primary-name')).toBeDisabled();
    await context.close();
  });
}
