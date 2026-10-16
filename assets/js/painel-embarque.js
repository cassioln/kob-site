(function () {
  'use strict';
  var API = '/api/bus-boarding';
  var CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
  var UNCHECKED = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="4"/></svg>';

  window.KobBoarding = function (root) {
    var opener = document.getElementById('embarque-open');
    var messages = window.KobBoardingMessages;
    var requested = new URLSearchParams(window.location.search).get('lang') || document.documentElement.lang.slice(0, 2);
    var lang = messages[requested] ? requested : 'pt';
    var locale = { pt: 'pt-BR', en: 'en-US', es: 'es' };
    var people = [], token = '', timer = null, generation = 0, epoch = 0;
    var leg = 'outbound', bus = 'all', filter = 'all', query = '';
    var pending = new Set(), controllers = new Set();
    var loading = false, ready = false, stale = false, lastSync = null, noticeKey = '';
    var autoOpened = false, closeTimer = null, exporter = null, busPicker = null;
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
    function setNotice(key) {
      noticeKey = key;
      $('error').hidden = !key;
      $('error-text').textContent = key ? t(key) : '';
    }
    function syncStatus() {
      if (exporter) exporter.update(!ready || stale || !navigator.onLine || pending.size > 0 || people.length === 0);
      var key = !navigator.onLine ? 'offline' : stale ? 'stale' : loading ? 'syncing' : lastSync ? 'synced' : 'loading';
      $('sync').textContent = t(key, { time: lastSync ? time(lastSync) : '' });
      $('sync').dataset.state = (!navigator.onLine || stale) ? 'warning' : 'ok';
      $('update').disabled = loading;
      $('update').setAttribute('aria-busy', String(loading));
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
      if (noticeKey) setNotice(noticeKey);
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
      var active = checkLeg === leg, saving = pending.has(person.id + ':' + checkLeg);
      var disabled = !active || saving || !navigator.onLine || stale;
      return '<button type="button" class="embarque-check' + (active ? '' : ' is-inactive') +
        '" data-check-leg="' + checkLeg + '" ' + (active ? 'data-check' : 'data-inactive-check') + '="' + esc(person.id) +
        '" aria-pressed="' + present + '" aria-label="' + esc(t(present ? 'undoLabel' : 'saveLabel', { name: person.name, leg: t(checkLeg) })) +
        '" aria-busy="' + saving + '"' + (disabled ? ' disabled' : '') + '>' + (present ? CHECK : UNCHECKED) +
        '<span>' + esc(t(checkLeg)) + '</span></button>';
    }
    function passengerRow(person) {
      var present = onBoard(person), saving = pending.has(person.id + ':' + leg);
      var badges = [];
      if (person.vip || solo(person)) badges.push(t('group', { code: person.code }));
      if (person.primary) badges.push(t('primary'));
      if (person.lap_child) badges.push(t('lapChild'));
      else if (person.minor) badges.push(t('minor'));
      var subtitle = badges.join(' · ');
      var state = person[leg];
      var detail = saving ? t('saving') : present && state.checked_at ? t('checkedAt', { time: time(state.checked_at) }) : t('pending');
      // Names are text only; the passenger's database ID is the stable identity.
      return '<li class="embarque-person' + (present ? ' is-present' : '') + '" data-person="' + esc(person.id) + '" data-readonly="' + (saving || !navigator.onLine || stale) + '">' +
        '<div class="embarque-person__info"><strong>' + esc(person.name) + '</strong>' +
        (subtitle ? '<span class="embarque-person__meta">' + esc(subtitle) + '</span>' : '') +
        '<span class="embarque-person__detail">' + esc(detail) + '</span></div>' +
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
            var allInGroup = scoped.filter(function (p) {
              return isVip ? p.vip && p.bus_number === number : isSolo ? solo(p) && p.bus_number === number : p.registration_id === group[0];
            });
            return '<section class="embarque-group"' + (isVip ? ' data-vip-group="' + number + '"' : isSolo ? ' data-solo-group="' + number + '"' : '') + '><header class="embarque-group__header"><div><h4>' +
              groupIcon(isVip ? 'vip' : isSolo ? 'solo' : 'group') + esc(isVip ? t('vipGroup') : isSolo ? t('soloGroup') : first.group || first.contact) + '</h4><span>' +
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
        clearTimeout(timeout);
        controllers.delete(controller);
      }
    }
    async function sync(force) {
      if (!token || loading || pending.size || !root.open || (!force && document.hidden)) return;
      var session = generation, before = epoch;
      loading = true; syncStatus();
      try {
        var data = await request('GET');
        if (session !== generation || before !== epoch) return;
        var changed = !ready || stale || JSON.stringify(people) !== JSON.stringify(data.people);
        people = data.people;
        ready = true; stale = false; lastSync = Date.now();
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) $('update').classList.add('is-updated');
        $('loading').hidden = true;
        $('waiting').hidden = !data.waiting;
        $('waiting-text').textContent = t('waiting', { count: data.waiting });
        $('waiting').dataset.count = data.waiting;
        setNotice('');
        if (changed) render();
      } catch (error) {
        if (session !== generation || before !== epoch) return;
        stale = true;
        $('loading').hidden = true;
        setNotice(error.status === 404 ? 'expired' : 'stale');
        render();
      } finally {
        if (session === generation) { loading = false; syncStatus(); }
      }
    }
    async function check(id) {
      var person = people.find(function (p) { return p.id === id; });
      if (!person || !token || !navigator.onLine || stale) return;
      var savedLeg = leg, key = id + ':' + savedLeg;
      if (pending.has(key)) return;
      var session = generation;
      var restoreFocus = document.activeElement && document.activeElement.dataset.check === id;
      var originIndex = Array.prototype.indexOf.call($('list').querySelectorAll('[data-check]'), document.activeElement);
      var desired = !person[savedLeg].present;
      var revision = person[savedLeg].revision;
      pending.add(key); epoch++; setNotice(''); render();
      try {
        var data = await request('POST', {
          passenger_id: id, leg: savedLeg, present: desired,
          expected_revision: revision, bus_number: person.bus_number
        });
        if (session !== generation) return;
        person[savedLeg] = data.checkin;
        $('announcement').textContent = t(desired ? 'saved' : 'removed', { name: person.name, leg: t(savedLeg) });
      } catch (error) {
        if (session !== generation) return;
        if (error.status === 409 && error.data.error === 'revision_conflict') {
          person[savedLeg] = error.data.checkin;
          setNotice('conflict');
        } else {
          // A timed-out response may already have committed: resync before retrying.
          stale = true;
          setNotice(error.status === 409 ? 'changed' : error.status === 404 ? 'expired' : 'saveError');
        }
      } finally {
        if (session === generation) {
          pending.delete(key); epoch++; render();
          if (restoreFocus && savedLeg === leg && root.open &&
              (document.activeElement === document.body || document.activeElement === root || document.activeElement === $('shown'))) {
            var buttons = $('list').querySelectorAll('[data-check]');
            var target = $('list').querySelector('[data-check="' + id + '"]') ||
              buttons[Math.min(originIndex, buttons.length - 1)] || $('search');
            target.focus({ preventScroll: true });
          }
        }
      }
    }
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
    $('retry').addEventListener('click', function () { sync(true); });
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
        .filter(function (node) { return !node.closest('[hidden]') && node.getClientRects().length > 0; });
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
    $('fleet').addEventListener('click', function () {
      closeDrawer(false, true);
      var fleetTab = document.querySelector('[data-aba="frota"]');
      fleetTab.click(); fleetTab.focus();
    });
    window.addEventListener('online', function () { sync(true); });
    window.addEventListener('offline', function () {
      stale = true; render(); $('announcement').textContent = t('offline');
    });
    window.addEventListener('focus', function () { sync(false); });
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
    translate();
    return {
      start: function (adminToken) {
        if (token !== adminToken) { this.stop(); token = adminToken; }
        if (!timer) timer = setInterval(function () { sync(false); }, 8000);
        opener.hidden = false;
        if (!autoOpened) { autoOpened = true; openDrawer(); }
        else sync(false);
      },
      stop: function () {
        closeDrawer(false, true);
        opener.hidden = true; autoOpened = false;
        token = ''; generation++; epoch++; loading = false;
        clearInterval(timer); timer = null;
        controllers.forEach(function (controller) { controller.abort(); }); controllers.clear();
        people = []; pending.clear(); ready = false; stale = false; lastSync = null;
        exporter.clear();
        $('list').replaceChildren();
        $('waiting').hidden = true; $('empty').hidden = true; $('loading').hidden = false;
        $('announcement').textContent = ''; setNotice(''); renderSummary(); syncStatus();
      }
    };
  };
})();
