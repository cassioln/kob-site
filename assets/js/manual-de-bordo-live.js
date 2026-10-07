import { CHAPTERS, LIVE_VIDEO_ID, LIVE_DURATION, GROUP_INVITE_URL } from './manual-de-bordo-live-data.js?v=20261007-charter-notice';
import { normalizeSearch, matchChapter, highlightParts, excerpt } from './manual-de-bordo-live-search.js?v=20261005-topic-player';

import { topicAt, topicProgress, seekInTopic, isNoticeDue, isGroupInviteDue } from './manual-de-bordo-live-timeline.js?v=20261007-charter-notice';
import { initLiveGuideHelp } from './manual-de-bordo-live-help.js?v=20261005-mobile-live';
import { initLiveMarkers } from './manual-de-bordo-live-markers.js?v=20261005-mobile-live';
import { initLiveControlMarquee } from './manual-de-bordo-live-marquee.js?v=20261005-ui-final';
import { initLiveTopicTransition } from './manual-de-bordo-live-topic.js?v=20261005-mobile-live';
import { supportAt } from './manual-de-bordo-live-support.js?v=20261006-live-copy';

const lang = document.documentElement.lang.slice(0, 2);
const copy = {
  pt: {
    topics: 'Assuntos', close: 'Recolher assuntos',
    selected: 'Selecionado', playing: 'Em reprodução', transcript: 'Trecho da transcrição fornecida', updated: 'ATUALIZAÇÃO', faq: 'Mais detalhes', detailHint: 'Passe o mouse, toque ou use o teclado para ver mais detalhes',
    videoTitle: 'Live de embarque · Kriativos On Board 2026', apiError: 'Não foi possível sincronizar os assuntos. O vídeo ainda pode ser assistido aqui ou pelo link no YouTube.', previousTopic: 'Assunto anterior', nextTopic: 'Próximo assunto', play: 'Reproduzir', pause: 'Pausar', progress: 'Progresso do assunto', remaining: 'Restante', closeGuide: 'Fechar orientação',
    videoError: 'O YouTube não conseguiu reproduzir este vídeo. Tente novamente ou abra o trecho no YouTube.', fullscreenError: 'Não foi possível ampliar. Você pode abrir o vídeo no YouTube.', expand: 'Ampliar vídeo', exit: 'Sair da tela cheia',
    previousShort: 'Anterior', nextShort: 'Próximo', fullLive: 'Live completa', searchHint: 'Buscar na live', loading: 'Carregando vídeo…',
    noticePill: 'Atualização', showNotice: 'Mostrar atualização', collapseNotice: 'Recolher aviso',
    groupQrPrompt: 'Clique aqui para', groupQrHint: 'ou acesse pelo QR Code', groupQrAction: 'ENTRAR NO GRUPO', groupQrAlt: 'QR code para entrar no grupo oficial do WhatsApp',
    groupInvite: 'Clique aqui para entrar no grupo', groupInviteLabel: 'Entrar no grupo oficial do WhatsApp (abre em nova aba)',
    supportPill: 'Apoio', showSupport: 'Mostrar apoio da live', opensNewTab: 'abre em nova aba'
  },
  en: {
    topics: 'Topics', close: 'Collapse topics',
    selected: 'Selected', playing: 'Playing', transcript: 'Excerpt of the supplied Portuguese transcript', updated: 'UPDATE', faq: 'More details', detailHint: 'Hover, tap or use the keyboard for more details',
    videoTitle: 'Boarding live recording · Kriativos On Board 2026', apiError: 'Topic synchronisation is unavailable. You can still watch here or open the video on YouTube.', previousTopic: 'Previous topic', nextTopic: 'Next topic', play: 'Play', pause: 'Pause', progress: 'Topic progress', remaining: 'Remaining', closeGuide: 'Close guidance',
    videoError: 'YouTube could not play this video. Try again or open this topic on YouTube.', fullscreenError: 'Full screen is unavailable. You can open the video on YouTube.', expand: 'Expand video', exit: 'Exit full screen',
    previousShort: 'Previous', nextShort: 'Next', fullLive: 'Full recording', searchHint: 'Search the recording', loading: 'Loading video…',
    noticePill: 'Update', showNotice: 'Show update', collapseNotice: 'Collapse notice',
    groupQrPrompt: 'Click here to', groupQrHint: 'or scan the QR code', groupQrAction: 'JOIN THE GROUP', groupQrAlt: 'QR code to join the official WhatsApp group',
    groupInvite: 'Click here to join the group', groupInviteLabel: 'Join the official WhatsApp group (opens in a new tab)',
    supportPill: 'Help', showSupport: 'Show recording help', opensNewTab: 'opens in a new tab'
  },
  es: {
    topics: 'Temas', close: 'Recoger temas',
    selected: 'Seleccionado', playing: 'En reproducción', transcript: 'Fragmento de la transcripción proporcionada en portugués', updated: 'ACTUALIZACIÓN', faq: 'Más detalles', detailHint: 'Pasa el cursor, toca o usa el teclado para ver más detalles',
    videoTitle: 'Charla de embarque · Kriativos On Board 2026', apiError: 'No se pudieron sincronizar los temas. Puedes seguir viendo aquí o abrir el vídeo en YouTube.', previousTopic: 'Tema anterior', nextTopic: 'Siguiente tema', play: 'Reproducir', pause: 'Pausar', progress: 'Progreso del tema', remaining: 'Restante', closeGuide: 'Cerrar orientación',
    videoError: 'YouTube no pudo reproducir el vídeo. Inténtalo de nuevo o abre este tema en YouTube.', fullscreenError: 'No se pudo ampliar. Puedes abrir el vídeo en YouTube.', expand: 'Ampliar vídeo', exit: 'Salir de pantalla completa',
    previousShort: 'Anterior', nextShort: 'Siguiente', fullLive: 'Charla completa', searchHint: 'Busca en la charla', loading: 'Cargando vídeo…',
    noticePill: 'Actualización', showNotice: 'Mostrar actualización', collapseNotice: 'Recoger aviso',
    groupQrPrompt: 'Haz clic aquí para', groupQrHint: 'o escanea el código QR', groupQrAction: 'ENTRAR AL GRUPO', groupQrAlt: 'Código QR para entrar al grupo oficial de WhatsApp',
    groupInvite: 'Haz clic aquí para entrar al grupo', groupInviteLabel: 'Entrar al grupo oficial de WhatsApp (se abre en una pestaña nueva)',
    supportPill: 'Ayuda', showSupport: 'Mostrar ayuda de la charla', opensNewTab: 'se abre en una pestaña nueva'
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
  const mobile = matchMedia('(max-width: 768px)');
  const note = byId('liveChapterNote');
  const noticeGroup = document.createElement('div');
  noticeGroup.id = 'liveChapterNotice';
  noticeGroup.className = 'live-chapter-notice';
  noticeGroup.hidden = true;
  const noteAction = document.createElement('div');
  noteAction.id = 'liveChapterNoteAction';
  noteAction.className = 'live-chapter-note__action';
  noteAction.hidden = true;
  note.before(noticeGroup);
  noticeGroup.append(note, noteAction);
  const updateDimensions = () => {
    const controls = byId('liveCustomControls');
    const topic = byId('liveCustomTopic');
    const lowerThird = byId('liveLowerThird');
    const video = byId('livePlayerWrapper');
    const invite = byId('liveGroupInvite');
    if (desktop.matches) {
      if (controls.parentElement !== video) video.append(controls);
      if (topic.parentElement !== lowerThird) lowerThird.prepend(topic);
      if (noticeGroup.parentElement !== lowerThird) lowerThird.append(noticeGroup);
      if (lowerThird.nextElementSibling !== controls) video.insertBefore(lowerThird, controls);
      if (invite && invite.parentElement !== video) video.append(invite);
      lowerThird.hidden = topic.hidden;
      if (controls.offsetHeight) video.style.setProperty('--live-controls-offset', `${controls.offsetHeight + 12}px`);
      if (invite && !invite.hidden && window.innerWidth >= 1024) {
        // Fit below the topics tab and above the visible dock, including translated copy.
        const qr = invite.querySelector('.live-group-invite__qr');
        const tab = byId('heroLiveToggleChaptersBtn');
        const tabBottom = tab.offsetTop + tab.offsetHeight / 2;
        const room = video.clientHeight - 18 - (controls.offsetHeight + 12) - tabBottom - 8;
        const copyHeight = invite.offsetHeight - qr.offsetHeight;
        const fittingSize = Math.min(147, Math.max(80, Math.floor(room - copyHeight)));
        // This asset has 49 modules including its quiet zone. Whole pixels keep
        // compact QR modules aligned and readable instead of unevenly rasterized.
        const wholeModuleSize = Math.floor(fittingSize / 49) * 49;
        video.style.setProperty('--live-group-qr-size', `${wholeModuleSize >= 98 ? wholeModuleSize : fittingSize}px`);
      }
    } else {
      // Mobile keeps the title and the notice on the video; the dock and topics button sit below it.
      if (controls.parentElement !== cinema) cinema.insertBefore(controls, byId('heroLiveChaptersCol'));
      if (topic.parentElement !== lowerThird) lowerThird.prepend(topic);
      if (noticeGroup.parentElement !== video) video.append(noticeGroup);
      if (invite && invite.parentElement !== lowerThird) lowerThird.insertBefore(invite, topic);
      lowerThird.hidden = topic.hidden;
    }
    if (mobile.matches && !noticeGroup.hidden) {
      // Keep the title, invitation and actions reachable; scroll only long notice text.
      const lowerHeight = lowerThird.getBoundingClientRect().height;
      const actionsHeight = noteAction.getBoundingClientRect().height;
      // Translated actions can wrap into two rows as fonts load. Reserve room for
      // both rows and at least two lines of guidance, rather than overlapping the invite.
      const minimumHeight = lowerHeight + actionsHeight + 46 + 32;
      video.style.setProperty('--live-guidance-min-height', `${Math.ceil(Math.max(240, minimumHeight))}px`);
      const bodyRoom = video.getBoundingClientRect().height - lowerHeight - actionsHeight - 46;
      note.style.setProperty('--live-note-body-max-height', `${Math.max(32, bodyRoom)}px`);
    } else {
      video.style.removeProperty('--live-guidance-min-height');
      note.style.removeProperty('--live-note-body-max-height');
    }
    if (mobile.matches && noticeGroup.dataset.noticeKind !== 'update' && note.scrollHeight > note.clientHeight) note.tabIndex = 0;
    else note.removeAttribute('tabindex');
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
    dimensionsObserver.observe(byId('liveLowerThird'));
    dimensionsObserver.observe(noteAction);
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
  const errorBox = byId('liveVideoError');
  const external = byId('liveExternalLink');
  const fullscreen = byId('liveFullscreenBtn');
  const customControls = byId('liveCustomControls');
  const customTopic = byId('liveCustomTopic');
  const topicTransition = initLiveTopicTransition(customTopic, () => ({
    seconds: Number(player?.getCurrentTime?.() || 0),
    rate: Number(player?.getPlaybackRate?.() || 1),
    playing: playing && visible
  }));
  const lowerThird = byId('liveLowerThird');
  const groupInvite = document.createElement('a');
  groupInvite.id = 'liveGroupInvite';
  groupInvite.className = 'live-group-invite';
  groupInvite.href = GROUP_INVITE_URL;
  groupInvite.target = '_blank';
  groupInvite.rel = 'noopener noreferrer';
  groupInvite.setAttribute('aria-label', copy.groupInviteLabel);
  groupInvite.hidden = true;
  groupInvite.innerHTML = '<svg class="live-group-invite__logo" width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.65 15.02L2 22l5.1-1.34A10 10 0 1 0 12 2Z"/><path fill="#fff" d="M8.05 6.7c-.2-.44-.41-.45-.6-.46h-.51c-.18 0-.47.07-.72.34-.25.27-.95.92-.95 2.25s.97 2.62 1.1 2.8c.14.18 1.9 2.9 4.6 4.07.64.28 1.14.45 1.53.57.64.2 1.22.17 1.67.1.51-.08 1.57-.65 1.79-1.28.22-.63.22-1.17.16-1.28-.07-.11-.25-.18-.53-.32-.27-.14-1.61-.79-1.86-.88-.25-.09-.44-.14-.62.14-.18.27-.71.88-.87 1.06-.16.18-.32.2-.59.07-.27-.14-1.15-.42-2.19-1.35-.81-.72-1.36-1.61-1.52-1.88-.16-.27-.02-.42.12-.56.12-.12.27-.32.41-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.06-.14-.6-1.48-.82-1.98Z"/></svg>';
  const inviteText = document.createElement('span');
  inviteText.className = 'live-group-invite__mobile-text';
  inviteText.textContent = copy.groupInvite;
  groupInvite.append(inviteText);
  const qrCard = document.createElement('span');
  qrCard.className = 'live-group-invite__desktop';
  const qrImage = document.createElement('img');
  qrImage.className = 'live-group-invite__qr';
  qrImage.src = '/assets/images/manual/whatsapp-grupo-qr.svg?v=20261007-monochrome';
  qrImage.width = qrImage.height = 147;
  qrImage.alt = copy.groupQrAlt;
  const qrHint = document.createElement('span');
  qrHint.className = 'live-group-invite__hint';
  qrHint.textContent = copy.groupQrHint;
  const qrAction = document.createElement('span');
  qrAction.className = 'live-group-invite__action';
  const qrActionIcon = document.createElement('img');
  qrActionIcon.className = 'live-group-invite__action-icon';
  qrActionIcon.src = '/assets/images/manual/whatsapp-icon.svg';
  qrActionIcon.alt = '';
  qrActionIcon.setAttribute('width', '16');
  qrActionIcon.setAttribute('height', '16');
  const qrActionLines = document.createElement('span');
  qrActionLines.className = 'live-group-invite__action-lines';
  const qrActionPrompt = document.createElement('span');
  qrActionPrompt.className = 'live-group-invite__action-prompt';
  qrActionPrompt.textContent = copy.groupQrPrompt;
  const qrActionText = document.createElement('span');
  qrActionText.className = 'live-group-invite__action-title';
  qrActionText.textContent = copy.groupQrAction;
  qrActionLines.append(qrActionPrompt, qrActionText);
  qrAction.append(qrActionIcon, qrActionLines);
  qrCard.append(qrAction, qrHint, qrImage);
  groupInvite.append(qrCard);
  wrapper.append(groupInvite);
  updateDimensions();
  if ('ResizeObserver' in window) new ResizeObserver(updateDimensions).observe(groupInvite);
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
  const drawer = byId('heroLiveChaptersCol');

  // Mobile-only affordances, hidden by CSS on desktop.
  previousChapter.dataset.dir = copy.previousShort;
  nextChapter.dataset.dir = copy.nextShort;
  totalProgress.closest('.live-total-timeline').dataset.label = copy.fullLive;
  const tabCount = document.createElement('span');
  tabCount.className = 'live-drawer__tab-count';
  tabCount.setAttribute('aria-hidden', 'true');
  tabCount.textContent = String(CHAPTERS.length);
  const tabHint = document.createElement('span');
  tabHint.className = 'live-drawer__tab-hint';
  tabHint.setAttribute('aria-hidden', 'true');
  tabHint.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
  tabHint.append(copy.searchHint);
  toggle.querySelector('.live-drawer__arrow').before(tabCount, tabHint);
  // The cover stays over the embed until the video plays, so it never shows as a black box.
  const loading = document.createElement('div');
  loading.className = 'live-loading';
  loading.setAttribute('role', 'status');
  loading.hidden = true;
  loading.innerHTML = '<span class="live-loading__spinner" aria-hidden="true"></span>';
  loading.append(copy.loading);
  facade.append(loading);
  let loadingTimer;
  function showLoading() {
    clearTimeout(loadingTimer);
    facade.hidden = false;
    loading.hidden = false;
    wrapper.classList.remove('is-revealing');
    wrapper.classList.add('is-loading');
    // Safety net when the player never reports ready (slow network, blocked embed).
    loadingTimer = setTimeout(revealVideo, 15000);
  }
  function revealVideo() {
    clearTimeout(loadingTimer);
    if (!wrapper.classList.contains('is-loading')) return;
    loading.hidden = true;
    wrapper.classList.replace('is-loading', 'is-revealing');
    setTimeout(() => {
      if (!wrapper.classList.contains('is-revealing')) return;
      wrapper.classList.remove('is-revealing');
      facade.hidden = true;
    }, 300);
  }
  // Mobile: the notice floats over the video when its mapped utterance is reached,
  // and "−" folds it into an "Atualização" pill in the video's top-left corner.
  const noticeCollapse = document.createElement('button');
  noticeCollapse.type = 'button';
  noticeCollapse.className = 'live-chapter-notice__collapse';
  noticeCollapse.setAttribute('aria-label', copy.collapseNotice);
  noticeCollapse.setAttribute('aria-controls', noticeGroup.id);
  noticeCollapse.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 12h12"/></svg>';
  noticeGroup.append(noticeCollapse);
  const noticePill = document.createElement('button');
  noticePill.type = 'button';
  noticePill.className = 'live-notice-pill';
  noticePill.hidden = true;
  noticePill.setAttribute('aria-label', copy.showNotice);
  noticePill.setAttribute('aria-controls', noticeGroup.id);
  noticePill.innerHTML = '<svg class="live-notice-pill__icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/></svg><span></span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 6v12M6 12h12"/></svg>';
  noticePill.querySelector('span').textContent = copy.noticePill;
  wrapper.append(noticePill);
  let noticeCollapsed = false;
  let activeNoticeId = null;
  let noticeRenderKey;
  let lastPlaybackSeconds = 0;
  function syncNotice() {
    // Without an API clock, keep the update available in search and the guide only.
    const due = ready && !apiFailed && isNoticeDue(selected, lastPlaybackSeconds);
    const support = ready && !apiFailed ? supportAt(lastPlaybackSeconds) : null;
    const visibleNotice = due || support;
    const inviteDue = ready && !apiFailed && isGroupInviteDue(lastPlaybackSeconds);
    const inviteChanged = groupInvite.hidden === Boolean(inviteDue);
    if (!inviteDue && document.activeElement === groupInvite) playPause.focus({ preventScroll: true });
    groupInvite.hidden = !inviteDue;
    const nextNoticeId = visibleNotice ? `${due ? selected.id : ''}:${support?.id || ''}` : null;
    if (activeNoticeId !== nextNoticeId) {
      if (activeNoticeId) {
        if (byId('liveGuidePopover')?.contains(document.activeElement)) playPause.focus({ preventScroll: true });
        guideHelp.hide();
      }
      if (nextNoticeId && noticeCollapsed) {
        noticePill.classList.remove('is-new');
        void noticePill.offsetWidth;
        noticePill.classList.add('is-new');
      }
      activeNoticeId = nextNoticeId;
    }
    const renderKey = `${selected?.id || ''}:${Boolean(due)}:${support?.id || ''}`;
    const renderChanged = noticeRenderKey !== renderKey;
    if (renderChanged) {
      if (noticeGroup.contains(document.activeElement) && document.activeElement !== noticeCollapse) playPause.focus({ preventScroll: true });
      renderNotice(selected, due, support);
      noticeRenderKey = renderKey;
    }
    noticeGroup.hidden = !visibleNotice;
    if (!visibleNotice && document.activeElement === noticePill) playPause.focus({ preventScroll: true });
    wrapper.classList.toggle('is-notice-due', Boolean(visibleNotice));
    wrapper.classList.toggle('is-notice-collapsed', noticeCollapsed);
    noticePill.hidden = !(mobile.matches && noticeCollapsed && visibleNotice);
    noticeCollapse.setAttribute('aria-expanded', String(!noticeCollapsed));
    noticePill.setAttribute('aria-expanded', String(!noticeCollapsed));
    if (renderChanged || inviteChanged) updateDimensions();
  }
  noticeCollapse.addEventListener('click', () => {
    noticeCollapsed = true;
    syncNotice();
    updateDimensions();
    noticePill.focus({ preventScroll: true });
  });
  noticePill.addEventListener('click', () => {
    noticeCollapsed = false;
    syncNotice();
    updateDimensions();
    noticeCollapse.focus({ preventScroll: true });
  });
  mobile.addEventListener('change', syncNotice);
  const sheetGrab = document.createElement('div');
  sheetGrab.className = 'live-drawer__grab';
  sheetGrab.setAttribute('aria-hidden', 'true');
  sheetGrab.append(document.createElement('span'));
  panel.prepend(sheetGrab);

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

  function noticeLabel(kind = 'update') {
    const label = document.createElement('strong');
    label.className = `live-notice-label${kind === 'support' ? ' live-notice-label--support' : ''}`;
    const paths = kind === 'support' ? '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>' : '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>';
    label.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
    if (kind === 'update') label.append(copy.updated);
    return label;
  }

  function renderNotice(chapter, updateDue, support) {
    const content = document.createDocumentFragment();
    const actions = [];
    if (chapter?.notice) {
      const update = document.createElement('div');
      update.className = 'live-notice-update';
      update.hidden = !updateDue;
      const explanation = document.createElement('span');
      explanation.className = 'live-notice-body';
      explanation.textContent = chapter.notice[lang];
      update.append(noticeLabel(), ' ', explanation);
      content.append(update);
    }
    if (support) {
      const help = document.createElement('div');
      help.className = 'live-notice-support';
      help.dataset.supportId = support.id;
      const text = support.texts[lang];
      const emphasis = support.emphasis?.[lang];
      if (emphasis && text.startsWith(emphasis)) {
        const strong = document.createElement('strong');
        strong.textContent = emphasis;
        const explanation = document.createElement('span');
        explanation.className = 'live-notice-body';
        explanation.textContent = text.slice(emphasis.length);
        help.append(strong, explanation);
      } else help.textContent = text;
      content.append(help);
      if (support.action.href) {
        const link = document.createElement('a');
        link.className = 'live-guide-trigger live-support-link';
        link.href = support.action.href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.setAttribute('aria-label', `${support.action.labels[lang]} (${copy.opensNewTab})`);
        link.append(support.action.labels[lang]);
        link.insertAdjacentHTML('beforeend', '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg>');
        actions.push(link);
      } else actions.push(guideLink(support.action));
    }
    if (updateDue && chapter.faqId && chapter.faqId !== support?.action.faqId) {
      const details = guideLink(chapter);
      if (support) details.classList.add('live-guide-trigger--secondary');
      actions.push(details);
    }
    note.replaceChildren(content);
    note.hidden = !(chapter?.notice || support);
    noteAction.replaceChildren(...actions);
    noteAction.hidden = !actions.length;
    noticeGroup.dataset.noticeKind = support ? (updateDue ? 'mixed' : 'support') : 'update';
    noticePill.querySelector('span').textContent = support ? (updateDue ? `${copy.noticePill} · ${copy.supportPill}` : copy.supportPill) : copy.noticePill;
    const icon = noticeLabel(support && !updateDue ? 'support' : 'update').firstElementChild;
    icon.classList.add('live-notice-pill__icon');
    icon.setAttribute('width', '14');
    icon.setAttribute('height', '14');
    noticePill.firstElementChild.replaceWith(icon);
    noticePill.setAttribute('aria-label', support && !updateDue ? copy.showSupport : copy.showNotice);
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
      // The half-height sheet leaves the video in view, so browsing can continue.
      if (mobile.matches) { search.blur(); setSheet('half'); }
      else setPanel(false);
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
        const body = document.createElement('span');
        highlighted(body, chapter.notice[lang], query);
        notice.replaceChildren(noticeLabel(), ' ', body);
        if (chapter.faqId) notice.append(' ', guideLink(chapter));
      }
    }
    clear.hidden = !search.value;
    byId('liveEmptyChaptersMsg').hidden = count > 0;
  }
  search.addEventListener('input', filter);
  clear.addEventListener('click', () => { search.value = ''; filter(); search.focus(); });

  function setSheet(size) {
    drawer.dataset.sheet = size;
  }
  function setPanel(open, returnFocus = true) {
    cinema.classList.toggle('is-collapsed', !open);
    panel.inert = !open;
    panel.setAttribute('aria-hidden', String(!open));
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? copy.close : copy.topics);
    if (mobile.matches) {
      document.body.classList.toggle('has-live-drawer-open', open);
    }
    if (open) {
      updateDimensions();
      if (mobile.matches) {
        setSheet('half');
        cinema.scrollIntoView({ block: 'start', behavior: 'instant' });
        // Half height starts under the video, keeping at least 45% of the screen for the list.
        const below = innerHeight - wrapper.getBoundingClientRect().bottom - 8;
        drawer.style.setProperty('--live-sheet-half', `${Math.round(Math.max(innerHeight * .45, below))}px`);
        // Focusing the search would raise the keyboard over the sheet.
        byId('heroLiveChaptersCloseBtn').focus({ preventScroll: true });
        // Scroll only the list: the sheet is still sliding in, so scrollIntoView could move the page.
        const currentRow = list.querySelector('[aria-current="true"], [data-selected]')?.closest('li');
        if (currentRow) list.scrollTop = currentRow.offsetTop - list.offsetTop - (list.clientHeight - currentRow.offsetHeight) / 2;
      } else search.focus({ preventScroll: true });
    } else {
      document.body.classList.remove('has-live-drawer-open');
      if (returnFocus) toggle.focus({ preventScroll: true });
    }
  }
  toggle.addEventListener('click', () => setPanel(toggle.getAttribute('aria-expanded') !== 'true'));
  byId('heroLiveChaptersCloseBtn').addEventListener('click', () => setPanel(false));
  drawer.addEventListener('click', event => {
    if (event.target === drawer) setPanel(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      event.preventDefault();
      setPanel(false);
    }
  });
  document.addEventListener('pointerdown', event => {
    if (toggle.getAttribute('aria-expanded') !== 'true') return;
    if ([drawer, byId('liveGuidePopover'), byId('liveGuideBackdrop')].some(region => region.contains(event.target))) return;
    // On mobile the video and its notice stay usable above the sheet.
    if (mobile.matches && (wrapper.contains(event.target) || noticeGroup.contains(event.target))) return;
    setPanel(false, false);
  });
  search.addEventListener('focus', () => { if (mobile.matches) setSheet('full'); });

  // Drag the sheet's handle: up opens full height; down returns to half, then closes.
  let dragStart = null;
  for (const handle of [sheetGrab, panel.querySelector('.live-drawer__header')]) {
    handle.addEventListener('pointerdown', event => {
      if (!mobile.matches || event.target.closest('button')) return;
      dragStart = event.clientY;
      handle.setPointerCapture(event.pointerId);
      drawer.classList.add('is-dragging');
    });
    handle.addEventListener('pointermove', event => {
      if (dragStart !== null) drawer.style.setProperty('--live-sheet-drag', `${Math.max(-140, event.clientY - dragStart)}px`);
    });
    const endDrag = event => {
      if (dragStart === null) return;
      const delta = event.clientY - dragStart;
      dragStart = null;
      drawer.classList.remove('is-dragging');
      drawer.style.removeProperty('--live-sheet-drag');
      if (event.type === 'pointercancel') return;
      if (delta < -50) setSheet('full');
      else if (delta > 70 && drawer.dataset.sheet === 'full') { search.blur(); setSheet('half'); }
      else if (delta > 70) setPanel(false);
    };
    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
  }

  function select(chapter, isPlaying, seconds = chapter.seconds) {
    const changed = selected?.id !== chapter.id;
    if (changed) guideHelp.hide();
    selected = chapter;
    if (isPlaying) current = chapter;
    topicTransition.update(chapter.id, chapter.titles[lang], () => updateNotice(chapter));
    lowerThird.hidden = false;
    updateTopicButtons();
    updateProgress(seconds);
    external.href = `https://www.youtube.com/watch?v=${LIVE_VIDEO_ID}&t=${chapter.seconds}s`;
    for (const row of rows) {
      row.button.toggleAttribute('data-selected', row.chapter.id === chapter.id);
      if (isPlaying && row.chapter.id === chapter.id) row.button.setAttribute('aria-current', 'true');
      else row.button.removeAttribute('aria-current');
    }
  }

  function updateNotice(chapter) {
    syncNotice();
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
    progress.style.setProperty('--live-topic-progress', `${Math.min(100, state.elapsed / state.duration * 100)}%`);
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
    lastPlaybackSeconds = Number(seconds);
    syncNotice();
  }
  function tick() {
    if (!ready || !player?.getCurrentTime) return;
    const seconds = player.getCurrentTime();
    const chapter = topicAt(seconds);
    if (chapter !== current) { select(chapter, playing, seconds); current = chapter; }
    updateProgress(seconds);
    const next = CHAPTERS[CHAPTERS.indexOf(chapter) + 1];
    const rate = Number(player?.getPlaybackRate?.() || 1);
    if (playing && next && (next.seconds - seconds) / rate <= 4) {
      topicTransition.anticipate({ key: next.id, title: next.titles[lang], seconds: next.seconds }, () => {
        const actual = topicAt(player.getCurrentTime());
        select(actual, playing, player.getCurrentTime());
        current = actual;
      });
    }
  }
  function syncTimer() {
    clearInterval(timer);
    timer = undefined;
    if (ready && playing && visible && !document.hidden) {
      tick();
      timer = setInterval(tick, 250);
    } else topicTransition.cancel();
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

  function revealControls(event) {
    if (event?.type.startsWith('pointer')) {
      const hovered = document.elementFromPoint(event.clientX, event.clientY);
      // Keep the details target still while the pointer enters its popover.
      if (hovered?.closest('#liveChapterNoteAction') || !byId('liveGuidePopover').hidden) return;
    }
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
      cc_load_policy: '0',
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
          playsinline: 1,
          cc_load_policy: 0
        },
        events: {
          onReady: event => {
            if (myGeneration !== generation) return;
            player = event.target;
            ready = true;
            apiFailed = false;
            errorBox.hidden = true;
            customControls.hidden = false;
            try {
              if (typeof player.unloadModule === 'function') player.unloadModule('captions');
              if (typeof player.setOption === 'function') player.setOption('captions', 'track', {});
            } catch (_) {}
            updateDimensions();
            wrapper.classList.remove('has-api-error');
            updateProgress(pendingSeconds);
            player.seekTo(pendingSeconds, true);
            player.playVideo();
            // If autoplay is blocked the video never starts: show the player and its controls anyway.
            clearTimeout(loadingTimer);
            loadingTimer = setTimeout(revealVideo, 4000);
            updatePlayPauseUI(true);
            revealControls();
            syncTimer();
          },
          onStateChange: event => {
            if (myGeneration !== generation) return;
            playing = event.data === 1;
            if (playing) {
              revealVideo();
              try {
                if (typeof player.unloadModule === 'function') player.unloadModule('captions');
                if (typeof player.setOption === 'function') player.setOption('captions', 'track', {});
              } catch (_) {}
            }
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
            revealVideo();
            showError(copy.videoError);
          }
        }
      });
    } catch {
      if (myGeneration !== generation) return;
      apiFailed = true;
      revealVideo();
      showError(copy.apiError);
      // Keep the same timed iframe usable when the API itself is blocked.
      wrapper.classList.add('has-api-error');
      syncNotice();
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
    showLoading();
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
  wrapper.addEventListener('pointermove', revealControls);
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
    if (event.target.closest('#heroLiveChaptersCol, #liveCustomControls, #liveChapterNotice, button, a, input')) return;
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
    topicTransition.cancel();
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
    } catch {}
  });
  document.addEventListener('fullscreenchange', () => {
    fullscreen.replaceChildren(document.createTextNode(document.fullscreenElement ? copy.exit : copy.expand));
  });
}
