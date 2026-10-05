/**
 * Kriativos On Board 2026 — Guia de Quem Já Reservou (Embarcados)
 * JavaScript modular, acessível e resiliente a falhas de rede/storage.
 */

(function () {
  'use strict';

  function normalizeText(str) {
    if (!str) return '';
    return str
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'«»]/g, ' ')
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .trim();
  }

  // Helper de escape para segurança de injeção HTML
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function createAccentInsensitiveRegex(query) {
    if (!query) return null;
    var norm = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    if (!norm) return null;

    var pattern = '';
    for (var i = 0; i < norm.length; i++) {
      var ch = norm[i];
      if (ch === 'a') pattern += '[aáàãâä]';
      else if (ch === 'e') pattern += '[eéèêë]';
      else if (ch === 'i') pattern += '[iíìîï]';
      else if (ch === 'o') pattern += '[oóòõôö]';
      else if (ch === 'u') pattern += '[uúùûü]';
      else if (ch === 'c') pattern += '[cç]';
      else if (/[0-9a-z]/i.test(ch)) pattern += escapeRegex(ch);
      else pattern += '\\s*';
    }
    try {
      return new RegExp('(' + pattern + ')', 'gi');
    } catch (e) {
      return null;
    }
  }

  function highlightMatch(text, query) {
    if (!text) return '';
    var escaped = escapeHtml(text);
    if (!query || !query.trim()) return escaped;
    var regex = createAccentInsensitiveRegex(query);
    if (!regex) return escaped;
    return escaped.replace(regex, '<mark class="search-highlight">$1</mark>');
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

      // Atualizar progresso no Boarding Pass da Hero (Slide 1)
      var heroBoardingText = document.getElementById('heroBoardingProgressText');
      var heroBoardingBar = document.getElementById('heroBoardingProgressBar');
      if (heroBoardingText) {
        if (isEn) {
          heroBoardingText.textContent = checkedCount + ' of ' + totalApplicable + ' ready';
        } else if (isEs) {
          heroBoardingText.textContent = checkedCount + ' de ' + totalApplicable + ' listos';
        } else {
          heroBoardingText.textContent = checkedCount + ' de ' + totalApplicable + ' concluídos';
        }
      }
      if (heroBoardingBar) {
        heroBoardingBar.style.width = percentage + '%';
        var heroBoardingBarWrap = heroBoardingBar.parentElement;
        if (heroBoardingBarWrap && heroBoardingBarWrap.getAttribute('role') === 'progressbar') {
          heroBoardingBarWrap.setAttribute('aria-valuenow', percentage.toString());
        }
      }

      // Atualizar a Sidebar retrátil
      if (sidebarController && typeof sidebarController.update === 'function') {
        sidebarController.update(checkedCount, totalApplicable, percentage, items);
      }
    }

    // Inicializar Sidebar Retrátil na Lateral Esquerda
    var sidebarController = initChecklistSidebar(items, function () {
      saveAndRefresh();
    });

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
  // SIDEBAR RETRÁTIL DO CHECKLIST (SLIDERBAR LATERAL ESQUERDA)
  // --------------------------------------------------------------------------
  function initChecklistSidebar(mainItems, onStateChange) {
    var sidebarToggle = document.getElementById('checklistSidebarToggle');
    var sidebarToggleBadge = document.getElementById('checklistSidebarToggleBadge');
    var sidebarBackdrop = document.getElementById('checklistSidebarBackdrop');
    var sidebarAside = document.getElementById('checklistSidebar');
    var sidebarClose = document.getElementById('checklistSidebarClose');
    var sidebarProgressFill = document.getElementById('checklistSidebarProgressFill');
    var sidebarProgressText = document.getElementById('checklistSidebarProgressText');
    var sidebarList = document.getElementById('checklistSidebarList');
    var sidebarNavItems = document.querySelectorAll('.checklist-sidebar__nav-item');
    var sidebarGotoBtn = document.getElementById('checklistSidebarGotoBtn');

    if (!sidebarAside || !sidebarToggle || !sidebarList) {
      return null;
    }

    var lang = (document.documentElement.lang || 'pt-BR').toLowerCase();
    var isEn = lang.startsWith('en');
    var isEs = lang.startsWith('es');

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function getTagLabel(type) {
      if (type === 'essential') return isEn ? 'Essential' : isEs ? 'Esencial' : 'Essencial';
      if (type === 'recommended') return isEn ? 'Recommended' : isEs ? 'Recomendado' : 'Recomendado';
      if (type === 'conditional') return isEn ? 'Conditional' : isEs ? 'Condicional' : 'Condicional';
      return isEn ? 'Optional' : isEs ? 'Opcional' : 'Opcional';
    }

    // Montar os itens compactos da sidebar espelhando a lista principal
    sidebarList.innerHTML = '';
    mainItems.forEach(function (mainItem) {
      var id = mainItem.getAttribute('data-checklist-id');
      if (!id) return;

      var type = mainItem.getAttribute('data-checklist-type') || 'essential';
      var groupEl = mainItem.closest('.checklist-group');
      var groupId = groupEl ? groupEl.getAttribute('data-group-id') || '1' : '1';

      var titleEl = mainItem.querySelector('.checklist-item__text');
      var titleText = titleEl ? titleEl.textContent.replace(/\s+/g, ' ').trim() : id;
      var tagLabel = getTagLabel(type);
      var mainNa = mainItem.querySelector('.checklist-item__na-checkbox');
      var helpLabel = isEn ? 'Guidance' : isEs ? 'Orientación' : 'Orientação';
      var naLabel = isEn ? 'Does not apply to me' : isEs ? 'No se aplica a mí' : 'Não se aplica a mim';

      var div = document.createElement('div');
      div.className = 'checklist-sidebar-item';
      div.setAttribute('data-sidebar-item-id', id);
      div.setAttribute('data-sidebar-group', groupId);

      div.innerHTML =
        '<input type="checkbox" class="checklist-sidebar-item__checkbox" id="sidebar_chk_' + escapeHtml(id) + '" aria-label="' + escapeHtml(titleText) + '">' +
        '<div class="checklist-sidebar-item__content">' +
          '<div class="checklist-sidebar-item__header">' +
            '<span class="checklist-sidebar-item__tag checklist-sidebar-item__tag--' + escapeHtml(type) + '">' + escapeHtml(tagLabel) + '</span>' +
            '<button type="button" class="checklist-help-trigger" data-checklist-help="' + escapeHtml(id) + '" aria-label="' + helpLabel + ': ' + escapeHtml(titleText) + '"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></svg></button>' +
          '</div>' +
          '<label for="sidebar_chk_' + escapeHtml(id) + '" class="checklist-sidebar-item__text">' + escapeHtml(titleText) + '</label>' +
          (mainNa ? '<label class="checklist-sidebar-item__na"><input type="checkbox" class="checklist-sidebar-item__na-checkbox"> ' + naLabel + '</label>' : '') +
        '</div>';

      sidebarList.appendChild(div);

      // Evento de clique / alteração na sidebar sincronizando com a página principal
      var sCheckbox = div.querySelector('.checklist-sidebar-item__checkbox');
      if (sCheckbox) {
        sCheckbox.addEventListener('change', function () {
          var mainCheckbox = mainItem.querySelector('.checklist-item__checkbox');
          if (mainCheckbox && !mainCheckbox.disabled) {
            mainCheckbox.checked = sCheckbox.checked;
            if (sCheckbox.checked) {
              mainItem.classList.add('is-checked');
              div.classList.add('is-checked');
            } else {
              mainItem.classList.remove('is-checked');
              div.classList.remove('is-checked');
            }
            if (typeof onStateChange === 'function') {
              onStateChange();
            }
          } else {
            // Se estava desabilitado (ex: N/A marcado na página principal), reverte o checkbox
            sCheckbox.checked = mainCheckbox ? mainCheckbox.checked : false;
          }
        });
      }

      var sidebarNa = div.querySelector('.checklist-sidebar-item__na-checkbox');
      if (sidebarNa) sidebarNa.addEventListener('change', function () {
        mainNa.checked = sidebarNa.checked;
        mainNa.dispatchEvent(new Event('change', { bubbles: true }));
      });

    });

    // Abrir e Fechar Sidebar
    function openSidebar() {
      sidebarAside.classList.add('is-open');
      sidebarAside.setAttribute('aria-hidden', 'false');
      sidebarAside.inert = false;
      if (sidebarBackdrop) {
        sidebarBackdrop.classList.add('is-open');
        sidebarBackdrop.setAttribute('aria-hidden', 'false');
      }
      sidebarToggle.setAttribute('aria-expanded', 'true');
      if (sidebarClose) sidebarClose.focus();
    }

    function closeSidebar() {
      sidebarAside.classList.remove('is-open');
      sidebarAside.setAttribute('aria-hidden', 'true');
      sidebarAside.inert = true;
      document.dispatchEvent(new Event('checklist:close'));
      if (sidebarBackdrop) {
        sidebarBackdrop.classList.remove('is-open');
        sidebarBackdrop.setAttribute('aria-hidden', 'true');
      }
      sidebarToggle.setAttribute('aria-expanded', 'false');
      sidebarToggle.focus();
    }

    sidebarToggle.addEventListener('click', function () {
      if (sidebarAside.classList.contains('is-open')) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });

    if (sidebarClose) {
      sidebarClose.addEventListener('click', closeSidebar);
    }

    if (sidebarBackdrop) {
      sidebarBackdrop.addEventListener('click', closeSidebar);
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !e.defaultPrevented && sidebarAside.classList.contains('is-open')) {
        closeSidebar();
      }
    });

    // Botão de rodapé "Ver Checklist Completo na Página"
    if (sidebarGotoBtn) {
      sidebarGotoBtn.addEventListener('click', function (e) {
        e.preventDefault();
        closeSidebar();
        var prepSection = document.getElementById('preparacao');
        if (prepSection) {
          prepSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }

    // Filtragem de grupos dentro da Sidebar
    sidebarNavItems.forEach(function (navBtn) {
      navBtn.addEventListener('click', function () {
        sidebarNavItems.forEach(function (btn) { btn.classList.remove('is-active'); });
        navBtn.classList.add('is-active');

        document.dispatchEvent(new Event('checklist:close'));
        sidebarNavItems.forEach(function (button) { button.setAttribute('aria-pressed', String(button === navBtn)); });
        var filterGroup = navBtn.getAttribute('data-sidebar-group') || 'all';
        var sidebarItems = sidebarList.querySelectorAll('.checklist-sidebar-item');

        sidebarItems.forEach(function (sItem) {
          var itemGroup = sItem.getAttribute('data-sidebar-group');
          if (filterGroup === 'all' || itemGroup === filterGroup) {
            sItem.style.display = 'flex';
          } else {
            sItem.style.display = 'none';
          }
        });
      });
    });

    // Função de atualização chamada por saveAndRefresh()
    return {
      update: function (checkedCount, totalApplicable, percentage, currentMainItems) {
        // Atualizar badge do botão flutuante
        if (sidebarToggleBadge) {
          sidebarToggleBadge.textContent = checkedCount + '/' + totalApplicable;
        }

        // Atualizar barra de progresso da sidebar
        if (sidebarProgressFill) {
          sidebarProgressFill.style.transform = 'scaleX(' + (percentage / 100) + ')';
        }

        // Atualizar texto de progresso da sidebar
        if (sidebarProgressText) {
          if (isEn) {
            sidebarProgressText.textContent = checkedCount + ' of ' + totalApplicable + ' completed';
          } else if (isEs) {
            sidebarProgressText.textContent = checkedCount + ' de ' + totalApplicable + ' verificados';
          } else {
            sidebarProgressText.textContent = checkedCount + ' de ' + totalApplicable + ' conferidos';
          }
        }

        // Atualizar o estado de cada checkbox e visual do item da sidebar
        currentMainItems.forEach(function (mainItem) {
          var id = mainItem.getAttribute('data-checklist-id');
          if (!id) return;

          var mainCheckbox = mainItem.querySelector('.checklist-item__checkbox');
          var mainNa = mainItem.querySelector('.checklist-item__na-checkbox');
          var isChecked = mainCheckbox ? mainCheckbox.checked : false;
          var isNa = mainNa ? mainNa.checked : false;

          var sItem = sidebarList.querySelector('[data-sidebar-item-id="' + id + '"]');
          if (sItem) {
            var sCheckbox = sItem.querySelector('.checklist-sidebar-item__checkbox');
            var sidebarNa = sItem.querySelector('.checklist-sidebar-item__na-checkbox');
            if (sidebarNa) sidebarNa.checked = isNa;
            if (sCheckbox) {
              sCheckbox.checked = isChecked;
              sCheckbox.disabled = isNa;
            }
            if (isChecked) {
              sItem.classList.add('is-checked');
            } else {
              sItem.classList.remove('is-checked');
            }
            if (isNa) {
              sItem.classList.add('is-not-applicable');
            } else {
              sItem.classList.remove('is-not-applicable');
            }
          }
        });
      }
    };
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
    var navLinks = document.querySelectorAll('.guide-nav-bar__link, #drawer nav a');
    if (!navLinks.length) return;

    var targets = [];
    navLinks.forEach(function (link) {
      var href = link.getAttribute('href');
      if (href && href.startsWith('#')) {
        var el = document.querySelector(href);
        if (el && targets.indexOf(el) === -1) targets.push(el);
      }
    });
    if (!targets.length) return;

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
            }
          });
        },
        { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
      );

      targets.forEach(function (target) {
        observer.observe(target);
      });
    }
  }

  // --------------------------------------------------------------------------
  // MENU SANDUÍCHE / DRAWER DE NAVEGAÇÃO (IGUAL À HOME)
  // --------------------------------------------------------------------------
  function initDrawer() {
    var drawer = document.getElementById('drawer');
    var toggle = document.getElementById('navToggle');
    var closeBtn = document.getElementById('drawerClose');
    var backdrop = document.getElementById('guideDrawerBackdrop');
    if (!drawer || !toggle) return;

    function openDrawer() {
      drawer.dataset.open = 'true';
      drawer.setAttribute('aria-hidden', 'false');
      drawer.removeAttribute('inert');
      toggle.setAttribute('aria-expanded', 'true');
      if (backdrop) {
        backdrop.dataset.open = 'true';
        backdrop.setAttribute('aria-hidden', 'false');
      }
      document.body.style.overflow = 'hidden';
      setInert(true);
      if (closeBtn) closeBtn.focus();
    }

    function closeDrawer() {
      drawer.dataset.open = 'false';
      drawer.setAttribute('aria-hidden', 'true');
      drawer.setAttribute('inert', '');
      toggle.setAttribute('aria-expanded', 'false');
      if (backdrop) {
        backdrop.dataset.open = 'false';
        backdrop.setAttribute('aria-hidden', 'true');
      }
      document.body.style.overflow = '';
      setInert(false);
      toggle.focus();
    }

    function setInert(on) {
      ['main', 'header.guide-header', 'footer'].forEach(function (sel) {
        var el = document.querySelector(sel);
        if (!el) return;
        if (on) el.setAttribute('inert', ''); else el.removeAttribute('inert');
      });
    }

    toggle.addEventListener('click', openDrawer);
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (backdrop) backdrop.addEventListener('click', closeDrawer);
    drawer.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', closeDrawer);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.dataset.open === 'true') closeDrawer();
    });
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
    initSupportModal();
    initDrawer();
    initNavSpy();
  });
})();
