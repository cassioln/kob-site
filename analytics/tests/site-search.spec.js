import { expect, test } from '@playwright/test';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

const dialog = page => page.locator('dialog.site-search');
const input = page => page.locator('.site-search__input');
const options = page => page.locator('#site-search-results [role="option"]');

// Most tests start with the cookie choice already made, so the banner stays out of the way.
async function home(page) {
  await page.addInitScript(() => localStorage.setItem('cookie_consent_status', 'denied'));
  await page.goto('/');
}

// The trigger's <kbd> names the platform key ("⌘ K" on Apple, "Ctrl K" elsewhere). The page decides the
// platform from its user agent (the Desktop Chrome profile reports Windows), so tests press exactly that key
// instead of ControlOrMeta, which follows the host OS.
const shortcutKey = async page => ((await page.locator('[data-site-search-kbd]').first().textContent()).includes('⌘') ? 'Meta' : 'Control');
const pressShortcut = async (page, extra = '') => page.keyboard.press(`${await shortcutKey(page)}+${extra}k`);
const settled = page => page.waitForFunction(() => document.querySelector('.site-search__ticket')
  .getAnimations({ subtree: true }).every(animation => animation.playState === 'finished'));

test('botão abre o bilhete com "Mais procurados" e o foco no campo', async ({ page }) => {
  await home(page);
  const trigger = page.locator('.nav__right [data-site-search-open]');
  await expect(trigger).toHaveAttribute('aria-label', 'Buscar no site');
  await trigger.click();
  await expect(dialog(page)).toBeVisible();
  await expect(page.locator('html')).toHaveCSS('scrollbar-gutter', 'stable');
  await expect(input(page)).toBeFocused();
  await expect(input(page)).toHaveAttribute('placeholder', 'O que você procura?');
  await expect(page.locator('.site-search__where')).toHaveText('Pesquisa no site');
  await expect(page.locator('.site-search__lead')).toHaveText('Mais procurados');
  await expect(options(page)).toHaveCount(5);
  await expect(options(page).first()).toContainText('Documentos para embarcar');
});

test('"mala" mostra resultados de bagagem, sinônimo e destino', async ({ page }) => {
  await home(page);
  await pressShortcut(page);
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
  await home(page);
  await pressShortcut(page);
  await input(page).fill('limite bagagem');
  await expect(options(page).first()).toContainText('Qual é o limite de bagagem da MSC?');
  await page.keyboard.press('ArrowDown');
  await expect(options(page).nth(1)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await page.waitForURL(/\/manual-de-bordo\.html#faq-o08$/);
});

test('Ctrl+K alterna, Esc fecha e devolve o foco; Ctrl+Alt+K não abre', async ({ page }) => {
  await home(page);
  await pressShortcut(page, 'Alt+');
  await expect(dialog(page)).toBeHidden();
  const trigger = page.locator('.nav__right [data-site-search-open]');
  await trigger.focus();
  await pressShortcut(page);
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  await expect(trigger).toBeFocused();
  await pressShortcut(page);
  await pressShortcut(page);
  await expect(dialog(page)).toBeHidden();
});

test('só a tecla da plataforma abre o bilhete (⌘ no Mac, Ctrl nos outros)', async ({ page }) => {
  await home(page);
  const own = await shortcutKey(page);
  const other = own === 'Meta' ? 'Control' : 'Meta';
  await page.keyboard.press(`${other}+k`);
  await expect(dialog(page)).toBeHidden();
  await page.keyboard.press(`${own}+k`);
  await expect(dialog(page)).toBeVisible();
});

test('consulta com HTML vira texto e o vazio oferece WhatsApp', async ({ page }) => {
  await home(page);
  await pressShortcut(page);
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
  await home(page);
  await pressShortcut(page);
  await input(page).fill('o que');
  await expect(page.locator('.site-search__lead')).toHaveText('Mais procurados');
  await expect(page.locator('.site-search__empty')).toHaveCount(0);
});

test('falha ao carregar o índice mostra erro e "Tentar de novo" recupera', async ({ page }) => {
  let block = true;
  let requests = 0;
  await page.route('**/assets/data/search-index.pt.json*', route => { requests++; return block ? route.abort() : route.continue(); });
  await home(page);
  await pressShortcut(page);
  await expect(page.locator('.site-search__error')).toContainText('Não foi possível carregar a busca.');
  block = false;
  await page.locator('.site-search__retry').click();
  await input(page).fill('bagagem');
  await expect(options(page).first()).toContainText(/bagagem/i);
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  await pressShortcut(page);
  await expect(options(page).first()).toContainText(/bagagem/i);
  expect(requests).toBe(2);
});

test('depois da falha, digitar mantém o erro; nova falha foca "Tentar de novo"', async ({ page }) => {
  let block = true;
  await page.route('**/assets/data/search-index.pt.json*', route => (block ? route.abort() : route.continue()));
  await home(page);
  await pressShortcut(page);
  await expect(page.locator('.site-search__error')).toBeVisible();
  await input(page).fill('bagagem');
  await expect(page.locator('.site-search__error')).toContainText('Não foi possível carregar a busca.');
  await expect(page.locator('.site-search__retry')).toBeVisible();
  await page.locator('.site-search__retry').click();
  await expect(page.locator('.site-search__retry')).toBeFocused();
  block = false;
  await page.locator('.site-search__retry').click();
  await expect(options(page).first()).toContainText(/bagagem/i);
  await expect(input(page)).toBeFocused();
});

test('Esc fecha a busca sem responder ao banner de cookies', async ({ page }) => {
  await page.goto('/');
  const banner = page.locator('[data-cookie-consent]');
  await expect(banner).toHaveAttribute('data-state', 'open');
  await pressShortcut(page);
  await input(page).fill('mala');
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('cookie_consent_status'))).toBeNull();
  await expect(banner).toBeVisible();
  await expect(banner).toHaveAttribute('data-state', 'open');
});

