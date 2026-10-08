import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { prepareIndex, search, snippetFor, buildResultUrl, currentPageFrom, damerauLevenshtein } from '../../assets/js/site-search-engine.js';

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
