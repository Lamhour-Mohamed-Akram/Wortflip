import type { VocabularyItem } from '../data/types';
import { isDifficult, isDue } from './scheduler';
import type { Rating, SessionKind, SessionState, WordProgress } from './types';

/** A card answered with "Noch lernen" comes back after this many other cards. */
export const REQUEUE_DISTANCE = 5;
/** Difficult words come back sooner. */
export const REQUEUE_DISTANCE_DIFFICULT = 3;

export type ProgressMap = Readonly<Record<string, WordProgress>>;

function shuffle<T>(list: readonly T[], random: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = out[i] as T;
    out[i] = out[j] as T;
    out[j] = a;
  }
  return out;
}

function createSession(kind: SessionKind, ids: string[], now: number): SessionState | null {
  if (ids.length === 0) return null;
  return { kind, queue: ids, total: ids.length, correct: 0, incorrect: 0, startedAt: now };
}

/** Due words first (difficult ones ahead, then most overdue), then unseen words. */
export function dueItems(items: readonly VocabularyItem[], progress: ProgressMap, now: number): VocabularyItem[] {
  return items
    .filter((item) => isDue(progress[item.id], now))
    .sort((a, b) => {
      const pa = progress[a.id];
      const pb = progress[b.id];
      const difficultDiff = Number(isDifficult(pb)) - Number(isDifficult(pa));
      if (difficultDiff !== 0) return difficultDiff;
      return (pa?.dueAt ?? 0) - (pb?.dueAt ?? 0);
    });
}

export function newItems(items: readonly VocabularyItem[], progress: ProgressMap): VocabularyItem[] {
  return items.filter((item) => progress[item.id] === undefined);
}

/** Words that were reviewed but are not due yet, soonest first. */
export function upcomingItems(items: readonly VocabularyItem[], progress: ProgressMap, now: number): VocabularyItem[] {
  return items
    .filter((item) => {
      const p = progress[item.id];
      return p !== undefined && p.dueAt !== null && p.dueAt > now;
    })
    .sort((a, b) => (progress[a.id]?.dueAt ?? 0) - (progress[b.id]?.dueAt ?? 0));
}

/** Words sorted by how often they were answered with "Noch lernen". */
export function difficultItems(items: readonly VocabularyItem[], progress: ProgressMap): VocabularyItem[] {
  return items
    .filter((item) => (progress[item.id]?.incorrect ?? 0) > 0)
    .sort((a, b) => {
      const pa = progress[a.id];
      const pb = progress[b.id];
      const diff = (pb?.incorrect ?? 0) - (pa?.incorrect ?? 0);
      if (diff !== 0) return diff;
      return (pa?.streak ?? 0) - (pb?.streak ?? 0);
    });
}

export function buildDailySession(
  items: readonly VocabularyItem[],
  progress: ProgressMap,
  size: number,
  now: number,
  random: () => number = Math.random,
): SessionState | null {
  const due = dueItems(items, progress, now);
  const fresh = shuffle(newItems(items, progress), random);
  const ids = [...due, ...fresh].slice(0, size).map((item) => item.id);
  return createSession('daily', ids, now);
}

/** Practice ahead of schedule with the words that become due soonest. */
export function buildExtraSession(
  items: readonly VocabularyItem[],
  progress: ProgressMap,
  size: number,
  now: number,
): SessionState | null {
  const ids = upcomingItems(items, progress, now)
    .slice(0, size)
    .map((item) => item.id);
  return createSession('extra', ids, now);
}

/** Focused review of the most difficult words. */
export function buildFocusSession(
  items: readonly VocabularyItem[],
  progress: ProgressMap,
  size: number,
  now: number,
): SessionState | null {
  const ids = difficultItems(items, progress)
    .slice(0, size)
    .map((item) => item.id);
  return createSession('focus', ids, now);
}

/** Learn a hand-picked selection (e.g. a filtered word list): due and new words first, then the rest. */
export function buildSelectionSession(
  items: readonly VocabularyItem[],
  progress: ProgressMap,
  size: number,
  now: number,
  random: () => number = Math.random,
): SessionState | null {
  const due = dueItems(items, progress, now);
  const fresh = shuffle(newItems(items, progress), random);
  const upcoming = upcomingItems(items, progress, now);
  const ids = [...due, ...fresh, ...upcoming].slice(0, size).map((item) => item.id);
  return createSession('custom', ids, now);
}

/** The card currently on top of the stack. */
export function currentCardId(session: SessionState | null): string | null {
  return session?.queue[0] ?? null;
}

/** Distinct cards that still have to be cleared (answered with "Kenne ich"). */
export function remainingDistinct(session: SessionState): number {
  return new Set(session.queue).size;
}

/**
 * Applies an answer for the card on top of the queue. A "Noch lernen" card is
 * re-inserted a few positions later so it is never shown twice in a row
 * (unless it is the only card left).
 */
export function answerCard(
  session: SessionState,
  id: string,
  rating: Rating,
  difficult: boolean,
): SessionState {
  if (session.queue[0] !== id) return session;
  const rest = session.queue.slice(1);

  if (rating === 'good') {
    return { ...session, queue: rest, correct: session.correct + 1 };
  }

  const distance = difficult ? REQUEUE_DISTANCE_DIFFICULT : REQUEUE_DISTANCE;
  const insertAt = Math.min(distance, rest.length);
  const queue = [...rest.slice(0, insertAt), id, ...rest.slice(insertAt)];
  return { ...session, queue, incorrect: session.incorrect + 1 };
}
