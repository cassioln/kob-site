import { expect, test } from '@playwright/test';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

const PAGES = [
  ['/manual-de-bordo.html', 'pt', 'Regras MSC', 'fumar', 'Fumo'],
  ['/en/manual-de-bordo.html', 'en', 'MSC Rules', 'smoking', 'Smoking'],
  ['/es/manual-de-bordo.html', 'es', 'Reglas de MSC', 'fumar', 'Tabaco']
];

async function visit(page, path, width = 1280) {
  await page.setViewportSize({ width, height: 800 });
  await page.route(/https:\/\/.*youtube(?:-nocookie)?\.com\/.*/, route => route.fulfill({ contentType: 'text/html', body: '<html></html>' }));
  await page.addInitScript(() => localStorage.setItem('cookie_consent_status', 'denied'));
  await page.goto(path);
}

// The card sits below the sticky guide header and inside the window.
const belowHeader = page => expect.poll(() => page.evaluate(() => {
  const card = document.querySelector(location.hash).getBoundingClientRect();
  const bar = document.querySelector('.guide-header').getBoundingClientRect();
  return card.top >= bar.bottom - 1 && card.top < innerHeight / 2;
})).toBe(true);

for (const [path, lang, navLabel, query, fumoTitle] of PAGES) {
  test(`Regras da MSC no manual: menu, 8 cards e fontes (${lang})`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await visit(page, path);
    const section = page.locator('#regras-msc');
    await expect(section.locator('.msc-rules__card')).toHaveCount(8);
    await expect(section.locator('.msc-rules__sources a[target="_blank"]')).toHaveCount(2);
    await page.locator('.guide-header__nav').getByRole('link', { name: navLabel }).click();
    await expect(section.locator('h2')).toBeInViewport();
    expect(errors).toEqual([]);
  });

  test(`FAQ de bagagem leva ao card de bagagem das regras (${lang})`, async ({ page }) => {
    await visit(page, path);
    const faq = page.locator('#faq-o08');
    await faq.locator('summary').click();
    await faq.locator('a[href="#regras-bagagem"]').click();
    await expect(page).toHaveURL(/#regras-bagagem$/);
    await belowHeader(page);
  });

  test(`busca por fumo abre o card de fumo das regras (${lang})`, async ({ page }) => {
    await visit(page, path);
    await expect(page.locator('[data-site-search-open]').first()).toHaveAttribute('aria-keyshortcuts', /\+K$/);
    await page.locator('[data-site-search-open]').first().click();
    await page.locator('.site-search__input').fill(query);
    const option = page.locator('#site-search-results [role="option"]').first();
    await expect(option).toContainText(fumoTitle);
    await expect(option.locator('.site-search__dest-name')).toHaveText(navLabel);
    await option.click();
    await expect(page).toHaveURL(/#regras-fumo$/);
    await belowHeader(page);
  });

  test(`cards das regras cabem no celular sem rolagem horizontal (${lang})`, async ({ page }) => {
    await visit(page, path, 375);
    await page.locator('#regras-msc').scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    const widths = await page.locator('.msc-rules__card').evaluateAll(cards => cards.map(card => Math.round(card.getBoundingClientRect().right)));
    for (const right of widths) expect(right).toBeLessThanOrEqual(375);
  });
}
