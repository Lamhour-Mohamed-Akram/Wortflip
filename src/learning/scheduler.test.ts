import { describe, expect, it } from 'vitest';
import { createProgress, DIFFICULT_THRESHOLD, isDifficult, MASTERED_BOX, REVIEW_INTERVALS_DAYS, reviewWord } from './scheduler';
import { DAY_MS } from './time';

const NOW = Date.UTC(2026, 8, 18, 12, 0, 0);

describe('reviewWord', () => {
  it('starts as new and becomes learning with a 1-day interval after the first "good"', () => {
    const p = createProgress('tisch');
    expect(p.status).toBe('new');
    const next = reviewWord(p, 'good', NOW);
    expect(next.status).toBe('learning');
    expect(next.box).toBe(1);
    expect(next.dueAt).toBe(NOW + 1 * DAY_MS);
    expect(next.correct).toBe(1);
    expect(next.streak).toBe(1);
  });

  it('follows the 1, 3, 7, 14, 30 day ladder and marks the word mastered at the end', () => {
    let p = createProgress('haus');
    let now = NOW;
    for (const days of REVIEW_INTERVALS_DAYS) {
      p = reviewWord(p, 'good', now);
      expect(p.dueAt).toBe(now + days * DAY_MS);
      now = p.dueAt as number; // review exactly when due
    }
    expect(p.box).toBe(MASTERED_BOX);
    expect(p.status).toBe('mastered');

    // Mastered words keep a 30-day cycle.
    const later = reviewWord(p, 'good', now);
    expect(later.box).toBe(MASTERED_BOX);
    expect(later.dueAt).toBe(now + 30 * DAY_MS);
  });

  it('"again" resets to box 0, makes the word due immediately and counts a lapse', () => {
    const learned = reviewWord(reviewWord(createProgress('zug'), 'good', NOW), 'good', NOW + 2 * DAY_MS);
    const lapsed = reviewWord(learned, 'again', NOW + 5 * DAY_MS);
    expect(lapsed.box).toBe(0);
    expect(lapsed.status).toBe('learning');
    expect(lapsed.dueAt).toBe(NOW + 5 * DAY_MS);
    expect(lapsed.incorrect).toBe(1);
    expect(lapsed.streak).toBe(0);
  });

  it('does not grow the interval when a word is reviewed before it is due', () => {
    const p = reviewWord(createProgress('brot'), 'good', NOW); // due tomorrow
    const early = reviewWord(p, 'good', NOW + 60 * 60 * 1000); // one hour later
    expect(early.box).toBe(1);
    expect(early.dueAt).toBe(p.dueAt);
    expect(early.correct).toBe(2);
  });

  it('flags repeatedly missed words as difficult', () => {
    let p = createProgress('umwelt');
    for (let i = 0; i < DIFFICULT_THRESHOLD; i++) p = reviewWord(p, 'again', NOW + i);
    expect(isDifficult(p)).toBe(true);
    expect(isDifficult(createProgress('x'))).toBe(false);
  });
});
