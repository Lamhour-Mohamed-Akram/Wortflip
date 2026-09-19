import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  text: string;
  actions?: ReactNode;
}

export function EmptyState({ icon, title, text, actions }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 px-2 text-center">
      <div className="grid size-20 rotate-[-4deg] place-items-center rounded-2xl border-3 border-black bg-yellow shadow-hard">
        {icon}
      </div>
      <h2 className="text-2xl font-black leading-tight text-balance">{title}</h2>
      <p className="max-w-xs text-gray text-balance">{text}</p>
      {actions && <div className="mt-1 flex w-full max-w-xs flex-col gap-3">{actions}</div>}
    </div>
  );
}
