import { describe, expect, it } from 'vitest';
import { dataset, validateDataset } from '../data';
import { loadState, sanitizeState, saveState, STORAGE_KEY, type StorageLike } from './storage';

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

const VALID_IDS = new Set(['tisch', 'gehen']);

describe('storage', () => {
  it('returns defaults when nothing is stored or storage is unavailable', () => {
    expect(loadState(memoryStorage(), VALID_IDS).settings.onboarded).toBe(false);
    expect(loadState(null, VALID_IDS).progress).toEqual({});
  });

  it('survives corrupted JSON', () => {
    const storage = memoryStorage({ [STORAGE_KEY]: '{not json' });
    const state = loadState(storage, VALID_IDS);
    expect(state.version).toBe(1);
    expect(state.session).toBeNull();
  });

  it('drops invalid parts but keeps the valid ones', () => {
    const state = sanitizeState(
      {
        settings: { levels: ['A2', 'C2'], sessionSize: 99, showTranslation: 'yes', onboarded: true },
        progress: {
          tisch: { status: 'learning', box: 1, dueAt: 5, lastReviewedAt: 4, correct: 1, incorrect: 0, streak: 1 },
          gehen: { status: 'weird', box: -1 },
          unknown: { status: 'new', box: 0, dueAt: null, lastReviewedAt: null, correct: 0, incorrect: 0, streak: 0 },
        },
        streak: { current: 3, best: 2, lastActiveDay: 'yesterday' },
        stats: { totalReviews: 4, totalCorrect: 9, reviewsByDay: { '2026-09-18': 2, bad: 'x' } },
        session: { kind: 'daily', queue: ['tisch', 'nope'], total: 2, correct: 0, incorrect: 0, startedAt: 1 },
      },
      VALID_IDS,
    );
    expect(state.settings.levels).toEqual(['A2']);
    expect(state.settings.sessionSize).toBe(10);
    expect(state.settings.showTranslation).toBe(true); // invalid value falls back to the default (on)
    expect(state.settings.onboarded).toBe(true);
    expect(Object.keys(state.progress)).toEqual(['tisch']);
    expect(state.streak).toEqual({ current: 3, best: 3, lastActiveDay: null });
    expect(state.stats.totalCorrect).toBe(4);
    expect(state.stats.reviewsByDay).toEqual({ '2026-09-18': 2 });
    expect(state.session).toBeNull();
  });

  it('round-trips a saved state', () => {
    const storage = memoryStorage();
    const state = loadState(storage, VALID_IDS);
    state.settings.onboarded = true;
    state.progress.tisch = { id: 'tisch', status: 'learning', box: 2, dueAt: 10, lastReviewedAt: 9, correct: 2, incorrect: 1, streak: 2 };
    expect(saveState(storage, state)).toBe(true);
    expect(loadState(storage, VALID_IDS)).toEqual(state);
  });
});

describe('dataset', () => {
  it('is internally consistent', () => {
    expect(validateDataset(dataset)).toEqual([]);
    expect(dataset.items.length).toBeGreaterThanOrEqual(40);
    for (const type of ['noun', 'verb', 'adjective'] as const) {
      expect(dataset.items.some((item) => item.type === type)).toBe(true);
    }
  });
});
