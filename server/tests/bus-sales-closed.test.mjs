import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { handleCreatePixRequest } from '../http.mjs';

for (const body of [{}, '{invalid JSON}']) {
  test('novas reservas retornam BUS_SOLD_OUT antes de validação, banco ou cobrança: ' + typeof body, async () => {
    const result = await handleCreatePixRequest({ method: 'POST', body, dependencies: {} });
    assert.equal(result.statusCode, 409);
    assert.equal(result.body.code, 'BUS_SOLD_OUT');
    assert.match(result.body.error, /esgotadas/);
    assert.equal(Object.hasOwn(result.body, 'registrationId'), false);
  });
}

for (const method of ['POST', 'GET']) {
  test(`PHP ${method}: fechamento não depende de credenciais nem cria cobranças`, () => {
    const endpoint = fileURLToPath(new URL('../../php/mysql/create-pix-order.php', import.meta.url));
    const script = `$_SERVER['REQUEST_METHOD'] = '${method}'; register_shutdown_function(function () { fwrite(STDERR, (string) http_response_code()); }); require ${JSON.stringify(endpoint)};`;
    const result = spawnSync('php', ['-r', script], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, method === 'POST' ? '409' : '405');
    const data = JSON.parse(result.stdout);
    if (method === 'POST') assert.equal(data.code, 'BUS_SOLD_OUT');
    assert.equal(Object.hasOwn(data, 'qrCode'), false);
  });
}

for (const [lang, label] of [['pt', 'Vagas esgotadas'], ['en', 'Sold out'], ['es', 'Plazas agotadas']]) {
  test(`${lang}: todos os resultados de busca do ônibus informam vagas esgotadas`, () => {
    const index = JSON.parse(fs.readFileSync(new URL(`../../assets/data/search-index.${lang}.json`, import.meta.url), 'utf8'));
    const entries = index.entries.filter(entry => entry.page === 'bus');
    assert.ok(entries.length > 0);
    for (const entry of entries) assert.ok(entry.title.includes(label), entry.id);
  });
}
