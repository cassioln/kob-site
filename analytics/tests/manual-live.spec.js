import { test, expect } from '@playwright/test';

async function mockPlayer(page) {
  await page.route(/https:\/\/.*youtube(?:-nocookie)?\.com\/.*/, route => route.fulfill({ contentType: 'text/html', body: '<html><body>Mock video</body></html>' }));
  await page.addInitScript(() => {
    window.__liveMock = { instances: [], calls: [], seconds: 0, duration: 4806 };
    window.YT = { Player: class {
      constructor(iframe, options) { this.events = options.events; this.options = options; this.state = -1; window.__liveMock.instances.push(this); }
      seekTo(seconds) { window.__liveMock.seconds = seconds; window.__liveMock.calls.push(['seek', seconds]); }
      playVideo() { window.__liveMock.calls.push(['play']); this.state = 1; this.events.onStateChange({ data: 1 }); }
      pauseVideo() { window.__liveMock.calls.push(['pause']); this.state = 2; this.events.onStateChange({ data: 2 }); }
      getDuration() { return window.__liveMock.duration; }
      getPlayerState() { return this.state; }
      getCurrentTime() { return window.__liveMock.seconds; }
      destroy() { window.__liveMock.calls.push(['destroy']); }
    }};
  });
}
async function openTopics(page) {
  await page.locator('#heroLiveToggleChaptersBtn').click();
  await expect(page.locator('#liveSearchInput')).toBeFocused();
}
async function readyPlayer(page) {
  await expect.poll(() => page.evaluate(() => window.__liveMock.instances.length)).toBeGreaterThan(0);
  await page.evaluate(() => { const player = window.__liveMock.instances.at(-1); player.events.onReady({ target: player }); });
}

test.beforeEach(async ({ page }) => { await mockPlayer(page); });

test('Não carrega terceiros antes da ação e a última seleção aguarda onReady', async ({ page }) => {
  const requests = [];
  page.on('request', request => { if (new URL(request.url()).hostname.includes('youtube')) requests.push(request.url()); });
  await page.goto('/manual-de-bordo.html');
  await expect(page.locator('iframe')).toHaveCount(0);
  expect(requests).toEqual([]);
  await openTopics(page);
  await page.locator('[data-seconds="1345"]').click();
  await expect(page.locator('#heroLiveCinema')).toHaveClass(/is-collapsed/);
  await expect(page.locator('#heroLiveToggleChaptersBtn')).toBeFocused();
  await openTopics(page);
  await page.locator('[data-seconds="4456"]').click();
  await expect(page.locator('#livePlayerContainer iframe')).toHaveCount(1);
  expect(await page.evaluate(() => window.__liveMock.calls)).toEqual([]);
  await readyPlayer(page);
  expect(await page.evaluate(() => window.__liveMock.calls)).toEqual([['seek', 4456], ['play']]);
  await expect(page.locator('#heroLiveTopicStatus')).toContainText('01:14:16');
  await expect(page.locator('#liveChapterNote')).toContainText('23 kg');
  await expect(page.locator('#liveExternalLink')).toHaveAttribute('href', /t=4456s$/);
});

test('Busca nos trechos reais, ignora acentos e pontuação e mantém seleção', async ({ page }) => {
  await page.goto('/manual-de-bordo.html');
  await openTopics(page);
  await page.locator('#liveSearchInput').fill('Wise Nomad');
  const result = page.locator('.live-chapter-item:not([hidden])');
  await expect(result).toHaveCount(1);
  await expect(result.locator('.live-chapter-item__snippet')).toContainText('Transcrição'.toLowerCase());
  await expect(result.locator('mark')).not.toHaveCount(0);
  await result.locator('button').click();
  await readyPlayer(page);
  await openTopics(page);
  await page.locator('#liveSearchInput').fill('fraldas refeicoes');
  await expect(result).toHaveCount(1);
  await expect(result).toContainText('clubinho');
  await page.locator('#liveSearchClearBtn').click();
  await expect(page.locator('[data-selected]')).toHaveAttribute('data-seconds', '1852');
  await expect(page.locator('.live-chapter-item:not([hidden])')).toHaveCount(28);
  await page.locator('#liveSearchInput').fill('eu-vou');
  await expect(result).not.toHaveCount(0);
  await page.locator('#liveSearchInput').fill('<img src=x onerror=alert(1)>');
  await expect(page.locator('#liveEmptyChaptersMsg')).toBeVisible();
  await expect(page.locator('#liveChaptersList img')).toHaveCount(0);
  await page.locator('#liveSearchClearBtn').click();
  await expect(page.locator('#liveSearchInput')).toBeFocused();
});

