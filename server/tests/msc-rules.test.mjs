import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { prepareIndex, search, destinationFor } from '../../assets/js/site-search-engine.js';

const read = file => fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
const MANUALS = { pt: 'manual-de-bordo.html', en: 'en/manual-de-bordo.html', es: 'es/manual-de-bordo.html' };
const HOMES = { pt: 'index.html', en: 'en/index.html', es: 'es/index.html' };
const CARDS = ['bagagem', 'proibidos', 'bebidas', 'fumo', 'menores', 'seguranca', 'convivencia', 'consequencias'];
const MSC = { bagagem: 'https://www.msccruzeiros.com.br/gerenciar-reserva/antes-de-viajar/bagagem', conduta: 'https://www.msccruzeiros.com.br/-/media/brazil/documentos/codigo-de-conduta-hospedes.pdf' };

const section = html => html.slice(html.indexOf('<section class="guide-section msc-rules" id="regras-msc"'), html.indexOf('</section>', html.indexOf('id="regras-msc"')));

test('Regras da MSC: mesma seção, 8 cards na mesma ordem e fontes oficiais nos 3 idiomas', () => {
  for (const [lang, file] of Object.entries(MANUALS)) {
    const html = read(file);
    const block = section(html);
    assert.ok(block.length > 1000, `${lang}: seção #regras-msc não encontrada`);
    assert.deepEqual([...block.matchAll(/<article class="msc-rules__card" id="regras-([a-z]+)"/g)].map(m => m[1]), CARDS, lang);
    for (const url of Object.values(MSC)) {
      assert.match(block, new RegExp(`<a href="${url.replace(/[.?]/g, '\\$&')}" target="_blank" rel="noopener noreferrer">`), `${lang}: fonte ${url}`);
    }
    assert.match(block, /<time datetime="2026-10-09">/, `${lang}: data de conferência`);
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
    assert.match(details, new RegExp(`<a href="${MSC.bagagem}" target="_blank" rel="noopener noreferrer">`), lang);
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
