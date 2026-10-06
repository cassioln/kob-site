import { test, expect } from '@playwright/test';
import { CHAPTERS, GROUP_INVITE_URL } from '../../assets/js/manual-de-bordo-live-data.js';

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
  // Mobile moves focus into the sheet without raising the keyboard.
  const mobile = await page.evaluate(() => matchMedia('(max-width: 768px)').matches);
  await expect(page.locator(mobile ? '#heroLiveChaptersCloseBtn' : '#liveSearchInput')).toBeFocused();
}
async function readyPlayer(page) {
  await expect.poll(() => page.evaluate(() => window.__liveMock.instances.length)).toBeGreaterThan(0);
  await page.evaluate(() => { const player = window.__liveMock.instances.at(-1); player.events.onReady({ target: player }); });
}

// Advance the mock to the mapped utterance, independent of the topic start.
async function playIntoTopic(page, seconds) {
  await page.evaluate(seconds => { window.__liveMock.seconds = seconds; }, seconds);
  await expect(page.locator('#liveChapterNotice')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(()=>localStorage.setItem('cookie_consent_status','denied'));
  // Scroll instantly in tests: the site's smooth scrolling also animates focus and Playwright's
  // own scrolling, and on a slower machine (CI) the page is still moving when a test measures
  // or hovers something.
  await page.addInitScript(() => {
    const add = () => {
      const style = document.createElement('style');
      style.textContent = 'html { scroll-behavior: auto !important; }';
      (document.head || document.documentElement).append(style);
    };
    if (document.documentElement) add();
    else document.addEventListener('DOMContentLoaded', add, { once: true });
  });
  await mockPlayer(page);
});

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
  await expect(page.locator('#liveCustomTopic')).toContainText('Bagagem');
  await expect(page.locator('#liveChapterNote')).toContainText('23 kg');
  await expect(page.locator('#liveExternalLink')).toHaveAttribute('href', /t=4456s$/);
});

test('Busca nos trechos reais, ignora acentos e pontuação e mantém seleção', async ({ page }) => {
  await page.goto('/manual-de-bordo.html');
  await openTopics(page);
  await page.locator('#liveSearchInput').fill('Wise Nomad');
  const result = page.locator('.live-chapter-item:not([hidden])');
  await expect(result).toHaveCount(1);
  await expect(result.locator('.live-chapter-item__snippet')).toContainText('Wise');
  await expect(result.locator('mark')).not.toHaveCount(0);
  await result.locator('.live-chapter-item__button').click();
  await readyPlayer(page);
  await openTopics(page);
  await page.locator('#liveSearchInput').fill('fraldas refeicoes');
  await expect(result).toHaveCount(1);
  await expect(result).toContainText('clubinho');
  await page.locator('#liveSearchClearBtn').click();
  await expect(page.locator('[data-selected]')).toHaveAttribute('data-seconds', '1852');
  await expect(page.locator('.live-chapter-item:not([hidden])')).toHaveCount(41);
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
  const url=page.url();
  await result.locator('[data-live-faq="faq-o08"]').hover();
  await expect(page.locator('#liveGuidePopover')).toContainText('23 kg');
  await expect(page.locator('#faq-o08')).not.toHaveAttribute('open', '');
  expect(page.url()).toBe(url);
});

test('Progresso real do player atualiza o capítulo e a falha mantém alternativa e recuperação', async ({ page }) => {
  await page.goto('/manual-de-bordo.html');
  await page.locator('#loadLivePlayerBtn').click();
  await readyPlayer(page);
  await expect(page.locator('#livePlayerContainer iframe')).toHaveAttribute('src', /start=833/);
  await page.evaluate(() => { window.__liveMock.seconds = 2718; });
  await expect(page.locator('#liveCustomTopic')).toContainText('Internet');
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
  await expect(page.locator('#liveCurrentTime')).toHaveText('00:00');
  await expect(page.locator('#liveDuration')).toHaveText('01:20');
  await expect(page.locator('[data-seconds="913"] .live-chapter-item__time')).toHaveText('00:15:13');
  expect(await page.evaluate(() => window.__liveMock.instances[0].options.playerVars.controls)).toBe(0);
  expect(await page.evaluate(() => window.__liveMock.instances[0].options.playerVars.disablekb)).toBe(1);
  expect(await page.evaluate(() => window.__liveMock.instances[0].options.playerVars.fs)).toBe(0);
  expect(await page.evaluate(() => window.__liveMock.instances[0].options.playerVars.iv_load_policy)).toBe(3);
  await expect.poll(() => page.locator('#livePlayerContainer iframe').evaluate(e => getComputedStyle(e).pointerEvents)).toBe('none');

  // Play / Pause toggle pelo botão dos controles customizados
  await expect(page.locator('#livePlayPauseBtn .live-control-icon path')).toHaveAttribute('d','M9 5v14M15 5v14');
  await expect(page.locator('#livePlayPauseBtn')).toHaveAttribute('aria-label', /^Pausar:/);
  await page.locator('#livePlayPauseBtn').click();
  expect(await page.evaluate(() => window.__liveMock.calls.at(-1))).toEqual(['pause']);
  await expect(page.locator('#livePlayPauseBtn .live-control-icon path')).toHaveAttribute('d','m8 5 11 7-11 7Z');
  await expect(page.locator('#livePlayPauseBtn')).toHaveAttribute('aria-label', /^Reproduzir:/);

  // Clique no container do vídeo aciona o toggle do player
  await page.locator('#livePlayerContainer').click({ position: { x: 50, y: 50 } });
  expect(await page.evaluate(() => window.__liveMock.calls.at(-1))).toEqual(['play']);
  await expect(page.locator('#livePlayPauseBtn .live-control-icon path')).toHaveAttribute('d','M9 5v14M15 5v14');

  await page.locator('#liveNextChapterBtn').click();
  expect(await page.evaluate(() => window.__liveMock.seconds)).toBe(913);
  await expect(page.locator('#liveCustomTopic')).toContainText('Royal Trip');
  await page.locator('#livePreviousChapterBtn').click();
  expect(await page.evaluate(() => window.__liveMock.seconds)).toBe(833);
});

