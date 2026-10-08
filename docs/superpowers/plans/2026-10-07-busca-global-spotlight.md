# Busca global "Bilhete de embarque" — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma busca única (⌘K / Ctrl+K e lupa no header) que encontra conteúdo da home, do busão, do manual e da transcrição da live, em PT/EN/ES, e leva a pessoa direto ao ponto certo.

**Architecture:** Um script Node gera um índice JSON por idioma a partir dos HTMLs e dos dados da live; um motor de busca em funções puras (sem DOM) ranqueia e destaca; um módulo de interface monta o `<dialog>` "Bilhete de embarque", trata teclado, URLs entre subdomínios e a chegada no destino. Tudo estático, sem build no site publicado e sem dependência nova.

**Tech Stack:** HTML estático, CSS, ES modules no navegador, Node 22 (`node:test`), Playwright 1.61 (já instalado).

**Spec:** `docs/superpowers/specs/2026-10-07-busca-global-spotlight-design.md` (leia antes de começar).

## Global Constraints

- Paridade PT/EN/ES em toda mudança visível: mesmo markup, mesmos atributos acessíveis, textos traduzidos (`AGENTS.md`).
- Sem dependência nova em `package.json` (o registro npm está bloqueado neste ambiente).
- Versão de cache de arquivos novos/alterados: `?v=20261008-busca`.
- Textos aprovados: canhoto "Pesquisa no site" / "Search the site" / "Buscar en el sitio"; campo "O que você procura?" / "What are you looking for?" / "¿Qué estás buscando?"; estado inicial "Mais procurados" / "Most searched" / "Lo más buscado"; botão "Buscar" / "Search" / "Buscar".
- Atalho: ⌘K em Mac/iOS, Ctrl+K nos demais; nunca com Alt (AltGr no Windows é Ctrl+Alt).
- Nunca usar `innerHTML` com texto do índice ou da consulta; montar nós com `textContent`.
- Nunca push na `main` (dispara deploy FTP). Commits só na branch do worktree.
- Termos de marca intactos: Kriativos On Board, KOB, Busão, Royal Trip, MSC Musica, Board Game Guru.

## Ambiente de execução (leia antes de qualquer comando)

- Trabalhe em `/Users/cassio/GitHubPessoal/kob-site/.claude/worktrees/busca-global`. Não use `cd` para fora dele.
- O Bash deste worktree recusa heredocs, variáveis em posição de opção e comandos encadeados complexos. Crie arquivos (inclusive scripts auxiliares descartáveis em `/tmp/claude/`) com a ferramenta de escrita e rode comandos simples, um por vez.
- Testes Node: `node --test server/tests/<arquivo>.test.mjs` (roda no Bash).
- Testes Playwright **não** rodam no Bash (sandbox bloqueia porta local). Rode pelo terminal do app (`mcp__terminal__run_in_terminal`) com a config privada já criada:
  `cd /Users/cassio/GitHubPessoal/kob-site/.claude/worktrees/busca-global && npx playwright test --config=/tmp/claude/pw-busca-4177.config.mjs analytics/tests/site-search.spec.js > /tmp/claude/pw-site-search.log 2>&1; echo "EXIT=$?" >> /tmp/claude/pw-site-search.log`
  e leia o resultado com `grep -v "^\[WebServer\]" /tmp/claude/pw-site-search.log | tail -40`.
- Commits: `git add <arquivos>` e `git commit -m "..."` em comandos separados. Mensagem no estilo do repo (`feat(busca): ...`, `test(busca): ...`) terminando com a linha `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

1. **Consulta só com stopwords ou 1 letra** ("de", "a", "o que"): deve mostrar o estado inicial ("Mais procurados"), não "Nada sobre…". Teste no Task 4 (`tokens` vazio) e no Task 5 (UI mostra "Mais procurados").
2. **Texto colado longo** (parágrafo de 300+ caracteres): a busca não pode travar; só as 8 primeiras palavras contam. Teste de tempo no Task 4.
3. **HTML/script na consulta** (`<img src=x onerror=alert(1)>`): renderizado como texto, nenhum elemento criado. Teste no Task 5.
4. **AltGr / Ctrl+Alt+K e Ctrl+K com foco em outro campo** (ex.: formulário do busão): Ctrl+Alt+K não abre; Ctrl+K abre mesmo com foco em um input. Testes nos Tasks 5 e 6.
5. **Índice indisponível** (falha de rede ou 404): estado de erro com "Tentar de novo" que funciona, sem buscar duas vezes ao abrir/fechar rápido. Teste no Task 5.

---

### Task 1: Extrator de HTML mínimo

**Files:**
- Create: `scripts/lib/html-extract.mjs`
- Test: `server/tests/html-extract.test.mjs`

**Interfaces:**
- Produces:
  - `parseHtml(html: string) => Node` — raiz `{ tag: '#root', attrs: {}, children: Node[], parent: null }`; elementos `{ tag, attrs, children, parent }` (tag minúscula); texto `{ tag: '#text', text, parent }` (entidades já decodificadas). `script`/`style` não geram filhos (conteúdo em `raw`).
  - `textOf(node, { skip?: (node) => boolean } = {}) => string` — texto com espaços normalizados; ignora `script`, `style`, `svg` e nós para os quais `skip` retorna true; insere espaço após elementos de bloco.
  - `findAll(node, pred) => Node[]`, `findFirst(node, pred) => Node | null` (só elementos, ordem do documento).
  - `hasClass(node, cls) => boolean`, `closest(node, pred) => Node | null` (inclui o próprio nó), `byId(root, id) => Node | null`.
  - `decodeEntities(text) => string`.

- [ ] **Step 1: Write the failing test**

Crie `server/tests/html-extract.test.mjs`:

```js
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

