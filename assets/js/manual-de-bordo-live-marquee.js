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
  const repeat = document.createElement('span');
  repeat.className = 'live-notice-repeat';
  repeat.setAttribute('aria-hidden', 'true');
  let frame;
  let onscreen = true;
  function syncPlayback() {
    text.style.animationPlayState = document.hidden || !onscreen ? 'paused' : 'running';
  }
  function refresh() {
    if (frame !== undefined) return;
    frame = requestAnimationFrame(() => {
      frame = undefined;
      repeat.remove();
      const originalWidth = text.scrollWidth;
      const overflowing = mobile.matches && viewport.clientWidth > 0 && originalWidth > viewport.clientWidth + 1;
      if (overflowing) {
        repeat.textContent = Array.from(text.children)
          .filter(message => !message.hidden)
          .map(message => message.classList.contains('live-notice-update')
            ? message.querySelector('.live-notice-body').textContent : message.textContent)
          .join(' · ');
        text.append(repeat);
      }
      const travel = originalWidth + 32;
      viewport.classList.toggle('is-overflowing', overflowing);
      viewport.style.setProperty('--live-label-travel', `${-travel}px`);
      viewport.style.setProperty('--live-label-duration', `${Math.max(8, travel / 36)}s`);
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