test('A divergência de bagagem aparece junto da fala original e leva à resposta vigente', async ({ page }) => {
  await page.goto('/manual-de-bordo.html');
  await openTopics(page);
  await page.locator('#liveSearchInput').fill('90 kg');
  const result = page.locator('.live-chapter-item:not([hidden])');
  await expect(result).toHaveCount(1);
  await expect(result.locator('.live-chapter-item__snippet')).toContainText('90 kg');
  await expect(result.locator('.live-chapter-item__notice')).toContainText('23 kg');
  await result.locator('a[href="#faq-o08"]').click();
  await expect(page.locator('#faq-o08')).toHaveAttribute('open', '');
  await expect(page.locator('#faq-o08')).toBeVisible();
});

test('Progresso real do player atualiza o capítulo e a falha mantém alternativa e recuperação', async ({ page }) => {
  await page.goto('/manual-de-bordo.html');
  await page.locator('#loadLivePlayerBtn').click();
  await readyPlayer(page);
  await expect(page.locator('#livePlayerContainer iframe')).toHaveAttribute('src', /start=833/);
  await page.evaluate(() => { window.__liveMock.seconds = 2718; });
  await expect(page.locator('#heroLiveTopicStatus')).toContainText('00:45:15');
  await openTopics(page);
  await expect(page.locator('[aria-current="true"][data-seconds="2715"]')).toHaveCount(1);
  await page.evaluate(() => window.__liveMock.instances[0].events.onError({ data: 100 }));
  await expect(page.locator('#liveVideoError')).toBeVisible();
  await expect(page.locator('#liveExternalLink')).toHaveAttribute('href', /t=2715s$/);
  await page.keyboard.press('Escape');
  await page.locator('#liveRetryBtn').click();
  await expect(page.locator('#livePlayerContainer iframe')).toHaveCount(1);
  await expect(page.locator('#livePlayerContainer iframe')).toHaveAttribute('src', /start=2718/);
  await readyPlayer(page);
  await expect(page.locator('#liveVideoError')).toBeHidden();
});


test('Controles personalizados substituem os controles do YouTube e navegam entre assuntos', async ({ page }) => {
  await page.goto('/manual-de-bordo.html');
  await expect(page.locator('#liveCustomControls')).toBeHidden();
  await page.locator('#loadLivePlayerBtn').click();
  await readyPlayer(page);
  await expect(page.locator('#liveCustomControls')).toBeVisible();
  await expect(page.locator('#liveCustomTopic')).toContainText('Boas-vindas');
  await expect(page.locator('#liveCurrentTime')).toHaveText('13:53');
  await expect(page.locator('#liveDuration')).toHaveText('1:20:06');
  await expect(page.locator('[data-seconds="913"] .live-chapter-item__time')).toHaveText('00:15:13');
  expect(await page.evaluate(() => window.__liveMock.instances[0].options.playerVars.controls)).toBe(0);
  await page.locator('#liveNextChapterBtn').click();
  expect(await page.evaluate(() => window.__liveMock.seconds)).toBe(913);
  await expect(page.locator('#liveCustomTopic')).toContainText('Royal Trip');
  await page.locator('#livePreviousChapterBtn').click();
  expect(await page.evaluate(() => window.__liveMock.seconds)).toBe(833);
});

test('No mobile os controles ficam fora do vídeo e substituem o status textual', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/manual-de-bordo.html');
  await page.locator('#loadLivePlayerBtn').click();
  await readyPlayer(page);
  await expect(page.locator('#liveCustomControls')).toBeVisible();
  await expect.poll(() => page.locator('#liveCustomControls').evaluate(e => getComputedStyle(e).position)).toBe('relative');
  const videoBox = await page.locator('#livePlayerWrapper').boundingBox();
  const controlsBox = await page.locator('#liveCustomControls').boundingBox();
  expect(controlsBox.y).toBeGreaterThanOrEqual(videoBox.y + videoBox.height);
  const tabBox = await page.locator('#heroLiveToggleChaptersBtn').boundingBox();
  expect(tabBox.y + tabBox.height).toBeLessThanOrEqual(videoBox.y + videoBox.height + 1);
  await expect.poll(() => page.locator('#heroLiveTopicStatus').evaluate(e => getComputedStyle(e).display)).toBe('none');
  await expect(page.locator('#liveCustomTopic')).toContainText('Boas-vindas');
});

