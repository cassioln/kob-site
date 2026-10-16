(function () {
  'use strict';
  window.KobBoardingOffline = function (root, options) {
    var t = options.t, state = {}, prepared = false, preparing = false, failed = false, installPrompt = null;
    var $ = function (id) { return root.querySelector('#embarque-' + id); };
    var manifest = document.getElementById('embarque-manifest');
    // Mantém o ?v= do HTML: é o que força o navegador a buscar nome e ícone atualizados.
    var manifestVersion = (manifest.getAttribute('href').match(/\?.*$/) || [''])[0];
    manifest.href = (options.lang === 'pt' ? '' : options.lang + '/') + 'embarque.webmanifest' + manifestVersion;
    document.querySelectorAll('[data-boarding-entry]').forEach(function (node) { node.textContent = t(node.dataset.boardingEntry); });
    var toggle = $('offline-toggle'), menu = $('offline-menu');
    function render() {
      var ready = prepared && state.ready && state.durable && !state.authError;
      $('offline-state').textContent = t(ready ? 'offlinePrepared' : preparing ? 'offlinePreparing' : 'offlineNotReady');
      $('offline-state').dataset.ready = String(ready);
      toggle.dataset.ready = String(ready);
      toggle.setAttribute('aria-busy', String(preparing));
      $('offline-help').textContent = t(failed ? 'offlineUnsupported' : ready ? 'offlineHelpReady' : 'offlineHelpNotReady', {
        time: state.savedAt ? new Intl.DateTimeFormat(root.lang || 'pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(state.savedAt)) : ''
      });
      $('prepare').disabled = preparing || !navigator.onLine;
      $('prepare').setAttribute('aria-busy', String(preparing));
      $('install').hidden = !installPrompt;
    }
    async function prepare(persist) {
      if (preparing) return;
      preparing = true; failed = false; render();
      try {
        if (!window.isSecureContext || !navigator.serviceWorker) throw new Error('unsupported');
        if (persist && navigator.storage && navigator.storage.persist) await navigator.storage.persist().catch(function () {});
        await navigator.serviceWorker.register('/embarque-sw.js', { scope: '/', updateViaCache: 'none' });
        var registration = await Promise.race([navigator.serviceWorker.ready, new Promise(function (_, reject) {
          setTimeout(function () { reject(new Error('install_timeout')); }, 20000);
        })]);
        prepared = await new Promise(function (resolve) {
          var channel = new MessageChannel(), timeout = setTimeout(function () { resolve(false); }, 5000);
          channel.port1.onmessage = function (event) { clearTimeout(timeout); channel.port1.close(); resolve(!!event.data.ready); };
          registration.active.postMessage('CHECK_BOARDING_OFFLINE', [channel.port2]);
        });
        if (!prepared) throw new Error('incomplete_cache');
        if (persist) await options.refresh();
      } catch (_) { failed = true; }
      finally { preparing = false; render(); }
    }
    function setMenu(open, focusToggle) {
      menu.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      if (!open && focusToggle) toggle.focus();
    }
    toggle.addEventListener('click', function () { setMenu(menu.hidden); });
    $('offline').addEventListener('keydown', function (event) {
      // Esc fecha só o menu; sem isso o dialog inteiro da chamada fecharia junto.
      if (event.key === 'Escape' && !menu.hidden) { event.preventDefault(); event.stopPropagation(); setMenu(false, true); }
    });
    document.addEventListener('pointerdown', function (event) {
      if (!menu.hidden && !$('offline').contains(event.target)) setMenu(false);
    });
    $('prepare').addEventListener('click', function () { prepare(true); });
    window.addEventListener('beforeinstallprompt', function (event) { event.preventDefault(); installPrompt = event; render(); });
    $('install').addEventListener('click', async function () {
      if (!installPrompt) return;
      var prompt = installPrompt; installPrompt = null; render(); await prompt.prompt();
    });
    window.addEventListener('appinstalled', function () { installPrompt = null; render(); });
    window.addEventListener('online', function () { prepare(false); });
    prepare(false);
    // A nuvem é dividida: este módulo cuida do preparo offline; rede, rótulo e avisos
    // vêm de renderNotices() em painel-embarque.js.
    return { update: function (next) { state = next; render(); }, close: function () { setMenu(false); } };
  };
})();
