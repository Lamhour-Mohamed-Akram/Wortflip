# Wortflip

Deutsch-Wortschatz von A1 bis B1 mit wischbaren Karteikarten lernen, wie in einer Dating-App, nur für Wörter.
Eine statische Progressive Web App ohne Konto, ohne Server und ohne externe Anfragen zur Laufzeit.

- **Tippen** dreht die Karte um: Definition, Beispielsatz und Formen (Plural, Verbformen, Steigerung), alles auf einfachem Deutsch.
- **Wischen** bewertet: rechts = „Kenne ich“, links = „Noch lernen“. Alternativ per Buttons oder Tastatur.
- **Spaced Repetition** entscheidet, wann ein Wort wiederkommt (Leitner-Stufen: 1, 3, 7, 14, 30 Tage).
- **2872 Wörter** in drei Levels: 472 handgeschriebene (A1 193, A2 147, B1 132) plus 2400 importierte aus Wiktionary und Tatoeba, ausgewählt nach den Goethe-Institut-Wortlisten (A1 410, A2 472, B1 1518). Levels lassen sich frei kombinieren.
- **Wörterliste mit Suche**: alle Wörter nach Level und Wortart filtern, suchen (auch ohne Umlaute: „gefuhl“ findet „Gefühl“) und die Auswahl direkt lernen. Die Suche läuft komplett im Browser über die gebündelten Daten; es gibt keine Online-Abfrage und nichts, das auf Netlify-Limits zählt.
- **Offline und installierbar**: App-Shell, Wortschatz und Schriften werden per Service Worker gecacht.
- **Alles lokal**: Fortschritt, Serie und Statistiken liegen ausschließlich in `localStorage`.

## Lokale Entwicklung

Voraussetzung: Node.js 20 oder neuer.

```bash
npm install        # Abhängigkeiten installieren
npm run dev        # Dev-Server mit Hot Reload (http://localhost:5173)
npm run build      # Typprüfung + Produktions-Build nach dist/
npm run preview    # Produktions-Build lokal testen (http://localhost:4173, inkl. Service Worker)
npm test           # Unit-Tests für Scheduler, Session-Logik, Speicher und Datensatz
npm run typecheck  # nur TypeScript
npm run icons      # PWA-Icons und favicon.svg neu generieren (ohne Abhängigkeiten)
```

Der Service Worker ist nur im Produktions-Build aktiv (`npm run build && npm run preview`).

## Deployment

Der Build ist eine rein statische Seite (`dist/`). Es gibt keine Server-Routen; die Navigation läuft über den URL-Hash.

| Plattform            | Einstellungen                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Cloudflare Pages** | Build command `npm run build`, Build output directory `dist`, Node-Version 20+.                                                     |
| **Netlify**          | `netlify.toml` liegt bei (Build `npm run build`, Publish `dist`). Einfach das Repository verbinden.                                  |
| **GitHub Pages**     | Möglich mit `BASE_PATH=/Wortflip/ npm run build` und einem eigenen Actions-Workflow; die Live-Version läuft auf Netlify.           |

**Unterpfad (zum Beispiel GitHub Pages unter `https://name.github.io/wortflip/`)**: Der Basispfad wird beim Build gesetzt:

```bash
BASE_PATH=/wortflip/ npm run build
```

Manifest, Service Worker, Icons und Schriften werden dann relativ zu diesem Pfad ausgeliefert.

**Live:** https://wortflip.netlify.app

### PWA und neue Versionen

`vite-plugin-pwa` erzeugt `manifest.webmanifest` und `sw.js` (Workbox, `generateSW`). Alle Assets (`js`, `css`, `html`, `svg`, `png`, `woff2`) werden vorab gecacht, darum funktioniert die App nach dem ersten Besuch komplett offline.

Neue Versionen werden mit `registerType: 'prompt'` behandelt: Der neue Service Worker wird im Hintergrund installiert, aktiviert sich aber erst, wenn die Nutzerin auf **Aktualisieren** tippt (`src/pwa/ReloadPrompt.tsx`). So wird keine laufende Lernrunde durch einen überraschenden Reload unterbrochen. Alte Caches werden beim Aktivieren automatisch bereinigt (`cleanupOutdatedCaches`).

Der gespeicherte Zustand trägt eine `version`. Beim Laden wird jeder Teil validiert (`src/learning/storage.ts`): Ungültige oder beschädigte Einträge werden einzeln durch Standardwerte ersetzt, statt die App zum Absturz zu bringen. Spätere Schema-Änderungen bekommen dort eine Migration.

