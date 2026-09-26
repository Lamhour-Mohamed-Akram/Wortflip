/**
 * "Eigene Wörter": words a learner adds from a topic prompt answered by any AI.
 *
 * The flow is offline and free: the app builds a prompt, the learner pastes it
 * into ChatGPT, Claude, Gemini or another assistant, copies the JSON answer back
 * and the app validates it into ordinary vocabulary items (same fields as the
 * bundled words, plus a topic). They live in localStorage and can be exported
 * to a file; the same file feeds `scripts/import-custom.mjs` to make them part
 * of the bundled dataset for everyone.
 */
import { containsBadWord } from '../community/badwords';
import type { Article, Level, VocabularyItem, WordType } from './types';

export const CUSTOM_SOURCE_ID = 'custom';
export const PROMPT_COUNTS = [10, 20, 30, 50, 100] as const;
export type PromptCount = (typeof PROMPT_COUNTS)[number];
export const MAX_THEME_LENGTH = 40;
const MAX_WORD_LENGTH = 40;
const MAX_TEXT_LENGTH = 300;

const LEVELS: readonly Level[] = ['A1', 'A2', 'B1', 'B2', 'C1'];
const ARTICLES: readonly Article[] = ['der', 'die', 'das'];

/** Accepts the English keys and the German labels an AI might use instead. */
const TYPE_ALIASES: Record<string, WordType> = {
  noun: 'noun', nomen: 'noun', substantiv: 'noun',
  verb: 'verb',
  adjective: 'adjective', adjektiv: 'adjective',
  adverb: 'adverb',
  preposition: 'preposition', präposition: 'preposition', praeposition: 'preposition',
  conjunction: 'conjunction', konjunktion: 'conjunction',
  other: 'other', sonstiges: 'other', partikel: 'other', interjektion: 'other', pronomen: 'other',
};

export interface PromptOptions {
  level: Level;
  theme: string;
  count: number;
}

/** The text the learner copies into an AI assistant. English instructions, German content. */
export function buildPrompt({ level, theme, count }: PromptOptions): string {
  const topic = theme.trim() || 'everyday life';
  return [
    `You are helping a German learner build flashcards.`,
    ``,
    `Task: give me ${count} German words for the topic "${topic}" at CEFR level ${level}. Choose words that are specific to this topic and useful at that level, and mix nouns, verbs and adjectives where it makes sense. No proper names, no offensive words, every word different.`,
    ``,
    `Important: the learner already knows the general basic vocabulary of the Goethe-Institut word lists (about 4,500 common words such as Frage, Antwort, lernen, schnell, Problem). Do not list such general words; pick the words a learner needs for this particular topic.`,
    ``,
    `Reply with ONLY a JSON array, no explanation and no markdown fences. Fields of each element:`,
    `- "theme": always "${topic}"`,
    `- "level": always "${level}"`,
    `- "word": the headword without article; verbs in the infinitive`,
    `- "type": one of noun, verb, adjective, adverb, preposition, conjunction, other`,
    `- "article": nouns only, one of der, die, das`,
    `- "plural": nouns only, without article; leave it out if there is no plural`,
    `- "definitionDe": one short sentence in simple German (level ${level}) that explains the word, without translating it`,
    `- "exampleDe": one natural German sentence of 6 to 12 words that uses the word`,
    `- "translationEn": the English translation in 1 to 3 words`,
    `- "verbForms": verbs only, an object with "thirdPersonPresent" (like "er geht"), "preterite" (like "ging") and "participleII" (like "ist gegangen")`,
    `- "adjectiveForms": adjectives only, an object with "comparative" and "superlative" (like "am schnellsten")`,
    ``,
    `Rules: correct German spelling with ä, ö, ü and ß; the definition and the example stay entirely in German; do not use dashes in any text. Make sure the JSON is valid: every entry ends with exactly one closing brace and entries are separated by commas.`,
    ``,
    `Example of the format:`,
    `[`,
    `  {"theme": "${topic}", "level": "${level}", "word": "Termin", "type": "noun", "article": "der", "plural": "Termine", "definitionDe": "Eine feste Zeit für ein Treffen, zum Beispiel beim Arzt.", "exampleDe": "Ich habe morgen einen Termin beim Zahnarzt.", "translationEn": "appointment"},`,
    `  {"theme": "${topic}", "level": "${level}", "word": "warten", "type": "verb", "definitionDe": "Bleiben, bis etwas passiert oder jemand kommt.", "exampleDe": "Wir warten seit einer Stunde auf den Arzt.", "translationEn": "to wait", "verbForms": {"thirdPersonPresent": "er wartet", "preterite": "wartete", "participleII": "hat gewartet"}}`,
    `]`,
  ].join('\n');
}

