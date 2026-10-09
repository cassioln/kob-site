(function () {
  'use strict';

  var drawer = document.getElementById('drawer');
  var toggle = document.getElementById('navToggle');
  var closeButton = document.getElementById('drawerClose');
  var backdrop = document.querySelector('[data-navigation-backdrop]');
  var language = document.querySelector('header .lang-switch');
  var languageHost = document.querySelector('[data-drawer-language]');
  if (!drawer || !toggle || !closeButton || !language || !languageHost) return;

  var headerHost = language.parentElement;
  var headerNext = language.nextElementSibling;
  var mobile = window.matchMedia('(max-width: 1024px)');
  var inertStates = new Map();
  var previousOverflow = '';

  function placeHeaderControls() {
    if (mobile.matches) languageHost.appendChild(language);
    else headerHost.insertBefore(language, headerNext);
  }

  function openDrawer() {
    previousOverflow = document.body.style.overflow;
    Array.from(document.body.children).forEach(function (element) {
      if (element === drawer || element === backdrop || /^(SCRIPT|STYLE|LINK)$/.test(element.tagName)) return;
      inertStates.set(element, element.inert);
      element.inert = true;
    });
    drawer.dataset.open = 'true';
    drawer.setAttribute('aria-hidden', 'false');
    drawer.inert = false;
    toggle.setAttribute('aria-expanded', 'true');
    if (backdrop) backdrop.dataset.open = 'true';
    document.body.style.overflow = 'hidden';
    closeButton.focus();
  }

  function closeDrawer(returnFocus) {
    if (drawer.dataset.open !== 'true') return;
    drawer.dataset.open = 'false';
    drawer.setAttribute('aria-hidden', 'true');
    drawer.inert = true;
    toggle.setAttribute('aria-expanded', 'false');
    if (backdrop) backdrop.dataset.open = 'false';
    document.body.style.overflow = previousOverflow;
    inertStates.forEach(function (wasInert, element) { element.inert = wasInert; });
    inertStates.clear();
    if (returnFocus !== false) toggle.focus();
  }

  toggle.hidden = false;
  placeHeaderControls();
  mobile.addEventListener('change', function () {
    closeDrawer(false);
    placeHeaderControls();
  });
  window.addEventListener('resize', function () {
    if (!toggle.getClientRects().length) closeDrawer(false);
  });
  toggle.addEventListener('click', openDrawer);
  closeButton.addEventListener('click', closeDrawer);
  if (backdrop) backdrop.addEventListener('click', closeDrawer);
  drawer.addEventListener('click', function (event) {
    if (event.target.closest('a[href]')) closeDrawer();
  });
  document.addEventListener('keydown', function (event) {
    if (drawer.dataset.open !== 'true') return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDrawer();
    } else if (event.key === 'Tab') {
      var focusable = Array.from(drawer.querySelectorAll('a[href], button:not([disabled]), [tabindex="0"]'))
        .filter(function (element) { return element.getClientRects().length && !element.closest('[inert]'); });
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
})();
