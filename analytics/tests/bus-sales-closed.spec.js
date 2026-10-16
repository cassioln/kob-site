import { expect, test } from '@playwright/test';

test.use({ trace: 'off', video: 'off' });
const locales = [
  { prefix: '', sold: 'Vagas esgotadas', summary: /esgotadas/i },
  { prefix: 'en/', sold: 'Sold out', summary: /sold out/i },
  { prefix: 'es/', sold: 'Plazas agotadas', summary: /agotadas/i }
];

async function expectInside(parent, children) {
  const parentBounds = await parent.boundingBox();
  expect(parentBounds).not.toBeNull();
  for (const child of await children.all()) {
    const bounds = await child.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds.x).toBeGreaterThanOrEqual(parentBounds.x - 1);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(parentBounds.x + parentBounds.width + 1);
  }
}

for (const locale of locales) {
  test(`${locale.prefix || 'pt'}: disponibilidade cabe no celular, tablet e desktop`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const language = locale.prefix.slice(0, 2) || 'pt';
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${locale.prefix}index.html?lang=${language}#hospedagem`);
      await page.locator('.route-shuttle').scrollIntoViewIfNeeded();
      await page.evaluate(() => document.fonts.ready);
      await expectInside(page.locator('#hospedagem'), page.locator('.preboard-route__inner, .route-shuttle'));
      await expectInside(page.locator('.route-shuttle'), page.locator('.route-shuttle__copy, .route-shuttle__route, .route-shuttle__link, .route-shuttle__schedule-item'));
      await expectInside(page.locator('.route-shuttle__link'), page.locator('.route-shuttle__link > span, .route-shuttle__link > svg'));
      await expectInside(page.locator('.route-shuttle__copy'), page.locator('.route-shuttle__copy .transport-sold-out, .route-shuttle__schedule-item > span'));
      await page.goto(`/${locale.prefix}onibus.html?lang=${language}`);
      await page.evaluate(() => document.fonts.ready);
      await expectInside(page.locator('.bus-hero__inner'), page.locator('#bus-sales-status'));
      await expectInside(page.locator('#bus-sales-status'), page.locator('.bus-hero__sold-out-copy, .bus-hero__sold-out-link'));
    }
  });

  for (const width of [320, 390, 768, 1024, 1440]) {
    test(`${locale.prefix || 'pt'} ${width}: aviso claro, cadastro desativado e links com disponibilidade`, { tag: width === 390 ? '@smoke' : [] }, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width, height: 900 });
      let orders = 0;
      page.on('request', request => { if (request.url().includes('/api/create-pix-order')) orders++; });
      await page.goto(`/${locale.prefix}onibus.html?lang=${locale.prefix.slice(0, 2) || 'pt'}`);
      const rejectCookies = page.locator('[data-cookie-action="deny"]');
      if (await rejectCookies.isVisible()) await rejectCookies.click();
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
      await expectInside(page.locator('#meetingMapModal'), page.locator('#meetingMapClose'));
      await page.locator('#meetingMapClose').click();
      await expect(page.locator('#meetingMapModal')).toBeHidden();
      await expect(page.locator('#meetingMapOpen')).toBeFocused();
      for (const file of ['index.html', 'manual-de-bordo.html']) {
        await page.goto(`/${locale.prefix}${file}?lang=${locale.prefix.slice(0, 2) || 'pt'}`);
        const links = page.locator('a[href*="busao.kriativosonboard.com.br"], a[href="https://kriativosonboard.com.br/onibus.html"]');
        expect(await links.count()).toBeGreaterThan(0);
        for (const link of await links.all()) await expect(link).toContainText(locale.sold);
        await expect(page.locator(file === 'index.html' ? '#faq-h06' : '#faq-o12')).toContainText(locale.summary);
        if (await page.locator('#navToggle').isVisible()) {
          await page.locator('#navToggle').click();
          await expect.poll(() => page.locator('#drawer').evaluate(drawer => Math.abs(drawer.getBoundingClientRect().right - innerWidth))).toBeLessThan(1);
          await expectInside(page.locator('#drawer'), page.locator('#drawer a:visible, #drawer button:visible'));
          await page.locator('#drawerClose').click();
        }
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
