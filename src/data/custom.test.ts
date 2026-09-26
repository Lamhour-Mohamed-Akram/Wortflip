import { describe, expect, it } from 'vitest';
import { buildPrompt, customId, exportCustomWords, groupByTheme, normalizeCustomItem, parseCustomWords } from './custom';
import type { VocabularyItem } from './types';

const EXISTING: VocabularyItem[] = [
  { id: 'termin', word: 'Termin', article: 'der', plural: 'Termine', type: 'noun', level: 'A1', definitionDe: 'x', exampleDe: 'y' },
];

const ANSWER = `Here you go:
\`\`\`json
[
  {"word": "die Praxis", "type": "Nomen", "plural": "die Praxen", "definitionDe": "Der Ort, an dem ein Arzt arbeitet – ohne Krankenhaus.", "exampleDe": "Die Praxis ist heute geschlossen.", "translationEn": "practice"},
  {"word": "Termin", "type": "noun", "article": "der", "definitionDe": "Eine feste Zeit.", "exampleDe": "Ich habe einen Termin."},
  {"word": "warten", "type": "verb", "definitionDe": "Bleiben, bis etwas passiert.", "exampleDe": "Wir warten auf den Arzt.", "translationEn": "to wait", "verbForms": {"thirdPersonPresent": "er wartet", "preterite": "wartete", "participleII": "hat gewartet", "extra": 1}},
  {"word": "", "type": "noun", "definitionDe": "leer", "exampleDe": "leer"},
  {"word": "warten", "type": "verb", "definitionDe": "doppelt", "exampleDe": "doppelt"}
]
\`\`\``;

describe('parseCustomWords', () => {
  it('reads a fenced AI answer, normalises entries and reports duplicates and invalid ones', () => {
    const result = parseCustomWords(ANSWER, { level: 'A2', theme: 'Beim Arzt', existing: EXISTING });
    expect(result.error).toBeNull();
    expect(result.items).toHaveLength(2);
    expect(result.duplicates).toBe(2); // "Termin" exists, "warten" twice in the answer
    expect(result.duplicateWords).toEqual(['Termin', 'warten']);
    expect(result.existingIds).toEqual(['termin']); // only the app's word, not the repeat inside the answer
    expect(parseCustomWords('[{"theme": "Küche", "level": "A1", "word": "Topf", "type": "noun", "article": "der", "definitionDe": "x", "exampleDe": "y"}]', { existing: [] }).foundThemes).toEqual(['Küche']);
    expect(result.invalid).toBe(1);

    const praxis = result.items[0]!;
    expect(praxis).toMatchObject({ id: 'custom-praxis', word: 'Praxis', article: 'die', plural: 'Praxen', type: 'noun', level: 'A2', theme: 'Beim Arzt', translationEn: 'practice', sourceIds: ['custom'] });
    expect(praxis.definitionDe).toBe('Der Ort, an dem ein Arzt arbeitet, ohne Krankenhaus.');

    const warten = result.items[1]!;
    expect(warten.id).toBe('custom-warten-verb');
    expect(warten.verbForms).toEqual({ thirdPersonPresent: 'er wartet', preterite: 'wartete', participleII: 'hat gewartet' });
  });

  it('skips entries with offensive words and counts them separately', () => {
    const text = JSON.stringify([
      { word: 'Arschloch', type: 'noun', article: 'das', definitionDe: 'x', exampleDe: 'y' },
      { word: 'Haus', type: 'noun', article: 'das', definitionDe: 'Scheiß Haus.', exampleDe: 'y' },
      { word: 'Garten', type: 'noun', article: 'der', definitionDe: 'Ein Stück Land am Haus.', exampleDe: 'Der Garten ist groß.' },
    ]);
    const result = parseCustomWords(text, { level: 'A1', existing: [] });
    expect(result.offensive).toBe(2);
    expect(result.items.map((i) => i.word)).toEqual(['Garten']);
  });

  it('salvages the good entries when one entry breaks the JSON', () => {
    const broken = `[
{"theme": "Data", "level": "B1", "word": "Datenbank", "type": "noun", "article": "die", "definitionDe": "Ein System, das Informationen speichert.", "exampleDe": "Alle Kundendaten sind in einer Datenbank."},
{"theme": "Data", "level": "B1", "word": "Sicherheit", "type": "noun", "article": "die", "definitionDe": "Der Schutz von Daten.", "exampleDe": "Die Sicherheit der Daten ist wichtig.", "translationEn": "security"}},
{"theme": "Data", "level": "B1", "word": "speichern", "type": "verb", "definitionDe": "Informationen dauerhaft ablegen.", "exampleDe": "Ich möchte die Datei speichern.", "verbForms": {"thirdPersonPresent": "er speichert"}}
{"theme": "Data", "level": "B1", "word": "kaputt", "type": "noun", "definitionDe": "x", "exampleDe": "y" "translationEn": "broken"}
]`;
    const result = parseCustomWords(broken, { existing: [] });
    expect(result.error).toBeNull();
    expect(result.items.map((i) => i.word)).toEqual(['Datenbank', 'Sicherheit', 'speichern']);
    expect(result.invalid).toBe(1);
    expect(result.items[2]?.verbForms).toEqual({ thirdPersonPresent: 'er speichert' });
  });

  it('reports unreadable text instead of throwing', () => {
    const result = parseCustomWords('Sorry, I cannot help with that.', { level: 'A1', existing: [] });
    expect(result.items).toHaveLength(0);
    expect(result.error).toMatch(/JSON/);
  });

  it('accepts an export file with per-entry levels and topics', () => {
    const file = exportCustomWords(parseCustomWords(ANSWER, { level: 'B1', theme: 'Arzt', existing: [] }).items);
    const result = parseCustomWords(file, { existing: [] });
    expect(result.items.map((i) => [i.level, i.theme])).toEqual([['B1', 'Arzt'], ['B1', 'Arzt'], ['B1', 'Arzt']]);
    expect(file).not.toMatch(/sourceIds/);
  });
});

