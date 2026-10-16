(function () {
  'use strict';
  var API = '/api/bus-boarding';
  var CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
  var UNCHECKED = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4"/></svg>';

  window.KobBoarding = function (root) {
    var messages = window.KobBoardingMessages;
    var requested = new URLSearchParams(window.location.search).get('lang') || document.documentElement.lang.slice(0, 2);
    var lang = messages[requested] ? requested : 'pt';
    var locale = { pt: 'pt-BR', en: 'en-US', es: 'es' };
    var people = [], token = '', timer = null, generation = 0, epoch = 0;
    var leg = 'outbound', bus = 'all', filter = 'all', query = '';
    var pending = new Set(), controllers = new Set();
    var loading = false, ready = false, stale = false, lastSync = null, noticeKey = '';
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
    function setNotice(key) {
      noticeKey = key;
      $('error').hidden = !key;
      $('error-text').textContent = key ? t(key) : '';
    }
    function syncStatus() {
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
      });
      $('search').placeholder = t('search');
      $('language').value = lang;
      var tab = document.querySelector('[data-aba="embarque"]');
      if (tab) tab.textContent = t('tab');
      if (noticeKey) setNotice(noticeKey);
      syncStatus();
    }
    function renderBuses() {
      var numbers = Array.from(new Set(people.map(function (p) { return p.bus_number; }))).sort(function (a, b) { return a - b; });
      if (bus !== 'all' && numbers.indexOf(Number(bus)) === -1) bus = 'all';
      var options = [{ value: 'all', name: t('allBuses'), list: people }].concat(numbers.map(function (number) {
        return { value: String(number), name: t('bus', { number: number }), list: people.filter(function (p) { return p.bus_number === number; }) };
      }));
      $('buses').innerHTML = options.map(function (item) {
        return '<button type="button" class="embarque-bus" data-bus="' + item.value + '" aria-pressed="' + (bus === item.value) + '">' +
          '<strong>' + esc(item.name) + '</strong><span>' + esc(progress(item.list)) + '</span></button>';
      }).join('');
    }
    function renderSummary() {
      var list = selectedPeople(), present = count(list);
      $('expected').textContent = list.length;
      $('present').textContent = present;
      $('missing').textContent = list.length - present;
      $('progress').max = list.length || 1;
      $('progress').value = present;
      $('progress').setAttribute('aria-label', progress(list));
      $('progress-text').textContent = list.length && present === list.length ? t('complete') : progress(list);
    }
    function passengerRow(person) {
      var present = onBoard(person), saving = pending.has(person.id + ':' + leg);
      var badges = [];
      if (person.primary) badges.push(t('primary'));
      if (person.lap_child) badges.push(t('lapChild'));
      else if (person.minor) badges.push(t('minor'));
      var subtitle = badges.join(' · ');
      var state = person[leg];
      var detail = present && state.checked_at ? t('checkedAt', { time: time(state.checked_at) }) : t('pending');
      // Names are text only; the passenger's database ID is the stable identity.
      return '<li class="embarque-person' + (present ? ' is-present' : '') + '" data-person="' + esc(person.id) + '">' +
        '<div class="embarque-person__info"><strong>' + esc(person.name) + '</strong>' +
        (subtitle ? '<span class="embarque-person__meta">' + esc(subtitle) + '</span>' : '') +
        '<span class="embarque-person__detail">' + esc(detail) + '</span></div>' +
        '<button type="button" class="embarque-check" data-check="' + esc(person.id) + '" aria-pressed="' + present +
        '" aria-label="' + esc(t(present ? 'undoLabel' : 'saveLabel', { name: person.name })) +
        '" aria-busy="' + saving + '"' + (saving || !navigator.onLine || stale ? ' disabled' : '') + '>' + (present ? CHECK : UNCHECKED) +
        '<span>' + esc(t(saving ? 'saving' : present ? 'undo' : 'save')) + '</span></button></li>';
    }
    function renderList() {
      var terms = normalize(query).trim().split(/\s+/).filter(Boolean);
      var scoped = selectedPeople();
      var visible = scoped.filter(function (person) {
        if (filter === 'missing' && onBoard(person) || filter === 'present' && !onBoard(person)) return false;
        var haystack = normalize([person.name, person.group, person.contact, person.code, person.cpf,
          String(person.cpf || '').replace(/\D/g, '')].join(' '));
        return terms.every(function (term) { return haystack.indexOf(term) !== -1; });
      });
      var buses = new Map();
      visible.forEach(function (person) {
        if (!buses.has(person.bus_number)) buses.set(person.bus_number, new Map());
        var groups = buses.get(person.bus_number);
        if (!groups.has(person.registration_id)) groups.set(person.registration_id, []);
        groups.get(person.registration_id).push(person);
      });
      $('list').innerHTML = Array.from(buses).map(function (entry) {
        var number = entry[0], groups = entry[1];
        var allInBus = people.filter(function (p) { return p.bus_number === number; });
        return '<section class="embarque-bus-section"><header class="embarque-bus-section__header"><h3>' +
          esc(t('bus', { number: number })) + '</h3><span>' + esc(progress(allInBus)) + '</span></header>' +
          Array.from(groups).map(function (group) {
            var first = group[1][0];
            var allInGroup = scoped.filter(function (p) { return p.registration_id === group[0]; });
            return '<section class="embarque-group"><header class="embarque-group__header"><div><h4>' +
              esc(first.group || (allInGroup.length === 1 ? first.name : first.contact)) + '</h4><span>' +
              esc(t('group', { code: first.code })) + (first.vip ? ' · ' + esc(t('vip')) : '') +
              '</span></div><span class="embarque-group__count">' + esc(progress(allInGroup)) + '</span></header>' +
              '<ul class="embarque-people">' + group[1].map(passengerRow).join('') + '</ul></section>';
          }).join('') + '</section>';
      }).join('');
      $('shown').textContent = t('shown', { count: visible.length });
      $('empty').hidden = !ready || visible.length > 0;
      $('empty-title').textContent = t(people.length ? 'noResults' : 'empty');
      $('empty-help').hidden = people.length > 0;
      $('clear').hidden = people.length === 0;
    }
    function render() {
      var active = document.activeElement;
      var focusId = active && active.dataset.check;
      var focusBus = active && active.dataset.bus;
      renderBuses(); renderSummary(); renderList(); syncStatus();
      // Polling should not take keyboard focus away from the working row.
      if (focusId) {
        var button = $('list').querySelector('[data-check="' + focusId + '"]');
        if (button) button.focus({ preventScroll: true });
        else $('shown').focus({ preventScroll: true });
      } else if (focusBus) {
        var busButton = $('buses').querySelector('[data-bus="' + focusBus + '"]');
        if (busButton) busButton.focus({ preventScroll: true });
      }
    }
    async function request(method, body) {
      var controller = new AbortController();
      controllers.add(controller);
      var timeout = setTimeout(function () { controller.abort(); }, 15000);
      try {
        var response = await fetch(API, {
          method: method, cache: 'no-store', signal: controller.signal,
          headers: { 'X-Admin-Token': token, 'Content-Type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined
        });
        var data = await response.json();
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
      if (!token || loading || pending.size || (!force && (root.closest('[hidden]') || document.hidden))) return;
      var session = generation, before = epoch;
      loading = true; syncStatus();
      try {
        var data = await request('GET');
        if (session !== generation || before !== epoch) return;
        var changed = !ready || stale || JSON.stringify(people) !== JSON.stringify(data.people);
        people = data.people;
        ready = true; stale = false; lastSync = Date.now();
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
        $('announcement').textContent = t(desired ? 'saved' : 'removed', { name: person.name });
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
          if (restoreFocus && savedLeg === leg && !root.closest('[hidden]') &&
              (document.activeElement === document.body || document.activeElement === $('shown'))) {
            var buttons = $('list').querySelectorAll('[data-check]');
            var target = $('list').querySelector('[data-check="' + id + '"]') ||
              buttons[Math.min(originIndex, buttons.length - 1)] || $('search');
            target.focus({ preventScroll: true });
          }
        }
      }
    }
    $('list').addEventListener('click', function (event) {
      var button = event.target.closest('[data-check]');
      if (button) check(button.dataset.check);
    });
    $('buses').addEventListener('click', function (event) {
      var button = event.target.closest('[data-bus]');
      if (button) { bus = button.dataset.bus; render(); }
    });
    root.querySelectorAll('[data-leg]').forEach(function (button) {
      button.addEventListener('click', function () {
        leg = button.dataset.leg;
        root.querySelectorAll('[data-leg]').forEach(function (item) { item.setAttribute('aria-pressed', String(item === button)); });
        render();
      });
    });
    root.querySelectorAll('[data-presence]').forEach(function (button) {
      button.addEventListener('click', function () {
        filter = button.dataset.presence;
        root.querySelectorAll('[data-presence]').forEach(function (item) { item.setAttribute('aria-pressed', String(item === button)); });
        render();
      });
    });
    $('search').addEventListener('input', function () { query = $('search').value; renderList(); });
    $('clear').addEventListener('click', function () {
      query = ''; bus = 'all'; filter = 'all'; $('search').value = '';
      root.querySelectorAll('[data-presence]').forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.presence === 'all')); });
      render(); $('search').focus();
    });
    $('language').addEventListener('change', function () {
      lang = $('language').value; translate(); render();
      $('waiting-text').textContent = t('waiting', { count: $('waiting').dataset.count || 0 });
    });
    $('update').addEventListener('click', function () { sync(true); });
    $('retry').addEventListener('click', function () { sync(true); });
    $('fleet').addEventListener('click', function () { document.querySelector('[data-aba="frota"]').click(); });
    window.addEventListener('online', function () { sync(true); });
    window.addEventListener('offline', function () {
      stale = true; render(); $('announcement').textContent = t('offline');
    });
    window.addEventListener('focus', function () { sync(false); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) sync(false); });
    translate();
    return {
      start: function (adminToken) {
        if (token !== adminToken) { this.stop(); token = adminToken; }
        if (!timer) timer = setInterval(function () { sync(false); }, 8000);
        $('pdf').href = '/api/bus-manifest?token=' + encodeURIComponent(token);
        sync(true);
      },
      activate: function () { sync(false); },
      stop: function () {
        token = ''; generation++; epoch++; loading = false;
        clearInterval(timer); timer = null;
        controllers.forEach(function (controller) { controller.abort(); }); controllers.clear();
        people = []; pending.clear(); ready = false; stale = false; lastSync = null;
        $('list').replaceChildren(); $('pdf').removeAttribute('href');
        $('waiting').hidden = true; $('empty').hidden = true; $('loading').hidden = false;
        $('announcement').textContent = ''; setNotice(''); renderSummary(); syncStatus();
      }
    };
  };
})();
