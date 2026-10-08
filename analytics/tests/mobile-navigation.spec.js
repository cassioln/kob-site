import { expect, test } from '@playwright/test';

const locales = [
  { prefix: '', active: 'PT' },
  { prefix: 'en/', active: 'EN' },
  { prefix: 'es/', active: 'ES' }
];

for (const locale of locales) {
  for (const surface of ['manual-de-bordo', 'onibus']) {
    test(`${surface} ${locale.active}: idiomas no menu mobile, foco e retorno ao desktop`, {
      tag: locale.active === 'PT' ? '@smoke' : []
    }, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(`/${locale.prefix}${surface}.html`);
      const drawer = page.locator('#drawer');
      const toggle = page.locator('#navToggle');
      const language = drawer.locator('.lang-switch');
      await expect(page.locator('header .lang-switch')).toHaveCount(0);
      await expect(toggle).toBeVisible();
      await expect(drawer).toHaveAttribute('aria-hidden', 'true');

      await toggle.click();
      await expect(drawer).toHaveAttribute('aria-hidden', 'false');
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(language).toBeVisible();
      await expect(language.locator('.lang-switch__item')).toHaveCount(3);
      await expect(language.locator('[aria-current="page"]')).toHaveText(locale.active);
      for (const target of locales.filter(target => target.active !== locale.active)) {
        const destination = surface === 'onibus'
          ? `https://busao.kriativosonboard.com.br/${target.prefix}`
          : `/${target.prefix}manual-de-bordo.html`;
        await expect(language.getByText(target.active, { exact: true }))
          .toHaveAttribute('href', destination);
      }
      for (const button of await language.locator('.lang-switch__item').all()) {
        const box = await button.boundingBox();
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
      await expect(page.locator('#main')).toHaveAttribute('inert', '');
      await expect(page.locator('#drawerClose')).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(drawer.locator('a[href]').last()).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.locator('#drawerClose')).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(drawer).toHaveAttribute('data-open', 'false');
      await expect(toggle).toBeFocused();
      await expect(page.locator('#main')).not.toHaveAttribute('inert', '');

      await toggle.click();
      const anchor = surface === 'onibus' ? '#passageiros' : '#cronograma';
      await drawer.locator(`a[href="${anchor}"]`).click();
      await expect(page).toHaveURL(new RegExp(`${anchor}$`));
      await expect(drawer).toHaveAttribute('data-open', 'false');

      await toggle.click();
      await page.setViewportSize({ width: 1440, height: 900 });
      await expect(drawer).toHaveAttribute('data-open', 'false');
      await expect(page.locator('header .lang-switch')).toBeVisible();
      await expect(page.locator('header [aria-current="page"]')).toHaveText(locale.active);
      await expect(toggle).toBeHidden();
      await expect(page.locator('#main')).not.toHaveAttribute('inert', '');
      await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');

      await page.setViewportSize({ width: 320, height: 640 });
      await toggle.click();
      await expect(language).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
      await page.locator('#drawerClose').click();
      await expect(toggle).toBeFocused();
    });
  }
}

for (const locale of locales) {
  test(`home ${locale.active}: idiomas passam da primeira dobra para o menu`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/${locale.prefix}?lang=${locale.active.toLowerCase()}`);
    const headerLanguage = page.locator('header .lang-switch--mobile');
    const drawerLanguage = page.locator('#drawer .lang-switch--mobile');
    await expect(headerLanguage).toBeVisible();
    await expect(headerLanguage.locator('[aria-current="page"]')).toHaveText(locale.active);
    await expect(drawerLanguage).toHaveCount(0);

    await page.locator('#navio').scrollIntoViewIfNeeded();
    await expect(page.locator('#nav')).toHaveAttribute('data-scrolled', 'true');
    await expect(headerLanguage).toHaveCount(0);
    await page.locator('#navToggle').click();
    await expect(drawerLanguage).toBeVisible();
    await expect(drawerLanguage.locator('[aria-current="page"]')).toHaveText(locale.active);
    for (const target of locales) {
      await expect(drawerLanguage.getByText(target.active, { exact: true }))
        .toHaveAttribute('href', `/${target.prefix}`);
    }
    await page.keyboard.press('Escape');
    await expect(page.locator('#drawer')).toHaveAttribute('data-open', 'false');

    await page.locator('#top').scrollIntoViewIfNeeded();
    await expect(page.locator('#nav')).toHaveAttribute('data-scrolled', 'false');
    await expect(headerLanguage).toBeVisible();
    await expect(drawerLanguage).toHaveCount(0);
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(headerLanguage).toBeHidden();
    await expect(page.locator('header .lang-switch:not(.lang-switch--mobile)')).toBeVisible();
  });
}

for (const surface of ['manual-de-bordo', 'onibus']) {
  test(`${surface}: idiomas continuam acessíveis sem JavaScript no mobile`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL, viewport: { width: 375, height: 812 } });
    const page = await context.newPage();
    await page.goto(`/${surface}.html`);
    await expect(page.locator('header .lang-switch')).toBeVisible();
    await expect(page.locator('header .lang-switch a')).toHaveCount(2);
    await context.close();
  });
}
