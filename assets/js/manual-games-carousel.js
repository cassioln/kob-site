// Native horizontal scrolling also keeps every card reachable without JavaScript.
const track = document.querySelector('.games-layout');
if (track) {
  const carousel = track.closest('.games-carousel');
  const controls = carousel.querySelector('.games-carousel__controls');
  const previous = controls.querySelector('[data-games-previous]');
  const next = controls.querySelector('[data-games-next]');
  const position = controls.querySelector('[data-games-position]');
  const cards = Array.from(track.children);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let frame;

  function updateControls() {
    const max = track.scrollWidth - track.clientWidth;
    previous.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft >= max - 2;
    const bounds = track.getBoundingClientRect();
    const visible = cards.map((card, index) => ({ index, bounds: card.getBoundingClientRect() }))
      .filter(card => card.bounds.left < bounds.right - 8 && card.bounds.right > bounds.left + 8);
    if (visible.length) {
      const first = visible[0].index + 1;
      const last = visible[visible.length - 1].index + 1;
      const text = `${first === last ? first : `${first}–${last}`} / ${cards.length}`;
      if (position.textContent !== text) position.textContent = text;
    }
  }

  function move(direction) {
    const origin = cards[0].getBoundingClientRect().left + track.scrollLeft;
    const offsets = cards.map(card => card.getBoundingClientRect().left + track.scrollLeft - origin);
    const target = direction > 0
      ? offsets.find(offset => offset > track.scrollLeft + 2) ?? track.scrollWidth
      : offsets.findLast(offset => offset < track.scrollLeft - 2) ?? 0;
    track.scrollTo({ left: target, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  }

  previous.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  track.addEventListener('keydown', event => {
    if (event.target !== track) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      move(event.key === 'ArrowRight' ? 1 : -1);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      track.scrollTo({ left: event.key === 'Home' ? 0 : track.scrollWidth,
        behavior: reducedMotion.matches ? 'instant' : 'smooth' });
    }
  });
  track.addEventListener('scroll', () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(updateControls);
  }, { passive: true });
  new ResizeObserver(updateControls).observe(track);
  controls.hidden = false;
  updateControls();
}