test('blocos ganham espaço entre si, inline não', () => {
  assert.equal(textOf(parseHtml('<p>A</p><p>B</p>')), 'A B');
  assert.equal(textOf(parseHtml('<b>A</b><i>B</i>')), 'AB');
  assert.equal(textOf(parseHtml('<li>A</li><li>B<br>C</li>')), 'A B C');
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test server/tests/html-extract.test.mjs`
Expected: FAIL com `Cannot find module` para `scripts/lib/html-extract.mjs`.

- [ ] **Step 3: Write minimal implementation**

Crie `scripts/lib/html-extract.mjs`:

```js
// Extrator mínimo para o HTML do próprio projeto (bem formado); usado só no build do índice.
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style']);
const SKIP_TEXT = new Set(['script', 'style', 'svg', 'template']);
const BLOCK = new Set(['address', 'article', 'aside', 'blockquote', 'dd', 'details', 'div', 'dl', 'dt', 'figcaption', 'figure', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'label', 'li', 'main', 'nav', 'ol', 'p', 'section', 'small', 'summary', 'table', 'td', 'th', 'tr', 'ul']);
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…', laquo: '«', raquo: '»', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', middot: '·', copy: '©', reg: '®', trade: '™', times: '×', rarr: '→', larr: '←' };

export function decodeEntities(text) {
  return String(text).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
    if (code[0] === '#') {
      const value = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(value) ? String.fromCodePoint(value) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

function parseAttrs(source) {
  const attrs = {};
  for (const m of source.matchAll(/([^\s=/"'>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
    attrs[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return attrs;
}

export function parseHtml(html) {
  const root = { tag: '#root', attrs: {}, children: [], parent: null };
  const lower = html.toLowerCase();
  const tagPattern = /<!--[\s\S]*?-->|<![^>]*>|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s=/"'>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>/g;
  let current = root;
  let last = 0;
  let m;
  const pushText = text => { if (text) current.children.push({ tag: '#text', text: decodeEntities(text), parent: current }); };
  while ((m = tagPattern.exec(html))) {
    pushText(html.slice(last, m.index));
    last = tagPattern.lastIndex;
    if (m[0].startsWith('<!')) continue;
    if (m[1]) {
      const tag = m[1].toLowerCase();
      let node = current;
      while (node && node.tag !== tag) node = node.parent;
      if (node && node.parent) current = node.parent;
      continue;
    }
    const tag = m[2].toLowerCase();
    const element = { tag, attrs: parseAttrs(m[3] || ''), children: [], parent: current };
    current.children.push(element);
    if (RAW.has(tag)) {
      const end = lower.indexOf(`</${tag}`, last);
      const stop = end === -1 ? html.length : end;
      element.raw = html.slice(last, stop);
      const close = html.indexOf('>', stop);
      last = tagPattern.lastIndex = close === -1 ? html.length : close + 1;
      continue;
    }
    if (VOID.has(tag) || m[4] === '/') continue;
    current = element;
  }
  pushText(html.slice(last));
  return root;
}

export function textOf(node, { skip } = {}) {
  const parts = [];
  (function walk(n) {
    if (n.tag === '#text') { parts.push(n.text); return; }
    if (SKIP_TEXT.has(n.tag) || (skip && n !== node && skip(n))) return;
    if (n.tag === 'br') { parts.push(' '); return; }
    for (const child of n.children) walk(child);
    if (BLOCK.has(n.tag)) parts.push(' ');
  })(node);
  return parts.join('').replace(/\s+/g, ' ').trim();
}

export function findAll(node, pred, out = []) {
  for (const child of node.children || []) {
    if (child.tag === '#text') continue;
    if (pred(child)) out.push(child);
    findAll(child, pred, out);
  }
  return out;
}

export function findFirst(node, pred) {
  for (const child of node.children || []) {
    if (child.tag === '#text') continue;
    if (pred(child)) return child;
    const found = findFirst(child, pred);
    if (found) return found;
  }
  return null;
}

export const hasClass = (node, cls) => ` ${node?.attrs?.class || ''} `.replace(/\s+/g, ' ').includes(` ${cls} `);

export function closest(node, pred) {
  for (let n = node; n && n.tag !== '#root'; n = n.parent) if (pred(n)) return n;
  return null;
}

export const byId = (root, id) => findFirst(root, n => n.attrs.id === id);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test server/tests/html-extract.test.mjs`
Expected: PASS (7 testes).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/html-extract.mjs server/tests/html-extract.test.mjs
git commit -m "feat(busca): extrator mínimo de HTML para o índice da busca"
```

---

### Task 2: Âncoras estáveis na home e no busão (3 idiomas)

**Files:**
- Modify: `index.html`, `en/index.html`, `es/index.html` (os 34 `<details>` do FAQ, dentro de `<section ... id="faq">`)
- Modify: `onibus.html`, `en/onibus.html`, `es/onibus.html` (seções `.bus-intro`, `.bus-checkout`, `.bus-reassurance` e o 3º `article.bus-reassurance__card`)
- Test: `server/tests/search-anchors.test.mjs`

**Interfaces:**
- Produces: ids `faq-h01`…`faq-h34` na home (mesma ordem nos 3 idiomas); ids `como-reservar`, `passageiros`, `condicoes`, `embarque` no busão. Os links `#embarque` e `#passageiros` que já existem no rodapé do busão passam a ter alvo.

- [ ] **Step 1: Write the failing test**

Crie `server/tests/search-anchors.test.mjs`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test server/tests/search-anchors.test.mjs`
Expected: FAIL (ids ausentes).

- [ ] **Step 3: Write minimal implementation**

Crie o script descartável `/tmp/claude/add-search-anchors.mjs` (não é commitado):

```js
import fs from 'node:fs';
const root = '/Users/cassio/GitHubPessoal/kob-site/.claude/worktrees/busca-global/';
for (const prefix of ['', 'en/', 'es/']) {
  const homeFile = root + prefix + 'index.html';
  const home = fs.readFileSync(homeFile, 'utf8');
  const start = home.indexOf('id="faq" aria-labelledby');
  const end = home.indexOf('id="parceiros"', start);
  let n = 0;
  const block = home.slice(start, end).replace(/<details>/g, () => `<details id="faq-h${String(++n).padStart(2, '0')}">`);
  if (n !== 34) throw new Error(`${homeFile}: ${n} details`);
  fs.writeFileSync(homeFile, home.slice(0, start) + block + home.slice(end));

  const busFile = root + prefix + 'onibus.html';
  let bus = fs.readFileSync(busFile, 'utf8');
  const swaps = [
    ['<section class="bus-intro"', '<section id="como-reservar" class="bus-intro"'],
    ['<section class="bus-checkout"', '<section id="passageiros" class="bus-checkout"'],
    ['<section class="bus-reassurance"', '<section id="condicoes" class="bus-reassurance"']
  ];
  for (const [from, to] of swaps) {
    if (!bus.includes(from)) throw new Error(`${busFile}: ${from}`);
    bus = bus.replace(from, to);
  }
  let cards = 0;
  bus = bus.replace(/<article class="bus-reassurance__card">/g, match => (++cards === 3 ? '<article id="embarque" class="bus-reassurance__card">' : match));
  if (cards !== 3) throw new Error(`${busFile}: ${cards} cards`);
  fs.writeFileSync(busFile, bus);
}
console.log('ok');
```

Run: `node /tmp/claude/add-search-anchors.mjs`
Expected: `ok`. Depois confira com `git diff --stat` que só os 6 HTMLs mudaram, e com `git diff onibus.html` que o 3º cartão é o de "Transporte completo de ida e volta" (EN "Complete round-trip shuttle", ES "Transporte completo de ida y vuelta").

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test server/tests/search-anchors.test.mjs`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add index.html en/index.html es/index.html onibus.html en/onibus.html es/onibus.html server/tests/search-anchors.test.mjs
git commit -m "feat(busca): âncoras estáveis no FAQ da home e nas seções do busão"
```

---

### Task 3: Gerador do índice, sinônimos e checagem no CI

**Files:**
- Create: `scripts/build-search-index.mjs`
- Create: `assets/data/search-synonyms.json`
- Create (gerados): `assets/data/search-index.pt.json`, `assets/data/search-index.en.json`, `assets/data/search-index.es.json`
- Modify: `package.json` (script `build:search-index`)
- Test: `server/tests/search-index.test.mjs`

**Interfaces:**
- Consumes: `parseHtml`, `textOf`, `findAll`, `findFirst`, `hasClass`, `closest`, `byId` (Task 1); ids do Task 2; `CHAPTERS` de `assets/js/manual-de-bordo-live-data.js` (`{ seconds, time, titles[lang], keywords, transcripts[lang], notice?[lang] }`).
- Produces:
  - `buildIndex(lang: 'pt'|'en'|'es') => Promise<{ lang, entries: Entry[] }>` e `serializeIndex(index) => string`, `LANGS`.
  - `Entry = { id, page: 'home'|'bus'|'manual', kind: 'faq'|'section'|'checklist'|'live', title, text, keywords, anchor, time }` (`time` só na live, ex. `"00:20:50"`; senão `null`).
  - Ids: `home-faq-h01`, `manual-faq-o08`, `manual-check-<data-checklist-id>`, `live-<segundos>`, `<page>-sec-<id>-<n>` (n=0 título da seção, 1.. partes).
  - `assets/data/search-synonyms.json` = `{ pt|en|es: { stopwords: string[], groups: string[][], featured: { label, page, anchor, time? }[] } }`.

- [ ] **Step 1: Write the failing test**

Crie `server/tests/search-index.test.mjs`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test server/tests/search-index.test.mjs`
Expected: FAIL com `Cannot find module` para `scripts/build-search-index.mjs`.

- [ ] **Step 3: Write minimal implementation**

Crie `scripts/build-search-index.mjs`:

```js
// Gera assets/data/search-index.{pt,en,es}.json a partir dos HTMLs e da live: `npm run build:search-index`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseHtml, textOf, findAll, findFirst, hasClass, closest, byId } from './lib/html-extract.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const LANGS = ['pt', 'en', 'es'];
const FILES = { home: 'index.html', bus: 'onibus.html', manual: 'manual-de-bordo.html' };
const SECTIONS = {
  home: [{ id: 'navio' }, { id: 'incluso' }, { id: 'itinerario' }, { id: 'valores' }, { id: 'hospedagem' }, { id: 'parceiros' }],
  manual: [{ id: 'cronograma' }, { id: 'jogos' }, { id: 'contato' }],
  bus: [
    { id: 'main', select: n => n.tag === 'section' && hasClass(n, 'bus-hero') },
    { id: 'como-reservar', parts: n => n.tag === 'li' && hasClass(n, 'bus-flow__step') },
    { id: 'condicoes', parts: n => n.tag === 'article' && hasClass(n, 'bus-reassurance__card') }
  ]
};

const load = (page, lang) => parseHtml(fs.readFileSync(path.join(ROOT, (lang === 'pt' ? '' : `${lang}/`) + FILES[page]), 'utf8'));
const clip = (text, max = 420) => (text.length > max ? `${text.slice(0, max).replace(/\s+\S*$/, '')} …` : text);
const entry = (fields) => ({ id: '', page: '', kind: '', title: '', text: '', keywords: '', anchor: '', time: null, ...fields });
const isHeading = n => /^h[1-4]$/.test(n.tag);

function homeFaq(root) {
  const section = byId(root, 'faq');
  return findAll(section, n => n.tag === 'details' && /^faq-h\d{2}$/.test(n.attrs.id || '')).map(details => entry({
    id: `home-${details.attrs.id}`, page: 'home', kind: 'faq',
    title: textOf(findFirst(details, n => n.tag === 'summary')),
    text: textOf(details, { skip: n => n.tag === 'summary' }),
    anchor: `#${details.attrs.id}`
  }));
}

function manualFaq(root) {
  const section = byId(root, 'duvidas');
  return findAll(section, n => n.tag === 'details' && /^faq-o\d{2}$/.test(n.attrs.id || '')).map(details => entry({
    id: `manual-${details.attrs.id}`, page: 'manual', kind: 'faq',
    title: textOf(findFirst(details, n => hasClass(n, 'faq-item__summary-title')) || findFirst(details, n => n.tag === 'summary')),
    text: textOf(details, { skip: n => n.tag === 'summary' || hasClass(n, 'faq-item__meta') }),
    anchor: `#${details.attrs.id}`
  }));
}

function checklist(root) {
  const seen = new Set();
  return findAll(root, n => n.tag === 'li' && n.attrs['data-checklist-id']).flatMap(item => {
    const id = item.attrs['data-checklist-id'];
    if (seen.has(id)) return [];
    seen.add(id);
    const label = findFirst(item, n => hasClass(n, 'checklist-item__text'));
    return [entry({ id: `manual-check-${id}`, page: 'manual', kind: 'checklist', title: textOf(label || item), anchor: '#checklist' })];
  });
}

function sections(root, page) {
  return SECTIONS[page].flatMap(config => {
    const section = config.select ? findFirst(root, config.select) : byId(root, config.id);
    if (!section) throw new Error(`${page}: seção ${config.id} não encontrada`);
    const heading = findFirst(section, n => n.tag === 'h1' || n.tag === 'h2');
    const head = heading?.parent || section;
    const out = [entry({
      id: `${page}-sec-${config.id}-0`, page, kind: 'section', anchor: `#${config.id}`,
      title: textOf(heading || section), text: clip(textOf(head, { skip: n => n === heading }))
    })];
    const parts = config.parts
      ? findAll(section, config.parts).map(node => ({ node, title: findFirst(node, n => isHeading(n) || n.tag === 'strong') }))
      : findAll(section, n => n.tag === 'h3').map(title => ({ node: title.parent, title }));
    parts.forEach(({ node, title }, i) => {
      const owner = closest(node, n => n !== section && n.attrs.id && closest(n, x => x === section));
      out.push(entry({
        id: `${page}-sec-${config.id}-${i + 1}`, page, kind: 'section', anchor: `#${owner ? owner.attrs.id : config.id}`,
        title: textOf(title || node), text: clip(textOf(node, { skip: n => n === title }))
      }));
    });
    return out;
  });
}

async function live(lang) {
  const { CHAPTERS } = await import(pathToFileURL(path.join(ROOT, 'assets/js/manual-de-bordo-live-data.js')).href);
  return CHAPTERS.map(chapter => entry({
    id: `live-${chapter.seconds}`, page: 'manual', kind: 'live',
    title: chapter.titles[lang] || chapter.titles.pt,
    text: [chapter.transcripts[lang] || chapter.transcripts.pt, chapter.notice?.[lang]].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim(),
    keywords: chapter.keywords || '', anchor: `#live-${chapter.seconds}`, time: chapter.time
  }));
}

export async function buildIndex(lang) {
  const home = load('home', lang);
  const bus = load('bus', lang);
  const manual = load('manual', lang);
  const entries = [
    ...manualFaq(manual), ...homeFaq(home),
    ...sections(home, 'home'), ...sections(bus, 'bus'), ...sections(manual, 'manual'),
    ...checklist(manual), ...(await live(lang))
  ];
  return { lang, entries };
}

export function serializeIndex(index) {
  return `{"lang":${JSON.stringify(index.lang)},"entries":[\n${index.entries.map(e => JSON.stringify(e)).join(',\n')}\n]}\n`;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  for (const lang of LANGS) {
    const index = await buildIndex(lang);
    fs.writeFileSync(path.join(ROOT, `assets/data/search-index.${lang}.json`), serializeIndex(index));
    console.log(`${lang}: ${index.entries.length} entradas`);
  }
}
```

Crie `assets/data/search-synonyms.json` (palavras sem acento; o motor normaliza):

```json
{
  "pt": {
    "stopwords": ["as", "os", "de", "da", "do", "das", "dos", "em", "no", "na", "nos", "nas", "um", "uma", "para", "pra", "por", "com", "que", "se", "eu", "meu", "minha", "posso", "como", "qual", "quais", "sobre", "tem"],
    "groups": [
      ["mala", "malas", "bagagem", "bagagens", "franquia"],
      ["onibus", "busao", "fretado", "traslado", "transfer"],
      ["gravida", "gravidas", "gestante", "gestantes", "gestacao", "gravidez"],
      ["wifi", "internet"],
      ["bebida", "bebidas", "drink", "drinks", "alcool"],
      ["cabine", "cabines", "quarto", "camarote"],
      ["crianca", "criancas", "filho", "filhos", "infantil", "kids"],
      ["bebe", "bebes", "colo"],
      ["documento", "documentos", "rg", "cnh", "passaporte", "identidade"],
      ["dinheiro", "dolar", "dolares", "cartao", "pagamento", "gastos"],
      ["remedio", "remedios", "medicamento", "medicamentos"],
      ["jogo", "jogos", "boardgame", "tabuleiro"],
      ["estacionamento", "carro"],
      ["horario", "horarios", "hora"],
      ["roupa", "roupas", "traje", "vestimenta"],
      ["festa", "festas", "fantasia"],
      ["seguro", "seguros"],
      ["proibido", "proibidos", "proibe"]
    ],
    "featured": [
      { "label": "Documentos para embarcar", "page": "manual", "anchor": "#faq-o03" },
      { "label": "Horários e ponto do fretado", "page": "bus", "anchor": "#embarque" },
      { "label": "Limite de bagagem", "page": "manual", "anchor": "#faq-o08" },
      { "label": "Pacotes de bebidas", "page": "manual", "anchor": "#faq-o30" },
      { "label": "Assistir à live completa", "page": "manual", "anchor": "#live-833", "time": "00:13:53" }
    ]
  },
  "en": {
    "stopwords": ["an", "the", "of", "to", "in", "on", "for", "and", "or", "is", "are", "do", "does", "can", "my", "what", "how", "which", "about", "with"],
    "groups": [
      ["luggage", "baggage", "suitcase", "suitcases", "bag", "bags"],
      ["bus", "charter", "shuttle", "transfer", "busao"],
      ["pregnant", "pregnancy"],
      ["wifi", "internet"],
      ["drink", "drinks", "beverage", "beverages", "alcohol"],
      ["cabin", "cabins", "room", "stateroom"],
      ["kid", "kids", "child", "children"],
      ["baby", "babies", "infant"],
      ["document", "documents", "id", "passport", "rg", "cnh"],
      ["money", "cash", "dollar", "dollars", "card", "payment"],
      ["medicine", "medication", "medications"],
      ["game", "games", "boardgame"],
      ["parking", "car"],
      ["time", "times", "schedule", "hours"],
      ["clothes", "clothing", "dress", "outfit"],
      ["party", "parties", "costume"],
      ["insurance"],
      ["prohibited", "banned", "forbidden", "prohibits"]
    ],
    "featured": [
      { "label": "Documents for boarding", "page": "manual", "anchor": "#faq-o03" },
      { "label": "Charter bus times and meeting point", "page": "bus", "anchor": "#embarque" },
      { "label": "Luggage allowance", "page": "manual", "anchor": "#faq-o08" },
      { "label": "Drink packages", "page": "manual", "anchor": "#faq-o30" },
      { "label": "Watch the full live session", "page": "manual", "anchor": "#live-833", "time": "00:13:53" }
    ]
  },
  "es": {
    "stopwords": ["el", "la", "los", "las", "un", "una", "de", "del", "en", "al", "por", "para", "con", "que", "se", "mi", "como", "cual", "cuales", "puedo", "sobre", "hay"],
    "groups": [
      ["maleta", "maletas", "equipaje", "valija", "valijas"],
      ["bus", "autobus", "charter", "traslado", "busao"],
      ["embarazada", "embarazadas", "embarazo"],
      ["wifi", "internet"],
      ["bebida", "bebidas", "trago", "tragos", "alcohol"],
      ["camarote", "camarotes", "cabina", "habitacion"],
      ["nino", "ninos", "hijo", "hijos", "infantil"],
      ["bebe", "bebes"],
      ["documento", "documentos", "pasaporte", "rg", "cnh", "identidad"],
      ["dinero", "dolar", "dolares", "tarjeta", "pago"],
      ["medicamento", "medicamentos", "remedio", "remedios"],
      ["juego", "juegos"],
      ["estacionamiento", "auto", "coche", "carro"],
      ["horario", "horarios", "hora"],
      ["ropa", "vestimenta", "traje"],
      ["fiesta", "fiestas", "disfraz"],
      ["seguro"],
      ["prohibido", "prohibidos", "prohibe"]
    ],
    "featured": [
      { "label": "Documentos para embarcar", "page": "manual", "anchor": "#faq-o03" },
      { "label": "Horarios y punto del bus chárter", "page": "bus", "anchor": "#embarque" },
      { "label": "Límite de equipaje", "page": "manual", "anchor": "#faq-o08" },
      { "label": "Paquetes de bebidas", "page": "manual", "anchor": "#faq-o30" },
      { "label": "Ver la live completa", "page": "manual", "anchor": "#live-833", "time": "00:13:53" }
    ]
  }
}
```

Em `package.json`, dentro de `"scripts"`, logo depois de `"test:server"`, acrescente:

```json
    "build:search-index": "node scripts/build-search-index.mjs",
```

Gere os índices:

Run: `npm run build:search-index`
Expected: três linhas `pt: N entradas`, `en: N entradas`, `es: N entradas` com o **mesmo N** (≈ 180–220).

Abra `assets/data/search-index.pt.json` e confira 3 entradas à mão: `home-faq-h01` (título "Qual dia e horário do embarque?"), `bus-sec-condicoes-3` (âncora `#embarque`) e `live-833`. Se a paridade falhar (N diferente), compare as seções do idioma divergente — não altere o teste.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test server/tests/search-index.test.mjs`
Expected: PASS. Depois rode a suíte Node inteira: `npm run test:server` → todos passam.

- [ ] **Step 5: Commit**

```bash
git add scripts/build-search-index.mjs assets/data/search-synonyms.json assets/data/search-index.pt.json assets/data/search-index.en.json assets/data/search-index.es.json package.json server/tests/search-index.test.mjs
git commit -m "feat(busca): gerador do índice por idioma, sinônimos e checagem de atualização"
```

---

### Task 4: Motor de busca (funções puras)

**Files:**
- Create: `assets/js/site-search-engine.js`
- Test: `server/tests/site-search-engine.test.mjs`

**Interfaces:**
- Consumes: `normalizeSearch`, `highlightParts`, `excerpt` de `assets/js/manual-de-bordo-live-search.js` (importar com `?v=20261007-transcript-i18n`, igual ao módulo da live); índice e sinônimos do Task 3.
- Produces:
  - `prepareIndex(entries: Entry[], { groups = [], stopwords = [] } = {}) => Prepared`
  - `search(prepared, query: string, { limit = 20 } = {}) => { tokens: string[], results: { entry: Entry, score: number, matched: string[] }[], synonymsUsed: string[] }` — `tokens` vazio ⇒ mostrar estado inicial; `synonymsUsed` em forma legível (com acento), no máximo 2.
  - `snippetFor(result, radius = 90) => string`
  - `buildResultUrl({ page, anchor }, { hostname, pathname }, lang) => { href: string, samePage: boolean }`
  - `currentPageFrom({ hostname, pathname }) => 'home'|'bus'|'manual'`
  - `damerauLevenshtein(a, b, max = Infinity) => number`
  - Reexporta `highlightParts`.

- [ ] **Step 1: Write the failing test**

Crie `server/tests/site-search-engine.test.mjs`:

```js
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

test('EN e ES usam o próprio idioma', () => {
  assert.ok(titles(search(prepared.en, 'luggage')).some(t => /luggage/i.test(t)));
  assert.ok(titles(search(prepared.en, 'suitcase')).some(t => /luggage/i.test(t)));
  assert.ok(titles(search(prepared.es, 'equipaje')).some(t => /equipaje/i.test(t)));
  assert.ok(titles(search(prepared.es, 'maleta')).some(t => /equipaje/i.test(t)));
});

test('trecho contém a palavra casada e nunca fabrica HTML', () => {
  const r = search(prepared.pt, 'concais').results[0];
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test server/tests/site-search-engine.test.mjs`
Expected: FAIL com `Cannot find module` para `site-search-engine.js`.

- [ ] **Step 3: Write minimal implementation**

Crie `assets/js/site-search-engine.js`:

```js
import { normalizeSearch, highlightParts, excerpt } from './manual-de-bordo-live-search.js?v=20261007-transcript-i18n';

export { highlightParts };

const FIELD_WEIGHT = { title: 3, keywords: 2, text: 1 };
const KIND_WEIGHT = { section: 0.9, checklist: 0.85, live: 0.8 };
const FAQ_WEIGHT = { manual: 1, home: 0.95, bus: 0.95 };
const MAX_TOKENS = 8;
const HOSTS = { home: 'kriativosonboard.com.br', bus: 'busao.kriativosonboard.com.br', manual: 'manualdebordo.kriativosonboard.com.br' };
const LOCAL_FILES = { home: '', bus: 'onibus.html', manual: 'manual-de-bordo.html' };

const words = text => normalizeSearch(text).split(' ').filter(Boolean);

export function damerauLevenshtein(a, b, max = Infinity) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prevPrev = null;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (prevPrev && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) value = Math.min(value, prevPrev[j - 2] + 1);
      row.push(value);
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return max + 1;
    prevPrev = prev;
    prev = row;
  }
  return prev[b.length];
}

const fuzzyLimit = length => (length >= 8 ? 2 : length >= 4 ? 1 : 0);

export function prepareIndex(entries, { groups = [], stopwords = [] } = {}) {
  const vocabulary = new Set();
  const surface = new Map();
  const items = entries.map((entry, order) => {
    const fields = {};
    for (const name of Object.keys(FIELD_WEIGHT)) {
      const raw = entry[name] || '';
      fields[name] = new Set(words(raw));
      for (const original of raw.split(/[^\p{L}\p{N}]+/u)) {
        const norm = normalizeSearch(original);
        if (norm && !surface.has(norm)) surface.set(norm, original.toLocaleLowerCase());
      }
      for (const word of fields[name]) vocabulary.add(word);
    }
    const kindWeight = entry.kind === 'faq' ? FAQ_WEIGHT[entry.page] ?? 0.95 : KIND_WEIGHT[entry.kind] ?? 0.8;
    return { entry, order, fields, titleNorm: normalizeSearch(entry.title), kindWeight };
  });
  const synonyms = new Map();
  for (const group of groups) {
    const members = [...new Set(group.flatMap(words))];
    for (const word of members) {
      const set = synonyms.get(word) || new Set();
      for (const other of members) if (other !== word) set.add(other);
      synonyms.set(word, set);
    }
  }
  return { items, vocabulary: [...vocabulary], surface, synonyms, stopwords: new Set(stopwords.flatMap(words)), cache: new Map() };
}

function candidates(prepared, token) {
  if (prepared.cache.has(token)) return prepared.cache.get(token);
  const out = new Map();
  const limit = fuzzyLimit(token.length);
  for (const word of prepared.vocabulary) {
    let score = 0;
    if (word === token) score = 1;
    else if (token.length >= 3 && word.startsWith(token)) score = 0.8;
    else if (limit && Math.abs(word.length - token.length) <= limit && damerauLevenshtein(token, word, limit) <= limit) score = 0.55;
    if (score) out.set(word, score);
  }
  if (prepared.cache.size > 300) prepared.cache.clear();
  prepared.cache.set(token, out);
  return out;
}

function tokenize(prepared, query) {
  const all = words(query).filter(t => t.length > 1 || /\d/.test(t)).slice(0, MAX_TOKENS);
  return all.filter(t => !prepared.stopwords.has(t));
}

export function search(prepared, query, { limit = 20 } = {}) {
  const tokens = tokenize(prepared, query);
  if (!tokens.length) return { tokens, results: [], synonymsUsed: [] };
  const perToken = tokens.map(token => {
    const direct = candidates(prepared, token);
    const viaSynonym = new Map();
    for (const synonym of prepared.synonyms.get(token) || []) {
      for (const [word, score] of candidates(prepared, synonym)) {
        if (score < 0.8 || direct.has(word)) continue;
        const value = score * 0.9;
        if ((viaSynonym.get(word) ?? 0) < value) viaSynonym.set(word, value);
      }
    }
    return { direct, viaSynonym };
  });
  const phrase = normalizeSearch(query);
  const scored = [];
  for (const item of prepared.items) {
    let total = 0;
    const matched = new Set();
    const used = new Set();
    let complete = true;
    for (const { direct, viaSynonym } of perToken) {
      let best = 0;
      for (const [field, weight] of Object.entries(FIELD_WEIGHT)) {
        const set = item.fields[field];
        for (const [word, score] of direct) if (set.has(word)) { matched.add(word); best = Math.max(best, score * weight); }
        for (const [word, score] of viaSynonym) if (set.has(word)) { matched.add(word); used.add(word); best = Math.max(best, score * weight); }
      }
      if (!best) { complete = false; break; }
      total += best;
    }
    if (!complete) continue;
    if (phrase && item.titleNorm.includes(phrase)) total += 1.5;
    scored.push({ entry: item.entry, score: total * item.kindWeight, order: item.order, matched: [...matched], used });
  }
  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  const results = scored.slice(0, limit);
  const synonymsUsed = [...new Set(results.slice(0, 8).flatMap(r => [...r.used]))]
    .map(word => prepared.surface.get(word) || word).slice(0, 2);
  return { tokens, results: results.map(({ entry, score, matched }) => ({ entry, score, matched })), synonymsUsed };
}

export function snippetFor(result, radius = 90) {
  const text = result.entry.text || '';
  if (!text) return '';
  const found = excerpt(text, result.matched.join(' '), radius);
  if (found) return found;
  const limit = radius * 2;
  return text.length > limit ? `${text.slice(0, limit).replace(/\s+\S*$/, '')} …` : text;
}

export function currentPageFrom({ hostname = '', pathname = '/' } = {}) {
  if (/^(busao|onibus)\./i.test(hostname)) return 'bus';
  if (/^manualdebordo\./i.test(hostname)) return 'manual';
  if (/(^|\/)onibus\.html$/i.test(pathname)) return 'bus';
  if (/(^|\/)(manual-de-bordo\.html|manualdebordo\/?)$/i.test(pathname)) return 'manual';
  return 'home';
}

export function buildResultUrl({ page, anchor = '' }, { hostname = '', pathname = '/' } = {}, lang = 'pt') {
  const prefix = lang === 'pt' ? '' : `/${lang}`;
  const production = /(^|\.)kriativosonboard\.com\.br$/i.test(hostname);
  const base = production ? `https://${HOSTS[page]}${prefix}/` : `${prefix}/${LOCAL_FILES[page]}`;
  return { href: base + anchor, samePage: currentPageFrom({ hostname, pathname }) === page };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test server/tests/site-search-engine.test.mjs`
Expected: PASS (11 testes). Se o teste de ranking ("FAQ do manual vem antes da live") falhar, ajuste apenas os pesos documentados no spec (não o teste) e anote o motivo na mensagem de commit.

- [ ] **Step 5: Commit**

```bash
git add assets/js/site-search-engine.js server/tests/site-search-engine.test.mjs
git commit -m "feat(busca): motor com acento, prefixo, erro de digitação, sinônimos e ranking"
```

---

### Task 5: Interface "Bilhete de embarque" na home PT

**Files:**
- Create: `assets/js/site-search.js`
- Create: `assets/css/site-search.css`
- Modify: `index.html` (link CSS após o `main.css`, botão no início de `.nav__right`, `<script type="module">` antes de `</body>`)
- Test: `analytics/tests/site-search.spec.js`

**Interfaces:**
- Consumes: `prepareIndex`, `search`, `snippetFor`, `highlightParts`, `buildResultUrl` (Task 4); JSON do Task 3.
- Produces:
  - Qualquer elemento com `data-site-search-open` abre a busca; qualquer elemento com `data-site-search-kbd` recebe "⌘ K" ou "Ctrl K".
  - `<dialog class="site-search">` criado no primeiro uso, com `input.site-search__input` (`role="combobox"`), `ul#site-search-results` (`role="listbox"`), opções `li.site-search__option[role=option]` com `aria-selected`.
  - `goToAnchor(anchor)` exportado (usado pelo Task 7) e evento `CustomEvent('kob:live-seek', { detail: { seconds } })` para âncoras `#live-<s>` na mesma página.

- [ ] **Step 1: Write the failing test**

Crie `analytics/tests/site-search.spec.js`:

```js
import { expect, test } from '@playwright/test';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cookie_consent_status', 'denied'));
});

const dialog = page => page.locator('dialog.site-search');
const input = page => page.locator('.site-search__input');
const options = page => page.locator('#site-search-results [role="option"]');

test('botão abre o bilhete com "Mais procurados" e o foco no campo', async ({ page }) => {
  await page.goto('/');
  const trigger = page.locator('.nav__right [data-site-search-open]');
  await expect(trigger).toHaveAttribute('aria-label', 'Pesquisar no site');
  await trigger.click();
  await expect(dialog(page)).toBeVisible();
  await expect(input(page)).toBeFocused();
  await expect(input(page)).toHaveAttribute('placeholder', 'O que você procura?');
  await expect(page.locator('.site-search__where')).toHaveText('Pesquisa no site');
  await expect(page.locator('.site-search__lead')).toHaveText('Mais procurados');
  await expect(options(page)).toHaveCount(5);
  await expect(options(page).first()).toContainText('Documentos para embarcar');
});

test('"mala" mostra resultados de bagagem, sinônimo e destino', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  await input(page).fill('mala');
  await expect(page.locator('.site-search__synonyms')).toContainText('mala e bagagem');
  await expect(options(page).first()).toContainText(/bagagem/i);
  await expect(options(page).first().locator('.site-search__dest-name')).toHaveText('Manual');
  await expect(options(page).first()).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#site-search-status')).toContainText(/resultados?/);
});

test('setas mudam a opção ativa e Enter abre o manual na pergunta', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  await input(page).fill('limite bagagem');
  await expect(options(page).first()).toContainText('Qual é o limite de bagagem da MSC?');
  await page.keyboard.press('ArrowDown');
  await expect(options(page).nth(1)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await page.waitForURL(/\/manual-de-bordo\.html#faq-o08$/);
});

test('Ctrl+K alterna, Esc fecha e devolve o foco; Ctrl+Alt+K não abre', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+Alt+k');
  await expect(dialog(page)).toBeHidden();
  const trigger = page.locator('.nav__right [data-site-search-open]');
  await trigger.focus();
  await page.keyboard.press('Control+k');
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Control+k');
  await page.keyboard.press('Control+k');
  await expect(dialog(page)).toBeHidden();
});

test('consulta com HTML vira texto e o vazio oferece WhatsApp', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  await input(page).fill('<img src=x onerror=alert(1)>');
  await expect(dialog(page).locator('img')).toHaveCount(0);
  await input(page).fill('patinete');
  await expect(page.locator('.site-search__empty strong')).toHaveText('Nada sobre “patinete” no site.');
  await expect(page.locator('.site-search__whatsapp')).toHaveAttribute('href', /api\.whatsapp\.com\/send\?phone=5513981580498/);
  await page.locator('.site-search__try-term', { hasText: 'bagagem' }).click();
  await expect(input(page)).toHaveValue('bagagem');
  await expect(options(page).first()).toContainText(/bagagem/i);
});

test('só stopwords mantém "Mais procurados"', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  await input(page).fill('o que');
  await expect(page.locator('.site-search__lead')).toHaveText('Mais procurados');
  await expect(page.locator('.site-search__empty')).toHaveCount(0);
});

test('falha ao carregar o índice mostra erro e "Tentar de novo" recupera', async ({ page }) => {
  let block = true;
  let requests = 0;
  await page.route('**/assets/data/search-index.pt.json*', route => { requests++; return block ? route.abort() : route.continue(); });
  await page.goto('/');
  await page.keyboard.press('Control+k');
  await expect(page.locator('.site-search__error')).toContainText('Não foi possível carregar a busca.');
  block = false;
  await page.locator('.site-search__retry').click();
  await input(page).fill('bagagem');
  await expect(options(page).first()).toContainText(/bagagem/i);
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  await page.keyboard.press('Control+k');
  await expect(options(page).first()).toContainText(/bagagem/i);
  expect(requests).toBe(2);
});

test('no celular o bilhete ocupa a tela e mostra "Fechar"', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 760 });
  await page.goto('/');
  await page.locator('.nav__right [data-site-search-open]').click();
  const box = await page.locator('.site-search__ticket').boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(370);
  expect(box.height).toBeGreaterThanOrEqual(740);
  await expect(page.locator('.site-search__close')).toBeVisible();
  await expect(page.locator('.site-search__hints')).toBeHidden();
  await page.locator('.site-search__close').click();
  await expect(dialog(page)).toBeHidden();
});

test('movimento reduzido usa só fade', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.keyboard.press('Control+k');
  await expect(page.locator('.site-search__ticket')).toHaveCSS('animation-name', 'site-search-fade');
});
```

- [ ] **Step 2: Run test to verify it fails**

Rode pelo terminal do app (ver "Ambiente de execução"):
`cd /Users/cassio/GitHubPessoal/kob-site/.claude/worktrees/busca-global && npx playwright test --config=/tmp/claude/pw-busca-4177.config.mjs analytics/tests/site-search.spec.js > /tmp/claude/pw-site-search.log 2>&1; echo "EXIT=$?" >> /tmp/claude/pw-site-search.log`
Expected: FAIL (botão e diálogo não existem).

- [ ] **Step 3: Write minimal implementation**

Crie `assets/js/site-search.js`:

```js
import { prepareIndex, search, snippetFor, highlightParts, buildResultUrl } from './site-search-engine.js?v=20261008-busca';

const lang = (document.documentElement.lang || 'pt').slice(0, 2).toLowerCase();
const COPY = {
  pt: {
    where: 'Pesquisa no site', placeholder: 'O que você procura?', featured: 'Mais procurados',
    showing: 'Mostrando resultados para', and: ' e ', count: n => (n === 1 ? '1 resultado' : `${n} resultados`),
    none: q => `Nada sobre “${q}” no site.`, tryLead: 'Tente uma palavra mais geral, ou um destes assuntos:',
    tryTerms: ['proibidos', 'bagagem', 'cabine'], whatsapp: 'Perguntar à Royal Trip no WhatsApp',
    whatsappText: 'Olá, Royal Trip! Procurei no site do Kriativos On Board 2026 e não encontrei uma informação. Podem me ajudar?',
    loading: 'Carregando a busca…', error: 'Não foi possível carregar a busca. Verifique a conexão e tente de novo.',
    retry: 'Tentar de novo', close: 'Fechar', hints: ['navegar', 'abrir', 'fechar'],
    dest: { home: ['destino', 'Home'], bus: ['destino', 'Busão'], manual: ['destino', 'Manual'], live: 'live' }
  },
  en: {
    where: 'Search the site', placeholder: 'What are you looking for?', featured: 'Most searched',
    showing: 'Showing results for', and: ' and ', count: n => (n === 1 ? '1 result' : `${n} results`),
    none: q => `Nothing about “${q}” on the site.`, tryLead: 'Try a broader word, or one of these topics:',
    tryTerms: ['prohibited', 'luggage', 'cabin'], whatsapp: 'Ask Royal Trip on WhatsApp',
    whatsappText: "Hi, Royal Trip! I searched the Kriativos On Board 2026 website and couldn't find some information. Can you help me?",
    loading: 'Loading search…', error: "Search couldn't load. Check your connection and try again.",
    retry: 'Try again', close: 'Close', hints: ['navigate', 'open', 'close'],
    dest: { home: ['go to', 'Home'], bus: ['go to', 'Busão'], manual: ['go to', 'Guide'], live: 'live' }
  },
  es: {
    where: 'Buscar en el sitio', placeholder: '¿Qué estás buscando?', featured: 'Lo más buscado',
    showing: 'Mostrando resultados para', and: ' y ', count: n => (n === 1 ? '1 resultado' : `${n} resultados`),
    none: q => `No hay nada sobre “${q}” en el sitio.`, tryLead: 'Prueba con una palabra más general o con uno de estos temas:',
    tryTerms: ['prohibidos', 'equipaje', 'camarote'], whatsapp: 'Preguntar a Royal Trip por WhatsApp',
    whatsappText: '¡Hola, Royal Trip! Busqué en el sitio de Kriativos On Board 2026 y no encontré una información. ¿Me pueden ayudar?',
    loading: 'Cargando la búsqueda…', error: 'No se pudo cargar la búsqueda. Revisa tu conexión e inténtalo de nuevo.',
    retry: 'Intentar de nuevo', close: 'Cerrar', hints: ['navegar', 'abrir', 'cerrar'],
    dest: { home: ['destino', 'Inicio'], bus: ['destino', 'Busão'], manual: ['destino', 'Guía'], live: 'live' }
  }
};
const copy = COPY[lang] || COPY.pt;
const platform = navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || '';
const shortcutLabel = /Mac|iPhone|iPad|iPod/i.test(platform) ? '⌘ K' : 'Ctrl K';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const SVG = 'http://www.w3.org/2000/svg';

let dialog; let input; let list; let body; let synonymLine; let status; let stateEl;
let prepared = null; let featured = []; let loading = null; let opener = null;
let options = []; let activeIndex = -1;

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  node.append(...children.filter(child => child != null));
  return node;
}

function searchIcon() {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  for (const [name, attrs] of [['circle', { cx: 11, cy: 11, r: 6.5 }], ['path', { d: 'm16 16 4 4' }]]) {
    const shape = document.createElementNS(SVG, name);
    for (const [k, v] of Object.entries(attrs)) shape.setAttribute(k, v);
    svg.append(shape);
  }
  return svg;
}

const hint = (keys, label) => el('span', {}, ...keys.map(key => el('kbd', { text: key })), document.createTextNode(` ${label}`));

function build() {
  input = el('input', {
    class: 'site-search__input', type: 'search', role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'false',
    'aria-controls': 'site-search-results', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
    enterkeyhint: 'search', placeholder: copy.placeholder, 'aria-label': copy.where
  });
  status = el('p', { class: 'site-search__status', id: 'site-search-status', 'aria-live': 'polite' });
  synonymLine = el('p', { class: 'site-search__synonyms', hidden: true });
  list = el('ul', { class: 'site-search__list', id: 'site-search-results', role: 'listbox', 'aria-label': copy.where });
  body = el('div', { class: 'site-search__body' }, synonymLine, list);
  dialog = el('dialog', { class: 'site-search', 'aria-label': copy.where },
    el('div', { class: 'site-search__ticket' },
      el('div', { class: 'site-search__stub' },
        el('div', { class: 'site-search__topbar' },
          el('p', { class: 'site-search__where', text: copy.where }),
          el('button', { type: 'button', class: 'site-search__close', text: copy.close, onclick: requestClose })),
        el('label', { class: 'site-search__field' }, searchIcon(), input)),
      el('div', { class: 'site-search__perf', 'aria-hidden': 'true' }),
      body,
      el('div', { class: 'site-search__hints', 'aria-hidden': 'true' },
        hint(['↑', '↓'], copy.hints[0]), hint(['↵'], copy.hints[1]), hint(['esc'], copy.hints[2])),
      status));
  input.addEventListener('input', render);
  input.addEventListener('keydown', onKeydown);
  dialog.addEventListener('cancel', event => { event.preventDefault(); requestClose(); });
  dialog.addEventListener('close', onClose);
  dialog.addEventListener('click', event => { if (event.target === dialog) requestClose(); });
  document.body.append(dialog);
}

const okJson = response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); };

function load() {
  if (prepared) return Promise.resolve();
  loading ??= Promise.all([
    fetch(new URL(`../data/search-index.${lang}.json`, import.meta.url), { cache: 'no-cache' }).then(okJson),
    fetch(new URL('../data/search-synonyms.json', import.meta.url), { cache: 'no-cache' }).then(okJson)
  ]).then(([index, synonyms]) => {
    const config = synonyms[lang] || synonyms.pt;
    prepared = prepareIndex(index.entries, config);
    featured = config.featured;
  }).finally(() => { loading = null; });
  return loading;
}

export async function open(from = document.activeElement) {
  if (!dialog) build();
  if (dialog.open) return;
  opener = from instanceof HTMLElement && from !== document.body ? from : null;
  document.documentElement.classList.add('site-search-open');
  dialog.showModal();
  input.focus();
  input.select();
  render();
  if (prepared) return;
  try { await load(); if (dialog.open) render(); } catch { if (dialog.open) renderError(); }
}

function requestClose() {
  if (!dialog?.open || dialog.classList.contains('is-closing')) return;
  if (reducedMotion.matches) { dialog.close(); return; }
  dialog.classList.add('is-closing');
  setTimeout(() => { dialog.classList.remove('is-closing'); dialog.close(); }, 160);
}

function onClose() {
  document.documentElement.classList.remove('site-search-open');
  input.setAttribute('aria-expanded', 'false');
  if (opener?.isConnected) opener.focus();
  opener = null;
}

function showState(node) {
  stateEl?.remove();
  stateEl = node;
  if (node) body.insertBefore(node, list);
}

function setStatus(text) { status.textContent = text; }

function render() {
  synonymLine.hidden = true;
  if (!prepared) {
    showState(el('p', { class: 'site-search__lead', text: copy.loading }));
    renderOptions([]);
    setStatus(copy.loading);
    return;
  }
  const query = input.value.trim();
  const { tokens, results, synonymsUsed } = search(prepared, query);
  if (!tokens.length) { renderFeatured(); return; }
  if (!results.length) { renderEmpty(query); return; }
  showState(null);
  if (synonymsUsed.length) {
    synonymLine.hidden = false;
    synonymLine.textContent = `${copy.showing} ${[query, ...synonymsUsed].join(copy.and)}`;
  }
  renderOptions(results.map(result => ({ entry: result.entry, title: result.entry.title, snippet: snippetFor(result), terms: result.matched.join(' ') })));
  setStatus(copy.count(results.length));
}

function renderFeatured() {
  showState(el('p', { class: 'site-search__lead', text: copy.featured }));
  renderOptions(featured.map(item => ({
    entry: { page: item.page, anchor: item.anchor, kind: item.anchor.startsWith('#live-') ? 'live' : 'faq', time: item.time || null, title: item.label },
    title: item.label, snippet: '', terms: ''
  })));
  setStatus('');
}

function renderEmpty(query) {
  renderOptions([]);
  const tries = el('div', { class: 'site-search__try' }, ...copy.tryTerms.map(term => el('button', {
    type: 'button', class: 'site-search__try-term', text: term,
    onclick: () => { input.value = term; input.focus(); render(); }
  })));
  const whatsapp = el('a', {
    class: 'site-search__whatsapp', target: '_blank', rel: 'noopener', text: copy.whatsapp,
    href: `https://api.whatsapp.com/send?phone=5513981580498&text=${encodeURIComponent(copy.whatsappText)}`
  });
  showState(el('div', { class: 'site-search__empty' }, el('strong', { text: copy.none(query) }), el('p', { text: copy.tryLead }), tries, whatsapp));
  setStatus(copy.none(query));
}

function renderError() {
  renderOptions([]);
  showState(el('div', { class: 'site-search__empty site-search__error' }, el('p', { text: copy.error }), el('button', {
    type: 'button', class: 'site-search__retry', text: copy.retry,
    onclick: async () => {
      render();
      try { await load(); render(); input.focus(); } catch { renderError(); }
    }
  })));
  setStatus(copy.error);
}

function highlightInto(node, text, terms) {
  if (!terms) { node.textContent = text; return node; }
  for (const part of highlightParts(text, terms)) {
    node.append(part.match ? el('mark', { class: 'site-search__hl', text: part.text }) : document.createTextNode(part.text));
  }
  return node;
}

function destination(entry) {
  const [label, name] = entry.kind === 'live'
    ? [copy.dest.live, String(entry.time || '').replace(/^00:/, '')]
    : copy.dest[entry.page];
  return el('span', { class: 'site-search__dest' }, el('span', { class: 'site-search__dest-label', text: label }), el('b', { class: 'site-search__dest-name', text: name }));
}

function renderOptions(items) {
  options = items;
  list.replaceChildren(...items.map((item, index) => {
    const text = el('div', { class: 'site-search__text' }, highlightInto(el('strong', { class: 'site-search__title' }), item.title, item.terms));
    if (item.snippet) text.append(highlightInto(el('span', { class: 'site-search__snippet' }), item.snippet, item.terms));
    return el('li', {
      class: 'site-search__option', id: `site-search-opt-${index}`, role: 'option', 'aria-selected': 'false',
      onclick: () => activate(index), onpointermove: () => { if (activeIndex !== index) setActive(index, false); }
    }, text, destination(item.entry));
  }));
  input.setAttribute('aria-expanded', String(items.length > 0));
  setActive(items.length ? 0 : -1, false);
}

function setActive(index, scroll = true) {
  activeIndex = index;
  [...list.children].forEach((li, i) => li.setAttribute('aria-selected', String(i === index)));
  if (index < 0) { input.removeAttribute('aria-activedescendant'); return; }
  input.setAttribute('aria-activedescendant', `site-search-opt-${index}`);
  if (scroll) list.children[index].scrollIntoView({ block: 'nearest' });
}

function onKeydown(event) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    if (!options.length) return;
    event.preventDefault();
    const step = event.key === 'ArrowDown' ? 1 : -1;
    setActive((activeIndex + step + options.length) % options.length);
  } else if (event.key === 'Enter' && activeIndex >= 0) {
    event.preventDefault();
    activate(activeIndex);
  }
}

