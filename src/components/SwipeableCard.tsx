import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { headword, WORD_TYPE_LABELS, type VocabularyItem } from '../data';
import type { Rating } from '../learning/types';
import { cn } from '../lib/cn';
import { FlashcardBack, FlashcardFront } from './Flashcard';
import { CheckIcon, CrossIcon } from './Icons';

export type CardFace = 'front' | 'back';

interface SwipeableCardProps {
  item: VocabularyItem;
  face: CardFace;
  /** Rating is only allowed once the back was shown at least once. */
  revealed: boolean;
  /** While the flip animation runs, gestures are ignored. */
  flipping: boolean;
  flipDurationMs: number;
  /** When set, the card flies out in that direction and then calls `onExited`. */
  exiting: Rating | null;
  reducedMotion: boolean;
  onFlip: () => void;
  onSwipe: (rating: Rating) => void;
  onExited: () => void;
  /** Called when the user tries to swipe before revealing the answer. */
  onBlockedSwipe: () => void;
  cardRef?: React.RefObject<HTMLDivElement | null>;
}

const SWIPE_DISTANCE_PX = 110;
const SWIPE_VELOCITY = 0.55; // px per ms
const TAP_MAX_MOVE_PX = 8;
const TAP_MAX_MS = 400;
const MAX_ROTATION_DEG = 14;
const EXIT_MS = 320;
const EXIT_REDUCED_MS = 120;

interface DragState {
  active: boolean;
  pointerId: number;
  startX: number;
  startY: number;
  startedAt: number;
  dx: number;
  dy: number;
  moved: boolean;
  samples: { t: number; x: number }[];
}

const idleDrag = (): DragState => ({
  active: false,
  pointerId: -1,
  startX: 0,
  startY: 0,
  startedAt: 0,
  dx: 0,
  dy: 0,
  moved: false,
  samples: [],
});

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Horizontal velocity over the last ~100 ms of movement. */
function velocity(samples: { t: number; x: number }[]): number {
  const last = samples[samples.length - 1];
  if (!last) return 0;
  const reference = samples.find((s) => last.t - s.t <= 100) ?? samples[0];
  if (!reference || last.t === reference.t) return 0;
  return (last.x - reference.x) / (last.t - reference.t);
}

