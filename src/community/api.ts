/**
 * Thin PostgREST client for the community topics (no SDK, a few fetch calls).
 * Every function throws on network or server errors; callers treat that as
 * "offline for now" and keep using the cached topics.
 */
import { normalizeCustomItem, slugify } from '../data/custom';
import type { Level, VocabularyItem } from '../data/types';
import { MAX_TOPICS, SUPABASE_ANON_KEY, SUPABASE_URL } from './config';
import type { CommunityTopic } from './types';

const LEVELS: readonly Level[] = ['A1', 'A2', 'B1', 'B2', 'C1'];
const DETAIL_CHUNK = 40;

function headers(extra: Record<string, string> = {}): HeadersInit {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: headers(init.headers as Record<string, string>) });
  if (!response.ok) {
    let detail = '';
    try {
      detail = ((await response.json()) as { message?: string }).message ?? '';
    } catch {
      // no body
    }
    throw new Error(`${response.status}${detail ? `: ${detail}` : ''}`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

interface TopicRow {
  id: string;
  created_at: string;
  theme: string;
  level: string;
  items: unknown;
}

/** Id of a community word: stable per topic and word, never colliding with bundled or custom ids. */
export function communityItemId(topicId: string, word: string, type: string): string {
  const slug = slugify(word.replace(/^sich /, ''));
  return `community-${topicId.slice(0, 8)}-${slug}${type === 'noun' ? '' : `-${type}`}`;
}

/** Validates a database row into a topic; rows that fail (should not happen) are dropped. */
export function topicFromRow(row: TopicRow): CommunityTopic | null {
  const level = LEVELS.find((l) => l === row.level);
  const theme = typeof row.theme === 'string' ? row.theme.trim() : '';
  if (!level || !theme || !Array.isArray(row.items) || typeof row.id !== 'string') return null;
  const items: VocabularyItem[] = [];
  const seen = new Set<string>();
  for (const raw of row.items) {
    const item = normalizeCustomItem(raw, { level, theme });
    if (!item) continue;
    const id = communityItemId(row.id, item.word, item.type);
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({ ...item, id, sourceIds: ['community'] });
  }
  if (items.length === 0) return null;
  const createdAt = Date.parse(row.created_at);
  return { id: row.id, theme, level, items, createdAt: Number.isFinite(createdAt) ? createdAt : Date.now() };
}

/** Ids of the newest visible topics (cheap call, used to find what is new or gone). */
export async function fetchTopicIds(): Promise<string[]> {
  const rows = await request<{ id: string }[]>(`topics?select=id&hidden=eq.false&order=created_at.desc&limit=${MAX_TOPICS}`);
  return rows.map((row) => row.id);
}

/** Full rows for the given ids, in chunks. */
export async function fetchTopics(ids: readonly string[]): Promise<CommunityTopic[]> {
  const topics: CommunityTopic[] = [];
  for (let i = 0; i < ids.length; i += DETAIL_CHUNK) {
    const chunk = ids.slice(i, i + DETAIL_CHUNK);
    const rows = await request<TopicRow[]>(`topics?select=id,created_at,theme,level,items&id=in.(${chunk.join(',')})`);
    for (const row of rows) {
      const topic = topicFromRow(row);
      if (topic) topics.push(topic);
    }
  }
  return topics;
}

/** What gets sent: the word fields only, no local ids and no per-entry topic. */
function payloadItem(item: VocabularyItem): Record<string, unknown> {
  const { id: _id, sourceIds: _s, theme: _t, level: _l, definitionUrl: _u, exampleSource: _e, ...rest } = item;
  return rest;
}

/**
 * Shares a topic. Same name and level as an existing community topic: the
 * words it lacks are appended there and the merged topic comes back, so the
 * caller can add to its own copy what it lacks in turn.
 */
export async function submitTopic(theme: string, level: Level, items: readonly VocabularyItem[], device: string): Promise<CommunityTopic> {
  const rows = await request<TopicRow[]>('rpc/share_topic', {
    method: 'POST',
    body: JSON.stringify({ p_theme: theme, p_level: level, p_items: items.map(payloadItem), p_device: device }),
  });
  const topic = rows[0] ? topicFromRow(rows[0]) : null;
  if (!topic) throw new Error('unexpected answer');
  return topic;
}

/** One report per device and topic; a repeated report is not an error. */
export async function reportTopic(topicId: string, device: string): Promise<void> {
  try {
    await request<undefined>('topic_reports', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ topic_id: topicId, device }),
    });
  } catch (error) {
    if (!(error instanceof Error && error.message.startsWith('409'))) throw error;
  }
}