function activate(index) {
  const item = options[index];
  if (!item) return;
  const { href, samePage } = buildResultUrl(item.entry, window.location, lang);
  dialog.close();
  if (samePage) goToAnchor(item.entry.anchor);
  else window.location.assign(href);
}

export function goToAnchor(anchor) {
  if (!anchor) { window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' }); return; }
  if (anchor.startsWith('#live-')) {
    history.replaceState(null, '', anchor);
    document.dispatchEvent(new CustomEvent('kob:live-seek', { detail: { seconds: Number(anchor.slice(6)) } }));
    return;
  }
  if (window.location.hash === anchor) history.replaceState(null, '', window.location.pathname + window.location.search);
  window.location.hash = anchor;
}

function init() {
  for (const trigger of document.querySelectorAll('[data-site-search-open]')) {
    trigger.addEventListener('click', event => { event.preventDefault(); open(trigger); });
    trigger.addEventListener('pointerenter', () => { load().catch(() => {}); }, { once: true });
  }
  for (const kbd of document.querySelectorAll('[data-site-search-kbd]')) kbd.textContent = shortcutLabel;
  document.addEventListener('keydown', event => {
    if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || String(event.key).toLowerCase() !== 'k') return;
    event.preventDefault();
    if (dialog?.open) requestClose();
    else open(document.activeElement);
  });
}

