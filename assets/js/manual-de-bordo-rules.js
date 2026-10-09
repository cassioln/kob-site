// Regras da MSC (#regras-msc): the 8 topics become tabs, one topic on screen at a time. Without this script every
// topic is shown in sequence. A hash like #regras-fumo (FAQ link, search result, shared link) opens that topic.
const board = document.querySelector('[data-msc-rules]');
if (board) initRules(board);

function initRules(board) {
  const tablist = board.querySelector('[role="tablist"]');
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];
  const panels = tabs.map(tab => document.getElementById(tab.getAttribute('aria-controls')));
  const wide = matchMedia('(min-width: 1024px)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

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
}
