import { test, expect } from '@playwright/test';

const routes = [['pt', '/manual-de-bordo.html'], ['en', '/en/manual-de-bordo.html'], ['es', '/es/manual-de-bordo.html']];

test('Phone checklist shortcut enters from below, opens and restores focus in all languages', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('cookie_consent_status', 'denied'));
  for (const [lang, path] of routes) {
    await page.goto(`${path}?lang=${lang}`);
    const button = page.locator('#checklistSidebarToggle');
    await expect(button).toHaveClass(/is-hidden/);
    const hidden = await button.evaluate(el => ({ y: new DOMMatrix(getComputedStyle(el).transform).m42, time: getComputedStyle(el).transitionDuration }));
    expect(hidden.y).toBeGreaterThan(50);
    expect(hidden.time).toContain('0.32s');
    await page.locator('#cronograma').scrollIntoViewIfNeeded();
    await expect(button).toBeVisible();
    await expect.poll(() => button.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m42)).toBe(0);
    const box = await button.boundingBox();
    expect(box.x).toBe(12);
    expect(box.height).toBeGreaterThanOrEqual(52);
    expect(box.y + box.height).toBeCloseTo(828, 0);
    expect(box.x + box.width).toBeLessThan(390);
    await button.click();
    await expect(page.locator('#checklistSidebar')).toHaveClass(/is-open/);
    await expect(button).toBeHidden();
    await expect(page.locator('#checklistSidebarClose')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(button).toBeVisible();
    await expect(button).toBeFocused();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
  }
});

test('Home header shortcut is removed at all widths; desktop and tablet retain their lateral checklist', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cookie_consent_status', 'denied'));
  for (const [lang, path] of routes) {
    await page.goto(`${path}?lang=${lang}`);
    for (const width of [320, 600, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(page.locator('.guide-header__home-link')).toHaveCount(0);
      await page.locator('#cronograma').scrollIntoViewIfNeeded();
      const style = await page.locator('#checklistSidebarToggle').evaluate(el => ({ direction: getComputedStyle(el).flexDirection, top: getComputedStyle(el).top }));
      expect(style.direction).toBe(width < 768 ? 'row' : 'column');
      if (width >= 768) expect(style.top).toBe('500px');
    }
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 844 });
  expect(await page.locator('#checklistSidebarToggle').evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s');
});
