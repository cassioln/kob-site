import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { prepareIndex, search, snippetFor, buildResultUrl, currentPageFrom, damerauLevenshtein, destinationFor } from '../../assets/js/site-search-engine.js';

const read = file => JSON.parse(fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8'));
const synonyms = read('assets/data/search-synonyms.json');
const prepared = Object.fromEntries(['pt', 'en', 'es'].map(lang => [lang, prepareIndex(read(`assets/data/search-index.${lang}.json`).entries, synonyms[lang])]));
const titles = r => r.results.map(x => x.entry.title);

test('Damerau-Levenshtein com transposição e saída antecipada', () => {
  assert.equal(damerauLevenshtein('bagajem', 'bagagem', 1), 1);
  assert.equal(damerauLevenshtein('ab', 'ba'), 1);
  assert.equal(damerauLevenshtein('kitten', 'sitting'), 3);
  assert.equal(damerauLevenshtein('abcdef', 'uvwxyz', 1), 2);
});

test('acento, caixa, prefixo e erro de digitação encontram a mesma resposta', () => {
  for (const q of ['bagagem', 'BAGAGEM', 'bagag', 'bagajem']) {
    assert.ok(titles(search(prepared.pt, q)).some(t => /bagagem/i.test(t)), q);
  }
});

test('sinônimo: "mala" encontra bagagem e informa o sinônimo usado', () => {
  const r = search(prepared.pt, 'mala');
  assert.ok(titles(r).some(t => /bagagem/i.test(t)));
  assert.ok(r.synonymsUsed.includes('bagagem'), JSON.stringify(r.synonymsUsed));
});

test('sinônimo curto só vale por palavra exata, não por prefixo', () => {
  const r = search(prepared.en, 'parking');
  assert.ok(titles(r).some(t => /parking/i.test(t)), JSON.stringify(titles(r)));
  assert.ok(!r.synonymsUsed.some(word => /^(card|carr)/i.test(word)), JSON.stringify(r.synonymsUsed));
});

test('FAQ do manual vem antes da live para "bagagem"', () => {
  const r = search(prepared.pt, 'bagagem').results;
  assert.equal(r[0].entry.page, 'manual');
  assert.equal(r[0].entry.kind, 'faq');
  const firstLive = r.findIndex(x => x.entry.kind === 'live');
  const firstManualFaq = r.findIndex(x => x.entry.kind === 'faq' && x.entry.page === 'manual');
  assert.ok(firstLive === -1 || firstManualFaq < firstLive);
});

test('todas as palavras precisam casar (lógica E)', () => {
  const one = search(prepared.pt, 'festa').results.length;
  const both = search(prepared.pt, 'festa branco').results.length;
  assert.ok(both > 0 && both < one);
  assert.equal(search(prepared.pt, 'bagagem xyzqwk').results.length, 0);
});

test('só stopwords ou 1 letra viram consulta vazia (estado inicial)', () => {
  for (const q of ['de', 'a', 'o que', '  ', 'como']) assert.deepEqual(search(prepared.pt, q).tokens, [], q);
});

test('texto colado longo não trava e usa no máximo 8 palavras', () => {
  const q = 'bagagem '.repeat(10) + 'x'.repeat(300);
  const start = performance.now();
  const r = search(prepared.pt, q);
  assert.ok(performance.now() - start < 200);
  assert.ok(r.tokens.length <= 8);
});

test('pergunta em frase acha a resposta (PT e EN)', () => {
  const pt = search(prepared.pt, 'quero saber qual o limite de bagagem do navio');
  assert.ok(pt.results.length > 0, JSON.stringify(pt.tokens));
  assert.match(pt.results[0].entry.title, /bagagem/i);
  const en = search(prepared.en, 'i want to know where the luggage limit is');
  assert.ok(titles(en).some(t => /luggage/i.test(t)), JSON.stringify(en.tokens));
});

test('frase longa tolera uma palavra sem par quando há 3 ou mais termos', () => {
  const r = search(prepared.pt, 'como faço para levar meu carro estacionamento concais');
  assert.ok(r.results.length >= 1, JSON.stringify(r.tokens));
  assert.match(r.results[0].entry.title, /estacionamento|carro/i);
  assert.equal(search(prepared.pt, 'bagagem xyzqwk abcdef').results.length, 0);
});

test('pergunta em espanhol sem ruído do verbo "es"', () => {
  const pack = search(prepared.es, 'que es el paquete de bebidas');
  // The top results are about drink packages, and the manual's package FAQ is among them.
  assert.ok(pack.results.slice(0, 3).every(x => /paquete|bebida/i.test(`${x.entry.title} ${x.entry.text}`)), JSON.stringify(titles(pack)));
  assert.ok(pack.results.some(x => x.entry.page === 'manual' && x.entry.kind === 'faq' && /paquete/i.test(x.entry.title)), JSON.stringify(titles(pack)));
  const bus = search(prepared.es, 'cual es el horario del autobus');
  assert.ok(bus.results.some(x => x.entry.kind !== 'live'), JSON.stringify(titles(bus)));
});

test('perguntas de preço acham o assunto, não palavras parecidas', () => {
  assert.match(search(prepared.pt, 'quanto custa o estacionamento').results[0].entry.title, /estacionamento/i);
  assert.ok(titles(search(prepared.es, 'cuanto cuesta el estacionamiento')).some(t => /estacionamiento/i.test(t)));
  assert.ok(titles(search(prepared.en, 'how much does parking cost')).some(t => /parking/i.test(t)));
});

test('palavras só de pergunta viram consulta vazia nos 3 idiomas', () => {
  assert.deepEqual(search(prepared.pt, 'quanto custa').tokens, []);
  assert.deepEqual(search(prepared.es, 'cuanto cuesta es').tokens, []);
  assert.deepEqual(search(prepared.en, 'how much does it cost to be').tokens, []);
});

test('palavra que existe no índice não é "corrigida" para outra', () => {
  const cases = [['pt', 'porto', ['ponto', 'perto', 'parto', 'porta']], ['pt', 'festa', ['feita', 'nesta', 'desta']],
    ['es', 'playa', ['plaza']], ['en', 'party', ['part']]];
  for (const [lang, q, neighbors] of cases) {
    const matched = search(prepared[lang], q).results.flatMap(x => x.matched);
    assert.ok(!matched.some(w => neighbors.includes(w)), `${q}: ${JSON.stringify([...new Set(matched)])}`);
  }
});

test('plural encontra o singular nos 3 idiomas', () => {
  // Some result must have the singular and not the plural: only the plural→singular rule can find it.
  const singularOnly = (r, singular, plural) => r.results.some(x => {
    const all = `${x.entry.title} ${x.entry.keywords} ${x.entry.text}`;
    return new RegExp(`\\b${singular}\\b`, 'i').test(all) && !new RegExp(`\\b${plural}\\b`, 'i').test(all);
  });
  const limites = search(prepared.pt, 'limites');
  assert.ok(titles(limites).includes('Qual é o limite de bagagem da MSC?'));
  assert.ok(singularOnly(limites, 'limite', 'limites'));
  assert.ok(singularOnly(search(prepared.pt, 'navios'), 'navio', 'navios'));
  assert.ok(singularOnly(search(prepared.en, 'passengers'), 'passenger', 'passengers'));
  // Few ES entries contain "permiso(s)" (1 since the Lote 3 retranslation); results once included typo noise ("premios").
  const permisos = search(prepared.es, 'permisos');
  const ids = permisos.results.map(x => x.entry.id);
  const withWord = read('assets/data/search-index.es.json').entries.filter(e => /\bpermisos?\b/i.test(`${e.title} ${e.keywords} ${e.text}`));
  assert.ok(withWord.length >= 1 && withWord.every(e => ids.includes(e.id)), JSON.stringify(ids));
  assert.equal(ids.length, withWord.length, JSON.stringify(ids));
  assert.ok(singularOnly(permisos, 'permiso', 'permisos'));
});

test('"são" continua sendo termo de busca (São Paulo)', () => {
  const r = search(prepared.pt, 'são paulo');
  assert.deepEqual(r.tokens, ['sao', 'paulo']);
  assert.match(r.results[0].entry.title, /São Paulo/);
});

test('sinônimo só é informado quando a palavra digitada não casou na entrada', () => {
  const r = search(prepared.pt, 'documentos');
  assert.ok(r.results[0].matched.some(w => w.startsWith('documento')));
  assert.ok(!r.synonymsUsed.includes('rg') && !r.synonymsUsed.includes('cnh'), JSON.stringify(r.synonymsUsed));
});

test('bônus de frase só vale para palavras inteiras do título', () => {
  const whole = search(prepared.pt, 'bagagem').results[0].score;
  const fragment = search(prepared.pt, 'bagag').results[0].score;
  assert.ok(whole - fragment >= 1.5, `${whole} vs ${fragment}`);
});

test('stopwords não gastam o limite de 8 palavras', () => {
  const r = search(prepared.pt, 'de da do das dos em no na nos bagagem');
  assert.deepEqual(r.tokens, ['bagagem']);
  assert.ok(r.results.length > 0);
});

test('EN e ES usam o próprio idioma', () => {
  assert.ok(titles(search(prepared.en, 'luggage')).some(t => /luggage/i.test(t)));
  assert.ok(titles(search(prepared.en, 'suitcase')).some(t => /luggage/i.test(t)));
  assert.ok(titles(search(prepared.es, 'equipaje')).some(t => /equipaje/i.test(t)));
  assert.ok(titles(search(prepared.es, 'maleta')).some(t => /equipaje/i.test(t)));
});

test('trecho contém a palavra casada e nunca fabrica HTML', () => {
  const r = search(prepared.pt, 'concais').results.find(x => /concais/i.test(x.entry.text));
  const s = snippetFor(r);
  assert.match(s, /Concais/i);
  assert.doesNotMatch(s, /</);
  const src = fs.readFileSync(new URL('../../assets/js/site-search-engine.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /innerHTML|eval\(|new Function/);
});

test('URLs entre subdomínios em produção e caminhos locais', () => {
  const faq = { page: 'manual', anchor: '#faq-o08' };
  assert.deepEqual(buildResultUrl(faq, { hostname: 'kriativosonboard.com.br', pathname: '/en/' }, 'en'),
    { href: 'https://manualdebordo.kriativosonboard.com.br/en/#faq-o08', samePage: false });
  assert.deepEqual(buildResultUrl({ page: 'bus', anchor: '#embarque' }, { hostname: 'manualdebordo.kriativosonboard.com.br', pathname: '/' }, 'pt'),
    { href: 'https://busao.kriativosonboard.com.br/#embarque', samePage: false });
  assert.deepEqual(buildResultUrl(faq, { hostname: '127.0.0.1', pathname: '/es/index.html' }, 'es'),
    { href: '/es/manual-de-bordo.html#faq-o08', samePage: false });
  assert.deepEqual(buildResultUrl({ page: 'home', anchor: '#faq-h03' }, { hostname: 'localhost', pathname: '/' }, 'pt'),
    { href: '/#faq-h03', samePage: true });
  assert.equal(currentPageFrom({ hostname: 'busao.kriativosonboard.com.br', pathname: '/en/' }), 'bus');
  assert.equal(currentPageFrom({ hostname: 'localhost', pathname: '/en/manual-de-bordo.html' }), 'manual');
  assert.equal(currentPageFrom({ hostname: 'kriativosonboard.com.br', pathname: '/es/' }), 'home');
});

test('perguntas comuns acham resposta: hotel, preço, possessivos e plural do sinônimo', () => {
  const cases = {
    pt: ['hotel', 'preço do ônibus', 'preço estacionamento', 'meus documentos', 'minhas malas'],
    en: ['bus price', 'parking price', 'hotel', 'my documents'],
    es: ['precio del bus', 'mis documentos', 'mis maletas', 'habitaciones', 'hotel']
  };
  for (const [lang, queries] of Object.entries(cases)) {
    for (const q of queries) assert.ok(search(prepared[lang], q).results.length > 0, `${lang}: ${q}`);
  }
  assert.ok(titles(search(prepared.pt, 'hotel')).some(t => /ibis|novotel|hospedagem/i.test(t)), JSON.stringify(titles(search(prepared.pt, 'hotel'))));
});

test('destaque e trecho só em começo de palavra', async () => {
  const { highlightParts } = await import('../../assets/js/site-search-engine.js');
  const parts = highlightParts('A carga de 12x exige o RG e 2 vias', 'rg 2');
  assert.deepEqual(parts.filter(p => p.match).map(p => p.text), ['RG', '2']);
  assert.equal(parts.map(p => p.text).join(''), 'A carga de 12x exige o RG e 2 vias');
  const text = `${'A carga segue. '.repeat(20)}Traga o RG válido.`;
  const snippet = snippetFor({ entry: { text }, matched: ['rg'] }, 30);
  assert.match(snippet, /RG válido/);
});

test('o rótulo de cada "Mais procurados" acha o próprio destino', () => {
  for (const lang of ['pt', 'en', 'es']) {
    for (const item of synonyms[lang].featured) {
      const top = search(prepared[lang], item.label).results.slice(0, 5).map(r => `${r.entry.page}${r.entry.anchor}`);
      assert.ok(top.includes(`${item.page}${item.anchor}`), `${lang} "${item.label}": ${JSON.stringify(top)}`);
    }
  }
});

test('destino: nome da página em cima e da seção embaixo, para todo resultado nos 3 idiomas', () => {
  for (const lang of ['pt', 'en', 'es']) {
    const all = [...read(`assets/data/search-index.${lang}.json`).entries, ...synonyms[lang].featured];
    for (const entry of all) {
      const { label, name } = destinationFor(entry, lang);
      assert.ok(label && name, `${lang} ${entry.page} ${entry.anchor}: ${JSON.stringify({ label, name })}`);
      if (entry.anchor.startsWith('#live-')) {
        assert.match(name, /^\d{2}:\d{2}:\d{2}$/, `${lang} ${entry.anchor}: complete live timestamp`);
      }
    }
  }
  assert.deepEqual(destinationFor({ page: 'manual', kind: 'faq', anchor: '#faq-o08' }, 'pt'), { label: 'Manual de Bordo', name: 'Dúvidas' });
  assert.deepEqual(destinationFor({ page: 'bus', kind: 'section', anchor: '#embarque' }, 'pt'), { label: 'Busão Kriativo', name: 'Embarque' });
  assert.deepEqual(destinationFor({ page: 'home', kind: 'section', anchor: '#panel-bebidas' }, 'en'), { label: 'Kriativos On Board', name: 'Pricing' });
  assert.deepEqual(destinationFor({ page: 'manual', kind: 'section', anchor: '#cronograma-bordo' }, 'es'), { label: 'Manual de a bordo', name: 'Cronograma' });
  assert.deepEqual(destinationFor({ page: 'manual', kind: 'live', anchor: '#live-1765', time: '00:29:25' }, 'pt'), { label: 'Live de Embarque', name: '00:29:25' });
  assert.deepEqual(destinationFor({ page: 'manual', kind: 'live', anchor: '#live-4481', time: '01:14:41' }, 'en'), { label: 'Boarding Live', name: '01:14:41' });
});
