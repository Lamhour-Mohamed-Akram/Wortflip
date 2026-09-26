import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ActionButtons } from '../components/ActionButtons';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { EmptyState } from '../components/EmptyState';
import { InstallCard } from '../components/InstallCard';
import { CheckIcon, ClockIcon, FlameIcon, RepeatIcon, TrophyIcon } from '../components/Icons';
import { ProgressBar } from '../components/ProgressBar';
import { StatTile } from '../components/StatTile';
import { SwipeableCard, type CardFace } from '../components/SwipeableCard';
import { Window } from '../components/Window';
import { Wordmark } from '../components/Wordmark';
import type { VocabularyItem } from '../data';
import { useReducedMotion } from '../hooks/useReducedMotion';
import type { Tab } from '../hooks/useTab';
import {
  buildDailySession,
  buildExtraSession,
  currentCardId,
  dueItems,
  newItems,
  remainingDistinct,
  upcomingItems,
} from '../learning/session';
import { currentStreak } from '../learning/streak';
import type { Rating, SessionKind } from '../learning/types';
import { cn } from '../lib/cn';
import { formatRelativeDay, pluralize } from '../lib/format';
import { useApp } from '../state/AppContext';

const SESSION_LABEL: Record<SessionKind, string> = {
  daily: 'Tagesrunde',
  extra: 'Extra-Runde',
  focus: 'Fokus-Runde',
  custom: 'Auswahl',
};

const SHORT_LABEL: Record<SessionKind, string> = { daily: 'Tag', extra: 'Extra', focus: 'Fokus', custom: 'Auswahl' };

const FLIP_MS = 450;

