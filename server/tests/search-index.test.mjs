import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, serializeIndex, LANGS } from '../../scripts/build-search-index.mjs';

const read = file => fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
const pageFile = { home: 'index.html', bus: 'onibus.html', manual: 'manual-de-bordo.html' };
const indexes = Object.fromEntries(await Promise.all(LANGS.map(async lang => [lang, await buildIndex(lang)])));

for (const lang of LANGS) {
  test(`${lang}: o índice versionado está atualizado (rode npm run build:search-index)`, () => {
    assert.equal(read(`assets/data/search-index.${lang}.json`), serializeIndex(indexes[lang]),
      'Índice desatualizado: rode `npm run build:search-index` e commite os JSON.');
  });

  test(`${lang}: contagens, ids únicos e títulos preenchidos`, () => {
    const { entries } = indexes[lang];
    const count = (page, kind) => entries.filter(e => e.page === page && e.kind === kind).length;
    assert.equal(count('home', 'faq'), 34);
    assert.equal(count('manual', 'faq'), 42);
    assert.equal(count('manual', 'live'), 41);
    assert.equal(count('manual', 'checklist'), 25);
    assert.ok(entries.filter(e => e.kind === 'section').length >= 30);
    assert.equal(new Set(entries.map(e => e.id)).size, entries.length);
    for (const e of entries) assert.ok(e.title.trim(), `${e.id} sem título`);
    for (const e of entries.filter(e => e.kind === 'section' && e.id.startsWith('manual-sec-cronograma-') && !e.id.endsWith('-0'))) {
      assert.ok(e.text.trim(), `${e.id} sem texto`);
    }
    assert.ok(!entries.some(e => e.anchor === '#gamesTrack'), 'nenhuma âncora deve apontar para #gamesTrack');
  });

  test(`${lang}: toda âncora existe na página de destino`, () => {
    const prefix = lang === 'pt' ? '' : `${lang}/`;
    const html = Object.fromEntries(Object.entries(pageFile).map(([page, file]) => [page, read(prefix + file)]));
    for (const e of indexes[lang].entries) {
      if (e.anchor.startsWith('#live-') || e.anchor === '#checklist') continue;
      assert.ok(html[e.page].includes(`id="${e.anchor.slice(1)}"`), `${e.id}: ${e.anchor} não existe em ${e.page}`);
    }
  });
}

test('paridade: os 3 idiomas têm exatamente os mesmos ids', () => {
  const ids = lang => indexes[lang].entries.map(e => e.id).sort();
  assert.deepEqual(ids('en'), ids('pt'));
  assert.deepEqual(ids('es'), ids('pt'));
});

test('sinônimos: os "Mais procurados" apontam para entradas reais em cada idioma', () => {
  const synonyms = JSON.parse(read('assets/data/search-synonyms.json'));
  for (const lang of LANGS) {
    assert.equal(synonyms[lang].featured.length, 5);
    for (const f of synonyms[lang].featured) {
      assert.ok(indexes[lang].entries.some(e => e.page === f.page && e.anchor === f.anchor), `${lang}: ${f.page}${f.anchor}`);
    }
    assert.ok(synonyms[lang].groups.length >= 15);
  }
});

test('live EN/ES usa a transcrição do próprio idioma', () => {
  const parking = lang => indexes[lang].entries.find(e => e.id === 'live-1765');
  assert.match(parking('en').text, /parking lot/);
  assert.match(parking('es').text, /estacionamiento/);
  assert.equal(parking('pt').time, '00:29:25');
});
