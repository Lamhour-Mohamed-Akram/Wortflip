export type Article = 'der' | 'die' | 'das';

export type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

export type WordType =
  | 'noun'
  | 'verb'
  | 'adjective'
  | 'adverb'
  | 'preposition'
  | 'conjunction'
  | 'other';

export interface VerbForms {
  /** e.g. "er geht" */
  thirdPersonPresent?: string;
  /** Präteritum, e.g. "ging" */
  preterite?: string;
  /** Partizip II with auxiliary, e.g. "ist gegangen" */
  participleII?: string;
}

export interface AdjectiveForms {
  comparative?: string;
  superlative?: string;
}

export interface VocabularyItem {
  /** Stable unique id. Progress is stored under this key, so never rename it. */
  id: string;
  /** The headword without article, e.g. "Tisch" or "gehen". */
  word: string;
  /** Nouns only. */
  article?: Article;
  /** Nouns only, without article (the plural article is always "die"). Omit for singular-only nouns. */
  plural?: string;
  type: WordType;
  level: Level;
  /** Short definition in simple German. */
  definitionDe: string;
  /** One natural example sentence in German. */
  exampleDe: string;
  verbForms?: VerbForms;
  adjectiveForms?: AdjectiveForms;
  /** Ids of `VocabularyDataset.sources` this entry was taken from. Omit for hand-written entries. */
  sourceIds?: string[];
  /** Where the definition and forms come from (e.g. the Wiktionary page). */
  definitionUrl?: string;
  /** Attribution for the example sentence when it was taken from a source that requires it. */
  exampleSource?: ExampleSource;
}

export interface ExampleSource {
  /** Id of the `VocabularyDataset.sources` entry. */
  sourceId: string;
  /** Author or contributor name, required for CC BY sentences. */
  author?: string;
  /** Link to the original sentence. */
  url?: string;
}

/** A source that (parts of) a dataset were imported from. Rendered on the attribution page. */
export interface VocabularySource {
  id: string;
  name: string;
  url: string;
  license: string;
  licenseUrl: string;
  /** Optional note, e.g. what was taken from the source. */
  note?: string;
}

export interface VocabularyDataset {
  name: string;
  version: string;
  /** Free-text description of where the entries come from. Shown on the attribution page. */
  origin: string;
  sources: VocabularySource[];
  items: VocabularyItem[];
}
