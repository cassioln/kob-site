(function () {
  'use strict';
  var API = '/api/bus-boarding';
  var CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
  var UNCHECKED = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="4"/></svg>';
  var SPINNER = '<svg class="embarque-person__status-icon embarque-person__spinner" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M21 12a9 9 0 0 0-9-9"/></svg>';
  var NO_SIGNAL = '<svg class="embarque-person__status-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h.01M8.5 16.43a5 5 0 0 1 7 0M5 12.86a10 10 0 0 1 5.17-2.69M19 12.86a10 10 0 0 0-2-1.52M2 8.82a15 15 0 0 1 4.18-2.64M22 8.82a15 15 0 0 0-11.29-3.76M2 2l20 20"/></svg>';

  window.KobBoarding = function (root) {
    var opener = document.getElementById('embarque-open');
    var messages = window.KobBoardingMessages;
    var requested = new URLSearchParams(window.location.search).get('lang') || document.documentElement.lang.slice(0, 2);
    var lang = messages[requested] ? requested : 'pt';
    var locale = { pt: 'pt-BR', en: 'en-US', es: 'es' };
    var people = [], token = '', timer = null;
    var leg = 'outbound', bus = 'all', filter = 'all', query = '';
    var pending = new Set(), controllers = new Set();
    var loading = false, ready = false, stale = false, lastSync = null, noticeKey = '';
    var autoOpened = false, closeTimer = null, exporter = null, busPicker = null, offlineAccess = null;
    var queueState = { pending: [], confirmed: [], sending: '', durable: false, online: false, waiting: 0 }, localPending = new Set(), deferredFocus = null;
    var alerted = new Set(), noticesHtml = '', settled = false;
    var compactBuses = window.matchMedia('(max-width: 374px)');
    var meeple = document.querySelector('.bus-dialog__badge-icone--vip svg').innerHTML;
    var $ = function (id) { return root.querySelector('#embarque-' + id); };
    var t = function (key, values) {
      if (values && values.count !== undefined && messages[lang][key + '_one']) {
        key += Number(values.count) === 1 ? '_one' : '_other';
      }
      return messages[lang][key].replace(/\{(\w+)\}/g, function (_, name) { return String(values[name]); });
    };
    function esc(value) {
      return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
      });
    }
    function normalize(value) {
      return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase(locale[lang]);
    }
    function time(value) {
      return new Intl.DateTimeFormat(locale[lang], { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value));
    }
    function onBoard(person) { return Boolean(person[leg] && person[leg].present); }
    function count(list) { return list.filter(onBoard).length; }
    function progress(list) { return t('progress', { present: count(list), total: list.length }); }
    function selectedPeople() {
      return people.filter(function (p) { return bus === 'all' || String(p.bus_number) === bus; });
    }
    function solo(person) {
      return !person.vip && people.filter(function (p) { return p.registration_id === person.registration_id; }).length === 1;
    }
    function groupIcon(kind) {
      return '<svg class="embarque-group__meeple embarque-group__meeple--' + kind + '" viewBox="0 0 512 512" aria-hidden="true">' + meeple + '</svg>';
    }
    // Região viva: limpa e escreve no quadro seguinte para repetir um anúncio idêntico.
    var announceFrame = 0;
    function announce(text) {
      cancelAnimationFrame(announceFrame);
      $('announcement').textContent = '';
      announceFrame = requestAnimationFrame(function () { $('announcement').textContent = text; });
    }
    function setNotice(key) {
      noticeKey = key;
      renderNotices();
    }
    // Um só estado de rede alimenta a cor da nuvem, o topo do menu e o texto de cada linha.
    function network() {
      if (!navigator.onLine) return 'offline';
      if (!stale) return 'online';
      // Até a primeira leitura terminar não dá para dizer que a conexão está instável.
      return settled ? 'unstable' : 'connecting';
    }
    function syncStatus() {
      if (exporter) exporter.update(!ready || stale || !navigator.onLine || pending.size > 0 || people.length === 0);
      var key = queueState.authError ? 'expired' : !navigator.onLine ? 'offlineShort' : stale ? 'stale' : loading ? 'syncing' : lastSync ? 'synced' : 'loading';
      $('sync').textContent = t(key, { time: lastSync ? time(lastSync) : '' });
      $('sync').dataset.state = (!navigator.onLine || stale) ? 'warning' : 'ok';
      $('update').disabled = loading || !navigator.onLine;
      $('update').setAttribute('aria-busy', String(loading));
      var searchText = t(queueState.online ? 'search' : 'searchOffline');
      $('search').placeholder = searchText;
      root.querySelector('label[for="embarque-search"]').textContent = searchText;
      if (offlineAccess) offlineAccess.update(queueState);
      renderNotices();
    }
    function conflictNotice(op) {
      var person = queueState.confirmed.find(function (p) { return p.id === op.passenger_id; });
      var help = !person ? t('conflictRemoved') : op.conflict === 'bus' ? t('conflictBus', { number: person.bus_number }) : t('conflictHelp');
      // Sem rede o botão fica desabilitado de verdade. Durante a leitura de 8s só fica
      // aria-disabled, para o foco não pular para a nuvem quando a lista é redesenhada.
      var disabled = !queueState.online ? ' disabled' : loading ? ' aria-disabled="true"' : '';
      return { id: 'conflict:' + op.id, action: true, tone: 'warning', text: help, html: '<li class="embarque-notice-item" data-tone="warning" data-notice="conflict">' +
        '<span class="embarque-notice-item__eyebrow">' + esc(t('conflictNotice')) + '</span>' +
        '<strong>' + esc(op.name) + ' · ' + esc(t(op.leg)) + '</strong><p>' + esc(help) + '</p>' +
        '<p>' + esc(t('localChoice', { state: t(op.present ? 'present' : 'missing') })) +
        (person ? ' · ' + esc(t('serverChoice', { state: t(person[op.leg].present ? 'present' : 'missing') })) : '') + '</p>' +
        '<div class="embarque-conflict__actions"><button type="button" class="botao botao--secundario" data-resolve="server" data-operation="' + esc(op.id) + '"' +
        disabled + '>' + esc(t(person ? 'keepServer' : 'discardRemoved')) + '</button>' +
        (person ? '<button type="button" class="botao botao--primario" data-resolve="local" data-operation="' + esc(op.id) + '"' +
        disabled + '>' + esc(t('keepLocal')) + '</button>' : '') + '</div></li>' };
    }
    function simpleNotice(id, tone, text, action, button, help) {
      return { id: id, action: action, text: text, html: '<li class="embarque-notice-item" data-tone="' + tone + '" data-notice="' + id + '"><p>' + esc(text) + '</p>' +
        (help ? '<p class="embarque-notice-item__help">' + esc(help) + '</p>' : '') +
        (button ? '<button id="embarque-' + button + '" type="button" class="botao botao--secundario" data-notice-action="' + button + '">' + esc(t(button)) + '</button>' : '') + '</li>' };
    }
    // Dono único da central de avisos da nuvem: badge, ponto, rótulo, lista e pulso.
    function renderNotices() {
      var state = network(), list = [];
      var conflicts = queueState.pending.filter(function (op) { return op.conflict; });
      var queued = pending.size - conflicts.length;
      if (queueState.authError || noticeKey === 'expired') list.push(simpleNotice('expired', 'error', t('expired'), true, 'reauth'));
      if (queueState.storageError || noticeKey === 'storageError') list.push(simpleNotice('storageError', 'error', t('storageError'), true));
      if (noticeKey === 'firstConnection') list.push(simpleNotice('firstConnection', 'error', t('firstConnection'), true, 'retry'));
      conflicts.forEach(function (op) { list.push(conflictNotice(op)); });
      if (queued > 0) list.push(simpleNotice('queued', 'warning', t('queuedNotice', { count: queued }), false, '', t('queuedHelp')));
      if (queueState.waiting) list.push(simpleNotice('waiting', 'info', t('waiting', { count: queueState.waiting }), false, 'fleet'));
      var toggle = $('offline-toggle'), notices = $('notices');
      var statusText = state === 'offline' ? t('offlineShort') : state === 'unstable' ? t('connectionUnstable') :
        state === 'connecting' ? t('connectionChecking') : lastSync ? t('connectionOnline', { time: time(lastSync) }) : t('connectionOnlineShort');
      $('network').textContent = statusText;
      $('network').dataset.network = state;
      var help = ready && state === 'offline' ? t('networkOfflineHelp') : ready && state === 'unstable' ? t('networkUnstableHelp') : '';
      $('network-help').textContent = help;
      $('network-help').hidden = !help;
      var html = list.map(function (item) { return item.html; }).join('');
      if (html !== noticesHtml) {
        // Polling redesenha a lista; o foco volta ao botão equivalente.
        var active = document.activeElement, focusKey = notices.contains(active) ? active.dataset.operation ? active.dataset.resolve + ':' + active.dataset.operation : active.id : '';
        noticesHtml = html; notices.innerHTML = html;
        if (focusKey) {
          var target = Array.prototype.find.call(notices.querySelectorAll('button'), function (button) {
            return (button.dataset.operation ? button.dataset.resolve + ':' + button.dataset.operation : button.id) === focusKey;
          });
          (target && !target.disabled ? target : toggle).focus({ preventScroll: true });
        }
      }
      notices.hidden = !list.length;
      var badge = pending.size > 99 ? '99+' : String(pending.size);
      $('offline-badge').hidden = !pending.size;
      $('offline-badge').textContent = pending.size ? badge : '';
      $('offline-dot').hidden = !!pending.size || !list.length;
      toggle.dataset.network = state;
      toggle.dataset.notices = String(list.length);
      var others = list.filter(function (item) { return item.id !== 'queued'; }).length;
      var label = [t('offlineAccess'), statusText.split(' · ')[0]];
      // Mesmo número do badge (conflitos incluídos).
      if (pending.size) label.push(t('pendingCount', { count: pending.size }));
      if (others) label.push(t('noticeCount', { count: others }));
      toggle.setAttribute('aria-label', label.join(' · '));
      toggle.title = label.join(' · ');
      // Avisos que exigem ação pulsam a nuvem uma vez e são anunciados, sem abrir o menu.
      // A classe fica até o menu ser aberto (a animação roda uma só vez).
      var fresh = list.filter(function (item) { return item.action && !alerted.has(item.id); });
      alerted = new Set(list.filter(function (item) { return item.action; }).map(function (item) { return item.id; }));
      if (!alerted.size) toggle.classList.remove('is-alerting');
      if (fresh.length) {
        toggle.classList.remove('is-alerting'); void toggle.offsetWidth; toggle.classList.add('is-alerting');
        announce(fresh.map(function (item) { return item.text; }).join(' '));
      }
    }
    function translate() {
      root.lang = locale[lang];
      root.querySelectorAll('[data-boarding-text]').forEach(function (node) {
        node.textContent = t(node.dataset.boardingText);
      });
      root.querySelectorAll('[data-boarding-label]').forEach(function (node) {
        node.setAttribute('aria-label', t(node.dataset.boardingLabel));
        if (node.hasAttribute('title')) node.title = t(node.dataset.boardingLabel);
      });
      $('search').placeholder = t('search');
      opener.lang = locale[lang];
      opener.setAttribute('aria-label', t('open'));
      document.getElementById('embarque-launch-text').textContent = t('tab');
      noticesHtml = '';
      syncStatus();
    }
    function renderBuses() {
      var numbers = Array.from(new Set(people.map(function (p) { return p.bus_number; }))).sort(function (a, b) { return a - b; });
      if (bus !== 'all' && numbers.indexOf(Number(bus)) === -1) bus = 'all';
      var options = [{ value: 'all', name: t('allBuses') }].concat(numbers.map(function (number) {
        return { value: String(number), name: t('bus', { number: number }) };
      }));
      $('buses').innerHTML = options.map(function (item) {
        return '<option value="' + item.value + '" aria-label="' + esc(item.name) + '">' + esc(item.name) + '</option>';
      }).join('');
      updateBusLabel();
      $('buses').value = bus;
      $('buses').title = options.find(function (item) { return item.value === bus; }).name;
      if (busPicker) busPicker.refresh();
    }
    function updateBusLabel() {
      var all = $('buses').querySelector('option[value="all"]');
      if (all) all.label = t(compactBuses.matches ? 'allBusesCompact' : 'allBuses');
      if (busPicker) busPicker.refresh();
    }
    function renderSummary() {
      var list = selectedPeople(), present = count(list);
      var outboundPresent = list.filter(function (person) { return Boolean(person.outbound && person.outbound.present); }).length;
      var returnPresent = list.filter(function (person) { return Boolean(person.return && person.return.present); }).length;
      $('expected').textContent = list.length;
      $('present').textContent = present;
      $('missing').textContent = list.length - present;
      $('progress').max = list.length || 1;
      $('progress').value = returnPresent;
      $('progress').setAttribute('aria-label', t('return') + ': ' + t('progress', { present: returnPresent, total: list.length }));
      $('progress-outbound').max = list.length || 1;
      $('progress-outbound').value = outboundPresent;
      $('progress-outbound').setAttribute('aria-label', t('outbound') + ': ' + t('progress', { present: outboundPresent, total: list.length }));
      $('progress-outbound-label').textContent = t('outbound') + ': ' + outboundPresent + '/' + list.length;
      $('progress-return-label').textContent = t('return') + ': ' + returnPresent + '/' + list.length;
      $('progress-text').textContent = list.length && present === list.length ? t('complete') : progress(list);
      document.getElementById('embarque-launch-count').textContent = count(people) + '/' + people.length;
    }
    function passengerCheck(person, checkLeg) {
      var state = person[checkLeg], present = Boolean(state && state.present);
      var key = person.id + ':' + checkLeg;
      var active = checkLeg === leg, saving = queueState.sending === key || localPending.has(key);
      var queued = queueState.pending.find(function (op) { return op.passenger_id === person.id && op.leg === checkLeg; });
      var disabled = !active || saving || !!(queued && queued.conflict) || queueState.authError || !queueState.durable;
      return '<button type="button" class="embarque-check' + (active ? '' : ' is-inactive') + (queued ? ' is-queued' : '') +
        '" data-check-leg="' + checkLeg + '" ' + (active ? 'data-check' : 'data-inactive-check') + '="' + esc(person.id) +
        '" aria-pressed="' + present + '" aria-label="' + esc(t(present ? 'undoLabel' : 'saveLabel', { name: person.name, leg: t(checkLeg) }) + (queued ? ' · ' + t(queued.conflict ? 'conflictNotice' : queueText()) : '')) +
        '" aria-busy="' + saving + '"' + (disabled ? ' disabled' : '') + '>' + (present ? CHECK : UNCHECKED) +
        '<span>' + esc(t(checkLeg)) + '</span></button>';
    }
    // Fila parada (sem rede ou envio falhando) aguarda conexão; fila andando sincroniza.
    function queueText() { return /^(online|connecting)$/.test(network()) ? 'queueSyncing' : 'queueOffline'; }
    function passengerRow(person) {
      var present = onBoard(person), saving = queueState.sending === person.id + ':' + leg;
      var queued = queueState.pending.find(function (op) { return op.passenger_id === person.id && op.leg === leg; });
      var badges = [];
      if (person.vip || solo(person)) badges.push(t('group', { code: person.code }));
      if (person.lap_child) badges.push(t('lapChild'));
      else if (person.minor) badges.push(t('minor'));
      var subtitle = badges.join(' · ');
      var state = person[leg];
      // Conflito não anda sozinho: a linha aponta para o aviso da nuvem em vez de girar.
      var detail = queued && queued.conflict ? esc(t('conflictNotice')) :
        queued ? (queueText() === 'queueSyncing' ? SPINNER : NO_SIGNAL) + esc(t(queueText())) :
        esc(present && state.checked_at ? t('checkedAt', { time: time(state.checked_at) }) : t('pending'));
      // Names are text only; the passenger's database ID is the stable identity.
      return '<li class="embarque-person' + (present ? ' is-present' : '') + (queued ? ' is-queued' : '') + '" data-person="' + esc(person.id) + '" data-readonly="' + (saving || queueState.authError || !queueState.durable) + '">' +
        '<div class="embarque-person__info"><strong>' + (person.lap_child ? '<svg viewBox="0 0 512 512" width="14" height="14" class="meeple-svg meeple-svg--child embarque-person__child" focusable="false" aria-hidden="true">' + meeple + '</svg>' : '') + esc(person.name) + '</strong>' +
        (subtitle ? '<span class="embarque-person__meta">' + esc(subtitle) + '</span>' : '') +
        '<span class="embarque-person__detail">' + detail + '</span></div>' +
        '<div class="embarque-person__checks">' + passengerCheck(person, 'outbound') + passengerCheck(person, 'return') + '</div></li>';
    }
    function renderList() {
      var terms = normalize(query).trim().split(/\s+/).filter(Boolean);
      var scoped = selectedPeople();
      var visible = scoped.filter(function (person) {
        if (filter === 'missing' && onBoard(person) || filter === 'present' && !onBoard(person)) return false;
        var haystack = normalize([person.name, person.group, person.contact, person.code, person.cpf, person.vip ? t('vipGroup') : '',
          String(person.cpf || '').replace(/\D/g, '')].join(' '));
        return terms.every(function (term) { return haystack.indexOf(term) !== -1; });
      });
      var buses = new Map();
      visible.forEach(function (person) {
        if (!buses.has(person.bus_number)) buses.set(person.bus_number, new Map());
        var groups = buses.get(person.bus_number);
        var groupKey = person.vip ? 'vip' : solo(person) ? 'solo' : person.registration_id;
        if (!groups.has(groupKey)) groups.set(groupKey, []);
        groups.get(groupKey).push(person);
      });
      $('list').innerHTML = Array.from(buses).map(function (entry) {
        var number = entry[0], groups = entry[1];
        var allInBus = people.filter(function (p) { return p.bus_number === number; });
        return '<section class="embarque-bus-section"><header class="embarque-bus-section__header"><h3>' +
          esc(t('bus', { number: number })) + '</h3><span>' + esc(progress(allInBus)) + '</span></header>' +
          Array.from(groups).sort(function (a, b) {
            return (a[0] === 'vip' ? 0 : a[0] === 'solo' ? 1 : 2) - (b[0] === 'vip' ? 0 : b[0] === 'solo' ? 1 : 2);
          }).map(function (group) {
            var first = group[1][0];
            var isVip = group[0] === 'vip';
            var isSolo = group[0] === 'solo';
            var primary = people.find(function (p) { return p.registration_id === first.registration_id && p.primary; });
            var responsible = !isVip && !isSolo ? primary && primary.name || first.contact : '';
            var allInGroup = scoped.filter(function (p) {
              return isVip ? p.vip && p.bus_number === number : isSolo ? solo(p) && p.bus_number === number : p.registration_id === group[0];
            });
            return '<section class="embarque-group"' + (isVip ? ' data-vip-group="' + number + '"' : isSolo ? ' data-solo-group="' + number + '"' : '') + '><header class="embarque-group__header"><div><h4>' +
              groupIcon(isVip ? 'vip' : isSolo ? 'solo' : 'group') + esc(isVip ? t('vipGroup') : isSolo ? t('soloGroup') : first.group || first.contact) + '</h4>' +
              (responsible ? '<span class="embarque-group__primary">' + esc(t('groupPrimary', { name: responsible })) + '</span>' : '') + '<span>' +
              esc(isVip ? t('vipHelp') : isSolo ? t('soloHelp') : t('group', { code: first.code })) +
              '</span></div><span class="embarque-group__count">' + esc(progress(allInGroup)) + '</span></header>' +
              '<ul class="embarque-people">' + group[1].map(passengerRow).join('') + '</ul></section>';
          }).join('') + '</section>';
      }).join('');
      root.querySelectorAll('[data-presence]').forEach(function (button) {
        var selected = button.dataset.presence === filter;
        button.setAttribute('aria-selected', String(selected));
        button.tabIndex = selected ? 0 : -1;
      });
      $('results').setAttribute('aria-labelledby', 'embarque-presence-' + filter);
      $('shown').textContent = t('shown', { count: visible.length });
      $('empty').hidden = !ready || visible.length > 0;
      $('empty-title').textContent = t(people.length ? 'noResults' : 'empty');
      $('empty-help').hidden = people.length > 0;
      $('clear').hidden = people.length === 0;
    }
    function render() {
      var active = document.activeElement;
      var focusId = active && active.dataset.check;
      renderBuses(); renderSummary(); renderList(); syncStatus();
      // Polling should not take keyboard focus away from the working row.
      if (focusId) {
        var button = $('list').querySelector('[data-check="' + focusId + '"]');
        if (button) button.focus({ preventScroll: true });
        else $('shown').focus({ preventScroll: true });
      }
      restoreCheckFocus();
    }
    function restoreCheckFocus() {
      if (!deferredFocus || loading || localPending.size || !root.open || deferredFocus.leg !== leg) return;
      var focus = deferredFocus; deferredFocus = null;
      if (document.activeElement !== document.body && document.activeElement !== root && document.activeElement !== $('shown')) return;
      var buttons = $('list').querySelectorAll('[data-check]:not(:disabled)');
      var target = $('list').querySelector('[data-check="' + focus.id + '"]:not(:disabled)') ||
        buttons[Math.min(focus.index, buttons.length - 1)] || $('search');
      target.focus({ preventScroll: true });
    }
    async function request(method, body, options) {
      var controller = new AbortController();
      controllers.add(controller);
      var timeout = setTimeout(function () { controller.abort(); }, 15000);
      try {
        var response = await fetch(options && options.url || API, {
          method: method, cache: 'no-store', signal: controller.signal,
          headers: { 'X-Admin-Token': token, 'Content-Type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined
        });
        var isFile = options && options.type && response.ok;
        if (isFile && !(response.headers.get('content-type') || '').startsWith(options.type)) throw new Error('invalid_export');
        var data = isFile ? await response.blob() : await response.json();
        if (!response.ok) {
          var error = new Error('boarding_request_failed');
          error.status = response.status;
          error.data = data;
          throw error;
        }
        return data;
      } finally {
        // A primeira leitura da lista (com ou sem sucesso) define se a rede está instável.
        if (method === 'GET' && !options) settled = true;
        clearTimeout(timeout);
        controllers.delete(controller);
      }
    }
    var coordinator = window.KobBoardingSync({ request: request,
      changed: function (state) {
        if (!token) return;
        var wasLoading = loading;
        queueState = state; people = state.people; ready = state.ready; loading = state.busy;
        stale = !state.online; lastSync = state.savedAt || null;
        pending = new Set(state.pending.map(function (op) { return op.passenger_id + ':' + op.leg; }));
        $('loading').hidden = ready || !loading;
        if (!ready && !loading) setNotice(state.authError ? 'expired' : 'firstConnection');
        else if (ready) setNotice('');
        if (wasLoading && !loading && state.online && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) $('update').classList.add('is-updated');
        render();
      },
      saved: function (op) {
        announce(t(op.present ? 'saved' : 'removed', { name: op.name, leg: t(op.leg) }));
      }
    });
    function sync(force) {
      if (!token || !root.open || (!force && document.hidden)) return;
      return coordinator.refresh();
    }
    async function check(id) {
      var person = people.find(function (p) { return p.id === id; });
      if (!person || !token) return;
      var savedLeg = leg, key = id + ':' + savedLeg;
      if (localPending.has(key)) return;
      localPending.add(key);
      var restoreFocus = document.activeElement && document.activeElement.dataset.check === id;
      var originIndex = Array.prototype.indexOf.call($('list').querySelectorAll('[data-check]'), document.activeElement);
      if (restoreFocus) deferredFocus = { id: id, leg: savedLeg, index: originIndex };
      var success = await coordinator.toggle(id, savedLeg);
      localPending.delete(key);
      if (!success) setNotice('storageError');
      render();
      if (restoreFocus && savedLeg === leg && root.open &&
          (document.activeElement === document.body || document.activeElement === root || document.activeElement === $('shown'))) {
        var buttons = $('list').querySelectorAll('[data-check]');
        var target = $('list').querySelector('[data-check="' + id + '"]') || buttons[Math.min(originIndex, buttons.length - 1)] || $('search');
        target.focus({ preventScroll: true });
      }
    }
    $('offline-toggle').addEventListener('click', function () { $('offline-toggle').classList.remove('is-alerting'); });
    $('notices').addEventListener('click', function (event) {
      var button = event.target.closest('button');
      if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') return;
      if (button.dataset.resolve) {
        coordinator.resolve(button.dataset.operation, button.dataset.resolve === 'local').catch(function () { setNotice('storageError'); });
      } else if (button.dataset.noticeAction === 'retry') sync(true);
      else if (button.dataset.noticeAction === 'reauth') { offlineAccess.close(); window.dispatchEvent(new Event('kob:boarding-reauth')); }
      else if (button.dataset.noticeAction === 'fleet') {
        offlineAccess.close(); closeDrawer(false, true);
        var fleetTab = document.querySelector('[data-aba="frota"]');
        fleetTab.click(); fleetTab.focus();
      }
    });
    $('list').addEventListener('click', function (event) {
      var control = event.target.closest('.embarque-check');
      if (control) {
        if (!control.disabled && control.hasAttribute('data-check')) check(control.dataset.check);
        return;
      }
      var row = event.target.closest('[data-person]');
      if (!row || window.getSelection().toString()) return;
      var active = row.querySelector('[data-check]');
      if (!active || active.disabled) return;
      active.focus({ preventScroll: true });
      check(active.dataset.check);
    });
    $('buses').addEventListener('change', function () { bus = $('buses').value; render(); });
    compactBuses.addEventListener('change', updateBusLabel);
    function selectPresence(button) {
      if (!button) return;
      filter = button.dataset.presence;
      renderList(); button.focus({ preventScroll: true });
    }
    $('filters').addEventListener('click', function (event) {
      selectPresence(event.target.closest('[data-presence]'));
    });
    $('filters').addEventListener('keydown', function (event) {
      var tabs = Array.from($('filters').querySelectorAll('[role="tab"]'));
      var index = tabs.indexOf(event.target);
      if (index === -1) return;
      if (event.key === 'ArrowRight') index = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') index = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') index = 0;
      else if (event.key === 'End') index = tabs.length - 1;
      else return;
      event.preventDefault(); selectPresence(tabs[index]);
    });
    root.querySelectorAll('[data-leg]').forEach(function (button) {
      button.addEventListener('click', function () {
        leg = button.dataset.leg;
        root.querySelectorAll('[data-leg]').forEach(function (item) { item.setAttribute('aria-pressed', String(item === button)); });
        render();
      });
    });
    $('search').addEventListener('input', function () { query = $('search').value; renderList(); });
    $('clear').addEventListener('click', function () {
      query = ''; bus = 'all'; filter = 'all'; $('search').value = '';
      render(); $('search').focus();
    });
    $('update').addEventListener('click', function () { sync(true); });
    $('update').querySelector('svg').addEventListener('animationend', function () { $('update').classList.remove('is-updated'); });
    function finishClose(restore) {
      clearTimeout(closeTimer); closeTimer = null;
      root.classList.remove('is-open');
      root.close();
      root.setAttribute('aria-hidden', 'true'); root.inert = true;
      opener.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('embarque-open');
      if (restore && !opener.hidden) opener.focus();
    }
    function closeDrawer(restore, immediate) {
      if (!root.open) return;
      root.classList.remove('is-open');
      if (immediate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) finishClose(restore);
      else {
        clearTimeout(closeTimer);
        closeTimer = setTimeout(function () { finishClose(restore); }, 320);
      }
    }
    function openDrawer() {
      if (!token) return;
      clearTimeout(closeTimer); closeTimer = null;
      root.inert = false; root.setAttribute('aria-hidden', 'false');
      if (!root.open) root.showModal();
      document.body.classList.add('embarque-open');
      opener.setAttribute('aria-expanded', 'true');
      requestAnimationFrame(function () { if (root.open) root.classList.add('is-open'); });
      $('close').focus();
      sync(true);
    }
    opener.addEventListener('click', openDrawer);
    $('close').addEventListener('click', function () { closeDrawer(true); });
    root.addEventListener('cancel', function (event) { event.preventDefault(); closeDrawer(true); });
    root.addEventListener('keydown', function (event) {
      if (event.key !== 'Tab') return;
      // Keep the keyboard loop stable even during the slide's entry motion.
      var controls = Array.from(root.querySelectorAll('button:not(:disabled), a[href]:not([aria-disabled="true"]), input:not(:disabled), select:not(:disabled):not([aria-hidden="true"]), textarea:not(:disabled)'))
        .filter(function (node) { return !node.closest('[hidden], [inert]:not(dialog)') && node.getClientRects().length > 0; });
      var first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    });
    root.addEventListener('click', function (event) {
      if (event.target !== root) return;
      var rect = root.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDrawer(true);
    });
    window.addEventListener('online', function () { sync(true); });
    window.addEventListener('offline', function () {
      stale = true; coordinator.refresh(); render(); announce(t(ready ? 'offlineReady' : 'firstConnection'));
    });
    window.addEventListener('focus', function () { coordinator.reload().then(function () { sync(false); }); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) sync(false); });
    busPicker = window.KobBoardingBusPicker(root);
    exporter = window.KobBoardingExport.mount(root, {
      t: t, locale: locale[lang],
      snapshot: function () { return { people: people.slice(), generatedAt: lastSync }; },
      file: function (action) { return request('GET', null, {
        url: API + '?format=' + (action === 'excel' ? 'xlsx' : 'pdf') + '&lang=' + lang,
        type: action === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf'
      }); }
    });
    offlineAccess = window.KobBoardingOffline(root, { t: t, lang: lang });
    translate();
    return {
      // autoOpen só no atalho da chamada (?chamada=1) ou sem rede, quando a
      // página não tem mais nada a mostrar; no painel completo abre pelo botão.
      start: async function (adminToken, autoOpen) {
        if (token !== adminToken || queueState.authError) {
          await this.stop(false); token = adminToken; coordinator.start(token);
        }
        if (!timer) timer = setInterval(function () { sync(false); }, 8000);
        opener.hidden = false;
        if (autoOpen && !autoOpened) { autoOpened = true; openDrawer(); }
        else sync(false);
      },
      canLogout: function () { return !pending.size || window.confirm(t('discardPending')); },
      stop: async function (clear) {
        closeDrawer(false, true);
        opener.hidden = true; autoOpened = false;
        token = ''; loading = false;
        clearInterval(timer); timer = null;
        controllers.forEach(function (controller) { controller.abort(); }); controllers.clear();
        await coordinator.stop(clear !== false);
        people = []; pending.clear(); localPending.clear(); deferredFocus = null; ready = false; stale = false; lastSync = null;
        queueState = { pending: [], confirmed: [], sending: '', durable: false, online: false, waiting: 0 };
        alerted.clear(); settled = false; $('offline-toggle').classList.remove('is-alerting');
        exporter.clear();
        $('list').replaceChildren();
        $('empty').hidden = true; $('loading').hidden = false;
        cancelAnimationFrame(announceFrame); $('announcement').textContent = ''; setNotice(''); renderSummary(); syncStatus();
      }
    };
  };
})();
