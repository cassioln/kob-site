import { prepareIndex, search, snippetFor, highlightParts, buildResultUrl } from './site-search-engine.js?v=20261008-busca';

const lang = (document.documentElement.lang || 'pt').slice(0, 2).toLowerCase();
const COPY = {
  pt: {
    where: 'Pesquisa no site', placeholder: 'O que você procura?', featured: 'Mais procurados',
    showing: 'Mostrando resultados para', and: ' e ', count: n => (n === 1 ? '1 resultado' : `${n} resultados`),
    none: q => `Nada sobre “${q}” no site.`, tryLead: 'Tente uma palavra mais geral, ou um destes assuntos:',
    tryTerms: ['proibidos', 'bagagem', 'cabine'], whatsapp: 'Perguntar à Royal Trip no WhatsApp',
    whatsappText: 'Olá, Royal Trip! Procurei no site do Kriativos On Board 2026 e não encontrei uma informação. Podem me ajudar?',
    loading: 'Carregando a busca…', error: 'Não foi possível carregar a busca. Verifique a conexão e tente de novo.',
    retry: 'Tentar de novo', close: 'Fechar', hints: ['navegar', 'abrir', 'fechar'],
    dest: { home: ['destino', 'Home'], bus: ['destino', 'Busão'], manual: ['destino', 'Manual'], live: 'live' }
  },
  en: {
    where: 'Search the site', placeholder: 'What are you looking for?', featured: 'Most searched',
    showing: 'Showing results for', and: ' and ', count: n => (n === 1 ? '1 result' : `${n} results`),
    none: q => `Nothing about “${q}” on the site.`, tryLead: 'Try a broader word, or one of these topics:',
    tryTerms: ['prohibited', 'luggage', 'cabin'], whatsapp: 'Ask Royal Trip on WhatsApp',
    whatsappText: "Hi, Royal Trip! I searched the Kriativos On Board 2026 website and couldn't find some information. Can you help me?",
    loading: 'Loading search…', error: "Search couldn't load. Check your connection and try again.",
    retry: 'Try again', close: 'Close', hints: ['navigate', 'open', 'close'],
    dest: { home: ['go to', 'Home'], bus: ['go to', 'Busão'], manual: ['go to', 'Guide'], live: 'live' }
  },
  es: {
    where: 'Buscar en el sitio', placeholder: '¿Qué estás buscando?', featured: 'Lo más buscado',
    showing: 'Mostrando resultados para', and: ' y ', count: n => (n === 1 ? '1 resultado' : `${n} resultados`),
    none: q => `No hay nada sobre “${q}” en el sitio.`, tryLead: 'Prueba con una palabra más general o con uno de estos temas:',
    tryTerms: ['prohibidos', 'equipaje', 'camarote'], whatsapp: 'Preguntar a Royal Trip por WhatsApp',
    whatsappText: '¡Hola, Royal Trip! Busqué en el sitio de Kriativos On Board 2026 y no encontré una información. ¿Me pueden ayudar?',
    loading: 'Cargando la búsqueda…', error: 'No se pudo cargar la búsqueda. Revisa tu conexión e inténtalo de nuevo.',
    retry: 'Intentar de nuevo', close: 'Cerrar', hints: ['navegar', 'abrir', 'cerrar'],
    dest: { home: ['destino', 'Inicio'], bus: ['destino', 'Busão'], manual: ['destino', 'Guía'], live: 'live' }
  }
};
const copy = COPY[lang] || COPY.pt;
const platform = navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || '';
const isApple = /Mac|iPhone|iPad|iPod/i.test(platform);
const shortcutLabel = isApple ? '⌘ K' : 'Ctrl K';
const shortcutKeys = isApple ? 'Meta+K' : 'Control+K';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const SVG = 'http://www.w3.org/2000/svg';

