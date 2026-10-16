(function () {
  'use strict';
  window.KobBoardingOffline = function (root, options) {
    var t = options.t, state = {}, prepared = false, preparing = false, failed = false, installPrompt = null;
    var $ = function (id) { return root.querySelector('#embarque-' + id); };
    var manifest = document.getElementById('embarque-manifest');
    manifest.href = (options.lang === 'pt' ? '' : options.lang + '/') + 'embarque.webmanifest';
    $('offline-link').href = 'painel-onibus.html?chamada=1&lang=' + options.lang;
    document.querySelectorAll('[data-boarding-entry]').forEach(function (node) { node.textContent = t(node.dataset.boardingEntry); });
    function render() {
      var ready = prepared && state.ready && state.durable && !state.authError;
      $('offline-state').textContent = t(ready ? 'offlinePrepared' : preparing ? 'offlinePreparing' : 'offlineNotReady');
      $('offline-state').dataset.ready = String(ready);
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
    $('prepare').addEventListener('click', function () { prepare(true); });
    window.addEventListener('beforeinstallprompt', function (event) { event.preventDefault(); installPrompt = event; render(); });
    $('install').addEventListener('click', async function () {
      if (!installPrompt) return;
      var prompt = installPrompt; installPrompt = null; render(); await prompt.prompt();
    });
    window.addEventListener('appinstalled', function () { installPrompt = null; render(); });
    window.addEventListener('online', function () { prepare(false); });
    prepare(false);
    return { update: function (next) { state = next; render(); } };
  };
})();
