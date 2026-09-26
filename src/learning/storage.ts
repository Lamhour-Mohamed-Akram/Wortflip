import { LEVELS } from '../data';
import type { Level, VocabularyItem } from '../data/types';
import { normalizeCustomItem, type ThemeLinks } from '../data/custom';
import { communityItemId } from '../community/api';
import { createCommunityState, type CommunityState, type CommunityTopic } from '../community/types';
import { MASTERED_BOX } from './scheduler';
import { createStats } from './stats';
import { createStreak } from './streak';
import type {
  SessionKind,
  SessionSize,
  SessionState,
  Settings,
  Stats,
  StreakState,
  WordProgress,
  WordStatus,
} from './types';

export const STORAGE_KEY = 'wortflip.state.v1';

export interface AppState {
  version: 1;
  settings: Settings;
  /** Words the learner added from an AI answer ("Eigene Wörter"). Their ids start with "custom-". */
  customWords: VocabularyItem[];
  /** Bundled words the learner attached to one of their topics (topic name -> ids). */
  themeLinks: ThemeLinks;
  /** Topics shared by other learners (cached) and what this device shared or reported. */
  community: CommunityState;
  progress: Record<string, WordProgress>;
  streak: StreakState;
  stats: Stats;
  session: SessionState | null;
}

/** The subset of the Web Storage API the app relies on (makes tests trivial). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const SESSION_SIZES: readonly SessionSize[] = [10, 20, 30];
const WORD_STATUSES: readonly WordStatus[] = ['new', 'learning', 'mastered'];
const SESSION_KINDS: readonly SessionKind[] = ['daily', 'extra', 'focus', 'custom'];

export function defaultSettings(): Settings {
  return { levels: ['A1'], sessionSize: 30, showTranslation: true, showCommunity: true, onboarded: false };
}

export function defaultState(): AppState {
  return {
    version: 1,
    settings: defaultSettings(),
    customWords: [],
    themeLinks: {},
    community: createCommunityState(),
    progress: {},
    streak: createStreak(),
    stats: createStats(),
    session: null,
  };
}

/** Accessing localStorage can throw (privacy modes, sandboxed frames), so never touch it directly. */
export function getLocalStorage(): StorageLike | null {
  try {
    if (typeof window === 'undefined') return null;
    const storage = window.localStorage;
    // A quick round-trip guards against storage that exists but is unusable.
    const probe = `${STORAGE_KEY}.probe`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

export function loadState(storage: StorageLike | null, validIds: ReadonlySet<string>): AppState {
  if (!storage) return defaultState();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return sanitizeState(JSON.parse(raw), validIds);
  } catch {
    return defaultState();
  }
}

export function saveState(storage: StorageLike | null, state: AppState): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearState(storage: StorageLike | null): void {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do: the in-memory state was already reset.
  }
}

// ───────────────────────── validation ─────────────────────────
// Anything that does not look right is replaced by a sane default instead of
// crashing the app, so a corrupted or hand-edited localStorage entry only
// loses the broken part.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isDayKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isOneOf<T>(list: readonly T[], value: unknown): value is T {
  return list.includes(value as T);
}

function sanitizeSettings(raw: unknown): Settings {
  const defaults = defaultSettings();
  if (!isRecord(raw)) return defaults;
  const levels = Array.isArray(raw.levels)
    ? LEVELS.filter((level) => (raw.levels as unknown[]).includes(level))
    : [];
  return {
    levels: levels.length > 0 ? levels : defaults.levels,
    sessionSize: isOneOf(SESSION_SIZES, raw.sessionSize) ? raw.sessionSize : defaults.sessionSize,
    // On by default, also for states saved before the setting existed.
    showTranslation: raw.showTranslation !== false,
    showCommunity: raw.showCommunity !== false,
    onboarded: raw.onboarded === true,
  };
}

function sanitizeProgressEntry(id: string, raw: unknown): WordProgress | null {
  if (!isRecord(raw)) return null;
  const box = raw.box;
  if (!isCount(box) || box > MASTERED_BOX) return null;
  if (!isOneOf(WORD_STATUSES, raw.status)) return null;
  const dueAt = raw.dueAt === null ? null : isTimestamp(raw.dueAt) ? raw.dueAt : undefined;
  const lastReviewedAt =
    raw.lastReviewedAt === null ? null : isTimestamp(raw.lastReviewedAt) ? raw.lastReviewedAt : undefined;
  if (dueAt === undefined || lastReviewedAt === undefined) return null;
  if (!isCount(raw.correct) || !isCount(raw.incorrect) || !isCount(raw.streak)) return null;
  return {
    id,
    status: raw.status,
    box,
    dueAt,
    lastReviewedAt,
    correct: raw.correct,
    incorrect: raw.incorrect,
    streak: raw.streak,
  };
}

function sanitizeProgress(raw: unknown, validIds: ReadonlySet<string>): Record<string, WordProgress> {
  const progress: Record<string, WordProgress> = {};
  if (!isRecord(raw)) return progress;
  for (const [id, entry] of Object.entries(raw)) {
    if (!validIds.has(id)) continue;
    const clean = sanitizeProgressEntry(id, entry);
    if (clean) progress[id] = clean;
  }
  return progress;
}

function sanitizeStreak(raw: unknown): StreakState {
  if (!isRecord(raw) || !isCount(raw.current) || !isCount(raw.best)) return createStreak();
  const lastActiveDay = raw.lastActiveDay === null || isDayKey(raw.lastActiveDay) ? raw.lastActiveDay : null;
  return { current: raw.current, best: Math.max(raw.best, raw.current), lastActiveDay };
}

