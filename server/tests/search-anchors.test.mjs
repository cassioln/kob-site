import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');

for (const prefix of ['', 'en/', 'es/']) {
  test(`${prefix || 'pt/'} home: 34 perguntas do FAQ com ids faq-h01…faq-h34 em ordem`, () => {
    const html = read(`${prefix}index.html`);
    const start = html.indexOf('id="faq" aria-labelledby');
    const block = html.slice(start, html.indexOf('id="parceiros"', start));
    const ids = [...block.matchAll(/<details id="(faq-h\d{2})">/g)].map(m => m[1]);
    assert.deepEqual(ids, Array.from({ length: 34 }, (_, i) => `faq-h${String(i + 1).padStart(2, '0')}`));
    assert.equal((block.match(/<details[\s>]/g) || []).length, 34);
  });

  test(`${prefix || 'pt/'} busão: âncoras de seção existem e os links do rodapé têm alvo`, () => {
    const html = read(`${prefix}onibus.html`);
    assert.match(html, /<section id="como-reservar" class="bus-intro"/);
    assert.match(html, /<section id="passageiros" class="bus-checkout"/);
    assert.match(html, /<section id="condicoes" class="bus-reassurance"/);
    assert.match(html, /<article id="embarque" class="bus-reassurance__card">/);
    assert.equal((html.match(/id="embarque"/g) || []).length, 1);
    for (const anchor of ['embarque', 'passageiros']) assert.match(html, new RegExp(`href="#${anchor}"`));
  });
}
