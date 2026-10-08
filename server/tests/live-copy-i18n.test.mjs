import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAPTERS } from '../../assets/js/manual-de-bordo-live-data.js';
import { SUPPORT_NOTICES } from '../../assets/js/manual-de-bordo-live-support.js';

// Texts written for the reader (titles and notices), not the speech: the transcripts keep the speaker's own
// "ustedes" and the wine "labels".
const notices = lang => [
  ...CHAPTERS.filter(chapter => chapter.notice).map(chapter => [chapter.id, chapter.notice[lang]]),
  ...SUPPORT_NOTICES.flatMap(notice => [[notice.id, notice.texts[lang]], [`${notice.id} emphasis`, notice.emphasis?.[lang]]])
].filter(([, text]) => text);

test('ES: avisos da live falam com "tú" e usam "camarote"', () => {
  const usted = /\b(Confirme|Consulte|Revise|Verifique|Compruebe|Use|Espere|espere|confirme|consulte|suponga)\b|\bsu (caso|reserva)\b/;
  for (const [id, text] of notices('es')) {
    assert.doesNotMatch(text, usted, `${id}: ${text}`);
    assert.doesNotMatch(text, /\bcabinas?\b/i, `${id}: ${text}`);
  }
});

test('EN: títulos e avisos da live em inglês americano, com "giveaway"', () => {
  const british = /\b(raffles?|programmes?|favourites?|instalments?|speciality|travelling|luggage labels)\b/i;
  const texts = [...CHAPTERS.map(chapter => [chapter.id, chapter.titles.en]), ...notices('en')];
  for (const [id, text] of texts) assert.doesNotMatch(text, british, `${id}: ${text}`);
  assert.equal(CHAPTERS.find(chapter => chapter.seconds === 3814).titles.en, 'Guru and manual giveaway registration');
});
