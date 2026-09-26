import { useMemo } from 'react';
import { FlameIcon } from '../components/Icons';
import { ResetButton } from '../components/ResetButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { StatTile } from '../components/StatTile';
import { Window } from '../components/Window';
import { MASTERED_BOX, REVIEW_INTERVALS_DAYS } from '../learning/scheduler';
import { dueItems } from '../learning/session';
import { accuracy, recentDays } from '../learning/stats';
import { currentStreak } from '../learning/streak';
import { dayKey } from '../learning/time';
import { cn } from '../lib/cn';
import { pluralize, weekdayLabel } from '../lib/format';
import { useApp } from '../state/AppContext';

const BOX_LABELS = ['Jetzt', ...REVIEW_INTERVALS_DAYS.map((d) => (d === 1 ? '1 Tag' : `${d} Tage`))];

export function ProgressScreen() {
  const { state, itemsFor } = useApp();
  const { settings, progress, stats, streak } = state;
  const items = useMemo(() => itemsFor(settings.levels), [settings.levels, itemsFor]);
  const now = Date.now();

  let newCount = 0;
  let learningCount = 0;
  let masteredCount = 0;
  const boxes: number[] = Array.from({ length: MASTERED_BOX + 1 }, () => 0);
  for (const item of items) {
    const p = progress[item.id];
    if (!p) {
      newCount += 1;
      continue;
    }
    if (p.status === 'mastered') masteredCount += 1;
    else learningCount += 1;
    boxes[p.box] = (boxes[p.box] ?? 0) + 1;
  }

  const total = items.length;
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
  const rate = accuracy(stats);
  const streakDays = currentStreak(streak, now);
  const due = dueItems(items, progress, now).length;
  const week = recentDays(stats, now, 7);
  const weekMax = Math.max(1, ...week.map((d) => d.count));
  const today = dayKey(now);
  const circumference = 2 * Math.PI * 40;

  return (
    <div className="px-5 pb-6 pt-5">
      <ScreenHeader eyebrow={`Level ${settings.levels.join(' + ')} · ${pluralize(total, 'Wort', 'Wörter')}`} title="Dein Fortschritt" />

      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Neu" value={newCount} />
        <StatTile label="Lernen" value={learningCount} tone="yellow" />
        <StatTile label="Gemeistert" value={masteredCount} tone="black" />
      </div>

      <Window title="Überblick" className="mt-4">
        <div
          role="img"
          aria-label={`${masteredCount} gemeistert, ${learningCount} in Arbeit, ${newCount} neu`}
          className="flex h-7 w-full overflow-hidden rounded-full border-2 border-black bg-white"
        >
          <div className="h-full bg-black" style={{ width: `${pct(masteredCount)}%` }} />
          <div
            className={cn('stripes-diagonal h-full bg-yellow', masteredCount > 0 && 'border-l-2 border-black')}
            style={{ width: `${pct(learningCount)}%` }}
          />
          {newCount > 0 && (masteredCount > 0 || learningCount > 0) && <div className="h-full border-l-2 border-black" />}
        </div>
        <ul className="mt-3 grid grid-cols-3 gap-2 text-xs font-bold">
          <li className="flex items-center gap-1.5">
            <span className="size-3.5 rounded-sm border-2 border-black bg-black" aria-hidden="true" />
            Gemeistert
          </li>
          <li className="flex items-center gap-1.5">
            <span className="stripes-diagonal size-3.5 rounded-sm border-2 border-black bg-yellow" aria-hidden="true" />
            Lernen
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-3.5 rounded-sm border-2 border-black bg-white" aria-hidden="true" />
            Neu
          </li>
        </ul>
        <p className="mt-3 text-sm text-gray">
          Heute fällig: <b className="text-black">{due}</b> · Antworten gesamt: <b className="text-black">{stats.totalReviews}</b>
        </p>
      </Window>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Window title="Trefferquote" bodyClassName="flex flex-col items-center p-3">
          <svg
            width="104"
            height="104"
            viewBox="0 0 104 104"
            role="img"
            aria-label={rate === null ? 'Noch keine Antworten' : `Trefferquote ${rate} Prozent`}
          >
            <circle cx="52" cy="52" r="40" fill="none" stroke="#FFF4B8" strokeWidth="12" />
            <circle
              cx="52"
              cy="52"
              r="40"
              fill="none"
              stroke="#F2B705"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${(circumference * (rate ?? 0)) / 100} ${circumference}`}
              transform="rotate(-90 52 52)"
            />
            <circle cx="52" cy="52" r="46" fill="none" stroke="#111111" strokeWidth="2.5" />
            <circle cx="52" cy="52" r="34" fill="none" stroke="#111111" strokeWidth="2.5" />
            <text x="52" y="58" textAnchor="middle" fontSize="20" fontWeight="900" fill="#111111" fontFamily="Rubik, sans-serif">
              {rate === null ? '0%' : `${rate}%`}
            </text>
          </svg>
          <p className="mt-2 text-center text-xs text-gray">
            {rate === null ? 'Noch keine Antworten' : `${stats.totalCorrect} von ${stats.totalReviews} richtig`}
          </p>
        </Window>

        <Window title="Serie" bodyClassName="flex flex-col items-center p-3">
          <span className="grid size-14 place-items-center rounded-full border-3 border-black bg-yellow">
            <FlameIcon size={30} className={streakDays > 0 ? 'text-black' : 'text-gray'} />
          </span>
          <p className="mt-2 text-3xl font-black leading-none tabular-nums">{streakDays}</p>
          <p className="text-sm font-bold">{streakDays === 1 ? 'Tag in Folge' : 'Tage in Folge'}</p>
          <p className="mt-1 text-xs text-gray">Beste Serie: {streak.best}</p>
        </Window>
      </div>

      <Window title="Letzte 7 Tage" className="mt-4">
        <div
          role="img"
          aria-label={`Antworten pro Tag: ${week.map((d) => `${weekdayLabel(d.day)} ${d.count}`).join(', ')}`}
          className="flex h-28 items-end gap-2"
        >
          {week.map((d) => (
            <div key={d.day} className="flex flex-1 flex-col items-center justify-end gap-1">
              <span className="font-mono text-[10px] font-bold tabular-nums">{d.count}</span>
              <div
                className={cn(
                  'w-full rounded-t-md border-2 border-black',
                  d.count === 0 ? 'bg-white' : d.day === today ? 'bg-yellow-dark' : 'bg-yellow',
                )}
                style={{ height: `${d.count === 0 ? 6 : 12 + (d.count / weekMax) * 60}px` }}
              />
              <span className={cn('font-mono text-[10px] uppercase', d.day === today ? 'font-bold text-black' : 'text-gray')}>
                {weekdayLabel(d.day)}
              </span>
            </div>
          ))}
        </div>
      </Window>

      <Window title="Stufen" className="mt-4">
        <ol className="grid grid-cols-6 gap-1.5">
          {boxes.map((count, box) => (
            <li
              key={box}
              className={cn(
                'rounded-lg border-2 border-black p-1 text-center',
                box === MASTERED_BOX ? 'bg-black text-white' : box === 0 ? 'bg-yellow-light' : 'bg-white',
              )}
            >
              <span className="block text-lg font-black leading-tight tabular-nums">{count}</span>
              <span className={cn('block font-mono text-[9px] uppercase leading-tight', box === MASTERED_BOX ? 'text-yellow' : 'text-gray')}>
                {BOX_LABELS[box]}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs leading-snug text-gray">
          Jedes „Kenne ich“ hebt ein Wort eine Stufe höher und verlängert die Pause bis zur nächsten Wiederholung. Ein „Noch lernen“ setzt
          es zurück auf „Jetzt“. Wer die letzte Stufe erreicht, gilt als gemeistert.
        </p>
      </Window>

      <Window title="Neustart" className="mt-4">
        <p className="text-sm leading-snug text-gray">
          Du möchtest noch einmal ganz von vorn anfangen? Hier kannst du den Lernstand löschen oder die App komplett zurücksetzen.
        </p>
        <div className="mt-3 flex flex-col gap-3">
          <ResetButton mode="progress" className="w-full" />
          <ResetButton mode="all" variant="dark" className="w-full" />
        </div>
      </Window>
    </div>
  );
}
