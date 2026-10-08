import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cookie_consent_status', 'denied'));
});

for (const path of ['/manual-de-bordo.html', '/en/manual-de-bordo.html', '/es/manual-de-bordo.html']) {
  for (const viewport of [{ width: 390, height: 1000 }, { width: 460, height: 1164 }, { width: 1280, height: 1100 }]) {
    test(`Checklist acompanha fim da lista e um clique por aba em ${path} (${viewport.width}px)${path === '/manual-de-bordo.html' && viewport.width === 460 ? ' @smoke' : ''}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(path + '#checklist');
      await expect(page.locator('#checklistSidebar')).toHaveClass(/is-open/);
      const list = page.locator('#checklistSidebarList');
      const tabs = page.locator('.checklist-sidebar__nav');
      const last = tabs.locator('[data-sidebar-group="4"]');
      await list.evaluate(el => el.scrollTo({ top: el.scrollHeight, behavior: 'instant' }));
      await expect(last).toHaveAttribute('aria-selected', 'true');
      await expect(tabs.locator('[aria-selected="true"]')).toHaveCount(1);
      await tabs.locator('[data-sidebar-group="1"]').click();
      await expect.poll(() => list.evaluate(el => Math.abs(
        el.querySelector('[data-group-id="1"]').getBoundingClientRect().top - el.getBoundingClientRect().top - 10
      ))).toBeLessThanOrEqual(2);
      await expect(tabs.locator('[data-sidebar-group="1"]')).toHaveAttribute('aria-selected', 'true');
      await last.click();
      await expect.poll(() => list.evaluate(el => Math.min(
        Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop),
        Math.abs(el.querySelector('[data-group-id="4"]').getBoundingClientRect().top - el.getBoundingClientRect().top - 10)
      ))).toBeLessThanOrEqual(2);
      await expect(last).toHaveAttribute('aria-selected', 'true');
      await expect(last).toHaveAttribute('aria-pressed', 'true');
      // The selected tab must remain stable throughout its smooth scroll.
      await list.evaluate(el => {
        window.__checklistSelections = [];
        const tab = document.querySelector('.checklist-sidebar__nav-item[data-sidebar-group="2"]');
        new MutationObserver(() => window.__checklistSelections.push(tab.getAttribute('aria-selected'))).observe(tab, { attributes: true, attributeFilter: ['aria-selected'] });
      });
      await tabs.locator('[data-sidebar-group="2"]').click();
      await expect.poll(() => list.evaluate(el => {
        const heading = el.querySelector('[data-group-id="2"]').getBoundingClientRect();
        return Math.abs(heading.top - el.getBoundingClientRect().top - 10);
      })).toBeLessThanOrEqual(2);
      await expect(tabs.locator('[data-sidebar-group="2"]')).toHaveAttribute('aria-selected', 'true');
      expect(await page.evaluate(() => window.__checklistSelections)).not.toContain('false');
    });
  }
}

for (const reducedMotion of ['no-preference', 'reduce']) {
  test(`Checklist permite rolagem manual após clicar em uma aba (${reducedMotion})`, async ({ page }) => {
    await page.setViewportSize({ width: 460, height: 1164 });
    await page.emulateMedia({ reducedMotion });
    await page.goto('/manual-de-bordo.html#checklist');
    const list = page.locator('#checklistSidebarList');
    await page.locator('.checklist-sidebar__nav-item[data-sidebar-group="4"]').click();
    await expect.poll(() => list.evaluate(el => el.scrollTop)).toBeGreaterThan(50);
    await list.hover();
    await page.mouse.wheel(0, -9999);
    await expect.poll(() => list.evaluate(el => el.scrollTop)).toBeLessThanOrEqual(2);
    await expect(page.locator('.checklist-sidebar__nav-item[data-sidebar-group="1"]')).toHaveAttribute('aria-selected', 'true');
  });
}
