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
// The module writes the platform label at init (until then the HTML says "⌘ K"), so wait for it first.
const shortcutKey = async page => {
  await expect(page.locator('[data-site-search-open]').first()).toHaveAttribute('aria-keyshortcuts', /\+K$/);
  return (await page.locator('[data-site-search-kbd]').first().textContent()).includes('⌘') ? 'Meta' : 'Control';
};
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

test('setas mudam a opção ativa e Enter abre o manual na pergunta', { tag: '@smoke' }, async ({ page }) => {
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
    // The FAQ chip's visible text is the shortcut, so its name carries it too (WCAG 2.5.3).
    await expect(page.locator('.faq-search__spotlight')).toHaveText(label);
    await expect(page.locator('.faq-search__spotlight')).toHaveAccessibleName(`Buscar no site inteiro (${label})`);
  });
}

test('consulta com HTML vira texto e o vazio oferece WhatsApp', async ({ page }) => {
  await home(page);
  await pressShortcut(page);
  await input(page).fill('<img src=x onerror=alert(1)>');
  await expect(dialog(page).locator('img')).toHaveCount(0);
  await input(page).fill('xyzqwk');
  await expect(page.locator('.site-search__empty strong')).toHaveText('Nada sobre “xyzqwk” no site.');
  // No href in the page (GA4 would log it): the WhatsApp URL, phone and message, is opened only on click.
  const whatsapp = page.locator('.site-search__whatsapp');
  await expect(whatsapp).not.toHaveAttribute('href', /./);
  expect(await dialog(page).evaluate(node => node.innerHTML)).not.toMatch(/api\.whatsapp\.com|phone=/);
  await page.context().route(/api\.whatsapp\.com/, route => route.fulfill({ contentType: 'text/html', body: '<html></html>' }));
  const [popup] = await Promise.all([page.waitForEvent('popup'), whatsapp.click()]);
  await popup.waitForURL(/api\.whatsapp\.com\/send\?phone=5513981580498&text=/);
  await popup.close();
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
  // Esc and the read in the same task: on a busy machine the 160 ms close could end before a separate read.
  const backdrop = await dialog(page).evaluate(node => {
    node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    return getComputedStyle(node, '::backdrop').animationName;
  });
  expect(backdrop).toBe('site-search-fade-out');
});

test('clique no fundo fecha; arrastar do campo até o fundo não fecha', async ({ page }) => {
  await home(page);
  await pressShortcut(page);
  await input(page).fill('bagagem');
  const box = await input(page).boundingBox();
  // Drag-select the query and let go outside the ticket.
  await page.mouse.move(box.x + box.width - 4, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(8, 8, { steps: 4 });
  await page.mouse.up();
  await expect(dialog(page)).toBeVisible();
  await page.mouse.click(8, 8);
  await expect(dialog(page)).toBeHidden();
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
  pt: { label: 'Buscar no site', placeholder: 'O que você procura?', where: 'Pesquisa no site', faqButton: 'Buscar no site inteiro' },
  en: { label: 'Search the site', placeholder: 'What are you looking for?', where: 'Search the site', faqButton: 'Search the whole site' },
  es: { label: 'Buscar en el sitio', placeholder: '¿Qué estás buscando?', where: 'Buscar en el sitio', faqButton: 'Buscar en todo el sitio' }
};

for (const [path, lang, container] of PAGES) {
  test(`busca disponível em ${path} (${lang})`, { tag: '@smoke' }, async ({ page }) => {
    // No uncaught error anywhere on the page, and no console error coming from the search's own modules.
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error' && /\/assets\/js\/site-search/.test(message.location().url)) errors.push(message.text());
    });
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
    await page.locator('.site-search__input').fill('bus');
    await expect(page.locator('#site-search-results [role="option"]').first()).toBeVisible();
    expect(errors).toEqual([]);
  });
}