export function LearnScreen({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const { state, dispatch, itemsFor, byId } = useApp();
  const { settings, progress, session, streak } = state;
  const items = useMemo(() => itemsFor(settings.levels), [settings.levels, itemsFor]);
  const now = Date.now();
  const streakDays = currentStreak(streak, now);
  const [confirmRestart, setConfirmRestart] = useState(false);

  // Start a daily session automatically whenever none is running.
  useEffect(() => {
    if (session) return;
    const next = buildDailySession(items, progress, settings.sessionSize, Date.now());
    if (next) dispatch({ type: 'session/set', session: next });
  }, [session, items, progress, settings.sessionSize, dispatch]);

  const startExtra = () => {
    const next = buildExtraSession(items, progress, settings.sessionSize, Date.now());
    if (next) dispatch({ type: 'session/set', session: next });
  };

  if (!session) {
    const available = dueItems(items, progress, now).length + newItems(items, progress).length;
    // The effect above is about to start a session; render nothing for that frame.
    if (available > 0) return null;

    const upcoming = upcomingItems(items, progress, now);
    const first = upcoming[0];
    const nextDue = first ? (progress[first.id]?.dueAt ?? null) : null;
    return (
      <div className="flex h-full flex-col">
        <Header streakDays={streakDays} />
        <div className="flex flex-1 items-center justify-center p-6">
          <EmptyState
            icon={<CheckIcon size={36} strokeWidth={3.5} />}
            title="Alles geschafft für heute!"
            text={
              nextDue !== null
                ? `Die nächste Wiederholung ist ${formatRelativeDay(nextDue, now)}. Komm dann wieder, oder übe jetzt schon vor.`
                : 'Für dieses Level gibt es gerade nichts zu lernen. Wähle ein anderes Level, um weiterzumachen.'
            }
            actions={
              <>
                {upcoming.length > 0 && (
                  <Button onClick={startExtra}>
                    <ClockIcon size={20} />
                    Extra-Runde starten
                  </Button>
                )}
                <Button variant="secondary" onClick={() => onNavigate('einstellungen')}>
                  Level ändern
                </Button>
              </>
            }
          />
        </div>
      </div>
    );
  }

  const currentId = currentCardId(session);
  const item = currentId ? byId.get(currentId) : undefined;
  const cleared = session.total - remainingDistinct(session);

  if (!item) {
    const answered = session.correct + session.incorrect;
    const pct = answered > 0 ? Math.round((session.correct / answered) * 100) : 0;
    return (
      <div className="flex h-full flex-col">
        <Header streakDays={streakDays} />
        <div className="flex flex-1 items-center p-5">
          <Window title="Runde geschafft" className="w-full animate-pop-in">
            <div className="text-center">
              <div className="mx-auto grid size-16 rotate-[-6deg] place-items-center rounded-2xl border-3 border-black bg-yellow shadow-hard-sm">
                <TrophyIcon size={32} />
              </div>
              <h2 className="mt-4 text-2xl font-black">Runde geschafft!</h2>
              <p className="mt-1 text-gray">
                {pluralize(session.total, 'Karte', 'Karten')} · {pluralize(answered, 'Antwort', 'Antworten')} · {pct} % richtig
              </p>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <StatTile label="Kenne ich" value={session.correct} tone="yellow" />
              <StatTile label="Noch lernen" value={session.incorrect} />
              <StatTile label="Serie" value={streakDays} hint={streakDays === 1 ? 'Tag' : 'Tage'} tone="black" />
            </div>
            <div className="mt-5 flex flex-col gap-3">
              <Button onClick={() => dispatch({ type: 'session/set', session: null })}>Weiter lernen</Button>
              <Button variant="secondary" onClick={() => onNavigate('fortschritt')}>
                Fortschritt ansehen
              </Button>
            </div>
            <InstallCard compact className="mt-4" />
          </Window>
        </div>
      </div>
    );
  }

  return (
    // min-h-full instead of h-full: a long card back makes the screen scroll rather than the card.
    <div className="flex min-h-full flex-col">
      <Header
        streakDays={streakDays}
        kind={session.kind}
        remaining={session.queue.length}
        cleared={cleared}
        total={session.total}
        onRestart={() => setConfirmRestart(true)}
      />
      <CardPlayer
        key={`${item.id}:${session.correct + session.incorrect}`}
        item={item}
        remaining={session.queue.length}
        onRate={(rating) => dispatch({ type: 'review', id: item.id, rating, now: Date.now() })}
      />
      <ConfirmDialog
        open={confirmRestart}
        title="Runde neu starten?"
        description="Die Karten werden neu zusammengestellt. Deine bisherigen Antworten bleiben gespeichert."
        confirmLabel="Ja, neu starten"
        onCancel={() => setConfirmRestart(false)}
        onConfirm={() => {
          dispatch({ type: 'session/set', session: null });
          setConfirmRestart(false);
        }}
      />
    </div>
  );
}

interface HeaderProps {
  streakDays: number;
  kind?: SessionKind;
  remaining?: number;
  cleared?: number;
  total?: number;
  onRestart?: () => void;
}

function Header({ streakDays, kind, remaining, cleared, total, onRestart }: HeaderProps) {
  return (
    <header className="shrink-0 px-5 pt-4">
      <div className="flex items-center justify-between gap-2">
        <Wordmark />
        <div className="flex items-center gap-2">
          {onRestart && (
            <button
              type="button"
              onClick={onRestart}
              aria-label="Runde neu starten"
              title="Runde neu starten"
              className="grid size-8 place-items-center rounded-lg border-2 border-black bg-white shadow-hard-xs transition-[transform,box-shadow] duration-100 hover:bg-yellow-light active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              <RepeatIcon size={16} />
            </button>
          )}
          <span
            className="inline-flex h-8 items-center gap-1 rounded-lg border-2 border-black bg-white px-2 font-mono text-xs font-bold shadow-hard-xs"
            title="Tage in Folge gelernt"
          >
            <FlameIcon size={16} className={streakDays > 0 ? 'text-yellow-dark' : 'text-gray'} />
            <span className="sr-only">Serie: </span>
            {streakDays}
            <span className="sr-only"> {streakDays === 1 ? 'Tag' : 'Tage'}</span>
          </span>
        </div>
      </div>
      {kind && total !== undefined && cleared !== undefined && remaining !== undefined && (
        <>
          <div className="mt-3 flex items-center gap-3">
            <ProgressBar value={cleared} max={total} label="Fortschritt der Runde" />
            <span className="shrink-0 font-mono text-xs font-bold tabular-nums">
              <span className="hidden short:inline">{SHORT_LABEL[kind]} · </span>
              {cleared}/{total}
              <span className="hidden short:inline"> · noch {remaining}</span>
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between short:hidden">
            <Chip variant="yellow">{SESSION_LABEL[kind]}</Chip>
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-gray">
              Noch {pluralize(remaining, 'Karte', 'Karten')}
            </span>
          </div>
        </>
      )}
    </header>
  );
}

interface CardPlayerProps {
  item: VocabularyItem;
  remaining: number;
  onRate: (rating: Rating) => void;
}

/** Owns the per-card UI state: which face is up, whether rating is allowed, and the exit animation. */
function CardPlayer({ item, remaining, onRate }: CardPlayerProps) {
  const reducedMotion = useReducedMotion();
  const flipMs = reducedMotion ? 0 : FLIP_MS;
  const [face, setFace] = useState<CardFace>('front');
  const [revealed, setRevealed] = useState(false);
  const [flipping, setFlipping] = useState(false);
  const [exiting, setExiting] = useState<Rating | null>(null);
  const [hint, setHint] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const hintTimer = useRef(0);

  const showHint = useCallback(() => {
    setHint(true);
    window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setHint(false), 1600);
  }, []);

  const flip = useCallback(() => {
    if (exiting || flipping) return;
    setFace((current) => (current === 'front' ? 'back' : 'front'));
    setRevealed(true);
    setHint(false);
    if (flipMs > 0) {
      setFlipping(true);
      window.setTimeout(() => setFlipping(false), flipMs);
    }
  }, [exiting, flipping, flipMs]);

  const rate = useCallback(
    (rating: Rating) => {
      if (exiting || flipping) return;
      if (!revealed) {
        showHint();
        return;
      }
      setExiting(rating);
    },
    [exiting, flipping, revealed, showHint],
  );

  // Keyboard: Space/Enter flips, arrow keys rate.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest('dialog, input, textarea, select')) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        rate('again');
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        rate('good');
      } else if (event.key === ' ' || event.key === 'Enter') {
        // Buttons and links keep their native behaviour; the card itself is handled here.
        if (target && target !== cardRef.current && target.closest('button, a, [role="button"]')) return;
        event.preventDefault();
        flip();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [flip, rate]);

  // Keep keyboard users on the card when the next one appears.
  useEffect(() => {
    if (document.activeElement === document.body) cardRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => () => window.clearTimeout(hintTimer.current), []);

  const status = hint ? 'Erst umdrehen, dann bewerten' : revealed ? 'Wischen, tippen oder Pfeiltasten' : '';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 items-center justify-center px-7 pb-7 pt-4 short:px-6 short:pb-5 short:pt-2">
        <div className={cn('relative w-full max-w-[21rem]', hint && 'animate-wiggle')}>
          {remaining > 2 && (
            <div aria-hidden="true" className="absolute inset-0 translate-x-3 translate-y-3 rotate-[3deg] rounded-card border-3 border-black bg-yellow" />
          )}
          {remaining > 1 && (
            <div aria-hidden="true" className="absolute inset-0 translate-x-1.5 translate-y-1.5 rotate-[-1.5deg] rounded-card border-3 border-black bg-yellow-light" />
          )}
          <SwipeableCard
            item={item}
            face={face}
            revealed={revealed}
            flipping={flipping}
            flipDurationMs={flipMs}
            exiting={exiting}
            reducedMotion={reducedMotion}
            onFlip={flip}
            onSwipe={rate}
            onExited={() => {
              if (exiting) onRate(exiting);
            }}
            onBlockedSwipe={showHint}
            cardRef={cardRef}
          />
        </div>
      </div>
      <p className="h-5 shrink-0 text-center font-mono text-[11px] font-bold uppercase tracking-wider text-gray" aria-live="polite">
        {status}
      </p>
      <div className="shrink-0 px-5 pb-4 pt-2 short:pb-2 short:pt-1">
        <ActionButtons enabled={revealed && !exiting && !flipping} onAgain={() => rate('again')} onGood={() => rate('good')} />
      </div>
    </div>
  );
}
