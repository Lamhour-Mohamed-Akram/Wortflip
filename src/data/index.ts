import type { Level, VocabularyDataset, VocabularyItem, VocabularySource, WordType } from './types';
import { vocabulary } from './vocabulary';
import { importedSources, importedVocabulary } from './vocabulary/imported';
import translationsFile from './vocabulary/translations.json';

export type { Article, Level, VocabularyDataset, VocabularyItem, VocabularySource, WordType } from './types';

export const LEVELS: readonly Level[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

export const LEVEL_HINTS: Record<Level, string> = { A1: 'Anfänger', A2: 'Grundlagen', B1: 'Mittelstufe', B2: 'Fortgeschritten', C1: 'Fachkundig' };

export const WORD_TYPE_LABELS: Record<WordType, string> = {
  noun: 'Nomen',
  verb: 'Verb',
  adjective: 'Adjektiv',
  adverb: 'Adverb',
  preposition: 'Präposition',
  conjunction: 'Konjunktion',
  other: 'Sonstiges',
};

const translations = translationsFile.translations as Record<string, string>;

/** Attaches the optional English translations (German Wiktionary) to the items that have one. */
function withTranslations(items: VocabularyItem[]): VocabularyItem[] {
  return items.map((item) => (translations[item.id] ? { ...item, translationEn: translations[item.id] } : item));
}

/**
 * The dataset the app currently runs on. Swap `items` for a larger curated
 * list and describe its origin here; the attribution page renders `origin`
 * and `sources` verbatim, so it never claims a source that was not used.
 */
export const dataset: VocabularyDataset = {
  name: 'Wortflip Wortschatz',
  version: '1.1.0',
  origin:
    importedVocabulary.length === 0
      ? `Alle ${vocabulary.length} Einträge wurden von Hand für Wortflip geschrieben. Sie stammen aus keiner externen Quelle.`
      : `${vocabulary.length} Einträge wurden von Hand für Wortflip geschrieben. ${importedVocabulary.length} Einträge wurden mit dem ` +
        'Import-Skript aus den unten genannten Quellen übernommen. Die Quelle jedes importierten Eintrags steht in der Wortliste.',
  sources: importedSources,
  items: withTranslations([...vocabulary, ...importedVocabulary]),
};

/**
 * Sources a future, larger dataset is expected to be built from. They are
 * listed on the attribution page as "prepared" sources with their licenses,
 * but explicitly marked as not being the origin of the current entries.
 */
export const CANDIDATE_SOURCES: readonly VocabularySource[] = [
  {
    id: 'de-wiktionary',
    name: 'Deutsches Wiktionary',
    url: 'https://de.wiktionary.org',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.de',
    note: 'Definitionen, Artikel, Plural-, Verb- und Steigerungsformen.',
  },
  {
    id: 'tatoeba',
    name: 'Tatoeba',
    url: 'https://tatoeba.org/de',
    license: 'CC BY 2.0 FR',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0/fr/deed.de',
    note: 'Beispielsätze. Jeder Satz muss mit seinem Autor genannt werden.',
  },
];

export const itemById: ReadonlyMap<string, VocabularyItem> = new Map(
  dataset.items.map((item) => [item.id, item]),
);

export function itemsForLevels(levels: readonly Level[]): VocabularyItem[] {
  return dataset.items.filter((item) => levels.includes(item.level));
}

/** "der Tisch", "gehen", "sich erinnern" */
export function headword(item: VocabularyItem): string {
  return item.article ? `${item.article} ${item.word}` : item.word;
}

/** "die Tische", or null for singular-only nouns and non-nouns. */
export function pluralForm(item: VocabularyItem): string | null {
  if (item.type !== 'noun' || !item.plural) return null;
  return `die ${item.plural}`;
}

/** Returns a list of problems in the dataset (empty when everything is fine). */
export function validateDataset(ds: VocabularyDataset): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  const sourceIds = new Set(ds.sources.map((s) => s.id));

  for (const item of ds.items) {
    if (seen.has(item.id)) problems.push(`Doppelte id: "${item.id}"`);
    seen.add(item.id);
    if (!item.word.trim()) problems.push(`Leeres Wort bei "${item.id}"`);
    if (!item.definitionDe.trim()) problems.push(`Leere Definition bei "${item.id}"`);
    if (!item.exampleDe.trim()) problems.push(`Leerer Beispielsatz bei "${item.id}"`);
    if (item.type === 'noun' && !item.article) problems.push(`Nomen ohne Artikel: "${item.id}"`);
    if (item.type !== 'noun' && (item.article || item.plural)) {
      problems.push(`Artikel/Plural bei Nicht-Nomen: "${item.id}"`);
    }
    if (item.type !== 'verb' && item.verbForms) problems.push(`Verbformen bei Nicht-Verb: "${item.id}"`);
    if (item.type !== 'adjective' && item.adjectiveForms) {
      problems.push(`Adjektivformen bei Nicht-Adjektiv: "${item.id}"`);
    }
    for (const sid of item.sourceIds ?? []) {
      if (!sourceIds.has(sid)) problems.push(`Unbekannte Quelle "${sid}" bei "${item.id}"`);
    }
    if (item.exampleSource && !sourceIds.has(item.exampleSource.sourceId)) {
      problems.push(`Unbekannte Beispielquelle "${item.exampleSource.sourceId}" bei "${item.id}"`);
    }
  }
  return problems;
}

if (import.meta.env.DEV) {
  for (const problem of validateDataset(dataset)) console.warn(`[vocabulary] ${problem}`);
}
