import { normalizeCustomItem, NO_THEME } from '../data/custom';
import type { Level, VocabularyItem } from '../data/types';
import type { AppState } from '../learning/storage';
import type { Action } from '../state/reducer';
import { submitTopic } from './api';
import { deviceId } from './device';

/** The topic's level: the one most of its words have. */
function topicLevel(words: readonly VocabularyItem[]): Level {
  const counts = new Map<Level, number>();
  for (const item of words) counts.set(item.level, (counts.get(item.level) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'A1';
}

const wordKey = (item: VocabularyItem) => `${item.word.toLowerCase()}|${item.type}`;

/**
 * Shares one topic and applies the answer: the community's spelling of the
 * name wins, the shared copy is cached, and words the community copy has but
 * this device lacks become own words. Throws when the network or the
 * database refuses; the caller decides how to retry.
 */
export async function shareAndMerge(
  theme: string,
  words: readonly VocabularyItem[],
  ownItems: readonly VocabularyItem[],
  dispatch: (action: Action) => void,
): Promise<void> {
  if (theme === NO_THEME || words.length === 0) return;
  const topic = await submitTopic(theme, topicLevel(words), words, deviceId());
  if (topic.theme !== theme) dispatch({ type: 'custom/renameTheme', from: theme, to: topic.theme });
  dispatch({ type: 'community/shared', theme: topic.theme, topic });
  const own = new Set(ownItems.map(wordKey));
  const missing = topic.items
    .filter((item) => !own.has(wordKey(item)))
    .map((item) => normalizeCustomItem({ ...item, id: undefined }, { level: item.level, theme: topic.theme }))
    .filter((item): item is VocabularyItem => item !== null);
  if (missing.length > 0) dispatch({ type: 'custom/add', items: missing, theme: topic.theme });
}

/**
 * Own topics (name -> words) that still have something to share: never shared,
 * or grown since (words the cached community copy does not have). Sharing
 * again merges on the server, so it is safe to repeat.
 */
export function pendingTopics(state: AppState, ownItems: readonly VocabularyItem[]): Map<string, VocabularyItem[]> {
  const groups = new Map<string, VocabularyItem[]>();
  const linked = new Set(Object.values(state.themeLinks).flat());
  for (const item of ownItems) {
    if (!item.theme || item.theme === NO_THEME) continue;
    const mine = item.id.startsWith('custom-') || linked.has(item.id);
    if (!mine) continue;
    const list = groups.get(item.theme) ?? [];
    list.push(item);
    groups.set(item.theme, list);
  }
  const pending = new Map<string, VocabularyItem[]>();
  for (const [theme, words] of groups) {
    const sharedId = state.community.shared[theme];
    if (!sharedId) {
      pending.set(theme, words);
      continue;
    }
    const copy = state.community.topics.find((t) => t.id === sharedId);
    if (!copy) continue; // shared, but the copy is not cached (e.g. hidden): nothing to compare, leave it
    const known = new Set(copy.items.map(wordKey));
    if (words.some((item) => !known.has(wordKey(item)))) pending.set(theme, words);
  }
  return pending;
}

/** A German sentence for a failed share. */
export function shareErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (/global daily limit/.test(message)) return 'Heute wurden schon sehr viele Themen geteilt. Morgen geht es weiter.';
  if (/daily limit/.test(message)) return 'Heute hast du schon 5 Themen geteilt. Morgen geht es weiter.';
  if (/offensive/.test(message)) return 'Das Thema enthält Wörter, die nicht in die App passen. Es bleibt nur auf diesem Gerät.';
  return 'Das Thema ist gespeichert, aber noch nicht geteilt. Sobald du wieder online bist, wird es automatisch geteilt.';
}
