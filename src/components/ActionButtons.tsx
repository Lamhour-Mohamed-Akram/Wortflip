import { cn } from '../lib/cn';
import { CheckIcon, CrossIcon } from './Icons';

interface ActionButtonsProps {
  /** When false the buttons look inactive but still respond (they explain what to do first). */
  enabled: boolean;
  onAgain: () => void;
  onGood: () => void;
}

const BASE =
  'group flex min-w-24 flex-col items-center gap-1.5 rounded-2xl px-2 py-1 outline-offset-2';
const CIRCLE =
  'grid size-16 short:size-14 place-items-center rounded-full border-3 border-black shadow-hard transition-[transform,box-shadow,opacity] duration-100 group-active:translate-x-[3px] group-active:translate-y-[3px] group-active:shadow-hard-xs';
const LABEL = 'flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider';
const KEY = 'hidden rounded border-2 border-black bg-white px-1 py-0.5 font-mono text-[10px] leading-none fine-pointer:inline-block';

export function ActionButtons({ enabled, onAgain, onGood }: ActionButtonsProps) {
  return (
    <div className="flex items-start justify-center gap-6">
      <button type="button" aria-label="Noch lernen" aria-disabled={!enabled} onClick={onAgain} className={BASE}>
        <span className={cn(CIRCLE, 'bg-white', !enabled && 'opacity-40')}>
          <CrossIcon size={30} strokeWidth={3} />
        </span>
        <span className={LABEL}>
          <kbd className={KEY} aria-hidden="true">
            ←
          </kbd>
          Noch lernen
        </span>
      </button>
      <button type="button" aria-label="Kenne ich" aria-disabled={!enabled} onClick={onGood} className={BASE}>
        <span className={cn(CIRCLE, 'bg-yellow', !enabled && 'opacity-40')}>
          <CheckIcon size={30} strokeWidth={3} />
        </span>
        <span className={LABEL}>
          Kenne ich
          <kbd className={KEY} aria-hidden="true">
            →
          </kbd>
        </span>
      </button>
    </div>
  );
}
