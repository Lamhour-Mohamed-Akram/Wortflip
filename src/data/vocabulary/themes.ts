import type { VocabularyItem } from '../types';
import data from './themes.json';

/**
 * Themed words that were generated with the "Eigene Wörter" prompt, checked by
 * hand and added to the repository with `node scripts/import-custom.mjs`.
 * Every entry carries a `theme` and its own English translation; `links` attach
 * words that already existed to those topics.
 */
export const themedVocabulary = data.items as unknown as VocabularyItem[];
/** Topic name -> ids of existing words that belong to that topic for everyone. */
export const themeLinks = data.links as Record<string, string[]>;
