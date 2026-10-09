import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { prepareIndex, search, destinationFor } from '../../assets/js/site-search-engine.js';

const read = file => fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
const MANUALS = { pt: 'manual-de-bordo.html', en: 'en/manual-de-bordo.html', es: 'es/manual-de-bordo.html' };
const HOMES = { pt: 'index.html', en: 'en/index.html', es: 'es/index.html' };
const CARDS = ['bagagem', 'proibidos', 'bebidas', 'fumo', 'menores', 'seguranca', 'convivencia', 'consequencias'];
const MSC = { bagagem: 'https://www.msccruzeiros.com.br/gerenciar-reserva/antes-de-viajar/bagagem?utm_source=kriativosonboard', conduta: 'https://www.msccruzeiros.com.br/-/media/brazil/documentos/codigo-de-conduta-hospedes.pdf' };

// The PT page is the reference for the sequence of rule marks (allowed / not allowed / how it works).
const RULE_MARKS = (() => {
  const html = fs.readFileSync(new URL('../../manual-de-bordo.html', import.meta.url), 'utf8');
  const start = html.indexOf('id="regras-msc"');
  return [...html.slice(start, html.indexOf('</section>', start)).matchAll(/<li class="msc-rule msc-rule--(yes|no|info)">/g)].map(m => m[1]).join();
})();

const section = html => html.slice(html.indexOf('<section class="guide-section msc-rules" id="regras-msc"'), html.indexOf('</section>', html.indexOf('id="regras-msc"')));

test('Regras da MSC: mesmo quadro, 8 temas com abas, mesmas regras e fontes oficiais nos 3 idiomas', () => {
  for (const [lang, file] of Object.entries(MANUALS)) {
    const html = read(file);
    const block = section(html);
    assert.ok(block.length > 1000, `${lang}: seção #regras-msc não encontrada`);
    assert.deepEqual([...block.matchAll(/<article class="msc-rules__panel" id="regras-([a-z]+)" role="tabpanel"/g)].map(m => m[1]), CARDS, lang);
    // Every topic has its tab, pointing at its panel, in the same order.
    assert.deepEqual([...block.matchAll(/role="tab" id="regras-([a-z]+)-tab" aria-controls="regras-\1"/g)].map(m => m[1]), CARDS, `${lang}: abas`);
    // Same rules in every language: count and status of each row, topic by topic.
    const marks = [...block.matchAll(/<li class="msc-rule msc-rule--(yes|no|info)">/g)].map(m => m[1]).join();
    assert.equal(marks, RULE_MARKS, `${lang}: sinais das regras`);
    for (const url of Object.values(MSC)) {
      assert.match(block, new RegExp(`<a href="${url.replace(/[.?]/g, '\\$&')}" target="_blank" rel="noopener noreferrer">`), `${lang}: fonte ${url}`);
    }
    assert.match(block, /<time datetime="2026-10-09">/, `${lang}: data de conferência`);
    // The legend sits above the board, outside it.
    const legend = block.indexOf('class="msc-rules__legend"');
    assert.ok(legend > 0 && legend < block.indexOf('data-msc-rules'), `${lang}: legenda fora do quadro`);
    // Menu, drawer and footer lead to the section; the FAQs on luggage and prohibited items lead to their card.
    assert.equal((html.match(/href="#regras-msc"/g) || []).length, 3, `${lang}: links para a seção`);
    for (const [faq, card] of [['faq-o08', 'bagagem'], ['faq-o10', 'proibidos']]) {
      const details = html.slice(html.indexOf(`id="${faq}"`), html.indexOf('</details>', html.indexOf(`id="${faq}"`)));
      assert.match(details, new RegExp(`href="#regras-${card}"`), `${lang} ${faq}`);
    }
  }
});

test('FAQ da home sobre itens proibidos leva à lista oficial da MSC, em nova janela', () => {
  for (const [lang, file] of Object.entries(HOMES)) {
    const html = read(file);
    const details = html.slice(html.indexOf('id="faq-h33"'), html.indexOf('</details>', html.indexOf('id="faq-h33"')));
    assert.match(details, new RegExp(`<a href="${MSC.bagagem.replace(/[.?]/g, '\\$&')}" target="_blank" rel="noopener noreferrer">`), lang);
    assert.match(details, /class="sr-only"/, `${lang}: aviso de nova janela para leitor de tela`);
  }
});

test('a busca acha os cards das regras e mostra "Regras MSC" como destino', () => {
  const synonyms = JSON.parse(read('assets/data/search-synonyms.json'));
  for (const [lang, query, name] of [['pt', 'fumar', 'Regras MSC'], ['pt', 'cigarro', 'Regras MSC'], ['en', 'smoking', 'MSC Rules'], ['es', 'fumar', 'Reglas de MSC']]) {
    const prepared = prepareIndex(JSON.parse(read(`assets/data/search-index.${lang}.json`)).entries, synonyms[lang]);
    const [first] = search(prepared, query).results;
    assert.equal(first?.entry.anchor, '#regras-fumo', `${lang} "${query}"`);
    assert.equal(destinationFor(first.entry, lang).name, name);
  }
  const pt = prepareIndex(JSON.parse(read('assets/data/search-index.pt.json')).entries, synonyms.pt);
  assert.ok(search(pt, 'menor desacompanhado').results.some(r => r.entry.anchor === '#regras-menores'));
  assert.ok(search(pt, 'espreguiçadeira').results.some(r => r.entry.anchor === '#regras-convivencia'));
});
