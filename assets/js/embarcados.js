/**
 * Kriativos On Board 2026 — Guia de Quem Já Reservou (Embarcados)
 * JavaScript modular, acessível e resiliente a falhas de rede/storage.
 */

(function () {
  'use strict';

  // --------------------------------------------------------------------------
  // DADOS DOS CAPÍTULOS DA LIVE (#17) — 28 CAPÍTULOS CONFERIDOS
  // --------------------------------------------------------------------------
  var LIVE_CHAPTERS = [
    { time: "00:13:53", seconds: 833, title: "Boas-vindas e apresentação da viagem", keywords: "abertura feriado live" },
    { time: "00:15:13", seconds: 913, title: "Royal Trip e quarta edição do KOB", keywords: "agencia royal trip msc musica edicao" },
    { time: "00:16:49", seconds: 1009, title: "Datas, desembarque e retorno do fretado", keywords: "datas cabine segunda-feira retorno onibus desembarque" },
    { time: "00:17:16", seconds: 1036, title: "Parceiros do evento", keywords: "acervo monitores apoiadores editoras encounter facil shopping" },
    { time: "00:20:50", seconds: 1250, title: "Documentos e autorização para menores", keywords: "documentos rg cnh passaporte foto aplicativo menores autorizacao" },
    { time: "00:22:25", seconds: 1345, title: "Vouchers, check-in e etiquetas", keywords: "junior privado impressao voucher checkin etiquetas royal trip" },
    { time: "00:28:22", seconds: 1702, title: "Aeroportos e chegada a Santos", keywords: "aeroporto gru cgonhas viracopos cometa rodoviaria santos van aviao" },
    { time: "00:29:25", seconds: 1765, title: "Estacionamento no Concais", keywords: "carro concais estacionamento reserva veiculo porto" },
    { time: "00:30:52", seconds: 1852, title: "Cruise Card, cartões e gastos a bordo", keywords: "cruise card cartao moeda wise nomad parcelamento compras credito", notice: "Valores e condições dependem da oferta, da apólice e da confirmação da agência." },
    { time: "00:32:43", seconds: 1963, title: "Buffet e liberação das cabines", keywords: "buffet almoco comida restaurante 13h 14h cabine malas anuncio" },
    { time: "00:34:01", seconds: 2041, title: "Encontro, kits e mural de programação", keywords: "crystal lounge cracha cordao pulseira moeda facil shopping kit mural" },
    { time: "00:36:01", seconds: 2161, title: "Roupas e Festa do Branco", keywords: "roupas festa do branco traje jantar agasalho esporte fino chinelo regata" },
    { time: "00:37:56", seconds: 2276, title: "Gestantes", keywords: "gestante gravidez semanas atestado medico crbm", notice: "A regra da MSC considera a idade gestacional durante todo o cruzeiro (limite 24 semanas)." },
    { time: "00:38:59", seconds: 2339, title: "Bebês na reserva", keywords: "bebe crianca reserva berco tarifa menor cabine" },
    { time: "00:39:28", seconds: 2368, title: "Água, chá, café e sistema Aqua", keywords: "agua cha cafe buffet garrafa retornavel sistema aqua dispensador" },
    { time: "00:40:23", seconds: 2423, title: "Pacotes de bebidas", keywords: "pacote bebidas easy premium extra nao alcoolico drinks cerveja bar" },
    { time: "00:45:15", seconds: 2715, title: "Internet por aparelho e sinal em Búzios", keywords: "wifi internet pacote aparelho celular buzios sinal dados operadora", notice: "Confira o dia da escala na sua reserva. O sinal de celular depende da cobertura da sua operadora." },
    { time: "00:48:14", seconds: 2894, title: "Jantar, turnos e mesas com amigos", keywords: "jantar turno maitre restaurante mesa amigos reserva tolerancia horario" },
    { time: "00:52:34", seconds: 3154, title: "Frigobar e cobranças", keywords: "frigobar minibar quarto pacote bebidas cobranca separado" },
    { time: "00:53:33", seconds: 3213, title: "Tema Anos 80 e encerramento", keywords: "anos 80 festa encerramento fantasia retro neon domingo comemoracao" },
    { time: "00:58:26", seconds: 3506, title: "Restaurantes de especialidades", keywords: "especialidades kaito sushi butchers cut carne restaurante pago a parte" },
    { time: "01:02:46", seconds: 3766, title: "MSC for Me e chat interno", keywords: "msc for me app aplicativo chat mensagens kriativo interno navio" },
    { time: "01:05:42", seconds: 3942, title: "Board Game Guru e sorteios", keywords: "guru board game guru eu vou encounter inscricao manual favoritos ludopedia bgg compartilhar jogos sorteio", notice: "Registre-se no Board Game Guru ou solicite inclusão manual à Encounter para concorrer aos sorteios." },
    { time: "01:11:05", seconds: 4265, title: "Seguro e despesas médicas", keywords: "seguro viagem apolice cobertura moeda medico hospital despesas", notice: "Valores e coberturas dependem da oferta e apólice da agência. Não há valores garantidos pela live." },
    { time: "01:13:09", seconds: 4389, title: "Crianças e clubinho", keywords: "criancas clubinho doremi fraldas refeicoes recreacao kids", notice: "Confirme horários e condições do serviço com a equipe infantil a bordo." },
    { time: "01:14:16", seconds: 4456, title: "Bagagem", keywords: "bagagem franquia peso malas malas despachadas mao msc", notice: "Consulte a regra oficial da MSC no guia: há diferenças em relação às informações faladas na live." },
    { time: "01:14:41", seconds: 4481, title: "Cabine e itens para a mala", keywords: "cabine higiene itens proibidos secador chapinha tomada shampoo amenidades", notice: "Consulte a lista oficial MSC de itens permitidos e proibidos antes de fechar a mala." },
    { time: "01:18:32", seconds: 4712, title: "Grupo oficial e recados finais", keywords: "grupo avisos acompanhantes familiares whatsapp contatos duvidas" }
  ];

  // Helper de normalização para busca sem acentos
  function normalizeText(str) {
    if (!str) return '';
    return str
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  // --------------------------------------------------------------------------
  // CONTADOR REGRESSIVO DE DIAS (#16)
  // --------------------------------------------------------------------------
  function initCountdown() {
    var countdownEl = document.getElementById('guideCountdownText');
    if (!countdownEl) return;

    var lang = (document.documentElement.lang || 'pt-BR').toLowerCase();
    var isEn = lang.startsWith('en');
    var isEs = lang.startsWith('es');

    try {
      // Data alvo: 20 de novembro de 2026 no fuso de São Paulo (-03:00)
      var now = new Date();
      // Obter data no fuso de São Paulo
      var spFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      var spParts = spFormatter.format(now).split('-');
      var currentYear = parseInt(spParts[0], 10);
      var currentMonth = parseInt(spParts[1], 10);
      var currentDay = parseInt(spParts[2], 10);

      var todaySP = new Date(Date.UTC(currentYear, currentMonth - 1, currentDay));
      var eventDateSP = new Date(Date.UTC(2026, 10, 20)); // 20/11/2026
      var eventEndSP = new Date(Date.UTC(2026, 10, 23));  // 23/11/2026

      var diffTime = eventDateSP.getTime() - todaySP.getTime();
      var diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 1) {
        if (isEn) {
          countdownEl.textContent = 'Only ' + diffDays + ' days until boarding day.';
        } else if (isEs) {
          countdownEl.textContent = 'Faltan ' + diffDays + ' días para el día del embarque.';
        } else {
          countdownEl.textContent = 'Faltam ' + diffDays + ' dias para o dia do embarque.';
        }
      } else if (diffDays === 1) {
        if (isEn) {
          countdownEl.textContent = 'Only 1 day until boarding day.';
        } else if (isEs) {
          countdownEl.textContent = 'Falta 1 día para el día del embarque.';
        } else {
          countdownEl.textContent = 'Falta 1 dia para o dia do embarque.';
        }
      } else if (diffDays === 0) {
        if (isEn) {
          countdownEl.textContent = 'Today is boarding day! Check your voucher and team instructions.';
        } else if (isEs) {
          countdownEl.textContent = '¡Hoy es el día del embarque! Revisa tu voucher y las instrucciones del equipo.';
        } else {
          countdownEl.textContent = 'Hoje é o dia do embarque. Confira seu voucher e as orientações da equipe.';
        }
      } else if (todaySP.getTime() <= eventEndSP.getTime()) {
        if (isEn) {
          countdownEl.textContent = 'We are sailing in Kriativos On Board! Check the onboard daily program.';
        } else if (isEs) {
          countdownEl.textContent = '¡Estamos a bordo de Kriativos On Board! Consulta la programación a bordo.';
        } else {
          countdownEl.textContent = 'Estamos nos dias do Kriativos On Board. Consulte a programação a bordo.';
        }
      } else {
        if (isEn) {
          countdownEl.textContent = 'The 2026 edition has concluded. See you next trip!';
        } else if (isEs) {
          countdownEl.textContent = 'La edición 2026 ha finalizado. ¡Nos vemos en el próximo viaje!';
        } else {
          countdownEl.textContent = 'A edição 2026 foi encerrada.';
        }
      }
    } catch (e) {
      // Fallback
      if (isEn) {
        countdownEl.textContent = 'Boarding on November 20, 2026.';
      } else if (isEs) {
        countdownEl.textContent = 'Embarque el 20 de noviembre de 2026.';
      } else {
        countdownEl.textContent = 'Embarque em 20 de novembro de 2026.';
      }
    }
  }

  // --------------------------------------------------------------------------
  // CHECKLIST DE PREPARAÇÃO COM PERSISTÊNCIA LOCAL (#18)
  // --------------------------------------------------------------------------
  var CHECKLIST_STORAGE_KEY = 'kob_embarcados_checklist_2026_v1';

  function initChecklist() {
    var checklistRoot = document.getElementById('checklistContainer');
    if (!checklistRoot) return;

    var progressText = document.getElementById('checklistProgressText');
    var progressFill = document.getElementById('checklistProgressFill');
    var progressBar = document.getElementById('checklistProgressBar');
    var completedMsg = document.getElementById('checklistCompletedMsg');
    var resetBtn = document.getElementById('checklistResetBtn');

    var lang = (document.documentElement.lang || 'pt-BR').toLowerCase();
    var isEn = lang.startsWith('en');
    var isEs = lang.startsWith('es');

    // Carregar estado salvo
    var savedState = {};
    try {
      var raw = localStorage.getItem(CHECKLIST_STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          savedState = parsed;
        }
      }
    } catch (e) {
      console.warn('LocalStorage indisponível para checklist; usando memória.');
    }

    var items = checklistRoot.querySelectorAll('.checklist-item');

    // Inicializar inputs com base no estado salvo
    items.forEach(function (item) {
      var id = item.getAttribute('data-checklist-id');
      if (!id) return;

      var checkbox = item.querySelector('.checklist-item__checkbox');
      var naToggle = item.querySelector('.checklist-item__na-checkbox');

      if (savedState[id]) {
        if (savedState[id].checked && checkbox) {
          checkbox.checked = true;
          item.classList.add('is-checked');
        }
        if (savedState[id].na && naToggle) {
          naToggle.checked = true;
          item.classList.add('is-not-applicable');
          if (checkbox) checkbox.disabled = true;
        }
      }

      if (checkbox) {
        checkbox.addEventListener('change', function () {
          if (checkbox.checked) {
            item.classList.add('is-checked');
          } else {
            item.classList.remove('is-checked');
          }
          saveAndRefresh();
        });
      }

      if (naToggle) {
        naToggle.addEventListener('change', function () {
          if (naToggle.checked) {
            item.classList.add('is-not-applicable');
            if (checkbox) {
              checkbox.checked = false;
              checkbox.disabled = true;
              item.classList.remove('is-checked');
            }
          } else {
            item.classList.remove('is-not-applicable');
            if (checkbox) {
              checkbox.disabled = false;
            }
          }
          saveAndRefresh();
        });
      }
    });

    function saveAndRefresh() {
      var stateToSave = {};
      var totalApplicable = 0;
      var checkedCount = 0;

      items.forEach(function (item) {
        var id = item.getAttribute('data-checklist-id');
        var type = item.getAttribute('data-checklist-type'); // essential, recommended, conditional, optional
        var checkbox = item.querySelector('.checklist-item__checkbox');
        var naToggle = item.querySelector('.checklist-item__na-checkbox');

        var isChecked = checkbox ? checkbox.checked : false;
        var isNa = naToggle ? naToggle.checked : false;

        stateToSave[id] = { checked: isChecked, na: isNa };

        // Itens essenciais ou condicionais contam para o progresso principal
        var isEssentialOrConditional = (type === 'essential' || type === 'conditional');

        if (isEssentialOrConditional) {
          if (!isNa) {
            totalApplicable++;
            if (isChecked) {
              checkedCount++;
            }
          }
        }
      });

      // Salvar
      try {
        localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(stateToSave));
      } catch (e) {}

      // Atualizar progresso
      var percentage = totalApplicable > 0 ? Math.round((checkedCount / totalApplicable) * 100) : 0;
      if (progressFill) progressFill.style.width = percentage + '%';
      if (progressBar) progressBar.setAttribute('aria-valuenow', percentage.toString());

      if (progressText) {
        if (isEn) {
          progressText.textContent = checkedCount + ' of ' + totalApplicable + ' essential or applicable items checked';
        } else if (isEs) {
          progressText.textContent = checkedCount + ' de ' + totalApplicable + ' ítems esenciales o aplicables verificados';
        } else {
          progressText.textContent = checkedCount + ' de ' + totalApplicable + ' itens essenciais ou aplicáveis conferidos';
        }
      }

      if (completedMsg) {
        if (totalApplicable > 0 && checkedCount === totalApplicable) {
          completedMsg.classList.add('is-visible');
        } else {
          completedMsg.classList.remove('is-visible');
        }
      }
    }

    // Reset button
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        var confirmMsg = isEn
          ? 'Clear all checklist marks in this browser?'
          : isEs
          ? '¿Borrar todas las marcas de esta lista en este navegador?'
          : 'Apagar as marcações deste checklist neste navegador?';

        if (window.confirm(confirmMsg)) {
          try {
            localStorage.removeItem(CHECKLIST_STORAGE_KEY);
          } catch (e) {}

          items.forEach(function (item) {
            var checkbox = item.querySelector('.checklist-item__checkbox');
            var naToggle = item.querySelector('.checklist-item__na-checkbox');
            if (checkbox) {
              checkbox.checked = false;
              checkbox.disabled = false;
            }
            if (naToggle) {
              naToggle.checked = false;
            }
            item.classList.remove('is-checked', 'is-not-applicable');
          });

          saveAndRefresh();
          resetBtn.focus();
        }
      });
    }

    // Primeira atualização
    saveAndRefresh();
  }

  // --------------------------------------------------------------------------
  // FAQ DETALHADO (#20) — BUSCA & CATEGORIAS
  // --------------------------------------------------------------------------
  function initFAQ() {
    var searchInput = document.getElementById('faqSearchInput');
    var clearBtn = document.getElementById('faqClearBtn');
    var categoryBtns = document.querySelectorAll('.faq-category-btn');
    var faqItems = document.querySelectorAll('.faq-item');
    var emptyState = document.getElementById('faqEmptyState');
    var resultsCounter = document.getElementById('faqResultsCount');

    if (!faqItems.length) return;

    var currentCategory = 'all';

    function filterFAQ() {
      var query = searchInput ? normalizeText(searchInput.value) : '';
      var visibleCount = 0;

      faqItems.forEach(function (item) {
        var itemCategory = item.getAttribute('data-category') || '';
        var matchesCategory = (currentCategory === 'all' || itemCategory === currentCategory);

        var titleEl = item.querySelector('.faq-item__summary-title');
        var textEl = item.querySelector('.faq-item__content');
        var id = item.getAttribute('id') || '';

        var textContent = (titleEl ? titleEl.textContent : '') + ' ' + (textEl ? textEl.textContent : '') + ' ' + id;
        var normalizedContent = normalizeText(textContent);

        var matchesQuery = !query || normalizedContent.indexOf(query) !== -1;

        if (matchesCategory && matchesQuery) {
          item.style.display = '';
          visibleCount++;
          // Se o usuário fez uma busca com 3+ caracteres, abre os itens para leitura facilitada
          if (query.length >= 3) {
            item.setAttribute('open', '');
          }
        } else {
          item.style.display = 'none';
        }
      });

      if (emptyState) {
        if (visibleCount === 0) {
          emptyState.classList.add('is-visible');
        } else {
          emptyState.classList.remove('is-visible');
        }
      }

      if (resultsCounter) {
        resultsCounter.textContent = visibleCount.toString();
      }
    }

    if (searchInput) {
      searchInput.addEventListener('input', filterFAQ);
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        if (searchInput) {
          searchInput.value = '';
        }
        currentCategory = 'all';
        categoryBtns.forEach(function (btn) {
          if (btn.getAttribute('data-category') === 'all') {
            btn.classList.add('is-active');
          } else {
            btn.classList.remove('is-active');
          }
        });
        filterFAQ();
        if (searchInput) searchInput.focus();
      });
    }

    categoryBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        categoryBtns.forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        currentCategory = btn.getAttribute('data-category') || 'all';
        filterFAQ();
      });
    });

    // Abrir âncora direta (ex: #faq-o12)
    function checkHashTarget() {
      var hash = window.location.hash;
      if (hash && hash.startsWith('#faq-')) {
        var targetEl = document.querySelector(hash);
        if (targetEl && targetEl.tagName.toLowerCase() === 'details') {
          targetEl.setAttribute('open', '');
          setTimeout(function () {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            var summary = targetEl.querySelector('summary');
            if (summary) summary.focus();
          }, 200);
        }
      }
    }

    window.addEventListener('hashchange', checkHashTarget);
    checkHashTarget();
  }

  // --------------------------------------------------------------------------
  // LIVE POR ASSUNTO (#17) — PLAYER FACHADA & BUSCA DE CAPÍTULOS
  // --------------------------------------------------------------------------
  function initLiveModule() {
    var chaptersList = document.getElementById('liveChaptersList');
    var searchInput = document.getElementById('liveSearchInput');
    var loadPlayerBtn = document.getElementById('loadLivePlayerBtn');
    var playerFacade = document.getElementById('livePlayerFacade');
    var playerContainer = document.getElementById('livePlayerContainer');
    var emptyMsg = document.getElementById('liveEmptyChaptersMsg');

    if (!chaptersList) return;

    var playerIframe = null;
    var isPlayerLoaded = false;
    var pendingSeconds = null;

    // Renderizar capítulos
    function renderChapters(filterQuery) {
      chaptersList.innerHTML = '';
      var query = normalizeText(filterQuery);
      var count = 0;

      LIVE_CHAPTERS.forEach(function (cap) {
        var searchIndex = normalizeText(cap.time + ' ' + cap.title + ' ' + cap.keywords);
        if (query && searchIndex.indexOf(query) === -1) {
          return;
        }

        count++;
        var li = document.createElement('li');
        li.className = 'live-chapter-item';
        li.setAttribute('role', 'button');
        li.setAttribute('tabindex', '0');
        li.setAttribute('data-seconds', cap.seconds.toString());

        var timeSpan = document.createElement('span');
        timeSpan.className = 'live-chapter-item__time';
        timeSpan.textContent = cap.time;

        var bodyDiv = document.createElement('div');
        bodyDiv.className = 'live-chapter-item__content';

        var titleP = document.createElement('p');
        titleP.className = 'live-chapter-item__title';
        titleP.textContent = cap.title;
        bodyDiv.appendChild(titleP);

        if (cap.notice) {
          var noticeP = document.createElement('p');
          noticeP.className = 'live-chapter-item__notice';
          noticeP.textContent = '⚠️ ' + cap.notice;
          bodyDiv.appendChild(noticeP);
        }

        var extLink = document.createElement('a');
        extLink.className = 'live-chapter-item__ext';
        extLink.href = 'https://www.youtube.com/watch?v=AtIvlc62KgI&t=' + cap.seconds + 's';
        extLink.target = '_blank';
        extLink.rel = 'noopener noreferrer';
        extLink.textContent = 'Abrir no YouTube';
        extLink.setAttribute('aria-label', 'Abrir capítulo ' + cap.title + ' no YouTube');
        // Impedir que o link externo ative o seek interno
        extLink.addEventListener('click', function (e) {
          e.stopPropagation();
        });

        li.appendChild(timeSpan);
        li.appendChild(bodyDiv);
        li.appendChild(extLink);

        function triggerChapter() {
          selectChapter(cap.seconds, li);
        }

        li.addEventListener('click', triggerChapter);
        li.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            triggerChapter();
          }
        });

        chaptersList.appendChild(li);
      });

      if (emptyMsg) {
        if (count === 0) {
          emptyMsg.style.display = 'block';
        } else {
          emptyMsg.style.display = 'none';
        }
      }
    }

    function selectChapter(seconds, element) {
      var allItems = chaptersList.querySelectorAll('.live-chapter-item');
      allItems.forEach(function (el) { el.classList.remove('is-active'); });
      if (element) element.classList.add('is-active');

      if (!isPlayerLoaded) {
        pendingSeconds = seconds;
        loadPlayer(seconds);
      } else if (playerIframe && playerIframe.contentWindow) {
        // Enviar comando seekTo para IFrame do YouTube
        playerIframe.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'seekTo', args: [seconds, true] }),
          '*'
        );
        playerIframe.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
          '*'
        );
      }

      // Scroll suave até o player se estiver em mobile
      if (window.innerWidth < 992 && playerContainer) {
        playerContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    function loadPlayer(startAtSeconds) {
      if (isPlayerLoaded) return;
      isPlayerLoaded = true;

      var origin = window.location.origin || (window.location.protocol + '//' + window.location.host);
      var src = 'https://www.youtube-nocookie.com/embed/AtIvlc62KgI?enablejsapi=1&origin=' + encodeURIComponent(origin);
      if (startAtSeconds) {
        src += '&start=' + startAtSeconds + '&autoplay=1';
      }

      playerIframe = document.createElement('iframe');
      playerIframe.setAttribute('src', src);
      playerIframe.setAttribute('title', 'Live de Embarque Kriativos On Board 2026');
      playerIframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
      playerIframe.setAttribute('allowfullscreen', 'true');

      if (playerFacade) playerFacade.style.display = 'none';
      if (playerContainer) {
        playerContainer.innerHTML = '';
        playerContainer.appendChild(playerIframe);
        playerContainer.style.display = 'block';
      }
    }

    if (loadPlayerBtn) {
      loadPlayerBtn.addEventListener('click', function () {
        loadPlayer(pendingSeconds || 833);
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', function () {
        renderChapters(searchInput.value);
      });
    }

    renderChapters('');
  }

  // --------------------------------------------------------------------------
  // ATENDIMENTO HUMANO & FORMULÁRIO MODAL (#21)
  // --------------------------------------------------------------------------
  function initSupportModal() {
    var modal = document.getElementById('supportModal');
    var openBtns = document.querySelectorAll('[data-open-support-modal]');
    var closeBtn = document.getElementById('supportModalCloseBtn');
    var form = document.getElementById('supportForm');
    var msgInput = document.getElementById('supportMsgInput');
    var charCount = document.getElementById('supportCharCount');
    var statusBox = document.getElementById('supportStatusBox');
    var submitBtn = document.getElementById('supportSubmitBtn');

    if (!modal) return;

    var lastFocusedElement = null;

    function openModal() {
      lastFocusedElement = document.activeElement;
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';

      var firstInput = modal.querySelector('input, textarea, button');
      if (firstInput) firstInput.focus();

      document.addEventListener('keydown', handleTrapFocus);
    }

    function closeModal() {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleTrapFocus);

      if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
        lastFocusedElement.focus();
      }
    }

    function handleTrapFocus(e) {
      if (e.key === 'Escape') {
        closeModal();
        return;
      }

      if (e.key === 'Tab') {
        var focusables = modal.querySelectorAll('input:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href]');
        if (!focusables.length) return;
        var first = focusables[0];
        var last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    openBtns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        openModal();
      });
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', closeModal);
    }

    modal.addEventListener('click', function (e) {
      if (e.target === modal) {
        closeModal();
      }
    });

    // Contador de caracteres da mensagem
    if (msgInput && charCount) {
      msgInput.addEventListener('input', function () {
        var remaining = 2000 - msgInput.value.length;
        charCount.textContent = msgInput.value.length + ' / 2000';
      });
    }

    // Submissão do formulário
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();

        var name = (document.getElementById('supportNameInput') || {}).value || '';
        var email = (document.getElementById('supportEmailInput') || {}).value || '';
        var whatsapp = (document.getElementById('supportWhatsappInput') || {}).value || '';
        var message = msgInput ? msgInput.value : '';

        var optEmail = (document.getElementById('newsletterEmailOpt') || {}).checked || false;
        var optWhatsapp = (document.getElementById('newsletterWhatsappOpt') || {}).checked || false;

        // Validações básicas
        if (!name.trim()) {
          showStatus('Informe seu nome.', 'error');
          return;
        }

        if (!email.trim() || email.indexOf('@') === -1 || email.indexOf('.') === -1) {
          showStatus('Informe um e-mail válido para receber a resposta.', 'error');
          return;
        }

        if (!message.trim()) {
          showStatus('Escreva sua dúvida.', 'error');
          return;
        }

        if (message.length > 2000) {
          showStatus('Sua mensagem deve ter até 2.000 caracteres.', 'error');
          return;
        }

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Enviando sua dúvida…';
        }

        var payload = {
          name: name.trim(),
          email: email.trim(),
          whatsapp: whatsapp.trim(),
          message: message.trim(),
          newsletter: { email: optEmail, whatsapp: optWhatsapp },
          timestamp: new Date().toISOString()
        };

        fetch('/api/embarcados-contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
          .then(function (res) {
            if (res.ok) {
              return res.json().catch(function () { return {}; });
            }
            throw new Error(res.status.toString());
          })
          .then(function () {
            showStatus('Sua dúvida foi recebida pela equipe. A resposta será enviada ao contato informado.', 'success');
            form.reset();
            if (charCount) charCount.textContent = '0 / 2000';
          })
          .catch(function (err) {
            // Se o endpoint não estiver configurado (ex.: 404 em ambiente de preview/locaweb), informar os canais alternativos com elegância
            showStatus(
              'O formulário ainda não está disponível. Use os canais de contato abaixo (WhatsApp Royal Trip ou organização) para tirar sua dúvida.',
              'error'
            );
          })
          .finally(function () {
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Enviar dúvida à equipe';
            }
          });
      });
    }

    function showStatus(text, type) {
      if (!statusBox) return;
      statusBox.textContent = text;
      statusBox.className = 'form-status-box form-status-box--' + type;
      statusBox.style.display = 'block';
      statusBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // --------------------------------------------------------------------------
  // ABAS DO CHECKLIST (#18 UX OPTIMIZATION)
  // --------------------------------------------------------------------------
  function initChecklistTabs() {
    var tabs = document.querySelectorAll('.checklist-tab');
    var groups = document.querySelectorAll('.checklist-group');
    if (!tabs.length || !groups.length) return;

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) {
          t.classList.remove('is-active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('is-active');
        tab.setAttribute('aria-selected', 'true');

        var targetGroup = tab.getAttribute('data-group');
        groups.forEach(function (group) {
          if (targetGroup === 'all' || group.getAttribute('data-group-id') === targetGroup) {
            group.classList.remove('is-hidden');
          } else {
            group.classList.add('is-hidden');
          }
        });
      });
    });
  }

  // --------------------------------------------------------------------------
  // ABAS DO CRONOGRAMA (#19 UX OPTIMIZATION)
  // --------------------------------------------------------------------------
  function initTimelineTabs() {
    var tabs = document.querySelectorAll('.timeline-tab');
    var steps = document.querySelectorAll('.timeline-step');
    if (!tabs.length || !steps.length) return;

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) {
          t.classList.remove('is-active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('is-active');
        tab.setAttribute('aria-selected', 'true');

        var targetPhase = tab.getAttribute('data-phase');
        steps.forEach(function (step) {
          if (targetPhase === 'all' || step.getAttribute('data-timeline-phase') === targetPhase) {
            step.classList.remove('is-hidden');
          } else {
            step.classList.add('is-hidden');
          }
        });
      });
    });
  }

  // --------------------------------------------------------------------------
  // FERRAMENTAS DO FAQ (EXPANDIR/RECOLHER TUDO)
  // --------------------------------------------------------------------------
  function initFAQTools() {
    var expandBtn = document.querySelector('[data-faq-action="expand-all"]');
    var collapseBtn = document.querySelector('[data-faq-action="collapse-all"]');
    var faqItems = document.querySelectorAll('#duvidas details.faq-item');

    if (expandBtn) {
      expandBtn.addEventListener('click', function () {
        faqItems.forEach(function (item) {
          if (item.style.display !== 'none') {
            item.open = true;
          }
        });
      });
    }

    if (collapseBtn) {
      collapseBtn.addEventListener('click', function () {
        faqItems.forEach(function (item) {
          item.open = false;
        });
      });
    }
  }

  // --------------------------------------------------------------------------
  // ATIVAÇÃO DE LINKS DE NAVEGAÇÃO AO ROLAR (INTERSECTION OBSERVER)
  // --------------------------------------------------------------------------
  function initNavSpy() {
    var navLinks = document.querySelectorAll('.guide-nav-bar__link');
    var dockLinks = document.querySelectorAll('.guide-quick-dock__item');
    var sections = document.querySelectorAll('section[id]');
    if (!sections.length) return;

    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              var id = entry.target.getAttribute('id');
              navLinks.forEach(function (link) {
                var href = link.getAttribute('href');
                if (href === '#' + id) {
                  link.classList.add('is-active');
                } else {
                  link.classList.remove('is-active');
                }
              });
              dockLinks.forEach(function (dLink) {
                var dHref = dLink.getAttribute('href');
                if (dHref === '#' + id) {
                  dLink.classList.add('is-active');
                } else {
                  dLink.classList.remove('is-active');
                }
              });
            }
          });
        },
        { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
      );

      sections.forEach(function (sec) {
        observer.observe(sec);
      });
    }
  }

  // --------------------------------------------------------------------------
  // INICIALIZAÇÃO GERAL
  // --------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', function () {
    initCountdown();
    initChecklist();
    initChecklistTabs();
    initTimelineTabs();
    initFAQ();
    initFAQTools();
    initLiveModule();
    initSupportModal();
    initNavSpy();
  });
})();
