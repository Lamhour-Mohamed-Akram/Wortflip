/**
 * Parsing helpers for German Wiktionary wikitext. Pure functions, no network,
 * so they can be unit-tested (see wiktionary.test.mjs).
 */

const ARTICLES = { m: 'der', f: 'die', n: 'das' };

const TYPE_RULES = [
  [/Substantiv/, 'noun'],
  [/\bVerb\b|Hilfsverb|Modalverb/, 'verb'],
  [/Adjektiv/, 'adjective'],
  [/Adverb/, 'adverb'],
  [/Präposition|Postposition/, 'preposition'],
  [/Konjunktion|Subjunktion/, 'conjunction'],
  [/Partikel|Interjektion|Grußformel|Antwortpartikel/, 'other'],
];

const SKIP_TYPES =
  /Vorname|Nachname|Toponym|Eigenname|Abkürzung|Pronomen|Artikel|Numerale|Zahlzeichen|Buchstabe|Wortverbindung|Redewendung|Sprichwort|Suffix|Präfix|Affix|Gebundenes Lexem|Symbol|Onomatopoetikum/;

const INFLECTED_TYPES = /Deklinierte Form|Konjugierte Form|Komparativ|Superlativ|Partizip|Erweiterter Infinitiv/;

/** The "Deutsch" language section of a page, or null. */
export function germanSection(wikitext) {
  const match = /^== .*?\(\{\{Sprache\|Deutsch\}\}\) ==[ \t]*$/m.exec(wikitext);
  if (!match) return null;
  const rest = wikitext.slice(match.index + match[0].length);
  const end = rest.search(/^== /m);
  return end === -1 ? rest : rest.slice(0, end);
}

/** Level-3 entries ("=== {{Wortart|Substantiv|Deutsch}}, {{m}} ===") of a language section. */
export function entries(section) {
  const parts = section.split(/^(?==== )/m).filter((part) => part.startsWith('=== '));
  return parts.map((part) => {
    const newline = part.indexOf('\n');
    const heading = part.slice(4, newline === -1 ? undefined : newline).replace(/\s*===\s*$/, '');
    const body = newline === -1 ? '' : part.slice(newline + 1);
    return { heading, body };
  });
}

/** Classifies an entry heading: { kind: 'lemma', type } | { kind: 'inflected', lemma } | { kind: 'skip' }. */
export function classify(entry) {
  const names = [...entry.heading.matchAll(/\{\{Wortart\|([^|}]+)\|Deutsch\}\}/g)].map((m) => m[1].trim());
  const joined = names.join(', ');
  if (INFLECTED_TYPES.test(joined)) {
    const ref = /\{\{Grundformverweis[^|}]*\|([^|}]+)/.exec(entry.body);
    return ref ? { kind: 'inflected', lemma: ref[1].trim() } : { kind: 'skip' };
  }
  if (SKIP_TYPES.test(joined)) return { kind: 'skip' };
  for (const [pattern, type] of TYPE_RULES) if (pattern.test(joined)) return { kind: 'lemma', type };
  return { kind: 'skip' };
}

/** Splits template parameters at top-level pipes (ignores pipes inside [[...]] and {{...}}). */
function splitParams(inner) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < inner.length; i++) {
    const two = inner.slice(i, i + 2);
    if (two === '[[' || two === '{{') {
      depth++;
      current += two;
      i++;
    } else if (two === ']]' || two === '}}') {
      depth--;
      current += two;
      i++;
    } else if (inner[i] === '|' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += inner[i];
    }
  }
  parts.push(current);
  return parts;
}

/** Parameters of the first `{{name ...}}` template in `text`, or null. */
export function extractTemplate(text, name) {
  const start = text.indexOf(`{{${name}`);
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length - 1; i++) {
    if (text.startsWith('{{', i)) {
      depth++;
      i++;
    } else if (text.startsWith('}}', i)) {
      depth--;
      i++;
      if (depth === 0) {
        const params = {};
        for (const part of splitParams(text.slice(start + 2, i - 1)).slice(1)) {
          const eq = part.indexOf('=');
          if (eq === -1) continue;
          params[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
        }
        return params;
      }
    }
  }
  return null;
}

/**
 * English translations of the first sense, from the first translation table of
 * an entry: "house, home" (at most three words), or null.
 */
export function englishTranslation(body) {
  // One table per sense; a table can hold multi-line templates, so the next
  // table (not "}}") marks its end. Sense 1 comes first; if it has no English
  // line (it happens, e.g. "gut"), the next sense that has one is used.
  const tables = body.split('{{Ü-Tabelle').slice(1);
  for (const table of tables) {
    const line = /^\*\{\{en\}\}:(.*)$/m.exec(table);
    if (!line) continue;
    // Older pages list every sense in one table ("[1] house; [2] family"): keep sense 1.
    const text = line[1].split(/\[2[^\]]*\]/)[0];
    const words = [];
    for (const match of text.matchAll(/\{\{Ü\|en\|([^}|]+)(?:\|[^}]*)?\}\}/g)) {
      const word = withoutDashes(match[1]).trim();
      if (word && !words.includes(word)) words.push(word);
    }
    if (words.length > 0) return words.slice(0, 3).join(', ');
  }
  return null;
}

