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
    expect(partial.settings).toEqual({ levels: ['A2'], sessionSize: 30, showTranslation: true, showCommunity: true, onboarded: true });
    expect(partial.customWords).toEqual([]);

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
    state = reducer(state, { type: 'settings/showTranslation', showTranslation: false });
    expect(state.settings.showTranslation).toBe(false);
    expect(state.session).not.toBeNull();
    expect(reducer(state, { type: 'settings/showTranslation', showTranslation: false })).toBe(state);
  });

  it('adds and removes custom words together with their progress', () => {
    const word = { id: 'custom-praxis', word: 'Praxis', article: 'die', type: 'noun', level: 'A2', definitionDe: 'x', exampleDe: 'y', theme: 'Arzt' } as const;
    let state = reducer(defaultState(), { type: 'custom/add', items: [word] });
    expect(state.customWords).toHaveLength(1);
    expect(reducer(state, { type: 'custom/add', items: [word] })).toBe(state); // no duplicates
    state = reducer(state, { type: 'review', id: 'custom-praxis', rating: 'good', now: NOW });
    state = reducer(state, { type: 'session/set', session: { kind: 'custom', queue: ['custom-praxis', 'tisch'], total: 2, correct: 0, incorrect: 0, startedAt: NOW } });
    const kept = reducer(state, { type: 'progress/reset' });
    expect(kept.customWords).toHaveLength(1);
    expect(kept.progress).toEqual({});
    state = reducer(state, { type: 'custom/remove', ids: ['custom-praxis'] });
    expect(state.customWords).toEqual([]);
    expect(state.progress['custom-praxis']).toBeUndefined();
    expect(state.session?.queue).toEqual(['tisch']);
    expect(reducer(defaultState(), { type: 'app/reset-all' }).customWords).toEqual([]);
  });

  it('attaches existing words to a topic and detaches them when the topic goes', () => {
    let state = reducer(defaultState(), { type: 'custom/add', items: [], theme: 'Arzt', linkIds: ['tisch', 'haus'] });
    expect(state.themeLinks).toEqual({ Arzt: ['tisch', 'haus'] });
    state = reducer(state, { type: 'custom/add', items: [], theme: 'Arzt', linkIds: ['haus', 'brot'] });
    expect(state.themeLinks.Arzt).toEqual(['tisch', 'haus', 'brot']);
    state = reducer(state, { type: 'review', id: 'tisch', rating: 'good', now: NOW });
    state = reducer(state, { type: 'custom/removeTheme', theme: 'Arzt', ids: [] });
    expect(state.themeLinks).toEqual({});
    expect(state.progress.tisch).toBeDefined(); // bundled words keep their progress
  });

  it('removes a group of words without a topic ("Ohne Thema")', () => {
    const word = { id: 'custom-schlau-adjective', word: 'schlau', type: 'adjective', level: 'A2', definitionDe: 'x', exampleDe: 'y' } as const;
    let state = reducer(defaultState(), { type: 'custom/add', items: [word] });
    state = reducer(state, { type: 'custom/removeTheme', theme: 'Ohne Thema', ids: ['custom-schlau-adjective'] });
    expect(state.customWords).toEqual([]);
  });

  it('caches community topics, records shares and reports', () => {
    const topic = { id: '3f2b9c1e-1111-2222-3333-444444444444', theme: 'Arzt', level: 'B1', items: [{ id: 'community-3f2b9c1e-kittel', word: 'Kittel', article: 'der', type: 'noun', level: 'B1', definitionDe: 'x', exampleDe: 'y' }], createdAt: NOW } as const;
    let state = reducer(defaultState(), { type: 'community/shared', theme: 'Arzt', topic: { ...topic, items: [...topic.items] } });
    expect(state.community.shared).toEqual({ Arzt: topic.id });
    expect(state.community.topics.map((t) => t.id)).toEqual([topic.id]);
    const grown = { ...topic, items: [...topic.items, { ...topic.items[0], id: 'community-3f2b9c1e-spritze', word: 'Spritze' }] };
    state = reducer(state, { type: 'community/shared', theme: 'Arzt', topic: grown });
    expect(state.community.topics[0]?.items).toHaveLength(2); // the merged copy replaces the cached one
    state = reducer(state, { type: 'community/topics', topics: [], syncedAt: NOW });
    expect(state.community.topics).toEqual([]);
    state = reducer(state, { type: 'community/report', id: topic.id });
    expect(reducer(state, { type: 'community/report', id: topic.id })).toBe(state);
    expect(state.community.reported).toEqual([topic.id]);
    const kept = reducer(state, { type: 'progress/reset' });
    expect(kept.community.reported).toEqual([topic.id]);
  });

  it('renames a topic across own words, links and the shared map', () => {
    const word = { id: 'custom-spritze', word: 'Spritze', article: 'die', type: 'noun', level: 'B1', definitionDe: 'x', exampleDe: 'y', theme: 'im krankenhaus' } as const;
    let state = reducer(defaultState(), { type: 'custom/add', items: [word], theme: 'im krankenhaus', linkIds: ['tisch'] });
    state = reducer(state, { type: 'custom/renameTheme', from: 'im krankenhaus', to: 'Im Krankenhaus' });
    expect(state.customWords[0]?.theme).toBe('Im Krankenhaus');
    expect(state.themeLinks).toEqual({ 'Im Krankenhaus': ['tisch'] });
  });
});
