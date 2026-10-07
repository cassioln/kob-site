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

test('Home header shortcut is removed at all widths; desktop and tablet retain their lateral checklist shortcut', async ({ page }) => {
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

test('Checklist panel enters vertically below desktop and laterally only on desktop', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cookie_consent_status', 'denied'));
  for (const [lang, path] of routes) {
    await page.goto(`${path}?lang=${lang}`);
    for (const width of [320, 390, 768, 1023, 1024, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await page.locator('#cronograma').scrollIntoViewIfNeeded();
      const sidebar = page.locator('#checklistSidebar');
      await sidebar.evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished.catch(() => {}))));
      const closed = await sidebar.evaluate(el => {
        const matrix = new DOMMatrix(getComputedStyle(el).transform);
        return { x: matrix.m41, y: matrix.m42 };
      });
      if (width < 1024) {
        expect(closed.x).toBe(0);
        expect(closed.y).toBeGreaterThan(0);
      } else {
        expect(closed.x).toBeLessThan(0);
        expect(closed.y).toBe(0);
      }
      const samples = await page.evaluate(() => new Promise(resolve => {
        const el = document.getElementById('checklistSidebar');
        const values = [];
        document.getElementById('checklistSidebarToggle').click();
        function sample() {
          const matrix = new DOMMatrix(getComputedStyle(el).transform);
          values.push({ x: matrix.m41, y: matrix.m42 });
          if (Math.abs(matrix.m41) < .01 && Math.abs(matrix.m42) < .01) resolve(values);
          else requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      }));
      expect(samples.length).toBeGreaterThan(1);
      if (width < 1024) {
        expect(samples.every(value => value.x === 0)).toBe(true);
        expect(samples[0].y).toBeGreaterThan(samples.at(-1).y);
      } else {
        expect(samples.every(value => value.y === 0)).toBe(true);
        expect(samples[0].x).toBeLessThan(samples.at(-1).x);
      }
      await expect(sidebar).toHaveAttribute('aria-hidden', 'false');
      await page.locator('#checklistSidebarClose').click();
      await expect(sidebar).toHaveAttribute('aria-hidden', 'true');
      await expect.poll(() => sidebar.evaluate(el => {
        const matrix = new DOMMatrix(getComputedStyle(el).transform);
        return innerWidth < 1024 ? matrix.m42 : -matrix.m41;
      })).toBeGreaterThan(300);
    }
  }
});