/** Wiki markup to plain text. */
export function cleanWikitext(input) {
  let s = input.replace(/<ref[^>]*\/>/g, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '');
  let previous;
  do {
    previous = s;
    s = s.replace(/\{\{[^{}]*\}\}/g, '');
  } while (s !== previous);
  s = s.replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, '$2').replace(/\[\[([^\]]*)\]\]/g, '$1');
  s = s.replace(/'{2,}/g, '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
  return s.replace(/\s+/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim();
}

/** Plain value of a form parameter, or null when empty or a dash placeholder. */
export function formValue(raw) {
  if (raw === undefined) return null;
  const value = cleanWikitext(raw).replace(/\s*\(.*?\)\s*/g, ' ').trim();
  if (!value || /^[\u2014\u2013-]+$/.test(value) || /^(kein|keine|ohne)\b/i.test(value)) return null;
  return value;
}

/**
 * The app avoids en and em dashes everywhere. Between two quoted dialogue turns a
 * dash becomes a space; elsewhere it becomes a comma.
 */
export function withoutDashes(text) {
  return text
    .replace(/\u201c\s*[\u2013\u2014]\s*\u201e/g, '\u201c \u201e')
    .replace(/\s*[\u2013\u2014]\s*/g, ', ')
    .replace(/,\s*,/g, ',')
    .replace(/\s+([,.;:!?])/g, '$1');
}

export function tidySentence(text) {
  let s = withoutDashes(text).replace(/\[\d+[a-z]?\]/g, '').replace(/\s+/g, ' ').trim();
  s = s.replace(/^[„“"'»«\s]+|[„“"'»«\s]+$/g, '').trim();
  if (!s) return '';
  s = s.charAt(0).toUpperCase() + s.slice(1);
  if (/[;:,]$/.test(s)) s = s.slice(0, -1);
  if (!/[.!?…]$/.test(s)) s += '.';
  return s;
}

export function parseNoun(body) {
  const p = extractTemplate(body, 'Deutsch Substantiv Übersicht');
  if (!p) return null;
  const article = ARTICLES[(p.Genus ?? p['Genus 1'] ?? '').trim()];
  const word = formValue(p['Nominativ Singular'] ?? p['Nominativ Singular 1']);
  if (!article || !word) return null;
  const plural = formValue(p['Nominativ Plural'] ?? p['Nominativ Plural 1'] ?? p['Nominativ Plural*']);
  return { article, word, plural };
}

export function parseVerb(body) {
  const p = extractTemplate(body, 'Deutsch Verb Übersicht');
  if (!p) return null;
  const present = formValue(p['Präsens_er, sie, es'] ?? p['Präsens_er, sie, es*']);
  const preterite = formValue(p['Präteritum_ich'] ?? p['Präteritum_ich*']);
  const participle = formValue(p['Partizip II'] ?? p['Partizip II*']);
  const auxiliary = (formValue(p.Hilfsverb) ?? 'haben').split(/[,/]/)[0].trim();
  const forms = {};
  if (present) forms.thirdPersonPresent = `er ${present}`;
  if (preterite) forms.preterite = preterite;
  if (participle) forms.participleII = `${auxiliary === 'sein' ? 'ist' : 'hat'} ${participle}`;
  return forms;
}

export function parseAdjective(body) {
  const p = extractTemplate(body, 'Deutsch Adjektiv Übersicht');
  if (!p) return null;
  const comparative = formValue(p.Komparativ);
  const superlative = formValue(p.Superlativ);
  const forms = {};
  if (comparative) forms.comparative = comparative;
  if (superlative) forms.superlative = superlative.startsWith('am ') ? superlative : `am ${superlative}`;
  return forms;
}

function numberedLines(body, marker) {
  const index = body.indexOf(marker);
  if (index === -1) return [];
  const block = body.slice(index + marker.length).split(/\n[ \t]*\n/)[0];
  const lines = [];
  for (const line of block.split('\n')) {
    const match = /^:+\s*\[(\d+)[a-z]?\]\s*(.*)$/.exec(line.trim());
    if (match) lines.push({ sense: Number(match[1]), text: match[2] });
  }
  return lines;
}

/** First usable definition (sense [1]) as plain German text, or null. */
export function firstDefinition(body) {
  for (const line of numberedLines(body, '{{Bedeutungen}}')) {
    if (line.sense !== 1) continue;
    const text = tidySentence(cleanWikitext(line.text));
    if (text.length < 6) continue;
    if (/^(siehe|form von|plural von|deklinierte|konjugierte|nur in|meist in)/i.test(text)) continue;
    return text;
  }
  return null;
}

/** Shortest example sentence for sense [1] from the page itself (fallback when Tatoeba has none). */
export function firstExample(body) {
  const candidates = numberedLines(body, '{{Beispiele}}')
    .filter((line) => line.sense === 1)
    .map((line) => tidySentence(cleanWikitext(line.text)))
    .filter(
      (text) =>
        text.length >= 12 &&
        text.length <= 90 &&
        !/[[\]:;()]|\d|[A-Z]{2,}|\b(daß|muß|ißt|läßt|Wieviel)\b/.test(text) &&
        text.split(/\s+/).length <= 12,
    );
  candidates.sort((a, b) => a.length - b.length);
  return candidates[0] ?? null;
}

export function slugify(word) {
  return word
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
