/* Only the static boarding shell is cached. API traffic always reaches the network. */
'use strict';
var VERSION = '20261017-modal-vip-v18', CACHE = 'kob-boarding-shell-' + VERSION;
// Os manifestos levam ?v= para o navegador/WebAPK buscar nome e ícone novos; a página pede a mesma URL.
var FILES = ['/painel-onibus.html'].concat(['', 'en/', 'es/'].map(function (lang) { return '/' + lang + 'embarque.webmanifest?v=' + VERSION; }), [
  '/assets/css/painel-onibus.css?v=20261017-modal-vip-v18', '/assets/css/painel-embarque.css?v=' + VERSION,
  '/assets/fonts/gobold-extra2.woff2', '/assets/fonts/chantal-medium.woff2',
  '/assets/images/brand/favicon-32.png', '/assets/images/brand/check-busao-apple-touch-icon.png',
  '/assets/images/brand/check-busao-icon-192.png', '/assets/images/brand/check-busao-icon-512.png', '/assets/images/brand/check-busao-maskable-512.png',
  '/assets/images/brand/kriativos-on-board-logo.webp', '/assets/images/manual/kriativa-chamada.webp'])
  .concat(['i18n', 'export', 'bus-picker', 'store', 'sync', 'offline'].map(function (name) { return '/assets/js/painel-embarque-' + name + '.js?v=' + VERSION; }))
  .concat(['/assets/js/painel-embarque.js?v=' + VERSION, '/assets/js/painel-editar-reserva.js?v=' + VERSION,
    '/assets/js/painel-onibus.js?v=' + VERSION]);
self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) {
    return cache.addAll(FILES.map(function (file) { return new Request(file, { cache: 'reload', credentials: 'omit' }); }));
  }));
  // Updates wait for the current session to close; no forced reload mid roll call.
});
self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (key) { return key.startsWith('kob-boarding-shell-') && key !== CACHE; })
      .map(function (key) { return caches.delete(key); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (event) {
  var request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.searchParams.has('token') || url.username || url.password) return;
  var boardingPage = url.pathname === '/painel-onibus.html' ||
    (url.pathname === '/' && url.hostname === 'painel.kriativosonboard.com.br');
  if (request.mode === 'navigate' && boardingPage) {
    event.respondWith(fetch(request).catch(function () { return caches.open(CACHE).then(function (cache) { return cache.match('/painel-onibus.html'); }); }));
  } else if (FILES.indexOf(url.pathname + url.search) !== -1) {
    event.respondWith(caches.open(CACHE).then(function (cache) { return cache.match(request).then(function (cached) { return cached || fetch(request); }); }));
  }
});
self.addEventListener('message', function (event) {
  if (event.data !== 'CHECK_BOARDING_OFFLINE' || !event.ports[0]) return;
  event.waitUntil(caches.open(CACHE).then(async function (cache) {
    var files = await Promise.all(FILES.map(function (path) { return cache.match(path); }));
    event.ports[0].postMessage({ ready: files.every(Boolean), version: VERSION });
  }));
});
