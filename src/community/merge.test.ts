import { describe, expect, it } from 'vitest';
import { communityItemId, topicFromRow } from './api';
import { communityCatalogue } from './merge';
import type { VocabularyItem } from '../data/types';

const BUNDLED: VocabularyItem[] = [
  { id: 'termin', word: 'Termin', article: 'der', type: 'noun', level: 'A1', definitionDe: 'x', exampleDe: 'y' },
];

const ROW = {
  id: '3f2b9c1e-1111-2222-3333-444444444444',
  created_at: '2026-09-26T10:00:00Z',
  theme: 'Beim Arzt',
  level: 'B1',
  items: [
    { word: 'das Stethoskop', type: 'Nomen', plural: 'Stethoskope', definitionDe: 'Gerät zum Abhören.', exampleDe: 'Die Ärztin nimmt das Stethoskop.', translationEn: 'stethoscope' },
    { word: 'Termin', type: 'noun', article: 'der', definitionDe: 'x', exampleDe: 'y' },
    { word: 'kaputt', type: 'noun', definitionDe: '', exampleDe: 'y' },
  ],
};

describe('topicFromRow', () => {
  it('normalises the rows and gives community ids', () => {
    const topic = topicFromRow(ROW)!;
    expect(topic.theme).toBe('Beim Arzt');
    expect(topic.items.map((i) => i.id)).toEqual(['community-3f2b9c1e-stethoskop', 'community-3f2b9c1e-termin']);
    expect(topic.items[0]).toMatchObject({ word: 'Stethoskop', article: 'das', level: 'B1', theme: 'Beim Arzt', sourceIds: ['community'] });
    expect(topic.createdAt).toBe(Date.parse('2026-09-26T10:00:00Z'));
  });

  it('drops rows without usable entries or with a bad level', () => {
    expect(topicFromRow({ ...ROW, level: 'C2' })).toBeNull();
    expect(topicFromRow({ ...ROW, items: ['junk'] })).toBeNull();
    expect(communityItemId('abcdefgh-1', 'sich freuen', 'verb')).toBe('community-abcdefgh-freuen-verb');
  });
});

describe('communityCatalogue', () => {
  it('adds unknown words, links known ones and lets the newest topic win', () => {
    const older = topicFromRow({ ...ROW, id: 'aaaaaaaa-1111-2222-3333-444444444444', created_at: '2026-09-25T10:00:00Z', theme: 'Klinik' })!;
    const newer = topicFromRow(ROW)!;
    const { items, links } = communityCatalogue([older, newer], BUNDLED, new Set());
    expect(items.map((i) => [i.id, i.theme])).toEqual([['community-3f2b9c1e-stethoskop', 'Beim Arzt']]);
    expect(links).toEqual({ 'Beim Arzt': ['termin'], Klinik: ['termin'] });
  });

  it('skips hidden topics', () => {
    const topic = topicFromRow(ROW)!;
    expect(communityCatalogue([topic], BUNDLED, new Set([topic.id]))).toEqual({ items: [], links: {} });
  });
});