test('No mobile o assunto fica sobre o vídeo e controles e Assuntos logo abaixo', async ({ page }) => {
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
  expect(tabBox.y).toBeGreaterThanOrEqual(controlsBox.y + controlsBox.height - 1);
  await expect(page.locator('.live-toolbar .live-privacy-note')).toBeVisible();
  const topic = page.locator('#liveCustomTopic');
  await expect(topic).toContainText('Boas-vindas');
  expect(await topic.evaluate(el => el.parentElement.id)).toBe('liveLowerThird');
  const topicBox = await topic.boundingBox();
  expect(topicBox.y + topicBox.height).toBeLessThanOrEqual(videoBox.y + videoBox.height);
  // Without hover, the neighbouring topics are named on the buttons themselves.
  await expect(page.locator('#livePreviousChapterBtn')).toHaveAttribute('data-dir', 'Anterior');
  await expect(page.locator('#liveNextChapterBtn .live-control-label')).toContainText('Royal Trip');
  await expect(page.locator('#liveNextChapterBtn .live-control-label > span')).toHaveCSS('opacity', '1');
  // Same height as play/pause, one line, and long names scroll on their own (no hover on touch).
  const playBox = await page.locator('#livePlayPauseBtn').boundingBox();
  for (const id of ['#livePreviousChapterBtn', '#liveNextChapterBtn']) {
    expect((await page.locator(id).boundingBox()).height).toBeCloseTo(playBox.height, 0);
  }
  const nextLabel = page.locator('#liveNextChapterBtn .live-control-label');
  await expect(nextLabel).toHaveClass(/is-overflowing/);
  await expect(nextLabel.locator('span')).toHaveCSS('white-space', 'nowrap');
  await expect(nextLabel.locator('span')).toHaveCSS('animation-name', 'live-label-marquee');
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
    await expect(page.locator('.live-chapter-item__snippet:not([hidden])')).toContainText('Wise');
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
    const drawerBefore = await page.locator('#heroLiveChaptersCol').boundingBox();
    if (width > 768) {
      expect(drawerBefore.height).toBeCloseTo(videoBefore.height, 0);
      expect(tabBefore.height).toBeGreaterThanOrEqual(176);
      expect(tabBefore.x + tabBefore.width).toBeCloseTo(videoBefore.x + videoBefore.width, 0);
    } else {
      // Mobile: a full-width button under the video instead of a tab over it.
      expect(tabBefore.y).toBeGreaterThanOrEqual(videoBefore.y + videoBefore.height);
      expect(tabBefore.width).toBeCloseTo(videoBefore.width, 0);
    }
    await openTopics(page);
    expect(['matrix(1, 0, 0, 1, 0, 0)', 'none']).toContain(await page.locator('.live-drawer__slide').evaluate(e => getComputedStyle(e).transform));
    const videoAfter = await page.locator('#livePlayerWrapper').boundingBox();
    expect(videoAfter.width).toBe(videoBefore.width);
    expect(videoAfter.height).toBe(videoBefore.height);
    const panel = await page.locator('#heroLiveChaptersPanel').boundingBox();
    if (width <= 768) {
      await expect(page.locator('#heroLiveChaptersPanel')).toBeVisible();
      expect(await page.evaluate(() => getComputedStyle(document.getElementById('heroLiveChaptersPanel')).position)).toBe('fixed');
      expect(await page.evaluate(() => getComputedStyle(document.getElementById('liveChaptersList')).overflowY)).toBe('auto');
      const cinemaZ = Number(await page.evaluate(() => getComputedStyle(document.getElementById('heroLiveCinema')).zIndex));
      expect(cinemaZ).toBeGreaterThanOrEqual(1000);
      // Bottom sheet anchored to the screen's bottom edge, leaving the video in view.
      expect(panel.y + panel.height).toBeCloseTo(900, 0);
      expect(panel.y).toBeGreaterThanOrEqual(videoAfter.y + videoAfter.height);
      expect(panel.x).toBeGreaterThanOrEqual(0);
      expect(panel.x + panel.width).toBeLessThanOrEqual(width);
      const checklistToggle = await page.locator('#checklistSidebarToggle').boundingBox();
      expect(await page.evaluate(() => Number(getComputedStyle(document.getElementById('checklistSidebarToggle')).zIndex))).toBeLessThan(cinemaZ);
      expect(checklistToggle).not.toBeNull();
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
    await expect(page.locator('.live-chapter-item:not([hidden])')).toHaveCount(41);
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
  // Above 1024px the header shows horizontal links instead of the menu button.
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto('/manual-de-bordo.html');
  const styles = selector => page.locator(selector).first().evaluate(e => {
    const s = getComputedStyle(e);
    return { color: s.color, background: s.backgroundColor, decoration: s.textDecorationLine };
  });
  const switchBackground = (await styles('.guide-header .lang-switch')).background;
  for (const selector of ['.guide-header .lang-switch__item:not(.is-active)', '.guide-header .nav__toggle']) {
    await page.locator(selector).first().hover();
    await expect.poll(async () => (await styles(selector)).color).toBe('rgb(255, 255, 255)');
    expect((await styles(selector)).decoration).toBe('none');
  }
  expect((await styles('.guide-header .lang-switch')).background).toBe(switchBackground);
  expect((await styles('.guide-header .lang-switch__item.is-active')).color).toBe('rgb(255, 255, 255)');
  await page.locator('.guide-header .lang-switch__item').last().focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('.guide-header .nav__toggle')).toBeFocused();
  await expect.poll(async () => (await styles('.guide-header .nav__toggle')).color).toBe('rgb(255, 255, 255)');
});

test('Sem JavaScript, há links diretos para todos os capítulos e as respostas continuam disponíveis', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  await page.goto('/manual-de-bordo.html');
  await page.locator('.live-noscript summary').click();
  await expect(page.locator('.live-noscript a')).toHaveCount(41);
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
  await expect(page.locator('#liveChapterNotice')).toBeHidden();
  await expect(page.locator('#liveGroupInvite')).toBeHidden();
});

test('Progresso por assunto: scrub relativo, troca automática e duração final real', async ({ page }) => {
  await page.goto('/manual-de-bordo.html');
  await openTopics(page);
  await page.locator('[data-seconds="2715"]').click();
  await readyPlayer(page);
  await expect(page.locator('#liveProgress')).toHaveAttribute('max', '179');
  await expect(page.locator('#liveCurrentTime')).toHaveText('00:00');
  await expect(page.locator('#liveDuration')).toHaveText('02:59');
  await page.locator('#liveProgress').evaluate(input => { input.value='30'; input.dispatchEvent(new Event('input',{bubbles:true})); });
  expect(await page.evaluate(()=>window.__liveMock.seconds)).toBe(2745);
  await expect(page.locator('#liveCurrentTime')).toHaveText('00:30');
  await page.evaluate(()=>{window.__liveMock.seconds=2894;});
  await expect(page.locator('#liveCustomTopic')).toContainText('Restaurantes');
  await expect(page.locator('#liveProgress')).toHaveAttribute('max','102');
  await openTopics(page);
  await page.locator('[data-seconds="4712"]').click();
  await page.evaluate(()=>{window.__liveMock.duration=4807;window.__liveMock.instances[0].events.onStateChange({data:2});});
  await expect(page.locator('#liveDuration')).toHaveText('01:35');
  await expect(page.locator('#liveNextChapterBtn')).toBeDisabled();
});