## Projektstruktur

```
├── index.html                 Einstieg, Meta-Tags, Manifest-Verknüpfung
├── vite.config.ts             Vite, Tailwind, PWA (Manifest + Workbox), Vitest
├── scripts/generate-icons.mjs Erzeugt public/icons/*.png und favicon.svg ohne Abhängigkeiten
├── scripts/import-vocabulary.mjs  Import aus Wiktionary + Tatoeba (Parser in scripts/import/, mit Tests)
├── public/                    Icons, favicon.svg
└── src/
    ├── data/                  Datenschicht (unabhängig von der UI)
    │   ├── types.ts           VocabularyItem, VocabularyDataset, VocabularySource
    │   ├── vocabulary/        Wortschatz: a1.ts, a2.ts, b1.ts (handgeschrieben), imported.json (generiert) + imported.ts (Wrapper)
    │   └── index.ts           dataset, Hilfsfunktionen (headword, pluralForm, itemsForLevels, validateDataset)
    ├── learning/              Lernlogik, reine Funktionen ohne React
    │   ├── scheduler.ts       Spaced Repetition (Stufen, Intervalle, „gemeistert“)
    │   ├── session.ts         Rundenaufbau, Warteschlange, Wiedereinreihen nach links-Wisch
    │   ├── streak.ts          Tägliche Serie
    │   ├── stats.ts           Trefferquote, Antworten pro Tag
    │   ├── storage.ts         localStorage-Zugriff mit Validierung und Standardwerten
    │   ├── time.ts            Kalendertag-Helfer (DST-sicher)
    │   └── *.test.ts          Unit-Tests (Vitest)
    ├── state/                 App-Zustand: Reducer + React-Context, speichert bei jeder Änderung
    ├── hooks/                 useTab (Hash-Routing), useReducedMotion
    ├── components/            Wiederverwendbare UI: Button, Chip, Window, StatTile, ProgressBar,
    │                          Flashcard (Vorder-/Rückseite), SwipeableCard (Gesten + Flip),
    │                          ActionButtons, BottomNav, ConfirmDialog, LevelPicker, ResetButton, WordRow, ...
    ├── screens/               Onboarding, Lernen, Wörter (Liste + Suche), Fortschritt, Schwierig, Einstellungen
    ├── pwa/ReloadPrompt.tsx   Hinweis auf neue Version / Offline-Bereitschaft
    ├── lib/                   cn(), Formatierungshelfer
    ├── assets/fonts/          Rubik + Space Mono (SIL OFL), lokal gebündelt
    └── index.css              Tailwind-Theme (Design-Tokens), Flip-Animation, Muster
```

Die Trennung ist bewusst strikt: `src/data` und `src/learning` importieren nichts aus `src/components` oder `src/screens`. Die Screens lesen den Zustand über `useApp()` und lösen Aktionen aus; die Regeln stecken im Reducer und in `src/learning`.

## Spaced Repetition

Jedes Wort hat einen Lernstand (`WordProgress`) mit einer **Stufe** (`box`), einem Fälligkeitsdatum (`dueAt`) und Zählern.

| Ereignis                                   | Wirkung                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Wort noch nie gesehen                      | Status `new`, kein Eintrag im Speicher.                                                          |
| „Kenne ich“ auf Stufe *n*                  | Stufe *n + 1*; fällig nach 1, 3, 7, 14 oder 30 Tagen. Status `learning`.                         |
| „Kenne ich“ auf der letzten Stufe          | Status `mastered`; das Wort kommt weiterhin alle 30 Tage.                                        |
| „Noch lernen“                              | Zurück auf Stufe 0, sofort fällig, `incorrect + 1`, Serie des Wortes auf 0. Status `learning`.  |
| „Kenne ich“, obwohl noch nicht fällig      | Zählt als richtige Antwort, verändert aber Stufe und Fälligkeit **nicht** (Extra-Runde).          |

Innerhalb einer Runde:

