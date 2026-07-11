    document.documentElement.classList.add('js');
    (function () {
      'use strict';

      // Nav: some ao rolar dentro do hero; reaparece (com fundo) a partir da
      // seção #navio em diante — o header fica visível dela pra frente.
      var nav = document.getElementById('nav');
      var heroEl = document.querySelector('.hero');
      var navioEl = document.getElementById('navio');
      var onScroll = function () {
        var y = window.scrollY;
        // Gatilho: a seção #navio começa a entrar sob o header fixo.
        // Descontamos a altura do header para ele reaparecer logo antes,
        // sem cobrir o título da seção. Fallback: 1x altura do hero.
        var navH = nav ? nav.offsetHeight : 0;
        var trigger = navioEl
          ? navioEl.offsetTop - navH
          : (heroEl ? heroEl.offsetHeight : window.innerHeight);
        var passedFold = y >= trigger - 1;
        // A partir de #navio: header visível com fundo azul
        nav.dataset.scrolled = passedFold ? 'true' : 'false';
        // Antes de #navio e já rolando: oculta; no topo (<=20) fica visível
        nav.dataset.hidden = (!passedFold && y > 20) ? 'true' : 'false';
      };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });

      // Drawer mobile
      var drawer = document.getElementById('drawer');
      var toggle = document.getElementById('navToggle');
      var closeBtn = document.getElementById('drawerClose');
      function openDrawer() { drawer.dataset.open = 'true'; drawer.setAttribute('aria-hidden', 'false'); toggle.setAttribute('aria-expanded', 'true'); document.body.style.overflow = 'hidden'; setInert(true); closeBtn.focus(); }
      function closeDrawer() { drawer.dataset.open = 'false'; drawer.setAttribute('aria-hidden', 'true'); toggle.setAttribute('aria-expanded', 'false'); document.body.style.overflow = ''; setInert(false); toggle.focus(); }
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

      // Countdown → 20/11/2026 09:00 (horário de Brasília, -03:00)
      var target = new Date('2026-11-20T09:00:00-03:00').getTime();
      var elDays = document.querySelector('[data-count="days"]');
      var elHours = document.querySelector('[data-count="hours"]');
      var elMin = document.querySelector('[data-count="minutes"]');
      function pad(n) { return (n < 10 ? '0' : '') + n; }
      function tick() {
        var diff = target - Date.now();
        if (diff <= 0) {
          elDays.textContent = '0'; elHours.textContent = '00'; elMin.textContent = '00';
          return;
        }
        var s = Math.floor(diff / 1000);
        elDays.textContent = Math.floor(s / 86400);
        elHours.textContent = pad(Math.floor((s % 86400) / 3600));
        elMin.textContent = pad(Math.floor((s % 3600) / 60));
      }
      if (elDays) { tick(); setInterval(tick, 30000); }

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

      // Lightbox navegável da galeria (usa <dialog> nativo: Escape + focus trap de graça)
      var dialog = document.getElementById('lightbox');
      var links = Array.prototype.slice.call(document.querySelectorAll('.gallery a'));
      if (dialog && links.length && typeof dialog.showModal === 'function') {
        var lbImg = document.getElementById('lbImg');
        var lbCap = document.getElementById('lbCap');
        var lbCounter = document.getElementById('lbCounter');
        var items = links.map(function (a) {
          var img = a.querySelector('img');
          return { src: a.getAttribute('href'), alt: img ? img.getAttribute('alt') : '' };
        });
        var current = 0;
        function render() {
          var it = items[current];
          lbImg.src = it.src;
          lbImg.alt = it.alt;
          lbCap.textContent = it.alt;
          lbCounter.textContent = (current + 1) + ' / ' + items.length;
        }
        function open(i) { current = i; render(); if (!dialog.open) dialog.showModal(); }
        function go(step) { current = (current + step + items.length) % items.length; render(); }
        links.forEach(function (a, i) {
          a.addEventListener('click', function (e) { e.preventDefault(); open(i); });
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
      var track = document.getElementById('gallery');
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
        var memories = Array.prototype.slice.call(track.querySelectorAll('[data-memory]'));
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
        memories.forEach(function (item, idx) {
          if (highlightSet[idx]) {
            item.setAttribute('data-highlight', '');
            item.style.setProperty('--highlight-slot', highlightSet[idx]);
            item.hidden = false;
            highlights.push(item);
          } else {
            item.removeAttribute('data-highlight');
            item.style.removeProperty('--highlight-slot');
            item.hidden = true;
            archive.push(item);
          }
        });

        var totalLabel = 'Ver todas as ' + memories.length + ' fotografias';
        galleryExpand.addEventListener('click', function () {
          var expanded = galleryExpand.getAttribute('aria-expanded') === 'true';
          var nextState = !expanded;
          archive.forEach(function (item) { item.hidden = !nextState; });
          galleryExpand.setAttribute('aria-expanded', nextState ? 'true' : 'false');
          track.dataset.expanded = nextState ? 'true' : 'false';
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

      // Slideshow de banners do navio (autoplay + setas + dots, pausa no hover)
      var show = document.getElementById('shipShow');
      if (show) {
        var slides = Array.prototype.slice.call(show.querySelectorAll('.ship-slide'));
        var dotsWrap = document.getElementById('shipDots');
        var currentDisplay = show.querySelector('[data-ship-current]');
        var totalDisplay = show.querySelector('[data-ship-total]');
        var idx = 0, timer = null;
        var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var finePointer = window.matchMedia('(pointer: fine)').matches && !reduceMotion;
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
          if (!reduceMotion && inView && !document.hidden && !timer &&
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
      //  1) assets/videos/hero-intro.mp4 autoplay 0→4s (vídeo)
      //  2) aos 4s, cross-fade para assets/videos/hero-loop.mp4 em loop (vídeo)
      //  3) scroll na 1ª dobra faz scrubbing por SEQUÊNCIA DE FRAMES em <canvas>
      //     (evita o stutter de seek em <video>; frames = trecho 5s→fim do hero-intro)
      var heroBg = document.getElementById('heroBg');
      var dive = document.getElementById('heroDive');
      var loop = document.getElementById('heroLoop');
      var canvas = document.getElementById('heroCanvas');
      if (heroBg && dive && loop && canvas) {
        var INTRO_END = 4;   // fim da fase 1 / dive: frame que melhor casa com o loop@0
        var LOOP_PREROLL = 3;  // inicia o loop (escondido) antes, p/ já estar pintando na troca
        var REVEAL_AT = 2.8;      // revela conteúdo+logo do hero (independente do dive)
        var FRAME_COUNT = 60;   // frames do scrub, extraídos do trecho 4s→fim do hero-intro.mp4 (WebP 1080p)
        var phase = 'intro';    // intro | loop | scrub
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
        function revealHero() {
          if (heroSection && heroSection.dataset.intro !== 'done') {
            heroSection.dataset.intro = 'done';
          }
        }

        // Mantém o buffer do canvas igual ao tamanho REAL exibido na tela
        // (com devicePixelRatio), para o "cover" acompanhar a tela como o
        // object-fit:cover dos vídeos — sem deformar em telas estreitas/mobile.
        function resizeCanvas() {
          var dpr = Math.min(window.devicePixelRatio || 1, 2);
          var w = canvas.clientWidth || heroBg.clientWidth || window.innerWidth;
          var h = canvas.clientHeight || heroBg.clientHeight || window.innerHeight;
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
        }

        dive.addEventListener('loadedmetadata', function () { heroBg.dataset.videoReady = 'true'; });

        // Esconde o fallback só quando um vídeo realmente começa a exibir frames
        // (evento 'playing'), fazendo crossfade suave em vez de corte seco.
        function markMediaLive() { heroBg.dataset.mediaLive = 'true'; }
        dive.addEventListener('playing', markMediaLive);
        loop.addEventListener('playing', markMediaLive);

        // Pré-carrega os frames do scrubbing (nomes frame-001.webp ... frame-060.webp)
        for (var i = 1; i <= FRAME_COUNT; i++) {
          var img = new Image();
          img.decoding = 'async';
          img.onload = function () { framesLoaded++; };
          img.src = 'assets/hero-frames/frame-' + String(i).padStart(3, '0') + '.webp';
          frames.push(img);
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

        // Handshake da troca dive→loop, à prova de piscada:
        // 1) faz pré-roll do loop (tocando, porém invisível) antes do corte;
        // 2) no corte, revela o loop (que já está pintando frames, por cima do
        //    dive) e só ENTÃO esconde o dive — crossfade sem gap/fundo à mostra.
        var loopPrerolled = false, switching = false;
        function startLoopPreroll() {
          if (loopPrerolled) return;
          loopPrerolled = true;
          try { loop.currentTime = 0; } catch (e) { }
          var p = loop.play(); if (p && p.catch) p.catch(function () { });
        }
        function switchToLoop() {
          if (switching || phase !== 'intro') return;
          switching = true;
          phase = 'loop';
          startLoopPreroll();
          // Alinha o loop ao frame casado (loop@0 ≈ dive@INTRO_END) no instante da
          // troca; o pré-roll serviu para o decoder já estar "quente".
          try { loop.currentTime = 0; } catch (e) { }
          // O loop já está tocando por baixo (pré-roll). Revela-o e faz o DIVE
          // (que está por cima) desaparecer em crossfade de 700ms — cruza suave,
          // sem gap nem piscada, disfarçando a diferença de posição dos objetos.
          show(loop);
          revealHero();
          function crossfadeOutDive() {
            hide(dive); hide(canvas);         // dispara o fade-out (opacity→0, 700ms)
            // Só pausa/reseta o dive DEPOIS do fade, senão o último frame congela e pisca.
            setTimeout(function () {
              dive.pause();
              try { dive.currentTime = 0; } catch (e) { }
            }, 750);
          }
          // Espera o loop estar realmente pintando antes de cruzar (evita ver o
          // loop preto/vazio por baixo do dive sumindo).
          if (loop.readyState >= 2 && !loop.paused) {
            requestAnimationFrame(crossfadeOutDive);
          } else {
            loop.addEventListener('playing', crossfadeOutDive, { once: true });
            setTimeout(crossfadeOutDive, 250); // rede de segurança
          }
        }

        // FASE 1 → 2: monitora o tempo do dive durante a intro
        dive.addEventListener('timeupdate', function () {
          if (phase !== 'intro') return;
          if (dive.currentTime >= REVEAL_AT) revealHero();
          if (dive.currentTime >= LOOP_PREROLL) startLoopPreroll();
          if (dive.currentTime >= INTRO_END) switchToLoop();
        });
        // Se o dive terminar sozinho (chega ao fim antes do corte), troca também.
        dive.addEventListener('ended', switchToLoop);

        // Inicia a fase 1 (autoplay). Se o navegador bloquear, cai direto no loop.
        (function startIntro() {
          show(dive); hide(loop); hide(canvas);
          var p = dive.play();
          if (p && p.catch) p.catch(function () {
            phase = 'loop';
            show(loop); hide(dive); hide(canvas);
            var lp = loop.play(); if (lp && lp.catch) lp.catch(function () { });
            revealHero();
          });
        })();

        // Rede de segurança: se o dive falhar/travar ou nunca terminar, revela
        // o hero mesmo assim para não deixar o conteúdo escondido.
        dive.addEventListener('error', revealHero);
        dive.addEventListener('stalled', revealHero);
        setTimeout(revealHero, REVEAL_AT * 1000);
        setTimeout(revealHero, (INTRO_END + 2.5) * 1000);

        // FASE 3: scrubbing por frames sincronizado ao scroll
        function tick() {
          if (currentFrame !== targetFrame) {
            // aproxima suavemente o frame exibido do frame alvo (easing)
            var diff = targetFrame - currentFrame;
            var stepv = Math.abs(diff) <= 1 ? diff : diff * 0.35;
            drawFrame(Math.round(currentFrame + stepv));
            raf = requestAnimationFrame(tick);
          } else { raf = null; }
        }
        function onScroll() {
          // Se o usuário rolar antes do fim da intro (~2.8s), revela já o
          // conteúdo do hero em vez de esperar o timer — evita ver a 2ª dobra
          // com o hero ainda "vazio". Idempotente.
          revealHero();
          var hero = document.querySelector('.hero');
          var rect = hero.getBoundingClientRect();
          var total = rect.height || window.innerHeight;
          var scrolled = Math.min(Math.max(-rect.top / total, 0), 1);
          if (scrolled <= 0.02) {
            if (phase === 'scrub') {
              phase = 'loop';
              show(loop); hide(dive); hide(canvas);
              var lp = loop.play(); if (lp && lp.catch) lp.catch(function () { });
            }
            return;
          }
          if (phase !== 'scrub') {
            phase = 'scrub';
            loop.pause(); dive.pause();
            if (currentFrame < 0) { drawFrame(0); }
            show(canvas); hide(loop); hide(dive);
          }
          targetFrame = Math.round(scrolled * (FRAME_COUNT - 1));
          if (!raf) raf = requestAnimationFrame(tick);
        }
        window.addEventListener('scroll', onScroll, { passive: true });

        // Ajusta o buffer ao tamanho real e re-crop ao mudar a viewport
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas, { passive: true });
        window.addEventListener('orientationchange', resizeCanvas);
      }

      // Fallback global: se o bloco de vídeo acima não rodar (elemento ausente),
      // garante que o hero apareça mesmo assim.
      (function heroSafety() {
        var h = document.querySelector('.hero');
        if (h) setTimeout(function () { if (h.dataset.intro !== 'done') h.dataset.intro = 'done'; }, 7000);
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

      // ---------- #evento: timeline horizontal só no celular ----------
      (function eventTimelineAdapt() {
        var track = document.querySelector('#evento .event-track');
        if (!track) return;
        var mobile = window.matchMedia('(max-width: 680px)');
        var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        function syncMode() {
          if (mobile.matches) {
            track.tabIndex = 0;
            track.setAttribute('role', 'region');
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
        if (typeof mobile.addEventListener === 'function') mobile.addEventListener('change', syncMode);
        else mobile.addListener(syncMode);
        syncMode();
      })();

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
            wa: WA + encodeURIComponent('Olá, Royal Trip! Quero reservar uma Cabine Interna (2º lote) no Kriativos On Board 2026.')
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
            wa: WA + encodeURIComponent('Olá, Royal Trip! Quero reservar uma Cabine Janela (2º lote) no Kriativos On Board 2026.')
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
            wa: WA + encodeURIComponent('Olá, Royal Trip! Quero reservar uma Cabine Varanda (2º lote) no Kriativos On Board 2026.')
          },
          easy: {
            cabin: 'Pacote Easy · R$ 768',
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
            wa: WA + encodeURIComponent('Olá, Royal Trip! Quero o Pacote de Bebidas Easy no Kriativos On Board 2026.')
          },
          premium: {
            cabin: 'Pacote Premium · R$ 1.344',
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
            wa: WA + encodeURIComponent('Olá, Royal Trip! Quero o Pacote de Bebidas Premium no Kriativos On Board 2026.')
          },
          naoalcoolico: {
            cabin: 'Não alcoólico · R$ 615',
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
            wa: WA + encodeURIComponent('Olá, Royal Trip! Quero o Pacote de Bebidas Não Alcoólico no Kriativos On Board 2026.')
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
            elCta.href = isDrink ? '#' : d.wa;
          }
          modal.showModal();
          modal.scrollTop = 0;
          var inner = modal.querySelector('.cabin-modal__inner');
          if (inner) inner.scrollTop = 0;
        }

        function close() {
          modal.close();
        }

        document.querySelectorAll('.price-card__details').forEach(function (btn) {
          btn.addEventListener('click', function () { open(btn.dataset.cabin); });
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
        var lastFocus = null;
        var items = [];
        var groupEls = [];
        var current = null;

        // O backup veio de um browser vivo e pode trazer a sidebar já renderizada.
        // Sempre zera antes de montar para evitar duplicação de ambientes.
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
            img.src = THUMBS + scene + '.jpg';
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
          groupEls.push({ section: section, head: head });
        });

        // Abre um grupo (fecha os demais). Passar open=false recolhe todos.
        function openGroup(index, open) {
          groupEls.forEach(function (g, i) {
            var on = open !== false && i === index;
            g.section.classList.toggle('is-open', on);
            g.head.setAttribute('aria-expanded', on ? 'true' : 'false');
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
          if (!current) select(items[0].scene, items[0].name);
          dialog.showModal();
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
          if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
        });
      })();

      /* Modal de vídeo do tour a bordo (YouTube embed) */
      (function shipVideo() {
        var dialog = document.getElementById('shipVideoModal');
        var openBtn = document.getElementById('shipVideoPlay');
        var closeBtn = document.getElementById('shipVideoClose');
        var frame = document.getElementById('shipVideoFrame');
        if (!dialog || !openBtn || !frame || typeof dialog.showModal !== 'function') {
          if (openBtn) openBtn.hidden = true;
          return;
        }

        var EMBED = 'https://www.youtube.com/embed/LrnNnp0PbXQ?rel=0&modestbranding=1&playsinline=1&autoplay=1';
        var bgVideo = document.querySelector('.ship-video__media');
        var lastFocus = null;

        function open() {
          lastFocus = document.activeElement;
          if (bgVideo && typeof bgVideo.pause === 'function') bgVideo.pause();
          frame.src = EMBED;
          dialog.showModal();
        }

        function close() {
          dialog.close();
        }

        openBtn.addEventListener('click', open);
        if (closeBtn) closeBtn.addEventListener('click', close);
        // Clique no backdrop fecha (só quando o alvo é o próprio dialog).
        dialog.addEventListener('click', function (e) {
          if (e.target === dialog) close();
        });
        dialog.addEventListener('close', function () {
          frame.src = 'about:blank';
          if (bgVideo && typeof bgVideo.play === 'function') {
            var p = bgVideo.play();
            if (p && typeof p.catch === 'function') p.catch(function () {});
          }
          if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
        });
      })();

      /* FAQ premium: scroll-spy + smooth scroll na nav de categorias */
      (function () {
        var navLinks = Array.prototype.slice.call(document.querySelectorAll('[data-faq-nav]'));
        if (!navLinks.length) return;
        var panels = navLinks
          .map(function (a) { return document.querySelector(a.getAttribute('href')); })
          .filter(Boolean);
        if (!panels.length) return;

        var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        function setActive(id) {
          navLinks.forEach(function (a) {
            a.classList.toggle('is-active', a.getAttribute('href') === '#' + id);
          });
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

        if ('IntersectionObserver' in window) {
          var spy = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
              if (entry.isIntersecting) setActive(entry.target.id);
            });
          }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
          panels.forEach(function (p) { spy.observe(p); });
        }
      })();
    })();
