import type { VocabularyItem } from '../types';
import { a1 } from './a1';
import { a2 } from './a2';
import { b1 } from './b1';

/**
 * The bundled vocabulary, one file per CEFR level. To add a much larger
 * curated dataset, add another file here (or replace one), keep ids stable,
 * and register any external sources in ../index.ts.
 */
export const vocabulary: VocabularyItem[] = [...a1, ...a2, ...b1];
