import { describe, expect, it } from 'vitest';
import { classify, entries, firstDefinition, firstExample, germanSection, parseAdjective, parseNoun, parseVerb, slugify } from './wiktionary.mjs';

const TISCH = `== Tisch ({{Sprache|Deutsch}}) ==
=== {{Wortart|Substantiv|Deutsch}}, {{m}} ===

{{Deutsch Substantiv Übersicht
|Genus=m
|Nominativ Singular=Tisch
|Nominativ Plural=Tische
|Bild=Table.png|mini|1|ein ''Tisch''
}}

{{Bedeutungen}}
:[1] {{K|Möbel}} [[Möbelstück]], das aus einer [[Platte]] mit vier oder drei [[Bein]]en besteht
:[2] um einen Tisch <sup>[1]</sup> [[versammelt]]e [[Gesellschaft]]

{{Beispiele}}
:[1] Der ''Tisch'' ist für die vielen Personen heute zu klein.
:[1] \u201eDer ''Tisch'' steht direkt neben dem Herd.\u201c<ref>{{Literatur | Autor= X | Titel= Y}}</ref>

== Tisch ({{Sprache|Englisch}}) ==
=== {{Wortart|Substantiv|Englisch}} ===
`;

const GEHEN = `== gehen ({{Sprache|Deutsch}}) ==
=== {{Wortart|Verb|Deutsch}} ===
{{Deutsch Verb Übersicht|Präsens_ich=gehe|Präsens_du=gehst|Präsens_er, sie, es=geht|Präteritum_ich=ging|Partizip II=gegangen|Hilfsverb=sein}}

{{Bedeutungen}}
:[1] sich [[schreitend]] fortbewegen
`;

const GROSS = `== groß ({{Sprache|Deutsch}}) ==
=== {{Wortart|Adjektiv|Deutsch}} ===
{{Deutsch Adjektiv Übersicht
|Positiv=groß
|Komparativ=größer
|Superlativ=größten
}}
{{Bedeutungen}}
:[1] von [[beträchtlich]]er Ausdehnung
`;

const GEHT = `== geht ({{Sprache|Deutsch}}) ==
=== {{Wortart|Konjugierte Form|Deutsch}} ===
{{Grundformverweis Konj|gehen}}
`;

describe('wiktionary parser', () => {
  it('extracts the German section and its entries', () => {
    const section = germanSection(TISCH);
    expect(section).not.toBeNull();
    expect(section).not.toContain('Englisch');
    const [entry] = entries(section);
    expect(classify(entry)).toEqual({ kind: 'lemma', type: 'noun' });
  });

  it('parses noun forms, definitions and examples', () => {
    const [entry] = entries(germanSection(TISCH));
    expect(parseNoun(entry.body)).toEqual({ article: 'der', word: 'Tisch', plural: 'Tische' });
    expect(firstDefinition(entry.body)).toBe('Möbelstück, das aus einer Platte mit vier oder drei Beinen besteht.');
    expect(firstExample(entry.body)).toBe('Der Tisch steht direkt neben dem Herd.');
  });

  it('parses verb forms including the auxiliary', () => {
    const [entry] = entries(germanSection(GEHEN));
    expect(classify(entry)).toEqual({ kind: 'lemma', type: 'verb' });
    expect(parseVerb(entry.body)).toEqual({ thirdPersonPresent: 'er geht', preterite: 'ging', participleII: 'ist gegangen' });
    expect(firstDefinition(entry.body)).toBe('Sich schreitend fortbewegen.');
  });

  it('parses adjective comparison', () => {
    const [entry] = entries(germanSection(GROSS));
    expect(parseAdjective(entry.body)).toEqual({ comparative: 'größer', superlative: 'am größten' });
  });

  it('resolves inflected forms to their lemma', () => {
    const [entry] = entries(germanSection(GEHT));
    expect(classify(entry)).toEqual({ kind: 'inflected', lemma: 'gehen' });
  });

  it('slugifies umlauts', () => {
    expect(slugify('Gefühl')).toBe('gefuehl');
    expect(slugify('sich ärgern')).toBe('sich-aergern');
  });
});

describe('withoutDashes', () => {
  it('turns dialogue dashes into a space and other dashes into commas', async () => {
    const { withoutDashes } = await import('./wiktionary.mjs');
    expect(withoutDashes('\u201eDanke!\u201c \u2013 \u201eBitte!\u201c')).toBe('\u201eDanke!\u201c \u201eBitte!\u201c');
    expect(withoutDashes('Freundschaft \u2013 das ist wie Heimat.')).toBe('Freundschaft, das ist wie Heimat.');
    expect(withoutDashes('Etwas auf etwas \u2013 meist ein Fahrzeug \u2013 bringen.')).toBe('Etwas auf etwas, meist ein Fahrzeug, bringen.');
    expect(withoutDashes('Zwei Dumme \u2014 ein Gedanke.')).toBe('Zwei Dumme, ein Gedanke.');
  });
});