export function slugify(word: string): string {
  return word
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Ids of custom words never collide with bundled ones thanks to the prefix. */
export function customId(word: string, type: WordType): string {
  const slug = slugify(word.replace(/^sich /, ''));
  return type === 'noun' ? `custom-${slug}` : `custom-${slug}-${type}`;
}

function withoutDashes(text: string): string {
  return text.replace(/\s*[\u2013\u2014]\s*/g, ', ').replace(/\s+/g, ' ').trim();
}

function cleanText(value: unknown, max = MAX_TEXT_LENGTH): string | null {
  if (typeof value !== 'string') return null;
  const text = withoutDashes(value);
  return text.length > 0 && text.length <= max ? text : null;
}

function optionalText(value: unknown, max = 80): string | undefined {
  const text = cleanText(value, max);
  return text ?? undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function wordType(value: unknown): WordType | null {
  if (typeof value !== 'string') return null;
  return TYPE_ALIASES[value.trim().toLowerCase()] ?? null;
}

/**
 * Validates one raw entry (from an AI answer, an export file or storage) into
 * a vocabulary item, or returns null. `fallback` supplies the level and topic
 * chosen in the app; an entry may also carry its own (export files do).
 */
export function normalizeCustomItem(raw: unknown, fallback: { level?: Level; theme?: string } = {}): VocabularyItem | null {
  if (!isRecord(raw)) return null;
  const type = wordType(raw.type);
  let word = cleanText(raw.word, MAX_WORD_LENGTH);
  if (!type || !word) return null;

  // "der Termin" as the word: move the article where it belongs.
  let article = ARTICLES.find((a) => a === raw.article);
  const articleInWord = /^(der|die|das)\s+(.+)$/i.exec(word);
  if (articleInWord && type === 'noun') {
    article ??= articleInWord[1]!.toLowerCase() as Article;
    word = articleInWord[2]!;
  }

  const level = fallback.level ?? (LEVELS.find((l) => l === raw.level) ?? null);
  const definitionDe = cleanText(raw.definitionDe);
  const exampleDe = cleanText(raw.exampleDe);
  if (!level || !definitionDe || !exampleDe) return null;
  const theme = optionalText(fallback.theme ?? raw.theme, MAX_THEME_LENGTH);

  const item: VocabularyItem = {
    id: typeof raw.id === 'string' && /^custom-[a-z0-9-]+$/.test(raw.id) ? raw.id : customId(word, type),
    word,
    type,
    level,
    definitionDe,
    exampleDe,
    sourceIds: [CUSTOM_SOURCE_ID],
  };
  if (theme) item.theme = theme;
  if (type === 'noun') {
    if (article) item.article = article;
    const plural = optionalText(raw.plural, MAX_WORD_LENGTH)?.replace(/^die\s+/i, '');
    if (plural) item.plural = plural;
  }
  const translationEn = optionalText(raw.translationEn);
  if (translationEn) item.translationEn = translationEn;
  if (type === 'verb' && isRecord(raw.verbForms)) {
    const f = raw.verbForms;
    const forms = {
      ...(optionalText(f.thirdPersonPresent) ? { thirdPersonPresent: optionalText(f.thirdPersonPresent) } : {}),
      ...(optionalText(f.preterite) ? { preterite: optionalText(f.preterite) } : {}),
      ...(optionalText(f.participleII) ? { participleII: optionalText(f.participleII) } : {}),
    };
    if (Object.keys(forms).length > 0) item.verbForms = forms;
  }
  if (type === 'adjective' && isRecord(raw.adjectiveForms)) {
    const f = raw.adjectiveForms;
    const forms = {
      ...(optionalText(f.comparative) ? { comparative: optionalText(f.comparative) } : {}),
      ...(optionalText(f.superlative) ? { superlative: optionalText(f.superlative) } : {}),
    };
    if (Object.keys(forms).length > 0) item.adjectiveForms = forms;
  }
  return item;
}

export interface ParseResult {
  items: VocabularyItem[];
  /** Entries skipped because the word already exists (bundled, custom or earlier in the same answer). */
  duplicates: number;
  /** The skipped words, for the message ("Kopf, Frage, lernen ..."). */
  duplicateWords: string[];
  /** Ids of words that already exist in the app and can join the topic instead of being added twice. */
  existingIds: string[];
  /** Topic names found inside the entries themselves (the prompt asks the AI to include one). */
  foundThemes: string[];
  /** Entries skipped because required fields were missing or wrong. */
  invalid: number;
  /** Entries skipped because they contain offensive words. */
  offensive: number;
  /** Set when the text could not be read as JSON at all. */
  error: string | null;
}

/** Finds the JSON array (or an export object with `items`) inside a pasted answer. */
function extractEntries(text: string): unknown[] | null {
  const trimmed = text.trim().replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '');
  const candidates = [trimmed];
  const start = trimmed.indexOf('[');
  const end = trimmed.lastIndexOf(']');
  if (start !== -1 && end > start) candidates.push(trimmed.slice(start, end + 1));
  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (Array.isArray(parsed)) return parsed;
      if (isRecord(parsed) && Array.isArray(parsed.items)) return parsed.items;
    } catch {
      // try the next candidate
    }
  }
  // AI answers sometimes contain one broken entry (a stray brace, a missing comma).
  // Read the top-level objects one by one so the good entries are not lost.
  const objects = scanObjects(trimmed);
  return objects.length > 0 ? objects : null;
}

