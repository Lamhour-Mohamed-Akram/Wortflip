/**
 * Offensive words that never enter a topic (own or shared). Stems, matched at
 * the start of a word after folding umlauts and ß, so "Arschloch" and
 * "arschlöcher" both hit while "dick" (fat) or "Schwanz" (tail) do not.
 * The database applies the same list (see supabase/schema.sql).
 */
const STEMS = [
  'arsch', 'fick', 'fotze', 'hure', 'huren', 'nutte', 'wichs', 'schwuchtel', 'schlampe', 'scheiss', 'pisse', 'pisser', 'titten', 'muschi',
  'neger', 'kanake', 'spasti', 'spast', 'mongo', 'nazi', 'hitler', 'missgeburt', 'drecksau', 'hurensohn',
  'fuck', 'shit', 'bitch', 'cunt', 'asshole', 'nigger', 'faggot', 'whore', 'slut', 'motherfucker',
];

const PATTERN = new RegExp(`(^|[^a-z0-9])(${STEMS.join('|')})`, 'i');

function fold(text: string): string {
  return text.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
}

export function containsBadWord(text: string): boolean {
  return PATTERN.test(fold(text));
}
