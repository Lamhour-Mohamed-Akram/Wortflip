import { describe, expect, it } from 'vitest';
import { defaultState } from '../learning/storage';
import { pendingTopics } from './share';
import type { VocabularyItem } from '../data/types';

const w = (id: string, word: string, theme: string): VocabularyItem => ({ id, word, type: 'noun', level: 'B1', definitionDe: 'x', exampleDe: 'y', theme });

describe('pendingTopics', () => {
  it('lists unshared topics and topics that grew since sharing', () => {
    const state = defaultState();
    state.customWords = [w('custom-a', 'Alpha', 'Neu'), w('custom-b', 'Beta', 'Geteilt'), w('custom-c', 'Gamma', 'Geteilt')];
    state.community.shared = { Geteilt: '3f2b9c1e-1111-2222-3333-444444444444' };
    state.community.topics = [{ id: '3f2b9c1e-1111-2222-3333-444444444444', theme: 'Geteilt', level: 'B1', items: [w('community-x', 'Beta', 'Geteilt')], createdAt: 1 }];
    const pending = pendingTopics(state, state.customWords);
    expect([...pending.keys()].sort()).toEqual(['Geteilt', 'Neu']); // Geteilt: Gamma is new since the share
    state.community.topics[0]!.items.push(w('community-y', 'Gamma', 'Geteilt'));
    expect([...pendingTopics(state, state.customWords).keys()]).toEqual(['Neu']);
  });
});