test('Desktop: controles dentro do player, assunto acima deles e botões que expandem', async ({ page }) => {
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/manual-de-bordo.html');
  await page.locator('#loadLivePlayerBtn').click();
  await readyPlayer(page);
  expect(await page.locator('#liveCustomControls').evaluate(el=>el.parentElement.id)).toBe('livePlayerWrapper');
  expect(await page.locator('#liveCustomTopic').evaluate(el=>el.parentElement.id)).toBe('liveLowerThird');
  await expect.poll(async()=>{
    const title=await page.locator('#liveCustomTopic').boundingBox();
    const controls=await page.locator('#liveCustomControls').boundingBox();
    return controls.y-title.y-title.height;
  }).toBeGreaterThan(10);
  const video=await page.locator('#livePlayerWrapper').boundingBox();
  const controls=await page.locator('#liveCustomControls').boundingBox();
  const topic=await page.locator('#liveCustomTopic').boundingBox();
  expect(controls.y).toBeGreaterThan(video.y);
  expect(controls.y+controls.height).toBeLessThan(video.y+video.height);
  expect(topic.y+topic.height).toBeLessThan(controls.y);
  await expect(page.locator('#livePreviousChapterBtn')).toBeDisabled();
  const next=page.locator('#liveNextChapterBtn');
  const closed=(await next.boundingBox()).width;
  await next.hover();
  await expect.poll(async()=>(await next.boundingBox()).width).toBeGreaterThan(closed+80);
  await expect(next.locator('.live-control-label')).toContainText('Royal Trip');
  await page.mouse.move(0,0);
  await page.keyboard.press('Tab');
  await page.locator('#livePlayPauseBtn').focus();
  await expect.poll(async()=>(await page.locator('#livePlayPauseBtn').boundingBox()).width).toBeGreaterThan(100);
  await expect(page.locator('#livePlayPauseBtn .live-control-label')).toContainText('Boas-vindas');
  await next.click();
  await page.locator('#livePreviousChapterBtn').hover();
  await expect(page.locator('#livePreviousChapterBtn .live-control-label')).toContainText('Boas-vindas');
  // Resizing repositions the same nodes and keeps the same video instance.
  await page.setViewportSize({width:390,height:844});
  expect(await page.locator('#liveCustomControls').evaluate(el=>el.parentElement.id)).toBe('heroLiveCinema');
  expect(await page.locator('#liveCustomTopic').evaluate(el=>el.parentElement.id)).toBe('liveLowerThird');
  expect(await page.evaluate(()=>window.__liveMock.instances.length)).toBe(1);
});

test('Aviso abaixo do assunto no vídeo e guia em janela paralela, sem navegar ou pausar', async ({ page }) => {
  await page.goto('/manual-de-bordo.html');
  await openTopics(page);
  const row=page.locator('[data-seconds="1250"]');
  await row.hover();
  await expect(row.locator('.live-chapter-item__play')).toHaveCSS('opacity','1');
  await row.click();
  await readyPlayer(page);
  await page.evaluate(() => { window.__liveMock.seconds = 1319; });
  await expect(page.locator('#liveChapterNotice')).toBeVisible();
  const warning=page.locator('#liveChapterNote');
  await expect.poll(async()=>{
    const note=await warning.boundingBox(),controls=await page.locator('#liveCustomControls').boundingBox();
    return controls.y-note.y-note.height;
  }).toBeGreaterThan(10);
  expect(await warning.evaluate(el=>el.parentElement.parentElement.id)).toBe('liveLowerThird');
  expect((await warning.boundingBox()).y).toBeGreaterThan((await page.locator('#liveCustomTopic').boundingBox()).y);
  const url=page.url();
  const trigger=page.locator('#liveChapterNoteAction [data-live-faq]');
  await expect(trigger).toHaveText('Mais detalhes');
  await expect(trigger.locator('svg[aria-hidden="true"]')).toHaveCount(1);
  await expect(trigger).toHaveCSS('cursor','pointer');
  // Stop the page's smooth auto-scroll before testing transfer into the popover.
  await page.evaluate(() => {
    const video = document.getElementById('livePlayerWrapper').getBoundingClientRect();
    window.scrollTo({ top: window.scrollY + video.top - 100, behavior: 'instant' });
  });
  await page.mouse.move(0, 0);
  await expect(page.locator('#liveCustomControls')).not.toHaveClass(/is-visible/, { timeout: 5000 });
  // Class removal starts the retreat; hover transfer needs its settled position.
  await expect.poll(() => page.locator('#liveLowerThird').evaluate(async el => {
    const offset = () => new DOMMatrix(getComputedStyle(el).transform).m42;
    const before = offset();
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    return before === 0 && offset() === 0;
  })).toBe(true);
  await trigger.hover();
  await expect(page.locator('#liveGuidePopover')).toContainText('menores');
  await page.locator('#liveGuidePopover h4').hover();
  await expect(page.locator('#liveGuidePopover')).toBeVisible();
  expect(page.url()).toBe(url);
  expect(await page.evaluate(()=>window.__liveMock.calls.some(call=>call[0]==='pause'))).toBe(false);
  await page.keyboard.press('Escape');
  await expect(page.locator('#liveGuidePopover')).toBeHidden();
  await expect(trigger).toBeFocused();
});

test.describe('Aviso por toque',()=>{
  test.use({hasTouch:true,isMobile:true});
  test('Janela abre por toque, cabe no celular e fecha sem sair do player',async({page})=>{
    await page.setViewportSize({width:390,height:844});
    await page.goto('/manual-de-bordo.html');
    await openTopics(page);
    await page.locator('[data-seconds="4456"]').click();
    await readyPlayer(page);
    // Choosing a topic keeps the sheet open; close it to reach the notice under the video.
    await expect(page.locator('#heroLiveToggleChaptersBtn')).toHaveAttribute('aria-expanded','true');
    await page.locator('#heroLiveChaptersCloseBtn').tap();
    // The notice floats over the video at the mapped luggage utterance.
    await page.evaluate(()=>{ window.__liveMock.seconds=4462; });
    const trigger=page.locator('#liveChapterNoteAction [data-live-faq]');
    await expect(trigger).toBeVisible();
    await trigger.tap();
    await expect(page.locator('#liveGuidePopover')).toContainText('23 kg');
    await expect(page.locator('#liveGuideBackdrop')).toBeVisible();
    const box=await page.locator('#liveGuidePopover').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x+box.width).toBeLessThanOrEqual(390);
    expect(box.y+box.height).toBeCloseTo(844,0);
    await page.locator('.live-guide-popover__close').tap();
    await expect(page.locator('#liveGuidePopover')).toBeHidden();
    expect(await page.evaluate(()=>window.__liveMock.calls.some(call=>call[0]==='pause'))).toBe(false);
  });
});

