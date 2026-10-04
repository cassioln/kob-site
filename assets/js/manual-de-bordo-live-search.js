// Normalize while retaining original UTF-16 offsets for accent-safe snippets.
export function searchText(text) {
  let normalized = '';
  const offsets = [];
  let offset = 0;
  for (const character of String(text || '')) {
    const value = character.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    for (const letter of value) {
      if (/^[\p{L}\p{N}]$/u.test(letter)) {
        for (let i = 0; i < letter.length; i++) offsets.push({ start: offset, end: offset + character.length });
        normalized += letter;
      } else if (normalized && !normalized.endsWith(' ')) {
        normalized += ' ';
        offsets.push({ start: offset, end: offset + character.length });
      }
    }
    offset += character.length;
  }
  if (normalized.endsWith(' ')) { normalized = normalized.slice(0, -1); offsets.pop(); }
  return { normalized, offsets };
}

export function normalizeSearch(text) { return searchText(text).normalized; }

export function matchChapter(chapter, query, lang = 'pt') {
  const tokens = normalizeSearch(query).split(' ').filter(Boolean);
  if (!tokens.length) return true;
  const index = normalizeSearch([chapter.time, chapter.titles[lang], chapter.titles.pt,
    chapter.keywords, chapter.transcript, chapter.notice?.[lang]].join(' '));
  return tokens.every(token => index.includes(token));
}

export function highlightParts(text, query) {
  text = String(text || '');
  const { normalized, offsets } = searchText(text);
  const tokens = [...new Set(normalizeSearch(query).split(' ').filter(Boolean))];
  const ranges = [];
  for (const token of tokens) {
    let from = 0;
    let index;
    while ((index = normalized.indexOf(token, from)) !== -1) {
      ranges.push([offsets[index].start, offsets[index + token.length - 1].end]);
      from = index + token.length;
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  const parts = [];
  let from = 0;
  for (const [start, end] of merged) {
    if (start > from) parts.push({ text: text.slice(from, start), match: false });
    parts.push({ text: text.slice(start, end), match: true });
    from = end;
  }
  if (from < text.length || !parts.length) parts.push({ text: text.slice(from), match: false });
  return parts;
}

export function excerpt(text, query, radius = 85) {
  const { normalized, offsets } = searchText(text);
  const starts = normalizeSearch(query).split(' ').filter(Boolean)
    .map(token => normalized.indexOf(token)).filter(index => index >= 0);
  if (!starts.length) return '';
  const match = offsets[Math.min(...starts)].start;
  let start = Math.max(0, match - radius);
  let end = Math.min(text.length, match + radius);
  if (start > 0) { const boundary = text.indexOf(' ', start); if (boundary < match) start = boundary + 1; }
  if (end < text.length) { const boundary = text.lastIndexOf(' ', end); if (boundary > match) end = boundary; }
  return (start ? '… ' : '') + text.slice(start, end).replace(/\s+/g, ' ').trim() + (end < text.length ? ' …' : '');
}
