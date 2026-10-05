export function initLiveMarkers({ track, chapters, lang, label, onSelect }) {
  const group = document.createElement('div');
  group.className = 'live-total-markers';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', label);
  const tooltip = document.createElement('div');
  tooltip.id = 'liveTotalTooltip';
  tooltip.className = 'live-total-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.hidden = true;
  const time = document.createElement('span');
  const title = document.createElement('strong');
  tooltip.append(time, title);
  let duration = 1;
  let shownIndex = -1;
  const buttons = chapters.map((chapter, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'live-total-marker';
    button.dataset.topicSeconds = chapter.seconds;
    button.dataset.markerIndex = index;
    button.setAttribute('aria-label', `${chapter.time} · ${chapter.titles[lang]}`);
    button.tabIndex = index === 0 ? 0 : -1;
    group.append(button);
    return button;
  });
  group.append(tooltip);
  track.append(group);

  function hideTooltip() {
    tooltip.hidden = true;
    if (shownIndex >= 0) {
      buttons[shownIndex].classList.remove('is-hovered');
      buttons[shownIndex].removeAttribute('aria-describedby');
    }
    shownIndex = -1;
  }
  function showTooltip(index) {
    if (index === shownIndex && !tooltip.hidden) return;
    hideTooltip();
    shownIndex = index;
    time.textContent = chapters[index].time;
    title.textContent = chapters[index].titles[lang];
    buttons[index].classList.add('is-hovered');
    buttons[index].setAttribute('aria-describedby', tooltip.id);
    tooltip.hidden = false;
    positionTooltip();
  }
  function positionTooltip() {
    const center = chapters[shownIndex].seconds / duration * track.clientWidth;
    tooltip.style.left = `${Math.max(0, Math.min(track.clientWidth - tooltip.offsetWidth, center - tooltip.offsetWidth / 2))}px`;
  }
  function nearestIndex(event) {
    const box = track.getBoundingClientRect();
    const seconds = (event.clientX - box.left) / box.width * duration;
    return chapters.reduce((nearest, chapter, index) =>
      Math.abs(chapter.seconds - seconds) < Math.abs(chapters[nearest].seconds - seconds) ? index : nearest, 0);
  }
  function focusMarker(index) {
    buttons.forEach((button, i) => { button.tabIndex = i === index ? 0 : -1; });
    buttons[index].focus({ preventScroll: true });
  }
  group.addEventListener('pointermove', event => {
    if (event.target.closest('.live-total-marker')) showTooltip(nearestIndex(event));
  });
  group.addEventListener('pointerleave', () => {
    if (!group.contains(document.activeElement)) hideTooltip();
  });
  group.addEventListener('focusin', event => {
    if (event.target.matches('.live-total-marker')) showTooltip(Number(event.target.dataset.markerIndex));
  });
  group.addEventListener('focusout', event => {
    if (!group.contains(event.relatedTarget)) hideTooltip();
  });
  group.addEventListener('click', event => {
    const button = event.target.closest('.live-total-marker');
    if (!button) return;
    const index = event.detail === 0 ? Number(button.dataset.markerIndex) : nearestIndex(event);
    focusMarker(index);
    onSelect(chapters[index]);
  });
  group.addEventListener('keydown', event => {
    const index = buttons.indexOf(event.target);
    if (index < 0) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      hideTooltip();
      return;
    }
    const destination = {
      ArrowLeft: Math.max(0, index - 1), ArrowRight: Math.min(buttons.length - 1, index + 1),
      Home: 0, End: buttons.length - 1
    }[event.key];
    if (destination === undefined) return;
    event.preventDefault();
    focusMarker(destination);
  });

  return {
    update(fullDuration, selectedId) {
      duration = fullDuration;
      const focused = buttons.includes(document.activeElement) ? document.activeElement : null;
      buttons.forEach((button, index) => {
        button.style.left = `${Math.min(100, chapters[index].seconds / duration * 100)}%`;
        const current = chapters[index].id === selectedId;
        if (current) button.setAttribute('aria-current', 'true');
        else button.removeAttribute('aria-current');
        button.tabIndex = (focused ? button === focused : current) ? 0 : -1;
      });
      if (shownIndex >= 0) positionTooltip();
    }
  };
}