test('Linha total é discreta, não interativa e acompanha a duração real sem alterar o range do assunto', async ({page})=>{
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/manual-de-bordo.html');
  await page.locator('#loadLivePlayerBtn').click(); await readyPlayer(page);
  const total=page.locator('#liveTotalProgress');
  await expect(total).toBeVisible();
  await expect(total).toHaveJSProperty('max',4806);
  await expect(total).toHaveJSProperty('value',833);
  await expect(page.locator('#liveProgress')).toHaveAttribute('max','80');
  await expect(page.locator('#liveTotalElapsed')).toHaveText('13:53');
  await expect(page.locator('#liveTotalRemaining')).toHaveText('−1:06:13');
  expect((await total.boundingBox()).height).toBeLessThanOrEqual(3);
  expect(await total.evaluate(el=>el.tabIndex)).toBe(-1);
  expect(await total.evaluate(el=>getComputedStyle(el.parentElement).pointerEvents)).toBe('none');
  await page.locator('#liveProgress').evaluate(input=>{input.value='30';input.dispatchEvent(new Event('input',{bubbles:true}));});
  await expect(total).toHaveJSProperty('value',863);
  await expect(page.locator('#liveCurrentTime')).toHaveText('00:30');
  await page.evaluate(()=>{window.__liveMock.duration=4807;window.__liveMock.seconds=4807;window.__liveMock.instances[0].events.onStateChange({data:2});});
  await expect(total).toHaveJSProperty('max',4807);
  await expect(total).toHaveJSProperty('value',4807);
  await expect(page.locator('.live-total-marker[aria-current]')).toHaveAttribute('data-topic-seconds','4712');
  expect(await page.locator('.live-total-marker').first().evaluate(el=>parseFloat(el.style.left))).toBeCloseTo(833/4807*100,5);
  await expect(page.locator('#liveTotalRemaining')).toHaveText('−00:00');
  await expect(total).toHaveAttribute('aria-valuetext',/Restante: 00:00/);
  await page.setViewportSize({width:390,height:844});
  await expect(total).toBeVisible();
  await expect(page.locator('.live-total-timeline')).toHaveAttribute('data-label','Live completa');
  expect(await page.locator('.live-total-markers').evaluate(el=>getComputedStyle(el).pointerEvents)).toBe('auto');
  expect(await page.locator('#liveNextChapterBtn .live-control-icon').evaluate(el=>getComputedStyle(el).order)).toBe('0');
});

for(const [lang,path,home,charter,prefix] of [
  ['pt','/manual-de-bordo.html','Site oficial do evento','Fretado Oficial',''],
  ['en','/en/manual-de-bordo.html','Official event site','Official Charter','/en'],
  ['es','/es/manual-de-bordo.html','Sitio oficial del evento','Autobús Oficial','/es']
]){
 test(`Desktop: identificação na base, seta depois do assunto e menu localizado em ${lang}`,async({page})=>{
  await page.setViewportSize({width:1440,height:1000});await page.goto(path);
  await expect(page.locator('.guide-header__home-link')).toBeHidden();
  // Wide desktop: horizontal links replace the menu button; the logo leads home.
  await expect(page.locator('#navToggle')).toBeHidden();
  await expect(page.locator('.guide-header__brand')).toHaveAttribute('href',`https://kriativosonboard.com.br${prefix}/`);
  await expect(page.locator(`.guide-header__nav-link[href="https://kriativosonboard.com.br${prefix}/onibus.html"]`)).toBeVisible();
  await page.setViewportSize({width:1024,height:1000});
  await page.locator('#navToggle').click();
  await expect(page.locator('#drawer a').filter({hasText:home})).toBeVisible();
  await expect(page.locator('#drawer .guide-menu-desktop').last()).toHaveText(charter);
  await expect(page.locator('#drawer .guide-menu-desktop').last()).toHaveAttribute('href',`https://kriativosonboard.com.br${prefix}/onibus.html`);
  await expect(page.locator('#drawer .guide-menu-mobile')).toBeHidden();
  await page.keyboard.press('Escape');
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('#loadLivePlayerBtn').click();await readyPlayer(page);
  const box=await page.locator('#livePlayerWrapper').boundingBox();
  const title=page.locator('#liveCustomTopic');const t=await title.boundingBox();
  expect(t.x).toBeGreaterThan(box.x+20);
  expect(t.x).toBeLessThan(box.x+25);
  expect(t.y).toBeGreaterThan(box.y+box.height/2);
  const style=await title.evaluate(el=>{const s=getComputedStyle(el);return {font:s.fontFamily,size:parseFloat(s.fontSize),color:s.color,background:s.backgroundImage,shadow:s.textShadow};});
  expect(style.font).toContain('Gobold');expect(style.size).toBeGreaterThan(20);
  expect(style.color).toBe('rgb(255, 255, 255)');expect(style.background).toContain('linear-gradient');expect(style.shadow).not.toBe('none');
  const next=page.locator('#liveNextChapterBtn');await next.hover();
  await expect.poll(async()=>(await next.boundingBox()).width).toBeGreaterThan(100);
  const label=await next.locator('.live-control-label').boundingBox(),icon=await next.locator('.live-control-icon').boundingBox();
  expect(icon.x).toBeGreaterThan(label.x+label.width-1);
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('.guide-header__home-link')).toBeHidden();
  await expect(page.locator('#liveTotalProgress')).toBeVisible();
  await page.locator('#navToggle').click();
  await expect(page.locator('#drawer .guide-menu-desktop').first()).toBeHidden();
  await expect(page.locator('#drawer .guide-menu-mobile')).toBeVisible();
  await expect(page.locator('#drawer .guide-menu-mobile')).toHaveAttribute('href','#transporte');
  await page.setViewportSize({width:600,height:844});
  await expect(page.locator('.guide-header__home-link')).toBeVisible();
 });
}

test('Identificação acompanha o recolhimento real dos controles e retorna suavemente',async({page})=>{
  await page.setViewportSize({width:1440,height:1000});
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.goto('/manual-de-bordo.html');
  await openTopics(page);await page.locator('[data-seconds="1535"]').click();await readyPlayer(page);
  await playIntoTopic(page, 1564);
  const group=page.locator('#liveLowerThird'),controls=page.locator('#liveCustomControls');
  await page.mouse.move(0,0);
  await expect.poll(async()=>{
    const lower=await group.boundingBox(),c=await controls.boundingBox();return c.y-lower.y-lower.height;
  }).toBeGreaterThan(10);
  const raised=await group.evaluate(el=>el.getBoundingClientRect().bottom-el.parentElement.getBoundingClientRect().bottom);
  await expect(controls).not.toHaveClass(/is-visible/,{timeout:5000});
  await expect.poll(async()=>{
    const lower=await group.boundingBox(),video=await page.locator('#livePlayerWrapper').boundingBox();
    return video.y+video.height-lower.y-lower.height;
  }).toBeLessThan(21);
  const lowered=await group.evaluate(el=>el.getBoundingClientRect().bottom-el.parentElement.getBoundingClientRect().bottom);
  expect(lowered-raised).toBeGreaterThan(80);
  await expect(group).toHaveCSS('transition-property','transform');
  await expect(group).toHaveCSS('transition-duration','0.34s');
  await page.locator('#livePlayerWrapper').hover({position:{x:40,y:40}});
  await expect(controls).toHaveClass(/is-visible/);
  await expect.poll(()=>group.evaluate(el=>el.getBoundingClientRect().bottom-el.parentElement.getBoundingClientRect().bottom)).toBeLessThan(lowered-80);
  await page.evaluate(() => { window.__liveMock.seconds = 1564; });
  await expect(page.locator('#liveChapterNotice')).toBeVisible();
  const guide=page.locator('#liveChapterNoteAction [data-live-faq]');await guide.focus();
  await page.waitForTimeout(3400);await expect(controls).toHaveClass(/is-visible/);
  await expect(page.locator('#liveGuidePopover')).toBeVisible();
});