export function SwipeableCard({
  item,
  face,
  revealed,
  flipping,
  flipDurationMs,
  exiting,
  reducedMotion,
  onFlip,
  onSwipe,
  onExited,
  onBlockedSwipe,
  cardRef,
}: SwipeableCardProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const leftStampRef = useRef<HTMLDivElement>(null);
  const rightStampRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState>(idleDrag());
  const frame = useRef(0);
  const [dragging, setDragging] = useState(false);

  // Keep the latest callbacks without re-running effects.
  const callbacks = useRef({ onExited, onBlockedSwipe });
  callbacks.current = { onExited, onBlockedSwipe };

  const setRoot = (el: HTMLDivElement | null) => {
    rootRef.current = el;
    if (cardRef) cardRef.current = el;
  };

  const paint = (dx: number, dy: number, showStamps: boolean) => {
    const el = rootRef.current;
    if (!el) return;
    const rotation = clamp(dx / 12, -MAX_ROTATION_DEG, MAX_ROTATION_DEG);
    el.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${rotation}deg)`;
    const strength = showStamps ? clamp(Math.abs(dx) / SWIPE_DISTANCE_PX, 0, 1) : 0;
    if (leftStampRef.current) leftStampRef.current.style.opacity = dx < 0 ? String(strength) : '0';
    if (rightStampRef.current) rightStampRef.current.style.opacity = dx > 0 ? String(strength) : '0';
  };

  const snapBack = () => {
    const el = rootRef.current;
    if (!el) return;
    el.style.transition = reducedMotion ? 'none' : 'transform 360ms cubic-bezier(0.2, 0.9, 0.3, 1.25)';
    el.style.transform = '';
    for (const stamp of [leftStampRef.current, rightStampRef.current]) {
      if (stamp) {
        stamp.style.transition = 'opacity 200ms ease-out';
        stamp.style.opacity = '0';
      }
    }
  };

  const cancelFrame = () => {
    if (frame.current) {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    }
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (exiting || flipping || drag.current.active) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const now = performance.now();
    drag.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startedAt: now,
      dx: 0,
      dy: 0,
      moved: false,
      samples: [{ t: now, x: event.clientX }],
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    const el = rootRef.current;
    if (el) el.style.transition = 'none';
    for (const stamp of [leftStampRef.current, rightStampRef.current]) {
      if (stamp) stamp.style.transition = 'none';
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d.active || event.pointerId !== d.pointerId) return;
    const dx = event.clientX - d.startX;
    const dy = event.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) > TAP_MAX_MOVE_PX) {
      d.moved = true;
      setDragging(true);
    }
    d.dx = dx;
    d.dy = dy;
    d.samples.push({ t: performance.now(), x: event.clientX });
    if (d.samples.length > 8) d.samples.shift();
    if (!d.moved) return;

    // Before the answer is revealed the card only nudges with heavy resistance,
    // which signals "flip first" without letting an accidental swipe rate the word.
    const x = revealed ? dx : Math.sign(dx) * Math.min(Math.abs(dx) * 0.15, 22);
    const y = revealed ? dy * 0.35 : dy * 0.08;
    if (!frame.current) {
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        paint(x, y, revealed);
      });
    }
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = drag.current;
    if (!d.active || event.pointerId !== d.pointerId) return;
    d.active = false;
    setDragging(false);
    cancelFrame();
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // The capture may already be gone (e.g. pointercancel); nothing to do.
    }

    if (!d.moved) {
      if (!cancelled && performance.now() - d.startedAt < TAP_MAX_MS) onFlip();
      return;
    }

    if (!cancelled && revealed) {
      const width = rootRef.current?.offsetWidth ?? 320;
      const distance = Math.min(SWIPE_DISTANCE_PX, width * 0.4);
      const fast = Math.abs(velocity(d.samples)) > SWIPE_VELOCITY && Math.abs(d.dx) > 32;
      if (Math.abs(d.dx) > distance || fast) {
        onSwipe(d.dx > 0 ? 'good' : 'again');
        return;
      }
    } else if (!cancelled && !revealed && Math.abs(d.dx) > 40) {
      callbacks.current.onBlockedSwipe();
    }
    snapBack();
  };

  // Fly out when the parent decided on a rating (via swipe, button or keyboard).
  useEffect(() => {
    if (!exiting) return;
    const el = rootRef.current;
    if (!el) return;
    const direction = exiting === 'good' ? 1 : -1;
    const stamp = exiting === 'good' ? rightStampRef.current : leftStampRef.current;
    if (stamp) {
      stamp.style.transition = 'opacity 120ms ease-out';
      stamp.style.opacity = '1';
    }
    if (reducedMotion) {
      el.style.transition = `opacity ${EXIT_REDUCED_MS}ms ease-out`;
      el.style.opacity = '0';
    } else {
      const travel = Math.max(window.innerWidth, 480) * 0.75 + 160;
      const lift = drag.current.dy * 0.35 + 30;
      el.style.transition = `transform ${EXIT_MS}ms cubic-bezier(0.3, 0.6, 0.5, 1), opacity ${EXIT_MS}ms ease-in`;
      el.style.transform = `translate3d(${direction * travel}px, ${lift}px, 0) rotate(${direction * 24}deg)`;
      el.style.opacity = '0.85';
    }
    const timer = window.setTimeout(() => callbacks.current.onExited(), (reducedMotion ? EXIT_REDUCED_MS : EXIT_MS) + 20);
    return () => window.clearTimeout(timer);
  }, [exiting, reducedMotion]);

  useEffect(() => cancelFrame, []);

  const label = `${headword(item)}, ${WORD_TYPE_LABELS[item.type]}, Niveau ${item.level}. ${
    face === 'front' ? 'Karte umdrehen mit Enter oder Leertaste.' : 'Rückseite. Pfeil links: noch lernen, Pfeil rechts: kenne ich.'
  }`;

  return (
    <div
      ref={setRoot}
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-pressed={face === 'back'}
      data-face={face}
      data-revealed={revealed}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => endDrag(e, false)}
      onPointerCancel={(e) => endDrag(e, true)}
      className={cn(
        'relative h-full w-full select-none rounded-card outline-offset-4',
        dragging ? 'cursor-grabbing' : 'cursor-pointer',
        !exiting && 'animate-card-in',
      )}
      style={{ touchAction: 'pan-y' }}
    >
      <div className="flip-scene h-full w-full">
        <div
          className="flip-inner"
          data-face={face}
          style={{ '--flip-duration': `${flipDurationMs}ms` } as CSSProperties}
        >
          <div className="flip-face flip-face-front rounded-card border-3 border-black bg-white shadow-hard-lg" aria-hidden={face === 'back'}>
            <FlashcardFront item={item} />
          </div>
          <div className="flip-face flip-face-back rounded-card border-3 border-black bg-white shadow-hard-lg" aria-hidden={face === 'front'}>
            <FlashcardBack item={item} />
          </div>
        </div>
      </div>

      {/* Swipe feedback stamps. Text + icon, so the meaning never depends on color alone. */}
      <div
        ref={leftStampRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-5 flex rotate-[-12deg] items-center gap-1.5 rounded-xl border-3 border-black bg-white px-3 py-1.5 font-mono text-base font-bold tracking-wider shadow-hard-sm opacity-0"
      >
        <CrossIcon size={18} strokeWidth={3.5} />
        NOCH LERNEN
      </div>
      <div
        ref={rightStampRef}
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-5 flex rotate-[12deg] items-center gap-1.5 rounded-xl border-3 border-black bg-yellow px-3 py-1.5 font-mono text-base font-bold tracking-wider shadow-hard-sm opacity-0"
      >
        <CheckIcon size={18} strokeWidth={3.5} />
        KENNE ICH
      </div>
    </div>
  );
}
