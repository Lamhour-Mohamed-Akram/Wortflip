import { cn } from '../lib/cn';

export function Wordmark({ size = 'sm', className }: { size?: 'sm' | 'lg'; className?: string }) {
  const large = size === 'lg';
  return (
    <span className={cn('inline-flex items-center font-black tracking-tight', large ? 'gap-3 text-4xl' : 'gap-2 text-lg', className)}>
      <span
        aria-hidden="true"
        className={cn(
          'grid place-items-center rounded-xl border-black bg-yellow font-mono font-bold text-black',
          large ? 'size-14 rotate-[-6deg] border-3 text-3xl shadow-hard' : 'size-7 rotate-[-6deg] border-2 text-sm shadow-hard-xs',
        )}
      >
        Ä
      </span>
      <span>Wortflip</span>
    </span>
  );
}
