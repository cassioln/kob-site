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

test.beforeEach(async ({ page }) => { await page.addInitScript(()=>localStorage.setItem('cookie_consent_status','denied')); await mockPlayer(page); });

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
    if (width > 768) expect(drawerBefore.height).toBeCloseTo(videoBefore.height, 0);
    expect(tabBefore.height).toBeGreaterThanOrEqual(176);
    expect(tabBefore.x + tabBefore.width).toBeCloseTo(videoBefore.x + videoBefore.width, 0);
    await openTopics(page);
    expect(['matrix(1, 0, 0, 1, 0, 0)', 'none']).toContain(await page.locator('.live-drawer__slide').evaluate(e => getComputedStyle(e).transform));
    const videoAfter = await page.locator('#livePlayerWrapper').boundingBox();
    expect(videoAfter.width).toBe(videoBefore.width);
    expect(videoAfter.height).toBe(videoBefore.height);
    const panel = await page.locator('#heroLiveChaptersPanel').boundingBox();
    if (width <= 768) {
      await expect(page.locator('#heroLiveChaptersPanel')).toBeVisible();
      expect(await page.evaluate(() => getComputedStyle(document.getElementById('heroLiveChaptersCol')).position)).toBe('fixed');
      await expect(page.locator('#heroLiveToggleChaptersBtn')).toBeVisible();
      expect(await page.evaluate(() => getComputedStyle(document.getElementById('liveChaptersList')).overflowY)).toBe('auto');
      expect(Number(await page.evaluate(() => getComputedStyle(document.getElementById('heroLiveCinema')).zIndex))).toBeGreaterThanOrEqual(1000);
      expect(Number(await page.evaluate(() => getComputedStyle(document.getElementById('heroLiveToggleChaptersBtn')).zIndex))).toBeGreaterThanOrEqual(20);
      const mobileDrawer = await page.locator('#heroLiveChaptersCol').boundingBox();
      const mobilePanel = await page.locator('#heroLiveChaptersPanel').boundingBox();
      const mobileTab = await page.locator('#heroLiveToggleChaptersBtn').boundingBox();
      const checklistToggle = await page.locator('#checklistSidebarToggle').boundingBox();
      expect(mobilePanel.x).toBeGreaterThan(0);
      expect(mobileDrawer.x).toBe(0);
      expect(mobilePanel.x + mobilePanel.width).toBeCloseTo(width, 0);
      expect(mobileTab.x + mobileTab.width).toBeCloseTo(mobilePanel.x, 0);
      expect(mobileTab.x).toBeGreaterThanOrEqual(0);
      expect(await page.evaluate(() => Number(getComputedStyle(document.getElementById('checklistSidebarToggle')).zIndex))).toBeLessThan(Number(await page.locator('#heroLiveChaptersCol').evaluate(el => getComputedStyle(el).zIndex)));
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
  await page.goto('/manual-de-bordo.html');
  const styles = selector => page.locator(selector).first().evaluate(e => {
    const s = getComputedStyle(e);
    return { color: s.color, background: s.backgroundColor, decoration: s.textDecorationLine };
  });
  const switchBackground = (await styles('.guide-header .lang-switch')).background;
  for (const selector of ['.guide-header__home-link', '.guide-header .lang-switch__item:not(.is-active)', '.guide-header .nav__toggle']) {
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

test('Desktop: controles dentro do player, nome no topo e botões que expandem com seus assuntos', async ({ page }) => {
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/manual-de-bordo.html');
  await page.locator('#loadLivePlayerBtn').click();
  await readyPlayer(page);
  expect(await page.locator('#liveCustomControls').evaluate(el=>el.parentElement.id)).toBe('livePlayerWrapper');
  expect(await page.locator('#liveCustomTopic').evaluate(el=>el.parentElement.id)).toBe('livePlayerWrapper');
  const video=await page.locator('#livePlayerWrapper').boundingBox();
  const controls=await page.locator('#liveCustomControls').boundingBox();
  const topic=await page.locator('#liveCustomTopic').boundingBox();
  expect(controls.y).toBeGreaterThan(video.y);
  expect(controls.y+controls.height).toBeLessThan(video.y+video.height);
  expect(topic.y).toBeLessThan(video.y+60);
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
  expect(await page.locator('#liveCustomTopic').evaluate(el=>el.parentElement.id)).toBe('liveCustomControls');
  expect(await page.evaluate(()=>window.__liveMock.instances.length)).toBe(1);
});

test('Aviso acima do vídeo e guia em janela paralela, sem navegar ou pausar', async ({ page }) => {
  await page.goto('/manual-de-bordo.html');
  await openTopics(page);
  const row=page.locator('[data-seconds="1250"]');
  await row.hover();
  await expect(row.locator('.live-chapter-item__play')).toHaveCSS('opacity','1');
  await row.click();
  await readyPlayer(page);
  const warning=page.locator('#liveChapterNote');
  expect((await warning.boundingBox()).y).toBeLessThan((await page.locator('#livePlayerWrapper').boundingBox()).y);
  const url=page.url();
  const trigger=warning.locator('[data-live-faq]');
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
    const trigger=page.locator('#liveChapterNote [data-live-faq]');
    await trigger.tap();
    await expect(page.locator('#liveGuidePopover')).toContainText('23 kg');
    const box=await page.locator('#liveGuidePopover').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x+box.width).toBeLessThanOrEqual(390);
    await page.locator('.live-guide-popover__close').tap();
    await expect(page.locator('#liveGuidePopover')).toBeHidden();
    expect(await page.evaluate(()=>window.__liveMock.calls.some(call=>call[0]==='pause'))).toBe(false);
  });
});
