import { CHAPTERS, LIVE_VIDEO_ID, LIVE_DURATION } from './manual-de-bordo-live-data.js?v=20261005-topic-player';
import { normalizeSearch, matchChapter, highlightParts, excerpt } from './manual-de-bordo-live-search.js?v=20261005-topic-player';

import { topicAt, topicProgress, seekInTopic } from './manual-de-bordo-live-timeline.js?v=20261005-topic-player';
import { initLiveGuideHelp } from './manual-de-bordo-live-help.js?v=20261005-topic-player';
import { initLiveMarkers } from './manual-de-bordo-live-markers.js?v=20261005-lower-third';
import { initLiveControlMarquee } from './manual-de-bordo-live-marquee.js?v=20261005-label-marquee';

const lang = document.documentElement.lang.slice(0, 2);
const copy = {
  pt: {
    topics: 'Assuntos', close: 'Recolher assuntos',
    selected: 'Selecionado', playing: 'Em reprodução', transcript: 'Trecho da transcrição fornecida', updated: 'Regra atualizada', faq: 'Mais detalhes', detailHint: 'Passe o mouse, toque ou use o teclado para ver mais detalhes',
    videoTitle: 'Live de embarque · Kriativos On Board 2026', apiError: 'Não foi possível sincronizar os assuntos. O vídeo ainda pode ser assistido aqui ou pelo link no YouTube.', previousTopic: 'Assunto anterior', nextTopic: 'Próximo assunto', play: 'Reproduzir', pause: 'Pausar', progress: 'Progresso do assunto', remaining: 'Restante', closeGuide: 'Fechar orientação',
    videoError: 'O YouTube não conseguiu reproduzir este vídeo. Tente novamente ou abra o trecho no YouTube.', fullscreenError: 'Não foi possível ampliar. Você pode abrir o vídeo no YouTube.', expand: 'Ampliar vídeo', exit: 'Sair da tela cheia'
  },
  en: {
    topics: 'Topics', close: 'Collapse topics',
    selected: 'Selected', playing: 'Playing', transcript: 'Excerpt of the supplied Portuguese transcript', updated: 'Updated rule', faq: 'More details', detailHint: 'Hover, tap or use the keyboard for more details',
    videoTitle: 'Boarding live recording · Kriativos On Board 2026', apiError: 'Topic synchronisation is unavailable. You can still watch here or open the video on YouTube.', previousTopic: 'Previous topic', nextTopic: 'Next topic', play: 'Play', pause: 'Pause', progress: 'Topic progress', remaining: 'Remaining', closeGuide: 'Close guidance',
    videoError: 'YouTube could not play this video. Try again or open this topic on YouTube.', fullscreenError: 'Full screen is unavailable. You can open the video on YouTube.', expand: 'Expand video', exit: 'Exit full screen'
  },
  es: {
    topics: 'Temas', close: 'Recoger temas',
    selected: 'Seleccionado', playing: 'En reproducción', transcript: 'Fragmento de la transcripción proporcionada en portugués', updated: 'Regla actualizada', faq: 'Más detalles', detailHint: 'Pasa el cursor, toca o usa el teclado para ver más detalles',
    videoTitle: 'Charla de embarque · Kriativos On Board 2026', apiError: 'No se pudieron sincronizar los temas. Puedes seguir viendo aquí o abrir el vídeo en YouTube.', previousTopic: 'Tema anterior', nextTopic: 'Siguiente tema', play: 'Reproducir', pause: 'Pausar', progress: 'Progreso del tema', remaining: 'Restante', closeGuide: 'Cerrar orientación',
    videoError: 'YouTube no pudo reproducir el vídeo. Inténtalo de nuevo o abre este tema en YouTube.', fullscreenError: 'No se pudo ampliar. Puedes abrir el vídeo en YouTube.', expand: 'Ampliar vídeo', exit: 'Salir de pantalla completa'
  }
}[lang] || null;
const cinema = document.getElementById('heroLiveCinema');

if (cinema && copy) initLive();

