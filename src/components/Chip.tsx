import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn';

type Variant = 'solid' | 'outline' | 'yellow';

const VARIANT: Record<Variant, string> = {
  solid: 'bg-black text-yellow',
  outline: 'bg-white text-black',
  yellow: 'bg-yellow text-black',
};

export function Chip({ variant = 'outline', className, ...props }: HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border-2 border-black px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase leading-none tracking-wider',
        VARIANT[variant],
        className,
      )}
      {...props}
    />
  );
}
