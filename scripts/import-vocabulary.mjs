#!/usr/bin/env node
/**
 * Imports vocabulary into src/data/vocabulary/imported.json from two free sources:
 *   - German Wiktionary (article, plural, verb forms, comparison, first definition)  CC BY-SA 4.0
 *   - Tatoeba (one short example sentence with its author)                           CC BY 2.0 FR
 *
 * This runs on the developer machine only. The app never calls these APIs; the
 * generated file is bundled like the hand-written vocabulary.
 *
 *   node scripts/import-vocabulary.mjs --list scripts/import/wordlist.txt [--level A1]
 *   node scripts/import-vocabulary.mjs --frequency 2000 [--a1 500] [--a2 1200] [--b1 3000] [--b2 7000] [--limit 1500]
 *   (rank thresholds: below a1 -> A1, below a2 -> A2, below b1 -> B1, below b2 -> B2, else C1;
 *    --min-rank N skips the N most frequent tokens; --strict drops words reached through an inflected form,
 *    interjections, entries marked as vulgar or derogatory, and one-word stub definitions)
 *   Options: --merge (keep the entries already in imported.json and add new ones)
 *            --override-level (with --merge: the list's level wins for words already imported)
 *            --no-sentences  --dry-run  --out <file>  --help
 *
 * Responses are cached in scripts/.cache so re-runs do not hit the APIs again.
 * Requests are sequential and slow (1 s for Tatoeba, 3 s per Wiktionary batch of 30 pages);
 * 429 answers are retried with Retry-After or exponential backoff.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classify,
  entries,
  firstDefinition,
  firstExample,
  germanSection,
  parseAdjective,
  parseNoun,
  parseVerb,
  slugify,
  withoutDashes,
} from './import/wiktionary.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = join(ROOT, 'scripts', '.cache');
const VOCAB_DIR = join(ROOT, 'src', 'data', 'vocabulary');
const OUT_DEFAULT = join(VOCAB_DIR, 'imported.json');

const CONTACT = process.env.IMPORT_CONTACT ?? 'contact not set, see README';
const USER_AGENT = `Wortflip-Importer/1.0 (${CONTACT}; offline import script, 1 request/s)`;
const WIKTIONARY_API = 'https://de.wiktionary.org/w/api.php';
const TATOEBA_API = 'https://api.tatoeba.org/unstable/sentences';
const FREQUENCY_URL = 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/de/de_50k.txt';
const REQUEST_DELAY_MS = 1000;
// Wiktionary batch queries return a lot of text, so they get a gentler pace.
const WIKTIONARY_DELAY_MS = 3000;
const WIKTIONARY_BATCH = 30;
const MAX_ATTEMPTS = 8;
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];
const TYPE_LABEL = { noun: 'nomen', verb: 'verb', adjective: 'adjektiv', adverb: 'adverb', preposition: 'praeposition', conjunction: 'konjunktion', other: 'sonstiges' };

const SOURCES = {
  wiktionary: {
    id: 'de-wiktionary',
    name: 'Deutsches Wiktionary',
    url: 'https://de.wiktionary.org',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.de',
    note: 'Definitionen, Artikel, Plural-, Verb- und Steigerungsformen der importierten Einträge sowie die englischen Übersetzungen.',
  },
  tatoeba: {
    id: 'tatoeba',
    name: 'Tatoeba',
    url: 'https://tatoeba.org/de',
    license: 'CC BY 2.0 FR',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0/fr/deed.de',
    note: 'Beispielsätze der importierten Einträge. Der Autor jedes Satzes steht auf der Karte.',
  },
};

// ───────────────────────────── CLI ─────────────────────────────

function printHelp() {
  const header = readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0];
  console.log(
    header
      .split('\n')
      .filter((line) => line.startsWith(' *'))
      .map((line) => line.replace(/^ \* ?/, ''))
      .join('\n')
      .trim(),
  );
}

// Frequency lists are full of interjections, slurs and one-word stub
// definitions. Strict mode skips them so the flashcards stay useful.
const OFFENSIVE =
  /\b(derb|vulgär|abwertend|Schimpfwort|Geschlechtsorgan|Geschlechtsverkehr|obszön|Fäkalsprache|Prostituierte[rn]?)\b/i;
function lowValueReason(info) {
  if (info.type === 'other') return 'interjection';
  if (OFFENSIVE.test(info.definitionDe)) return 'offensive';
  const definition = info.definitionDe;
  if (definition.length < 14 || /\d\.$/.test(definition) || /^Ohne Plural/i.test(definition)) return 'stub';
  return null;
}

function parseArgs(argv) {
  const args = { list: null, frequency: 0, a1: 500, a2: 1200, b1: 3000, b2: 7000, minRank: 0, strict: false, level: 'A1', limit: Infinity, sentences: true, dryRun: false, out: OUT_DEFAULT, merge: false, overrideLevel: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const next = () => argv[++i];
    if (flag === '--list') args.list = next();
    else if (flag === '--frequency') args.frequency = Number(next());
    else if (flag === '--a1') args.a1 = Number(next());
    else if (flag === '--a2') args.a2 = Number(next());
    else if (flag === '--b1') args.b1 = Number(next());
    else if (flag === '--b2') args.b2 = Number(next());
    else if (flag === '--min-rank') args.minRank = Number(next());
    else if (flag === '--strict') args.strict = true;
    else if (flag === '--level') args.level = next();
    else if (flag === '--limit') args.limit = Number(next());
    else if (flag === '--out') args.out = next();
    else if (flag === '--no-sentences') args.sentences = false;
    else if (flag === '--merge') args.merge = true;
    else if (flag === '--override-level') args.overrideLevel = true;
    else if (flag === '--dry-run') args.dryRun = true;
    else if (flag === '--help' || flag === '-h') {
      printHelp();
      process.exit(0);
    } else throw new Error(`Unknown option ${flag}`);
  }
  if (!args.list && !args.frequency) {
    printHelp();
    process.exit(1);
  }
  if (!LEVELS.includes(args.level)) throw new Error(`--level must be one of ${LEVELS.join(', ')}`);
  return args;
}

// ───────────────────────────── cache + polite fetch ─────────────────────────────

export function loadCache(name) {
  const file = join(CACHE_DIR, `${name}.json`);
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
}

export function saveCache(name, data) {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(join(CACHE_DIR, `${name}.json`), JSON.stringify(data));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let lastRequestAt = 0;
let requestCount = 0;

async function politeFetch(url, { json = true, delay = REQUEST_DELAY_MS } = {}) {
  const wait = lastRequestAt + delay - Date.now();
  if (wait > 0) await sleep(wait);
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    lastRequestAt = Date.now();
    requestCount += 1;
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: json ? 'application/json' : 'text/plain' } });
    if (response.ok) return json ? response.json() : response.text();
    if (response.status === 429 || response.status >= 500) {
      // Honour Retry-After when the server sends it, otherwise back off exponentially (30s, 60s, 120s, ...).
      const retryAfter = Number(response.headers.get('retry-after'));
      const backoff = Number.isFinite(retryAfter) && retryAfter > 0 ? (retryAfter + 5) * 1000 : Math.min(30000 * 2 ** (attempt - 1), 600000);
      console.warn(`  ${response.status} from ${new URL(url).host}, waiting ${Math.round(backoff / 1000)}s (attempt ${attempt}/${MAX_ATTEMPTS})`);
      await sleep(backoff);
      continue;
    }
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }
  throw new Error(`Giving up on ${url} after ${MAX_ATTEMPTS} attempts`);
}

// ───────────────────────────── Wiktionary ─────────────────────────────

/** Wikitext per title (null when the page does not exist), 50 titles per request. */
export async function fetchWikitexts(titles, cache) {
  const wanted = [...new Set(titles)].filter((title) => !(title in cache));
  for (let i = 0; i < wanted.length; i += WIKTIONARY_BATCH) {
    const batch = wanted.slice(i, i + WIKTIONARY_BATCH);
    const params = new URLSearchParams({
      action: 'query',
      prop: 'revisions',
      rvprop: 'content',
      rvslots: 'main',
      format: 'json',
      formatversion: '2',
      maxlag: '5',
      titles: batch.join('|'),
    });
    const data = await politeFetch(`${WIKTIONARY_API}?${params}`, { delay: WIKTIONARY_DELAY_MS });
    for (const page of data.query?.pages ?? []) {
      cache[page.title] = page.missing ? null : (page.revisions?.[0]?.slots?.main?.content ?? null);
    }
    for (const n of data.query?.normalized ?? []) cache[n.from] = cache[n.to] ?? null;
    for (const title of batch) if (!(title in cache)) cache[title] = null;
    saveCache('wiktionary', cache);
    console.log(`  Wiktionary: ${Math.min(i + WIKTIONARY_BATCH, wanted.length)}/${wanted.length} pages fetched`);
  }
  return Object.fromEntries(titles.map((title) => [title, cache[title] ?? null]));
}

