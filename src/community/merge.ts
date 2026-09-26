import type { ThemeLinks } from '../data/custom';
import type { VocabularyItem } from '../data/types';
import type { CommunityTopic } from './types';

export const COMMUNITY_SOURCE_ID = 'community';

export interface CommunityCatalogue {
  /** Community words that do not exist in the app yet (with topic and community source). */
  items: VocabularyItem[];
  /** Existing words that a community topic mentions: topic name -> ids. */
  links: ThemeLinks;
}

const wordKey = (item: VocabularyItem) => `${item.word.toLowerCase()}|${item.type}`;

/**
 * Turns the cached topics into extra words and topic links. `existing` are the
 * bundled and the learner's own words: a community word that already exists
 * there only links the topic, so nothing is learned twice. Newest topics win
 * when two topics share a word.
 */
export function communityCatalogue(
  topics: readonly CommunityTopic[],
  existing: readonly VocabularyItem[],
  hiddenIds: ReadonlySet<string>,
): CommunityCatalogue {
  const byKey = new Map(existing.map((item) => [wordKey(item), item.id]));
  const items: VocabularyItem[] = [];
  const links: ThemeLinks = {};
  const seen = new Set<string>();
  const ordered = [...topics].filter((topic) => !hiddenIds.has(topic.id)).sort((a, b) => b.createdAt - a.createdAt);
  for (const topic of ordered) {
    for (const item of topic.items) {
      const key = wordKey(item);
      const existingId = byKey.get(key);
      if (existingId) {
        const list = links[topic.theme] ?? [];
        if (!list.includes(existingId)) links[topic.theme] = [...list, existingId];
        continue;
      }
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ ...item, theme: topic.theme, sourceIds: [COMMUNITY_SOURCE_ID] });
    }
  }
  return { items, links };
}
