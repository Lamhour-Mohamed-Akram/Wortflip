import { describe, expect, it } from 'vitest';
import type { VocabularyItem } from '../data/types';
import { createProgress, reviewWord } from './scheduler';
import {
  answerCard,
  buildDailySession,
  buildExtraSession,
  buildFocusSession,
  REQUEUE_DISTANCE,
  REQUEUE_DISTANCE_DIFFICULT,
  remainingDistinct,
} from './session';
import { DAY_MS } from './time';
import type { WordProgress } from './types';

const NOW = Date.UTC(2026, 8, 18, 12, 0, 0);

function item(id: string): VocabularyItem {
  return { id, word: id, type: 'other', level: 'A1', definitionDe: id, exampleDe: id };
}

const ITEMS = Array.from({ length: 12 }, (_, i) => item(`w${i}`));
const noShuffle = () => 0;

describe('buildDailySession', () => {
  it('puts due words before new words and respects the session size', () => {
    const progress: Record<string, WordProgress> = {
      w5: { ...reviewWord(createProgress('w5'), 'good', NOW - 3 * DAY_MS) }, // due
      w6: { ...reviewWord(createProgress('w6'), 'good', NOW) }, // not due yet
    };
    const session = buildDailySession(ITEMS, progress, 5, NOW, noShuffle);
    expect(session).not.toBeNull();
    expect(session?.queue[0]).toBe('w5');
    expect(session?.queue).not.toContain('w6');
    expect(session?.queue).toHaveLength(5);
    expect(session?.total).toBe(5);
  });

  it('returns null when nothing is due and nothing is new', () => {
    const progress: Record<string, WordProgress> = {};
    for (const it of ITEMS) progress[it.id] = reviewWord(createProgress(it.id), 'good', NOW);
    expect(buildDailySession(ITEMS, progress, 10, NOW)).toBeNull();
    const extra = buildExtraSession(ITEMS, progress, 10, NOW);
    expect(extra?.kind).toBe('extra');
    expect(extra?.queue).toHaveLength(10);
  });

  it('prioritises difficult words among the due ones', () => {
    let hard = createProgress('w2');
    for (let i = 0; i < 3; i++) hard = reviewWord(hard, 'again', NOW - 10 * DAY_MS + i);
    const progress: Record<string, WordProgress> = {
      w1: reviewWord(createProgress('w1'), 'good', NOW - 20 * DAY_MS), // most overdue
      w2: hard,
    };
    const session = buildDailySession(ITEMS, progress, 10, NOW, noShuffle);
    expect(session?.queue.slice(0, 2)).toEqual(['w2', 'w1']);
  });
});

describe('answerCard', () => {
  const base = { kind: 'daily' as const, queue: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], total: 8, correct: 0, incorrect: 0, startedAt: NOW };

  it('removes a card answered with "good"', () => {
    const next = answerCard(base, 'a', 'good', false);
    expect(next.queue).toEqual(['b', 'c', 'd', 'e', 'f', 'g', 'h']);
    expect(next.correct).toBe(1);
    expect(remainingDistinct(next)).toBe(7);
  });

  it('re-inserts a card answered with "again" after five other cards', () => {
    const next = answerCard(base, 'a', 'again', false);
    expect(next.queue.indexOf('a')).toBe(REQUEUE_DISTANCE);
    expect(next.queue).toHaveLength(8);
    expect(next.incorrect).toBe(1);
    expect(remainingDistinct(next)).toBe(8);
  });

  it('brings difficult cards back sooner', () => {
    const next = answerCard(base, 'a', 'again', true);
    expect(next.queue.indexOf('a')).toBe(REQUEUE_DISTANCE_DIFFICULT);
  });

  it('never shows the same card twice in a row while other cards remain', () => {
    const short = { ...base, queue: ['a', 'b'], total: 2 };
    const next = answerCard(short, 'a', 'again', false);
    expect(next.queue).toEqual(['b', 'a']);
  });

  it('ignores answers for a card that is not on top', () => {
    expect(answerCard(base, 'c', 'good', false)).toBe(base);
  });
});

describe('buildFocusSession', () => {
  it('uses the most-missed words first', () => {
    const progress: Record<string, WordProgress> = {
      w1: reviewWord(createProgress('w1'), 'again', NOW),
      w2: reviewWord(reviewWord(createProgress('w2'), 'again', NOW), 'again', NOW + 1),
      w3: reviewWord(createProgress('w3'), 'good', NOW),
    };
    const session = buildFocusSession(ITEMS, progress, 10, NOW);
    expect(session?.kind).toBe('focus');
    expect(session?.queue).toEqual(['w2', 'w1']);
  });
});
