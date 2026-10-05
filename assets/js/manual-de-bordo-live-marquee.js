/** Measure real text overflow without duplicating the accessible label. */
export function initLiveControlMarquee(buttons) {
  const labels = buttons.map(button => button.querySelector('.live-control-label'));
  let frame;
  let onscreen = true;
  function syncPlayback() {
    labels.forEach(label => { label.firstElementChild.style.animationPlayState = document.hidden || !onscreen ? 'paused' : 'running'; });
  }
  function measure() {
    frame = undefined;
    for (const label of labels) {
      const text = label.firstElementChild;
      const distance = Math.max(0, text.scrollWidth - label.clientWidth);
      label.classList.toggle('is-overflowing', label.clientWidth > 0 && distance > 1);
      label.style.setProperty('--live-label-travel', `${-distance}px`);
      label.style.setProperty('--live-label-duration', `${Math.max(6, distance / 24 / .76)}s`);
    }
  }
  function refresh() {
    if (frame === undefined) frame = requestAnimationFrame(measure);
  }
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(refresh);
    labels.forEach(label => observer.observe(label));
  } else window.addEventListener('resize', refresh, { passive: true });
  document.fonts?.ready.then(refresh);
  document.addEventListener('visibilitychange', syncPlayback);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { onscreen = entry.isIntersecting; syncPlayback(); })
      .observe(buttons[0].closest('.live-custom-controls'));
  }
  refresh();
  return { refresh };
}
