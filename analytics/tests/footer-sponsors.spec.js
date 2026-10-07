import { test, expect } from '@playwright/test';

const routes = ['manual-de-bordo.html', 'onibus.html', 'en/manual-de-bordo.html', 'en/onibus.html', 'es/manual-de-bordo.html', 'es/onibus.html'];
const lang = route => route.startsWith('en/') ? 'en' : route.startsWith('es/') ? 'es' : 'pt';

test('Sponsors loop without a seam and remain usable with pause and keyboard in all languages', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cookie_consent_status', 'denied'));
  for (const route of routes) {
    await page.goto(`/${route}?lang=${lang(route)}`);
    const section = page.locator('[data-footer-sponsors]');
    await section.scrollIntoViewIfNeeded();
    const original = section.locator('#footer-sponsors-list');
    await expect(original.locator('li')).toHaveCount(8);
    await expect(original.locator('a[aria-label^="Fácil Shopping"]')).toHaveAttribute('href', 'https://facilshopping.com.br/');
    const copy = section.locator('.footer-sponsors__copy');
    await expect(copy).toHaveAttribute('aria-hidden', 'true');
    expect(await original.locator('a').evaluateAll(links => links.map(a => a.href))).toEqual(await copy.locator('a').evaluateAll(links => links.map(a => a.href)));
    expect(await copy.locator('a').evaluateAll(links => links.every(a => a.tabIndex === -1))).toBe(true);
    const geometry = await section.evaluate(el => {
      const belt = el.querySelector('.footer-sponsors__belt');
      const groups = belt.children;
      return { half: belt.getBoundingClientRect().width / 2, distance: groups[1].offsetLeft - groups[0].offsetLeft };
    });
    expect(Math.abs(geometry.half - geometry.distance)).toBeLessThan(1);
    await page.mouse.move(0, 0);
    await expect(section).not.toHaveClass(/is-paused/);
    await section.locator('[data-sponsors-pause]').click();
    await expect(section).toHaveClass(/is-paused/);
    await section.locator('[data-sponsors-pause]').click();
    await original.locator('a').last().focus();
    await expect(section).toHaveClass(/is-keyboard/);
    const visible = await original.locator('a').last().evaluate(a => {
      const r = a.getBoundingClientRect(); const v = a.closest('.footer-sponsors__viewport').getBoundingClientRect();
      return r.left >= v.left && r.right <= v.right;
    });
    expect(visible).toBe(true);
    await page.locator('body').click({ position: { x: 1, y: 1 }, force: true });
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(section).toHaveClass(/is-paused/);
  }
});

test('Reduced motion shows every sponsor without scrolling or duplicate accessible logos', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 1000 });
  await page.addInitScript(() => localStorage.setItem('cookie_consent_status', 'denied'));
  for (const route of routes) {
    await page.goto(`/${route}?lang=${lang(route)}`);
    const section = page.locator('[data-footer-sponsors]');
    await section.scrollIntoViewIfNeeded();
    await expect(section.locator('[data-sponsors-pause]')).toBeHidden();
    await expect(section.locator('.footer-sponsors__copy')).toBeHidden();
    expect(await section.evaluate(el => {
      const viewport = el.querySelector('.footer-sponsors__viewport');
      return viewport.scrollWidth <= viewport.clientWidth && getComputedStyle(el.querySelector('.footer-sponsors__belt')).animationName === 'none';
    })).toBe(true);
    await expect(section.locator('#footer-sponsors-list a')).toHaveCount(8);
  }
});
