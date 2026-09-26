#!/usr/bin/env node
/**
 * Adds themed words (the JSON an AI produced for the "Eigene Wörter" prompt, or a
 * file exported from the app) to the bundled dataset, so every user gets them.
 *
 *   node scripts/import-custom.mjs <file.json> [--level B1] [--theme "Beim Arzt"] [--dry-run]
 *
 * The file is either the app's export ({ items: [...] }, every entry with its own
 * level and theme) or the raw AI answer (a JSON array; then --level and --theme
 * apply to every entry). Entries are validated like in the app, words that exist
 * anywhere in the dataset join the topic instead (recorded as links), and the
 * result is merged into src/data/vocabulary/themes.json. The English translation
 * comes from the entry.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VOCAB_DIR = join(ROOT, 'src', 'data', 'vocabulary');
const OUT = join(VOCAB_DIR, 'themes.json');

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];
const ARTICLES = ['der', 'die', 'das'];
const TYPE_ALIASES = {
  noun: 'noun', nomen: 'noun', substantiv: 'noun', verb: 'verb', adjective: 'adjective', adjektiv: 'adjective', adverb: 'adverb',
  preposition: 'preposition', präposition: 'preposition', praeposition: 'preposition', conjunction: 'conjunction', konjunktion: 'conjunction',
  other: 'other', sonstiges: 'other', partikel: 'other', interjektion: 'other', pronomen: 'other',
};

function parseArgs(argv) {
  const args = { file: null, level: null, theme: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--level') args.level = argv[++i];
    else if (flag === '--theme') args.theme = argv[++i];
    else if (flag === '--dry-run') args.dryRun = true;
    else if (flag === '--help') {
      console.log('node scripts/import-custom.mjs <file.json> [--level B1] [--theme "Beim Arzt"] [--dry-run]');
      process.exit(0);
    } else args.file = flag;
  }
  if (!args.file) throw new Error('Missing file. Usage: node scripts/import-custom.mjs <file.json> [--level B1] [--theme "..."]');
  if (args.level && !LEVELS.includes(args.level)) throw new Error(`--level must be one of ${LEVELS.join(', ')}`);
  return args;
}

const withoutDashes = (text) => text.replace(/\s*[\u2013\u2014]\s*/g, ', ').replace(/\s+/g, ' ').trim();
const cleanText = (value, max = 300) => {
  if (typeof value !== 'string') return null;
  const text = withoutDashes(value);
  return text.length > 0 && text.length <= max ? text : null;
};
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

