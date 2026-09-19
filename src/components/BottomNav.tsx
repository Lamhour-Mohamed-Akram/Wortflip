import type { Tab } from '../hooks/useTab';
import { cn } from '../lib/cn';
import { BookIcon, CardsIcon, ChartIcon, FlameIcon, GearIcon } from './Icons';

const ITEMS: { id: Tab; label: string; Icon: typeof CardsIcon }[] = [
  { id: 'lernen', label: 'Lernen', Icon: CardsIcon },
  { id: 'woerter', label: 'Wörter', Icon: BookIcon },
  { id: 'fortschritt', label: 'Fortschritt', Icon: ChartIcon },
  { id: 'schwierig', label: 'Schwierig', Icon: FlameIcon },
  { id: 'einstellungen', label: 'Mehr', Icon: GearIcon },
];

export function BottomNav({ active, onSelect }: { active: Tab; onSelect: (tab: Tab) => void }) {
  return (
    <nav aria-label="Hauptnavigation" className="shrink-0 border-t-3 border-black bg-white pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-5">
        {ITEMS.map(({ id, label, Icon }) => {
          const current = id === active;
          return (
            <li key={id}>
              <button
                type="button"
                aria-current={current ? 'page' : undefined}
                onClick={() => onSelect(id)}
                className="flex min-h-16 w-full flex-col items-center justify-center gap-1 outline-offset-[-4px]"
              >
                <span
                  className={cn(
                    'grid h-8 w-11 place-items-center rounded-xl border-2 transition-colors',
                    current ? 'border-black bg-yellow shadow-hard-xs' : 'border-transparent text-gray',
                  )}
                >
                  <Icon size={22} />
                </span>
                <span className={cn('font-mono text-[10px] font-bold uppercase tracking-wider', current ? 'text-black' : 'text-gray')}>
                  {label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