let dialog; let input; let list; let body; let synonymLine; let status; let stateEl;
let prepared = null; let featured = []; let loading = null; let loadFailed = false; let opener = null;
let options = []; let activeIndex = -1; let closeTimer = null;

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  node.append(...children.filter(child => child != null));
  return node;
}

function searchIcon() {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  for (const [name, attrs] of [['circle', { cx: 11, cy: 11, r: 6.5 }], ['path', { d: 'm16 16 4 4' }]]) {
    const shape = document.createElementNS(SVG, name);
    for (const [k, v] of Object.entries(attrs)) shape.setAttribute(k, v);
    svg.append(shape);
  }
  return svg;
}

const hint = (keys, label) => el('span', {}, ...keys.map(key => el('kbd', { text: key })), document.createTextNode(` ${label}`));

function build() {
  input = el('input', {
    class: 'site-search__input', type: 'search', role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'false',
    'aria-controls': 'site-search-results', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
    enterkeyhint: 'search', placeholder: copy.placeholder, 'aria-label': copy.where
  });
  status = el('p', { class: 'site-search__status', id: 'site-search-status', 'aria-live': 'polite' });
  synonymLine = el('p', { class: 'site-search__synonyms', hidden: true });
  list = el('ul', { class: 'site-search__list', id: 'site-search-results', role: 'listbox', 'aria-label': copy.where });
  body = el('div', { class: 'site-search__body' }, synonymLine, list);
  dialog = el('dialog', { class: 'site-search', 'aria-label': copy.where },
    el('div', { class: 'site-search__ticket' },
      el('div', { class: 'site-search__stub' },
        el('div', { class: 'site-search__topbar' },
          el('p', { class: 'site-search__where', text: copy.where }),
          el('button', { type: 'button', class: 'site-search__close', text: copy.close, onclick: requestClose })),
        el('label', { class: 'site-search__field' }, searchIcon(), input)),
      el('div', { class: 'site-search__perf', 'aria-hidden': 'true' }),
      body,
      el('div', { class: 'site-search__hints', 'aria-hidden': 'true' },
        hint(['↑', '↓'], copy.hints[0]), hint(['↵'], copy.hints[1]), hint(['esc'], copy.hints[2])),
      status));
  input.addEventListener('input', render);
  input.addEventListener('keydown', onKeydown);
  // Esc from any control in the ticket closes it and stops there: page-level Esc handlers (cookie banner,
  // menu drawer) never see it, and a type="search" field does not just clear itself.
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.isComposing) return;
    event.preventDefault();
    event.stopPropagation();
    requestClose();
  });
  dialog.addEventListener('cancel', event => { event.preventDefault(); requestClose(); });
  dialog.addEventListener('close', onClose);
  dialog.addEventListener('click', event => { if (event.target === dialog) requestClose(); });
  document.body.append(dialog);
}

const okJson = response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); };

function load() {
  if (prepared) return Promise.resolve();
  loading ??= Promise.all([
    fetch(new URL(`../data/search-index.${lang}.json`, import.meta.url), { cache: 'no-cache' }).then(okJson),
    fetch(new URL('../data/search-synonyms.json', import.meta.url), { cache: 'no-cache' }).then(okJson)
  ]).then(([index, synonyms]) => {
    const config = synonyms[lang] || synonyms.pt;
    prepared = prepareIndex(index.entries, config);
    featured = config.featured;
    loadFailed = false;
  }).catch(error => {
    loadFailed = true;
    throw error;
  }).finally(() => { loading = null; });
  return loading;
}

export async function open(from = document.activeElement) {
  if (!dialog) build();
  cancelPendingClose();
  if (dialog.open) return;
  opener = from instanceof HTMLElement && from !== document.body ? from : null;
  document.documentElement.classList.add('site-search-open');
  dialog.showModal();
  input.focus();
  input.select();
  const pending = prepared ? null : load();
  render();
  if (!pending) return;
  try { await pending; } catch { /* render() shows the error state */ }
  if (dialog.open) render();
}