test('Movimento reduzido, resize e fullscreen preservam os mesmos elementos e espaço dos controles',async({page})=>{
  await page.setViewportSize({width:1440,height:1000});await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/manual-de-bordo.html');await openTopics(page);await page.locator('[data-seconds="4456"]').click();await readyPlayer(page);
  expect(await page.locator('#liveLowerThird').evaluate(el=>parseFloat(getComputedStyle(el).transitionDuration))).toBeLessThanOrEqual(.001);
  await expect(page.locator('#liveChapterNotice')).toHaveCSS('animation-name','none');
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('#liveLowerThird')).toBeVisible();
  expect(await page.locator('#liveChapterNote').evaluate(el=>el.parentElement.parentElement.id)).toBe('livePlayerWrapper');
  await page.setViewportSize({width:850,height:1000});
  expect(await page.locator('#liveChapterNote').evaluate(el=>el.parentElement.parentElement.id)).toBe('liveLowerThird');
  await expect(page.locator('#liveLowerThird')).toBeVisible();
  await page.locator('#liveFullscreenBtn').click();
  await expect.poll(()=>page.evaluate(()=>document.fullscreenElement?.id)).toBe('livePlayerWrapper');
  const lower=await page.locator('#liveLowerThird').boundingBox(),controls=await page.locator('#liveCustomControls').boundingBox();
  expect(lower.y+lower.height).toBeLessThan(controls.y);
  expect(await page.evaluate(()=>window.__liveMock.instances.length)).toBe(1);
  await page.evaluate(()=>document.exitFullscreen());
});

for(const [lang,path,title] of [
 ['pt','/manual-de-bordo.html','Cruise Card, cartões e gastos a bordo'],
 ['en','/en/manual-de-bordo.html',null],
 ['es','/es/manual-de-bordo.html',null]
]){
 test(`Marcadores discretos: horários reais, hover, clique e teclado em ${lang}`,async({page})=>{
  await page.setViewportSize({width:1440,height:1000});await page.goto(path);
  await page.locator('#loadLivePlayerBtn').click();await readyPlayer(page);
  const markers=page.locator('#liveCustomControls .live-total-marker');await expect(markers).toHaveCount(41);
  expect(await markers.evaluateAll(els=>els.filter(el=>el.tabIndex===0).length)).toBe(1);
  const position=await page.locator('.live-total-marker[data-topic-seconds="1852"]').evaluate(el=>({left:el.offsetLeft,width:el.parentElement.parentElement.clientWidth}));
  expect(position.left/position.width).toBeCloseTo(1852/4806,2);
  const marker=page.locator('.live-total-marker[data-topic-seconds="1852"]');
  const expected=await marker.getAttribute('aria-label');await marker.hover();
  await expect(page.locator('#liveTotalTooltip')).toBeVisible();
  await expect(page.locator('#liveTotalTooltip')).toContainText(expected.split(' · ')[1]);
  if(title) await expect(page.locator('#liveTotalTooltip')).toContainText(title);
  await page.locator('#liveTotalTooltip').hover();await expect(page.locator('#liveTotalTooltip')).toBeVisible();
  await marker.click();expect(await page.evaluate(()=>window.__liveMock.seconds)).toBe(1852);
  await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
  expect(await page.evaluate(()=>window.__liveMock.seconds)).toBe(913);
  await page.keyboard.press('End');await page.keyboard.press('Space');
  expect(await page.evaluate(()=>window.__liveMock.seconds)).toBe(4712);
  await page.keyboard.press('Escape');await expect(page.locator('#liveTotalTooltip')).toBeHidden();
  const dense=await page.locator('.live-total-marker[data-topic-seconds="4456"]').boundingBox();
  await page.mouse.click(dense.x+dense.width/2,dense.y+dense.height/2);
  expect(await page.evaluate(()=>window.__liveMock.seconds)).toBe(4456);
  expect(await page.evaluate(()=>window.__liveMock.calls.some(call=>call[0]==='pause'))).toBe(false);
  expect(await page.evaluate(()=>window.__liveMock.instances.length)).toBe(1);
  await page.setViewportSize({width:390,height:844});await expect(markers.first()).toBeVisible();
 });
}

