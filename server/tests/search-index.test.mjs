import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndex, serializeIndex, LANGS, liveEntries, sectionEntries } from '../../scripts/build-search-index.mjs';
import { parseHtml, byId } from '../../scripts/lib/html-extract.mjs';

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
    const trees = Object.fromEntries(Object.entries(pageFile).map(([page, file]) => [page, parseHtml(read(prefix + file))]));
    for (const e of indexes[lang].entries) {
      if (e.anchor.startsWith('#live-') || e.anchor === '#checklist') continue;
      assert.ok(byId(trees[e.page], e.anchor.slice(1)), `${e.id}: ${e.anchor} não existe em ${e.page}`);
    }
  });

  test(`${lang}: valores indexa os 6 cards de preço com título curto`, () => {
    const cards = indexes[lang].entries.filter(e => /^home-sec-valores-[1-9]/.test(e.id));
    assert.equal(cards.length, 6);
    for (const e of cards) {
      assert.ok(e.title.length <= 40, `${e.id}: título longo demais: ${e.title}`);
      assert.ok(e.text.trim(), `${e.id} sem texto`);
    }
  });

  test(`${lang}: texto sem palavras coladas nem índices decorativos`, () => {
    const manifest = indexes[lang].entries.find(e => e.id === 'home-sec-incluso-1');
    assert.doesNotMatch(manifest.text, /\b0[1-6]\b/, 'índices aria-hidden 01…06 vazaram para o texto');
    assert.doesNotMatch(indexes[lang].entries.map(e => `${e.title} ${e.text}`).join(' '), /cabinena|cabinin|cabinaen|musicao |musicathe|musicael/i);
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

test('incluso: as partes trazem o corpo inteiro, não só o cabeçalho', () => {
  const part = id => indexes.pt.entries.find(e => e.id === id);
  assert.match(part('home-sec-incluso-3').text, /passagens aéreas/);
  assert.match(part('home-sec-incluso-2').text, /ponto de encontro/);
});

test('live sem título ou transcrição no idioma falha em vez de cair no PT', () => {
  const chapter = { seconds: 7, time: '00:00:07', keywords: '', titles: { pt: 'T', en: 'T' }, transcripts: { pt: 'x', es: 'x' } };
  assert.throws(() => liveEntries([chapter], 'en'), /live-7.*en/);
  assert.throws(() => liveEntries([chapter], 'es'), /live-7.*es/);
  assert.equal(liveEntries([chapter], 'pt').length, 1);
});

test('seção cujas partes não casam nenhum nó falha com página e id', () => {
  const root = parseHtml('<section id="x"><h2>T</h2><p>corpo</p></section>');
  assert.throws(() => sectionEntries(root, 'home', [{ id: 'x', parts: n => n.tag === 'article' }]), /home.*x/);
  assert.equal(sectionEntries(root, 'home', [{ id: 'x' }]).length, 1);
});

test('live EN/ES usa a transcrição do próprio idioma', () => {
  const parking = lang => indexes[lang].entries.find(e => e.id === 'live-1765');
  assert.match(parking('en').text, /parking lot/);
  assert.match(parking('es').text, /estacionamiento/);
  assert.equal(parking('pt').time, '00:29:25');
});