let apiPromise;
function loadYouTubeAPI() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const previous = window.onYouTubeIframeAPIReady;
    const timeout = setTimeout(() => fail(), 10000);
    function fail() {
      clearTimeout(timeout);
      script.remove();
      if (window.onYouTubeIframeAPIReady === ready) window.onYouTubeIframeAPIReady = previous;
      reject(new Error('YouTube API unavailable'));
    }
    function ready() {
      clearTimeout(timeout);
      if (window.onYouTubeIframeAPIReady === ready) window.onYouTubeIframeAPIReady = previous;
      resolve(window.YT);
      if (typeof previous === 'function') previous();
    }
    window.onYouTubeIframeAPIReady = ready;
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = fail;
    document.head.append(script);
  }).catch(error => { apiPromise = undefined; throw error; });
  return apiPromise;
}

function initLive() {
  const byId = id => document.getElementById(id);
  const desktop = matchMedia('(min-width: 769px)');
  const updateDimensions = () => {
    const controls = byId('liveCustomControls');
    const topic = byId('liveCustomTopic');
    const lowerThird = byId('liveLowerThird');
    const note = byId('liveChapterNote');
    const video = byId('livePlayerWrapper');
    if (desktop.matches) {
      if (controls.parentElement !== video) video.append(controls);
      if (topic.parentElement !== lowerThird) lowerThird.prepend(topic);
      if (note.parentElement !== lowerThird) lowerThird.append(note);
      if (lowerThird.nextElementSibling !== controls) video.insertBefore(lowerThird, controls);
      lowerThird.hidden = topic.hidden;
      if (controls.offsetHeight) video.style.setProperty('--live-controls-offset', `${controls.offsetHeight + 12}px`);
    } else {
      if (controls.parentElement !== cinema) cinema.insertBefore(controls, byId('heroLiveChaptersCol'));
      if (topic.parentElement !== controls) controls.prepend(topic);
      if (note.parentElement !== cinema.parentElement) cinema.before(note);
      lowerThird.hidden = true;
    }
    const h = document.querySelector('.guide-header')?.offsetHeight;
    if (h) document.documentElement.style.setProperty('--guide-header-height', `${h}px`);
    if (window.innerWidth > 768) {
      const playerH = byId('livePlayerWrapper')?.offsetHeight;
      if (playerH) cinema.style.setProperty('--live-player-height', `${playerH}px`);
    } else {
      cinema.style.removeProperty('--live-player-height');
    }
  };
  updateDimensions();
  window.addEventListener('resize', updateDimensions, { passive: true });
  if ('ResizeObserver' in window) {
    const wrap = byId('livePlayerWrapper');
    const dimensionsObserver = new ResizeObserver(updateDimensions);
    if (wrap) dimensionsObserver.observe(wrap);
    dimensionsObserver.observe(byId('liveCustomControls'));
  }
  byId('loadLivePlayerBtn').disabled = false;
  byId('heroLiveToggleChaptersBtn').disabled = false;
  const panel = byId('heroLiveChaptersPanel');
  const toggle = byId('heroLiveToggleChaptersBtn');
  const search = byId('liveSearchInput');
  const clear = byId('liveSearchClearBtn');
  const list = byId('liveChaptersList');
  const facade = byId('livePlayerFacade');
  const container = byId('livePlayerContainer');
  const wrapper = byId('livePlayerWrapper');
  const status = byId('heroLiveTopicStatus');
  const errorBox = byId('liveVideoError');
  const note = byId('liveChapterNote');
  const external = byId('liveExternalLink');
  const fullscreen = byId('liveFullscreenBtn');
  const customControls = byId('liveCustomControls');
  const customTopic = byId('liveCustomTopic');
  const lowerThird = byId('liveLowerThird');
  const playPause = byId('livePlayPauseBtn');
  const previousChapter = byId('livePreviousChapterBtn');
  const nextChapter = byId('liveNextChapterBtn');
  const controlMarquee = initLiveControlMarquee([previousChapter, playPause, nextChapter]);
  const progress = byId('liveProgress');
  const currentTime = byId('liveCurrentTime');
  const duration = byId('liveDuration');
  const totalProgress = byId('liveTotalProgress');
  const totalElapsed = byId('liveTotalElapsed');
  const totalRemaining = byId('liveTotalRemaining');
  let selected = null;
  let current = null;
  let pendingSeconds = 0;
  let player;
  let iframe;
  let ready = false;
  let playing = false;
  let apiFailed = false;
  let visible = true;
  let timer;
  let generation = 0;
  let controlsTimer;
  const rows = [];
  const guideHelp = initLiveGuideHelp(copy);
  const markers = initLiveMarkers({
    track: byId('liveTotalTrack'), chapters: CHAPTERS, lang, label: copy.topics,
    onSelect: chapter => { select(chapter, false); playAt(chapter.seconds); }
  });

  function highlighted(element, text, query) {
    const fragment = document.createDocumentFragment();
    for (const part of highlightParts(text, query)) {
      if (part.match) {
        const mark = document.createElement('mark');
        mark.className = 'search-highlight';
        mark.textContent = part.text;
        fragment.append(mark);
      } else fragment.append(document.createTextNode(part.text));
    }
    element.replaceChildren(fragment);
  }

  function guideLink(chapter) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'live-guide-trigger';
    button.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></svg>';
    button.append(document.createTextNode(copy.faq));
    button.title = copy.detailHint;
    button.dataset.liveFaq = chapter.faqId;
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', 'liveGuidePopover');
    return button;
  }

  for (const chapter of CHAPTERS) {
    const row = document.createElement('li');
    row.className = 'live-chapter-item';
    row.dataset.chapterId = chapter.id;
    const button = document.createElement('button');
    button.className = 'live-chapter-item__button';
    button.type = 'button';
    button.dataset.seconds = chapter.seconds;
    const time = document.createElement('span');
    time.className = 'live-chapter-item__time';
    time.textContent = chapter.time;
    const title = document.createElement('span');
    title.className = 'live-chapter-item__title';
    title.textContent = chapter.titles[lang];
    const playIcon = document.createElement('span');
    playIcon.className = 'live-chapter-item__play';
    playIcon.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4Z"/></svg>';
    button.append(time, title, playIcon);
    const snippet = document.createElement('p');
    snippet.className = 'live-chapter-item__snippet';
    snippet.hidden = true;
    const notice = document.createElement('p');
    notice.className = 'live-chapter-item__notice';
    notice.hidden = true;
    button.addEventListener('click', () => {
      select(chapter, false);
      playAt(chapter.seconds);
      setPanel(false);
    });
    row.append(button, snippet, notice);
    list.append(row);
    rows.push({ chapter, row, button, title, snippet, notice });
  }

  function filter() {
    const query = search.value;
    const hasQuery = Boolean(normalizeSearch(query));
    let count = 0;
    for (const { chapter, row, title, snippet, notice } of rows) {
      row.hidden = !matchChapter(chapter, query, lang);
      if (row.hidden) continue;
      count++;
      highlighted(title, chapter.titles[lang], query);
      const text = hasQuery ? excerpt(chapter.transcript, query) : '';
      snippet.hidden = !text;
      if (text) {
        const body = document.createElement('span');
        highlighted(body, text, query);
        snippet.replaceChildren(document.createTextNode('“'), body, document.createTextNode('”'));
      }
      notice.hidden = !(hasQuery && chapter.notice);
      if (!notice.hidden) {
        const strong = document.createElement('strong');
        strong.textContent = `${copy.updated}: `;
        const body = document.createElement('span');
        highlighted(body, chapter.notice[lang], query);
        notice.replaceChildren(strong, body);
        if (chapter.faqId) notice.append(' ', guideLink(chapter));
      }
    }
    clear.hidden = !search.value;
    byId('liveEmptyChaptersMsg').hidden = count > 0;
  }
  search.addEventListener('input', filter);
  clear.addEventListener('click', () => { search.value = ''; filter(); search.focus(); });

  function setPanel(open, returnFocus = true) {
    cinema.classList.toggle('is-collapsed', !open);
    panel.inert = !open;
    panel.setAttribute('aria-hidden', String(!open));
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? copy.close : copy.topics);
    if (matchMedia('(max-width: 768px)').matches) {
      document.body.classList.toggle('has-live-drawer-open', open);
    }
    if (open) {
      updateDimensions();
      if (matchMedia('(max-width: 768px)').matches) cinema.scrollIntoView({ block: 'start', behavior: 'instant' });
      search.focus({ preventScroll: true });
    } else {
      document.body.classList.remove('has-live-drawer-open');
      if (returnFocus) toggle.focus({ preventScroll: true });
    }
  }
  toggle.addEventListener('click', () => setPanel(toggle.getAttribute('aria-expanded') !== 'true'));
  byId('heroLiveChaptersCloseBtn').addEventListener('click', () => setPanel(false));
  byId('heroLiveChaptersCol').addEventListener('click', event => {
    if (event.target === byId('heroLiveChaptersCol')) setPanel(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      event.preventDefault();
      setPanel(false);
    }
  });
  document.addEventListener('pointerdown', event => {
    if (toggle.getAttribute('aria-expanded') === 'true' && !byId('heroLiveChaptersCol').contains(event.target) && !byId('liveGuidePopover').contains(event.target)) setPanel(false, false);
  });

  function select(chapter, isPlaying) {
    const changed = selected?.id !== chapter.id;
    if (changed) guideHelp.hide();
    selected = chapter;
    if (isPlaying) current = chapter;
    status.textContent = `${isPlaying ? copy.playing : copy.selected} · ${chapter.time} · ${chapter.titles[lang]}`;
    customTopic.textContent = chapter.titles[lang];
    customTopic.hidden = false;
    lowerThird.hidden = !desktop.matches;
    updateTopicButtons();
    updateProgress(chapter.seconds);
    external.href = `https://www.youtube.com/watch?v=${LIVE_VIDEO_ID}&t=${chapter.seconds}s`;
    for (const row of rows) {
      row.button.toggleAttribute('data-selected', row.chapter.id === chapter.id);
      if (isPlaying && row.chapter.id === chapter.id) row.button.setAttribute('aria-current', 'true');
      else row.button.removeAttribute('aria-current');
    }
    note.hidden = !chapter.notice;
    if (chapter.notice && (changed || !note.childNodes.length)) {
      const strong = document.createElement('strong');
      strong.textContent = `${copy.updated}: `;
      note.replaceChildren(strong, document.createTextNode(chapter.notice[lang]));
      if (chapter.faqId) note.append(' ', guideLink(chapter));
    }
  }

  function showError(message) {
    errorBox.hidden = false;
    errorBox.querySelector('p').textContent = message;
  }
  function updateTopicButtons() {
    const index = CHAPTERS.findIndex(topic => topic.id === selected.id);
    for (const [button, topic, action] of [
      [previousChapter, CHAPTERS[index - 1], copy.previousTopic],
      [nextChapter, CHAPTERS[index + 1], copy.nextTopic],
      [playPause, selected, playing ? copy.pause : copy.play]
    ]) {
      const title = topic?.titles[lang] || '';
      button.disabled = !topic;
      const label = button.querySelector('.live-control-label > span');
      if (label.textContent !== title) label.textContent = title;
      button.setAttribute('aria-label', title ? `${action}: ${title}` : action);
      button.title = title ? `${action}: ${title}` : action;
    }
    controlMarquee.refresh();
  }
  function updateProgress(seconds) {
    if (!selected) return;
    const state = topicProgress(selected, seconds, player?.getDuration?.());
    currentTime.textContent = formatTime(state.elapsed);
    duration.textContent = formatTime(state.duration);
    progress.max = String(state.duration);
    progress.value = String(Math.floor(state.elapsed));
    progress.disabled = !ready;
    progress.setAttribute('aria-valuetext', `${formatTime(state.elapsed)} / ${formatTime(state.duration)} · ${selected.titles[lang]}`);
    const actualDuration = Number(player?.getDuration?.());
    const fullDuration = Number.isFinite(actualDuration) && actualDuration > 0 ? actualDuration : LIVE_DURATION;
    const fullElapsed = Math.max(0, Math.min(fullDuration, Number(seconds) || 0));
    const remaining = Math.max(0, fullDuration - fullElapsed);
    totalProgress.max = fullDuration;
    totalProgress.value = fullElapsed;
    markers.update(fullDuration, selected.id);
    totalElapsed.textContent = formatTime(fullElapsed);
    totalRemaining.textContent = `−${formatTime(remaining)}`;
    totalProgress.setAttribute('aria-valuetext', `${formatTime(fullElapsed)} / ${formatTime(fullDuration)} · ${copy.remaining}: ${formatTime(remaining)}`);
  }
  function tick() {
    if (!ready || !player?.getCurrentTime) return;
    const seconds = player.getCurrentTime();
    const chapter = topicAt(seconds);
    if (chapter !== current) { select(chapter, playing); current = chapter; }
    updateProgress(seconds);
  }
  function syncTimer() {
    clearInterval(timer);
    timer = undefined;
    if (ready && playing && visible && !document.hidden) {
      tick();
      timer = setInterval(tick, 1000);
    }
  }
  function formatTime(seconds) {
    const value = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60).toString().padStart(2, '0');
    const secs = String(value % 60).padStart(2, '0');
    return hours ? `${hours}:${minutes}:${secs}` : `${minutes}:${secs}`;
  }
  function updatePlayPauseUI(isPlaying) {
    const icon = playPause.querySelector('.live-control-icon');
    icon.innerHTML = isPlaying ? '<path d="M9 5v14M15 5v14"/>' : '<path d="m8 5 11 7-11 7Z"/>';
    if (selected) updateTopicButtons();
  }

  function revealControls() {
    customControls.classList.add('is-visible');
    clearTimeout(controlsTimer);
    controlsTimer = setTimeout(() => {
      if (desktop.matches && playing && !customControls.matches(':hover,:focus-within') && !lowerThird.matches(':hover,:focus-within')) customControls.classList.remove('is-visible');
    }, 3200);
  }
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      syncTimer();
    });
    observer.observe(cinema);
  }
  document.addEventListener('visibilitychange', syncTimer);
  window.addEventListener('pagehide', () => { clearInterval(timer); });

  function embedURL(seconds, nativeControls = false) {
    const url = new URL(`https://www.youtube-nocookie.com/embed/${LIVE_VIDEO_ID}`);
    url.search = new URLSearchParams({
      autoplay: '1',
      start: String(seconds),
      enablejsapi: '1',
      playsinline: '1',
      controls: nativeControls ? '1' : '0',
      disablekb: nativeControls ? '0' : '1',
      fs: nativeControls ? '1' : '0',
      iv_load_policy: '3',
      modestbranding: '1',
      rel: '0',
      origin: location.origin
    });
    return url.href;
  }
  async function connect(myGeneration) {
    try {
      const YT = await loadYouTubeAPI();
      if (myGeneration !== generation || !iframe) return;
      player = new YT.Player(iframe, {
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          rel: 0,
          playsinline: 1
        },
        events: {
          onReady: event => {
            if (myGeneration !== generation) return;
            player = event.target;
            ready = true;
            apiFailed = false;
            errorBox.hidden = true;
            customControls.hidden = false;
            updateDimensions();
            wrapper.classList.remove('has-api-error');
            updateProgress(pendingSeconds);
            player.seekTo(pendingSeconds, true);
            player.playVideo();
            updatePlayPauseUI(true);
            revealControls();
            syncTimer();
          },
          onStateChange: event => {
            if (myGeneration !== generation) return;
            playing = event.data === 1;
            updatePlayPauseUI(playing);
            current = null;
            tick();
            if (!playing) revealControls();
            syncTimer();
          },
          onError: () => {
            if (myGeneration !== generation) return;
            playing = false;
            updatePlayPauseUI(false);
            if (selected) select(selected, false);
            syncTimer();
            showError(copy.videoError);
          }
        }
      });
    } catch {
      if (myGeneration !== generation) return;
      apiFailed = true;
      showError(copy.apiError);
      // Keep the same timed iframe usable when the API itself is blocked.
      wrapper.classList.add('has-api-error');
      iframe.src = embedURL(pendingSeconds, true);
    }
  }
  function playAt(seconds = 0) {
    pendingSeconds = seconds;
    if (ready && player) {
      current = null;
      player.seekTo(seconds, true);
      player.playVideo();
      updatePlayPauseUI(true);
      revealControls();
      return;
    }
    if (iframe) {
      if (apiFailed) iframe.src = embedURL(seconds, true);
      return;
    }
    iframe = document.createElement('iframe');
    iframe.id = 'kobLivePlayer';
    iframe.title = copy.videoTitle;
    iframe.src = embedURL(seconds);
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    facade.hidden = true;
    container.hidden = false;
    container.append(iframe);
    fullscreen.hidden = !wrapper.requestFullscreen;
    connect(++generation);
  }
  customControls.addEventListener('focusin', revealControls);
  customControls.addEventListener('pointerenter', revealControls);
  customControls.addEventListener('pointermove', revealControls);
  for (const region of [customControls, lowerThird]) {
    region.addEventListener('pointerleave', revealControls);
    region.addEventListener('focusout', revealControls);
  }
  lowerThird.addEventListener('focusin', revealControls);
  lowerThird.addEventListener('pointerenter', revealControls);
  wrapper.addEventListener('pointerenter', revealControls);
  wrapper.addEventListener('pointerdown', revealControls);
  wrapper.addEventListener('touchstart', revealControls, { passive: true });
  function togglePlayPause() {
    if (!player) return;
    if (playing) player.pauseVideo();
    else player.playVideo();
    revealControls();
  }
  playPause.addEventListener('click', togglePlayPause);
  wrapper.addEventListener('click', event => {
    if (event.target.closest('#heroLiveChaptersCol, #liveCustomControls, button, a, input')) return;
    if (ready && player) togglePlayPause();
  });
  function jumpChapter(direction) {
    const currentIndex = CHAPTERS.findIndex(chapter => chapter.id === (selected?.id || CHAPTERS[0].id));
    const index = Math.max(0, Math.min(CHAPTERS.length - 1, currentIndex + direction));
    const chapter = CHAPTERS[index];
    select(chapter, false);
    playAt(chapter.seconds);
  }
  previousChapter.addEventListener('click', () => jumpChapter(-1));
  nextChapter.addEventListener('click', () => jumpChapter(1));
  progress.addEventListener('input', () => {
    if (!selected || !ready) return;
    const seconds = seekInTopic(selected, progress.value, player.getDuration?.());
    player.seekTo(seconds, true);
    updateProgress(seconds);
    revealControls();
  });
  byId('loadLivePlayerBtn').addEventListener('click', () => {
    select(CHAPTERS[0], false);
    playAt(CHAPTERS[0].seconds);
  });
  byId('liveRetryBtn').addEventListener('click', () => {
    const position = ready && player?.getCurrentTime ? Number(player.getCurrentTime()) : pendingSeconds;
    const resumeSeconds = Number.isFinite(position) && position > 0 ? Math.floor(position) : selected?.seconds ?? pendingSeconds;
    ++generation;
    player?.destroy?.();
    container.replaceChildren();
    iframe = undefined;
    player = undefined;
    ready = false;
    playing = false;
    updatePlayPauseUI(false);
    apiFailed = false;
    customControls.hidden = true;
    wrapper.classList.remove('has-api-error');
    errorBox.hidden = true;
    syncTimer();
    playAt(resumeSeconds);
  });
  fullscreen.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await wrapper.requestFullscreen();
    } catch { status.textContent = copy.fullscreenError; }
  });
  document.addEventListener('fullscreenchange', () => {
    fullscreen.replaceChildren(document.createTextNode(document.fullscreenElement ? copy.exit : copy.expand));
  });
}
