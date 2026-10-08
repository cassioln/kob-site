import { expect, test } from '@playwright/test';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cookie_consent_status', 'denied'));
});

const dialog = page => page.locator('dialog.site-search');
const input = page => page.locator('.site-search__input');
const options = page => page.locator('#site-search-results [role="option"]');

test('botão abre o bilhete com "Mais procurados" e o foco no campo', async ({ page }) => {
  await page.goto('/');
  const trigger = page.locator('.nav__right [data-site-search-open]');
  await expect(trigger).toHaveAttribute('aria-label', 'Pesquisar no site');
  await trigger.click();
  await expect(dialog(page)).toBeVisible();
  await expect(input(page)).toBeFocused();
  await expect(input(page)).toHaveAttribute('placeholder', 'O que você procura?');
  await expect(page.locator('.site-search__where')).toHaveText('Pesquisa no site');
  await expect(page.locator('.site-search__lead')).toHaveText('Mais procurados');
  await expect(options(page)).toHaveCount(5);
  await expect(options(page).first()).toContainText('Documentos para embarcar');
});

test('"mala" mostra resultados de bagagem, sinônimo e destino', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  await input(page).fill('mala');
  await expect(page.locator('.site-search__synonyms')).toContainText('mala e bagagem');
  // The typed word ranks first (home FAQ "…levar na mala?"); the synonym brings the manual's luggage answer.
  await expect(options(page).first()).toContainText(/mala/i);
  const luggage = options(page).filter({ hasText: 'Qual é o limite de bagagem da MSC?' });
  await expect(luggage.locator('.site-search__dest-name')).toHaveText('Manual');
  await expect(options(page).first()).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#site-search-status')).toContainText(/resultados?/);
});

test('setas mudam a opção ativa e Enter abre o manual na pergunta', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  await input(page).fill('limite bagagem');
  await expect(options(page).first()).toContainText('Qual é o limite de bagagem da MSC?');
  await page.keyboard.press('ArrowDown');
  await expect(options(page).nth(1)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await page.waitForURL(/\/manual-de-bordo\.html#faq-o08$/);
});

test('Ctrl+K alterna, Esc fecha e devolve o foco; Ctrl+Alt+K não abre', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+Alt+k');
  await expect(dialog(page)).toBeHidden();
  const trigger = page.locator('.nav__right [data-site-search-open]');
  await trigger.focus();
  await page.keyboard.press('Control+k');
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Control+k');
  await page.keyboard.press('Control+k');
  await expect(dialog(page)).toBeHidden();
});

test('consulta com HTML vira texto e o vazio oferece WhatsApp', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  await input(page).fill('<img src=x onerror=alert(1)>');
  await expect(dialog(page).locator('img')).toHaveCount(0);
  await input(page).fill('xyzqwk');
  await expect(page.locator('.site-search__empty strong')).toHaveText('Nada sobre “xyzqwk” no site.');
  await expect(page.locator('.site-search__whatsapp')).toHaveAttribute('href', /api\.whatsapp\.com\/send\?phone=5513981580498/);
  await page.locator('.site-search__try-term', { hasText: 'bagagem' }).click();
  await expect(input(page)).toHaveValue('bagagem');
  await expect(options(page).first()).toContainText(/bagagem/i);
});

test('só stopwords mantém "Mais procurados"', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  await input(page).fill('o que');
  await expect(page.locator('.site-search__lead')).toHaveText('Mais procurados');
  await expect(page.locator('.site-search__empty')).toHaveCount(0);
});

test('falha ao carregar o índice mostra erro e "Tentar de novo" recupera', async ({ page }) => {
  let block = true;
  let requests = 0;
  await page.route('**/assets/data/search-index.pt.json*', route => { requests++; return block ? route.abort() : route.continue(); });
  await page.goto('/');
  await page.keyboard.press('Control+k');
  await expect(page.locator('.site-search__error')).toContainText('Não foi possível carregar a busca.');
  block = false;
  await page.locator('.site-search__retry').click();
  await input(page).fill('bagagem');
  await expect(options(page).first()).toContainText(/bagagem/i);
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  await page.keyboard.press('Control+k');
  await expect(options(page).first()).toContainText(/bagagem/i);
  expect(requests).toBe(2);
});

test('no celular o bilhete ocupa a tela e mostra "Fechar"', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 760 });
  await page.goto('/');
  await page.locator('.nav__right [data-site-search-open]').click();
  const box = await page.locator('.site-search__ticket').boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(370);
  expect(box.height).toBeGreaterThanOrEqual(740);
  await expect(page.locator('.site-search__close')).toBeVisible();
  await expect(page.locator('.site-search__hints')).toBeHidden();
  await page.locator('.site-search__close').click();
  await expect(dialog(page)).toBeHidden();
});

test('movimento reduzido usa só fade', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.keyboard.press('Control+k');
  await expect(page.locator('.site-search__ticket')).toHaveCSS('animation-name', 'site-search-fade');
});