export function slugify(word) {
  return word
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Same rules as normalizeCustomItem in src/data/custom.ts, without the "custom-" id prefix. */
export function normalizeEntry(raw, fallback = {}) {
  if (!isRecord(raw)) return null;
  const type = typeof raw.type === 'string' ? TYPE_ALIASES[raw.type.trim().toLowerCase()] : null;
  let word = cleanText(raw.word, 40);
  if (!type || !word) return null;
  let article = ARTICLES.find((a) => a === raw.article);
  const inWord = /^(der|die|das)\s+(.+)$/i.exec(word);
  if (inWord && type === 'noun') {
    article ??= inWord[1].toLowerCase();
    word = inWord[2];
  }
  const level = fallback.level ?? (LEVELS.includes(raw.level) ? raw.level : null);
  const definitionDe = cleanText(raw.definitionDe);
  const exampleDe = cleanText(raw.exampleDe);
  if (!level || !definitionDe || !exampleDe) return null;
  const theme = cleanText(fallback.theme ?? raw.theme, 40);
  const item = { word, type, level, definitionDe, exampleDe };
  if (type === 'noun') {
    if (article) item.article = article;
    const plural = cleanText(raw.plural, 40)?.replace(/^die\s+/i, '');
    if (plural) item.plural = plural;
  }
  const translationEn = cleanText(raw.translationEn, 80);
  if (translationEn) item.translationEn = translationEn;
  if (theme) item.theme = theme;
  if (type === 'verb' && isRecord(raw.verbForms)) {
    const forms = {};
    for (const key of ['thirdPersonPresent', 'preterite', 'participleII']) {
      const value = cleanText(raw.verbForms[key], 80);
      if (value) forms[key] = value;
    }
    if (Object.keys(forms).length > 0) item.verbForms = forms;
  }
  if (type === 'adjective' && isRecord(raw.adjectiveForms)) {
    const forms = {};
    for (const key of ['comparative', 'superlative']) {
      const value = cleanText(raw.adjectiveForms[key], 80);
      if (value) forms[key] = value;
    }
    if (Object.keys(forms).length > 0) item.adjectiveForms = forms;
  }
  return item;
}

/** word|type keys and ids of everything already in the dataset. */
function existingWords() {
  const keys = new Map(); // word|type -> id
  const ids = new Set();
  for (const file of readdirSync(VOCAB_DIR).filter((f) => /^[abc][12]\.ts$/.test(f))) {
    const source = readFileSync(join(VOCAB_DIR, file), 'utf8');
    for (const m of source.matchAll(/id:\s*'([^']+)',\s*word:\s*'([^']+)'[\s\S]*?type:\s*'([^']+)'/g)) {
      ids.add(m[1]);
      keys.set(`${m[2].toLowerCase()}|${m[3]}`, m[1]);
    }
  }
  for (const file of ['imported.json', 'themes.json']) {
    const path = join(VOCAB_DIR, file);
    if (!existsSync(path)) continue;
    for (const item of JSON.parse(readFileSync(path, 'utf8')).items) {
      ids.add(item.id);
      keys.set(`${item.word.toLowerCase()}|${item.type}`, item.id);
    }
  }
  return { keys, ids };
}

function readEntries(file) {
  const text = readFileSync(resolve(file), 'utf8').trim().replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed)) return parsed;
  if (isRecord(parsed) && Array.isArray(parsed.items)) return parsed.items;
  throw new Error('The file must contain a JSON array or an object with an "items" array.');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const entries = readEntries(args.file);
  const { keys, ids } = existingWords();
  const file = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { items: [], links: {} };
  const previous = file.items ?? [];
  const links = { ...(file.links ?? {}) };
  const report = { requested: entries.length, invalid: 0, linked: 0, duplicate: 0, added: 0 };
  const added = [];
  for (const raw of entries) {
    const item = normalizeEntry(raw, { level: args.level ?? undefined, theme: args.theme ?? undefined });
    if (!item) {
      report.invalid += 1;
      continue;
    }
    const key = `${item.word.toLowerCase()}|${item.type}`;
    if (keys.has(key)) {
      // Known word: it joins the topic for everyone instead of being added twice.
      const id = keys.get(key);
      if (item.theme && !(links[item.theme] ?? []).includes(id)) {
        links[item.theme] = [...(links[item.theme] ?? []), id];
        report.linked += 1;
      } else report.duplicate += 1;
      continue;
    }
    let id = slugify(item.word.replace(/^sich /, ''));
    if (item.type !== 'noun') id = `${id}-${item.type}`;
    let candidate = id;
    for (let n = 2; ids.has(candidate); n++) candidate = `${id}-${n}`;
    keys.set(key, candidate);
    ids.add(candidate);
    added.push({ id: candidate, ...item });
    report.added += 1;
  }
  console.log('Report', report);
  if (args.dryRun) {
    console.log(JSON.stringify({ added: added.slice(0, 5), links }, null, 2));
    return;
  }
  const items = [...previous, ...added];
  writeFileSync(OUT, `${JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), items, links }, null, 0)}\n`);
  const linkCount = Object.values(links).flat().length;
  console.log(`Wrote ${items.length} themed entries and ${linkCount} topic links to ${relative(ROOT, OUT)} (${added.length} new, ${report.linked} newly linked)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
