// Extrator mínimo para o HTML do próprio projeto (bem formado); usado só no build do índice.
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style']);
const SKIP_TEXT = new Set(['script', 'style', 'svg', 'template']);
// Formatação inline que pode cortar uma palavra ao meio (ex.: <b>A</b><i>B</i> → "AB"); qualquer outro
// elemento (span, strong, small, div…) separa o texto com espaço antes e depois.
const INLINE = new Set(['a', 'abbr', 'b', 'bdi', 'bdo', 'cite', 'code', 'em', 'i', 'kbd', 'mark', 'q', 's', 'sub', 'sup', 'u', 'wbr']);
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
    if (SKIP_TEXT.has(n.tag) || n.attrs['aria-hidden'] === 'true' || (skip && n !== node && skip(n))) return;
    const separate = !INLINE.has(n.tag);
    if (separate) parts.push(' ');
    for (const child of n.children) walk(child);
    if (separate) parts.push(' ');
  })(node);
  // O espaço inserido entre elementos não pode separar a pontuação ("229 ,00", "confirmado .", "( x )").
  return parts.join('').replace(/\s+/g, ' ').replace(/ ([,.;:!?)\]])/g, '$1').replace(/([([]) /g, '$1').trim();
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
