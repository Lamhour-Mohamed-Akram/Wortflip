/** Lowercase, umlauts and ß folded, accents stripped: "Gefühl" and "gefuhl" both become "gefuhl". */
export function normalizeSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Search query without a leading article or reflexive pronoun ("der Tisch" -> "tisch"). */
export function normalizeQuery(query: string): string {
  return normalizeSearch(query).replace(/^(der|die|das|sich) /, '');
}