function cancelPendingClose() {
  clearTimeout(closeTimer);
  closeTimer = null;
  dialog.classList.remove('is-closing');
}

function requestClose() {
  if (!dialog?.open || closeTimer) return;
  if (reducedMotion.matches) { dialog.close(); return; }
  dialog.classList.add('is-closing');
  const timer = setTimeout(() => {
    if (timer !== closeTimer) return; // stale: the ticket was reopened or closed another way
    closeTimer = null;
    dialog.classList.remove('is-closing');
    dialog.close();
  }, 160);
  closeTimer = timer;
}

function onClose() {
  if (dialog.open) return; // late "close" event (it is async) from a session already reopened
  cancelPendingClose();
  document.documentElement.classList.remove('site-search-open');
  input.setAttribute('aria-expanded', 'false');
  if (opener?.isConnected) opener.focus({ preventScroll: true });
  opener = null;
}

function showState(node) {
  stateEl?.remove();
  stateEl = node;
  if (node) body.insertBefore(node, list);
}

// Only real changes reach the live region: rewriting the same text would re-announce it on every keystroke.
function setStatus(text) { if (status.textContent !== text) status.textContent = text; }

function render() {
  synonymLine.hidden = true;
  if (!prepared) {
    if (loadFailed && !loading) { renderError(); return; }
    showState(el('p', { class: 'site-search__lead', text: copy.loading }));
    renderOptions([]);
    setStatus(copy.loading);
    return;
  }
  const query = input.value.trim();
  const { tokens, results, synonymsUsed } = search(prepared, query);
  if (!tokens.length) { renderFeatured(); return; }
  if (!results.length) { renderEmpty(query); return; }
  showState(null);
  if (synonymsUsed.length) {
    synonymLine.hidden = false;
    synonymLine.textContent = `${copy.showing} ${[query, ...synonymsUsed].join(copy.and)}`;
  }
  renderOptions(results.map(result => ({ entry: result.entry, title: result.entry.title, snippet: snippetFor(result), terms: result.matched.join(' ') })));
  setStatus(copy.count(results.length));
}

function renderFeatured() {
  showState(el('p', { class: 'site-search__lead', text: copy.featured }));
  renderOptions(featured.map(item => ({
    entry: { page: item.page, anchor: item.anchor, kind: item.anchor.startsWith('#live-') ? 'live' : 'faq', time: item.time || null, title: item.label },
    title: item.label, snippet: '', terms: ''
  })));
  setStatus('');
}

function renderEmpty(query) {
  renderOptions([]);
  const tries = el('div', { class: 'site-search__try' }, ...copy.tryTerms.map(term => el('button', {
    type: 'button', class: 'site-search__try-term', text: term,
    onclick: () => { input.value = term; input.focus(); render(); }
  })));
  const whatsapp = el('a', {
    class: 'site-search__whatsapp', target: '_blank', rel: 'noopener', text: copy.whatsapp,
    href: `https://api.whatsapp.com/send?phone=5513981580498&text=${encodeURIComponent(copy.whatsappText)}`
  });
  showState(el('div', { class: 'site-search__empty' }, el('strong', { text: copy.none(query) }), el('p', { text: copy.tryLead }), tries, whatsapp));
  setStatus(copy.none(query));
}

function renderError() {
  renderOptions([]);
  const retry = el('button', { type: 'button', class: 'site-search__retry', text: copy.retry, onclick: retryLoad });
  showState(el('div', { class: 'site-search__empty site-search__error' }, el('p', { text: copy.error }), retry));
  setStatus(copy.error);
  return retry;
}

async function retryLoad() {
  const attempt = load();
  // Focus first: render() swaps the error (and the focused retry button) for the loading state.
  input.focus();
  render();
  try {
    await attempt;
  } catch {
    if (dialog.open) renderError().focus();
    return;
  }
  if (dialog.open) render();
}

