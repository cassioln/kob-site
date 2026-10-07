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

/** A single accessible copy of the notice; animate only actual mobile overflow. */
export function initLiveNoticeMarquee(viewport, text, notice) {
  const mobile = matchMedia('(max-width: 768px)');
  let frame;
  let onscreen = true;
  function syncPlayback() {
    text.style.animationPlayState = document.hidden || !onscreen ? 'paused' : 'running';
  }
  function refresh() {
    if (frame !== undefined) return;
    frame = requestAnimationFrame(() => {
      frame = undefined;
      const distance = Math.max(0, text.scrollWidth - viewport.clientWidth);
      const overflowing = mobile.matches && viewport.clientWidth > 0 && distance > 1;
      viewport.classList.toggle('is-overflowing', overflowing);
      viewport.style.setProperty('--live-label-travel', `${-distance}px`);
      viewport.style.setProperty('--live-label-duration', `${Math.max(8, distance / 36 / .76)}s`);
      if (overflowing) viewport.tabIndex = 0;
      else viewport.removeAttribute('tabindex');
    });
  }
  if ('ResizeObserver' in window) new ResizeObserver(refresh).observe(viewport);
  else window.addEventListener('resize', refresh, { passive: true });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { onscreen = entry.isIntersecting; syncPlayback(); }).observe(notice);
  }
  mobile.addEventListener('change', refresh);
  document.fonts?.ready.then(refresh);
  document.addEventListener('visibilitychange', syncPlayback);
  refresh();
  return { refresh };
}
