import type { Level, VocabularyItem } from '../data/types';

/** A topic shared by a learner, as stored in the community database and cached locally. */
export interface CommunityTopic {
  id: string;
  theme: string;
  level: Level;
  /** Normalised entries (same shape as custom words, ids assigned locally). */
  items: VocabularyItem[];
  createdAt: number;
}

export interface CommunityState {
  topics: CommunityTopic[];
  /** Last successful fetch (ms), null before the first one. */
  syncedAt: number | null;
  /** Topics this device reported; hidden locally right away. */
  reported: string[];
  /** Own topics that were shared: topic name -> community id. */
  shared: Record<string, string>;
}

export function createCommunityState(): CommunityState {
  return { topics: [], syncedAt: null, reported: [], shared: {} };
}
