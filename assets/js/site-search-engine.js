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
  return { items, vocabulary: [...vocabulary], vocabularySet: vocabulary, surface, synonyms, stopwords: new Set(stopwords.flatMap(words)), cache: new Map() };
}

// Plural endings (normalized, no accents) and their singular replacements, most specific first.
const PLURAL_RULES = [['oes', 'ao'], ['aes', 'ao'], ['ns', 'm'], ['ies', 'y'], ['es', ''], ['s', '']];

function singularStems(token) {
  if (token.length < 4 || !token.endsWith('s')) return [];
  return PLURAL_RULES.filter(([ending]) => token.endsWith(ending))
    .map(([ending, replacement]) => token.slice(0, -ending.length) + replacement)
    .filter(stem => stem.length >= 3);
}

function candidates(prepared, token) {
  if (prepared.cache.has(token)) return prepared.cache.get(token);
  const out = new Map();
  for (const word of prepared.vocabulary) {
    if (word === token) out.set(word, 1);
    else if (token.length >= 3 && word.startsWith(token)) out.set(word, 0.8);
  }
  // A plural reaches its singular ("limites" → "limite"); this counts as a found word and keeps the typo gate closed.
  for (const stem of singularStems(token)) {
    if (prepared.vocabularySet.has(stem) && (out.get(stem) ?? 0) < 0.8) out.set(stem, 0.8);
  }
  // Typo tolerance is only for words the index does not have: a real word is never "corrected" into another.
  const limit = out.size ? 0 : fuzzyLimit(token.length);
  if (limit) {
    for (const word of prepared.vocabulary) {
      if (Math.abs(word.length - token.length) <= limit && damerauLevenshtein(token, word, limit) <= limit) out.set(word, 0.55);
    }
  }
  if (prepared.cache.size > 300) prepared.cache.clear();
  prepared.cache.set(token, out);
  return out;
}

function tokenize(prepared, query) {
  return words(query)
    .filter(t => (t.length > 1 || /\d/.test(t)) && !prepared.stopwords.has(t))
    .slice(0, MAX_TOKENS);
}

// allowMissing = 0 is strict AND; 1 lets an entry miss one token (it adds 0 to the score).
function rank(prepared, perToken, phrase, allowMissing) {
  const scored = [];
  for (const item of prepared.items) {
    let total = 0;
    let missing = 0;
    const matched = new Set();
    const used = new Set();
    for (const { direct, viaSynonym } of perToken) {
      let best = 0;
      let typedFound = false; // the typed word (exact, prefix, plural or typo form) is in this entry
      let bestSynonym = null; // reported only when the entry matched this token through a synonym alone
      for (const [field, weight] of Object.entries(FIELD_WEIGHT)) {
        const set = item.fields[field];
        for (const [word, score] of direct) {
          if (!set.has(word)) continue;
          matched.add(word);
          typedFound = true;
          if (score * weight > best) { best = score * weight; bestSynonym = null; }
        }
        for (const [word, score] of viaSynonym) {
          if (!set.has(word)) continue;
          matched.add(word);
          if (score * weight > best) { best = score * weight; bestSynonym = word; }
        }
      }
      if (!best && ++missing > allowMissing) break;
      if (bestSynonym && !typedFound) used.add(bestSynonym);
      total += best;
    }
    if (missing > allowMissing) continue;
    if (phrase && ` ${item.titleNorm} `.includes(` ${phrase} `)) total += 1.5;
    scored.push({ entry: item.entry, score: total * item.kindWeight, order: item.order, matched: [...matched], used });
  }
  return scored;
}

export function search(prepared, query, { limit = 20 } = {}) {
  const tokens = tokenize(prepared, query);
  if (!tokens.length) return { tokens, results: [], synonymsUsed: [] };
  const perToken = tokens.map(token => {
    const direct = candidates(prepared, token);
    const viaSynonym = new Map();
    for (const synonym of prepared.synonyms.get(token) || []) {
      for (const [word, score] of candidates(prepared, synonym)) {
        if (score < 0.8 || (score < 1 && synonym.length < 5) || direct.has(word)) continue;
        const value = score * 0.9;
        if ((viaSynonym.get(word) ?? 0) < value) viaSynonym.set(word, value);
      }
    }
    return { direct, viaSynonym };
  });
  const phrase = normalizeSearch(query);
  let scored = rank(prepared, perToken, phrase, 0);
  if (!scored.length && tokens.length >= 3) scored = rank(prepared, perToken, phrase, 1);
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
