import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAPTERS, GROUP_INVITE_CUES, GROUP_INVITE_DURATION, LIVE_DURATION } from '../../assets/js/manual-de-bordo-live-data.js';
import { isNoticeDue, isGroupInviteDue, topicBounds } from '../../assets/js/manual-de-bordo-live-timeline.js';
import { SUPPORT_NOTICES, SUPPORT_DURATION, supportAt } from '../../assets/js/manual-de-bordo-live-support.js';

test('Every update has a mapped utterance inside its own topic', () => {
  const notices = CHAPTERS.filter(topic => topic.notice);
  assert.equal(notices.length, 23);
  for (const topic of notices) {
    const { start, end } = topicBounds(topic);
    assert.ok(Number.isFinite(topic.noticeSeconds), topic.id);
    assert.ok(topic.noticeSeconds >= start && topic.noticeSeconds < end, topic.id);
    for (const lang of ['pt', 'en', 'es']) assert.ok(topic.notice[lang], `${topic.id}: ${lang}`);
  }
});

test('Seeking either direction re-evaluates the utterance; a topic boundary ends the update', () => {
  const minors = CHAPTERS.find(topic => topic.id === 'chapter-1250');
  // Documents start at 20:50, but the minors utterance begins at 21:58.440.
  for (const position of [1250, 1254, 1318.439]) assert.equal(isNoticeDue(minors, position), false);
  for (const position of [1318.440, 1340, 1319]) assert.equal(isNoticeDue(minors, position), true);
  assert.equal(isNoticeDue(minors, 1318), false);
  assert.equal(isNoticeDue(minors, 1345), false);
  assert.equal(isNoticeDue(CHAPTERS.find(topic => topic.seconds === 1345), 1346), false);
  assert.equal(isNoticeDue(null, 1319), false);
  assert.equal(isNoticeDue(minors, NaN), false);
});

test('The party notice waits for the 80s proposal instead of the chapter introduction', () => {
  const party = CHAPTERS.find(topic => topic.seconds === 3213);
  assert.equal(isNoticeDue(party, 3217), false);
  assert.equal(isNoticeDue(party, 3271.879), false);
  assert.equal(isNoticeDue(party, 3271.880), true);
  assert.equal(isNoticeDue(party, 3506), false);
});

test('WhatsApp group invitations have playback windows and do not match unrelated mentions', () => {
  assert.equal(GROUP_INVITE_CUES.length, 17);
  assert.ok(GROUP_INVITE_CUES.every((time, index) => time >= 0 && time < LIVE_DURATION && (!index || time > GROUP_INVITE_CUES[index - 1])));
  const first = GROUP_INVITE_CUES[0];
  assert.equal(isGroupInviteDue(first - .001), false);
  assert.equal(isGroupInviteDue(first), true);
  assert.equal(isGroupInviteDue(first + GROUP_INVITE_DURATION - .001), true);
  assert.equal(isGroupInviteDue(first + GROUP_INVITE_DURATION), false);
  for (const unrelated of [914.320, 2682.960, 2813.760, 2983.760, 3024.920, 3802.640, 3810.880, 4260.719]) {
    assert.equal(isGroupInviteDue(unrelated), false, String(unrelated));
  }
  assert.equal(isGroupInviteDue(NaN), false);
});

test('Nearby closing invitations overlap into one continuous display', () => {
  for (let position = 4747.639; position < 4781.400; position += .1) assert.equal(isGroupInviteDue(position), true);
  assert.equal(isGroupInviteDue(4781.400), false);
  assert.equal(isGroupInviteDue(4786.239), true);
});

test('Only the nine approved support proposals are included, with localized actions', () => {
  assert.deepEqual(SUPPORT_NOTICES.map(item => item.id), ['support-01', 'support-02', 'support-03', 'support-05', 'support-08', 'support-09', 'support-10', 'support-15', 'support-18']);
  for (const item of SUPPORT_NOTICES) {
    for (const lang of ['pt', 'en', 'es']) assert.ok(item.texts[lang], `${item.id}: ${lang}`);
    assert.ok(Boolean(item.action.href) !== Boolean(item.action.faqId), item.id);
    if (item.action.href) {
      assert.equal(new URL(item.action.href).protocol, 'https:');
      for (const lang of ['pt', 'en', 'es']) assert.ok(item.action.labels[lang], `${item.id}: action ${lang}`);
    }
  }
  assert.equal(SUPPORT_NOTICES.find(item => item.id === 'support-02').texts.pt, 'Consulte o estacionamento do Concais e confirme disponibilidade, tarifa e acesso antes de sair.');
  assert.equal(SUPPORT_NOTICES.find(item => item.id === 'support-03').texts.pt, 'Instale agora o BG Guru!: no site do Board Game Guru você encontra os links para Android e iOS.');
  const msc = SUPPORT_NOTICES.find(item => item.id === 'support-18');
  assert.equal(msc.texts.pt, 'Veja mais detalhes e link de download no site da MSC');
  assert.equal(msc.action.href, 'https://www.msccruzeiros.com.br/a-bordo/internet-e-aplicativos/msc-for-me');
  assert.equal(msc.action.labels.pt, 'MSC for Me');
});

test('Support follows each approved utterance with an exclusive end and reversible seeking', () => {
  assert.equal(SUPPORT_DURATION, 12);
  for (const item of SUPPORT_NOTICES) {
    for (const start of item.cueSeconds) {
      assert.ok(start >= 0 && start < LIVE_DURATION);
      assert.notEqual(supportAt(start - .001)?.id, item.id);
      assert.equal(supportAt(start)?.id, item.id);
      assert.equal(supportAt(start + 11.999)?.id, item.id);
      assert.notEqual(supportAt(start + 12)?.id, item.id);
      assert.equal(supportAt(start + 1)?.id, item.id);
      assert.notEqual(supportAt(start - 1)?.id, item.id);
    }
  }
  for (const time of [NaN, Infinity, -1, 1034.839, 1291.600, 1358.400, 2124.839, 2166.079, 2444.599, 3008.559, 3162.760, 3985.920, 4523.280]) {
    assert.equal(supportAt(time), null, String(time));
  }
});