function sanitizeStats(raw: unknown): Stats {
  if (!isRecord(raw) || !isCount(raw.totalReviews) || !isCount(raw.totalCorrect)) return createStats();
  const reviewsByDay: Record<string, number> = {};
  if (isRecord(raw.reviewsByDay)) {
    for (const [day, count] of Object.entries(raw.reviewsByDay)) {
      if (isDayKey(day) && isCount(count)) reviewsByDay[day] = count;
    }
  }
  return {
    totalReviews: raw.totalReviews,
    totalCorrect: Math.min(raw.totalCorrect, raw.totalReviews),
    reviewsByDay,
  };
}

function sanitizeSession(raw: unknown, validIds: ReadonlySet<string>): SessionState | null {
  if (!isRecord(raw) || !isOneOf(SESSION_KINDS, raw.kind) || !Array.isArray(raw.queue)) return null;
  const queue = raw.queue.filter((id): id is string => typeof id === 'string' && validIds.has(id));
  if (queue.length !== raw.queue.length) return null;
  if (!isCount(raw.total) || !isCount(raw.correct) || !isCount(raw.incorrect) || !isTimestamp(raw.startedAt)) {
    return null;
  }
  if (raw.total < new Set(queue).size) return null;
  return {
    kind: raw.kind,
    queue,
    total: raw.total,
    correct: raw.correct,
    incorrect: raw.incorrect,
    startedAt: raw.startedAt,
  };
}

function sanitizeCustomWords(raw: unknown): VocabularyItem[] {
  if (!Array.isArray(raw)) return [];
  const words: VocabularyItem[] = [];
  const ids = new Set<string>();
  for (const entry of raw) {
    const item = normalizeCustomItem(entry);
    if (item && !ids.has(item.id)) {
      ids.add(item.id);
      words.push(item);
    }
  }
  return words;
}

function sanitizeThemeLinks(raw: unknown, validIds: ReadonlySet<string>): ThemeLinks {
  const links: ThemeLinks = {};
  if (!isRecord(raw)) return links;
  for (const [theme, ids] of Object.entries(raw)) {
    const name = theme.trim().slice(0, 40);
    if (!name || !Array.isArray(ids)) continue;
    const clean = [...new Set(ids.filter((id): id is string => typeof id === 'string' && validIds.has(id)))];
    if (clean.length > 0) links[name] = clean;
  }
  return links;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizeTopic(raw: unknown): CommunityTopic | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || !UUID.test(raw.id)) return null;
  const level = isOneOf(LEVELS, raw.level) ? raw.level : null;
  const theme = typeof raw.theme === 'string' ? raw.theme.trim().slice(0, 40) : '';
  if (!level || !theme || !Array.isArray(raw.items)) return null;
  const items: VocabularyItem[] = [];
  for (const entry of raw.items) {
    const item = normalizeCustomItem(entry, { level, theme });
    if (item) items.push({ ...item, id: communityItemId(raw.id, item.word, item.type), sourceIds: ['community'] });
  }
  if (items.length === 0) return null;
  return { id: raw.id, theme, level, items, createdAt: isTimestamp(raw.createdAt) ? raw.createdAt : 0 };
}

function sanitizeCommunity(raw: unknown): CommunityState {
  const state = createCommunityState();
  if (!isRecord(raw)) return state;
  if (Array.isArray(raw.topics)) {
    const ids = new Set<string>();
    for (const entry of raw.topics) {
      const topic = sanitizeTopic(entry);
      if (topic && !ids.has(topic.id)) {
        ids.add(topic.id);
        state.topics.push(topic);
      }
    }
  }
  if (isTimestamp(raw.syncedAt)) state.syncedAt = raw.syncedAt;
  if (Array.isArray(raw.reported)) state.reported = raw.reported.filter((id): id is string => typeof id === 'string' && UUID.test(id));
  if (isRecord(raw.shared)) {
    for (const [theme, id] of Object.entries(raw.shared)) {
      if (theme.trim() && typeof id === 'string' && UUID.test(id)) state.shared[theme.trim().slice(0, 40)] = id;
    }
  }
  return state;
}

export function sanitizeState(raw: unknown, validIds: ReadonlySet<string>): AppState {
  if (!isRecord(raw)) return defaultState();
  // Future schema versions would be migrated here before sanitizing.
  const customWords = sanitizeCustomWords(raw.customWords);
  const community = sanitizeCommunity(raw.community);
  // Progress and sessions may refer to the learner's own and to community words as well.
  const extraIds = [...customWords.map((item) => item.id), ...community.topics.flatMap((topic) => topic.items.map((item) => item.id))];
  const knownIds = extraIds.length > 0 ? new Set([...validIds, ...extraIds]) : validIds;
  return {
    version: 1,
    settings: sanitizeSettings(raw.settings),
    customWords,
    themeLinks: sanitizeThemeLinks(raw.themeLinks, validIds),
    community,
    progress: sanitizeProgress(raw.progress, knownIds),
    streak: sanitizeStreak(raw.streak),
    stats: sanitizeStats(raw.stats),
    session: sanitizeSession(raw.session, knownIds),
  };
}

export function isLevelList(value: unknown): value is Level[] {
  return Array.isArray(value) && value.length > 0 && value.every((v) => isOneOf(LEVELS, v));
}
