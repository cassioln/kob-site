/** Rehearse the next title against playback time, before its topic starts. */
export function initLiveTopicTransition(element, getPlayback) {
  const breakpoint = matchMedia('(min-width: 769px)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let current;
  let pending;
  let frame;

  function phase(value) {
    if (element.dataset.topicPhase === value) return;
    if (value) element.dataset.topicPhase = value;
    else delete element.dataset.topicPhase;
  }

  function restoreCurrent() {
    if (current && element.textContent !== current.title) element.textContent = current.title;
    phase(undefined);
    element.removeAttribute('aria-busy');
  }

  function cancel() {
    cancelAnimationFrame(frame);
    pending = undefined;
    restoreCurrent();
  }

  function update(key, title, onCommit) {
    const changed = current?.key !== key;
    cancel();
    current = { key, title };
    if (element.textContent !== title) element.textContent = title;
    element.hidden = false;
    if (changed) onCommit();
  }

  function anticipate(next, onBoundary) {
    if (pending?.key === next.key || reducedMotion.matches || document.hidden) return;
    cancel();
    pending = next;
    function followPlayback() {
      const playback = getPlayback();
      if (!playback.playing || document.hidden) { cancel(); return; }
      const rate = Number.isFinite(playback.rate) && playback.rate > 0 ? playback.rate : 1;
      const remaining = (next.seconds - playback.seconds) / rate;
      if (remaining > 4.25) { cancel(); return; }
      if (remaining <= 0) {
        pending = undefined;
        onBoundary();
        return;
      }
      if (remaining <= 2.52) {
        if (element.getAttribute('aria-busy') !== 'true') element.setAttribute('aria-busy', 'true');
        if (remaining > 2.36) phase('exit');
        else if (remaining > .36) phase('gap');
        else {
          if (element.textContent !== next.title) element.textContent = next.title;
          phase('enter');
        }
      } else restoreCurrent();
      frame = requestAnimationFrame(followPlayback);
    }
    frame = requestAnimationFrame(followPlayback);
  }

  breakpoint.addEventListener('change', cancel);
  reducedMotion.addEventListener('change', cancel);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); });
  return { update, anticipate, cancel };
}
