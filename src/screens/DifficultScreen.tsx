import { useMemo } from 'react';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { EmptyState } from '../components/EmptyState';
import { FlameIcon, TargetIcon } from '../components/Icons';
import { ScreenHeader } from '../components/ScreenHeader';
import { WordRow } from '../components/WordRow';
import type { Tab } from '../hooks/useTab';
import { isDifficult } from '../learning/scheduler';
import { buildFocusSession, difficultItems } from '../learning/session';
import { cn } from '../lib/cn';
import { pluralize } from '../lib/format';
import { useApp } from '../state/AppContext';

export function DifficultScreen({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const { state, dispatch, itemsFor } = useApp();
  const { settings, progress } = state;
  const items = useMemo(() => itemsFor(settings.levels), [settings.levels, itemsFor]);
  const list = useMemo(() => difficultItems(items, progress), [items, progress]);
  const focusSize = Math.min(list.length, settings.sessionSize);
  const now = Date.now();

  const startFocus = () => {
    const session = buildFocusSession(items, progress, settings.sessionSize, Date.now());
    if (!session) return;
    dispatch({ type: 'session/set', session });
    onNavigate('lernen');
  };

  return (
    <div className="px-5 pb-6 pt-5">
      <ScreenHeader eyebrow="Wiederholen" title="Schwierige Wörter" />

      {list.length === 0 ? (
        <div className="pt-10">
          <EmptyState
            icon={<FlameIcon size={36} strokeWidth={3} />}
            title="Noch keine schwierigen Wörter"
            text="Wörter, die du mit „Noch lernen“ nach links wischst, sammeln sich hier, sortiert nach Häufigkeit."
            actions={<Button onClick={() => onNavigate('lernen')}>Jetzt lernen</Button>}
          />
        </div>
      ) : (
        <>
          <p className="text-sm text-gray">Diese Wörter hast du am häufigsten nach links gewischt. Übe sie gezielt in einer Fokus-Runde.</p>
          <Button className="mt-4 w-full" onClick={startFocus}>
            <TargetIcon size={22} />
            Fokus-Runde starten ({pluralize(focusSize, 'Karte', 'Karten')})
          </Button>
          <ul className="mt-5 flex flex-col gap-3">
            {list.map((item) => {
              const wordProgress = progress[item.id];
              const misses = wordProgress?.incorrect ?? 0;
              return (
                <WordRow
                  key={item.id}
                  item={item}
                  progress={wordProgress}
                  now={now}
                  showStatus={false}
                  leading={
                    <span
                      className={cn(
                        'grid size-11 shrink-0 place-items-center rounded-xl border-2 border-black font-mono text-sm font-bold',
                        isDifficult(wordProgress) ? 'bg-yellow' : 'bg-yellow-light',
                      )}
                      aria-label={`${misses}-mal noch lernen`}
                    >
                      {misses}×
                    </span>
                  }
                  chips={isDifficult(wordProgress) && <Chip variant="yellow">schwierig</Chip>}
                />
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
