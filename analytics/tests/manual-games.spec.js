import { test, expect } from '@playwright/test';

for (const [language, path] of [
  ['pt', '/manual-de-bordo.html'], ['en', '/en/manual-de-bordo.html'], ['es', '/es/manual-de-bordo.html']
]) {
  for (const width of [390, 850, 1440]) {
    test(`Games carousel: arrows, keyboard and layout (${language}, ${width}px)`, { tag: language === 'pt' && width === 390 ? ['@smoke'] : [] }, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript(() => localStorage.setItem('cookie_consent_status', 'denied'));
      await page.goto(path);
      const track = page.locator('#gamesTrack');
      const previous = page.locator('[data-games-previous]');
      const next = page.locator('[data-games-next]');
      await track.scrollIntoViewIfNeeded();
      await expect(track.locator('.game-block')).toHaveCount(5);
      await expect(previous).toBeDisabled();
      await expect(next).toBeEnabled();
      const bounds = await track.locator('.game-block').evaluateAll(cards => cards.map(card => {
        const { x, y, width, height } = card.getBoundingClientRect();
        return { x, y, width, height };
      }));
      expect(bounds.every(card => Math.abs(card.y - bounds[0].y) < 1)).toBe(true);
      expect(bounds[1].x).toBeGreaterThan(bounds[0].x + bounds[0].width);
      await next.click();
      await expect.poll(() => track.evaluate(el => el.scrollLeft)).toBeGreaterThan(50);
      await expect(previous).toBeEnabled();
      await track.focus();
      await page.keyboard.press('End');
      await expect(next).toBeDisabled();
      await expect(page.locator('[data-games-position]')).toContainText('5 / 5');
      await page.keyboard.press('ArrowLeft');
      await expect(next).toBeEnabled();
      await page.keyboard.press('Home');
      await expect(previous).toBeDisabled();
      await page.keyboard.press('ArrowRight');
      await expect(previous).toBeEnabled();
      await previous.click();
      await expect(previous).toBeDisabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(track.locator('a[href="https://boardgameguru.app/"]')).toHaveCount(1);
    });
  }
}

test('Games carousel remains scrollable without JavaScript at 320px', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 800 } });
  const page = await context.newPage();
  await page.goto('/manual-de-bordo.html');
  const track = page.locator('#gamesTrack');
  await expect(track.locator('.game-block')).toHaveCount(5);
  await expect(page.locator('.games-carousel__controls')).toBeHidden();
  expect(await track.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
  await track.locator('.game-block').last().scrollIntoViewIfNeeded();
  await expect(track.locator('.game-block').last()).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await context.close();
});
