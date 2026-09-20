#!/usr/bin/env node
/**
 * Adds English translations to every word (hand-written and imported) from the
 * German Wiktionary translation tables and writes them to
 * src/data/vocabulary/translations.json (id -> "house, home").
 *
 *   node scripts/import-translations.mjs [--dry-run]
 *
 * Pages already in scripts/.cache/wiktionary.json are reused; only missing pages
 * (typically the hand-written words) are fetched, 30 per request every three seconds.
 * License of the translations: CC BY-SA 4.0 (see NOTICE.md).
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify, englishTranslation, entries, germanSection } from './import/wiktionary.mjs';
import { fetchWikitexts, loadCache, saveCache } from './import-vocabulary.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VOCAB_DIR = join(ROOT, 'src', 'data', 'vocabulary');
const OUT = join(VOCAB_DIR, 'translations.json');

/** { id, word, type } of every hand-written entry, read from the level files. */
function handWrittenWords() {
  const words = [];
  for (const file of readdirSync(VOCAB_DIR).filter((f) => /^[abc][12]\.ts$/.test(f))) {
    const source = readFileSync(join(VOCAB_DIR, file), 'utf8');
    for (const m of source.matchAll(/id:\s*'([^']+)',\s*word:\s*'([^']+)'[\s\S]*?type:\s*'([^']+)'/g)) {
      words.push({ id: m[1], word: m[2], type: m[3] });
    }
  }
  return words;
}

/** The translation of the entry whose word type matches (or of the first lemma entry). */
function translationFor(wikitext, type) {
  const section = wikitext && germanSection(wikitext);
  if (!section) return null;
  const all = entries(section).map((entry) => ({ entry, info: classify(entry) }));
  const lemmas = all.filter((e) => e.info.kind === 'lemma');
  // Subtypes the importer skips (e.g. "Temporaladverb") still carry good translations.
  const preferred = lemmas.find((e) => e.info.type === type) ?? lemmas[0] ?? all.find((e) => e.info.kind !== 'inflected');
  return preferred ? englishTranslation(preferred.entry.body) : null;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const imported = JSON.parse(readFileSync(join(VOCAB_DIR, 'imported.json'), 'utf8')).items;
  const words = [...handWrittenWords(), ...imported.map(({ id, word, type }) => ({ id, word, type }))];
  const title = (word) => word.replace(/^sich /, '');
  console.log(`${words.length} words (${words.length - imported.length} hand-written, ${imported.length} imported)`);

  const cache = loadCache('wiktionary');
  const pages = await fetchWikitexts(words.map((w) => title(w.word)), cache);
  saveCache('wiktionary', cache);

  const translations = {};
  let missing = 0;
  for (const w of words) {
    const translation = translationFor(pages[title(w.word)], w.type);
    if (translation) translations[w.id] = translation;
    else missing += 1;
  }
  const missingSample = words.filter((w) => !translations[w.id]).slice(0, 15).map((w) => w.word);
  console.log(`translated ${Object.keys(translations).length}, without translation ${missing}${missing ? ` (e.g. ${missingSample.join(', ')})` : ''}`);

  const output = {
    generatedAt: new Date().toISOString().slice(0, 10),
    sourceId: 'de-wiktionary',
    language: 'en',
    translations,
  };
  if (dryRun) {
    console.log(JSON.stringify(Object.fromEntries(Object.entries(translations).slice(0, 10)), null, 2));
    return;
  }
  writeFileSync(OUT, `${JSON.stringify(output, null, 0)}\n`);
  console.log(`Wrote ${relative(ROOT, OUT)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
