import { expect, test } from '@playwright/test';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

const PAGES = [
  ['/manual-de-bordo.html', 'pt', 'Regras MSC', 'fumar', 'Fumo', 'Bagagem'],
  ['/en/manual-de-bordo.html', 'en', 'MSC Rules', 'smoking', 'Smoking', 'Luggage'],
  ['/es/manual-de-bordo.html', 'es', 'Reglas de MSC', 'fumar', 'Tabaco', 'Equipaje']
];

async function visit(page, path, width = 1280, hash = '') {
  await page.setViewportSize({ width, height: 800 });
  await page.route(/https:\/\/.*youtube(?:-nocookie)?\.com\/.*/, route => route.fulfill({ contentType: 'text/html', body: '<html></html>' }));
  await page.addInitScript(() => localStorage.setItem('cookie_consent_status', 'denied'));
  await page.goto(path + hash);
  await expect(page.locator('[data-msc-rules]')).toHaveClass(/is-tabbed/);
}

const panel = (page, topic) => page.locator(`#regras-${topic}`);
const tab = (page, topic) => page.locator(`#regras-${topic}-tab`);

// One topic on screen: its tab selected, its panel shown, the other seven hidden.
async function expectOnly(page, topic) {
  await expect(tab(page, topic)).toHaveAttribute('aria-selected', 'true');
  await expect(panel(page, topic)).toBeVisible();
  await expect(page.locator('.msc-rules__panel:visible')).toHaveCount(1);
}

// Every rule of the topic is reachable through the pages, each page fits the list area, and the pager says where you are.
async function expectPagination(page, topic, total) {
  const pager = panel(page, topic).locator('.msc-rules__pager');
  await expect(pager).toBeVisible();
  const status = pager.locator('.msc-rules__page-status');
  const pages = Number((await status.textContent()).match(/(\d+)\D+(\d+)/)[2]);
  expect(pages).toBeGreaterThan(1);
  await expect(pager.locator('button').first()).toBeDisabled();
  const seen = new Set();
  for (let i = 1; i <= pages; i++) {
    await expect(status).toHaveText(new RegExp(`${i}\\D+${pages}`));
    const fit = await panel(page, topic).evaluate(el => {
      const list = el.querySelector('.msc-rules__list').getBoundingClientRect();
      const rows = [...el.querySelectorAll('.msc-rule:not([hidden])')];
      return { texts: rows.map(r => r.textContent.trim()), clipped: rows.some(r => r.getBoundingClientRect().bottom > list.bottom + 1) };
    });
    expect(fit.clipped).toBe(false);
    fit.texts.forEach(text => seen.add(text));
    if (i < pages) await pager.locator('button').last().click();
  }
  await expect(pager.locator('button').last()).toBeDisabled();
  expect(seen.size).toBe(total);
}

// The open topic sits below the sticky guide header, inside the window.
const belowHeader = (page, topic) => expect.poll(() => page.evaluate(id => {
  const top = document.getElementById(id).getBoundingClientRect().top;
  return top >= document.querySelector('.guide-header').getBoundingClientRect().bottom - 1 && top < innerHeight * 0.75;
}, `regras-${topic}`)).toBe(true);

for (const [path, lang, navLabel, query, fumoTitle, bagagemTitle] of PAGES) {
  test(`quadro de regras: 8 temas, um por vez, e o menu leva à seção (${lang})`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await visit(page, path);
    await expect(page.locator('.msc-rules__tab')).toHaveCount(8);
    await expect(page.locator('.msc-rules__tabs')).toHaveAttribute('aria-orientation', 'vertical');
    await expectOnly(page, 'bagagem');
    await expect(panel(page, 'bagagem').locator('h3')).toHaveText(bagagemTitle);
    await expect(page.locator('.msc-rules__sources a[target="_blank"]')).toHaveCount(2);
    await page.locator('.guide-header__nav').getByRole('link', { name: navLabel }).click();
    await expect(page.locator('#regras-msc h2')).toBeInViewport();
    await tab(page, 'fumo').click();
    await expectOnly(page, 'fumo');
    await expect(page).toHaveURL(/#regras-fumo$/);
    expect(errors).toEqual([]);
  });

  test(`setas do teclado trocam de tema (${lang})`, async ({ page }) => {
    await visit(page, path);
    await tab(page, 'bagagem').focus();
    await page.keyboard.press('ArrowDown');
    await expectOnly(page, 'proibidos');
    await expect(tab(page, 'proibidos')).toBeFocused();
    await page.keyboard.press('End');
    await expectOnly(page, 'consequencias');
    await page.keyboard.press('ArrowRight');
    await expectOnly(page, 'bagagem');
  });

  test(`FAQ de bagagem e link direto abrem o tema certo (${lang})`, async ({ page }) => {
    await visit(page, path);
    await tab(page, 'fumo').click();
    const faq = page.locator('#faq-o08');
    await faq.locator('summary').click();
    await faq.locator('a[href="#regras-bagagem"]').click();
    await expectOnly(page, 'bagagem');
    await belowHeader(page, 'bagagem');
    await visit(page, path, 1280, '#regras-menores');
    await expectOnly(page, 'menores');
  });

  test(`busca por fumo abre o tema de fumo (${lang})`, async ({ page }) => {
    await visit(page, path);
    await expect(page.locator('[data-site-search-open]').first()).toHaveAttribute('aria-keyshortcuts', /\+K$/);
    await page.locator('[data-site-search-open]').first().click();
    await page.locator('.site-search__input').fill(query);
    const option = page.locator('#site-search-results [role="option"]').first();
    await expect(option).toContainText(fumoTitle);
    await expect(option.locator('.site-search__dest-name')).toHaveText(navLabel);
    await option.click();
    await expectOnly(page, 'fumo');
    await belowHeader(page, 'fumo');
  });

  test(`quadro tem 560px e pagina as regras que não cabem (${lang})`, async ({ page }) => {
    await visit(page, path);
    await expect(page.locator('#regras-msc .msc-rules__board > .msc-rules__legend')).toHaveCount(0);
    await expect(page.locator('#regras-msc > .guide-container > .msc-rules__legend')).toBeVisible();
    expect(await page.locator('[data-msc-rules]').evaluate(el => el.getBoundingClientRect().height)).toBe(560);
    await tab(page, 'proibidos').click();
    await expectPagination(page, 'proibidos', 8);
  });

  for (const width of [375, 768]) {
    test(`quadro cabe a ${width}px: temas em faixa ou grade, sem rolagem da página (${lang})`, async ({ page }) => {
      await visit(page, path, width);
      await expect(page.locator('.msc-rules__tabs')).toHaveAttribute('aria-orientation', 'horizontal');
      await page.locator('#regras-msc').scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
      // Picking the last topic keeps its chip visible inside the strip.
      await tab(page, 'consequencias').click();
      await expectOnly(page, 'consequencias');
      await expect(tab(page, 'consequencias')).toBeInViewport();
      for (const box of await page.locator('.msc-rules__tab').evaluateAll(tabs => tabs.map(t => t.getBoundingClientRect().height))) {
        expect(box).toBeGreaterThanOrEqual(44);
      }
      expect(await page.locator('[data-msc-rules]').evaluate(el => el.getBoundingClientRect().height)).toBe(560);
      await tab(page, 'bagagem').click();
      await expectPagination(page, 'bagagem', 7);
    });
  }
}
