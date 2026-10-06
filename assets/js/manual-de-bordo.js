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
      if (completedMsg) {
        if (totalApplicable > 0 && checkedCount === totalApplicable) {
          completedMsg.classList.add('is-visible');
        } else {
          completedMsg.classList.remove('is-visible');
        }
      }

      // Atualizar a Sidebar retrátil
      if (sidebarController && typeof sidebarController.update === 'function') {
        sidebarController.update(checkedCount, totalApplicable, percentage);
      }
    }

    // Inicializar Sidebar Retrátil na Lateral Esquerda
    var sidebarController = initChecklistSidebar();

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
  function initChecklistSidebar() {
    var sidebarToggle = document.getElementById('checklistSidebarToggle');
    var sidebarToggleBadge = document.getElementById('checklistSidebarToggleBadge');
    var sidebarBackdrop = document.getElementById('checklistSidebarBackdrop');
    var sidebarAside = document.getElementById('checklistSidebar');
    var sidebarClose = document.getElementById('checklistSidebarClose');
    var sidebarProgressFill = document.getElementById('checklistSidebarProgressFill');
    var sidebarProgressText = document.getElementById('checklistSidebarProgressText');
    var sidebarList = document.getElementById('checklistSidebarList');
    var sidebarNavItems = document.querySelectorAll('.checklist-sidebar__nav-item');
    var sidebarProgressBar = document.getElementById('checklistSidebarProgressBar');

    if (!sidebarAside || !sidebarToggle || !sidebarList) {
      return null;
    }

    var lang = (document.documentElement.lang || 'pt-BR').toLowerCase();
    var isEn = lang.startsWith('en');
    var isEs = lang.startsWith('es');

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

    document.addEventListener('click', function (event) {
      if (!event.target.closest('[data-open-checklist]')) return;
      event.preventDefault();
      openSidebar();
    });
    function openFromHash() {
      if (location.hash === '#checklist' || location.hash === '#preparacao') openSidebar();
    }
    window.addEventListener('hashchange', openFromHash);
    openFromHash();

    // Filtragem de grupos dentro da Sidebar
    sidebarNavItems.forEach(function (navBtn) {
      navBtn.addEventListener('click', function () {
        sidebarNavItems.forEach(function (btn) { btn.classList.remove('is-active'); });
        navBtn.classList.add('is-active');

        document.dispatchEvent(new Event('checklist:close'));
        sidebarNavItems.forEach(function (button) { button.setAttribute('aria-pressed', String(button === navBtn)); });
        var filterGroup = navBtn.getAttribute('data-sidebar-group') || 'all';
        var sidebarItems = sidebarList.querySelectorAll('.checklist-group');

        sidebarItems.forEach(function (sItem) {
          var itemGroup = sItem.getAttribute('data-group-id');
          if (filterGroup === 'all' || itemGroup === filterGroup) {
            sItem.hidden = false;
          } else {
            sItem.hidden = true;
          }
        });
      });
    });

    // Função de atualização chamada por saveAndRefresh()
    return {
      update: function (checkedCount, totalApplicable, percentage) {
        // Atualizar badge do botão flutuante
        if (sidebarToggleBadge) {
          sidebarToggleBadge.textContent = checkedCount + '/' + totalApplicable;
        }

        // Atualizar barra de progresso da sidebar
        if (sidebarProgressFill) {
          sidebarProgressFill.style.transform = 'scaleX(' + (percentage / 100) + ')';
          sidebarProgressBar.setAttribute('aria-valuenow', String(percentage));
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


      }
    };
  }

  // --------------------------------------------------------------------------
  // Sincronização da altura do Header para posicionamento sticky perfeito
  // --------------------------------------------------------------------------
  function syncGuideHeaderHeight() {
    var header = document.querySelector('header.guide-header');
    if (header) {
      var h = header.offsetHeight;
      if (h) document.documentElement.style.setProperty('--guide-header-height', h + 'px');
    }
  }

  // --------------------------------------------------------------------------
  // FAQ DETALHADO (#20) — BUSCA & SCROLLSPY DE CATEGORIAS
  // --------------------------------------------------------------------------
  function initFAQ() {
    var searchInput = document.getElementById('faqSearchInput');
    var clearBtn = document.getElementById('faqClearBtn');
    var categoryLinks = Array.prototype.slice.call(document.querySelectorAll('#duvidas .faq-category-btn, #duvidas [data-faq-nav]'));
    var faqItems = document.querySelectorAll('#duvidas .faq-item');
    var emptyState = document.getElementById('faqEmptyState');
    var resultsCounter = document.getElementById('faqResultsCount');
    var faqContainer = document.querySelector('#duvidas .faq');
    var faqNav = document.querySelector('#duvidas .faq__nav');
    var panels = Array.prototype.slice.call(document.querySelectorAll('#duvidas .faq__panel'));

    if (!faqItems.length) return;

    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var mobileNav = window.matchMedia('(max-width: 900px)');
    var navSlideFrame = null;

    // Atualiza contadores dinamicamente em cada link de categoria
    categoryLinks.forEach(function (link) {
      var cat = link.getAttribute('data-category');
      var countEl = link.querySelector('.faq__nav-count');
      if (countEl && cat) {
        var count = 0;
        faqItems.forEach(function (item) {
          if (item.getAttribute('data-category') === cat) count++;
        });
        countEl.textContent = count.toString();
      }
    });

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

    function setActiveCategory(catId) {
      var activeLink = null;
      categoryLinks.forEach(function (link, index) {
        var linkCat = link.getAttribute('data-category');
        var linkHref = link.getAttribute('href');
        var active = (linkCat === catId || linkHref === '#' + catId || linkHref === '#faq-' + catId);
        link.classList.toggle('is-active', active);
        if (active) {
          activeLink = link;
          link.setAttribute('aria-current', 'true');
          if (faqContainer && categoryLinks.length > 1) {
            var ratio = index / (categoryLinks.length - 1);
            faqContainer.style.setProperty('--faq-progress', (ratio * 100) + '%');
          }
        } else {
          link.removeAttribute('aria-current');
        }
      });
      if (activeLink) {
        keepActiveVisible(activeLink);
      }
    }

    // Scrollspy via IntersectionObserver sincronizado com as categorias
    if ('IntersectionObserver' in window && panels.length) {
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var cat = entry.target.getAttribute('data-category') || entry.target.id.replace(/^faq-/, '');
            setActiveCategory(cat);
          }
        });
      }, {
        rootMargin: '-30% 0px -55% 0px',
        threshold: 0
      });
      panels.forEach(function (panel) {
        spy.observe(panel);
      });
    }

    // Clique com âncora suave nos links da barra de categorias
    categoryLinks.forEach(function (link) {
      link.addEventListener('click', function (e) {
        var targetHref = link.getAttribute('href');
        var targetEl = targetHref ? document.querySelector(targetHref) : null;
        if (!targetEl) return;
        e.preventDefault();

        // Se o painel de destino estiver recolhido, expande automaticamente
        if (targetEl.classList.contains('is-collapsed')) {
          targetEl.classList.remove('is-collapsed');
          var toggle = targetEl.querySelector('.faq__panel-toggle');
          if (toggle) toggle.setAttribute('aria-expanded', 'true');
        }

        var cat = link.getAttribute('data-category') || targetEl.id.replace(/^faq-/, '');
        setActiveCategory(cat);
        targetEl.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });

        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '', targetHref);
        }
      });
    });

    // Botões de recolher / expandir seção inteira (.faq__panel-toggle)
    function togglePanel(toggle) {
      if (!toggle) return;
      var panel = toggle.closest('.faq__panel');
      if (!panel) return;
      var isCollapsed = panel.classList.toggle('is-collapsed');
      toggle.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');

      var currentLabel = toggle.getAttribute('aria-label') || '';
      var currentTitle = toggle.getAttribute('title') || '';
      if (isCollapsed) {
        toggle.setAttribute('aria-label', currentLabel.replace(/Recolher/i, 'Expandir').replace(/Collapse/i, 'Expand').replace(/Plegar/i, 'Desplegar'));
        toggle.setAttribute('title', currentTitle.replace(/Recolher/i, 'Expandir').replace(/Collapse/i, 'Expand').replace(/Plegar/i, 'Desplegar'));
      } else {
        toggle.setAttribute('aria-label', currentLabel.replace(/Expandir/i, 'Recolher').replace(/Expand/i, 'Collapse').replace(/Desplegar/i, 'Plegar'));
        toggle.setAttribute('title', currentTitle.replace(/Expandir/i, 'Recolher').replace(/Expand/i, 'Collapse').replace(/Desplegar/i, 'Plegar'));
      }
    }

    var panelToggles = document.querySelectorAll('#duvidas .faq__panel-toggle');
    panelToggles.forEach(function (toggle) {
      toggle.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        togglePanel(toggle);
      });
    });

    function filterFAQ() {
      var query = searchInput ? normalizeText(searchInput.value) : '';
      var visibleCount = 0;

      faqItems.forEach(function (item) {
        var titleEl = item.querySelector('.faq-item__summary-title');
        var textEl = item.querySelector('.faq-item__content');
        var id = item.getAttribute('id') || '';

        var textContent = (titleEl ? titleEl.textContent : '') + ' ' + (textEl ? textEl.textContent : '') + ' ' + id;
        var normalizedContent = normalizeText(textContent);

        var matchesQuery = !query || normalizedContent.indexOf(query) !== -1;

        if (matchesQuery) {
          item.style.display = '';
          visibleCount++;
          if (query.length >= 3) {
            item.setAttribute('open', '');
          }
        } else {
          item.style.display = 'none';
        }
      });

      panels.forEach(function (panel) {
        var itemsInPanel = panel.querySelectorAll('.faq-item');
        var hasVisibleItems = false;
        itemsInPanel.forEach(function (item) {
          if (item.style.display !== 'none') {
            hasVisibleItems = true;
          }
        });
        if (hasVisibleItems) {
          panel.style.display = '';
          // Quando houver pesquisa ativa, reabre a seção para mostrar o resultado encontrado
          if (query) {
            panel.classList.remove('is-collapsed');
            var toggle = panel.querySelector('.faq__panel-toggle');
            if (toggle) toggle.setAttribute('aria-expanded', 'true');
          }
        } else {
          panel.style.display = 'none';
        }
      });

      // Oculta links do menu de seções sem itens durante a pesquisa
      categoryLinks.forEach(function (link) {
        var href = link.getAttribute('href');
        var targetPanel = href ? document.querySelector(href) : null;
        if (targetPanel && query) {
          link.style.display = targetPanel.style.display === 'none' ? 'none' : '';
        } else {
          link.style.display = '';
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

    function updateClearBtnVisibility() {
      if (clearBtn && searchInput) {
        if (searchInput.value.trim().length > 0) {
          clearBtn.classList.add('is-visible');
        } else {
          clearBtn.classList.remove('is-visible');
        }
      }
    }

    if (searchInput) {
      searchInput.addEventListener('input', function () {
        updateClearBtnVisibility();
        filterFAQ();
      });

      document.addEventListener('keydown', function (event) {
        if ((event.metaKey || event.ctrlKey) && event.key && event.key.toLowerCase() === 'k') {
          event.preventDefault();
          searchInput.focus();
          searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        if (event.key === 'Escape' && document.activeElement === searchInput && searchInput.value) {
          if (clearBtn) clearBtn.click();
        }
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        if (searchInput) {
          searchInput.value = '';
        }
        updateClearBtnVisibility();
        filterFAQ();
        if (searchInput) searchInput.focus();
      });
    }

    // Abrir âncora direta (ex: #faq-o12)
    function checkHashTarget() {
      var hash = window.location.hash;
      if (hash && hash.startsWith('#faq-')) {
        var targetEl = document.querySelector(hash);
        if (targetEl) {
          if (targetEl.tagName.toLowerCase() === 'details') {
            var parentPanel = targetEl.closest('.faq__panel');
            if (parentPanel && parentPanel.classList.contains('is-collapsed')) {
              parentPanel.classList.remove('is-collapsed');
              var toggle = parentPanel.querySelector('.faq__panel-toggle');
              if (toggle) toggle.setAttribute('aria-expanded', 'true');
            }
            targetEl.setAttribute('open', '');
            setTimeout(function () {
              targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
              var summary = targetEl.querySelector('summary');
              if (summary) summary.focus();
            }, 200);
          } else if (targetEl.classList.contains('faq__panel')) {
            var cat = targetEl.getAttribute('data-category') || targetEl.id.replace(/^faq-/, '');
            setActiveCategory(cat);
          }
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
  // CRONOGRAMA (#19) — NAVEGAÇÃO POR FASES, SCROLLSPY & RECOLHIMENTO
  // --------------------------------------------------------------------------
  function initTimelineTabs() {
    var tabsNav = document.querySelector('#cronograma .timeline-tabs');
    var tabs = Array.prototype.slice.call(document.querySelectorAll('#cronograma .timeline-tab, #cronograma [data-timeline-nav]'));
    var groups = Array.prototype.slice.call(document.querySelectorAll('#cronograma .timeline-group'));
    var toggles = Array.prototype.slice.call(document.querySelectorAll('#cronograma .timeline-group__toggle'));

    if (!tabs.length || !groups.length) return;

    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var mobileNav = window.matchMedia('(max-width: 900px)');
    var tabSlideFrame = null;

    function keepActiveTabVisible(tab) {
      if (!tabsNav || !tab || !mobileNav.matches) return;
      if (tabSlideFrame) cancelAnimationFrame(tabSlideFrame);
      tabSlideFrame = requestAnimationFrame(function () {
        tabSlideFrame = null;
        var navRect = tabsNav.getBoundingClientRect();
        var tabRect = tab.getBoundingClientRect();
        var edge = 12;
        if (tabRect.left >= navRect.left + edge && tabRect.right <= navRect.right - edge) return;
        var centered = tabsNav.scrollLeft + tabRect.left - navRect.left - ((navRect.width - tabRect.width) / 2);
        var max = Math.max(0, tabsNav.scrollWidth - tabsNav.clientWidth);
        tabsNav.scrollTo({
          left: Math.max(0, Math.min(centered, max)),
          behavior: reduce ? 'auto' : 'smooth'
        });
      });
    }

    function setActiveTimelinePhase(phaseId) {
      var activeTab = null;
      tabs.forEach(function (tab) {
        var tabPhase = tab.getAttribute('data-phase');
        var tabHref = tab.getAttribute('href');
        var active = (tabPhase === phaseId || tabHref === '#' + phaseId || tabHref === '#cronograma-' + phaseId);
        tab.classList.toggle('is-active', active);
        if (active) {
          activeTab = tab;
          tab.setAttribute('aria-current', 'true');
        } else {
          tab.removeAttribute('aria-current');
        }
      });
      if (activeTab) {
        keepActiveTabVisible(activeTab);
      }
    }

    // Scrollspy via IntersectionObserver sincronizado com as fases
    if ('IntersectionObserver' in window && groups.length) {
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var phase = entry.target.getAttribute('data-phase') || entry.target.id.replace(/^cronograma-/, '');
            setActiveTimelinePhase(phase);
          }
        });
      }, {
        rootMargin: '-30% 0px -55% 0px',
        threshold: 0
      });
      groups.forEach(function (group) {
        spy.observe(group);
      });
    }

    // Clique com âncora suave nos links da barra de etapas
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function (e) {
        var targetHref = tab.getAttribute('href');
        var targetEl = targetHref ? document.querySelector(targetHref) : null;
        if (!targetEl) return;
        e.preventDefault();

        // Se o grupo de destino estiver recolhido, expande automaticamente
        if (targetEl.classList.contains('is-collapsed')) {
          targetEl.classList.remove('is-collapsed');
          var toggle = targetEl.querySelector('.timeline-group__toggle');
          if (toggle) toggle.setAttribute('aria-expanded', 'true');
        }

        var phase = tab.getAttribute('data-phase') || targetEl.id.replace(/^cronograma-/, '');
        setActiveTimelinePhase(phase);
        targetEl.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });

        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '', targetHref);
        }
      });
    });

    // Botões de recolher / expandir etapa inteira (.timeline-group__toggle)
    function toggleTimelineGroup(toggle) {
      if (!toggle) return;
      var group = toggle.closest('.timeline-group');
      if (!group) return;
      var isCollapsed = group.classList.toggle('is-collapsed');
      toggle.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');

      var currentLabel = toggle.getAttribute('aria-label') || '';
      var currentTitle = toggle.getAttribute('title') || '';
      if (isCollapsed) {
        toggle.setAttribute('aria-label', currentLabel.replace(/Recolher/i, 'Expandir').replace(/Collapse/i, 'Expand').replace(/Plegar/i, 'Desplegar'));
        toggle.setAttribute('title', currentTitle.replace(/Recolher/i, 'Expandir').replace(/Collapse/i, 'Expand').replace(/Plegar/i, 'Desplegar'));
      } else {
        toggle.setAttribute('aria-label', currentLabel.replace(/Expandir/i, 'Recolher').replace(/Expand/i, 'Collapse').replace(/Desplegar/i, 'Plegar'));
        toggle.setAttribute('title', currentTitle.replace(/Expandir/i, 'Recolher').replace(/Expand/i, 'Collapse').replace(/Desplegar/i, 'Plegar'));
      }
    }

    toggles.forEach(function (toggle) {
      toggle.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        toggleTimelineGroup(toggle);
      });
    });
  }

  // --------------------------------------------------------------------------
  // ANIMAÇÃO DE PROGRESSO DA TIMELINE AO LONGO DO SCROLL (.timeline-step::before)
  // --------------------------------------------------------------------------
  function initTimelineScrollProgress() {
    var timeline = document.querySelector('#cronograma .timeline');
    var steps = Array.prototype.slice.call(document.querySelectorAll('#cronograma .timeline-step'));
    if (!timeline || !steps.length) return;

    var ticking = false;

    function updateStepsProgress() {
      ticking = false;
      // Linha focal de leitura: 52% da janela (onde o olho do leitor foca ao rolar)
      var triggerPoint = window.innerHeight * 0.52;
      var currentStep = null;
      var passedSteps = [];

      for (var i = 0; i < steps.length; i++) {
        var step = steps[i];
        // Se a seção/fase pai estiver recolhida ou oculta, pula
        if (step.offsetParent === null) continue;

        var rect = step.getBoundingClientRect();
        // O topo do card já alcançou ou passou da linha focal de leitura?
        if (rect.top <= triggerPoint) {
          passedSteps.push(step);
          if (rect.bottom > triggerPoint * 0.35) {
            currentStep = step;
          }
        }
      }

      // Se nenhum passou da linha ainda, mas o cronograma já começou a entrar na tela,
      // ativa o primeiro card visível para guiar a largada
      if (passedSteps.length === 0) {
        var firstVisible = null;
        for (var j = 0; j < steps.length; j++) {
          if (steps[j].offsetParent !== null) {
            firstVisible = steps[j];
            break;
          }
        }
        if (firstVisible) {
          var fRect = firstVisible.getBoundingClientRect();
          if (fRect.top < window.innerHeight * 0.82 && fRect.bottom > 0) {
            passedSteps.push(firstVisible);
            currentStep = firstVisible;
          }
        }
      } else if (!currentStep && passedSteps.length > 0) {
        currentStep = passedSteps[passedSteps.length - 1];
      }

      // Atualiza classes nos cards
      for (var k = 0; k < steps.length; k++) {
        var s = steps[k];
        var isPassed = passedSteps.indexOf(s) !== -1;
        var isCurrent = (s === currentStep);

        s.classList.toggle('is-reached', isPassed);
        s.classList.toggle('is-current', isCurrent);
      }
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(updateStepsProgress);
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    // Atualiza imediatamente na inicialização
    updateStepsProgress();

    // Também recalcula quando o usuário expande/recolhe etapas
    var toggles = document.querySelectorAll('#cronograma .timeline-group__toggle');
    toggles.forEach(function (btn) {
      btn.addEventListener('click', function () {
        setTimeout(updateStepsProgress, 60);
      });
    });

    // E quando clica nas abas de fase
    var tabs = document.querySelectorAll('#cronograma .timeline-tab');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        setTimeout(updateStepsProgress, 250);
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
    var panels = document.querySelectorAll('#duvidas .faq__panel');
    var panelToggles = document.querySelectorAll('#duvidas .faq__panel-toggle');

    if (expandBtn) {
      expandBtn.addEventListener('click', function () {
        panels.forEach(function (panel) {
          panel.classList.remove('is-collapsed');
        });
        panelToggles.forEach(function (toggle) {
          toggle.setAttribute('aria-expanded', 'true');
        });
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
    syncGuideHeaderHeight();
    window.addEventListener('resize', syncGuideHeaderHeight);
    initCountdown();
    initChecklist();
    initTimelineTabs();
    initTimelineScrollProgress();
    initFAQ();
    initFAQTools();
    initSupportModal();
    initDrawer();
    initNavSpy();
  });
})();
