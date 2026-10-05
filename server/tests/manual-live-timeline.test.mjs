import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAPTERS } from '../../assets/js/manual-de-bordo-live-data.js';
import { topicAt, topicBounds, topicProgress, seekInTopic } from '../../assets/js/manual-de-bordo-live-timeline.js';

test('intervalo é delimitado pelo assunto seguinte e o último usa a duração real', () => {
  assert.deepEqual(topicBounds(CHAPTERS[0]), { start: 833, end: 913, duration: 80 });
  assert.deepEqual(topicBounds(CHAPTERS.at(-1), 4807), { start: 4712, end: 4807, duration: 95 });
  for (let i = 0; i < CHAPTERS.length - 1; i++) {
    assert.equal(topicBounds(CHAPTERS[i]).end, CHAPTERS[i + 1].seconds);
  }
});
test('relógio e seleção atravessam assuntos inclusive no limite exato', () => {
  assert.equal(topicAt(912.9).id, CHAPTERS[0].id);
  assert.equal(topicAt(913).seconds, 913);
  assert.equal(topicProgress(CHAPTERS[0], 853).elapsed, 20);
  assert.equal(topicProgress(CHAPTERS[0], 0).elapsed, 0);
  assert.equal(topicProgress(CHAPTERS[0], 999).elapsed, 80);
});
test('scrub é relativo e permanece dentro do assunto, mesmo no início/fim e com valores inválidos', () => {
  assert.equal(seekInTopic(CHAPTERS[0], 20), 853);
  assert.equal(seekInTopic(CHAPTERS[0], -5), 833);
  assert.equal(seekInTopic(CHAPTERS[0], NaN), 833);
  assert.ok(seekInTopic(CHAPTERS[0], 80) < 913);
  assert.ok(seekInTopic(CHAPTERS.at(-1), 1000, 4807) < 4807);
});