for (const [lang, path, details] of [['pt','/manual-de-bordo.html','Mais detalhes'], ['en','/en/manual-de-bordo.html','More details'], ['es','/es/manual-de-bordo.html','Más detalles']]) {
  test(`Detalhes ficam separados do aviso e alinhados à direita entre assuntos (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(path);
    await openTopics(page);
    await page.locator('[data-seconds="1250"]').click();
    await readyPlayer(page);
    await page.evaluate(() => { window.__liveMock.seconds = 1319; });
    await expect(page.locator('#liveChapterNotice')).toBeVisible();
    const note = page.locator('#liveChapterNote');
    const action = page.locator('#liveChapterNoteAction [data-live-faq]');
    await expect(note.locator('button')).toHaveCount(0);
    await expect(action).toHaveText(details);
    const first = await action.boundingBox();
    expect(first.x).toBeGreaterThan((await note.boundingBox()).x + (await note.boundingBox()).width);
    await openTopics(page);
    await page.locator('[data-seconds="4456"]').click();
    await page.evaluate(() => { window.__liveMock.seconds = 4462; });
    await expect(page.locator('#liveChapterNotice')).toBeVisible();
    await expect(note).toContainText('23 kg');
    await playIntoTopic(page, 4462);
    const second = await action.boundingBox();
    expect(second.x + second.width).toBeCloseTo(first.x + first.width, 1);
    await action.hover();
    await expect(page.locator('#liveGuidePopover')).toContainText('23 kg');
    await page.keyboard.press('Escape');
    for (const width of [769, 850]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(page.locator('#heroLiveToggleChaptersBtn')).toHaveAttribute('aria-expanded', 'false');
      expect(await page.locator('#heroLiveChaptersCol').evaluate(el => el.scrollLeft)).toBe(0);
      await expect.poll(() => page.evaluate(() => {
        const action = document.querySelector('#liveChapterNoteAction button').getBoundingClientRect();
        const tab = document.querySelector('#heroLiveToggleChaptersBtn').getBoundingClientRect();
        return action.right < tab.left;
      })).toBe(true);
      const placement = await page.locator('#heroLiveToggleChaptersBtn').evaluate(el => {
        const tab = el.getBoundingClientRect(), drawer = document.getElementById('heroLiveChaptersCol').getBoundingClientRect();
        return { center: tab.top + tab.height / 2 - drawer.top, target: Math.max(95, drawer.height / 4), top: tab.top - drawer.top };
      });
      expect(placement.center).toBeCloseTo(placement.target, 0);
      expect(placement.top).toBeGreaterThanOrEqual(0);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    // Mobile: at the mapped utterance, the notice floats over the video and
    // "details" hangs from its bottom-right corner.
    await expect.poll(() => page.locator('#liveChapterNotice').evaluate(el => el.parentElement.id)).toBe('livePlayerWrapper');
    // The progress clock only runs while the player is on screen, and the resize can scroll it away.
    await page.locator('#livePlayerWrapper').scrollIntoViewIfNeeded();
    await page.evaluate(() => { window.__liveMock.seconds = 4462; });
    await expect(page.locator('#liveChapterNotice')).toBeVisible();
    await expect.poll(() => page.evaluate(() => {
      const action = document.querySelector('#liveChapterNoteAction button').getBoundingClientRect();
      const video = document.querySelector('#livePlayerWrapper').getBoundingClientRect();
      const notice = document.querySelector('#liveChapterNotice').getBoundingClientRect();
      return notice.top >= video.top && action.top >= notice.bottom - 1 && Math.abs(action.right - notice.right) <= 1 && action.bottom <= video.bottom;
    })).toBe(true);
    await openTopics(page);
    await page.locator('.live-chapter-item__button').first().click();
    await expect(page.locator('#liveChapterNotice')).toBeHidden();
    await expect(action).toHaveCount(0);
  });

  test(`Letreiro só percorre nomes longos em hover/foco e respeita redução de movimento (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(path);
    await openTopics(page);
    await page.locator('[data-seconds="1250"]').click();
    await readyPlayer(page);
    const play = page.locator('#livePlayPauseBtn');
    const clip = play.locator('.live-control-label');
    const text = clip.locator('span');
    await page.keyboard.press('Tab');
    await play.focus();
    await expect(clip).toHaveClass(/is-overflowing/);
    await expect.poll(async () => (await play.boundingBox()).width).toBeLessThanOrEqual(180);
    await expect(text).toHaveCSS('animation-name','live-label-marquee');
    await expect.poll(async () => text.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m41)).toBeLessThan(-.25);
    // Instant: the site scrolls smoothly, and a scroll still running would pull the button from under the pointer later.
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    await expect(text).toHaveCSS('animation-play-state','paused');
    await play.scrollIntoViewIfNeeded();
    await expect(text).toHaveCSS('animation-play-state','running');
    expect(await play.getAttribute('aria-label')).toContain(await text.textContent());
    expect(await text.evaluate(el => el.scrollWidth)).toBeGreaterThan(await clip.evaluate(el => el.clientWidth));
    const travel = await clip.evaluate(el => parseFloat(el.style.getPropertyValue('--live-label-travel')));
    await page.setViewportSize({ width: 850, height: 1000 });
    await expect.poll(async () => clip.evaluate(el => parseFloat(el.style.getPropertyValue('--live-label-travel')))).toBeLessThan(travel);
    await play.evaluate(el => el.blur());
    await page.mouse.move(0,0);
    await expect(text).toHaveCSS('animation-name','none');
    await expect.poll(async () => {
      await play.hover();
      return text.evaluate(el => getComputedStyle(el).animationName);
    }).toBe('live-label-marquee');
    await page.emulateMedia({ reducedMotion:'reduce' });
    await play.hover();
    await expect(text).toHaveCSS('animation-name','none');
    await expect(text).toHaveCSS('text-overflow','ellipsis');
    await playIntoTopic(page, 1319);
    await expect(page.locator('#liveChapterNoteAction [data-live-faq]')).toHaveText(details);
    await expect(play).toHaveCSS('background-color','rgb(216, 245, 255)');
    await page.emulateMedia({ reducedMotion:'no-preference' });
    await page.setViewportSize({ width:1440,height:1000 });
    await play.evaluate(el => el.blur());
    await openTopics(page);
    await page.locator('[data-seconds="4456"]').click();
    await play.focus();
    await expect(clip).not.toHaveClass(/is-overflowing/);
    await expect(text).toHaveCSS('animation-name','none');
  });
}

for (const rate of [1, 2]) test(`Entrada automática termina no início do novo assunto, após saída e pausa antecipadas (${rate}x)`, async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.clock.install();
  await page.goto('/manual-de-bordo.html');
  await openTopics(page);
  await page.locator('[data-seconds="1250"]').click();
  await readyPlayer(page);
  // Margin for slower machines (CI): pausing at a time already past throws.
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 1000));
  await page.evaluate(rate => {
    const anchor = Date.now();
    const player = window.__liveMock.instances.at(-1);
    player.getPlaybackRate = () => rate;
    player.getCurrentTime = () => 1345 - 4 * rate + (Date.now() - anchor) / 1000 * rate;
  }, rate);
  const title = page.locator('#liveCustomTopic');
  await page.clock.runFor(1500);
  await expect(title).toHaveAttribute('data-topic-phase', 'exit');
  await expect(title).toContainText('Documentos');
  await page.clock.runFor(160);
  await expect(title).toHaveAttribute('data-topic-phase', 'gap');
  await page.clock.runFor(1970);
  await expect(title).toHaveAttribute('data-topic-phase', 'gap');
  await expect(title).toContainText('Documentos');
  await page.clock.runFor(40);
  await expect(title).toHaveAttribute('data-topic-phase', 'enter');
  await expect(title).toContainText('Vouchers');
  await expect(page.locator('#liveChapterNotice')).not.toBeVisible();
  await page.clock.runFor(400);
  await expect(title).not.toHaveAttribute('data-topic-phase');
  await expect(title).not.toHaveAttribute('aria-busy');
  await expect(title).toHaveCSS('opacity', '1');
  await expect(page.locator('#liveNextChapterBtn')).toHaveAttribute('aria-label', /Mochila/);
  expect(await page.evaluate(() => window.__liveMock.calls.filter(call => call[0] === 'seek'))).toEqual([['seek', 1250]]);
});

