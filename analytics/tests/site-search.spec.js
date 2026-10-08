import { expect, test } from '@playwright/test';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

const dialog = page => page.locator('dialog.site-search');
const input = page => page.locator('.site-search__input');
const options = page => page.locator('#site-search-results [role="option"]');

// Most tests start with the cookie choice already made, so the banner stays out of the way.
async function visit(page, path = '/') {
  await page.addInitScript(() => localStorage.setItem('cookie_consent_status', 'denied'));
  await page.goto(path);
}
const home = page => visit(page, '/');

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

for (const [platform, label, keys] of [['macOS', '⌘ K', 'Meta+K'], ['Windows', 'Ctrl K', 'Control+K']]) {
  test(`${platform}: cada botão anuncia só o atalho da plataforma (${keys})`, async ({ page }) => {
    await page.addInitScript(name => Object.defineProperty(Navigator.prototype, 'userAgentData', {
      configurable: true, get: () => ({ platform: name })
    }), platform);
    await home(page);
    await expect(page.locator('.site-search-trigger [data-site-search-kbd]')).toHaveText(label);
    for (const trigger of await page.locator('[data-site-search-open]').all()) {
      await expect(trigger).toHaveAttribute('aria-keyshortcuts', keys);
    }
  });
}

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

test('"Tentar de novo" leva o foco ao campo enquanto carrega, sem cair no body', async ({ page }) => {
  let block = true;
  let release;
  const held = new Promise(resolve => { release = resolve; });
  await page.route('**/assets/data/search-index.pt.json*', async route => {
    if (block) return route.abort();
    await held;
    return route.continue();
  });
  await home(page);
  await pressShortcut(page);
  await expect(page.locator('.site-search__error')).toBeVisible();
  block = false;
  await page.locator('.site-search__retry').click();
  await expect(page.locator('.site-search__lead')).toHaveText('Carregando a busca…');
  await expect(input(page)).toBeFocused();
  release();
  await expect(options(page)).toHaveCount(5);
  await expect(input(page)).toBeFocused();
});

test('com o erro na tela, digitar não reescreve o aviso para o leitor de tela', async ({ page }) => {
  await page.route('**/assets/data/search-index.pt.json*', route => route.abort());
  await home(page);
  await pressShortcut(page);
  await expect(page.locator('#site-search-status')).toHaveText(/Não foi possível carregar a busca/);
  await page.evaluate(() => {
    window.statusWrites = 0;
    new MutationObserver(records => { window.statusWrites += records.length; })
      .observe(document.getElementById('site-search-status'), { childList: true, characterData: true, subtree: true });
  });
  await input(page).pressSequentially('mala');
  await expect(input(page)).toHaveValue('mala');
  await expect(page.locator('.site-search__error')).toBeVisible();
  expect(await page.evaluate(() => window.statusWrites)).toBe(0);
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

const PAGES = [
  ['/', 'pt', '.nav__right'], ['/en/', 'en', '.nav__right'], ['/es/', 'es', '.nav__right'],
  ['/manual-de-bordo.html', 'pt', '.guide-header__actions'], ['/en/manual-de-bordo.html', 'en', '.guide-header__actions'], ['/es/manual-de-bordo.html', 'es', '.guide-header__actions'],
  ['/onibus.html', 'pt', '.bus-header__right'], ['/en/onibus.html', 'en', '.bus-header__right'], ['/es/onibus.html', 'es', '.bus-header__right']
];
const TEXT = {
  pt: { label: 'Buscar no site', placeholder: 'O que você procura?', where: 'Pesquisa no site', faqButton: 'Pesquisar no site inteiro' },
  en: { label: 'Search the site', placeholder: 'What are you looking for?', where: 'Search the site', faqButton: 'Search the whole site' },
  es: { label: 'Buscar en el sitio', placeholder: '¿Qué estás buscando?', where: 'Buscar en el sitio', faqButton: 'Buscar en todo el sitio' }
};

for (const [path, lang, container] of PAGES) {
  test(`busca disponível em ${path} (${lang})`, async ({ page }) => {
    await page.route(/https:\/\/.*youtube(?:-nocookie)?\.com\/.*/, route => route.fulfill({ contentType: 'text/html', body: '<html></html>' }));
    await visit(page, path);
    const trigger = page.locator(`${container} > .site-search-trigger:first-child`);
    await expect(trigger).toHaveAttribute('aria-label', TEXT[lang].label);
    await expect(trigger.locator('[data-site-search-kbd]')).toHaveText(/^(⌘ K|Ctrl K)$/);
    await pressShortcut(page);
    await expect(page.locator('.site-search__input')).toBeFocused();
    await expect(page.locator('.site-search__input')).toHaveAttribute('placeholder', TEXT[lang].placeholder);
    await expect(page.locator('.site-search__where')).toHaveText(TEXT[lang].where);
    await expect(page.locator('#site-search-results [role="option"]')).toHaveCount(5);
  });
}

for (const [path, lang, faqInput] of [['/', 'pt', '#faq-search'], ['/en/', 'en', '#faq-search'], ['/es/', 'es', '#faq-search'], ['/manual-de-bordo.html', 'pt', '#faqSearchInput'], ['/en/manual-de-bordo.html', 'en', '#faqSearchInput'], ['/es/manual-de-bordo.html', 'es', '#faqSearchInput']]) {
  test(`o selo da caixa do FAQ abre a busca global e Ctrl+K não foca mais o FAQ (${path})`, async ({ page }) => {
    await page.route(/https:\/\/.*youtube(?:-nocookie)?\.com\/.*/, route => route.fulfill({ contentType: 'text/html', body: '<html></html>' }));
    await visit(page, path);
    const button = page.locator('.faq-search__spotlight');
    await expect(button).toHaveAttribute('aria-label', TEXT[lang].faqButton);
    await button.click();
    await expect(page.locator('dialog.site-search')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog.site-search')).toBeHidden();
    await page.locator(faqInput).focus();
    await pressShortcut(page);
    await expect(page.locator('.site-search__input')).toBeFocused();
  });
}

test('Ctrl+K abre com foco num campo do formulário do busão', async ({ page }) => {
  await visit(page, '/onibus.html');
  await page.locator('#primary-email').focus();
  await pressShortcut(page);
  await expect(page.locator('.site-search__input')).toBeFocused();
});

for (const width of [320, 390]) {
  test(`headers cabem a ${width}px com a lupa`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    for (const path of ['/', '/manual-de-bordo.html', '/onibus.html']) {
      await visit(page, path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
      await expect(page.locator('.site-search-trigger').first()).toBeVisible();
    }
  });
}

// Shrinking the window must not animate the header pills' size: mid-transition they kept the desktop
// width and, with the search button in the row, the bus header overflowed.
for (const path of ['/onibus.html', '/en/onibus.html', '/es/onibus.html']) {
  test(`header do busão cabe logo depois de a janela encolher (${path})`, async ({ page }) => {
    await visit(page, path);
    await page.setViewportSize({ width: 390, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  });
}