- Eine Runde besteht aus fälligen Wörtern (zuerst) und neuen Wörtern (gemischt), begrenzt durch die Rundengröße (10, 20 oder 30).
- Fällige Wörter werden nach Schwierigkeit und Überfälligkeit sortiert. Ab **3** „Noch lernen“-Antworten gilt ein Wort als **schwierig**.
- Ein nach links gewischtes Wort wird **5 Karten später** wieder eingereiht, ein schwieriges Wort schon nach **3** Karten. Solange andere Karten übrig sind, erscheint dasselbe Wort nie zweimal direkt hintereinander.
- Die Runde ist beendet, wenn jede Karte einmal mit „Kenne ich“ beantwortet wurde.
- Ist nichts fällig und nichts neu, bietet die App eine **Extra-Runde** mit den nächsten fälligen Wörtern an. Der Schwierig-Screen startet eine **Fokus-Runde** mit den meistverfehlten Wörtern.

Die **Serie** zählt Kalendertage mit mindestens einer Antwort; ein ausgelassener Tag setzt sie auf 0 (die beste Serie bleibt gespeichert).

## Neustart und Zurücksetzen

- **Runde neu starten** (Symbol oben rechts im Lern-Screen): Die aktuelle Runde wird verworfen und neu zusammengestellt. Bereits gegebene Antworten bleiben gespeichert.
- **Fortschritt zurücksetzen** (Einstellungen und Fortschritt-Screen): Lernstand, Serie und Statistiken werden gelöscht. Level und Rundengröße bleiben.
- **Alles löschen und neu starten** (Einstellungen und Fortschritt-Screen): Alles wird gelöscht, die App beginnt wieder beim Onboarding.

Jede dieser Aktionen fragt vorher nach einer Bestätigung.

## Wortschatz erweitern

Der Wortschatz liegt in `src/data/vocabulary/` als typisierte Arrays, eine Datei pro Level. Ein größerer, kuratierter Datensatz kann diese Dateien ersetzen oder ergänzen; die Oberfläche kennt nur `dataset` aus `src/data/index.ts`.

```ts
type VocabularyItem = {
  id: string;                      // stabil: der Lernstand wird unter dieser id gespeichert
  word: string;                    // "Tisch", "gehen", "sich erinnern"
  article?: 'der' | 'die' | 'das'; // nur Nomen
  plural?: string;                 // ohne Artikel; weglassen bei Singularwörtern
  type: 'noun' | 'verb' | 'adjective' | 'adverb' | 'preposition' | 'conjunction' | 'other';
  level: 'A1' | 'A2' | 'B1';
  definitionDe: string;
  exampleDe: string;
  verbForms?: { thirdPersonPresent?: string; preterite?: string; participleII?: string };
  adjectiveForms?: { comparative?: string; superlative?: string };
  sourceIds?: string[];            // verweist auf dataset.sources[].id
};
```

