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

/** One reading cycle. Interaction, hidden tabs and offscreen video pause it. */
export function initLiveNoticeMarquee(viewport, text, notice, onComplete) {
  const mobile = matchMedia('(max-width: 768px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let frame, timer, startedAt, remaining = 0;
  let onscreen = true, active = false, restart = false, signature;
  function pauseTimer() {
    if (startedAt !== undefined) remaining -= performance.now() - startedAt;
    startedAt = undefined;
    clearTimeout(timer);
  }
  function complete() {
    if (!active) return;
    active = false;
    pauseTimer();
    onComplete();
  }
  function syncPlayback() {
    const paused = document.hidden || !onscreen || notice.matches(':hover, :focus-within');
    text.style.animationPlayState = paused ? 'paused' : 'running';
    pauseTimer();
    if (active && mobile.matches && !paused && !viewport.classList.contains('is-scrolling')) {
      startedAt = performance.now();
      timer = setTimeout(complete, Math.max(0, remaining));
    }
  }
  function refresh() {
    if (frame !== undefined) return;
    frame = requestAnimationFrame(() => {
      frame = undefined;
      const width = text.scrollWidth;
      const nextSignature = `${mobile.matches}:${reduced.matches}:${width}:${viewport.clientWidth}`;
      const overflowing = mobile.matches && viewport.clientWidth > 0 && width > viewport.clientWidth + 1;
      viewport.classList.toggle('is-overflowing', overflowing);
      if (overflowing) viewport.tabIndex = 0;
      else viewport.removeAttribute('tabindex');
      if (!restart && signature === nextSignature) return;
      signature = nextSignature;
      restart = false;
      pauseTimer();
      viewport.classList.remove('is-scrolling');
      // Restart only for new content, reopening or changed dimensions, not clock ticks.
      void text.offsetWidth;
      viewport.style.setProperty('--live-label-travel', `${-width}px`);
      viewport.style.setProperty('--live-label-duration', `${Math.max(8, width / 36)}s`);
      remaining = Math.max(8000, text.textContent.length / 14 * 1000);
      viewport.classList.toggle('is-scrolling', active && overflowing && !reduced.matches);
      syncPlayback();
    });
  }
  function start() { active = true; restart = true; refresh(); }
  function stop() { active = false; pauseTimer(); viewport.classList.remove('is-scrolling'); }
  text.addEventListener('animationend', event => {
    if (event.target === text && event.animationName === 'live-notice-marquee') complete();
  });
  for (const event of ['pointerenter', 'pointerleave', 'focusin']) notice.addEventListener(event, syncPlayback);
  notice.addEventListener('focusout', () => queueMicrotask(syncPlayback));
  if ('ResizeObserver' in window) new ResizeObserver(refresh).observe(viewport);
  else window.addEventListener('resize', refresh, { passive: true });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { onscreen = entry.isIntersecting; syncPlayback(); }).observe(notice);
  }
  mobile.addEventListener('change', refresh);
  reduced.addEventListener('change', refresh);
  document.fonts?.ready.then(refresh);
  document.addEventListener('visibilitychange', syncPlayback);
  return { refresh, start, stop, isReading: () => active };
}

/** Pulses retain their existing placement and stop while hidden or offscreen. */
export function initLivePulse(buttons) {
  const visible = new Map(buttons.map(button => [button, false]));
  function sync() {
    for (const button of buttons) button.style.setProperty('--live-pulse-state',
      !document.hidden && visible.get(button) ? 'running' : 'paused');
  }
  document.addEventListener('visibilitychange', sync);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) visible.set(entry.target, entry.isIntersecting);
      sync();
    });
    buttons.forEach(button => observer.observe(button));
  } else buttons.forEach(button => visible.set(button, true));
  sync();
}