test('resultado na mesma página fica na pergunta, sem voltar para quem abriu', async ({ page }) => {
  // Reduced motion makes every scroll instant, so the final position is deterministic.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await home(page);
  await page.locator('#faq-h34 summary').focus();
  await page.evaluate(() => window.scrollTo(0, 0));
  await pressShortcut(page);
  await input(page).fill('vacinado');
  await options(page).filter({ hasText: 'Preciso estar vacinado para embarcar?' }).click();
  await expect(page).toHaveURL(/#faq-h04$/);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.locator('#faq-h04')).toBeInViewport();
});

test('reabrir durante o fechamento mantém o bilhete aberto', async ({ page }) => {
  await home(page);
  const key = await shortcutKey(page);
  await page.keyboard.press(`${key}+k`);
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press(`${key}+k`);
  await page.waitForTimeout(400); // longer than the 160 ms close animation
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page)).not.toHaveClass(/is-closing/);
});

test('evento close atrasado não desmonta um bilhete já reaberto', async ({ page }) => {
  await home(page);
  await pressShortcut(page);
  await expect(dialog(page)).toBeVisible();
  // Chrome fires "close" asynchronously; a late one from the previous session can land after a reopen.
  await dialog(page).evaluate(node => node.dispatchEvent(new Event('close')));
  await expect(page.locator('html')).toHaveClass(/site-search-open/);
  await expect(input(page)).toHaveAttribute('aria-expanded', 'true');
});

test('ao fechar, o fundo também some com fade', async ({ page }) => {
  await home(page);
  await pressShortcut(page);
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press('Escape');
  const backdrop = await dialog(page).evaluate(node => getComputedStyle(node, '::backdrop').animationName);
  expect(backdrop).toBe('site-search-fade-out');
});

test('Esc e Enter durante a composição (IME) não fecham nem abrem', async ({ page }) => {
  await home(page);
  await pressShortcut(page);
  await input(page).fill('bagagem');
  await expect(options(page).first()).toContainText(/bagagem/i);
  // Read the state synchronously right after the key: a retrying assertion would outlast the 160 ms close.
  const stillOpenAfter = key => input(page).evaluate((node, k) => {
    node.dispatchEvent(new KeyboardEvent('keydown', { key: k, isComposing: true, bubbles: true, cancelable: true }));
    const ticket = node.closest('dialog');
    return ticket.open && !ticket.classList.contains('is-closing');
  }, key);
  expect(await stillOpenAfter('Escape')).toBe(true);
  expect(await stillOpenAfter('Enter')).toBe(true);
  await expect(dialog(page)).toBeVisible();
});

test('no celular o bilhete ocupa a tela e mostra "Fechar"', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 760 });
  await home(page);
  await page.locator('.nav__right [data-site-search-open]').click();
  await settled(page);
  const box = await page.locator('.site-search__ticket').boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(370);
  expect(box.height).toBeGreaterThanOrEqual(740);
  await expect(page.locator('.site-search__close')).toBeVisible();
  await expect(page.locator('.site-search__hints')).toBeHidden();
  await page.locator('.site-search__close').click();
  await expect(dialog(page)).toBeHidden();
});

test('no celular os botões do estado vazio têm 44 px de altura', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 760 });
  await home(page);
  await page.locator('.nav__right [data-site-search-open]').click();
  await input(page).fill('xyzqwk');
  await expect(page.locator('.site-search__try-term').first()).toBeVisible();
  await settled(page);
  const box = await page.locator('.site-search__try-term').first().boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
});

test('movimento reduzido usa só fade', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await home(page);
  await pressShortcut(page);
  await expect(page.locator('.site-search__ticket')).toHaveCSS('animation-name', 'site-search-fade');
});
