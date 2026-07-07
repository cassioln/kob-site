    document.documentElement.classList.add('js');
    (function () {
      'use strict';

      // Nav: some ao rolar, reaparece (com fundo) somente após passar a 3ª dobra
      var nav = document.getElementById('nav');
      var heroEl = document.querySelector('.hero');
      var onScroll = function () {
        var y = window.scrollY;
        var unit = heroEl ? heroEl.offsetHeight : window.innerHeight;
        var fold = unit * 3;
        var passedFold = y >= fold - 1;
        // Após a 3ª dobra: header visível com fundo azul
        nav.dataset.scrolled = passedFold ? 'true' : 'false';
        // Antes da 3ª dobra e já rolando: oculta; no topo (<=20) fica visível
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

      // Tabs genéricas com roving tabindex (Informações + Lotes)
      function initTabs(listSelector, opts) {
        var list = document.querySelector(listSelector);
        if (!list) return;
        var tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
        function activate(tab) {
          tabs.forEach(function (t) {
            var selected = t === tab;
            t.setAttribute('aria-selected', selected ? 'true' : 'false');
            t.tabIndex = selected ? 0 : -1;
            var panel = document.getElementById(t.getAttribute('aria-controls'));
            if (panel) {
              panel.dataset.active = selected ? 'true' : 'false';
              if (opts && opts.hideAttr) { if (selected) panel.removeAttribute('hidden'); else panel.setAttribute('hidden', ''); }
            }
          });
        }
        tabs.forEach(function (tab, i) {
          tab.addEventListener('click', function () { activate(tab); });
          tab.addEventListener('keydown', function (e) {
            var idx = null;
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') idx = (i + 1) % tabs.length;
            else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') idx = (i - 1 + tabs.length) % tabs.length;
            else if (e.key === 'Home') idx = 0;
            else if (e.key === 'End') idx = tabs.length - 1;
            if (idx !== null) { e.preventDefault(); tabs[idx].focus(); activate(tabs[idx]); }
          });
        });
      }
      initTabs('.tabs__list', { hideAttr: true });

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
        // Salvaguarda: se por qualquer motivo o observer não disparar, revela tudo
        setTimeout(revealAll, 2500);
        // Se a aba abrir já rolada (deep-link), garante o que está na viewport
        window.addEventListener('load', function () {
          reveals.forEach(function (el) {
            var r = el.getBoundingClientRect();
            if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('is-in');
          });
        });
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

      // Slideshow de banners do navio (autoplay + setas + dots, pausa no hover)
      var show = document.getElementById('shipShow');
      if (show) {
        var slides = Array.prototype.slice.call(show.querySelectorAll('.ship-slide'));
        var dotsWrap = document.getElementById('shipDots');
        var idx = 0, timer = null;
        var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        // cria dots
        var dots = slides.map(function (s, i) {
          var b = document.createElement('button');
          b.setAttribute('role', 'tab');
          b.setAttribute('aria-label', 'Foto ' + (i + 1) + ' de ' + slides.length);
          b.addEventListener('click', function () { goTo(i, true); });
          dotsWrap.appendChild(b);
          return b;
        });
        function goTo(i, manual) {
          idx = (i + slides.length) % slides.length;
          slides.forEach(function (s, k) { s.dataset.active = (k === idx) ? 'true' : 'false'; });
          dots.forEach(function (d, k) { d.setAttribute('aria-current', (k === idx) ? 'true' : 'false'); });
          if (manual) restart();
        }
        function next() { goTo(idx + 1); }
        function start() { if (!reduceMotion) timer = setInterval(next, 5000); }
        function stop() { if (timer) { clearInterval(timer); timer = null; } }
        function restart() { stop(); start(); }
        document.getElementById('shipNext').addEventListener('click', function () { goTo(idx + 1, true); });
        document.getElementById('shipPrev').addEventListener('click', function () { goTo(idx - 1, true); });
        show.addEventListener('mouseenter', stop);
        show.addEventListener('mouseleave', start);
        show.addEventListener('focusin', stop);
        show.addEventListener('focusout', start);
        // pausa quando fora da tela
        if ('IntersectionObserver' in window) {
          new IntersectionObserver(function (entries) {
            entries.forEach(function (e) { if (e.isIntersecting) start(); else stop(); });
          }, { threshold: 0.25 }).observe(show);
        } else { start(); }
        goTo(0);
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

        function open(key) {
          var d = DATA[key];
          if (!d) return;
          currentKey = key;
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
          elCta.href = d.wa;
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
          var spinner = document.getElementById('tour360Spinner');
          var label = document.getElementById('tour360Label');
          var tourClose = document.getElementById('tour360Close');
          var tourMax = document.getElementById('tour360Maximize');
          var tourFocus = null;

          function showSpinner() {
            if (spinner) spinner.style.display = 'flex';
          }
          frame.addEventListener('load', function () {
            if (frame.src && spinner) spinner.style.display = 'none';
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
            setMaximized(false);
            if (tourFocus && typeof tourFocus.focus === 'function') tourFocus.focus();
          });
        })();
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