for (const [lang, term, title, label] of [['en', 'luggage', 'Luggage', 'Portuguese transcript'], ['es', 'equipaje', 'Equipaje', 'portugués']]) {
  test(`Capítulos e busca localizados em ${lang}, transcrição identificada como português`, async ({ page }) => {
    await page.goto(`/${lang}/manual-de-bordo.html`);
    await openTopics(page);
    await page.locator('#liveSearchInput').fill(term);
    const result = page.locator('.live-chapter-item:not([hidden])');
    await expect(result).not.toHaveCount(0);
    await expect(result.filter({ hasText: title }).first()).toBeVisible();
    await expect(page.locator('.live-source-note')).toContainText(lang === 'en' ? 'Portuguese' : 'portugués');
    await page.locator('#liveSearchInput').fill('Wise');
    await expect(page.locator('.live-chapter-item__snippet:not([hidden])')).toContainText(label);
    await expect(page.locator('#liveModal')).toHaveCount(0);
  });
}

for (const width of [320, 390, 768, 1440]) {
  test(`Gaveta e teclado a ${width}px, sem overflow ou mudança no vídeo`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/manual-de-bordo.html');
    await page.locator('#heroLiveCinema').scrollIntoViewIfNeeded();
    const videoBefore = await page.locator('#livePlayerWrapper').boundingBox();
    const tabBefore = await page.locator('#heroLiveToggleChaptersBtn').boundingBox();
    expect(tabBefore.height).toBeGreaterThanOrEqual(176);
    expect(tabBefore.x + tabBefore.width).toBeCloseTo(videoBefore.x + videoBefore.width, 0);
    await openTopics(page);
    expect(await page.locator('.live-drawer__slide').evaluate(e => getComputedStyle(e).transform)).toBe('matrix(1, 0, 0, 1, 0, 0)');
    const videoAfter = await page.locator('#livePlayerWrapper').boundingBox();
    expect(videoAfter.width).toBe(videoBefore.width);
    expect(videoAfter.height).toBe(videoBefore.height);
    const panel = await page.locator('#heroLiveChaptersPanel').boundingBox();
    if (width <= 768) {
      await expect(page.locator('#heroLiveChaptersPanel')).toBeVisible();
      expect(await page.evaluate(() => getComputedStyle(document.getElementById('heroLiveChaptersCol')).position)).toBe('fixed');
      await expect(page.locator('#heroLiveToggleChaptersBtn')).toBeVisible();
      expect(await page.evaluate(() => getComputedStyle(document.getElementById('liveChaptersList')).overflowY)).toBe('auto');
      const mobileDrawer = await page.locator('#heroLiveChaptersCol').boundingBox();
      const mobilePanel = await page.locator('#heroLiveChaptersPanel').boundingBox();
      const mobileTab = await page.locator('#heroLiveToggleChaptersBtn').boundingBox();
      expect(mobilePanel.x).toBeGreaterThan(0);
      expect(mobileDrawer.x).toBe(0);
      expect(mobileTab.x).toBeGreaterThanOrEqual(-28);
      expect(mobileTab.x).toBeLessThanOrEqual(1);
      expect(mobilePanel.x).toBeGreaterThanOrEqual(16);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      await page.keyboard.press('Escape');
      await expect(page.locator('#heroLiveToggleChaptersBtn')).toBeFocused();
      return;
    }
    const tabAfter = await page.locator('#heroLiveToggleChaptersBtn').boundingBox();
    expect(tabAfter.x).toBeLessThan(tabBefore.x);
    expect(tabAfter.x + tabAfter.width).toBeCloseTo(panel.x, 0);
    expect(panel.x).toBeGreaterThanOrEqual(videoAfter.x);
    expect(panel.x + panel.width).toBeLessThanOrEqual(videoAfter.x + videoAfter.width + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.keyboard.press('Escape');
    await expect(page.locator('#heroLiveToggleChaptersBtn')).toBeFocused();
    await expect(page.locator('#heroLiveChaptersPanel')).toHaveAttribute('inert', '');
    await page.keyboard.press('Tab');
    await expect(page.locator('#liveSearchInput')).not.toBeFocused();
  });
}

test('Fullscreen amplia a instância existente e não cria um segundo player', async ({ page }) => {
  await page.goto('/manual-de-bordo.html');
  await page.locator('#loadLivePlayerBtn').click();
  await readyPlayer(page);
  await page.evaluate(() => {
    document.getElementById('livePlayerWrapper').requestFullscreen = async function () { window.__fullscreenTarget = this.id; };
  });
  await page.locator('#liveFullscreenBtn').click();
  expect(await page.evaluate(() => window.__fullscreenTarget)).toBe('livePlayerWrapper');
  await expect(page.locator('iframe')).toHaveCount(1);
  expect(await page.evaluate(() => window.__liveMock.instances.length)).toBe(1);
});