/** Top-level {...} objects of a text, each parsed on its own (null when broken). Braces inside strings are ignored. */
function scanObjects(text: string): unknown[] {
  const out: unknown[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (c === '}' && depth > 0) {
      depth--;
      if (depth === 0 && start !== -1) {
        try {
          out.push(JSON.parse(text.slice(start, i + 1)));
        } catch {
          out.push(null);
        }
        start = -1;
      }
    }
  }
  return out;
}

const wordKey = (item: VocabularyItem) => `${item.word.toLowerCase()}|${item.type}`;

/** Offensive words never enter a topic, neither the word itself nor its texts. */
export function isOffensive(item: VocabularyItem): boolean {
  return [item.word, item.definitionDe, item.exampleDe, item.translationEn ?? '', item.theme ?? ''].some(containsBadWord);
}

/**
 * Turns a pasted AI answer (or an export file) into new items. Words that
 * already exist in `existing` are reported as duplicates, not added twice.
 */
export function parseCustomWords(
  text: string,
  options: { level?: Level; theme?: string; existing: readonly VocabularyItem[] },
): ParseResult {
  const entries = extractEntries(text);
  if (!entries) {
    return { items: [], duplicates: 0, duplicateWords: [], existingIds: [], foundThemes: [], invalid: 0, offensive: 0, error: 'Keine JSON-Liste gefunden. Kopiere die komplette Antwort der KI, sie beginnt mit [ und endet mit ].' };
  }
  const existingByKey = new Map(options.existing.map((item) => [wordKey(item), item.id]));
  const seenKeys = new Set(existingByKey.keys());
  const seenIds = new Set(options.existing.map((item) => item.id));
  const result: ParseResult = { items: [], duplicates: 0, duplicateWords: [], existingIds: [], foundThemes: [], invalid: 0, offensive: 0, error: null };
  for (const raw of entries) {
    const found = isRecord(raw) ? optionalText(raw.theme, MAX_THEME_LENGTH) : undefined;
    if (found && !result.foundThemes.includes(found)) result.foundThemes.push(found);
    const item = normalizeCustomItem(raw, { level: options.level, theme: options.theme });
    if (!item) {
      result.invalid += 1;
      continue;
    }
    if (isOffensive(item)) {
      result.offensive += 1;
      continue;
    }
    if (seenKeys.has(wordKey(item)) || seenIds.has(item.id)) {
      result.duplicates += 1;
      result.duplicateWords.push(item.word);
      const existingId = existingByKey.get(wordKey(item));
      if (existingId && !result.existingIds.includes(existingId)) result.existingIds.push(existingId);
      continue;
    }
    seenKeys.add(wordKey(item));
    seenIds.add(item.id);
    result.items.push(item);
  }
  if (entries.length === 0) result.error = 'Die Liste ist leer.';
  return result;
}

export interface ThemeGroup {
  theme: string;
  items: VocabularyItem[];
  levels: Level[];
}

export const NO_THEME = 'Ohne Thema';

/** Topic name -> ids of bundled words the learner attached to that topic. */
export type ThemeLinks = Record<string, string[]>;

export function isCustomId(id: string): boolean {
  return id.startsWith('custom-');
}

/** Copies of the items with the learner's topics applied to linked bundled words. */
export function applyThemeLinks(items: readonly VocabularyItem[], links: ThemeLinks): VocabularyItem[] {
  const themeOf = new Map<string, string>();
  for (const [theme, ids] of Object.entries(links)) for (const id of ids) if (!themeOf.has(id)) themeOf.set(id, theme);
  if (themeOf.size === 0) return [...items];
  return items.map((item) => (themeOf.has(item.id) && !item.theme ? { ...item, theme: themeOf.get(item.id) } : item));
}

/** Custom words grouped by topic, alphabetically. */
export function groupByTheme(items: readonly VocabularyItem[]): ThemeGroup[] {
  const groups = new Map<string, VocabularyItem[]>();
  for (const item of items) {
    const key = item.theme ?? NO_THEME;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .map(([theme, list]) => ({
      theme,
      items: list,
      levels: LEVELS.filter((level) => list.some((item) => item.level === level)),
    }))
    .sort((a, b) => a.theme.localeCompare(b.theme, 'de'));
}

/** The file the learner downloads (and can import again or hand to the repo script). */
export function exportCustomWords(items: readonly VocabularyItem[]): string {
  const clean = items.map((item) => {
    const { sourceIds: _sourceIds, ...rest } = item;
    return rest;
  });
  return `${JSON.stringify({ app: 'wortflip', kind: 'custom-words', version: 1, exportedAt: new Date().toISOString().slice(0, 10), items: clean }, null, 2)}\n`;
}

/** Suggested file name for an export. */
export function exportFileName(): string {
  return `wortflip-eigene-woerter-${new Date().toISOString().slice(0, 10)}.json`;
}