/** Shorter, learner-friendlier definition: no asides in parentheses, first sense only, first sentence only. */
function tidyDefinition(text) {
  let s = withoutDashes(text).replace(/\s*\([^()]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  s = s.split(';')[0].trim();
  const firstSentence = /^(.+?[.!?])(\s+[A-ZÄÖÜ„].*)$/.exec(s);
  if (firstSentence) s = firstSentence[1];
  s = s.replace(/\s+([.,;:!?])/g, '$1').replace(/[,:]$/, '').trim();
  if (!/[.!?]$/.test(s)) s += '.';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** The first usable lemma entry of a page: { type, ... } or { lemma } for inflected forms, or null. */
function analysePage(title, wikitext) {
  if (!wikitext) return null;
  const section = germanSection(wikitext);
  if (!section) return null;
  let inflectedLemma = null;
  for (const entry of entries(section)) {
    const info = classify(entry);
    if (info.kind === 'inflected') {
      inflectedLemma ??= info.lemma;
      continue;
    }
    if (info.kind !== 'lemma') continue;
    const definition = firstDefinition(entry.body);
    if (!definition) continue;
    const item = { word: title, type: info.type, definitionDe: tidyDefinition(definition), wiktionaryExample: firstExample(entry.body) };
    if (info.type === 'noun') {
      const noun = parseNoun(entry.body);
      if (!noun) continue;
      item.article = noun.article;
      item.word = noun.word;
      if (noun.plural) item.plural = noun.plural;
    } else if (info.type === 'verb') {
      const forms = parseVerb(entry.body);
      if (forms && Object.keys(forms).length > 0) item.verbForms = forms;
    } else if (info.type === 'adjective') {
      const forms = parseAdjective(entry.body);
      if (forms && Object.keys(forms).length > 0) item.adjectiveForms = forms;
    }
    return item;
  }
  return inflectedLemma ? { lemma: inflectedLemma } : null;
}

// ───────────────────────────── Tatoeba ─────────────────────────────

async function fetchSentences(word, cache) {
  const key = `${word}|relevance50`;
  if (key in cache) return cache[key];
  const params = new URLSearchParams({ lang: 'deu', q: word, sort: 'relevance', limit: '50' });
  try {
    const data = await politeFetch(`${TATOEBA_API}?${params}`);
    cache[key] = (data.data ?? []).map((s) => ({ id: s.id, text: s.text, owner: s.owner, license: s.license, unapproved: Boolean(s.is_unapproved) }));
  } catch (error) {
    console.warn(`  Tatoeba failed for "${word}": ${error.message}`);
    cache[key] = [];
  }
  saveCache('tatoeba', cache);
  return cache[key];
}

/** Pre-1996 spellings and other signs of dated or awkward sentences. */
const DATED_SPELLING = /\b(daß|muß|mußt|mußte|ißt|läßt|läss|Wieviel|wieviel|Schluß|bißchen|Fluß|Kuß|Faß|paßt|gewußt|Prozeß|Streß)\b/;
const SEPARABLE_PREFIX_AT_END = /\s(ab|an|auf|aus|bei|ein|fest|her|hin|los|mit|nach|vor|weg|weiter|zu|zurück|zusammen)[.!?]?$/;

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Picks a short, natural sentence that really contains the word (or its stem for verbs). */
function pickSentence(item, sentences) {
  const base = item.word.replace(/^sich /, '');
  const stem = item.type === 'verb' ? base.replace(/(e?n)$/, '') : base;
  const stemPattern = new RegExp(`(^|[^A-Za-zÄÖÜäöüß])${escapeRegExp(stem)}`, 'i');
  const exactPattern = new RegExp(`(^|[^A-Za-zÄÖÜäöüß])${escapeRegExp(base)}([^A-Za-zÄÖÜäöüß]|$)`, 'i');
  let best = null;
  for (const s of sentences) {
    if (s.unapproved || !s.owner || !s.text) continue;
    if (s.license !== 'CC BY 2.0 FR' && s.license !== 'CC0 1.0') continue;
    const text = s.text.trim();
    const words = text.split(/\s+/).length;
    if (words < 3 || words > 12 || !stemPattern.test(text)) continue;
    let score = 10 - Math.abs(words - 6);
    if (words === 3) score -= 3;
    if (exactPattern.test(text)) score += 2;
    if (/\b(Tom|Maria|Mary|John|Jan|Wladimir)\b/.test(text)) score -= 3;
    if (/[«»"()]|\.\.\.|\d|[A-Z]{2,}/.test(text)) score -= 3;
    if (DATED_SPELLING.test(text)) score -= 6;
    // "Holt sie ein." uses einholen, not holen: a particle at the end means a separable verb.
    if (item.type === 'verb' && SEPARABLE_PREFIX_AT_END.test(text) && !/ /.test(item.word)) score -= 6;
    if (!best || score > best.score) best = { ...s, score };
  }
  return best && best.score > 0 ? best : null;
}

// ───────────────────────────── word lists ─────────────────────────────

function readWordList(file, defaultLevel) {
  const lines = readFileSync(file, 'utf8').split('\n');
  const words = [];
  for (const raw of lines) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const match = /^(.+?)(?:[\s;,]+(A1|A2|B1))?$/.exec(line);
    words.push({ title: match[1].trim(), level: match[2] ?? defaultLevel, rank: words.length });
  }
  return words;
}

async function tokensFromFrequencyList(count) {
  const file = join(CACHE_DIR, 'de_50k.txt');
  if (!existsSync(file)) {
    console.log('Downloading frequency list (used only to rank words; no text is copied into the app)');
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(file, await politeFetch(FREQUENCY_URL, { json: false }));
  }
  const tokens = [];
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const token = line.split(' ')[0];
    if (/^[a-zäöüß]{2,}$/.test(token)) tokens.push(token);
    if (tokens.length >= count) break;
  }
  return tokens;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Entries currently in imported.json (for --merge). */
function readImported(file) {
  if (!existsSync(file)) return [];
  try {
    return JSON.parse(readFileSync(file, 'utf8')).items ?? [];
  } catch {
    return [];
  }
}

/** Ids and "word|type" keys of the hand-written vocabulary, so imports never duplicate them. */
function handWrittenKeys() {
  const ids = new Set();
  const words = new Set();
  for (const level of ['a1', 'a2', 'b1', 'b2', 'c1']) {
    const text = readFileSync(join(VOCAB_DIR, `${level}.ts`), 'utf8');
    for (const match of text.matchAll(/id: '([^']+)', word: '([^']+)'(?:, article: '[^']+')?(?:, plural: '[^']+')?, type: '([^']+)'/g)) {
      ids.add(match[1]);
      words.add(`${match[2].replace(/^sich /, '').toLowerCase()}|${match[3]}`);
    }
  }
  return { ids, words };
}

// ───────────────────────────── main ─────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const wiktionaryCache = loadCache('wiktionary');
  const tatoebaCache = loadCache('tatoeba');
  const existing = handWrittenKeys();
  const previous = args.merge ? readImported(args.out) : [];
  const report = { requested: 0, missingPage: 0, unsupported: 0, duplicate: 0, noSentence: 0, filtered: 0, imported: 0, kept: previous.length, relevelled: 0 };

  // 1) Titles to look up, with rank and level.
  let candidates;
  if (args.list) {
    candidates = readWordList(args.list, args.level).map((w) => ({ ...w, titles: [w.title] }));
  } else {
    const tokens = await tokensFromFrequencyList(args.frequency);
    candidates = tokens
      .map((token, rank) => ({
        title: token,
        rank,
        level: rank < args.a1 ? 'A1' : rank < args.a2 ? 'A2' : rank < args.b1 ? 'B1' : rank < args.b2 ? 'B2' : 'C1',
        titles: [token, capitalize(token)],
      }))
      .filter((c) => c.rank >= args.minRank);
  }
  report.requested = candidates.length;
  console.log(`Looking up ${candidates.length} words on the German Wiktionary`);

  // 2) Fetch pages, resolve inflected forms to their lemma with a second pass.
  const pages = await fetchWikitexts(candidates.flatMap((c) => c.titles), wiktionaryCache);
  const lemmaTitles = new Set();
  const analysed = new Map();
  for (const [title, wikitext] of Object.entries(pages)) {
    const info = analysePage(title, wikitext);
    analysed.set(title, info);
    if (info?.lemma) lemmaTitles.add(info.lemma);
  }
  const extra = [...lemmaTitles].filter((title) => !analysed.has(title));
  if (extra.length > 0) {
    console.log(`Resolving ${extra.length} inflected forms to their base form`);
    const more = await fetchWikitexts(extra, wiktionaryCache);
    for (const [title, wikitext] of Object.entries(more)) analysed.set(title, analysePage(title, wikitext));
  }

  // 3) Build items in rank order, skipping duplicates and hand-written words.
  const items = [];
  const seen = new Set(existing.ids);
  const seenWords = new Set(existing.words);
  const previousByWord = new Map(previous.map((entry) => [entry.word, entry]));
  for (const entry of previous) {
    seen.add(entry.id);
    seenWords.add(`${entry.word.toLowerCase()}|${entry.type}`);
  }
  for (const candidate of candidates) {
    let found = null;
    for (const title of candidate.titles) {
      let info = analysed.get(title);
      // In strict mode a token must be the base form itself; "wassern" reached
      // through the plural "Wassern" is exactly the kind of rare lemma to avoid.
      if (info?.lemma) info = args.strict ? null : analysed.get(info.lemma);
      if (info && !info.lemma && (!args.strict || info.word.length >= 4)) {
        found = info;
        break;
      }
    }
    if (!found) {
      if (candidate.titles.every((t) => pages[t] === null)) report.missingPage += 1;
      else report.unsupported += 1;
      continue;
    }
    if (args.strict && lowValueReason(found)) {
      report.filtered += 1;
      continue;
    }
    const wordKey = `${found.word.toLowerCase()}|${found.type}`;
    let id = slugify(found.word);
    if (seen.has(id)) id = `${id}-${TYPE_LABEL[found.type]}`;
    if (seen.has(id) || seenWords.has(wordKey)) {
      const kept = previousByWord.get(found.word);
      if (kept && args.overrideLevel && kept.level !== candidate.level) {
        kept.level = candidate.level;
        report.relevelled += 1;
      }
      report.duplicate += 1;
      continue;
    }
    seen.add(id);
    seenWords.add(wordKey);
    items.push({ ...found, id, level: candidate.level, rank: candidate.rank });
    if (items.length >= args.limit) break;
  }

  // 4) Example sentences.
  if (args.sentences) console.log(`Fetching example sentences from Tatoeba for ${items.length} words`);
  const output = [];
  for (const [index, item] of items.entries()) {
    let exampleDe = null;
    let exampleSource;
    if (args.sentences) {
      const pick = pickSentence(item, await fetchSentences(item.word.replace(/^sich /, ''), tatoebaCache));
      if (pick) {
        exampleDe = withoutDashes(pick.text).trim();
        exampleSource = { sourceId: SOURCES.tatoeba.id, author: pick.owner, url: `https://tatoeba.org/de/sentences/show/${pick.id}` };
      }
      if ((index + 1) % 25 === 0) console.log(`  Tatoeba: ${index + 1}/${items.length}`);
    }
    if (!exampleDe && item.wiktionaryExample) exampleDe = item.wiktionaryExample;
    if (!exampleDe) {
      report.noSentence += 1;
      continue;
    }
    if (args.strict && OFFENSIVE.test(exampleDe)) {
      report.filtered += 1;
      continue;
    }
    const entry = {
      id: item.id,
      word: item.word,
      ...(item.article ? { article: item.article } : {}),
      ...(item.plural ? { plural: item.plural } : {}),
      type: item.type,
      level: item.level,
      definitionDe: item.definitionDe,
      exampleDe,
      ...(item.verbForms ? { verbForms: item.verbForms } : {}),
      ...(item.adjectiveForms ? { adjectiveForms: item.adjectiveForms } : {}),
      sourceIds: exampleSource ? [SOURCES.wiktionary.id, SOURCES.tatoeba.id] : [SOURCES.wiktionary.id],
      definitionUrl: `https://de.wiktionary.org/wiki/${encodeURIComponent(item.word)}`,
      ...(exampleSource ? { exampleSource } : {}),
    };
    output.push(entry);
  }
  report.imported = output.length;
  const all = [...previous, ...output];

  // 5) Write the JSON file (imported.ts is a small typed wrapper around it).
  const usedSources = [SOURCES.wiktionary, ...(all.some((e) => e.exampleSource) ? [SOURCES.tatoeba] : [])];
  const file = JSON.stringify(
    {
      generatedBy: 'scripts/import-vocabulary.mjs',
      generatedAt: new Date().toISOString().slice(0, 10),
      sources: all.length ? usedSources : [],
      items: all,
    },
    null,
    2,
  ) + '\n';

  console.log('\nReport');
  for (const [key, value] of Object.entries(report)) console.log(`  ${key.padEnd(12)} ${value}`);
  console.log(`  requests     ${requestCount}`);
  if (args.dryRun) {
    console.log('\nDry run, nothing written. First entries:');
    console.log(JSON.stringify(output.slice(0, 5), null, 2));
    return;
  }
  writeFileSync(args.out, file);
  console.log(`\nWrote ${all.length} entries to ${relative(ROOT, args.out)} (${output.length} new)`);
}

// Only run when executed directly; import-translations.mjs reuses the helpers above.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
