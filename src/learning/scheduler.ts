import { DAY_MS } from './time';
import type { Rating, WordProgress } from './types';

/**
 * Spaced repetition, Leitner style.
 *
 * Every word sits in a "box". Box 0 means "being learned right now": the word
 * comes back within the same session. Each "Kenne ich" moves the word one box
 * up and schedules it after the matching interval below. Passing the last
 * interval marks the word as mastered; mastered words keep coming back every
 * 30 days. A single "Noch lernen" drops the word back to box 0 and makes it
 * due immediately.
 */
export const REVIEW_INTERVALS_DAYS: readonly number[] = [1, 3, 7, 14, 30];

/** Reaching this box marks a word as mastered. */
export const MASTERED_BOX = REVIEW_INTERVALS_DAYS.length;

/** From this many "Noch lernen" answers on, a word counts as difficult. */
export const DIFFICULT_THRESHOLD = 3;

export function createProgress(id: string): WordProgress {
  return {
    id,
    status: 'new',
    box: 0,
    dueAt: null,
    lastReviewedAt: null,
    correct: 0,
    incorrect: 0,
    streak: 0,
  };
}

export function isDifficult(p: WordProgress | undefined): boolean {
  return p !== undefined && p.incorrect >= DIFFICULT_THRESHOLD;
}

export function isDue(p: WordProgress | undefined, now: number): boolean {
  return p !== undefined && p.dueAt !== null && p.dueAt <= now;
}

export function reviewWord(p: WordProgress, rating: Rating, now: number): WordProgress {
  if (rating === 'again') {
    return {
      ...p,
      status: 'learning',
      box: 0,
      dueAt: now,
      lastReviewedAt: now,
      incorrect: p.incorrect + 1,
      streak: 0,
    };
  }

  const answered: WordProgress = {
    ...p,
    lastReviewedAt: now,
    correct: p.correct + 1,
    streak: p.streak + 1,
  };

  // Practising ahead of schedule ("Extra-Runde") must not let the interval
  // grow without the memory actually being tested after the gap, so a
  // correct answer on a not-yet-due word keeps its box and due date.
  const reviewedEarly = p.box > 0 && p.dueAt !== null && p.dueAt > now;
  if (reviewedEarly) return answered;

  const box = Math.min(p.box + 1, MASTERED_BOX);
  const intervalDays = REVIEW_INTERVALS_DAYS[box - 1] ?? REVIEW_INTERVALS_DAYS[MASTERED_BOX - 1] ?? 30;
  return {
    ...answered,
    box,
    status: box >= MASTERED_BOX ? 'mastered' : 'learning',
    dueAt: now + intervalDays * DAY_MS,
  };
}
