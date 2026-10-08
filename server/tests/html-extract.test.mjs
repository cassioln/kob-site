import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHtml, textOf, findAll, findFirst, hasClass, closest, byId, decodeEntities } from '../../scripts/lib/html-extract.mjs';

test('details e summary viram texto limpo, com entidades decodificadas', () => {
  const root = parseHtml('<details id="faq-h01"><summary>Qual &amp; quando?<span aria-hidden="true"></span></summary><div>Embarque&nbsp;às 9h &#8212; ok</div></details>');
  const details = byId(root, 'faq-h01');
  const summary = findFirst(details, n => n.tag === 'summary');
  assert.equal(textOf(summary), 'Qual & quando?');
  assert.equal(textOf(details, { skip: n => n.tag === 'summary' }), 'Embarque às 9h — ok');
});

test('elementos vazios não engolem os irmãos e svg autofechado também não', () => {
  const root = parseHtml('<label><input type="checkbox"> Texto</label><p>Depois</p><svg><path d="m1 1"/></svg><span>fim</span>');
  const p = findFirst(root, n => n.tag === 'p');
  assert.equal(p.parent.tag, '#root');
  assert.equal(textOf(findFirst(root, n => n.tag === 'label')), 'Texto');
  assert.equal(findFirst(root, n => n.tag === 'span').parent.tag, '#root');
});

test('script, style e comentários ficam fora do texto e da árvore', () => {
  const root = parseHtml('<!-- nota --><script>var a = "<p>x</p>";</script><style>p{}</style><p>y</p>');
  assert.equal(findAll(root, n => n.tag === 'p').length, 1);
  assert.equal(textOf(root), 'y');
});

test('atributos com aspas duplas, simples, sem aspas e booleanos', () => {
  const root = parseHtml(`<div class="a  b" data-x='1' id=z hidden title="R&amp;D"></div>`);
  const div = byId(root, 'z');
  assert.deepEqual(div.attrs, { class: 'a  b', 'data-x': '1', id: 'z', hidden: '', title: 'R&D' });
  assert.ok(hasClass(div, 'b'));
  assert.ok(!hasClass(div, 'c'));
});

test('elementos ganham espaço antes e depois; só a formatação inline cola', () => {
  assert.equal(textOf(parseHtml('<p>A</p><p>B</p>')), 'A B');
  assert.equal(textOf(parseHtml('<b>A</b><i>B</i>')), 'AB');
  assert.equal(textOf(parseHtml('<li>A</li><li>B<br>C</li>')), 'A B C');
  assert.equal(textOf(parseHtml('<strong>A</strong><small>B</small>')), 'A B');
  assert.equal(textOf(parseHtml('<span>A</span><span>B</span>')), 'A B');
  assert.equal(textOf(parseHtml('Intro<p>Para</p>')), 'Intro Para');
  assert.equal(textOf(parseHtml('pal<a href="#">avra</a> <em>x</em>y')), 'palavra xy');
});

test('o espaço entre elementos não separa pontuação do texto', () => {
  assert.equal(textOf(parseHtml('<span>229<span>,00</span></span>')), '229,00');
  assert.equal(textOf(parseHtml('<p><strong>100% confirmado</strong>. Depois (<span>x</span>)!</p>')), '100% confirmado. Depois (x)!');
});

test('subárvores aria-hidden="true" ficam fora do texto', () => {
  assert.equal(textOf(parseHtml('<li><span aria-hidden="true">01</span>Texto</li>')), 'Texto');
  assert.equal(textOf(parseHtml('<div><p>Visível</p><div aria-hidden="true"><p>Duplicado</p></div></div>')), 'Visível');
});

test('closest sobe pelos ancestrais e fechamento sem par é ignorado', () => {
  const root = parseHtml('<section id="s"><div class="card"><h3>T</h3></div></span></section><p>x</p>');
  const h3 = findFirst(root, n => n.tag === 'h3');
  assert.equal(closest(h3, n => hasClass(n, 'card')).tag, 'div');
  assert.equal(closest(h3, n => n.attrs?.id === 's').tag, 'section');
  assert.equal(findFirst(root, n => n.tag === 'p').parent.tag, '#root');
});

test('decodeEntities cobre nomeadas, decimais e hexadecimais', () => {
  assert.equal(decodeEntities('&lt;a&gt; &quot;x&quot; &#39;y&#39; &#x2192; &hellip; &desconhecida;'), '<a> "x" \'y\' → … &desconhecida;');
});
