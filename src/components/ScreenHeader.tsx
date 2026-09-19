import type { ReactNode } from 'react';

interface ScreenHeaderProps {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}

export function ScreenHeader({ eyebrow, title, children }: ScreenHeaderProps) {
  return (
    <header className="mb-4 flex items-end justify-between gap-3">
      <div>
        <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-gray">{eyebrow}</p>
        <h1 className="text-3xl font-black leading-tight">{title}</h1>
      </div>
      {children}
    </header>
  );
}