function highlightInto(node, text, terms) {
  if (!terms) { node.textContent = text; return node; }
  for (const part of highlightParts(text, terms)) {
    node.append(part.match ? el('mark', { class: 'site-search__hl', text: part.text }) : document.createTextNode(part.text));
  }
  return node;
}

function destination(entry) {
  const [label, name] = entry.kind === 'live'
    ? [copy.dest.live, String(entry.time || '').replace(/^00:/, '')]
    : copy.dest[entry.page];
  return el('span', { class: 'site-search__dest' }, el('span', { class: 'site-search__dest-label', text: label }), el('b', { class: 'site-search__dest-name', text: name }));
}

function renderOptions(items) {
  options = items;
  list.replaceChildren(...items.map((item, index) => {
    const text = el('div', { class: 'site-search__text' }, highlightInto(el('strong', { class: 'site-search__title' }), item.title, item.terms));
    if (item.snippet) text.append(highlightInto(el('span', { class: 'site-search__snippet' }), item.snippet, item.terms));
    return el('li', {
      class: 'site-search__option', id: `site-search-opt-${index}`, role: 'option', 'aria-selected': 'false',
      onclick: () => activate(index), onpointermove: () => { if (activeIndex !== index) setActive(index, false); }
    }, text, destination(item.entry));
  }));
  input.setAttribute('aria-expanded', String(items.length > 0));
  setActive(items.length ? 0 : -1, false);
}

function setActive(index, scroll = true) {
  activeIndex = index;
  [...list.children].forEach((li, i) => li.setAttribute('aria-selected', String(i === index)));
  if (index < 0) { input.removeAttribute('aria-activedescendant'); return; }
  input.setAttribute('aria-activedescendant', `site-search-opt-${index}`);
  if (scroll) list.children[index].scrollIntoView({ block: 'nearest' });
}

function onKeydown(event) {
  if (event.isComposing) return;
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    if (!options.length) return;
    event.preventDefault();
    const step = event.key === 'ArrowDown' ? 1 : -1;
    setActive((activeIndex + step + options.length) % options.length);
  } else if (event.key === 'Enter' && activeIndex >= 0) {
    event.preventDefault();
    activate(activeIndex);
  }
}

function activate(index) {
  const item = options[index];
  if (!item) return;
  const { href, samePage } = buildResultUrl(item.entry, window.location, lang);
  opener = null; // the destination takes over: returning focus to the opener would scroll back to it
  dialog.close();
  if (samePage) goToAnchor(item.entry.anchor);
  else window.location.assign(href);
}

export function goToAnchor(anchor) {
  if (!anchor) { window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' }); return; }
  if (anchor.startsWith('#live-')) {
    history.replaceState(null, '', anchor);
    document.dispatchEvent(new CustomEvent('kob:live-seek', { detail: { seconds: Number(anchor.slice(6)) } }));
    return;
  }
  if (window.location.hash === anchor) history.replaceState(null, '', window.location.pathname + window.location.search);
  window.location.hash = anchor;
}

function init() {
  for (const trigger of document.querySelectorAll('[data-site-search-open]')) {
    trigger.setAttribute('aria-keyshortcuts', shortcutKeys);
    trigger.addEventListener('click', event => { event.preventDefault(); open(trigger); });
    trigger.addEventListener('pointerenter', () => { load().catch(() => {}); }, { once: true });
  }
  for (const kbd of document.querySelectorAll('[data-site-search-kbd]')) kbd.textContent = shortcutLabel;
  // Capture phase + stopPropagation: the global search owns ⌘K/Ctrl+K on every page, ahead of any handler
  // on the focused field or widget (the FAQ boxes no longer bind it).
  document.addEventListener('keydown', event => {
    const platformKey = isApple ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
    if (!platformKey || event.altKey || event.shiftKey || String(event.key).toLowerCase() !== 'k') return;
    event.preventDefault();
    event.stopPropagation();
    if (dialog?.open && !closeTimer) requestClose();
    else open(document.activeElement); // also cancels a close still animating
  }, true);
}

init();
