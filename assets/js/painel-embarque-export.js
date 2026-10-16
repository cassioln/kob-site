(function () {
  'use strict';

  function groups(people) {
    var buses = new Map(), sizes = new Map();
    people.forEach(function (p) { sizes.set(p.registration_id, (sizes.get(p.registration_id) || 0) + 1); });
    people.forEach(function (person) {
      if (!buses.has(person.bus_number)) buses.set(person.bus_number, new Map());
      var items = buses.get(person.bus_number), key = person.vip ? 'vip' : sizes.get(person.registration_id) === 1 ? 'solo' : person.registration_id;
      if (!items.has(key)) items.set(key, []);
      items.get(key).push(person);
    });
    return Array.from(buses).sort(function (a, b) { return a[0] - b[0]; }).map(function (entry) {
      return { number: entry[0], groups: Array.from(entry[1]).sort(function (a, b) {
        return (a[0] === 'vip' ? 0 : a[0] === 'solo' ? 1 : 2) - (b[0] === 'vip' ? 0 : b[0] === 'solo' ? 1 : 2);
      }) };
    });
  }

  function format(snapshot, channel, t, locale) {
    var title = t('title') + ' · Kriativos On Board 2026';
    var date = new Intl.DateTimeFormat(locale, { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'medium' }).format(snapshot.generatedAt);
    var lines = [title, t('exportScope'), t('exportGenerated', { time: date })];
    ['outbound', 'return'].forEach(function (leg) {
      var present = snapshot.people.filter(function (p) { return Boolean(p[leg].present); }).length;
      lines.push(t(leg) + ': ' + t('progress', { present: present, total: snapshot.people.length }) + ' · ' + t('missing') + ': ' + (snapshot.people.length - present));
    });
    groups(snapshot.people).forEach(function (bus) {
      var heading = t('bus', { number: bus.number });
      lines.push('', heading.toLocaleUpperCase(locale));
      bus.groups.forEach(function (group) {
        var first = group[1][0];
        var label = group[0] === 'vip' ? t('vipGroup') : group[0] === 'solo' ? t('soloGroup') : first.group || first.contact || first.name;
        lines.push('', label);
        group[1].forEach(function (person) {
          var booking = t('group', { code: person.code });
          var states = ['outbound', 'return'].map(function (leg) {
            var present = Boolean(person[leg].present);
            return channel === 'email' ? t(leg) + ': ' + t(present ? 'present' : 'exportPending')
              : (present ? '[x]' : '[ ]') + ' ' + t(leg);
          }).join(' · ');
          lines.push(channel === 'email' ? person.name + ' — ' + booking + '\n  ' + states
            : states + ' | ' + person.name + ' — ' + booking);
        });
      });
    });
    if (channel === 'email') lines.unshift(t('exportGreeting'), '');
    if (channel !== 'email') lines.push('', t('exportLegend'));
    return lines.join('\n');
  }

  function mount(root, config) {
    var t = config.t, footer = root.querySelector('#embarque-export');
    var status = root.querySelector('#embarque-export-status');
    var feedback = root.querySelector('#embarque-export-feedback');
    var feedbackClose = root.querySelector('#embarque-export-feedback-close');
    var fallback = root.querySelector('#embarque-export-fallback');
    var area = root.querySelector('#embarque-export-text');
    var controls = Array.from(footer.querySelectorAll('[data-boarding-export]'));
    var toggle = root.querySelector('#embarque-export-toggle');
    var panel = root.querySelector('#embarque-export-controls');
    function setOpen(open) {
      footer.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      // Recolhido, os botões ficam fora do Tab e do leitor de tela.
      panel.inert = !open;
    }
    toggle.addEventListener('click', function () { setOpen(toggle.getAttribute('aria-expanded') !== 'true'); });
    var disabled = true, downloading = '', generation = 0, feedbackTimer = null, initiator = null;
    function hideFeedback() {
      clearTimeout(feedbackTimer); feedbackTimer = null;
      if (feedback.contains(document.activeElement) && initiator && !initiator.disabled) initiator.focus({ preventScroll: true });
      feedback.hidden = true;
    }
    function message(key, state) {
      clearTimeout(feedbackTimer);
      state = state || 'success';
      status.textContent = t(key); feedback.dataset.state = state; feedback.hidden = false;
      feedback.setAttribute('aria-busy', String(state === 'loading'));
      feedbackClose.hidden = state === 'loading';
      if (state !== 'loading') feedbackTimer = setTimeout(hideFeedback, state === 'error' ? 8000 : 5000);
    }
    feedbackClose.addEventListener('click', hideFeedback);
    function showText(output, key) {
      area.value = output; fallback.hidden = false;
      root.querySelector('#embarque-export-help').textContent = t(key);
      area.focus(); area.select();
    }
    function save(blob, name) {
      var url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = name; link.hidden = true;
      root.appendChild(link); link.click(); link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    }
    function update() {
      controls.forEach(function (control) {
        var blocked = disabled || Boolean(downloading);
        control.setAttribute('aria-disabled', String(blocked));
        if (control.tagName === 'BUTTON') control.disabled = blocked;
        else control.tabIndex = blocked ? -1 : 0;
      });
      ['pdf', 'excel'].forEach(function (action) { root.querySelector('[data-boarding-export="' + action + '"]').setAttribute('aria-busy', String(downloading === action)); });
    }
    footer.addEventListener('click', async function (event) {
      var control = event.target.closest('[data-boarding-export]');
      if (!control) return;
      event.preventDefault();
      if (disabled || downloading) return;
      var action = control.dataset.boardingExport, snapshot = config.snapshot(), session = generation;
      initiator = control; hideFeedback();
      status.textContent = ''; fallback.hidden = true; area.value = '';
      if (action === 'pdf' || action === 'excel') {
        downloading = action; update(); message(action === 'excel' ? 'exportExcelPreparing' : 'exportPreparing', 'loading');
        try {
          var blob = await config.file(action);
          if (session !== generation) return;
          save(blob, 'chamada-embarque-kob2026.' + (action === 'excel' ? 'xlsx' : 'pdf')); message(action === 'excel' ? 'exportExcelDownloaded' : 'exportDownloaded');
        } catch (error) {
          if (session === generation) message(action === 'excel' ? 'exportExcelError' : 'exportError', 'error');
        } finally {
          if (session === generation) { downloading = ''; update(); }
        }
        return;
      }
      var output = format(snapshot, action, t, config.locale);
      if (action === 'copy') {
        message('exportCopying', 'loading');
        try {
          await navigator.clipboard.writeText(output);
          if (session === generation) message('exportCopied');
        } catch (error) {
          if (session === generation) { message('exportCopyHelp', 'error'); showText(output, 'exportCopyHelp'); }
        }
      } else if (action === 'email') {
        var subject = t('title') + ' · Kriativos On Board 2026';
        var mailto = 'mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(output);
        if (mailto.length <= 8000) {
          var email = document.createElement('a'); email.href = mailto; email.click();
          message('exportEmailReady');
        } else {
          // A complete editable draft avoids dropping passengers in long mailto URLs.
          var bytes = new TextEncoder().encode(output.replace(/\r?\n/g, '\r\n'));
          var binary = Array.from(bytes, function (b) { return String.fromCharCode(b); }).join('');
          var encoded = btoa(binary).match(/.{1,76}/g).join('\r\n');
          var subjectBytes = btoa(unescape(encodeURIComponent(subject)));
          save(new Blob(['X-Unsent: 1\r\nMIME-Version: 1.0\r\nSubject: =?UTF-8?B?' + subjectBytes + '?=\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n' + encoded + '\r\n'], { type: 'message/rfc822' }), 'chamada-embarque-kob2026.eml');
          message('exportEmailDraft');
        }

      }
    });
    root.querySelector('#embarque-export-dismiss').addEventListener('click', function () {
      fallback.hidden = true; area.value = ''; controls[0].focus();
    });
    return {
      open: function () { setOpen(true); },
      update: function (blocked) { disabled = blocked; update(); },
      clear: function () {
        generation++; disabled = true; downloading = ''; update(); setOpen(false);
        hideFeedback(); status.textContent = ''; area.value = ''; fallback.hidden = true;
      }
    };
  }
  window.KobBoardingExport = { format: format, mount: mount };
})();
