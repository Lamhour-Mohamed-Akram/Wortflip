import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

interface WindowProps {
  title: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Heading level for the title bar label. */
  titleAs?: 'h2' | 'h3';
}

/** A retro "window" panel: pin-striped title bar with a label chip, black frame and offset shadow. */
export function Window({ title, children, className, bodyClassName, titleAs: Title = 'h2' }: WindowProps) {
  return (
    <section className={cn('overflow-hidden rounded-2xl border-3 border-black bg-white shadow-hard', className)}>
      <div className="stripes-black flex items-center gap-2 border-b-3 border-black bg-yellow px-3 py-1.5">
        <span className="flex gap-1" aria-hidden="true">
          <i className="block size-2.5 rounded-full border-2 border-black bg-white" />
          <i className="block size-2.5 rounded-full border-2 border-black bg-white" />
          <i className="block size-2.5 rounded-full border-2 border-black bg-white" />
        </span>
        <Title className="mx-auto rounded-md border-2 border-black bg-white px-2 py-0.5 font-mono text-[11px] font-bold uppercase leading-none tracking-wider">
          {title}
        </Title>
        <span className="w-[42px]" aria-hidden="true" />
      </div>
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>
  );
}