test('Escolher outro assunto cancela a antecipação e aguarda a fala para exibir o aviso', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.clock.install();
  await page.goto('/manual-de-bordo.html');
  await openTopics(page);
  await page.locator('[data-seconds="1250"]').click();
  await readyPlayer(page);
  // Margin for slower machines (CI): pausing at a time already past throws.
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 1000));
  await page.evaluate(() => { window.__liveMock.seconds = 1342.5; });
  await page.clock.runFor(1100);
  const title = page.locator('#liveCustomTopic');
  await expect(title).toHaveAttribute('aria-busy', 'true');
  const marker = page.locator('.live-total-marker[data-topic-seconds="4456"]');
  await marker.focus();
  await marker.press('Enter');
  expect(await page.evaluate(() => window.__liveMock.seconds)).toBe(4456);
  await expect(title).toHaveText('Bagagem');
  await expect(title).not.toHaveAttribute('data-topic-phase');
  await expect(page.locator('#liveChapterNote')).toContainText('23 kg');
  await page.clock.runFor(3000);
  await expect(title).toHaveText('Bagagem');
});

test('Pausa, redução de movimento e troca de layout cancelam a antecipação sem mostrar assunto futuro', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/manual-de-bordo.html');
  await openTopics(page);
  await page.locator('[data-seconds="1250"]').click();
  await readyPlayer(page);
  const title = page.locator('#liveCustomTopic');
  await page.evaluate(() => { window.__liveMock.seconds = 1342.5; });
  await expect(title).toHaveAttribute('aria-busy', 'true');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(title).toContainText('Documentos');
  await expect(title).not.toHaveAttribute('data-topic-phase');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { window.__liveMock.seconds = 1345.1; });
  await expect(title).toContainText('Vouchers');
  await expect(title).not.toHaveAttribute('data-topic-phase');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => { window.__liveMock.seconds = 1451; });
  await expect(title).toHaveAttribute('aria-busy', 'true');
  await page.locator('#livePlayPauseBtn').click();
  await expect(title).toContainText('Vouchers');
  await expect(title).not.toHaveAttribute('data-topic-phase');
});

test('Scrub para trás e redução da velocidade restauram o título dentro da janela de antecipação', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.clock.install();
  await page.goto('/manual-de-bordo.html');
  await openTopics(page);
  await page.locator('[data-seconds="1250"]').click();
  await readyPlayer(page);
  // Margin for slower machines (CI): pausing at a time already past throws.
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 1000));
  await page.evaluate(() => {
    window.__liveMock.seconds = 1344.8;
    window.__liveMock.rate = 1;
    window.__liveMock.instances.at(-1).getPlaybackRate = () => window.__liveMock.rate;
  });
  await page.clock.runFor(1100);
  const title = page.locator('#liveCustomTopic');
  await expect(title).toContainText('Vouchers');
  await page.locator('#liveProgress').evaluate(el => {
    el.value = '92';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(await page.evaluate(() => window.__liveMock.seconds)).toBe(1342);
  await expect(title).toContainText('Documentos');
  await expect(title).not.toHaveAttribute('aria-busy');
  await page.clock.runFor(1100);
  await expect(title).not.toHaveAttribute('data-topic-phase');
  await page.evaluate(() => { window.__liveMock.seconds = 1343.4; });
  await page.clock.runFor(20);
  await expect(title).toHaveAttribute('data-topic-phase', 'gap');
  await page.evaluate(() => { window.__liveMock.rate = .5; });
  await page.clock.runFor(20);
  await expect(title).toContainText('Documentos');
  await expect(title).not.toHaveAttribute('aria-busy');
  await expect(title).not.toHaveAttribute('data-topic-phase');
});

test.describe('Mobile com as funções do desktop', () => {
  test.use({ hasTouch: true, isMobile: true });
  test('Assunto antecipa no vídeo, lista em bottom sheet e linha total por toque', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/manual-de-bordo.html');
    await openTopics(page);
    const sheet = page.locator('#heroLiveChaptersPanel');
    const half = await sheet.boundingBox();
    const video = await page.locator('#livePlayerWrapper').boundingBox();
    expect(half.y).toBeGreaterThanOrEqual(video.y + video.height);
    await page.locator('[data-seconds="1250"]').click();
    await readyPlayer(page);
    await expect(page.locator('#heroLiveToggleChaptersBtn')).toHaveAttribute('aria-expanded', 'true');
    await page.locator('#liveSearchInput').focus();
    await expect(page.locator('#heroLiveChaptersCol')).toHaveAttribute('data-sheet', 'full');
    await page.locator('#heroLiveChaptersCloseBtn').tap();
    await expect(sheet).toBeHidden();
    // The title swap anticipates the next topic, as on desktop.
    await page.evaluate(() => { window.__liveMock.seconds = 1342.5; });
    await expect(page.locator('#liveCustomTopic')).toHaveAttribute('aria-busy', 'true');
    // A tap on the whole-live timeline jumps to the nearest topic, once.
    const markers = await page.locator('.live-total-markers').boundingBox();
    await page.touchscreen.tap(markers.x + markers.width * 1852 / 4806, markers.y + markers.height / 2);
    await expect.poll(() => page.evaluate(() => window.__liveMock.seconds)).toBe(1852);
    expect(await page.evaluate(() => window.__liveMock.calls.filter(call => call[0] === 'seek' && call[1] === 1852).length)).toBe(1);
  });
});