// The 6 pages with a FAQ box: the filter's id and the exact question that captions it.
const FAQ_BOXES = [
  ['/', 'pt', '#faq-search', 'O que você precisa saber?'],
  ['/en/', 'en', '#faq-search', 'What would you like to know?'],
  ['/es/', 'es', '#faq-search', '¿Qué necesita saber?'],
  ['/manual-de-bordo.html', 'pt', '#faqSearchInput', 'O que você precisa saber?'],
  ['/en/manual-de-bordo.html', 'en', '#faqSearchInput', 'What do you need to know?'],
  ['/es/manual-de-bordo.html', 'es', '#faqSearchInput', '¿Qué necesitas saber?']
];

for (const [path, lang, faqInput, caption] of FAQ_BOXES) {
  test(`o selo da caixa do FAQ abre a busca global e Ctrl+K não foca mais o FAQ (${path})`, async ({ page }) => {
    await page.route(/https:\/\/.*youtube(?:-nocookie)?\.com\/.*/, route => route.fulfill({ contentType: 'text/html', body: '<html></html>' }));
    await visit(page, path);
    const button = page.locator('.faq-search__spotlight');
    const shortcut = await button.textContent();
    expect(shortcut).toMatch(/^(⌘ K|Ctrl K)$/);
    await expect(button).toHaveAccessibleName(`${TEXT[lang].faqButton} (${shortcut})`);
    await button.click();
    await expect(page.locator('dialog.site-search')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog.site-search')).toBeHidden();
    await page.locator(faqInput).focus();
    await pressShortcut(page);
    await expect(page.locator('.site-search__input')).toBeFocused();
  });

  // The chip sits inside the box's <label>; the filter is named by the question alone.
  test(`o filtro do FAQ se chama só pela pergunta da caixa (${path})`, async ({ page }) => {
    await page.route(/https:\/\/.*youtube(?:-nocookie)?\.com\/.*/, route => route.fulfill({ contentType: 'text/html', body: '<html></html>' }));
    await visit(page, path);
    await expect(page.locator(faqInput)).toHaveAccessibleName(caption);
  });
}

// The global listener ignores the other platform's modifier, so this proves no FAQ handler is left to catch it.
for (const [path, faqInput] of [['/', '#faq-search'], ['/manual-de-bordo.html', '#faqSearchInput']]) {
  test(`a tecla da outra plataforma + K não foca o filtro do FAQ (${path})`, async ({ page }) => {
    await page.route(/https:\/\/.*youtube(?:-nocookie)?\.com\/.*/, route => route.fulfill({ contentType: 'text/html', body: '<html></html>' }));
    await visit(page, path);
    const other = (await shortcutKey(page)) === 'Meta' ? 'Control' : 'Meta';
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press(`${other}+k`);
    await expect(page.locator(faqInput)).not.toBeFocused();
    await expect(dialog(page)).toBeHidden();
  });
}

test('Ctrl+K abre com foco num campo do formulário do busão', async ({ page }) => {
  await visit(page, '/onibus.html');
  await page.locator('#primary-email').focus();
  await pressShortcut(page);
  await expect(page.locator('.site-search__input')).toBeFocused();
});

// Measures the header row for real: every visible control of the right-hand group ends inside the page,
// and whatever sits before it in the row (brand, menu links, down to their text) ends before it starts.
async function expectHeaderFits(page, container, where) {
  await expect(page.locator(`${container} > .site-search-trigger:first-child`), where).toBeVisible();
  const fit = await page.evaluate(selector => {
    const shown = el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
    const right = el => el.getBoundingClientRect().right;
    const group = document.querySelector(selector);
    const controls = [...group.children].filter(shown);
    const start = Math.min(...controls.map(el => el.getBoundingClientRect().left));
    const before = [...group.parentElement.children].filter(el => el !== group && shown(el) && el.getBoundingClientRect().left < start)
      .flatMap(el => [el, ...el.querySelectorAll('*')]).filter(shown).map(right);
    return {
      clientWidth: document.documentElement.clientWidth,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      end: Math.max(...controls.map(right)), start, beforeEnd: Math.max(0, ...before)
    };
  }, container);
  expect(fit.overflow, `${where}: rolagem horizontal`).toBe(0);
  expect(fit.end, `${where}: o grupo da direita passa da borda`).toBeLessThanOrEqual(fit.clientWidth + 0.5);
  expect(fit.beforeEnd, `${where}: marca/menu invadem o grupo da direita`).toBeLessThanOrEqual(fit.start + 0.5);
}

async function scrollHomeNav(page) {
  await page.evaluate(() => document.getElementById('navio').scrollIntoView({ behavior: 'instant' }));
  await expect(page.locator('#nav')).toHaveAttribute('data-scrolled', 'true');
}

for (const width of [320, 390]) {
  test(`os 9 headers cabem a ${width}px com a lupa`, async ({ page }) => {
    await page.route(/https:\/\/.*youtube(?:-nocookie)?\.com\/.*/, route => route.fulfill({ contentType: 'text/html', body: '<html></html>' }));
    await page.setViewportSize({ width, height: 800 });
    for (const [path, , container] of PAGES) {
      await visit(page, path);
      await expectHeaderFits(page, container, `${path} @${width}`);
      if (container !== '.nav__right') continue;
      await scrollHomeNav(page);
      await expectHeaderFits(page, container, `${path} @${width} rolado`);
    }
  });
}

// 1321/1366: the scrolled bar keeps an icon-only button; 1680: the full button and "Confira o" are back.
for (const width of [1321, 1366, 1680]) {
  test(`homes: menu e lupa cabem a ${width}px, no topo e rolado`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    for (const path of ['/', '/en/', '/es/']) {
      await visit(page, path);
      await expect(page.locator('#nav')).toHaveAttribute('data-scrolled', 'false');
      await expectHeaderFits(page, '.nav__right', `${path} @${width} topo`);
      await scrollHomeNav(page);
      await expectHeaderFits(page, '.nav__right', `${path} @${width} rolado`);
      const trigger = page.locator('.nav__right .site-search-trigger');
      // On the navy scrolled bar the button turns white like its neighbours.
      await expect(trigger).toHaveCSS('color', 'rgb(255, 255, 255)');
      await expect(trigger.locator('.site-search-trigger__label')).toBeVisible({ visible: width >= 1680 });
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

// ---------- Chegada no destino ----------

const mockYouTube = page => page.route(/https:\/\/.*youtube(?:-nocookie)?\.com\/.*/, route => route.fulfill({ contentType: 'text/html', body: '<html><body>Mock video</body></html>' }));

// The target is on screen and not under the header that stays on top (fixed or sticky).
async function expectBelowHeader(page, target, header) {
  await expect.poll(async () => page.evaluate(([targetSel, headerSel]) => {
    const top = document.querySelector(targetSel).getBoundingClientRect().top;
    const bar = document.querySelector(headerSel).getBoundingClientRect().bottom;
    return top >= bar - 1 && top < window.innerHeight / 2;
  }, [target, header]), { message: `${target} abaixo de ${header}` }).toBe(true);
}

for (const path of ['/', '/en/', '/es/']) {
  test(`chegada na home abre a pergunta e limpa o filtro do FAQ (${path})`, async ({ page }) => {
    await visit(page, path);
    await page.locator('#faq-search').fill('xyzqwk');
    await expect(page.locator('#faq-h23')).toBeHidden();
    await page.evaluate(() => { location.hash = '#faq-h23'; });
    const item = page.locator('#faq-h23');
    await expect(item).toHaveAttribute('open', '');
    await expect(item).toBeVisible();
    await expect(page.locator('#faq-search')).toHaveValue('');
    await expect(item).toHaveClass(/site-search-arrival/);
    await expect(item.locator('summary')).toBeFocused();
    await expectBelowHeader(page, '#faq-h23', '#nav');
    await expect(item).not.toHaveClass(/site-search-arrival/, { timeout: 4000 });
  });
}

// Phones and tablets: the FAQ topic bar sticks under the home bar, and the question must land below both.
for (const [path, width] of [['/', 390], ['/en/', 390], ['/es/', 390], ['/', 768]]) {
  test(`chegada na home não fica sob a barra de temas do FAQ (${path} @${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await visit(page, `${path}#faq-h23`);
    await expect(page.locator('#faq-h23')).toHaveAttribute('open', '');
    await expectBelowHeader(page, '#faq-h23', '#faq .faq__nav');
  });
}

// A link from another page: the page changes at once (question open, tab selected); the scroll waits for
// the load, and is skipped if the person has already moved meanwhile.
test('link de outra página abre a aba de bebidas na hora e rola até ela', async ({ page }) => {
  // Slow images hold the load event: the tab must be selected before it, the scroll may wait for it.
  await page.route(/\/assets\/images\//, async route => { await new Promise(resolve => setTimeout(resolve, 2500)); await route.continue(); });
  await page.addInitScript(() => localStorage.setItem('cookie_consent_status', 'denied'));
  await page.goto('/#panel-bebidas', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#tab-bebidas')).toHaveAttribute('aria-selected', 'true', { timeout: 1500 });
  expect(await page.evaluate(() => document.readyState)).not.toBe('complete');
  await expect(page.locator('#panel-bebidas')).toBeVisible();
  await expect(page.locator('#tab-bebidas')).toBeFocused();
  await expectBelowHeader(page, '.value-tabs', '#nav');
});

test('rolar enquanto a página carrega não é desfeito pela chegada', async ({ page }) => {
  // Hold the load event for ~4 s with slow images (past the 3 s cap), so there is time to scroll before it.
  await page.route(/\/assets\/images\//, async route => { await new Promise(resolve => setTimeout(resolve, 4000)); await route.continue(); });
  await page.addInitScript(() => {
    localStorage.setItem('cookie_consent_status', 'denied');
    // Counts the arrival's own scrolls to the question (the browser's fragment jump does not go through here).
    window.__landings = 0;
    const scrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (...args) {
      if (this.id === 'faq-h23') window.__landings += 1;
      return scrollIntoView.apply(this, args);
    };
  });
  await page.goto('/#faq-h23', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#faq-h23')).toHaveAttribute('open', '');
  await page.mouse.move(640, 400);
  await page.mouse.wheel(0, 1500);
  await page.waitForFunction(() => document.readyState === 'complete', null, { timeout: 10000 });
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => window.__landings)).toBe(0);
});

test('clicar durante o carregamento (ex.: banner de cookies) não cancela a chegada', async ({ page }) => {
  await page.route(/\/assets\/images\//, async route => { await new Promise(resolve => setTimeout(resolve, 2500)); await route.continue(); });
  await page.addInitScript(() => localStorage.setItem('cookie_consent_status', 'denied'));
  await page.goto('/#faq-h23', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#faq-h23')).toHaveAttribute('open', '');
  // A plain click somewhere (as on the cookie banner): pointerdown + click, no scrolling.
  await page.evaluate(() => { for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) document.body.dispatchEvent(new MouseEvent(type, { bubbles: true })); });
  await expect(page.locator('#faq-h23 summary')).toBeFocused({ timeout: 8000 });
  await expectBelowHeader(page, '#faq-h23', '#nav');
});

test('chegada numa etapa recolhida do cronograma abre a etapa', async ({ page }) => {
  await mockYouTube(page);
  await visit(page, '/manual-de-bordo.html');
  const group = page.locator('#cronograma-embarque');
  await group.locator('.timeline-group__toggle').click();
  await expect(group).toHaveClass(/is-collapsed/);
  await page.evaluate(() => { location.hash = '#cronograma-embarque'; });
  await expect(group).not.toHaveClass(/is-collapsed/);
  await expect(group.locator('.timeline-group__toggle')).toHaveAttribute('aria-expanded', 'true');
});

// The settle step only corrects a small drift: scrolling away right after arriving is not undone.
test('rolar logo depois de chegar não puxa a página de volta para a pergunta', async ({ page }) => {
  await home(page);
  await page.evaluate(() => { location.hash = '#faq-h23'; });
  await expectBelowHeader(page, '#faq-h23', '#nav');
  // Arrive again with the question already in place (as goToAnchor does for a repeated result): no scroll runs.
  await page.evaluate(() => { history.replaceState(null, '', location.pathname); location.hash = '#faq-h23'; });
  await page.mouse.move(640, 400);
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => document.getElementById('faq-h23').getBoundingClientRect().top)).toBeLessThan(-300);
});

for (const path of ['/manual-de-bordo.html', '/en/manual-de-bordo.html', '/es/manual-de-bordo.html']) {
  test(`chegada no manual abre a pergunta e limpa o filtro do FAQ (${path})`, async ({ page }) => {
    await mockYouTube(page);
    await visit(page, path);
    await page.locator('#faqSearchInput').fill('xyzqwk');
    await expect(page.locator('#faq-o08')).toBeHidden();
    await page.evaluate(() => { location.hash = '#faq-o08'; });
    const item = page.locator('#faq-o08');
    await expect(item).toHaveAttribute('open', '');
    await expect(item).toBeVisible();
    await expect(page.locator('#faqSearchInput')).toHaveValue('');
    await expect(item).toHaveClass(/site-search-arrival/);
    await expectBelowHeader(page, '#faq-o08', '.guide-header');
  });

  test(`#live-1250 vindo de outra página pré-seleciona o capítulo e Assistir começa nele (${path})`, async ({ page }) => {
    await mockYouTube(page);
    await visit(page, `${path}#live-1250`);
    await expect(page.locator('#heroLiveCinema')).toBeInViewport();
    await page.locator('#loadLivePlayerBtn').click();
    await expect(page.locator('#livePlayerContainer iframe')).toHaveAttribute('src', /[?&]start=1250(&|$)/);
  });
}

test('resultado da live na mesma página toca no minuto', async ({ page }) => {
  await mockYouTube(page);
  await visit(page, '/manual-de-bordo.html');
  await pressShortcut(page);
  await input(page).fill('estacionamento concais');
  const live = options(page).filter({ hasText: 'Estacionamento no Concais' });
  await expect(live.locator('.site-search__dest-name')).toHaveText('29:25');
  await live.click();
  await expect(dialog(page)).toBeHidden();
  await expect(page.locator('#livePlayerContainer iframe')).toHaveAttribute('src', /[?&]start=1765(&|$)/);
  await expect(page).toHaveURL(/#live-1765$/);
  await expect(page.locator('#heroLiveCinema')).toBeInViewport();
});

test('resultado de FAQ na mesma página abre a pergunta sem recarregar', async ({ page }) => {
  await home(page);
  await page.evaluate(() => { window.__noReload = true; });
  await pressShortcut(page);
  await input(page).fill('vacinado');
  await options(page).filter({ hasText: 'Preciso estar vacinado' }).click();
  await expect(page.locator('#faq-h04')).toHaveAttribute('open', '');
  await expect(page.locator('#faq-h04 summary')).toBeFocused();
  expect(await page.evaluate(() => window.__noReload)).toBe(true);
});

// Drink packages live in the hidden second tab of #valores: the result selects that tab before scrolling.
// The card titles are uppercase; a case-sensitive regex keeps the FAQ answers that mention the package out.
for (const path of ['/', '/en/', '/es/']) {
  test(`resultado de pacote de bebidas abre a aba de bebidas (${path})`, async ({ page }) => {
    await visit(page, path);
    await expect(page.locator('#panel-bebidas')).toBeHidden();
    await pressShortcut(page);
    await input(page).fill('premium extra');
    await options(page).filter({ hasText: /PREMIUM EXTRA/ }).first().click();
    await expect(page.locator('#tab-bebidas')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#panel-bebidas')).toBeVisible();
    await expect(page.locator('#panel-cabines')).toBeHidden();
    await expect(page.locator('#tab-bebidas')).toBeFocused();
    await expectBelowHeader(page, '.value-tabs', '#nav');
  });
}

for (const path of ['/onibus.html', '/en/onibus.html', '/es/onibus.html']) {
  for (const width of [1280, 390]) {
    test(`link para #embarque no busão para abaixo do header fixo (${path} @${width})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await visit(page, `${path}#embarque`);
      await expectBelowHeader(page, '.bus-reassurance #embarque', '.bus-header');
    });
  }
}