**Quellenangaben:** `dataset.origin` und `dataset.sources` werden im Einstellungs-Screen unter „Datenquellen“ angezeigt. Der mitgelieferte Datensatz ist handgeschrieben und nennt darum keine Quelle. Wer Einträge aus dem [Deutschen Wiktionary](https://de.wiktionary.org) (CC BY-SA 4.0) oder [Tatoeba](https://tatoeba.org) (CC BY 2.0 FR, Autor pro Satz nennen) importiert, trägt die Quelle in `dataset.sources` ein und verweist pro Eintrag über `sourceIds` darauf. `validateDataset()` prüft Duplikate, fehlende Artikel und unbekannte Quellen (`npm test`).

### Import aus Wiktionary und Tatoeba

`npm run import` holt Wörter aus zwei freien Quellen und schreibt sie nach `src/data/vocabulary/imported.json` (die Datei `imported.ts` daneben ist nur ein typisierter Wrapper):

- **Deutsches Wiktionary** (MediaWiki-API): Artikel, Plural, Verbformen, Komparativ/Superlativ und die erste Bedeutung. Lizenz CC BY-SA 4.0.
- **Tatoeba** (API): ein kurzer Beispielsatz pro Wort mit Autor. Lizenz CC BY 2.0 FR, der Autor steht auf jeder Karte.

```bash
npm run import -- --list scripts/import/wordlist-test.txt        # eigene Liste: ein Wort pro Zeile, optional mit Level
npm run import -- --frequency 2000 --a1 500 --a2 1200             # die 2000 häufigsten Wörter, Level nach Häufigkeit
npm run import -- --list liste.txt --merge --override-level       # zu den vorhandenen Importen hinzufügen, Level aus der Liste
npm run import -- --frequency 300 --no-sentences --dry-run        # nur anzeigen, nichts schreiben
IMPORT_CONTACT="deine@mail.de" npm run import -- --list ...       # Kontakt für den User-Agent (Wikimedia bittet darum)
```

**Wortlisten mit offiziellen Levels:** Die Goethe-Institut-Wortlisten (A1, A2, B1) eignen sich als Auswahl, welche Wörter zu welchem Level gehören. `scripts/import/goethe-to-wordlist.mjs` macht aus solchen Listen (CSV oder TSV, erste Spalte das Stichwort) eine Importliste, in der jedes Wort einmal mit seinem niedrigsten Level steht. Nur die Stichwörter werden verwendet; Beispielsätze, Übersetzungen und Audio aus diesen Listen sind urheberrechtlich geschützt und werden nie kopiert. Die Listen selbst gehören nicht ins Repository (sie liegen unter `scripts/.cache/`).

```bash
node scripts/import/goethe-to-wordlist.mjs --out scripts/.cache/goethe.txt --in a1/*.tsv A1 --in a2/*.tsv A2 --in b1.csv B1
npm run import -- --list scripts/.cache/goethe.txt --merge --override-level
```

Das Skript läuft nur auf deinem Rechner, nie in der App und nie im Netlify-Build. Es fragt langsam an (Tatoeba: eine Anfrage pro Sekunde; Wiktionary: 30 Seiten alle drei Sekunden), wartet bei einer 429-Antwort so lange, wie der Server es verlangt, speichert alle Antworten in `scripts/.cache/` (weitere Läufe sind dadurch fast kostenlos) und überspringt Wörter, die es schon in den handgeschriebenen Dateien gibt. Ein Lauf mit 3000 Wörtern dauert etwa 35 Minuten. Im Häufigkeitsmodus werden gebeugte Formen („geht“, „Tische“) über Wiktionary auf ihre Grundform zurückgeführt; die Rangliste stammt aus dem frei verfügbaren Projekt FrequencyWords (OpenSubtitles) und dient nur zum Sortieren.

Was der Import kann und was nicht:

- Formen sind zuverlässig, Beispielsätze meist kurz und natürlich.
- Wiktionary-Definitionen sind für Erwachsene geschrieben, nicht in einfachem Lernerdeutsch, und die erste Bedeutung ist nicht immer die Alltagsbedeutung (bei „Bahn“ steht zum Beispiel die physikalische Bahn vor der Eisenbahn). Wer eine importierte Karte verbessern will, schreibt das Wort in eine der Level-Dateien; beim nächsten Import wird es dann übersprungen.
- Die Einstellungen zeigen unter „Datenquellen“ automatisch, welche Quellen verwendet werden, und jede importierte Karte nennt ihre Quelle.
- Der mitgelieferte Import (2400 Einträge) wurde mit den Goethe-Listen als Auswahl erzeugt; Wörter, die es schon handgeschrieben gibt, wurden übersprungen. Ein Häufigkeitsmodus (`--frequency`) existiert ebenfalls, liefert aber gelegentlich seltene Grundformen (etwa „wassern“ statt „Wasser“) und wird darum nicht für den ausgelieferten Datensatz verwendet.

Bei sehr großen Datensätzen empfiehlt sich ein dynamischer Import (`import('./vocabulary/large')`), damit die Daten als eigener, weiterhin vorab gecachter Chunk geladen werden.

## Bedienung und Barrierefreiheit

- **Tastatur:** `Leertaste`/`Enter` dreht die Karte um, `←` = „Noch lernen“, `→` = „Kenne ich“. Alle Bedienelemente sind per Tab erreichbar und haben sichtbare Fokusrahmen.
- **Gesten:** Pointer Events, daher identisches Verhalten bei Touch und Maus. Während der Flip-Animation und vor dem Umdrehen ist Wischen gesperrt (die Karte „federt“ nur leicht und weist auf das Umdrehen hin).
- **Bewegung:** `prefers-reduced-motion` schaltet Flip-, Wisch- und Einblendanimationen ab.
- **Farben:** Bedeutungen werden nie nur über Farbe vermittelt; Stempel, Buttons und Legenden tragen immer Text und/oder Symbol. Der Kontrast von Schwarz auf Gelb und Weiß liegt weit über AA.

## Lizenzen

Die gebündelten Schriften Rubik und Space Mono stehen unter der SIL Open Font License 1.1 (siehe `src/assets/fonts/LICENSE.md`).