init();
```

Crie `assets/css/site-search.css`:

```css
/* Busca global "Bilhete de embarque" (⌘K / Ctrl+K) — tokens de main.css */
.site-search-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  padding: 0 10px 0 12px;
  border: 1.5px solid color-mix(in srgb, currentColor 32%, transparent);
  border-radius: 9px;
  background: color-mix(in srgb, currentColor 6%, transparent);
  color: inherit;
  font: 700 0.78rem/1 var(--font-body);
  white-space: nowrap;
  cursor: pointer;
  flex-shrink: 0;
  transition: background var(--dur-fast, 120ms) ease, border-color var(--dur-fast, 120ms) ease;
}
.site-search-trigger:hover { background: color-mix(in srgb, currentColor 12%, transparent); border-color: color-mix(in srgb, currentColor 55%, transparent); }
.site-search-trigger:focus-visible { outline: 3px solid var(--ocean-cyan, #29c3f5); outline-offset: 2px; }
.site-search-trigger__icon { width: 18px; height: 18px; flex: none; }
.site-search-trigger__kbd { padding: 3px 6px; border-radius: 4px; background: color-mix(in srgb, currentColor 10%, transparent); font: 600 0.66rem/1 var(--font-body); }

@media (max-width: 760px) {
  .site-search-trigger { width: 38px; padding: 0; justify-content: center; }
  .site-search-trigger__label, .site-search-trigger__kbd { display: none; }
}

html.site-search-open { overflow: hidden; }

.site-search {
  width: min(680px, 92vw);
  max-width: none;
  max-height: none;
  margin: 12vh auto auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: #fff;
  overflow: visible;
  font-family: var(--font-body);
}
.site-search::backdrop { background: rgba(4, 29, 58, 0.62); backdrop-filter: blur(3px); }

.site-search__ticket { display: flex; flex-direction: column; max-height: 76vh; filter: drop-shadow(0 26px 50px rgba(0, 0, 0, 0.45)); }

.site-search__stub,
.site-search__body,
.site-search__hints { border-left: 6px solid var(--sunset-gold, #ffc20e); }

.site-search__stub {
  padding: 16px 22px 20px;
  border-radius: 16px 16px 0 0;
  background: var(--ocean-navy, #082f57);
  -webkit-mask: radial-gradient(circle at 0 100%, #0000 12px, #000 12.5px) 0 0 / 51% 100% no-repeat, radial-gradient(circle at 100% 100%, #0000 12px, #000 12.5px) 100% 0 / 51% 100% no-repeat;
  mask: radial-gradient(circle at 0 100%, #0000 12px, #000 12.5px) 0 0 / 51% 100% no-repeat, radial-gradient(circle at 100% 100%, #0000 12px, #000 12.5px) 100% 0 / 51% 100% no-repeat;
}
.site-search__topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.site-search__where { margin: 0; color: rgba(255, 255, 255, 0.72); font-size: 0.75rem; font-weight: 600; }
.site-search__close {
  display: none;
  min-height: 44px;
  padding: 0 14px;
  border: 0;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  font: 700 0.8rem var(--font-body);
}
.site-search__field { display: flex; align-items: center; gap: 12px; cursor: text; }
.site-search__field svg { width: 24px; height: 24px; flex: none; stroke: var(--sunset-gold, #ffc20e); stroke-width: 2.2; stroke-linecap: round; }
.site-search__input {
  flex: 1;
  min-width: 0;
  padding: 2px 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #fff;
  caret-color: var(--sunset-gold, #ffc20e);
  font-family: var(--font-display);
  font-size: clamp(1.6rem, 4vw, 2.2rem);
  line-height: 1.05;
  letter-spacing: 0.02em;
  -webkit-appearance: none;
  appearance: none;
}
.site-search__input::placeholder { color: rgba(255, 255, 255, 0.4); }
.site-search__input::-webkit-search-cancel-button { display: none; }
.site-search__field:focus-within { box-shadow: 0 2px 0 rgba(255, 194, 14, 0.55); }

.site-search__perf { position: relative; height: 0; margin: 0 18px; border-top: 2px dashed rgba(255, 255, 255, 0.3); z-index: 1; }

.site-search__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 8px 12px 4px;
  background: #0a3a68;
  -webkit-mask: radial-gradient(circle at 0 0, #0000 12px, #000 12.5px) 0 0 / 51% 100% no-repeat, radial-gradient(circle at 100% 0, #0000 12px, #000 12.5px) 100% 0 / 51% 100% no-repeat;
  mask: radial-gradient(circle at 0 0, #0000 12px, #000 12.5px) 0 0 / 51% 100% no-repeat, radial-gradient(circle at 100% 0, #0000 12px, #000 12.5px) 100% 0 / 51% 100% no-repeat;
}
.site-search__lead,
.site-search__synonyms { margin: 8px 12px 6px; color: rgba(255, 255, 255, 0.68); font-size: 0.76rem; }
.site-search__list { margin: 0; padding: 0; list-style: none; }
.site-search__option { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 14px; padding: 11px 12px; border-radius: 10px; cursor: pointer; }
.site-search__option[aria-selected="true"] { background: rgba(255, 194, 14, 0.14); box-shadow: inset 3px 0 0 var(--sunset-gold, #ffc20e); }
.site-search__title { display: block; font-size: 0.95rem; font-weight: 700; line-height: 1.35; }
.site-search__snippet { display: -webkit-box; margin-top: 3px; overflow: hidden; color: rgba(255, 255, 255, 0.76); font-size: 0.8rem; line-height: 1.45; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.site-search__hl { background: none; color: var(--sunset-gold, #ffc20e); font-weight: 700; }
.site-search__dest { color: rgba(255, 255, 255, 0.64); font-size: 0.68rem; text-align: right; white-space: nowrap; }
.site-search__dest-name { display: block; color: #fff; font-family: var(--font-display); font-size: 1.1rem; font-weight: 400; letter-spacing: 0.02em; }

.site-search__empty { padding: 16px 12px 14px; }
.site-search__empty strong { display: block; font-size: 1rem; }
.site-search__empty p { margin: 6px 0 14px; color: rgba(255, 255, 255, 0.76); font-size: 0.82rem; line-height: 1.5; }
.site-search__try { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
.site-search__try-term,
.site-search__retry { min-height: 36px; padding: 0 12px; border: 1px solid rgba(255, 255, 255, 0.24); border-radius: 6px; background: rgba(255, 255, 255, 0.08); color: #fff; font: 600 0.8rem var(--font-body); cursor: pointer; }
.site-search__whatsapp { display: inline-flex; align-items: center; min-height: 44px; padding: 0 16px; border-radius: 8px; background: #25d366; color: #05391b; font-size: 0.84rem; font-weight: 800; text-decoration: none; }
.site-search__try-term:focus-visible,
.site-search__retry:focus-visible,
.site-search__whatsapp:focus-visible,
.site-search__close:focus-visible { outline: 3px solid var(--ocean-cyan, #29c3f5); outline-offset: 2px; }

.site-search__hints { display: flex; gap: 16px; padding: 10px 22px 14px; border-radius: 0 0 16px 16px; background: #0a3a68; color: rgba(255, 255, 255, 0.62); font-size: 0.7rem; }
.site-search__hints kbd { margin-right: 3px; padding: 2px 6px; border: 1px solid rgba(255, 255, 255, 0.26); border-radius: 4px; color: rgba(255, 255, 255, 0.86); font: 600 0.66rem var(--font-body); }
.site-search__status { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

.site-search-arrival { outline: 3px solid var(--sunset-gold, #ffc20e); outline-offset: 4px; border-radius: 10px; }

@keyframes site-search-in { from { opacity: 0; transform: translateY(16px) scale(0.98); } to { opacity: 1; transform: none; } }
@keyframes site-search-tear { from { transform: translateY(-6px); } to { transform: none; } }
@keyframes site-search-out { to { opacity: 0; transform: translateY(12px) scale(0.98); } }
@keyframes site-search-fade { from { opacity: 0; } to { opacity: 1; } }
.site-search[open] .site-search__ticket { animation: site-search-in 260ms var(--ease-expo, cubic-bezier(0.16, 1, 0.3, 1)); }
.site-search[open] .site-search__body { animation: site-search-tear 260ms 40ms var(--ease-expo, cubic-bezier(0.16, 1, 0.3, 1)) both; }
.site-search[open]::backdrop { animation: site-search-fade 160ms ease; }
.site-search.is-closing .site-search__ticket { animation: site-search-out 160ms ease forwards; }

@media (max-width: 640px) {
  .site-search { width: 100vw; height: 100dvh; margin: 0; }
  .site-search__ticket { height: 100%; max-height: none; filter: none; }
  .site-search__stub { padding: 12px 14px 16px; border-left: 0; border-top: 5px solid var(--sunset-gold, #ffc20e); border-radius: 0; }
  .site-search__body { border-left: 0; }
  .site-search__hints { display: none; }
  .site-search__close { display: inline-flex; align-items: center; }
  .site-search__option { padding: 12px 8px; }
}

@media (prefers-reduced-motion: reduce) {
  .site-search[open] .site-search__ticket,
  .site-search[open] .site-search__body { animation: site-search-fade 120ms linear; }
  .site-search.is-closing .site-search__ticket { animation: none; }
}
```

Em `index.html`:

1. Logo depois de `<link rel="stylesheet" href="assets/css/main.css?v=20261005-ui-final">`, acrescente `  <link rel="stylesheet" href="assets/css/site-search.css?v=20261008-busca">`.
2. Logo depois de `<div class="nav__right">`, acrescente o botão:

```html
      <button type="button" class="site-search-trigger" data-site-search-open aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K" aria-label="Pesquisar no site">
        <svg class="site-search-trigger__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4 4"></path></svg>
        <span class="site-search-trigger__label">Buscar</span>
        <kbd class="site-search-trigger__kbd" data-site-search-kbd aria-hidden="true">⌘ K</kbd>
      </button>
```

3. Logo depois de `<script src="assets/js/main.js?v=...">`, acrescente `  <script type="module" src="assets/js/site-search.js?v=20261008-busca"></script>`.

- [ ] **Step 4: Run test to verify it passes**

Rode o spec pelo terminal (mesmo comando do Step 2). Expected: PASS (9 testes).

Checagem visual: abra um servidor do worktree num terminal do app (`cd /Users/cassio/GitHubPessoal/kob-site/.claude/worktrees/busca-global && python3 -m http.server 4178 --bind 127.0.0.1`), use o navegador de verificação (`mcp__plugin_chrome-devtools-mcp_chrome-devtools__new_page` em `http://127.0.0.1:4178/`, `resize_page`, `take_screenshot`) e confira o bilhete em 1280 px e 375 px com "mala" digitado. Compare com o mockup aprovado (opção C) em `/tmp/claude/kob-spotlight/.superpowers/brainstorm/83979-1791419880/content/visual-direction.html`. Corrija só divergências visíveis e pare o servidor ao terminar (`mcp__terminal__stop_terminal_tab`). Use o mesmo procedimento nas checagens visuais dos Tasks 6 e 8.

- [ ] **Step 5: Commit**

```bash
git add assets/js/site-search.js assets/css/site-search.css index.html analytics/tests/site-search.spec.js
git commit -m "feat(busca): bilhete de embarque com atalho, teclado, estados e celular na home"
```

---

### Task 6: Levar a busca às 9 páginas e aposentar o ⌘K antigo

**Files:**
- Modify: `en/index.html`, `es/index.html`, `manual-de-bordo.html`, `en/manual-de-bordo.html`, `es/manual-de-bordo.html`, `onibus.html`, `en/onibus.html`, `es/onibus.html` (CSS, botão, módulo)
- Modify: `index.html`, `en/index.html`, `es/index.html`, `manual-de-bordo.html`, `en/manual-de-bordo.html`, `es/manual-de-bordo.html` (o `<kbd>` da caixa do FAQ vira botão; `?v=` do `main.js`/`manual-de-bordo.js`)
- Modify: `assets/js/main.js` (remover o atalho ⌘K do FAQ), `assets/js/manual-de-bordo.js` (idem)
- Modify: `assets/css/site-search.css` (estilo do botão do FAQ e ajustes de header)
- Test: `analytics/tests/site-search.spec.js` (acrescentar)

**Interfaces:**
- Consumes: `data-site-search-open`, `data-site-search-kbd` (Task 5).
- Produces: botão `.site-search-trigger` em `.nav__right` (home), `.guide-header__actions` (manual) e `.bus-header__right` (busão), sempre como **primeiro filho**; botão `.faq-search__spotlight` dentro da caixa do FAQ (home e manual).

Textos do botão do header por idioma (`aria-label` / rótulo):
- PT: `Pesquisar no site` / `Buscar`
- EN: `Search the site` / `Search`
- ES: `Buscar en el sitio` / `Buscar`

Botão do FAQ (`aria-label`): PT `Pesquisar no site inteiro`, EN `Search the whole site`, ES `Buscar en todo el sitio`.

- [ ] **Step 1: Write the failing test**

Acrescente ao fim de `analytics/tests/site-search.spec.js`:

```js
const PAGES = [
  ['/', 'pt', '.nav__right'], ['/en/', 'en', '.nav__right'], ['/es/', 'es', '.nav__right'],
  ['/manual-de-bordo.html', 'pt', '.guide-header__actions'], ['/en/manual-de-bordo.html', 'en', '.guide-header__actions'], ['/es/manual-de-bordo.html', 'es', '.guide-header__actions'],
  ['/onibus.html', 'pt', '.bus-header__right'], ['/en/onibus.html', 'en', '.bus-header__right'], ['/es/onibus.html', 'es', '.bus-header__right']
];
const TEXT = {
  pt: { label: 'Pesquisar no site', placeholder: 'O que você procura?', where: 'Pesquisa no site', faqButton: 'Pesquisar no site inteiro' },
  en: { label: 'Search the site', placeholder: 'What are you looking for?', where: 'Search the site', faqButton: 'Search the whole site' },
  es: { label: 'Buscar en el sitio', placeholder: '¿Qué estás buscando?', where: 'Buscar en el sitio', faqButton: 'Buscar en todo el sitio' }
};

for (const [path, lang, container] of PAGES) {
  test(`busca disponível em ${path} (${lang})`, async ({ page }) => {
    await page.route(/https:\/\/.*youtube(?:-nocookie)?\.com\/.*/, route => route.fulfill({ contentType: 'text/html', body: '<html></html>' }));
    await page.goto(path);
    const trigger = page.locator(`${container} > .site-search-trigger:first-child`);
    await expect(trigger).toHaveAttribute('aria-label', TEXT[lang].label);
    await expect(trigger.locator('[data-site-search-kbd]')).toHaveText(/^(⌘ K|Ctrl K)$/);
    await page.keyboard.press('Control+k');
    await expect(page.locator('.site-search__input')).toBeFocused();
    await expect(page.locator('.site-search__input')).toHaveAttribute('placeholder', TEXT[lang].placeholder);
    await expect(page.locator('.site-search__where')).toHaveText(TEXT[lang].where);
    await expect(page.locator('#site-search-results [role="option"]')).toHaveCount(5);
  });
}

for (const [path, lang, faqInput] of [['/', 'pt', '#faq-search'], ['/en/', 'en', '#faq-search'], ['/es/', 'es', '#faq-search'], ['/manual-de-bordo.html', 'pt', '#faqSearchInput'], ['/en/manual-de-bordo.html', 'en', '#faqSearchInput'], ['/es/manual-de-bordo.html', 'es', '#faqSearchInput']]) {
  test(`o selo da caixa do FAQ abre a busca global e Ctrl+K não foca mais o FAQ (${path})`, async ({ page }) => {
    await page.route(/https:\/\/.*youtube(?:-nocookie)?\.com\/.*/, route => route.fulfill({ contentType: 'text/html', body: '<html></html>' }));
    await page.goto(path);
    const button = page.locator('.faq-search__spotlight');
    await expect(button).toHaveAttribute('aria-label', TEXT[lang].faqButton);
    await button.click();
    await expect(page.locator('dialog.site-search')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog.site-search')).toBeHidden();
    await page.locator(faqInput).focus();
    await page.keyboard.press('Control+k');
    await expect(page.locator('.site-search__input')).toBeFocused();
  });
}

test('Ctrl+K abre com foco num campo do formulário do busão', async ({ page }) => {
  await page.goto('/onibus.html');
  await page.locator('#primary-email').focus();
  await page.keyboard.press('Control+k');
  await expect(page.locator('.site-search__input')).toBeFocused();
});

for (const width of [320, 390]) {
  test(`headers cabem a ${width}px com a lupa`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    for (const path of ['/', '/manual-de-bordo.html', '/onibus.html']) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
      await expect(page.locator('.site-search-trigger').first()).toBeVisible();
    }
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Rode o spec pelo terminal. Expected: FAIL nos testes novos (botões ausentes em 8 páginas, `.faq-search__spotlight` inexistente).

- [ ] **Step 3: Write minimal implementation**

1. Em cada um dos 8 HTMLs, acrescente o CSS logo após a linha do `main.css` (`<link rel="stylesheet" href="/assets/css/site-search.css?v=20261008-busca">`) e o módulo:
   - home EN/ES: `<script type="module" src="/assets/js/site-search.js?v=20261008-busca"></script>` logo após o `<script src="/assets/js/main.js?v=...">`;
   - manual (3) e busão (3): a mesma tag logo após o último `<script ...>` do `<head>` (manual: depois de `manual-games-carousel.js`; busão: depois de `onibus.js`).
2. Insira o botão do header como **primeiro filho** do contêiner (`.nav__right`, `.guide-header__actions`, `.bus-header__right`), com o markup do Task 5 e os textos do idioma (lista acima). Indente como o arquivo.
3. Nos 6 HTMLs com caixa de FAQ, troque `<kbd aria-hidden="true">⌘ K</kbd>` por:

```html
<button type="button" class="faq-search__spotlight" data-site-search-open data-site-search-kbd aria-label="Pesquisar no site inteiro">⌘ K</button>
```

   (EN `aria-label="Search the whole site"`, ES `aria-label="Buscar en todo el sitio"`).
4. Em `assets/js/main.js`, no bloco `if (search) { ... document.addEventListener('keydown', ...` do FAQ, remova somente o `if ((event.metaKey || event.ctrlKey) && ... === 'k') { event.preventDefault(); search.focus(); }`, mantendo o tratamento de `Escape`.
5. Em `assets/js/manual-de-bordo.js`, no `document.addEventListener('keydown', ...)` da busca do FAQ, remova somente o `if ((event.metaKey || event.ctrlKey) && ... === 'k') { ... }`, mantendo o `Escape`.
6. Atualize o `?v=` de `main.js` nas 3 homes para `20261008-busca` e o de `manual-de-bordo.js` nos 3 manuais para `20261008-busca`.
7. Acrescente ao fim de `assets/css/site-search.css`:

```css
.faq-search__spotlight {
  padding: 4px 7px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.82);
  font: 600 0.68rem/1 var(--font-body);
  white-space: nowrap;
  cursor: pointer;
}
.faq-search__spotlight:hover { background: rgba(255, 255, 255, 0.16); color: #fff; }
.faq-search__spotlight:focus-visible { outline: 3px solid var(--ocean-cyan, #29c3f5); outline-offset: 2px; }

@media (max-width: 480px) {
  .bus-header .site-search-trigger,
  .guide-header .site-search-trigger { width: 32px; min-height: 32px; border-radius: 7px; }
  .bus-header .site-search-trigger__icon,
  .guide-header .site-search-trigger__icon { width: 16px; height: 16px; }
}
```

   Se a caixa do FAQ do manual tiver fundo claro (`#duvidas .faq-search`), confira o contraste do botão e, se preciso, acrescente uma regra `#duvidas .faq-search__spotlight { ... }` com as cores que o `#duvidas .faq-search kbd` usa hoje em `assets/css/manual-de-bordo.css` (leia a regra antes; se não existir, a acima basta).

- [ ] **Step 4: Run test to verify it passes**

Rode pelo terminal o spec da busca e depois a suíte inteira (`npx playwright test --config=/tmp/claude/pw-busca-4177.config.mjs > /tmp/claude/pw-full.log 2>&1; echo "EXIT=$?" >> /tmp/claude/pw-full.log`). Expected: tudo PASS. Se algum teste antigo de header/overflow falhar por causa do botão novo, ajuste o CSS do botão (não o teste) e rode de novo. Tire screenshots dos 3 headers em 1280 px e 390 px para conferir encaixe e contraste (home escura, manual e busão claros).

- [ ] **Step 5: Commit**

```bash
git add en/index.html es/index.html index.html manual-de-bordo.html en/manual-de-bordo.html es/manual-de-bordo.html onibus.html en/onibus.html es/onibus.html assets/js/main.js assets/js/manual-de-bordo.js assets/css/site-search.css analytics/tests/site-search.spec.js
git commit -m "feat(busca): lupa nas 9 páginas e ⌘K global no lugar do atalho do FAQ"
```

---

### Task 7: Chegada no destino (FAQ aberto, live no minuto)

**Files:**
- Modify: `assets/js/site-search.js` (chegada por hash: abre, rola, foca e destaca o FAQ)
- Modify: `assets/js/manual-de-bordo-live.js` (deep link `#live-<s>` e evento `kob:live-seek`)
- Modify: `manual-de-bordo.html`, `en/manual-de-bordo.html`, `es/manual-de-bordo.html` (`?v=` do `manual-de-bordo-live.js` e do `site-search.js`), demais páginas (`?v=` do `site-search.js` se mudar)
- Test: `analytics/tests/site-search.spec.js` (acrescentar)

**Interfaces:**
- Consumes: `goToAnchor` e `kob:live-seek` (Task 5); `select(chapter, isPlaying)`, `playAt(seconds)`, `cinema` e o botão `#loadLivePlayerBtn` já existentes em `manual-de-bordo-live.js`.
- Produces: `#faq-h..`/`#faq-o..` na URL abrem e destacam a pergunta (classe `site-search-arrival` por 2 s); `#live-<s>` seleciona o capítulo e faz "Assistir" começar nele; `kob:live-seek` toca na hora.

- [ ] **Step 1: Write the failing test**

Acrescente ao fim de `analytics/tests/site-search.spec.js`:

```js
const mockYouTube = page => page.route(/https:\/\/.*youtube(?:-nocookie)?\.com\/.*/, route => route.fulfill({ contentType: 'text/html', body: '<html><body>Mock video</body></html>' }));

test('chegada na home abre a pergunta e limpa o filtro do FAQ', async ({ page }) => {
  await page.goto('/');
  await page.locator('#faq-search').fill('xyzqwk');
  await page.evaluate(() => { location.hash = '#faq-h23'; });
  const item = page.locator('#faq-h23');
  await expect(item).toHaveAttribute('open', '');
  await expect(item).toBeVisible();
  await expect(page.locator('#faq-search')).toHaveValue('');
  await expect(item).toHaveClass(/site-search-arrival/);
  await expect(item.locator('summary')).toBeFocused();
});

test('chegada no manual por URL abre a pergunta', async ({ page }) => {
  await mockYouTube(page);
  await page.goto('/manual-de-bordo.html#faq-o08');
  await expect(page.locator('#faq-o08')).toHaveAttribute('open', '');
  await expect(page.locator('#faq-o08')).toBeInViewport();
});

test('#live-1250 vindo de outra página pré-seleciona o capítulo e Assistir começa nele', async ({ page }) => {
  await mockYouTube(page);
  await page.goto('/en/manual-de-bordo.html#live-1250');
  await expect(page.locator('#heroLiveCinema')).toBeInViewport();
  await page.locator('#loadLivePlayerBtn').click();
  await expect(page.locator('#livePlayerContainer iframe')).toHaveAttribute('src', /start=1250/);
});

test('resultado da live na mesma página toca no minuto', async ({ page }) => {
  await mockYouTube(page);
  await page.goto('/manual-de-bordo.html');
  await page.keyboard.press('Control+k');
  await page.locator('.site-search__input').fill('estacionamento concais');
  const live = page.locator('#site-search-results [role="option"]', { hasText: 'Estacionamento no Concais' });
  await expect(live.locator('.site-search__dest-name')).toHaveText('29:25');
  await live.click();
  await expect(page.locator('dialog.site-search')).toBeHidden();
  await expect(page.locator('#livePlayerContainer iframe')).toHaveAttribute('src', /start=1765/);
  await expect(page).toHaveURL(/#live-1765$/);
});

test('resultado de FAQ na mesma página abre a pergunta sem recarregar', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => { window.__noReload = true; });
  await page.keyboard.press('Control+k');
  await page.locator('.site-search__input').fill('vacinado');
  await page.locator('#site-search-results [role="option"]', { hasText: 'Preciso estar vacinado' }).click();
  await expect(page.locator('#faq-h04')).toHaveAttribute('open', '');
  expect(await page.evaluate(() => window.__noReload)).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Rode o spec pelo terminal. Expected: FAIL nos 5 testes novos.

- [ ] **Step 3: Write minimal implementation**

Em `assets/js/site-search.js`, acrescente antes de `init();` e chame `arrive()` dentro de `init()` e no `hashchange`:

```js
function arrive() {
  const id = decodeURIComponent(window.location.hash.slice(1));
  if (!/^faq-[ho]\d{2}$/.test(id)) return;
  const item = document.getElementById(id);
  if (!item || item.tagName !== 'DETAILS') return;
  const filter = item.closest('section')?.querySelector('input[type="search"]');
  if (filter?.value) {
    filter.value = '';
    filter.dispatchEvent(new Event('input', { bubbles: true }));
  }
  item.open = true;
  requestAnimationFrame(() => {
    item.scrollIntoView({ block: 'center', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    item.querySelector('summary')?.focus({ preventScroll: true });
    item.classList.add('site-search-arrival');
    setTimeout(() => item.classList.remove('site-search-arrival'), 2000);
  });
}
```

e, no fim de `init()`:

```js
  window.addEventListener('hashchange', arrive);
  arrive();
```

Em `assets/js/manual-de-bordo-live.js` (mudança mínima — outra sessão também edita este arquivo; não reformate nada):

1. Logo antes de `byId('loadLivePlayerBtn').addEventListener('click', () => {`, acrescente:

```js
  const chapterFromHash = () => {
    const match = /^#live-(\d+)$/.exec(window.location.hash);
    return match ? CHAPTERS.find(chapter => chapter.seconds === Number(match[1])) || null : null;
  };
  let linkedChapter = chapterFromHash();
  const showLinkedChapter = () => {
    if (!linkedChapter) return;
    select(linkedChapter, false);
    cinema.scrollIntoView({ block: 'center' });
  };
  showLinkedChapter();
  window.addEventListener('hashchange', () => { linkedChapter = chapterFromHash() || linkedChapter; showLinkedChapter(); });
  document.addEventListener('kob:live-seek', event => {
    const chapter = CHAPTERS.find(item => item.seconds === Number(event.detail?.seconds));
    if (!chapter) return;
    linkedChapter = chapter;
    select(chapter, false);
    cinema.scrollIntoView({ block: 'center', behavior: 'smooth' });
    playAt(chapter.seconds);
  });
```

2. Troque o corpo do clique de `#loadLivePlayerBtn` para começar no capítulo vindo do link:

```js
  byId('loadLivePlayerBtn').addEventListener('click', () => {
    const start = linkedChapter || CHAPTERS[0];
    select(start, false);
    playAt(start.seconds);
  });
```

3. Atualize o `?v=` de `manual-de-bordo-live.js` nos 3 manuais para `20261008-busca` e o de `site-search.js` nas 9 páginas para `20261008-busca-2` (o arquivo mudou).

- [ ] **Step 4: Run test to verify it passes**

Rode o spec da busca e depois `analytics/tests/manual-live.spec.js` inteiro pelo terminal (a live tem testes extensos; nenhum pode regredir). Expected: tudo PASS. Se algum teste da live regredir por causa do `select()` antecipado, limite o `showLinkedChapter()` a rolar até o vídeo e guardar `linkedChapter`, deixando o `select` só para o clique em "Assistir" — e rode de novo.

- [ ] **Step 5: Commit**

```bash
git add assets/js/site-search.js assets/js/manual-de-bordo-live.js manual-de-bordo.html en/manual-de-bordo.html es/manual-de-bordo.html index.html en/index.html es/index.html onibus.html en/onibus.html es/onibus.html analytics/tests/site-search.spec.js
git commit -m "feat(busca): chegada no destino abre o FAQ e posiciona a live no minuto"
```

---

### Task 8: Documentação curta, verificação completa e PR

**Files:**
- Modify: `AGENTS.md` (uma seção curta sobre o índice)
- Modify: `docs/superpowers/specs/2026-10-07-busca-global-spotlight-design.md` (só se alguma decisão de implementação divergiu; registre-a ao fim, em "Decisões de implementação")

- [ ] **Step 1: Documentar o índice para quem editar conteúdo**

Acrescente ao fim de `AGENTS.md`:

```markdown
## Índice da busca global

Depois de alterar o FAQ, as seções indexadas (home, busão, manual) ou os dados da live, rode `npm run build:search-index` e commite `assets/data/search-index.*.json`. O teste `server/tests/search-index.test.mjs` falha no CI se o índice ficar desatualizado. Sinônimos e "Mais procurados" ficam em `assets/data/search-synonyms.json`, nos 3 idiomas.
```

- [ ] **Step 2: Verificação completa**

Run: `npm run test:server` → PASS.
Run: `npm run validate:analytics` → `analytics_config=ok`.
Rode pelo terminal a suíte Playwright completa com a config privada → todos PASS (registre o número no PR).
Faça a checagem visual final (1280 px e 375 px) na home, no manual e no busão, em PT, EN e ES, com uma busca por "mala"/"luggage"/"maleta". Nenhum erro no console (`preview_console_logs` ou `page.on('console')`).

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs(busca): como regenerar o índice da busca global"
```

- [ ] **Step 4: Push e PR (sem merge)**

Pelo terminal do app (o sandbox bloqueia o github.com):

```bash
cd /Users/cassio/GitHubPessoal/kob-site/.claude/worktrees/busca-global && git push -u origin worktree-busca-global:code-ia/busca-global
```

Depois abra o PR com `gh pr create --base main --head code-ia/busca-global` e o corpo: resumo, decisões tomadas sozinho (lista), testes executados com números, capturas e o que ficou de fora. Termine o corpo com `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. **Não** faça merge.
