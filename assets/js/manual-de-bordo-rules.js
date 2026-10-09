// Regras da MSC (#regras-msc): the 8 topics become tabs, one topic on screen at a time, inside a board of fixed
// height. When a topic's rules don't fit, they are split into pages with previous/next buttons. Without this script
// every topic is shown in sequence. A hash like #regras-fumo (FAQ link, search result, shared link) opens that topic.
const COPY = {
  pt: { prev: 'Regras anteriores', next: 'Próximas regras', pages: 'Páginas deste tema', status: (page, total) => `Página ${page} de ${total}` },
  en: { prev: 'Previous rules', next: 'Next rules', pages: 'Pages of this topic', status: (page, total) => `Page ${page} of ${total}` },
  es: { prev: 'Reglas anteriores', next: 'Siguientes reglas', pages: 'Páginas de este tema', status: (page, total) => `Página ${page} de ${total}` }
};
const copy = COPY[(document.documentElement.lang || 'pt').slice(0, 2).toLowerCase()] || COPY.pt;
const SVG = 'http://www.w3.org/2000/svg';

const board = document.querySelector('[data-msc-rules]');
if (board) initRules(board);

function chevron(d) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', d);
  svg.append(path);
  return svg;
}

function pageButton(label, d) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'msc-rules__page-btn';
  button.setAttribute('aria-label', label);
  button.append(chevron(d));
  return button;
}

// One pager per topic: the rules are split into pages that fit the space the board leaves for the list.
function createPager(panel) {
  const list = panel.querySelector('.msc-rules__list');
  const nav = document.createElement('nav');
  nav.className = 'msc-rules__pager';
  nav.setAttribute('aria-label', copy.pages);
  nav.hidden = true;
  const status = document.createElement('p');
  status.className = 'msc-rules__page-status';
  status.setAttribute('aria-live', 'polite');
  const prev = pageButton(copy.prev, 'm15 18-6-6 6-6');
  const next = pageButton(copy.next, 'm9 6 6 6-6 6');
  const buttons = document.createElement('div');
  buttons.className = 'msc-rules__page-buttons';
  buttons.append(prev, next);
  nav.append(status, buttons);
  panel.append(nav);

  const state = { list, nav, status, prev, next, rows: [...list.children], pages: [], page: 0 };
  prev.addEventListener('click', () => showPage(state, state.page - 1));
  next.addEventListener('click', () => showPage(state, state.page + 1));
  return state;
}

function split(rows, available) {
  const pages = [];
  let current = [];
  let used = 0;
  for (const row of rows) {
    const height = row.getBoundingClientRect().height;
    if (current.length && used + height > available + 1) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(row);
    used += height;
  }
  if (current.length) pages.push(current);
  return pages;
}

function layout(state) {
  const { rows, list, nav } = state;
  rows.forEach(row => { row.hidden = false; row.classList.remove('is-page-start'); });
  nav.hidden = true;
  let pages = split(rows, list.clientHeight);
  if (pages.length > 1) {
    nav.hidden = false; // the pager takes room too: measure again with it on screen
    pages = split(rows, list.clientHeight);
  }
  state.pages = pages;
  showPage(state, Math.min(state.page, pages.length - 1), { announce: false });
}

function showPage(state, index, { announce = true } = {}) {
  const { pages, rows, list, nav, status, prev, next } = state;
  const page = Math.max(0, Math.min(index, pages.length - 1));
  state.page = page;
  rows.forEach(row => { row.hidden = !pages[page].includes(row); row.classList.remove('is-page-start'); });
  pages[page][0].classList.add('is-page-start');
  list.scrollTop = 0;
  if (nav.hidden) return;
  prev.disabled = page === 0;
  next.disabled = page === pages.length - 1;
  const text = copy.status(page + 1, pages.length);
  // The live region speaks only on a page turn, not when the layout is recomputed.
  if (!announce) status.removeAttribute('aria-live');
  status.textContent = text;
  if (!announce) requestAnimationFrame(() => status.setAttribute('aria-live', 'polite'));
}

function initRules(board) {
  const tablist = board.querySelector('[role="tablist"]');
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];
  const panels = tabs.map(tab => document.getElementById(tab.getAttribute('aria-controls')));
  const pagers = panels.map(createPager);
  const wide = matchMedia('(min-width: 1024px)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let active = 0;

  // On phones the topics are a horizontal strip: keep the chosen chip in view without moving the page.
  function revealTab(tab) {
    if (tablist.scrollWidth <= tablist.clientWidth) return;
    const left = tab.offsetLeft - (tablist.clientWidth - tab.offsetWidth) / 2;
    tablist.scrollTo({ left: Math.max(0, left), behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  }

  function select(index, { focus = false, updateHash = false } = {}) {
    tabs.forEach((tab, i) => {
      const on = i === index;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      panels[i].hidden = !on;
    });
    active = index;
    pagers[index].page = 0;
    layout(pagers[index]);
    revealTab(tabs[index]);
    if (focus) tabs[index].focus({ preventScroll: true });
    if (updateHash) history.replaceState(null, '', `#${panels[index].id}`);
  }

  const indexFromHash = () => panels.findIndex(panel => `#${panel.id}` === window.location.hash);

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(i, { updateHash: true }));
    tab.addEventListener('keydown', event => {
      const last = tabs.length - 1;
      const next = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: last }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      select(next < 0 ? last : next > last ? 0 : next, { focus: true, updateHash: true });
    });
  });

  const orient = () => tablist.setAttribute('aria-orientation', wide.matches ? 'vertical' : 'horizontal');
  orient();
  wide.addEventListener('change', orient);

  board.classList.add('is-tabbed');
  tablist.hidden = false;
  select(Math.max(0, indexFromHash()));
  window.addEventListener('hashchange', () => {
    const index = indexFromHash();
    if (index >= 0) select(index);
  });

  // Pages depend on the space the rules get: recompute when the board resizes and once the fonts are in.
  let frame = 0;
  const relayout = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => layout(pagers[active])); };
  if ('ResizeObserver' in window) new ResizeObserver(relayout).observe(board);
  document.fonts?.ready.then(relayout);
}
