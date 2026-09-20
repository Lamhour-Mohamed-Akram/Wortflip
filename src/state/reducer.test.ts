import { describe, expect, it } from 'vitest';
import { defaultState } from '../learning/storage';
import { reducer } from './reducer';

const NOW = Date.UTC(2026, 8, 18, 12, 0, 0);

describe('reducer', () => {
  it('records a review, updates stats, streak and the running session', () => {
    let state = reducer(defaultState(), { type: 'onboarding/complete', levels: ['A1', 'B1'] });
    expect(state.settings.onboarded).toBe(true);
    expect(state.settings.levels).toEqual(['A1', 'B1']);
    state = reducer(state, {
      type: 'session/set',
      session: { kind: 'daily', queue: ['tisch', 'haus'], total: 2, correct: 0, incorrect: 0, startedAt: NOW },
    });
    state = reducer(state, { type: 'review', id: 'tisch', rating: 'good', now: NOW });
    expect(state.progress.tisch?.box).toBe(1);
    expect(state.stats.totalReviews).toBe(1);
    expect(state.streak.current).toBe(1);
    expect(state.session?.queue).toEqual(['haus']);
  });

  it('"progress/reset" keeps settings, "app/reset-all" returns to the onboarding', () => {
    let state = reducer(defaultState(), { type: 'onboarding/complete', levels: ['A2'] });
    state = reducer(state, { type: 'settings/sessionSize', sessionSize: 30 });
    state = reducer(state, { type: 'review', id: 'termin', rating: 'again', now: NOW });

    const partial = reducer(state, { type: 'progress/reset' });
    expect(partial.progress).toEqual({});
    expect(partial.stats.totalReviews).toBe(0);
    expect(partial.settings).toEqual({ levels: ['A2'], sessionSize: 30, showTranslation: false, onboarded: true });

    const full = reducer(state, { type: 'app/reset-all' });
    expect(full).toEqual(defaultState());
    expect(full.settings.onboarded).toBe(false);
  });

  it('changing levels or session size discards the running session', () => {
    let state = reducer(defaultState(), {
      type: 'session/set',
      session: { kind: 'daily', queue: ['tisch'], total: 1, correct: 0, incorrect: 0, startedAt: NOW },
    });
    expect(reducer(state, { type: 'settings/levels', levels: ['A1'] }).session).not.toBeNull(); // unchanged levels
    state = reducer(state, { type: 'settings/levels', levels: ['B1'] });
    expect(state.session).toBeNull();
  });

  it('toggling the translation keeps the running session', () => {
    let state = reducer(defaultState(), {
      type: 'session/set',
      session: { kind: 'daily', queue: ['tisch'], total: 1, correct: 0, incorrect: 0, startedAt: NOW },
    });
    state = reducer(state, { type: 'settings/showTranslation', showTranslation: true });
    expect(state.settings.showTranslation).toBe(true);
    expect(state.session).not.toBeNull();
    expect(reducer(state, { type: 'settings/showTranslation', showTranslation: true })).toBe(state);
  });
});
