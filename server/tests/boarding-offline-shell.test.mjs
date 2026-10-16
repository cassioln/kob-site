import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
function worker(origin = 'https://painel.example') {
  const handlers = {};
  const context = { URL, fetch: () => Promise.reject(new Error('offline')),
    caches: { open: async () => ({ match: async () => 'cached shell' }) },
    self: { location: { origin }, addEventListener: (name, fn) => { handlers[name] = fn; } } };
  vm.createContext(context); vm.runInContext(read('embarque-sw.js'), context);
  return { context, handlers };
}
test('shell offline inclui scripts e estilos atuais com versões e caminhos existentes', () => {
  const { context } = worker(), files = Array.from(context.FILES);
  for (const path of files) {
    assert(existsSync(new URL(path.slice(1).split('?')[0], root)), path);
    assert(!/\/api\/|\/php\/|token=/.test(path), path);
  }
  const html = read('painel-onibus.html');
  const assets = [...html.matchAll(/(?:src|href)="(assets\/(?:js|css)\/[^" ]+)"/g)].map(match => '/' + match[1]);
  assert(assets.length >= 9);
  for (const path of assets) assert(files.includes(path), `Asset ausente ou versão desatualizada: ${path}`);
});
test('manifestos pt/en/es abrem somente chamada no mesmo app sem credenciais', () => {
  for (const lang of ['pt', 'en', 'es']) {
    const manifest = JSON.parse(read((lang === 'pt' ? '' : lang + '/') + 'embarque.webmanifest'));
    const url = new URL(manifest.start_url, 'https://painel.example');
    assert.equal(url.pathname, '/painel-onibus.html'); assert.equal(url.searchParams.get('chamada'), '1');
    assert.equal(url.searchParams.get('lang'), lang); assert.equal(manifest.lang, lang);
    assert.equal(manifest.display, 'standalone'); assert(!url.searchParams.has('token'));
    assert.equal(manifest.name, 'Check Busão KOB'); assert.equal(manifest.short_name, 'Check Busão KOB');
    assert(manifest.icons.some(icon => icon.purpose === 'maskable' && icon.sizes === '512x512'));
    assert(manifest.icons.some(icon => icon.purpose === 'any' && icon.sizes === '192x192'));
    for (const icon of manifest.icons) assert(existsSync(new URL(icon.src.slice(1), root)));
  }
});
test('service worker não intercepta APIs, escrita, outras páginas ou URLs com token', () => {
  const { handlers } = worker();
  for (const [path, method = 'GET', mode = 'cors'] of [
    ['/api/bus-boarding'], ['/api/bus-boarding?format=pdf'], ['/api/bus-admin-data'],
    ['/api/bus-boarding', 'POST'], ['/manual-de-bordo.html', 'GET', 'navigate'], ['/', 'GET', 'navigate'],
    ['/painel-onibus.html?token=example', 'GET', 'navigate']
  ]) {
    let intercepted = false;
    handlers.fetch({ request: { url: 'https://painel.example' + path, method, mode }, respondWith() { intercepted = true; } });
    assert.equal(intercepted, false, path);
  }
});
test('raiz do subdomínio painel recebe fallback offline sem afetar a home pública', async () => {
  const { handlers } = worker('https://painel.kriativosonboard.com.br');
  let response;
  handlers.fetch({ request: { url: 'https://painel.kriativosonboard.com.br/', method: 'GET', mode: 'navigate' }, respondWith(value) { response = value; } });
  assert.equal(await response, 'cached shell');
});
