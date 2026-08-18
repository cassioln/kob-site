document.documentElement.classList.add('js');
(function () {
  'use strict';

  // Contrato analytics v1: o site declara fatos de negócio no dataLayer;
  // consentimento, allowlist e envio ao GA4 continuam sob responsabilidade do GTM.
  function compactAnalyticsValue(value) {
    if (value === null || typeof value === 'undefined') return undefined;
    if (typeof value === 'string' && value.trim() === '') return undefined;
    if (Array.isArray(value)) {
      return value.map(compactAnalyticsValue).filter(function (item) {
        return typeof item !== 'undefined';
      });
    }
    if (typeof value === 'object') {
      var compactObject = {};
      Object.keys(value).forEach(function (key) {
        var compactValue = compactAnalyticsValue(value[key]);
        if (typeof compactValue !== 'undefined') compactObject[key] = compactValue;
      });
      return compactObject;
    }
    return value;
  }

  function trackAnalytics(eventName, data) {
    if (!/^[a-z][a-z0-9_]*$/.test(eventName)) return null;
    var cleanData = compactAnalyticsValue(data || {});
    var payload = { event: eventName, schema_version: 1 };
    Object.keys(cleanData).forEach(function (key) {
      if (key !== 'event' && key !== 'schema_version') payload[key] = cleanData[key];
    });
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(payload);
    return payload;
  }

  window.KOBAnalytics = Object.freeze({ track: trackAnalytics });

  // Expansão de blocos de conteúdo aprofundado (galeria, depoimentos):
  // emite uma vez por content_id por page view, apenas ao expandir.
  var expandedContentIds = {};
  function trackContentExpand(contentType, contentId) {
    if (expandedContentIds[contentId]) return;
    expandedContentIds[contentId] = true;
    trackAnalytics('kob_content_expand', { content_type: contentType, content_id: contentId });
  }

  // O Enhanced Measurement captura o href do elemento clicado como link_url.
  // Mantemos telefone/mensagem fora do href e usamos o destino completo somente
  // para navegação, sem adicioná-lo ao payload de analytics.
  function whatsappSafeHref(link) {
    var ctaId = link.dataset.analyticsCtaId;
    if (!ctaId) return '#reserve';
    var href = '/whatsapp.html?cta=' + encodeURIComponent(ctaId);
    var itemId = link.dataset.analyticsItemId;
    if (itemId) href += '&item=' + encodeURIComponent(itemId);
    return href;
  }
  var whatsappDestinations = new WeakMap();
  document.querySelectorAll('a[data-analytics-channel="whatsapp"]').forEach(function (link) {
    if (link.dataset.kobWhatsappBound || !link.href || link.getAttribute('href') === '#') return;
    whatsappDestinations.set(link, link.href);
    link.href = whatsappSafeHref(link);
    link.dataset.kobWhatsappBound = 'main';
  });

  var VALUE_LISTS = {
    'panel-cabines': {
      item_list_id: 'cabins_2026',
      item_list_name: 'Cabines 2026',
      items: [
        { key: 'interna', item_id: 'cabin_internal', item_name: 'Cabine interna', item_category: 'cabin' },
        { key: 'janela', item_id: 'cabin_ocean_view', item_name: 'Cabine janela', item_category: 'cabin' },
        { key: 'varanda', item_id: 'cabin_balcony', item_name: 'Cabine varanda', item_category: 'cabin' }
      ]
    },
    'panel-bebidas': {
      item_list_id: 'drink_packages_2026',
      item_list_name: 'Pacotes de bebidas 2026',
      items: [
        { key: 'naoalcoolico', item_id: 'drink_non_alcoholic', item_name: 'Pacote não alcoólico', item_category: 'drink_package' },
        { key: 'easy', item_id: 'drink_easy', item_name: 'Pacote Easy', item_category: 'drink_package' },
        { key: 'premium', item_id: 'drink_premium', item_name: 'Pacote Premium', item_category: 'drink_package' }
      ]
    }
  };
  var trackedValueLists = {};

  function analyticsItem(item) {
    if (!item) return null;
    return {
      item_id: item.item_id,
      item_name: item.item_name,
      item_category: item.item_category
    };
  }

  function findAnalyticsItem(key) {
    var found = null;
    Object.keys(VALUE_LISTS).some(function (panelId) {
      var list = VALUE_LISTS[panelId];
      var item = list.items.find(function (candidate) { return candidate.key === key; });
      if (!item) return false;
      found = { list: list, item: item };
      return true;
    });
    return found;
  }

  function trackValueList(panelId) {
    var list = VALUE_LISTS[panelId];
    if (!list || trackedValueLists[list.item_list_id]) return;
    trackedValueLists[list.item_list_id] = true;
    trackAnalytics('view_item_list', {
      item_list_id: list.item_list_id,
      item_list_name: list.item_list_name,
      items: list.items.map(analyticsItem)
    });
  }

  // Nav: some ao rolar dentro do hero; reaparece (com fundo) a partir da
  // seção #navio em diante — o header fica visível dela pra frente.
  var nav = document.getElementById('nav');
  var navioEl = document.getElementById('navio');
  var navioReached = false;
  var navScrollFrame = null;
  function syncNavScroll() {
    navScrollFrame = null;
    var y = window.scrollY;
    var passedFold = navioEl ? navioReached : y >= window.innerHeight;
    // A partir de #navio: header visível com fundo azul
    nav.dataset.scrolled = passedFold ? 'true' : 'false';
    // Antes de #navio e já rolando: oculta; no topo (<=20) fica visível
    nav.dataset.hidden = (!passedFold && y > 20) ? 'true' : 'false';
  }
  function queueNavScroll() {
    if (!navScrollFrame) navScrollFrame = requestAnimationFrame(syncNavScroll);
  }
  window.addEventListener('scroll', queueNavScroll, { passive: true });
  window.addEventListener('resize', queueNavScroll, { passive: true });
  if (navioEl && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        navioReached = entry.isIntersecting || entry.boundingClientRect.top < 0;
      });
      queueNavScroll();
    }, { threshold: 0 }).observe(navioEl);
  }

  // Drawer mobile
  var drawer = document.getElementById('drawer');
  var toggle = document.getElementById('navToggle');
  var closeBtn = document.getElementById('drawerClose');
  function openDrawer() { drawer.dataset.open = 'true'; drawer.setAttribute('aria-hidden', 'false'); drawer.removeAttribute('inert'); toggle.setAttribute('aria-expanded', 'true'); document.body.style.overflow = 'hidden'; setInert(true); closeBtn.focus(); }
  function closeDrawer() { drawer.dataset.open = 'false'; drawer.setAttribute('aria-hidden', 'true'); drawer.setAttribute('inert', ''); toggle.setAttribute('aria-expanded', 'false'); document.body.style.overflow = ''; setInert(false); toggle.focus(); }
  function setInert(on) {
    ['main', 'header.nav', 'footer'].forEach(function (sel) {
      var el = document.querySelector(sel);
      if (!el) return;
      if (on) el.setAttribute('inert', ''); else el.removeAttribute('inert');
    });
  }
  toggle.addEventListener('click', openDrawer);
  closeBtn.addEventListener('click', closeDrawer);
  drawer.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', closeDrawer); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && drawer.dataset.open === 'true') closeDrawer(); });

  // (Tabs removidas: a antiga seção "Informações" virou "Itinerário", sem abas.)

  // Countdown + ampulheta de turno → ciclo anual até 20/11/2026 09:00 (Brasília, -03:00)
  var countdownStart = new Date('2025-11-20T09:00:00-03:00').getTime();
  var target = new Date('2026-11-20T09:00:00-03:00').getTime();
  var countdown = document.getElementById('countdown');
  var elDays = document.querySelector('[data-count="days"]');
  var elHours = document.querySelector('[data-count="hours"]');
  var elMin = document.querySelector('[data-count="minutes"]');
  var countdownLabel = countdown && countdown.querySelector('.event-score__label');
  var countdownReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function setCount(el, value) {
    value = String(value);
    if (!el || el.textContent === value) return;
    el.textContent = value;
    if (!countdownReduce && typeof el.animate === 'function') {
      el.animate([
        { opacity: 0.45, transform: 'translateY(-4px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ], { duration: 320, easing: 'cubic-bezier(.25, 1, .5, 1)' });
    }
  }
  function tick() {
    var now = Date.now();
    var diff = target - now;
    var total = target - countdownStart;
    var progress = Math.max(0, Math.min(1, (now - countdownStart) / total));
    var progressPercent = Math.round(progress * 100);
    countdown.style.setProperty('--sand-progress', progress.toFixed(6));
    countdown.style.setProperty('--sand-remaining', (1 - progress).toFixed(6));
    if (diff <= 0) {
      setCount(elDays, '0'); setCount(elHours, '00'); setCount(elMin, '00');
      countdown.dataset.complete = 'true';
      if (countdownLabel) countdownLabel.textContent = 'É hora de embarcar!';
      countdown.setAttribute('aria-label', 'A contagem terminou. É hora de embarcar.');
      return;
    }
    var s = Math.floor(diff / 1000);
    var days = Math.floor(s / 86400);
    var hours = Math.floor((s % 86400) / 3600);
    var minutes = Math.floor((s % 3600) / 60);
    setCount(elDays, days);
    setCount(elHours, pad(hours));
    setCount(elMin, pad(minutes));
    countdown.dataset.complete = 'false';
    if (countdownLabel) countdownLabel.textContent = 'Contagem Regressiva';
    countdown.setAttribute('aria-label', 'Faltam ' + days + ' dias, ' + hours + ' horas e ' + minutes + ' minutos para o embarque. ' + progressPercent + '% do caminho percorrido.');
  }
  if (countdown && elDays && elHours && elMin) {
    tick();
    window.requestAnimationFrame(function () { countdown.classList.add('is-ready'); });
    setInterval(tick, 30000);
  }

  // Reveal ao rolar (realça um default já visível; respeita reduced-motion)
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var reveals = document.querySelectorAll('.reveal');
  function revealAll() { reveals.forEach(function (el) { el.classList.add('is-in'); }); }
  // Revela só o que está na viewport agora (preserva o gate de scroll pro resto)
  function revealInView() {
    reveals.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('is-in');
    });
  }
  if (reduce || !('IntersectionObserver' in window)) {
    // Sem animação: conteúdo permanece visível (nunca ativamos o gate js-reveal)
    revealAll();
  } else {
    // Ativa o gate só quando temos como reverter; conteúdo continua visível se algo falhar
    document.documentElement.classList.add('js-reveal');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
    reveals.forEach(function (el) { io.observe(el); });
    // Salvaguarda: revela apenas o que já está visível — o resto continua no gate de scroll
    setTimeout(revealInView, 2500);
    // Se a aba abrir já rolada (deep-link), garante o que está na viewport
    window.addEventListener('load', revealInView);
  }

  // EMBARQUE / CARTAS: abre o leque real quando a dobra entra no viewport.
  var cardsDeck = document.querySelector('.deck--cards');
  if (cardsDeck) {
    if (reduce || !('IntersectionObserver' in window)) {
      cardsDeck.classList.add('is-in');
    } else {
      new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            cardsDeck.classList.add('is-in');
            obs.unobserve(entry.target);
          }
        });
      }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' }).observe(cardsDeck);
    }
  }

  var track = document.getElementById('gallery');

  // Lightbox navegável da galeria (delegação mantém o arquivo progressivo sob demanda).
  var dialog = document.getElementById('lightbox');
  if (dialog && track && typeof dialog.showModal === 'function') {
    var lbImg = document.getElementById('lbImg');
    var lbCap = document.getElementById('lbCap');
    var lbCounter = document.getElementById('lbCounter');
    var items = [];
    var current = 0;
    function refreshLightboxItems() {
      return Array.prototype.slice.call(track.querySelectorAll('a[data-memory]'));
    }
    function render() {
      var it = items[current];
      if (!it) return;
      lbImg.src = it.src;
      lbImg.alt = it.alt;
      lbCap.textContent = it.alt;
      lbCounter.textContent = (current + 1) + ' / ' + items.length;
    }
    function open(link) {
      var links = refreshLightboxItems();
      current = Math.max(0, links.indexOf(link));
      items = links.map(function (anchor) {
        var image = anchor.querySelector('img');
        return { src: anchor.getAttribute('href'), alt: image ? image.getAttribute('alt') : '' };
      });
      render();
      if (!dialog.open) dialog.showModal();
    }
    function go(step) { current = (current + step + items.length) % items.length; render(); }
    track.addEventListener('click', function (event) {
      var link = event.target.closest('a[data-memory]');
      if (!link || !track.contains(link)) return;
      event.preventDefault();
      open(link);
    });
    document.getElementById('lbNext').addEventListener('click', function () { go(1); });
    document.getElementById('lbPrev').addEventListener('click', function () { go(-1); });
    document.getElementById('lbClose').addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    });
    // Clicar no fundo (backdrop) fecha
    dialog.addEventListener('click', function (e) {
      if (e.target === dialog) dialog.close();
    });
  }

  // Slider da galeria (setas navegam o trilho; estado das setas nas pontas)
  var galPrev = document.getElementById('galPrev');
  var galNext = document.getElementById('galNext');
  if (track && galPrev && galNext) {
    function step() {
      var first = track.querySelector('a');
      var w = first ? first.getBoundingClientRect().width : track.clientWidth * 0.6;
      var gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap || '14') || 14;
      return (w + gap) * Math.max(1, Math.floor(track.clientWidth / (w + gap)));
    }
    function updateButtons() {
      var max = track.scrollWidth - track.clientWidth - 2;
      galPrev.disabled = track.scrollLeft <= 2;
      galNext.disabled = track.scrollLeft >= max;
    }
    galPrev.addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: 'smooth' }); });
    galNext.addEventListener('click', function () { track.scrollBy({ left: step(), behavior: 'smooth' }); });
    track.addEventListener('scroll', updateButtons, { passive: true });
    window.addEventListener('resize', updateButtons);
    updateButtons();
  }

  // Edição 2025: 8 destaques sorteados a cada carregamento + arquivo sob demanda.
  var galleryExpand = document.getElementById('galleryExpand');
  if (track && galleryExpand) {
    var galleryTemplate = document.getElementById('galleryMemories');
    var gallerySource = galleryTemplate ? galleryTemplate.content : track;
    var memories = Array.prototype.slice.call(gallerySource.querySelectorAll('[data-memory]'));
    var highlightCount = Math.min(parseInt(track.getAttribute('data-highlight-count'), 10) || 8, memories.length);
    var galleryExpandLabel = galleryExpand.querySelector('[data-gallery-expand-label]');
    var galleryStatus = document.getElementById('galleryStatus');

    // Fisher-Yates: sorteia quais índices viram destaque nesta visita.
    var order = memories.map(function (_, i) { return i; });
    for (var i = order.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = order[i]; order[i] = order[j]; order[j] = tmp;
    }
    var highlightSet = {};
    order.slice(0, highlightCount).forEach(function (idx, slot) {
      highlightSet[idx] = slot + 1;
    });

    var highlights = [];
    var archive = [];
    function thumbnailUrl(original, width) {
      return original.replace(/([^/]+)\.webp$/, 'thumbs/$1-' + width + '.webp');
    }
    function loadMemoryImage(item) {
      var image = item.querySelector('img[data-src]');
      if (!image) return;
      var original = image.dataset.src;
      var slot = parseInt(item.style.getPropertyValue('--highlight-slot'), 10);
      var desktopSize = '25vw';
      if (!item.classList.contains('edition-memory--portrait')) {
        if (slot === 1) desktopSize = '58vw';
        else if (slot === 2 || slot === 3) desktopSize = '42vw';
        else if (slot === 4 || slot === 5 || slot === 8) desktopSize = '50vw';
      }
      image.src = thumbnailUrl(original, 480);
      image.srcset = thumbnailUrl(original, 480) + ' 480w, ' + thumbnailUrl(original, 960) + ' 960w';
      image.sizes = item.hasAttribute('data-highlight')
        ? '(max-width: 680px) 100vw, (max-width: 980px) 66vw, ' + desktopSize
        : '(max-width: 680px) 100vw, (max-width: 980px) 50vw, 25vw';
      image.removeAttribute('data-src');
    }
    memories.forEach(function (item, idx) {
      if (highlightSet[idx]) {
        item.setAttribute('data-highlight', '');
        item.style.setProperty('--highlight-slot', highlightSet[idx]);
        loadMemoryImage(item);
        item.hidden = false;
        track.appendChild(item);
        highlights.push(item);
      } else {
        item.removeAttribute('data-highlight');
        item.style.removeProperty('--highlight-slot');
        item.hidden = true;
        archive.push(item);
      }
    });

    var totalLabel = 'Ver todas as ' + memories.length + ' fotografias';
    var archiveMaterialized = false;
    galleryExpand.addEventListener('click', function () {
      var expanded = galleryExpand.getAttribute('aria-expanded') === 'true';
      var nextState = !expanded;
      if (nextState && !archiveMaterialized) {
        var archiveFragment = document.createDocumentFragment();
        archive.forEach(function (item) { archiveFragment.appendChild(item); });
        track.appendChild(archiveFragment);
        archiveMaterialized = true;
      }
      archive.forEach(function (item) {
        if (nextState) loadMemoryImage(item);
        item.hidden = !nextState;
      });
      galleryExpand.setAttribute('aria-expanded', nextState ? 'true' : 'false');
      track.dataset.expanded = nextState ? 'true' : 'false';
      if (nextState) trackContentExpand('gallery', 'edition_2025_gallery');
      if (galleryExpandLabel) {
        galleryExpandLabel.textContent = nextState ? 'Recolher galeria' : totalLabel;
      }
      if (galleryStatus) {
        galleryStatus.textContent = nextState
          ? 'Galeria expandida. ' + memories.length + ' fotografias disponíveis.'
          : 'Galeria recolhida. ' + highlights.length + ' destaques disponíveis.';
      }
    });
  }

  // Depoimentos: designers permanecem primeiro; celular abre 1 relato e telas maiores, 3.
  var voicesDeck = document.getElementById('voices');
  var voicesExpand = document.getElementById('voicesExpand');
  if (voicesDeck && voicesExpand) {
    var randomVoices = Array.prototype.slice.call(voicesDeck.querySelectorAll('[data-voice-random]'));
    var featuredVoiceCount = voicesDeck.querySelectorAll('[data-voice-featured]').length;
    var mobileVoices = window.matchMedia('(max-width: 680px)');
    function collapsedRandomCount() { return mobileVoices.matches ? 1 : 3; }
    function setVoicesVisibility(expanded) {
      var visibleRandomCount = collapsedRandomCount();
      randomVoices.forEach(function (voice, slot) {
        voice.hidden = !expanded && slot >= visibleRandomCount;
      });
    }
    for (var voiceIndex = randomVoices.length - 1; voiceIndex > 0; voiceIndex--) {
      var randomIndex = Math.floor(Math.random() * (voiceIndex + 1));
      var randomVoice = randomVoices[voiceIndex];
      randomVoices[voiceIndex] = randomVoices[randomIndex];
      randomVoices[randomIndex] = randomVoice;
    }

    randomVoices.forEach(function (voice, slot) {
      voice.setAttribute('data-voice-slot', String(slot + 1));
      voice.style.setProperty('--depth', String((slot % 3) + 1));
      voicesDeck.appendChild(voice);
    });

    setVoicesVisibility(false);
    var voicesExpandLabel = voicesExpand.querySelector('[data-voices-expand-label]');
    var voicesStatus = document.getElementById('voicesStatus');
    voicesExpand.addEventListener('click', function () {
      var expanded = voicesExpand.getAttribute('aria-expanded') === 'true';
      var nextState = !expanded;
      setVoicesVisibility(nextState);
      voicesExpand.setAttribute('aria-expanded', nextState ? 'true' : 'false');
      voicesDeck.dataset.expanded = nextState ? 'true' : 'false';
      if (nextState) trackContentExpand('testimonials', 'participant_voices');
      if (voicesExpandLabel) {
        voicesExpandLabel.textContent = nextState ? 'Recolher depoimentos' : 'Ver mais';
      }
      if (voicesStatus) {
        voicesStatus.textContent = nextState
          ? 'Todos os ' + (featuredVoiceCount + randomVoices.length) + ' depoimentos estão visíveis.'
          : 'Depoimentos recolhidos. ' + (featuredVoiceCount + collapsedRandomCount()) + ' relatos estão visíveis.';
      }
    });
    mobileVoices.addEventListener('change', function () {
      if (voicesExpand.getAttribute('aria-expanded') !== 'true') setVoicesVisibility(false);
    });
  }

  // Slideshow de banners do navio (autoplay + setas + dots, pausa no hover)
  var show = document.getElementById('shipShow');
  if (show) {
    var slides = Array.prototype.slice.call(show.querySelectorAll('.ship-slide'));
    var dotsWrap = document.getElementById('shipDots');
    var currentDisplay = show.querySelector('[data-ship-current]');
    var totalDisplay = show.querySelector('[data-ship-total]');
    var idx = 0, timer = null;
    // Nome exclusivo: o hero declara outro `var reduceMotion` no mesmo IIFE.
    // Com `var`, o nome compartilhado era sobrescrito por um MediaQueryList
    // truthy e bloqueava permanentemente o autoplay deste carrossel.
    var shipReduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var finePointer = window.matchMedia('(pointer: fine)').matches && !shipReduceMotion;
    var inView = true;
    var pointerFrame = null;
    var padIndex = function (i) { return String(i + 1).padStart(2, '0'); };
    // O backup salvo do browser pode trazer dots já renderizados.
    // Limpa antes de reconstruir para evitar tabs duplicadas.
    if (dotsWrap) dotsWrap.textContent = '';
    // Cria o trilho de miniaturas a partir das próprias imagens do carrossel.
    var dots = slides.map(function (s, i) {
      var b = document.createElement('button');
      var image = s.querySelector('img');
      var title = s.querySelector('figcaption b');
      var marker = document.createElement('span');
      var tabId = 'ship-tab-' + (i + 1);
      var panelId = 'ship-slide-' + (i + 1);
      b.id = tabId;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-controls', panelId);
      b.setAttribute('aria-label', 'Mostrar ' + (title ? title.textContent : 'foto ' + (i + 1)) + ', foto ' + (i + 1) + ' de ' + slides.length);
      s.id = panelId;
      s.setAttribute('role', 'tabpanel');
      s.setAttribute('aria-labelledby', tabId);
      b.style.setProperty('--ship-thumb', 'url("' + image.src + '")');
      marker.setAttribute('aria-hidden', 'true');
      marker.textContent = padIndex(i);
      b.appendChild(marker);
      b.addEventListener('click', function () { goTo(i, true); });
      dotsWrap.appendChild(b);
      return b;
    });
    function goTo(i, manual) {
      idx = (i + slides.length) % slides.length;
      var current = padIndex(idx);
      slides.forEach(function (s, k) {
        var active = k === idx;
        s.dataset.active = active ? 'true' : 'false';
        s.setAttribute('aria-hidden', active ? 'false' : 'true');
      });
      dots.forEach(function (d, k) {
        var active = k === idx;
        d.setAttribute('aria-current', active ? 'true' : 'false');
        d.setAttribute('aria-selected', active ? 'true' : 'false');
        d.tabIndex = active ? 0 : -1;
      });
      show.dataset.current = current;
      show.dataset.total = padIndex(slides.length - 1);
      if (currentDisplay) currentDisplay.textContent = current;
      if (totalDisplay) totalDisplay.textContent = padIndex(slides.length - 1);
      if (manual) restart();
    }
    function next() { goTo(idx + 1); }
    function start() {
      if (!shipReduceMotion && inView && !document.hidden && !timer &&
        (!finePointer || !show.matches(':hover')) && !show.contains(document.activeElement)) {
        timer = setInterval(next, 5000);
        show.dataset.paused = 'false';
      }
    }
    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
      show.dataset.paused = 'true';
    }
    function restart() { stop(); start(); }
    document.getElementById('shipNext').addEventListener('click', function () { goTo(idx + 1, true); });
    document.getElementById('shipPrev').addEventListener('click', function () { goTo(idx - 1, true); });
    show.addEventListener('mouseenter', stop);
    show.addEventListener('mouseleave', function () {
      if (pointerFrame) cancelAnimationFrame(pointerFrame);
      show.style.setProperty('--ship-tilt-x', '0deg');
      show.style.setProperty('--ship-tilt-y', '0deg');
      show.style.setProperty('--ship-pan-x', '0px');
      show.style.setProperty('--ship-pan-y', '0px');
      start();
    });
    show.addEventListener('focusin', stop);
    show.addEventListener('focusout', function (event) {
      if (!show.contains(event.relatedTarget)) start();
    });
    show.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft') { event.preventDefault(); goTo(idx - 1, true); }
      if (event.key === 'ArrowRight') { event.preventDefault(); goTo(idx + 1, true); }
      if (event.key === 'Home') { event.preventDefault(); goTo(0, true); }
      if (event.key === 'End') { event.preventDefault(); goTo(slides.length - 1, true); }
    });
    if (finePointer) {
      show.addEventListener('pointermove', function (event) {
        if (pointerFrame) cancelAnimationFrame(pointerFrame);
        pointerFrame = requestAnimationFrame(function () {
          pointerFrame = null;
          var rect = show.getBoundingClientRect();
          var x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
          var y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
          show.style.setProperty('--ship-tilt-x', (x * 1.6).toFixed(2) + 'deg');
          show.style.setProperty('--ship-tilt-y', (y * -1.15).toFixed(2) + 'deg');
          show.style.setProperty('--ship-pan-x', (x * -7).toFixed(1) + 'px');
          show.style.setProperty('--ship-pan-y', (y * -5).toFixed(1) + 'px');
        });
      }, { passive: true });
    }
    // pausa quando fora da tela
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          inView = e.isIntersecting;
          if (inView) start(); else stop();
        });
      }, { threshold: 0.25 }).observe(show);
    } else { start(); }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else start();
    });
    goTo(0);
    show.dataset.ready = 'true';
  }

  // Hero com vídeo de fundo em 3 fases:
  //  1) hero-intro WebM/MP4 autoplay 0→4s
  //  2) aos 4s, corte direto para hero-loop já renderizado
  //  3) scroll na 1ª dobra faz scrubbing por SEQUÊNCIA DE FRAMES em <canvas>
  //     (evita o stutter de seek em <video>; frames = trecho 5s→fim do hero-intro)
  var heroBg = document.getElementById('heroBg');
  var dive = document.getElementById('heroDive');
  var loop = document.getElementById('heroLoop');
  var canvas = document.getElementById('heroCanvas');
  if (heroBg && dive && loop && canvas) {
    var SHADE_STRONG_AT = 2; // reforça a sombra diagonal quando a marca fica mais visível
    var REVEAL_AT = 3;      // inicia a entrada do hero__inner após 3s reais de playback
    var FRAME_COUNT = 60;   // frames do scrub, pré-extraídos do master completo a partir de 4s (WebP 1080p)
    var phase = 'intro';    // intro | loop | scrub | fallback
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var ctx = canvas.getContext('2d');
    if (ctx) { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; }
    var frames = [];
    var framesLoaded = 0;
    var raf = null, targetFrame = 0, currentFrame = -1;

    function show(el) { el.dataset.show = 'true'; }
    function hide(el) { el.dataset.show = 'false'; }

    // Revela overlay + conteúdo do hero quando o loop começa (fim da intro).
    // Idempotente: pode ser chamada mais de uma vez sem efeito colateral.
    var heroSection = document.querySelector('.hero');
    var heroScrollCue = heroSection && heroSection.querySelector('.hero__scroll');
    var heroTop = 0;
    var heroHeight = 1;
    function revealHero() {
      if (heroSection && heroSection.dataset.intro !== 'done') {
        heroSection.dataset.intro = 'done';
      }
    }
    var revealScheduled = false;
    function revealHeroAfterPaint() {
      if (revealScheduled || (heroSection && heroSection.dataset.intro === 'done')) return;
      revealScheduled = true;
      requestAnimationFrame(function () {
        setTimeout(revealHero, 40);
      });
    }

    // Um único caminho terminal cobre falha inicial, autoplay e erro pós-live.
    function activateStaticFallback() {
      phase = 'fallback';
      heroBg.dataset.videoBuffer = 'static';
      heroBg.dataset.scrubOrigin = 'fallback';
      delete heroBg.dataset.watermarkShade;
      delete heroBg.dataset.mediaLive;
      delete heroBg.dataset.handoff;
      diveDisplayArmed = false;
      loopDisplayArmed = false;
      dive.pause(); loop.pause();
      hide(dive); hide(loop); hide(canvas);
      revealHeroAfterPaint();
      syncPendingScrub();
    }

    var revealTracking = false;
    function updateIntroTimeline(mediaTime) {
      if (mediaTime >= SHADE_STRONG_AT && heroBg.dataset.watermarkShade !== 'strong') {
        heroBg.dataset.watermarkShade = 'strong';
      }
      if (mediaTime >= REVEAL_AT) {
        revealHero();
        return true;
      }
      return false;
    }
    function trackIntroTimeline() {
      if (revealTracking) return;
      revealTracking = true;
      if (typeof dive.requestVideoFrameCallback === 'function') {
        function onIntroFrame(now, metadata) {
          if (phase !== 'intro' || !diveDisplayArmed) return;
          if (updateIntroTimeline(metadata.mediaTime)) return;
          dive.requestVideoFrameCallback(onIntroFrame);
        }
        dive.requestVideoFrameCallback(onIntroFrame);
      } else {
        function checkIntroTime() {
          if (phase !== 'intro' || !diveDisplayArmed) return;
          if (updateIntroTimeline(dive.currentTime)) return;
          requestAnimationFrame(checkIntroTime);
        }
        requestAnimationFrame(checkIntroTime);
      }
    }

    // Mantém o buffer do canvas igual ao tamanho REAL exibido na tela
    // (com devicePixelRatio), para o "cover" acompanhar a tela como o
    // object-fit:cover dos vídeos — sem deformar em telas estreitas/mobile.
    var canvasResizeFrame = null;
    var pendingCanvasSize = { width: 1, height: 1 };
    function resizeCanvas(size) {
      if (size && size.width && size.height) pendingCanvasSize = size;
      if (canvasResizeFrame) return;
      canvasResizeFrame = requestAnimationFrame(function () {
        canvasResizeFrame = null;
        var nextSize = pendingCanvasSize;
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var w = nextSize.width || window.innerWidth;
        var h = nextSize.height || window.innerHeight;
        heroHeight = h;
        var bw = Math.max(1, Math.round(w * dpr));
        var bh = Math.max(1, Math.round(h * dpr));
        if (canvas.width !== bw || canvas.height !== bh) {
          canvas.width = bw;
          canvas.height = bh;
          // Alterar as dimensões do canvas reseta o contexto: reaplica o
          // smoothing de alta qualidade para o cover ficar nítido.
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          var prev = currentFrame;   // redesenha o frame atual no novo tamanho
          currentFrame = -1;
          if (prev >= 0) drawFrame(prev);
        }
      });
    }

    dive.addEventListener('loadedmetadata', function () { heroBg.dataset.videoReady = 'true'; });

    // Faz o download completo dos vídeos selecionados antes de iniciar a intro.
    // O vídeo passa a ler de um Blob local, sem disputar frames com a rede.
    var heroVideoObjectUrls = [];
    function selectedVideoSource(video) {
      var sources = Array.prototype.slice.call(video.querySelectorAll('source'));
      return sources.find(function (source) {
        var mediaMatches = !source.media || window.matchMedia(source.media).matches;
        var typeMatches = !source.type || video.canPlayType(source.type) !== '';
        return mediaMatches && typeMatches;
      });
    }
    function waitUntilPlayable(video) {
      return new Promise(function (resolve, reject) {
        function cleanup() {
          video.removeEventListener('canplaythrough', done);
          video.removeEventListener('error', failed);
        }
        function done() { cleanup(); resolve(); }
        function failed() { cleanup(); reject(new Error('video decode failed')); }
        if (video.readyState >= 4) { resolve(); return; }
        video.addEventListener('canplaythrough', done, { once: true });
        video.addEventListener('error', failed, { once: true });
      });
    }
    function fetchVideoBlob(url) {
      return fetch(url, { cache: 'force-cache' })
        .then(function (response) {
          if (!response.ok) throw new Error('video download failed: ' + response.status);
          return response.blob();
        });
    }
    function attachVideoBlob(video, blob, delivery) {
      var objectUrl = URL.createObjectURL(blob);
      heroVideoObjectUrls.push(objectUrl);
      video.src = objectUrl;
      video.preload = 'auto';
      video.dataset.delivery = delivery;
      video.load();
      return waitUntilPlayable(video);
    }
    function videoDeliveryLabel(url) {
      return /\.webm(?:[?#]|$)/i.test(url) ? 'local-webm' : 'local-mp4';
    }
    function attachNativeVideo(video, url) {
      video.src = url;
      video.preload = 'auto';
      video.dataset.delivery = videoDeliveryLabel(url);
      video.load();
      return waitUntilPlayable(video);
    }
    function preloadVideoAsset(video) {
      var source = selectedVideoSource(video);
      if (!source) return Promise.reject(new Error('no matching video source'));
      var primaryUrl = source.getAttribute('src');
      var fallbackUrl = source.getAttribute('data-fallback-src');
      // fetch(file://) é bloqueado por CORS. Em preview aberto diretamente do
      // disco, o próprio <video> carrega a source local selecionada.
      if (window.location.protocol === 'file:') {
        return attachNativeVideo(video, primaryUrl)
          .catch(function (primaryError) {
            if (!fallbackUrl || fallbackUrl === primaryUrl) throw primaryError;
            return attachNativeVideo(video, fallbackUrl);
          });
      }
      return fetchVideoBlob(primaryUrl)
        .then(function (blob) { return attachVideoBlob(video, blob, videoDeliveryLabel(primaryUrl)); })
        .catch(function (primaryError) {
          if (!fallbackUrl || fallbackUrl === primaryUrl) throw primaryError;
          return fetchVideoBlob(fallbackUrl)
            .then(function (blob) { return attachVideoBlob(video, blob, videoDeliveryLabel(fallbackUrl)); });
        });
    }
    function warmVideoDecoder(video) {
      return new Promise(function (resolve) {
        var finished = false;
        var fallbackTimer;
        function finish() {
          if (finished) return;
          finished = true;
          clearTimeout(fallbackTimer);
          video.pause();
          try { video.currentTime = 0; } catch (e) { }
          requestAnimationFrame(resolve);
        }
        var p = video.play();
        if (p && p.catch) p.catch(finish);
        if (typeof video.requestVideoFrameCallback === 'function') {
          var paintedFrames = 0;
          function onFrame() {
            paintedFrames++;
            if (paintedFrames >= 3) finish();
            else video.requestVideoFrameCallback(onFrame);
          }
          video.requestVideoFrameCallback(onFrame);
        } else {
          setTimeout(finish, 180);
        }
        fallbackTimer = setTimeout(finish, 600);
      });
    }
    window.addEventListener('pagehide', function () {
      heroVideoObjectUrls.forEach(function (url) { URL.revokeObjectURL(url); });
    }, { once: true });

    // Esconde o fallback só quando um vídeo realmente começa a exibir frames.
    var diveDisplayArmed = false;
    var loopDisplayArmed = false;
    var diveVisibleCommitted = false;
    function markMediaLive() { heroBg.dataset.mediaLive = 'true'; }
    dive.addEventListener('playing', function () {
      if (!diveDisplayArmed || diveVisibleCommitted) return;
      function commitDiveVisibility() {
        if (!diveDisplayArmed || diveVisibleCommitted) return;
        diveVisibleCommitted = true;
        show(dive);
        markMediaLive();
      }
      if (typeof dive.requestVideoFrameCallback === 'function') {
        dive.requestVideoFrameCallback(function () {
          dive.requestVideoFrameCallback(commitDiveVisibility);
        });
      } else {
        requestAnimationFrame(commitDiveVisibility);
      }
    });
    loop.addEventListener('playing', function () {
      if (loopDisplayArmed) markMediaLive();
    });

    // Os frames do canvas só são necessários depois que a pessoa começa a
    // rolar o hero. Não os baixa por timer: são 60 requests / ~3,7 MB fora do
    // caminho crítico.
    var framesStarted = false;
    var frameSyncRaf = null;
    function syncPendingScrub() {
      if (phase === 'scrub' || frameSyncRaf || window.scrollY <= 0) return;
      frameSyncRaf = requestAnimationFrame(function () {
        frameSyncRaf = null;
        onScroll();
      });
    }
    function loadFrames() {
      if (framesStarted) return;
      framesStarted = true;
      for (var i = 1; i <= FRAME_COUNT; i++) {
        var img = new Image();
        img.decoding = 'async';
        img.fetchPriority = 'low';
        img.onload = function () {
          framesLoaded++;
          syncPendingScrub();
        };
        img.src = 'assets/hero-frames/frame-' + String(i).padStart(3, '0') + '.webp';
        frames.push(img);
      }
    }
    // Desenha um frame no canvas com lógica "cover"
    function drawFrame(n) {
      n = Math.max(0, Math.min(FRAME_COUNT - 1, n));
      var img = frames[n];
      if (!img || !img.complete || !img.naturalWidth) return;
      if (n === currentFrame) return;
      currentFrame = n;
      var cw = canvas.width, ch = canvas.height;
      var ir = img.naturalWidth / img.naturalHeight, cr = cw / ch;
      var dw, dh, dx, dy;
      if (ir > cr) { dh = ch; dw = ch * ir; dx = (cw - dw) / 2; dy = 0; }
      else { dw = cw; dh = cw / ir; dx = 0; dy = (ch - dh) / 2; }
      ctx.drawImage(img, dx, dy, dw, dh);
    }

    // Handoff direto dive→loop: o decoder já foi aquecido antes da intro.
    // Quando a intro termina, inicia o loop no frame 0 e só corta após esse
    // primeiro frame ser composto sob a intro. O último frame segue visível.
    var loopStarted = false, switching = false;
    var loopFrameReady = false, loopSwapQueued = false;
    function finishLoopHandoff() {
      if (phase !== 'intro' || !switching || !loopSwapQueued) {
        delete heroBg.dataset.handoff;
        return;
      }
      phase = 'loop';
      hide(dive);
      revealHero();
      var resume = loop.play();
      if (resume && resume.catch) resume.catch(activateStaticFallback);
      requestAnimationFrame(function () {
        dive.pause();
        try { dive.currentTime = 0; } catch (e) { }
        requestAnimationFrame(function () { delete heroBg.dataset.handoff; });
      });
    }
    function primeLoopHandoff() {
      if (phase !== 'intro' || !switching || !loopFrameReady || loopSwapQueued) return;
      loopSwapQueued = true;
      heroBg.dataset.handoff = 'direct';
      show(loop); hide(canvas);
      // rVFC confirma decode, mas alguns compositores só apresentam a camada
      // no paint seguinte. Dois rAFs garantem um paint completo sob a intro.
      requestAnimationFrame(function () {
        requestAnimationFrame(finishLoopHandoff);
      });
    }
    function markLoopFrameReady() {
      loop.pause();
      loopFrameReady = true;
      primeLoopHandoff();
    }
    function watchLoopFirstFrame() {
      if (loopFrameReady) return;
      if (typeof loop.requestVideoFrameCallback === 'function') {
        loop.requestVideoFrameCallback(markLoopFrameReady);
      } else {
        requestAnimationFrame(function () { requestAnimationFrame(markLoopFrameReady); });
      }
    }
    function startLoopAtHandoff() {
      if (loopStarted) return;
      loopStarted = true;
      try { loop.currentTime = 0; } catch (e) { }
      loopDisplayArmed = true;
      var p = loop.play();
      if (p && p.then) p.then(watchLoopFirstFrame).catch(activateStaticFallback);
      else loop.addEventListener('playing', watchLoopFirstFrame, { once: true });
    }
    function switchToLoop() {
      if (switching || phase !== 'intro') return;
      switching = true;
      startLoopAtHandoff();
      primeLoopHandoff();
    }

    // A entrada do conteúdo segue a timeline; o handoff aguarda o fim real.
    dive.addEventListener('timeupdate', function () {
      if (phase !== 'intro') return;
      updateIntroTimeline(dive.currentTime);
    });
    // Corte seco: ended → loop@0, sem fade e sem relógio fixo.
    dive.addEventListener('ended', switchToLoop);

    // Inicia a fase 1 somente depois que intro + loop estiverem integralmente
    // disponíveis como Blob local. Assim a experiência nunca começa para
    // depois parar esperando rede.
    (function startIntro() {
      hide(dive); hide(loop); hide(canvas);

      var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      var shouldStayStatic = reduceMotion.matches || (connection && connection.saveData);
      if (shouldStayStatic || !selectedVideoSource(dive) || !selectedVideoSource(loop)) {
        activateStaticFallback();
        return;
      }

      heroBg.dataset.videoBuffer = 'loading';
      Promise.all([preloadVideoAsset(dive), preloadVideoAsset(loop)])
        .then(function () {
          function playIntro() {
            heroBg.dataset.videoBuffer = 'warming';
            warmVideoDecoder(dive)
              .then(function () { return warmVideoDecoder(loop); })
              .then(function () {
                if (phase !== 'intro') return;
                heroBg.dataset.videoBuffer = 'ready';
                diveDisplayArmed = true;
                delete heroBg.dataset.watermarkShade;
                try { dive.currentTime = 0; } catch (e) { }
                trackIntroTimeline();
                var p = dive.play();
                if (p && p.catch) p.catch(activateStaticFallback);
              });
          }
          if (document.hidden) {
            document.addEventListener('visibilitychange', function onVisible() {
              if (document.hidden) return;
              document.removeEventListener('visibilitychange', onVisible);
              playIntro();
            });
          } else {
            playIntro();
          }
        })
        .catch(activateStaticFallback);
    })();

    // Falha depois de frames visíveis também restaura o fallback estático.
    dive.addEventListener('error', activateStaticFallback);
    loop.addEventListener('error', activateStaticFallback);

    // FASE 3: scrubbing por frames sincronizado ao scroll
    var scrubReturnPhase = 'loop';
    function tick() {
      if (currentFrame !== targetFrame) {
        // aproxima suavemente o frame exibido do frame alvo (easing)
        var diff = targetFrame - currentFrame;
        var stepv = Math.abs(diff) <= 1 ? diff : diff * 0.35;
        drawFrame(Math.round(currentFrame + stepv));
        raf = requestAnimationFrame(tick);
      } else { raf = null; }
    }
    var heroScrollFrame = null;
    function syncHeroScroll() {
      heroScrollFrame = null;
      var scrolled = Math.min(Math.max((window.scrollY - heroTop) / heroHeight, 0), 1);
      if (heroScrollCue) {
        var cueProgress = Math.min(scrolled / 0.16, 1);
        heroScrollCue.style.setProperty('--hero-scroll-progress', cueProgress.toFixed(3));
      }
      if (reduceMotion.matches) return;
      loadFrames();
      if (scrolled <= 0.02) {
        if (phase === 'scrub') {
          phase = scrubReturnPhase;
          hide(canvas); hide(dive);
          if (phase === 'fallback') {
            hide(loop);
          } else {
            delete heroBg.dataset.scrubOrigin;
            show(loop);
            var lp = loop.play(); if (lp && lp.catch) lp.catch(activateStaticFallback);
          }
        }
        return;
      }
      targetFrame = Math.round(scrolled * (FRAME_COUNT - 1));
      var nextFrame = frames[targetFrame];
      // Mantém a mídia atual até haver um frame válido para desenhar. Isso
      // evita trocar para um canvas transparente no primeiro gesto de scroll.
      if (!nextFrame || !nextFrame.complete || !nextFrame.naturalWidth) return;
      if (phase !== 'scrub') {
        // Scroll antes dos 3s interrompe a timeline; revela o conteúdo para
        // não deixá-lo oculto caso a pessoa retorne ao topo.
        revealHero();
        scrubReturnPhase = phase === 'fallback' || heroBg.dataset.mediaLive !== 'true' ? 'fallback' : 'loop';
        if (scrubReturnPhase === 'fallback') {
          heroBg.dataset.videoBuffer = 'static';
          heroBg.dataset.scrubOrigin = 'fallback';
          delete heroBg.dataset.mediaLive;
        }
        phase = 'scrub';
        loop.pause(); dive.pause();
        if (currentFrame < 0) drawFrame(targetFrame);
        if (currentFrame < 0) return;
        show(canvas); hide(loop); hide(dive);
      }
      if (!raf) raf = requestAnimationFrame(tick);
    }
    function onScroll() {
      if (!heroScrollFrame) heroScrollFrame = requestAnimationFrame(syncHeroScroll);
    }
    window.addEventListener('scroll', onScroll, { passive: true });

    // Ajusta o buffer ao tamanho real e re-crop ao mudar a viewport
    function resizeCanvasFromViewport() {
      resizeCanvas({ width: window.innerWidth, height: window.innerHeight });
    }
    if ('ResizeObserver' in window) {
      new ResizeObserver(function (entries) {
        var size = entries[0] && entries[0].contentRect;
        if (size) resizeCanvas({ width: size.width, height: size.height });
      }).observe(heroBg);
    } else {
      resizeCanvasFromViewport();
      window.addEventListener('resize', resizeCanvasFromViewport, { passive: true });
    }
    window.addEventListener('orientationchange', resizeCanvasFromViewport);
  }

  // Fallback global: se o bloco de vídeo acima não rodar (elemento ausente),
  // garante que o hero apareça mesmo assim.
  (function heroSafety() {
    var h = document.querySelector('.hero');
    var bg = document.getElementById('heroBg');
    if (h) setTimeout(function () {
      if (h.dataset.intro !== 'done' && (!bg || bg.dataset.videoBuffer === 'static')) h.dataset.intro = 'done';
    }, 7000);
  })();

  // O tour fica várias dobras abaixo do hero. `autoplay` no HTML fazia o
  // navegador transferir ~8 MB imediatamente mesmo com preload="none".
  // Hidrata poster + sources apenas quando a seção se aproxima da viewport.
  (function lazyShipBackgroundVideo() {
    var video = document.querySelector('.ship-video__media');
    if (!video) return;
    var sources = Array.prototype.slice.call(video.querySelectorAll('source[data-src]'));
    var hydrated = false;
    var inView = false;

    function hydrate() {
      if (hydrated) return;
      hydrated = true;
      if (video.dataset.poster) video.poster = video.dataset.poster;
      sources.forEach(function (source) {
        if (source.dataset.src) source.src = source.dataset.src;
      });
      video.load();
    }

    function play() {
      hydrate();
      if (document.querySelector('dialog[open]')) {
        video.pause();
        return;
      }
      var promise = video.play();
      if (promise && promise.catch) promise.catch(function () { });
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          inView = entry.isIntersecting;
          if (inView) play();
          else if (hydrated) video.pause();
        });
      }, { rootMargin: '320px 0px', threshold: 0.01 }).observe(video);
    } else {
      inView = true;
      play();
    }

    document.addEventListener('visibilitychange', function () {
      if (!hydrated) return;
      if (document.hidden || !inView) video.pause();
      else play();
    });
  })();

  // ---------- Abas de valores (cabines | bebidas) ----------
  (function valueTabs() {
    var tablist = document.querySelector('.value-tabs');
    if (!tablist) return;
    var tabs = Array.prototype.slice.call(tablist.querySelectorAll('[role="tab"]'));
    function select(tab) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
        if (on) trackValueList(t.getAttribute('aria-controls'));
      });
    }
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(tab); });
      tab.addEventListener('keydown', function (e) {
        var next = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = tabs[(i + 1) % tabs.length];
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (e.key === 'Home') next = tabs[0];
        else if (e.key === 'End') next = tabs[tabs.length - 1];
        if (next) { e.preventDefault(); select(next); next.focus(); }
      });
    });
  })();

  function bindSwipeHint(scroller, hint) {
    if (!scroller || !hint) return;
    scroller.addEventListener('scroll', function () {
      if (scroller.scrollLeft > 8) hint.classList.add('is-used');
    }, { passive: true });
  }

  // ---------- #evento: timeline horizontal só no celular ----------
  (function eventTimelineAdapt() {
    var track = document.querySelector('#evento .event-track');
    if (!track) return;
    var hint = document.querySelector('[data-event-track-hint]');
    var mobile = window.matchMedia('(max-width: 680px)');
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function syncMode() {
      if (mobile.matches) {
        track.tabIndex = 0;
        track.setAttribute('role', 'list');
        track.setAttribute('aria-roledescription', 'linha do tempo horizontal');
        track.setAttribute('aria-label', 'História do Kriativos On Board. Deslize ou use as setas para navegar pelos anos.');
      } else {
        track.removeAttribute('tabindex');
        track.removeAttribute('role');
        track.removeAttribute('aria-roledescription');
        track.setAttribute('aria-label', 'Linha do tempo do Kriativos On Board');
        track.scrollLeft = 0;
      }
    }

    function move(direction) {
      track.scrollBy({ left: direction * track.clientWidth * 0.84, behavior: reduceMotion ? 'auto' : 'smooth' });
    }

    track.addEventListener('keydown', function (event) {
      if (event.target !== track || !mobile.matches) return;
      if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
      else if (event.key === 'Home') { event.preventDefault(); track.scrollTo({ left: 0, behavior: reduceMotion ? 'auto' : 'smooth' }); }
      else if (event.key === 'End') { event.preventDefault(); track.scrollTo({ left: track.scrollWidth, behavior: reduceMotion ? 'auto' : 'smooth' }); }
    });
    bindSwipeHint(track, hint);
    if (typeof mobile.addEventListener === 'function') mobile.addEventListener('change', syncMode);
    else mobile.addListener(syncMode);
    syncMode();
  })();

  bindSwipeHint(document.querySelector('#embarque .deck__fan'), document.querySelector('[data-deck-swipe-hint]'));

  // ---------- Sliders responsivos dos valores (tablet e celular) ----------
  (function priceSliders() {
    var tracks = Array.prototype.slice.call(document.querySelectorAll('#valores .value-panel .price-grid'));
    if (!tracks.length) return;
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var sliderQuery = window.matchMedia('(max-width: 1024px)');

    tracks.forEach(function (track, trackIndex) {
      var cards = Array.prototype.slice.call(track.querySelectorAll('.price-card'));
      if (cards.length < 2) return;
      var panel = track.closest('.value-panel');
      var isCabins = panel && panel.id === 'panel-cabines';
      var label = isCabins ? 'Valores das cabines' : 'Valores dos pacotes de bebidas';
      var frame = null;

      track.id = track.id || 'priceTrack' + (trackIndex + 1);

      function syncMode() {
        if (sliderQuery.matches) {
          track.tabIndex = 0;
          track.setAttribute('role', 'region');
          track.setAttribute('aria-roledescription', 'carrossel');
          track.setAttribute('aria-label', label);
        } else {
          track.removeAttribute('tabindex');
          track.removeAttribute('role');
          track.removeAttribute('aria-roledescription');
          track.removeAttribute('aria-label');
          track.scrollLeft = 0;
        }
        requestAnimationFrame(update);
      }

      var controls = document.createElement('div');
      controls.className = 'price-slider__controls';
      controls.setAttribute('role', 'group');
      controls.setAttribute('aria-label', 'Navegação de ' + label.toLowerCase());
      var status = document.createElement('span');
      status.className = 'sr-only';
      status.setAttribute('aria-live', 'polite');
      var dots = cards.map(function (_card, index) {
        var dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'price-slider__dot';
        dot.setAttribute('aria-label', 'Ir para o card ' + (index + 1) + ' de ' + cards.length);
        dot.setAttribute('aria-controls', track.id);
        dot.addEventListener('click', function () { goTo(index); });
        controls.appendChild(dot);
        return dot;
      });
      controls.appendChild(status);
      track.insertAdjacentElement('afterend', controls);

      function update() {
        if (panel && panel.hidden) return;
        var max = Math.max(0, track.scrollWidth - track.clientWidth);
        var active = 0;
        if (track.scrollLeft >= max - 2 && max > 2) active = cards.length - 1;
        else if (track.scrollLeft > 2) {
          var bounds = track.getBoundingClientRect();
          active = cards.reduce(function (best, card, index) {
            var distance = Math.abs(card.getBoundingClientRect().left - bounds.left);
            return distance < best.distance ? { index: index, distance: distance } : best;
          }, { index: 0, distance: Infinity }).index;
        }
        dots.forEach(function (dot, index) {
          if (index === active) dot.setAttribute('aria-current', 'true');
          else dot.removeAttribute('aria-current');
        });
        status.textContent = 'Card ' + (active + 1) + ' de ' + cards.length;
      }

      function goTo(index) {
        var card = cards[Math.max(0, Math.min(index, cards.length - 1))];
        var bounds = track.getBoundingClientRect();
        var left = track.scrollLeft + card.getBoundingClientRect().left - bounds.left;
        track.scrollTo({ left: left, behavior: reduceMotion ? 'auto' : 'smooth' });
      }

      track.addEventListener('scroll', function () {
        if (frame) cancelAnimationFrame(frame);
        frame = requestAnimationFrame(update);
      }, { passive: true });
      track.addEventListener('keydown', function (event) {
        if (event.target !== track) return;
        var active = dots.findIndex(function (dot) { return dot.getAttribute('aria-current') === 'true'; });
        if (event.key === 'ArrowLeft') { event.preventDefault(); goTo(active - 1); }
        else if (event.key === 'ArrowRight') { event.preventDefault(); goTo(active + 1); }
        else if (event.key === 'Home') { event.preventDefault(); goTo(0); }
        else if (event.key === 'End') { event.preventDefault(); goTo(cards.length - 1); }
      });
      window.addEventListener('resize', update);
      if (panel) new MutationObserver(function () { requestAnimationFrame(update); }).observe(panel, { attributes: true, attributeFilter: ['hidden'] });
      if (typeof sliderQuery.addEventListener === 'function') sliderQuery.addEventListener('change', syncMode);
      else sliderQuery.addListener(syncMode);
      syncMode();
    });
  })();

  // ---------- Modal da cobertura do seguro viagem ----------
  (function insuranceCoverage() {
    var modal = document.getElementById('insuranceModal');
    var openBtn = document.getElementById('insuranceCoverageOpen');
    var closeBtn = document.getElementById('insuranceModalClose');
    if (!modal || !openBtn || !closeBtn || typeof modal.showModal !== 'function') return;

    openBtn.addEventListener('click', function () {
      modal.showModal();
      modal.scrollTop = 0;
      var inner = modal.querySelector('.cabin-modal__inner');
      if (inner) inner.scrollTop = 0;
    });
    closeBtn.addEventListener('click', function () { modal.close(); });
    modal.addEventListener('click', function (e) {
      if (e.target === modal) modal.close();
    });
    modal.addEventListener('close', function () { openBtn.focus(); });
  })();

  // ---------- Modal "Ver detalhes" das cabines ----------
  (function cabinDetails() {
    var modal = document.getElementById('cabinModal');
    if (!modal || typeof modal.showModal !== 'function') return;
    var elCabin = document.getElementById('cabinModalCabin');
    var elTitle = document.getElementById('cabinModalTitle');
    var elLead = document.getElementById('cabinModalLead');
    var elImg = document.getElementById('cabinModalImg');
    var elBody = document.getElementById('cabinModalBody');
    var elNote = document.getElementById('cabinModalNote');
    var elCta = document.getElementById('cabinModalCta');
    var elTour = document.getElementById('cabinModalTour');
    var closeBtn = document.getElementById('cabinModalClose');
    var lastFocus = null;
    var currentKey = null;

    var WA = 'https://api.whatsapp.com/send?phone=5513981580498&text=';
    var DATA = {
      interna: {
        cabin: 'Cabine interna',
        img: 'assets/images/cabins/cabine-interna.avif',
        alt: 'Cabine interna do MSC Música com duas camas de solteiro, penteadeira e iluminação aconchegante',
        tour: 'https://virtual-tours.msccruises.com/MSC-Musica/en-gl/index.html?sc=scene_inside',
        title: 'O conforto e a elegância de que você precisa',
        lead: 'A opção mais econômica para desfrutar do seu cruzeiro, com todo o conforto a bordo.',
        groups: [{
          items: [
            'Cabines (aprox. 14 m²), 5º-15º andares',
            'Poltrona relaxante',
            'Banheiro com chuveiro, penteadeira e secador de cabelo',
            'Duas camas de solteiro confortáveis que podem ser convertidas em cama de casal (mediante solicitação)*',
            'TV interativa, telefone, conexão Wi-Fi disponível (mediante taxa), cofre e minibar'
          ]
        }],
        note: '* Cabines para hóspedes com necessidades especiais ou mobilidade reduzida possuem apenas camas de solteiro. A imagem é apenas ilustrativa; o tamanho, layout e mobília podem variar (dentro da mesma categoria de cabine).',
        wa: WA + encodeURIComponent('Olá, Royal Trip! Vi a Cabine Interna na seção de valores do Kriativos On Board 2026 e quero reservar essa opção no 2º lote.')
      },
      janela: {
        cabin: 'Cabine janela',
        img: 'assets/images/cabins/cabine-janela.avif',
        alt: 'Cabine janela do MSC Música com vista para o mar e luz natural entrando pela janela',
        tour: 'https://virtual-tours.msccruises.com/MSC-Musica/en-gl/index.html?sc=scene_ocean_view',
        title: 'Aprecie a vista do oceano de sua cabine',
        lead: 'Confortável e elegante, com janela para o mar.',
        groups: [{
          items: [
            'Cabines (aprox. 16-17 m²)',
            'Janela com vista para o mar',
            'Poltrona relaxante',
            'Banheiro com chuveiro, penteadeira com secador de cabelo',
            'Duas camas de solteiro confortáveis que podem ser convertidas em cama de casal (mediante solicitação)*',
            'TV interativa, telefone, conexão Wi-Fi disponível (mediante taxa), cofre e minibar'
          ]
        }],
        note: '* Cabines para hóspedes com necessidades especiais ou mobilidade reduzida possuem apenas camas de solteiro. A imagem é apenas ilustrativa; o tamanho, layout e mobília podem variar (dentro da mesma categoria de cabine).',
        wa: WA + encodeURIComponent('Olá, Royal Trip! Vi a Cabine Janela na seção de valores do Kriativos On Board 2026 e quero reservar essa opção no 2º lote.')
      },
      varanda: {
        cabin: 'Cabine varanda',
        img: 'assets/images/cabins/cabine-varanda.avif',
        alt: 'Cabine varanda do MSC Música com sacada privativa de frente para o mar',
        tour: 'https://virtual-tours.msccruises.com/MSC-Musica/en-gl/index.html?sc=scene_balcony',
        title: 'Relaxe com o sol e a brisa do mar',
        lead: 'Aproveite o conforto da sua varanda privativa.',
        groups: [{
          items: [
            'Cabines (aprox. 15-18 m²) com varanda (aprox. 4-5 m²)',
            'Área de estar com sofá',
            'Banheiro com chuveiro, penteadeira com secador de cabelo',
            'Duas camas de solteiro confortáveis que podem ser convertidas em cama de casal (mediante solicitação)*',
            'TV interativa, telefone, conexão Wi-Fi disponível (mediante taxa), cofre e minibar'
          ]
        }],
        note: '* As cabines para hóspedes com necessidades especiais ou mobilidade reduzida possuem apenas cama de solteiro (exceto cabines 15025). A imagem é apenas ilustrativa; o tamanho, layout e mobília podem variar (dentro da mesma categoria de cabine).',
        wa: WA + encodeURIComponent('Olá, Royal Trip! Vi a Cabine Varanda na seção de valores do Kriativos On Board 2026 e quero reservar essa opção no 2º lote.')
      },
      easy: {
        cabin: 'Pacote Easy · 12x R$ 64,00 por pessoa',
        img: 'assets/images/drinks/pacote-easy.webp',
        alt: 'Seleção de bebidas do Pacote Easy servidas a bordo do MSC Música',
        title: 'Um cruzeiro tranquilo, com bebida o dia inteiro',
        lead: 'Desfrute de uma ampla seleção de bebidas ao longo do dia. Disponível em bares, buffets e restaurantes principais selecionados.',
        groups: [{
          items: [
            'Café, chá e bebidas quentes',
            'Refrigerantes e sucos',
            'Água com e sem gás — AQUA by MSC*',
            'Cerveja em garrafa e chope — marcas selecionadas',
            'Vinho da casa e espumante em taça',
            'Coquetéis clássicos e drinks com destilados da casa',
            'Opções sem álcool, como mocktails, vinhos e cervejas'
          ]
        }],
        note: '* AQUA by MSC: água enriquecida com minerais servida em copos nos bares e buffets, em garrafas de vidro reutilizáveis de 1L nos principais restaurantes e em estações de recarga, mediante solicitação. Taxas de serviço incluídas. Valores e itens do cardápio podem sofrer alterações; imagens e descrições são ilustrativas.',
        wa: WA + encodeURIComponent('Olá, Royal Trip! Vi o Pacote de Bebidas Easy na seção de bebidas do Kriativos On Board 2026 e quero contratar essa opção.')
      },
      premium: {
        cabin: 'Pacote Premium · 12x R$ 112,00 por pessoa',
        img: 'assets/images/drinks/pacote-premium.webp',
        alt: 'Bebidas premium do Pacote Premium servidas a bordo do MSC Música',
        title: 'Bebidas de primeira qualidade em todo o navio',
        lead: 'Torne cada momento especial. Disponível em bares, bufês, restaurantes principais, restaurantes de especialidades selecionados e em ilhas privativas.',
        groups: [{
          items: [
            'Cafés especiais, chás e bebidas quentes variadas',
            'Refrigerantes e energéticos',
            'Sucos, coquetéis de frutas frescas, smoothies e shakes de proteína',
            'Água com e sem gás — AQUA by MSC*',
            'Cervejas, vinhos e coquetéis sem álcool',
            'Ampla seleção de chope e cervejas em garrafa',
            'Vinhos e espumantes premium em taça',
            'Destilados e licores premium',
            'Coquetéis e drinks elaborados com marcas premium'
          ]
        }],
        note: '* AQUA by MSC: água enriquecida com minerais servida em copos, em garrafas de vidro reutilizáveis de 1L e em estações de recarga, mediante solicitação. Taxas de serviço incluídas. Valores e itens do cardápio podem sofrer alterações; imagens e descrições são ilustrativas.',
        wa: WA + encodeURIComponent('Olá, Royal Trip! Vi o Pacote de Bebidas Premium na seção de bebidas do Kriativos On Board 2026 e quero contratar essa opção.')
      },
      naoalcoolico: {
        cabin: 'Não alcoólico · 12x R$ 51,25 por pessoa',
        img: 'assets/images/drinks/pacote-nao-alcoolico.webp',
        alt: 'Bebidas sem álcool do Pacote Não Alcoólico servidas a bordo do MSC Música',
        title: 'Revigorante, sem álcool, para adultos',
        lead: 'Perfeito para quem prefere opções sem álcool. Disponível em bares, buffets e restaurantes principais selecionados.',
        groups: [{
          items: [
            'Cafés especiais, chás e bebidas quentes variadas',
            'Refrigerantes e energéticos',
            'Sucos, coquetéis de frutas frescas, smoothies e shakes de proteína',
            'Água com e sem gás — AQUA by MSC*',
            'Cervejas, vinhos e coquetéis sem álcool'
          ]
        }],
        note: '* AQUA by MSC: água enriquecida com minerais servida em copos, em garrafas de vidro reutilizáveis de 1L e em estações de recarga, mediante solicitação. Taxas de serviço incluídas. O pacote não é aceito em restaurantes de especialidades e ilhas particulares. Valores e itens do cardápio podem sofrer alterações; imagens e descrições são ilustrativas.',
        wa: WA + encodeURIComponent('Olá, Royal Trip! Vi o Pacote de Bebidas Não Alcoólico na seção de bebidas do Kriativos On Board 2026 e quero contratar essa opção.')
      }
    };

    function buildBody(groups) {
      elBody.textContent = '';
      groups.forEach(function (g) {
        if (g.heading) {
          var h = document.createElement('h4');
          h.textContent = g.heading;
          elBody.appendChild(h);
        }
        var ul = document.createElement('ul');
        g.items.forEach(function (txt) {
          var li = document.createElement('li');
          li.textContent = txt;
          ul.appendChild(li);
        });
        elBody.appendChild(ul);
      });
    }

    var DRINK_KEYS = { easy: 1, premium: 1, naoalcoolico: 1 };
    function open(key) {
      var d = DATA[key];
      if (!d) return;
      var analyticsSelection = findAnalyticsItem(key);
      currentKey = key;
      modal.dataset.kind = DRINK_KEYS[key] ? 'bebida' : 'cabine';
      lastFocus = document.activeElement;
      elCabin.textContent = d.cabin;
      if (elImg) {
        elImg.src = d.img || '';
        elImg.alt = d.alt || d.cabin || '';
      }
      if (elTour) elTour.hidden = !d.tour;
      elTitle.textContent = d.title;
      elLead.textContent = d.lead;
      buildBody(d.groups);
      elNote.textContent = d.note;
      if (elCta) {
        var isDrink = !!DRINK_KEYS[key];
        elCta.hidden = isDrink;
        if (isDrink) {
          whatsappDestinations.delete(elCta);
          delete elCta.dataset.kobWhatsappBound;
        } else {
          whatsappDestinations.set(elCta, d.wa);
          elCta.dataset.kobWhatsappBound = 'main';
        }
        if (isDrink || !analyticsSelection) {
          delete elCta.dataset.analyticsItemId;
          delete elCta.dataset.analyticsItemCategory;
        } else {
          elCta.dataset.analyticsChannel = 'whatsapp';
          elCta.dataset.analyticsCtaId = 'cabin_modal_reserve';
          elCta.dataset.analyticsPlacement = 'cabin_modal';
          elCta.dataset.analyticsIntent = 'reservation';
          elCta.dataset.analyticsItemId = analyticsSelection.item.item_id;
          elCta.dataset.analyticsItemCategory = analyticsSelection.item.item_category;
        }
        elCta.href = isDrink ? '#' : whatsappSafeHref(elCta);
      }
      modal.showModal();
      if (analyticsSelection) {
        trackAnalytics('view_item', { items: [analyticsItem(analyticsSelection.item)] });
      }
      modal.scrollTop = 0;
      var inner = modal.querySelector('.cabin-modal__inner');
      if (inner) inner.scrollTop = 0;
    }

    function close() {
      modal.close();
    }

    document.querySelectorAll('.price-card__details').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var selection = findAnalyticsItem(btn.dataset.cabin);
        if (selection) {
          trackAnalytics('select_item', {
            item_list_id: selection.list.item_list_id,
            item_list_name: selection.list.item_list_name,
            items: [analyticsItem(selection.item)]
          });
        }
        open(btn.dataset.cabin);
      });
    });
    closeBtn.addEventListener('click', close);
    // Clique no backdrop (fora do conteúdo) fecha
    modal.addEventListener('click', function (e) {
      if (e.target === modal) close();
    });
    // Restaura o foco ao fechar
    modal.addEventListener('close', function () {
      if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    });

    // ---------- Tour virtual 360° (iframe dentro do site) ----------
    (function cabinTour() {
      var tour = document.getElementById('tour360');
      if (!tour || !elTour || typeof tour.showModal !== 'function') {
        if (elTour) elTour.hidden = true;
        return;
      }
      var frame = document.getElementById('tour360Frame');
      var stage = tour.querySelector('.tour360__stage');
      var label = document.getElementById('tour360Label');
      var tourClose = document.getElementById('tour360Close');
      var tourMax = document.getElementById('tour360Maximize');
      var tourFocus = null;
      // Cabine (chave do DATA) -> item_id estável do catálogo de analytics.
      var CABIN_TOUR_IDS = { interna: 'cabin_internal', janela: 'cabin_ocean_view', varanda: 'cabin_balcony' };

      function showSpinner() {
        if (stage) stage.classList.add('is-loading');
      }
      frame.addEventListener('load', function () {
        if (frame.src && frame.src !== 'about:blank' && stage) stage.classList.remove('is-loading');
      });

      // Alterna entre o tamanho padrão e a tela cheia do overlay.
      function setMaximized(on) {
        tour.classList.toggle('is-maximized', on);
        if (tourMax) {
          tourMax.setAttribute('aria-pressed', on ? 'true' : 'false');
          tourMax.setAttribute('aria-label', on ? 'Restaurar tamanho do tour virtual' : 'Maximizar tour virtual');
        }
      }
      if (tourMax) {
        tourMax.addEventListener('click', function () {
          setMaximized(!tour.classList.contains('is-maximized'));
        });
      }

      function openTour() {
        var d = DATA[currentKey];
        if (!d || !d.tour) return;
        tourFocus = document.activeElement;
        setMaximized(false);
        if (label) label.textContent = 'Tour virtual 360° · ' + d.cabin;
        showSpinner();
        frame.src = d.tour;
        tour.showModal();
        trackAnalytics('kob_virtual_tour_open', { tour_type: 'cabin', tour_id: CABIN_TOUR_IDS[currentKey] });
      }

      function closeTour() {
        tour.close();
      }

      elTour.addEventListener('click', openTour);
      tourClose.addEventListener('click', closeTour);
      tour.addEventListener('click', function (e) {
        if (e.target === tour) closeTour();
      });
      // Ao fechar: descarrega o iframe (para o áudio/render), restaura o tamanho padrão e devolve o foco ao modal
      tour.addEventListener('close', function () {
        frame.src = 'about:blank';
        if (stage) stage.classList.remove('is-loading');
        setMaximized(false);
        if (tourFocus && typeof tourFocus.focus === 'function') tourFocus.focus();
      });
    })();
  })();

  /* ---------- Tour completo do navio (sidebar de ambientes + iframe) ---------- */
  (function shipTour() {
    var dialog = document.getElementById('shipTour');
    var openBtn = document.getElementById('shipTourOpen');
    if (!dialog || !openBtn || typeof dialog.showModal !== 'function') {
      if (openBtn) openBtn.hidden = true;
      return;
    }

    var TOUR = 'https://virtual-tours.msccruises.com/MSC-Musica/en-gl/index.html?sc=';
    var THUMBS = 'assets/images/tour-thumbs/';
    // grupo -> [ [scene, nome] ]. A miniatura vem de THUMBS + scene + '.jpg'.
    var GROUPS = [
      ['Áreas comuns', [
        ['scene_reception_la_cascata', 'Recepção La Cascata'],
        ['scene_crystal_lounge', 'Crystal Lounge'],
        ['scene_teatro_la_scala', 'Teatro La Scala'],
        ['scene_sanremo_casino', 'Cassino Sanremo'],
        ['scene_copacabana', 'Piscina Copacabana'],
        ['scene_l_oleandro', 'Restaurante L\u2019Oleandro'],
        ['scene_restaurant', 'Restaurante Il Giardino'],
        ['scene_kaito_sushi_bar', 'Kaito Sushi Bar'],
        ['scene_blue_velvet_bar', 'Blue Velvet Bar'],
        ['scene_havana_club', 'Havana Club'],
        ['scene_il_tucano_lounge', 'Il Tucano Lounge'],
        ['scene_gli_archi_cafeteria', 'Gli Archi Cafeteria'],
        ['scene_q32_disco', 'Discoteca Q32'],
        ['scene_top_16', 'Top 16'],
        ['scene_space_trip', 'Space Trip'],
        ['scene_card_room', 'Sala de jogos'],
        ['scene_library', 'Biblioteca'],
        ['scene_the_mini_mall', 'Mini Mall'],
        ['scene_l_angolo_dell_oggetto', 'L\u2019Angolo dell\u2019Oggetto'],
        ['scene_gym', 'Academia']
      ]],
      ['Cabines', [
        ['scene_inside', 'Cabine interna'],
        ['scene_ocean_view', 'Cabine janela'],
        ['scene_balcony', 'Cabine varanda']
      ]],
      ['SPA & Bem-estar', [
        ['scene_spa_reception', 'Recepção do SPA'],
        ['scene_beauty_parlour', 'Salão de beleza'],
        ['scene_spa_massage_room', 'Sala de massagem'],
        ['scene_steam_bath', 'Banho a vapor'],
        ['scene_yoga_room', 'Sala de yoga']
      ]]
    ];

    var nav = document.getElementById('shipTourNav');
    var stage = dialog.querySelector('.shiptour__stage');
    var frame = document.getElementById('shipTourFrame');
    var label = document.getElementById('shipTourLabel');
    var closeBtn = document.getElementById('shipTourClose');
    var maxBtn = document.getElementById('shipTourMaximize');
    var navToggle = document.getElementById('shipTourNavToggle');
    var bgVideo = document.querySelector('.ship-video__media');
    var lastFocus = null;
    var items = [];
    var groupEls = [];
    var current = null;

    var navBuilt = false;
    function buildNav() {
      if (navBuilt) return;
      navBuilt = true;
      // O HTML mantém apenas um template inerte. A sidebar e as miniaturas
      // entram no DOM somente quando a pessoa solicita o tour.
      nav.textContent = '';

      // Monta a sidebar como accordion (um grupo aberto por vez).
      GROUPS.forEach(function (group, gi) {
      var section = document.createElement('div');
      section.className = 'shiptour__group';

      var head = document.createElement('button');
      head.type = 'button';
      head.className = 'shiptour__group-head';
      head.setAttribute('aria-expanded', 'false');
      var headLabel = document.createElement('span');
      headLabel.textContent = group[0];
      var chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      chevron.setAttribute('class', 'shiptour__chevron');
      chevron.setAttribute('viewBox', '0 0 24 24');
      chevron.setAttribute('aria-hidden', 'true');
      chevron.innerHTML = '<path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>';
      head.appendChild(headLabel);
      head.appendChild(chevron);
      head.addEventListener('click', function () {
        openGroup(gi, !section.classList.contains('is-open'));
      });

      var panel = document.createElement('div');
      panel.className = 'shiptour__group-panel';
      var panelInner = document.createElement('div');
      panelInner.className = 'shiptour__group-list';
      panel.appendChild(panelInner);

      group[1].forEach(function (entry) {
        var scene = entry[0], name = entry[1];
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'shiptour__item';
        btn.setAttribute('aria-current', 'false');
        var img = document.createElement('img');
        img.dataset.src = THUMBS + scene + '.jpg';
        img.alt = '';
        img.loading = 'lazy';
        img.width = 72;
        img.height = 44;
        var span = document.createElement('span');
        span.textContent = name;
        btn.appendChild(img);
        btn.appendChild(span);
        btn.addEventListener('click', function () { select(scene, name); });
        panelInner.appendChild(btn);
        items.push({ scene: scene, name: name, btn: btn, group: gi });
      });

      section.appendChild(head);
      section.appendChild(panel);
      nav.appendChild(section);
        groupEls.push({ section: section, head: head, panel: panelInner });
      });
    }

    // Abre um grupo (fecha os demais). Passar open=false recolhe todos.
    function openGroup(index, open) {
      groupEls.forEach(function (g, i) {
        var on = open !== false && i === index;
        g.section.classList.toggle('is-open', on);
        g.head.setAttribute('aria-expanded', on ? 'true' : 'false');
        if (on) {
          g.panel.querySelectorAll('img[data-src]').forEach(function (image) {
            image.src = image.dataset.src;
            image.removeAttribute('data-src');
          });
        }
      });
    }

    // Overlay de carregamento: some quando o iframe termina de carregar.
    function showSpinner() {
      if (stage) stage.classList.add('is-loading');
    }
    frame.addEventListener('load', function () {
      if (frame.src && frame.src !== 'about:blank' && stage) stage.classList.remove('is-loading');
    });

    function select(scene, name) {
      var target = null;
      items.forEach(function (it) {
        var on = it.scene === scene;
        it.btn.setAttribute('aria-current', on ? 'true' : 'false');
        if (on) target = it;
      });
      if (scene !== current) {
        current = scene;
        if (label) label.textContent = 'Tour virtual 360° · ' + name;
        showSpinner();
        frame.src = TOUR + scene;
      }
      // Mantém aberto o grupo do ambiente selecionado.
      if (target) openGroup(target.group, true);
      // No mobile, escolher um ambiente recolhe a sidebar.
      if (nav.classList.contains('is-open')) toggleNav(false);
    }

    function setMaximized(on) {
      dialog.classList.toggle('is-maximized', on);
      if (maxBtn) {
        maxBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
        maxBtn.setAttribute('aria-label', on ? 'Restaurar tamanho do tour virtual' : 'Maximizar tour virtual');
      }
    }

    function toggleNav(on) {
      var open = typeof on === 'boolean' ? on : !nav.classList.contains('is-open');
      nav.classList.toggle('is-open', open);
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    function open() {
      lastFocus = document.activeElement;
      setMaximized(false);
      toggleNav(false);
      buildNav();
      if (!items.length) return;
      if (!current) select(items[0].scene, items[0].name);
      dialog.showModal();
      if (bgVideo) bgVideo.pause();
      trackAnalytics('kob_virtual_tour_open', { tour_type: 'ship', tour_id: 'msc_musica' });
    }

    function close() {
      dialog.close();
    }

    openBtn.addEventListener('click', open);
    closeBtn.addEventListener('click', close);
    if (maxBtn) {
      maxBtn.addEventListener('click', function () {
        setMaximized(!dialog.classList.contains('is-maximized'));
      });
    }
    navToggle.addEventListener('click', function () { toggleNav(); });
    // Clique no backdrop fecha (só quando o alvo é o próprio dialog).
    dialog.addEventListener('click', function (e) {
      if (e.target === dialog) close();
    });
    dialog.addEventListener('close', function () {
      frame.src = 'about:blank';
      current = null;
      if (stage) stage.classList.remove('is-loading');
      setMaximized(false);
      toggleNav(false);
      if (bgVideo) {
        var bgRect = bgVideo.getBoundingClientRect();
        if (bgRect.bottom > 0 && bgRect.top < window.innerHeight) {
          var resume = bgVideo.play();
          if (resume && resume.catch) resume.catch(function () { });
        }
      }
      if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    });
  })();
  // YouTube IFrame API compartilhada pelos modais; um único script e uma única Promise.
  var youtubeApiPromise = null;
  function loadYouTubeApi() {
    if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
    if (youtubeApiPromise) return youtubeApiPromise;

    youtubeApiPromise = new Promise(function (resolve) {
      var previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () {
        if (typeof previous === 'function') {
          try { previous(); } catch (e) { }
        }
        resolve(window.YT);
      };

      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        var tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        var first = document.getElementsByTagName('script')[0];
        first.parentNode.insertBefore(tag, first);
      }
    });
    return youtubeApiPromise;
  }

  /* Modal de vídeo do tour a bordo (YouTube IFrame Player API) */
  (function shipVideo() {
    var dialog = document.getElementById('shipVideoModal');
    var openBtn = document.getElementById('shipVideoPlay');
    var closeBtn = document.getElementById('shipVideoClose');
    var target = document.getElementById('shipVideoFrame');
    if (!dialog || !openBtn || !target || typeof dialog.showModal !== 'function') {
      if (openBtn) openBtn.hidden = true;
      return;
    }

    var VIDEO_ID = target.dataset.videoId || 'LrnNnp0PbXQ';
    var bgVideo = document.querySelector('.ship-video__media');
    var lastFocus = null;
    var player = null;      // instância YT.Player
    var playerReady = false;
    var wantsPlay = false;  // usuário abriu antes da API/player ficar pronto

    function loadApi() {
      loadYouTubeApi().then(onApiReady);
    }

    // A API substitui o <div#shipVideoFrame> pelo <iframe> do player.
    function onApiReady() {
      if (player) return;
      player = new YT.Player('shipVideoFrame', {
        videoId: VIDEO_ID,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1
        },
        events: {
          onReady: function () {
            playerReady = true;
            if (wantsPlay && typeof player.playVideo === 'function') {
              player.playVideo();
            }
          }
        }
      });
    }

    function open() {
      lastFocus = document.activeElement;
      if (bgVideo && typeof bgVideo.pause === 'function') bgVideo.pause();
      wantsPlay = true;
      dialog.showModal();
      if (playerReady && player && typeof player.playVideo === 'function') {
        player.playVideo();
      } else {
        loadApi();
      }
    }

    function close() {
      dialog.close();
    }

    openBtn.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', close);

    // Clique no backdrop (fundo escuro) fecha o modal
    dialog.addEventListener('click', function (e) {
      if (e.target === dialog) close();
    });

    // Centraliza o reset (botão, clique fora e tecla ESC): para o vídeo via API.
    dialog.addEventListener('close', function () {
      wantsPlay = false;
      if (playerReady && player && typeof player.stopVideo === 'function') {
        player.stopVideo();
      }
      if (bgVideo && typeof bgVideo.play === 'function') {
        var p = bgVideo.play();
        if (p && typeof p.catch === 'function') p.catch(function () { });
      }
      if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    });
  })();

  /* Filme da edição 2025: modal YouTube com corte rígido em 04:01. */
  (function editionVideo() {
    var dialog = document.getElementById('editionVideoModal');
    var openBtn = document.getElementById('editionVideoOpen');
    var closeBtn = document.getElementById('editionVideoClose');
    var replayBtn = document.getElementById('editionVideoReplay');
    var returnBtn = document.getElementById('editionVideoReturn');
    var target = document.getElementById('editionVideoFrame');
    var endScreen = document.getElementById('editionVideoEnd');
    var status = document.getElementById('editionVideoStatus');
    if (!dialog || !openBtn || !target || !endScreen || typeof dialog.showModal !== 'function') {
      if (openBtn) openBtn.hidden = true;
      return;
    }

    var VIDEO_ID = target.dataset.videoId || 'GG05H0y0UlA';
    var END_SECONDS = parseInt(target.dataset.end, 10) || 241;
    var stage = dialog.querySelector('.edition-video__frame');
    var bgVideo = document.querySelector('.ship-video__media');
    var lastFocus = null;
    var player = null;
    var playerReady = false;
    var wantsPlay = false;
    var ended = false;
    var monitor = null;

    function stopMonitor() {
      if (monitor) window.clearInterval(monitor);
      monitor = null;
    }

    function finish() {
      if (ended || !dialog.open) return;
      ended = true;
      stopMonitor();
      if (playerReady && player && typeof player.pauseVideo === 'function') player.pauseVideo();
      var iframe = stage && stage.querySelector('iframe');
      if (iframe) iframe.inert = true;
      dialog.classList.add('is-ended');
      endScreen.hidden = false;
      if (status) status.textContent = 'O filme chegou ao corte final de 4 minutos e 1 segundo.';
      window.requestAnimationFrame(function () {
        if (replayBtn) replayBtn.focus();
      });
    }

    function checkTime() {
      if (!playerReady || !player || ended || !dialog.open || typeof player.getCurrentTime !== 'function') return;
      var current = Number(player.getCurrentTime()) || 0;
      if (current >= END_SECONDS - 0.2) finish();
    }

    function startMonitor() {
      stopMonitor();
      monitor = window.setInterval(checkTime, 200);
    }

    function resetEnd() {
      ended = false;
      dialog.classList.remove('is-ended');
      endScreen.hidden = true;
      var iframe = stage && stage.querySelector('iframe');
      if (iframe) iframe.inert = false;
      if (status) status.textContent = '';
    }

    function createPlayer() {
      if (player || !wantsPlay) return;
      target = document.getElementById('editionVideoFrame');
      if (!target) return;
      player = new YT.Player(target, {
        videoId: VIDEO_ID,
        playerVars: {
          controls: 0,
          end: END_SECONDS,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          playsinline: 1,
          rel: 0
        },
        events: {
          onReady: function () {
            playerReady = true;
            if (!wantsPlay) return;
            player.seekTo(0, true);
            player.playVideo();
            startMonitor();
          },
          onStateChange: function (event) {
            if (!window.YT || !window.YT.PlayerState) return;
            if (event.data === window.YT.PlayerState.PLAYING) startMonitor();
            if (event.data === window.YT.PlayerState.ENDED) finish();
          },
          onError: function () {
            if (status) status.textContent = 'Não foi possível carregar o filme. Tente novamente.';
          }
        }
      });
    }

    function destroyPlayer() {
      stopMonitor();
      if (player && typeof player.destroy === 'function') player.destroy();
      player = null;
      playerReady = false;
      var iframe = stage && stage.querySelector('iframe');
      if (iframe) iframe.remove();
      if (stage && !document.getElementById('editionVideoFrame')) {
        var host = document.createElement('div');
        host.id = 'editionVideoFrame';
        host.dataset.videoId = VIDEO_ID;
        host.dataset.end = String(END_SECONDS);
        stage.insertBefore(host, endScreen);
      }
    }

    function open() {
      lastFocus = document.activeElement;
      if (bgVideo && typeof bgVideo.pause === 'function') bgVideo.pause();
      wantsPlay = true;
      resetEnd();
      dialog.showModal();
      loadYouTubeApi().then(createPlayer);
    }

    function close() {
      if (dialog.open) dialog.close();
    }

    function replay() {
      resetEnd();
      if (!playerReady || !player) {
        loadYouTubeApi().then(createPlayer);
        return;
      }
      player.seekTo(0, true);
      player.playVideo();
      startMonitor();
    }

    openBtn.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (replayBtn) replayBtn.addEventListener('click', replay);
    if (returnBtn) returnBtn.addEventListener('click', close);
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) close();
    });
    dialog.addEventListener('close', function () {
      wantsPlay = false;
      destroyPlayer();
      resetEnd();
      if (bgVideo && typeof bgVideo.play === 'function') {
        var playback = bgVideo.play();
        if (playback && typeof playback.catch === 'function') playback.catch(function () { });
      }
      if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    });
  })();

  /* Mapa do Porto de Santos: iframe sob demanda em dialog nativo */
  (function portMap() {
    var dialog = document.getElementById('portMapModal');
    var openBtn = document.getElementById('portMapOpen');
    var closeBtn = document.getElementById('portMapClose');
    var frame = document.getElementById('portMapFrame');
    if (!dialog || !openBtn || !closeBtn || !frame || typeof dialog.showModal !== 'function') {
      if (openBtn) openBtn.hidden = true;
      return;
    }

    var stage = dialog.querySelector('.map-modal__stage');
    var source = frame.dataset.src;
    frame.addEventListener('load', function () {
      if (frame.src && frame.src !== 'about:blank' && stage) stage.classList.remove('is-loading');
    });

    openBtn.addEventListener('click', function () {
      if (stage) stage.classList.add('is-loading');
      frame.src = source;
      dialog.showModal();
    });

    closeBtn.addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', function () {
      frame.src = 'about:blank';
      if (stage) stage.classList.remove('is-loading');
      openBtn.focus();
    });
  })();

  /* FAQ / Manual de bordo: busca instantânea + scroll-spy por categoria */
  (function () {
    var navLinks = Array.prototype.slice.call(document.querySelectorAll('[data-faq-nav]'));
    if (!navLinks.length) return;
    var faq = document.querySelector('.faq');
    var faqNav = document.querySelector('.faq__nav');
    var search = document.getElementById('faq-search');
    var searchStatus = document.getElementById('faq-search-status');
    var panels = navLinks
      .map(function (a) { return document.querySelector(a.getAttribute('href')); })
      .filter(Boolean);
    if (!panels.length) return;

    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var mobileNav = window.matchMedia('(max-width: 900px)');
    var navSlideFrame = null;

    function keepActiveVisible(link) {
      if (!faqNav || !link || !mobileNav.matches) return;
      if (navSlideFrame) cancelAnimationFrame(navSlideFrame);
      navSlideFrame = requestAnimationFrame(function () {
        navSlideFrame = null;
        var navRect = faqNav.getBoundingClientRect();
        var linkRect = link.getBoundingClientRect();
        var edge = 12;
        if (linkRect.left >= navRect.left + edge && linkRect.right <= navRect.right - edge) return;
        var centered = faqNav.scrollLeft + linkRect.left - navRect.left - ((navRect.width - linkRect.width) / 2);
        var max = Math.max(0, faqNav.scrollWidth - faqNav.clientWidth);
        faqNav.scrollTo({
          left: Math.max(0, Math.min(centered, max)),
          behavior: reduce ? 'auto' : 'smooth'
        });
      });
    }

    function setActive(id) {
      var activeLink = null;
      navLinks.forEach(function (a, index) {
        var active = a.getAttribute('href') === '#' + id;
        a.classList.toggle('is-active', active);
        if (active) {
          activeLink = a;
          a.setAttribute('aria-current', 'true');
          if (faq) faq.style.setProperty('--faq-progress', ((index / (navLinks.length - 1)) * 100) + '%');
        } else {
          a.removeAttribute('aria-current');
        }
      });
      keepActiveVisible(activeLink);
    }

    function normalize(value) {
      return value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    function filterQuestions() {
      var term = normalize(search.value.trim());
      var visible = 0;

      panels.forEach(function (panel) {
        var details = Array.prototype.slice.call(panel.querySelectorAll('details'));
        var panelVisible = 0;
        details.forEach(function (item) {
          var match = !term || normalize(item.textContent).indexOf(term) !== -1;
          item.hidden = !match;
          if (match) {
            panelVisible += 1;
            visible += 1;
          } else {
            item.open = false;
          }
        });
        panel.hidden = panelVisible === 0;
      });

      navLinks.forEach(function (link) {
        var panel = document.querySelector(link.getAttribute('href'));
        link.hidden = Boolean(panel && panel.hidden);
      });

      if (faq) faq.classList.toggle('is-searching', Boolean(term));
      if (searchStatus) {
        searchStatus.textContent = term
          ? (visible === 1 ? '1 resposta encontrada' : visible + ' respostas encontradas')
          : '27 respostas organizadas por tema';
      }
    }

    navLinks.forEach(function (a) {
      a.addEventListener('click', function (e) {
        var target = document.querySelector(a.getAttribute('href'));
        if (!target) return;
        e.preventDefault();
        setActive(target.id);
        target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      });
    });

    if (search) {
      search.addEventListener('input', filterQuestions);
      document.addEventListener('keydown', function (event) {
        if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase('pt-BR') === 'k') {
          event.preventDefault();
          search.focus();
        }
        if (event.key === 'Escape' && document.activeElement === search && search.value) {
          search.value = '';
          filterQuestions();
        }
      });
    }

    if ('IntersectionObserver' in window) {
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
      panels.forEach(function (p) { spy.observe(p); });
    }
  })();

  // WhatsApp contextual: evita cobrir conteúdo denso e some quando já existe
  // um CTA equivalente à vista. O link retorna automaticamente nas transições.
  (function contextualWhatsapp() {
    var floating = document.querySelector('.wa-float');
    if (!floating || !('IntersectionObserver' in window)) return;
    var blockers = Array.prototype.slice.call(document.querySelectorAll(
      '#navio, #valores, #edicao2025, #faq, #reserve, footer, a[data-analytics-channel="whatsapp"]:not(.wa-float)'
    ));
    var visible = new Set();
    function sync() {
      var occluded = visible.size > 0;
      floating.dataset.occluded = occluded ? 'true' : 'false';
      floating.setAttribute('aria-hidden', occluded ? 'true' : 'false');
      floating.tabIndex = occluded ? -1 : 0;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      });
      sync();
    }, { threshold: 0.08, rootMargin: '-8% 0px -8% 0px' });
    blockers.forEach(function (blocker) { observer.observe(blocker); });
    sync();
  })();

  // Eventos de jornada do contrato v1. O dataLayer funciona como fila enquanto
  // o GTM aguarda a primeira interação e aplica o estado de consentimento.
  (function journeyAnalytics() {
    if ('IntersectionObserver' in window) {
      var sectionObserver = new IntersectionObserver(function (entries, observer) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          trackAnalytics('kob_section_view', { section_id: entry.target.id });
          if (entry.target.id === 'valores') trackValueList('panel-cabines');
          observer.unobserve(entry.target);
        });
      }, { threshold: 0, rootMargin: '-45% 0px -45% 0px' });
      ['evento', 'navio', 'valores', 'faq', 'reserve'].forEach(function (id) {
        var section = document.getElementById(id);
        if (section) sectionObserver.observe(section);
      });
    }

    document.addEventListener('click', function (event) {
      var link = event.target.closest('a[data-analytics-channel="whatsapp"]');
      if (!link) return;
      event.preventDefault();
      trackAnalytics('kob_whatsapp_click', {
        cta_id: link.dataset.analyticsCtaId,
        placement: link.dataset.analyticsPlacement,
        intent: link.dataset.analyticsIntent,
        item_id: link.dataset.analyticsItemId,
        item_category: link.dataset.analyticsItemCategory
      });
      // Lead qualificado (conversão): só quando a intenção é reservar de fato.
      // A venda fecha off-site (WhatsApp/Royal Trip), então o site mede até o lead.
      if (link.dataset.analyticsIntent === 'reservation') {
        trackAnalytics('generate_lead', {
          cta_id: link.dataset.analyticsCtaId,
          placement: link.dataset.analyticsPlacement,
          item_id: link.dataset.analyticsItemId,
          item_category: link.dataset.analyticsItemCategory
        });
      }
      if (link.dataset.kobWhatsappBound !== 'inline') {
        var destination = whatsappDestinations.get(link);
        if (destination) window.open(destination, '_blank', 'noopener');
      }
    });

    // FAQ: mede quais dúvidas são abertas (não o texto). IDs estáveis derivam
    // da categoria do painel + posição, nunca da copy da pergunta.
    (function faqOpenAnalytics() {
      var FAQ_CATEGORIES = { 'faq-embarque': 'embarque', 'faq-bordo': 'bordo', 'faq-comida': 'comida', 'faq-regras': 'regras' };
      var openedFaqIds = {};
      Object.keys(FAQ_CATEGORIES).forEach(function (panelId) {
        var panel = document.getElementById(panelId);
        if (!panel) return;
        var category = FAQ_CATEGORIES[panelId];
        var items = Array.prototype.slice.call(panel.querySelectorAll('details'));
        items.forEach(function (item, index) {
          if (!item.dataset.faqId) {
            item.dataset.faqId = category + '_' + ('0' + (index + 1)).slice(-2);
            item.dataset.faqCategory = category;
          }
          item.addEventListener('toggle', function () {
            if (!item.open) return;
            var faqId = item.dataset.faqId;
            if (openedFaqIds[faqId]) return;
            openedFaqIds[faqId] = true;
            trackAnalytics('kob_faq_open', { faq_id: faqId, faq_category: item.dataset.faqCategory });
          });
        });
      });
    })();

  })();

  // Carta náutica de #hospedagem: parallax de profundidade das camadas decorativas.
  // Reage ao ponteiro em telas fine-pointer; estático em toque e reduced-motion.
  (function () {
    var section = document.getElementById('hospedagem');
    if (!section) return;
    var chart = section.querySelector('.preboard-route__chart');
    var compass = section.querySelector('.preboard-route__compass');
    var frame = section.querySelector('.preboard-route__frame');
    if (!chart && !compass && !frame) return;
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var finePointer = window.matchMedia('(pointer: fine)').matches && !reduceMotion;
    if (!finePointer) return;
    var inView = false;
    var raf = null;
    // profundidades: fundo lento, moldura média, rosa dos ventos rápida (contra o movimento)
    var layers = [[chart, 0.45], [frame, 0.7], [compass, -1]];
    function apply(px, py) {
      layers.forEach(function (pair) {
        if (pair[0]) pair[0].style.transform = 'translate(' + (px * pair[1]).toFixed(1) + 'px,' + (py * pair[1]).toFixed(1) + 'px)';
      });
    }
    function reset() { apply(0, 0); }
    section.addEventListener('pointermove', function (event) {
      if (!inView) return;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () {
        raf = null;
        var rect = section.getBoundingClientRect();
        var x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
        var y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
        apply(x * 12, y * 8);
      });
    }, { passive: true });
    section.addEventListener('pointerleave', reset);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { inView = e.isIntersecting; if (!inView) reset(); });
      }, { threshold: 0.15 }).observe(section);
    } else { inView = true; }
  })();

  // Parceiros: ordem aleatória dos logos a cada visita
  (function () {
    var container = document.querySelector('#parceiros .logo-row');
    if (!container) return;
    var items = Array.prototype.slice.call(container.children);
    if (items.length <= 1) return;
    for (var i = items.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = items[i];
      items[i] = items[j];
      items[j] = temp;
    }
    var fragment = document.createDocumentFragment();
    items.forEach(function (item) {
      fragment.appendChild(item);
    });
    container.appendChild(fragment);
  })();

})();
