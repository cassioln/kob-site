import { CHAPTERS, LIVE_DURATION, GROUP_INVITE_CUES, GROUP_INVITE_DURATION } from './manual-de-bordo-live-data.js?v=20261008-live-copy';

import { SUPPORT_NOTICES } from './manual-de-bordo-live-support.js?v=20261008-live-copy';

export function topicAt(seconds) {
  return CHAPTERS.findLast(topic => topic.seconds <= Number(seconds)) || CHAPTERS[0];
}

export function topicBounds(topic, videoDuration = LIVE_DURATION) {
  const index = CHAPTERS.findIndex(item => item.id === topic.id);
  const next = CHAPTERS[index + 1];
  const start = topic.seconds;
  const end = next?.seconds ?? Math.max(start + 1, Number(videoDuration) || LIVE_DURATION);
  return { start, end, duration: end - start };
}

/** An editorial update belongs to its mapped utterance, through this topic's end. */
export function isNoticeDue(topic, seconds) {
  if (!topic?.notice || !Number.isFinite(topic.noticeSeconds)) return false;
  const { end } = topicBounds(topic);
  const position = Number(seconds);
  return position >= topic.noticeSeconds && position < end;
}

/** On mobile the latest utterance remains available until its topic ends. */
export function mobileNoticeAt(topic, seconds) {
  if (!topic || !Number.isFinite(Number(seconds))) return null;
  const position = Number(seconds);
  const { start, end } = topicBounds(topic);
  if (position < start || position >= end) return null;
  let latest = isNoticeDue(topic, position)
    ? { key: `${topic.id}:update:${topic.noticeSeconds}`, seconds: topic.noticeSeconds, update: true, support: null }
    : null;
  for (const support of SUPPORT_NOTICES) {
    for (const cue of support.cueSeconds) {
      if (cue >= start && cue <= position && (!latest || cue > latest.seconds)) {
        latest = { key: `${topic.id}:${support.id}:${cue}`, seconds: cue, update: false, support };
      }
    }
  }
  return latest;
}

export function isGroupInviteDue(seconds) {
  const position = Number(seconds);
  return GROUP_INVITE_CUES.some(start => position >= start && position < start + GROUP_INVITE_DURATION);
}

export function topicProgress(topic, seconds, videoDuration) {
  const bounds = topicBounds(topic, videoDuration);
  return { ...bounds, elapsed: Math.min(bounds.duration, Math.max(0, Number(seconds) - bounds.start || 0)) };
}

export function seekInTopic(topic, elapsed, videoDuration) {
  const bounds = topicBounds(topic, videoDuration);
  // The end belongs to the next topic. Scrubbing to the edge stays in this one.
  return bounds.start + Math.min(bounds.duration - 0.05, Math.max(0, Number(elapsed) || 0));
}
