(() => {
  'use strict';

  document.querySelectorAll('[data-footer-sponsors]').forEach(section => {
    const track = section.querySelector('.footer-sponsors__track');
    const belt = section.querySelector('.footer-sponsors__belt');
    const viewport = section.querySelector('.footer-sponsors__viewport');
    const button = section.querySelector('[data-sponsors-pause]');
    if (!track || !belt || !viewport || !button) return;

    const items = Array.from(track.children);
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    track.append(...items);

    // The second identical sequence closes the loop; only the first is in the tab order.
    const copy = track.cloneNode(true);
    copy.removeAttribute('id');
    copy.classList.add('footer-sponsors__copy');
    copy.setAttribute('aria-hidden', 'true');
    copy.querySelectorAll('a').forEach(link => link.tabIndex = -1);
    belt.append(copy);
    section.classList.add('is-enhanced');

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let paused = false;
    let onScreen = !('IntersectionObserver' in window);
    const sync = () => {
      section.classList.toggle('is-paused', paused || !onScreen || document.hidden);
      button.hidden = motion.matches;
      button.setAttribute('aria-label', paused ? button.dataset.resumeLabel : button.dataset.pauseLabel);
      button.querySelector('[data-sponsors-pause-icon]').toggleAttribute('hidden', paused);
      button.querySelector('[data-sponsors-play-icon]').toggleAttribute('hidden', !paused);
    };
    const measure = () => {
      // Fixed speed across viewports, with a seamless half-belt translation.
      belt.style.setProperty('--sponsors-duration', `${track.getBoundingClientRect().width / 28}s`);
    };
    button.addEventListener('click', () => { paused = !paused; sync(); });
    viewport.addEventListener('focusin', event => {
      if (!track.contains(event.target)) return;
      section.classList.add('is-keyboard');
      const item = event.target.closest('.footer-sponsors__item');
      viewport.scrollLeft = Math.max(0, item.offsetLeft - 12);
    });
    viewport.addEventListener('focusout', event => {
      if (viewport.contains(event.relatedTarget)) return;
      section.classList.remove('is-keyboard');
      viewport.scrollLeft = 0;
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        onScreen = entries[0].isIntersecting;
        if (onScreen) section.querySelectorAll('img').forEach(image => image.loading = 'eager');
        sync();
      }).observe(section);
    }
    motion.addEventListener('change', () => { measure(); sync(); });
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('resize', measure, { passive: true });
    measure();
    sync();
  });
})();
