import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

type Tone = 'white' | 'yellow' | 'black';

const TONE: Record<Tone, string> = {
  white: 'bg-white text-black',
  yellow: 'bg-yellow text-black',
  black: 'bg-black text-white',
};

interface StatTileProps {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: Tone;
  className?: string;
}

export function StatTile({ label, value, hint, tone = 'white', className }: StatTileProps) {
  return (
    <div className={cn('rounded-2xl border-3 border-black p-3 shadow-hard-sm', TONE[tone], className)}>
      <p className={cn('font-mono text-[11px] font-bold uppercase tracking-wider', tone === 'black' ? 'text-yellow' : 'text-gray')}>
        {label}
      </p>
      <p className="mt-1 text-3xl font-black leading-none tabular-nums">{value}</p>
      {hint && <p className={cn('mt-1 text-xs', tone === 'black' ? 'text-white/80' : 'text-gray')}>{hint}</p>}
    </div>
  );
}
