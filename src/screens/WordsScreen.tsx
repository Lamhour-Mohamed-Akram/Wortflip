import { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/Button';
import { ChoiceGroup, type Choice } from '../components/ChoiceGroup';
import { EmptyState } from '../components/EmptyState';
import { ExternalLinkIcon, SearchIcon, TargetIcon } from '../components/Icons';
import { ScreenHeader } from '../components/ScreenHeader';
import { WordRow } from '../components/WordRow';
import { dataset, LEVELS, type Level, type VocabularyItem, type WordType } from '../data';
import type { Tab } from '../hooks/useTab';
import { buildSelectionSession } from '../learning/session';
import { cn } from '../lib/cn';
import { pluralize } from '../lib/format';
import { normalizeQuery, normalizeSearch } from '../lib/text';
import { useApp } from '../state/AppContext';

type LevelFilter = Level | 'all';
type TypeFilter = 'all' | 'noun' | 'verb' | 'adjective' | 'adverb' | 'rest';

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'Alle' },
  { value: 'noun', label: 'Nomen' },
  { value: 'verb', label: 'Verben' },
  { value: 'adjective', label: 'Adjektive' },
  { value: 'adverb', label: 'Adverbien' },
  { value: 'rest', label: 'Andere' },
];

const REST_TYPES: readonly WordType[] = ['preposition', 'conjunction', 'other'];
const PAGE_SIZE = 80;

// Built once: the folded text every word is matched against (no network involved).
const INDEX = dataset.items.map((item) => ({
  item,
  word: normalizeSearch(item.word.replace(/^sich /, '')),
  text: normalizeSearch(`${item.word} ${item.plural ?? ''} ${item.definitionDe}`),
}));

const LEVEL_COUNTS = Object.fromEntries(LEVELS.map((level) => [level, dataset.items.filter((i) => i.level === level).length])) as Record<Level, number>;

const LEVEL_CHOICES: readonly Choice<LevelFilter>[] = [
  { value: 'all', label: 'Alle', hint: String(dataset.items.length) },
  ...LEVELS.map((level) => ({ value: level, label: level, hint: String(LEVEL_COUNTS[level]) })),
];

function matchesType(item: VocabularyItem, filter: TypeFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'rest') return REST_TYPES.includes(item.type);
  return item.type === filter;
}

export function WordsScreen({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const { state, dispatch } = useApp();
  const { progress, settings } = state;
  const [level, setLevel] = useState<LevelFilter>(settings.levels.length === 1 ? (settings.levels[0] ?? 'all') : 'all');
  const [type, setType] = useState<TypeFilter>('all');
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE_SIZE);
  const q = normalizeQuery(query);
  const now = Date.now();

  const results = useMemo(() => {
    const scored: { item: VocabularyItem; score: number }[] = [];
    for (const entry of INDEX) {
      if (level !== 'all' && entry.item.level !== level) continue;
      if (!matchesType(entry.item, type)) continue;
      let score = 0;
      if (q) {
        if (entry.word.startsWith(q)) score = 0;
        else if (entry.word.includes(q)) score = 1;
        else if (entry.text.includes(q)) score = 2;
        else continue;
      }
      scored.push({ item: entry.item, score });
    }
    scored.sort((a, b) => a.score - b.score || a.item.word.localeCompare(b.item.word, 'de'));
    return scored.map((s) => s.item);
  }, [level, type, q]);

  useEffect(() => setShown(PAGE_SIZE), [level, type, q]);

  const learnSelection = () => {
    const session = buildSelectionSession(results, progress, settings.sessionSize, Date.now());
    if (!session) return;
    dispatch({ type: 'session/set', session });
    onNavigate('lernen');
  };

  return (
    <div className="px-5 pb-6 pt-5">
      <ScreenHeader eyebrow={`${results.length} von ${pluralize(dataset.items.length, 'Wort', 'Wörtern')}`} title="Wortschatz" />

      <label className="relative block">
        <span className="sr-only">Wort suchen</span>
        <SearchIcon size={20} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray" />
        <input
          type="search"
          inputMode="search"
          autoComplete="off"
          placeholder="Wort oder Bedeutung suchen"
          aria-label="Wort suchen"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-h-12 w-full rounded-2xl border-3 border-black bg-white pl-10 pr-4 text-base font-bold shadow-hard-sm placeholder:font-medium placeholder:text-gray focus:outline-none focus-visible:outline-3 focus-visible:outline-dashed focus-visible:outline-offset-3 focus-visible:outline-black"
        />
      </label>
      <p className="mt-1.5 text-xs text-gray">Die Suche läuft nur auf deinem Gerät, ohne Internet und ohne Server.</p>

      <div className="mt-4">
        <ChoiceGroup name="words-level" legend="Level" options={LEVEL_CHOICES} value={level} onChange={setLevel} columns={3} />
      </div>

      <div className="mt-4" role="group" aria-label="Wortart">
        <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-wider text-gray">Wortart</p>
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
          {TYPE_FILTERS.map((filter) => {
            const active = filter.value === type;
            return (
              <button
                key={filter.value}
                type="button"
                aria-pressed={active}
                onClick={() => setType(filter.value)}
                className={cn(
                  'shrink-0 rounded-xl border-2 border-black px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider transition-colors',
                  active ? 'bg-black text-yellow' : 'bg-white hover:bg-yellow-light',
                )}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      {results.length > 0 && (
        <Button className="mt-4 w-full" onClick={learnSelection}>
          <TargetIcon size={22} />
          Auswahl lernen ({pluralize(Math.min(results.length, settings.sessionSize), 'Karte', 'Karten')})
        </Button>
      )}

      {results.length === 0 ? (
        <div className="pt-8">
          <EmptyState
            icon={<SearchIcon size={36} strokeWidth={3} />}
            title="Kein Wort gefunden"
            text={
              q
                ? `„${query.trim()}“ ist nicht im Wortschatz. Die App sucht nur in den gespeicherten Wörtern, es gibt keine Online-Suche.`
                : 'Für diese Auswahl gibt es keine Wörter.'
            }
            actions={
              q ? (
                <a
                  href={`https://de.wiktionary.org/w/index.php?search=${encodeURIComponent(query.trim())}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border-3 border-black bg-white px-5 font-bold shadow-hard hover:bg-yellow-light"
                >
                  Im Wiktionary nachschlagen
                  <ExternalLinkIcon size={18} />
                </a>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <ul className="mt-4 flex flex-col gap-3" aria-label="Wörterliste">
            {results.slice(0, shown).map((item) => (
              <WordRow key={item.id} item={item} progress={progress[item.id]} now={now} />
            ))}
          </ul>
          {shown < results.length && (
            <Button variant="secondary" className="mt-4 w-full" onClick={() => setShown((n) => n + PAGE_SIZE)}>
              Mehr anzeigen ({results.length - shown} weitere)
            </Button>
          )}
        </>
      )}
    </div>
  );
}
