export function initLiveGuideHelp(labels) {
  const pop = document.createElement('div');
  pop.id = 'liveGuidePopover';
  pop.className = 'live-guide-popover';
  pop.hidden = true;
  pop.setAttribute('role', 'region');
  pop.setAttribute('aria-label', labels.faq);
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'live-guide-popover__close';
  close.setAttribute('aria-label', labels.closeGuide);
  close.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
  const body = document.createElement('div');
  body.className = 'live-guide-popover__body';
  pop.append(close, body);
  // Mobile shows the popover as a bottom sheet; the backdrop absorbs the dismissing tap.
  const backdrop = document.createElement('div');
  backdrop.id = 'liveGuideBackdrop';
  backdrop.className = 'live-guide-backdrop';
  backdrop.hidden = true;
  document.body.append(backdrop, pop);
  let trigger, pinned = false, timer, pointerType, suppressFocus = false;

  function hide(returnFocus = false) {
    clearTimeout(timer);
    const previous = trigger;
    trigger?.setAttribute('aria-expanded', 'false');
    trigger = undefined;
    pinned = false;
    pop.hidden = true;
    backdrop.hidden = true;
    if (returnFocus) {
      suppressFocus = true;
      previous?.focus({ preventScroll: true });
      suppressFocus = false;
    }
  }
  function place() {
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(460, innerWidth - 24);
    const above = rect.top - 20;
    const below = innerHeight - rect.bottom - 20;
    const heightLimit = Math.min(520, innerHeight - 24, Math.max(140, above, below));
    pop.style.width = `${width}px`;
    pop.style.maxHeight = `${heightLimit}px`;
    body.style.maxHeight = `${heightLimit - 52}px`;
    const height = pop.getBoundingClientRect().height;
    const top = below >= height || below >= above ? rect.bottom + 8 : rect.top - height - 8;
    pop.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - width - 12))}px`;
    pop.style.top = `${Math.max(12, Math.min(top, innerHeight - height - 12))}px`;
  }
  function show(button) {
    clearTimeout(timer);
    if (trigger !== button) {
      hide();
      const faq = document.getElementById(button.dataset.liveFaq);
      if (!faq) return;
      trigger = button;
      const heading = document.createElement('h4');
      heading.textContent = faq.querySelector('.faq-item__summary-title')?.textContent.trim();
      const content = faq.querySelector('.faq-item__content').cloneNode(true);
      content.removeAttribute('id');
      content.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
      content.querySelectorAll('a').forEach(link => {
        if (link.getAttribute('href')?.startsWith('#')) link.replaceWith(document.createTextNode(link.textContent));
        else { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
      });
      body.replaceChildren(heading, content);
    }
    pop.hidden = false;
    backdrop.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    button.setAttribute('aria-controls', pop.id);
    place();
  }
  const delayHide = () => {
    clearTimeout(timer);
    if (!pinned) timer = setTimeout(() => hide(), 220);
  };
  document.addEventListener('pointerdown', event => { pointerType = event.pointerType; }, true);
  document.addEventListener('keydown', () => { pointerType = ''; }, true);
  document.addEventListener('pointerover', event => {
    const button = event.target.closest('[data-live-faq]');
    if (button && event.pointerType === 'mouse' && (!pinned || trigger === button)) show(button);
  });
  document.addEventListener('pointerout', event => {
    const button = event.target.closest('[data-live-faq]');
    if (button && !button.contains(event.relatedTarget)) delayHide();
  });
  document.addEventListener('focusin', event => {
    if (suppressFocus) return;
    const button = event.target.closest('[data-live-faq]');
    if (button && pointerType !== 'touch') { show(button); pinned = button.matches(':focus-visible'); }
    else if (trigger && !pop.contains(event.target) && pointerType !== 'touch') hide();
  });
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-live-faq]');
    if (button) {
      if (button === trigger && pinned) hide();
      else { show(button); pinned = true; }
    } else if (trigger && !pop.contains(event.target)) hide();
  });
  pop.addEventListener('pointerenter', () => clearTimeout(timer));
  pop.addEventListener('pointerleave', delayHide);
  close.addEventListener('click', () => hide(true));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !pop.hidden) {
      event.preventDefault();
      event.stopImmediatePropagation();
      hide(true);
    }
  }, true);
  document.addEventListener('scroll', event => {
    if (!trigger || pop.contains(event.target)) return;
    const rect = trigger.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > innerHeight) hide();
    else place();
  }, true);
  window.addEventListener('resize', () => hide());
  document.addEventListener('fullscreenchange', () => hide());
  return { hide };
}