for (const width of [390, 1440]) {
  test(`A capa com carregamento cobre o vídeo até ele começar a tocar (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/manual-de-bordo.html');
    await page.locator('#loadLivePlayerBtn').click();
    const loading = page.locator('.live-loading');
    await expect(loading).toBeVisible();
    await expect(loading).toHaveText('Carregando vídeo…');
    await expect(page.locator('#livePlayerFacade')).toBeVisible();
    await expect(page.locator('#loadLivePlayerBtn')).toBeHidden();
    await readyPlayer(page);
    await expect(page.locator('#livePlayerFacade')).toBeHidden();
    await expect(loading).toBeHidden();
  });
}

test('No mobile o aviso entra na fala de menores e recolhe para um selo no canto superior esquerdo', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/manual-de-bordo.html');
  await openTopics(page);
  await page.locator('[data-seconds="1250"]').click();
  await readyPlayer(page);
  await page.locator('#heroLiveChaptersCloseBtn').click();
  const notice = page.locator('#liveChapterNotice');
  await expect(notice).toBeHidden();
  await page.evaluate(() => { window.__liveMock.seconds = 1319; });
  await expect(notice).toBeVisible();
  const video = await page.locator('#livePlayerWrapper').boundingBox();
  const box = await notice.boundingBox();
  expect(box.y).toBeGreaterThanOrEqual(video.y);
  expect(box.y + box.height).toBeLessThan(video.y + video.height);
  // Floating, it does not push the dock down.
  const controls = await page.locator('#liveCustomControls').boundingBox();
  expect(controls.y).toBeLessThanOrEqual(video.y + video.height + 9);
  await page.locator('.live-chapter-notice__collapse').click();
  await expect(notice).toBeHidden();
  const pill = page.locator('.live-notice-pill');
  await expect(pill).toBeVisible();
  await expect(pill).toContainText('Atualização');
  await expect(pill).toBeFocused();
  // Measure the video again: Playwright may scroll the page to click "−".
  const pillBox = await pill.boundingBox();
  const videoNow = await page.locator('#livePlayerWrapper').boundingBox();
  expect(pillBox.y).toBeLessThan(videoNow.y + 20);
  expect(pillBox.x).toBeLessThan(videoNow.x + 20);
  await pill.click();
  await expect(notice).toBeVisible();
  await expect(pill).toBeHidden();
  await expect(page.locator('.live-chapter-notice__collapse')).toBeFocused();
});

test('No desktop o aviso aguarda a fala específica de cada assunto', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/manual-de-bordo.html');
  await openTopics(page);
  await page.locator('[data-seconds="1250"]').click();
  await readyPlayer(page);
  const notice = page.locator('#liveChapterNotice');
  await expect(page.locator('#liveCustomTopic')).toBeVisible();
  await expect(notice).toBeHidden();
  await page.evaluate(() => { window.__liveMock.seconds = 1319; });
  await expect(notice).toBeVisible();
  expect(await notice.evaluate(el => el.parentElement.id)).toBe('liveLowerThird');
  // The luggage update waits for its own mapped utterance.
  await openTopics(page);
  await page.locator('[data-seconds="4456"]').click();
  await expect(notice).toBeHidden();
  await page.evaluate(() => { window.__liveMock.seconds = 4462; });
  await expect(notice).toBeVisible();
});

async function pauseAtLiveTime(page, seconds) {
  await page.evaluate(seconds => {
    window.__liveMock.seconds = seconds;
    window.__liveMock.instances.at(-1).pauseVideo();
  }, seconds);
}

for (const width of [390, 1440]) {
  test(`Os 23 avisos obedecem às falas mapeadas, inclusive ao voltar (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/manual-de-bordo.html');
    await page.locator('#loadLivePlayerBtn').click();
    await readyPlayer(page);
    const notice = page.locator('#liveChapterNotice');
    const note = page.locator('#liveChapterNote');
    for (const topic of CHAPTERS.filter(topic => topic.notice)) {
      await pauseAtLiveTime(page, topic.noticeSeconds - .001);
      await expect(notice).toBeHidden();
      await pauseAtLiveTime(page, topic.noticeSeconds);
      await expect(notice).toBeVisible();
      await expect(note).toContainText(topic.notice.pt);
      await expect(note.locator('.live-notice-label')).toHaveText('ATUALIZAÇÃO');
      await expect(note.locator('svg[aria-hidden="true"]')).toHaveCount(1);
      await pauseAtLiveTime(page, topic.noticeSeconds - 1);
      await expect(notice).toBeHidden();
    }
    await pauseAtLiveTime(page, 4509);
    await expect(notice).toBeHidden();
    // A long delay is tied to the 80s proposal, not to the chapter introduction.
    await pauseAtLiveTime(page, 3217);
    await expect(notice).toBeHidden();
    await pauseAtLiveTime(page, 3271.88);
    await expect(notice).toBeVisible();
    await pauseAtLiveTime(page, 3506);
    await expect(notice).toBeHidden();
  });
}

for (const [path, label, inviteCopy] of [
  ['/manual-de-bordo.html', 'ATUALIZAÇÃO', 'Clique aqui para entrar no grupo'],
  ['/en/manual-de-bordo.html', 'UPDATE', 'Click here to join the group'],
  ['/es/manual-de-bordo.html', 'ACTUALIZACIÓN', 'Haz clic aquí para entrar al grupo']
]) {
  test(`Rótulo com atenção, convite e posicionamento em ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(path);
    await page.locator('#loadLivePlayerBtn').click();
    await readyPlayer(page);
    await pauseAtLiveTime(page, 1319);
    await expect(page.locator('#liveChapterNote .live-notice-label')).toHaveText(label);
    await openTopics(page);
    await page.locator('#liveSearchInput').fill('90 kg');
    await expect(page.locator('.live-chapter-item:not([hidden]) .live-notice-label')).toHaveText(label);
    await page.locator('#heroLiveChaptersCloseBtn').click();
    await pauseAtLiveTime(page, 1356.158);
    const invite = page.locator('#liveGroupInvite');
    await expect(invite).toBeHidden();
    await pauseAtLiveTime(page, 1356.159);
    await expect(invite).toBeVisible();
    await expect(invite).toHaveText(inviteCopy);
    await expect(invite).toHaveAttribute('href', GROUP_INVITE_URL);
    await expect(invite).toHaveAttribute('target', '_blank');
    await expect(invite).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(invite.locator('svg[aria-hidden="true"]')).toHaveCount(1);
    await expect.poll(async () => {
      const box = await invite.boundingBox(), video = await page.locator('#livePlayerWrapper').boundingBox();
      return Math.abs(box.x - video.x - 22) < 2 && Math.abs(box.y - video.y - 18) < 2;
    }).toBe(true);
    await page.setViewportSize({ width: 390, height: 1000 });
    await expect.poll(() => invite.evaluate(el => el.nextElementSibling?.id)).toBe('liveCustomTopic');
    await expect.poll(async () => {
      const box = await invite.boundingBox(), topic = await page.locator('#liveCustomTopic').boundingBox();
      return box.y + box.height <= topic.y - 5;
    }).toBe(true);
    await expect(invite).toHaveCSS('animation-name', 'live-group-invite-in');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(invite).toHaveCSS('animation-name', 'none');
    await pauseAtLiveTime(page, 1368.159);
    await expect(invite).toBeHidden();
    // This "grupo" is a dinner party; it must not display a WhatsApp invitation.
    await pauseAtLiveTime(page, 3024.92);
    await expect(invite).toBeHidden();
  });
}

test('Convite continua estável entre menções próximas e abre o grupo apenas após clique', async ({ page, context }) => {
  await page.goto('/manual-de-bordo.html');
  await page.locator('#loadLivePlayerBtn').click();
  await readyPlayer(page);
  const invite = page.locator('#liveGroupInvite');
  await invite.evaluate(el => {
    window.__inviteEntrances = 0;
    el.addEventListener('animationstart', () => window.__inviteEntrances++);
  });
  await pauseAtLiveTime(page, 4748);
  await expect(invite).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__inviteEntrances)).toBe(1);
  await pauseAtLiveTime(page, 4766);
  await expect(invite).toBeVisible();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(await page.evaluate(() => window.__inviteEntrances)).toBe(1);
  const source = page.url();
  await context.route('https://chat.whatsapp.com/**', route => route.fulfill({ body: 'Grupo de teste' }));
  const opened = page.waitForEvent('popup');
  await invite.click();
  const popup = await opened;
  await expect(popup).toHaveURL(GROUP_INVITE_URL);
  expect(page.url()).toBe(source);
  await popup.close();
  await invite.focus();
  await pauseAtLiveTime(page, 4781.4);
  await expect(invite).toBeHidden();
  await expect(page.locator('#livePlayPauseBtn')).toBeFocused();
  await pauseAtLiveTime(page, 4750);
  await expect(invite).toBeVisible();
});
