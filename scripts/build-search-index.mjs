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
