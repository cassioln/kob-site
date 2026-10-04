import { CHAPTERS, LIVE_VIDEO_ID } from './manual-de-bordo-live-data.js';
import { normalizeSearch, matchChapter, highlightParts, excerpt } from './manual-de-bordo-live-search.js';

const lang = document.documentElement.lang.slice(0, 2);
const copy = {
  pt: {
    topics: 'Assuntos', close: 'Recolher assuntos',
    selected: 'Selecionado', playing: 'Em reprodução', transcript: 'Trecho da transcrição fornecida', updated: 'Regra atualizada', faq: 'Conferir no guia',
    videoTitle: 'Live de embarque · Kriativos On Board 2026', apiError: 'Não foi possível sincronizar os assuntos. O vídeo ainda pode ser assistido aqui ou pelo link no YouTube.', previousTopic: 'Assunto anterior', nextTopic: 'Próximo assunto', play: 'Reproduzir', pause: 'Pausar', progress: 'Progresso do vídeo',
    videoError: 'O YouTube não conseguiu reproduzir este vídeo. Tente novamente ou abra o trecho no YouTube.', fullscreenError: 'Não foi possível ampliar. Você pode abrir o vídeo no YouTube.', expand: 'Ampliar vídeo', exit: 'Sair da tela cheia'
  },
  en: {
    topics: 'Topics', close: 'Collapse topics',
    selected: 'Selected', playing: 'Playing', transcript: 'Excerpt of the supplied Portuguese transcript', updated: 'Updated rule', faq: 'Check the guide',
    videoTitle: 'Boarding live recording · Kriativos On Board 2026', apiError: 'Topic synchronisation is unavailable. You can still watch here or open the video on YouTube.', previousTopic: 'Previous topic', nextTopic: 'Next topic', play: 'Play', pause: 'Pause', progress: 'Video progress',
    videoError: 'YouTube could not play this video. Try again or open this topic on YouTube.', fullscreenError: 'Full screen is unavailable. You can open the video on YouTube.', expand: 'Expand video', exit: 'Exit full screen'
  },
  es: {
    topics: 'Temas', close: 'Recoger temas',
    selected: 'Seleccionado', playing: 'En reproducción', transcript: 'Fragmento de la transcripción proporcionada en portugués', updated: 'Regla actualizada', faq: 'Consultar la guía',
    videoTitle: 'Charla de embarque · Kriativos On Board 2026', apiError: 'No se pudieron sincronizar los temas. Puedes seguir viendo aquí o abrir el vídeo en YouTube.', previousTopic: 'Tema anterior', nextTopic: 'Siguiente tema', play: 'Reproducir', pause: 'Pausar', progress: 'Progreso del vídeo',
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
  const playPause = byId('livePlayPauseBtn');
  const previousChapter = byId('livePreviousChapterBtn');
  const nextChapter = byId('liveNextChapterBtn');
  const progress = byId('liveProgress');
  const currentTime = byId('liveCurrentTime');
  const duration = byId('liveDuration');
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
    const link = document.createElement('a');
    link.textContent = copy.faq;
    link.href = `#${chapter.faqId}`;
    link.addEventListener('click', () => {
      byId('faqClearBtn')?.click();
      setPanel(false, false);
      const target = byId(chapter.faqId);
      if (target) target.open = true;
    });
    return link;
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
    time.textContent = chapter.time.replace(/^00:/, '');
    const title = document.createElement('span');
    title.className = 'live-chapter-item__title';
    title.textContent = chapter.titles[lang];
    button.append(time, title);
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
        const label = document.createElement('span');
        label.className = 'live-chapter-item__snippet-label';
        label.textContent = copy.transcript;
        const body = document.createElement('span');
        highlighted(body, text, query);
        snippet.replaceChildren(label, body);
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
    if (open) {
      if (matchMedia('(max-width: 768px)').matches) cinema.scrollIntoView({ block: 'start', behavior: 'instant' });
      search.focus({ preventScroll: true });
    } else if (returnFocus) toggle.focus({ preventScroll: true });
  }
  toggle.addEventListener('click', () => setPanel(toggle.getAttribute('aria-expanded') !== 'true'));
  byId('heroLiveChaptersCloseBtn').addEventListener('click', () => setPanel(false));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      event.preventDefault();
      setPanel(false);
    }
  });
  document.addEventListener('pointerdown', event => {
    if (toggle.getAttribute('aria-expanded') === 'true' && !byId('heroLiveChaptersCol').contains(event.target)) setPanel(false, false);
  });

  function select(chapter, isPlaying) {
    selected = chapter;
    if (isPlaying) current = chapter;
    status.textContent = `${isPlaying ? copy.playing : copy.selected} · ${chapter.time} · ${chapter.titles[lang]}`;
    customTopic.textContent = chapter.titles[lang];
    external.href = `https://www.youtube.com/watch?v=${LIVE_VIDEO_ID}&t=${chapter.seconds}s`;
    for (const row of rows) {
      row.button.toggleAttribute('data-selected', row.chapter.id === chapter.id);
      if (isPlaying && row.chapter.id === chapter.id) row.button.setAttribute('aria-current', 'true');
      else row.button.removeAttribute('aria-current');
    }
    note.hidden = !chapter.notice;
    if (chapter.notice) {
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
  function tick() {
    if (!ready || !playing || !player?.getCurrentTime) return;
    const seconds = player.getCurrentTime();
    const total = player.getDuration?.() || 0;
    currentTime.textContent = formatTime(seconds);
    duration.textContent = formatTime(total);
    progress.max = String(Math.max(1, Math.floor(total)));
    progress.value = String(Math.min(Math.floor(seconds), Math.floor(total || seconds)));
    const chapter = CHAPTERS.findLast(item => item.seconds <= seconds);
    if (chapter && chapter !== current) select(chapter, true);
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
  function revealControls() {
    customControls.classList.add('is-visible');
    clearTimeout(controlsTimer);
    controlsTimer = setTimeout(() => {
      if (playing && !customControls.matches(':hover')) customControls.classList.remove('is-visible');
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

  function embedURL(seconds) {
    const url = new URL(`https://www.youtube-nocookie.com/embed/${LIVE_VIDEO_ID}`);
    url.search = new URLSearchParams({ autoplay: '1', start: String(seconds), enablejsapi: '1', playsinline: '1', rel: '0', origin: location.origin });
    return url.href;
  }
  async function connect(myGeneration) {
    try {
      const YT = await loadYouTubeAPI();
      if (myGeneration !== generation || !iframe) return;
      player = new YT.Player(iframe, { playerVars: { controls: 0, modestbranding: 1, rel: 0, playsinline: 1 }, events: {
        onReady: event => {
          if (myGeneration !== generation) return;
          player = event.target;
          ready = true;
          apiFailed = false;
          errorBox.hidden = true;
          customControls.hidden = false;
          duration.textContent = formatTime(player.getDuration?.() || 0);
          progress.max = String(Math.max(1, Math.floor(player.getDuration?.() || 1)));
          player.seekTo(pendingSeconds, true);
          player.playVideo();
          revealControls();
          syncTimer();
        },
        onStateChange: event => {
          if (myGeneration !== generation) return;
          playing = event.data === 1;
          if (playing) current = null;
          else if (selected) select(selected, false);
          syncTimer();
        },
        onError: () => {
          if (myGeneration !== generation) return;
          playing = false;
          if (selected) select(selected, false);
          syncTimer();
          showError(copy.videoError);
        }
      }});
    } catch {
      if (myGeneration !== generation) return;
      apiFailed = true;
      showError(copy.apiError);
      // Keep the same timed iframe usable when the API itself is blocked.
      iframe.src = embedURL(pendingSeconds);
    }
  }
  function playAt(seconds = 0) {
    pendingSeconds = seconds;
    if (ready && player) {
      current = null;
      player.seekTo(seconds, true);
      player.playVideo();
      revealControls();
      return;
    }
    if (iframe) {
      if (apiFailed) iframe.src = embedURL(seconds);
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
  customControls.addEventListener('pointerenter', revealControls);
  customControls.addEventListener('pointermove', revealControls);
  wrapper.addEventListener('pointerenter', revealControls);
  wrapper.addEventListener('pointerdown', revealControls);
  wrapper.addEventListener('touchstart', revealControls, { passive: true });
  playPause.addEventListener('click', () => {
    if (!player) return;
    if (playing) player.pauseVideo(); else player.playVideo();
    revealControls();
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
    if (player) player.seekTo(Number(progress.value), true);
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
    apiFailed = false;
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