for (const [route, label, placeholder] of [
  ['/manual-de-bordo.html', 'Busque na live:', 'Ex.: embarque, jogos, festas…'],
  ['/en/manual-de-bordo.html', 'Search the recording:', 'E.g. boarding, games, parties…'],
  ['/es/manual-de-bordo.html', 'Busca en la charla:', 'Ej.: embarque, juegos, fiestas…']
]) {
  test(`Textos simplificados e busca funcionando em ${route}`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator('#liveResultsStatus')).toHaveCount(0);
    await expect(page.locator('.live-drawer__intro')).toHaveText(label);
    await expect(page.locator('#liveSearchInput')).toHaveAttribute('placeholder', placeholder);
    await expect(page.locator('.live-privacy-note')).not.toContainText(/cap[ií]tulo|chapter/i);
    await openTopics(page);
    await page.locator('#liveSearchInput').fill('bagagem');
    await expect(page.locator('.live-chapter-item:not([hidden])')).not.toHaveCount(0);
    await page.locator('#liveSearchInput').fill('xyz_sem_resultado');
    await expect(page.locator('#liveEmptyChaptersMsg')).toBeVisible();
    await page.locator('#liveSearchClearBtn').click();
    await expect(page.locator('.live-chapter-item:not([hidden])')).toHaveCount(28);
  });
}

test('A orelha permanece unida ao painel durante a animação', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/manual-de-bordo.html');
  await page.locator('#heroLiveCinema').scrollIntoViewIfNeeded();
  const attachment = () => page.evaluate(() => {
    const tab = document.getElementById('heroLiveToggleChaptersBtn').getBoundingClientRect();
    const panel = document.getElementById('heroLiveChaptersPanel').getBoundingClientRect();
    return { tabX: tab.x, gap: panel.x - tab.right };
  });
  const closed = await attachment();
  await openTopics(page);
  const moving = await attachment();
  expect(moving.gap).toBeCloseTo(0, 0);
  await expect.poll(async () => (await attachment()).tabX).toBeLessThan(closed.tabX - 100);
  expect((await attachment()).gap).toBeCloseTo(0, 0);
  await page.keyboard.press('Escape');
  expect((await attachment()).gap).toBeCloseTo(0, 0);
  await expect.poll(async () => (await attachment()).tabX).toBeCloseTo(closed.tabX, 0);
});

test('Hovers preservam contraste, idioma ativo e fundo do seletor', async ({ page }) => {
  await page.goto('/manual-de-bordo.html');
  await page.locator('[data-cookie-action="deny"]').click();
  const styles = selector => page.locator(selector).first().evaluate(e => {
    const s = getComputedStyle(e);
    return { color: s.color, background: s.backgroundColor, decoration: s.textDecorationLine };
  });
  const switchBackground = (await styles('.guide-header .lang-switch')).background;
  for (const selector of ['.guide-header__home-link', '.guide-header .lang-switch__item:not(.is-active)', '.guide-nav-bar__link.is-active']) {
    await page.locator(selector).first().hover();
    await expect.poll(async () => (await styles(selector)).color).toBe('rgb(255, 255, 255)');
    expect((await styles(selector)).decoration).toBe('none');
  }
  expect((await styles('.guide-header .lang-switch')).background).toBe(switchBackground);
  expect((await styles('.guide-header .lang-switch__item.is-active')).color).toBe('rgb(255, 255, 255)');
  await page.locator('.guide-header .lang-switch__item').last().focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('.guide-header__home-link')).toBeFocused();
  await expect.poll(async () => (await styles('.guide-header__home-link')).color).toBe('rgb(255, 255, 255)');
});

test('Sem JavaScript, há links diretos para todos os capítulos e as respostas continuam disponíveis', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/manual-de-bordo.html');
  await page.locator('.live-noscript summary').click();
  await expect(page.locator('.live-noscript a')).toHaveCount(28);
  await expect(page.locator('#duvidas details.faq-item')).toHaveCount(42);
  await context.close();
});

test('API bloqueada informa a limitação e permite trocar de capítulo no mesmo iframe', async ({ page }) => {
  await page.goto('/manual-de-bordo.html');
  await page.evaluate(() => { delete window.YT; });
  await page.route('https://www.youtube.com/iframe_api', route => route.abort());
  await openTopics(page);
  await page.locator('[data-seconds="1345"]').click();
  await expect(page.locator('#liveVideoError')).toContainText('sincronizar');
  await openTopics(page);
  await page.locator('[data-seconds="1852"]').click();
  await expect(page.locator('#livePlayerContainer iframe')).toHaveCount(1);
  await expect(page.locator('#livePlayerContainer iframe')).toHaveAttribute('src', /start=1852/);
  await expect(page.locator('#liveExternalLink')).toHaveAttribute('href', /t=1852s$/);
});
