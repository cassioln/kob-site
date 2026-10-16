(function () {
  'use strict';
  window.KobBoardingOffline = function (root, options) {
    var t = options.t, state = {}, prepared = false, preparing = false, failed = false, installPrompt = null, persistAsked = false;
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
      $('install').hidden = !installPrompt;
      // Sem prompt de instalação o bloco fica só com estado + "Lista salva às…".
      $('install').parentNode.hidden = !installPrompt;
    }
    // Depois do primeiro preparo bem-sucedido, pede armazenamento persistente se ainda não houver.
    // Uma vez por carregamento; persisted() evita pedir de novo quando o navegador já concedeu.
    function requestPersistence() {
      if (persistAsked || !navigator.storage || !navigator.storage.persisted || !navigator.storage.persist) return;
      persistAsked = true;
      navigator.storage.persisted().then(function (granted) {
        if (!granted) return navigator.storage.persist();
      }).catch(function () {});
    }
    // O preparo é automático: roda ao abrir e quando a conexão volta, sem botão.
    async function prepare() {
      if (preparing) return;
      preparing = true; failed = false; render();
      try {
        if (!window.isSecureContext || !navigator.serviceWorker) throw new Error('unsupported');
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
        requestPersistence();
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
    window.addEventListener('beforeinstallprompt', function (event) { event.preventDefault(); installPrompt = event; render(); });
    $('install').addEventListener('click', async function () {
      if (!installPrompt) return;
      var prompt = installPrompt; installPrompt = null; render(); await prompt.prompt();
    });
    window.addEventListener('appinstalled', function () { installPrompt = null; render(); });
    window.addEventListener('online', prepare);
    prepare();
    // A nuvem é dividida: este módulo cuida do preparo offline; rede, rótulo e avisos
    // vêm de renderNotices() em painel-embarque.js.
    return { update: function (next) { state = next; render(); }, close: function () { setMenu(false); } };
  };
})();