describe('normalizeCustomItem', () => {
  it('rejects entries without a level, type or texts', () => {
    expect(normalizeCustomItem({ word: 'Haus', type: 'noun', definitionDe: 'x', exampleDe: 'y' })).toBeNull(); // no level anywhere
    expect(normalizeCustomItem({ word: 'Haus', type: 'thing', definitionDe: 'x', exampleDe: 'y', level: 'A1' })).toBeNull();
    expect(normalizeCustomItem({ word: 'Haus', type: 'noun', definitionDe: '', exampleDe: 'y', level: 'A1' })).toBeNull();
    expect(normalizeCustomItem('Haus')).toBeNull();
  });

  it('keeps a valid custom id and drops noun fields on non-nouns', () => {
    const item = normalizeCustomItem({ id: 'custom-schnell-adjective', word: 'schnell', type: 'Adjektiv', article: 'der', level: 'A1', definitionDe: 'x', exampleDe: 'y', adjectiveForms: { comparative: 'schneller', superlative: 'am schnellsten' } });
    expect(item).toMatchObject({ id: 'custom-schnell-adjective', type: 'adjective', adjectiveForms: { comparative: 'schneller', superlative: 'am schnellsten' } });
    expect(item?.article).toBeUndefined();
  });
});

describe('helpers', () => {
  it('builds ids and prompts', () => {
    expect(customId('Übung', 'noun')).toBe('custom-uebung');
    expect(customId('sich freuen', 'verb')).toBe('custom-freuen-verb');
    const prompt = buildPrompt({ level: 'B1', theme: 'Im Büro', count: 100 });
    expect(prompt).toContain('100 German words');
    expect(prompt).toContain('"Im Büro"');
    expect(prompt).toContain('level B1');
    expect(prompt).toContain('"theme": always "Im Büro"');
    expect(prompt).not.toMatch(/[–—]/);
  });

  it('groups by topic', () => {
    const items = parseCustomWords(ANSWER, { level: 'A2', theme: 'Arzt', existing: [] }).items;
    const other = normalizeCustomItem({ word: 'Chef', type: 'noun', article: 'der', level: 'B1', definitionDe: 'x', exampleDe: 'y' })!;
    const groups = groupByTheme([...items, other]);
    expect(groups.map((g) => [g.theme, g.items.length, g.levels])).toEqual([
      ['Arzt', 3, ['A2']],
      ['Ohne Thema', 1, ['B1']],
    ]);
  });
});
