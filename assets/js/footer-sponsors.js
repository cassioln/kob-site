(() => {
  'use strict';

  document.querySelectorAll('[data-footer-sponsors]').forEach(section => {
    const track = section.querySelector('.footer-sponsors__track');
    const controls = section.querySelector('.footer-sponsors__controls');
    const previous = section.querySelector('[data-sponsors-previous]');
    const next = section.querySelector('[data-sponsors-next]');
    if (!track || !controls || !previous || !next) return;

    const sync = () => {
      const end = track.scrollWidth - track.clientWidth;
      controls.hidden = end <= 1;
      previous.disabled = track.scrollLeft <= 1;
      next.disabled = track.scrollLeft >= end - 1;
    };

    const move = direction => {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      track.scrollBy({
        left: direction * Math.max(track.clientWidth * .8, 140),
        behavior: reducedMotion ? 'auto' : 'smooth'
      });
    };

    previous.addEventListener('click', () => move(-1));
    next.addEventListener('click', () => move(1));
    track.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync, { passive: true });
    sync();
  });
})();
