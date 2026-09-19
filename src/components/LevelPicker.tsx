import { LEVEL_HINTS, LEVELS, type Level } from '../data';
import { cn } from '../lib/cn';
import { CheckIcon } from './Icons';

interface LevelPickerProps {
  name: string;
  value: readonly Level[];
  onChange: (levels: Level[]) => void;
  legend?: string;
}

/** Multi-select level tiles (native checkboxes). At least one level always stays selected. */
export function LevelPicker({ name, value, onChange, legend = 'Level' }: LevelPickerProps) {
  const toggle = (level: Level) => {
    const next = value.includes(level) ? value.filter((l) => l !== level) : [...value, level];
    if (next.length === 0) return;
    onChange(LEVELS.filter((l) => next.includes(l)));
  };

  return (
    <fieldset>
      <legend className="mb-2 font-mono text-[11px] font-bold uppercase tracking-wider text-gray">{legend}</legend>
      <div className="grid grid-cols-3 gap-2.5">
        {LEVELS.map((level) => {
          const checked = value.includes(level);
          return (
            <label
              key={level}
              className={cn(
                'flex min-h-14 cursor-pointer flex-col items-center justify-center rounded-xl border-3 border-black px-2 py-2 text-center transition-[transform,box-shadow,background-color] duration-100',
                'has-focus-visible:outline-3 has-focus-visible:outline-dashed has-focus-visible:outline-offset-3 has-focus-visible:outline-black',
                checked ? 'bg-yellow shadow-hard' : 'bg-white shadow-hard-xs hover:bg-yellow-light',
              )}
            >
              <input type="checkbox" name={name} value={level} checked={checked} onChange={() => toggle(level)} className="sr-only" />
              <span className="flex items-center gap-1 text-lg font-black leading-none">
                {checked && <CheckIcon size={16} strokeWidth={3.5} />}
                {level}
              </span>
              <span className="mt-1 text-[11px] font-medium leading-tight text-gray">{LEVEL_HINTS[level]}</span>
            </label>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-gray">Mehrere Level sind möglich. Mindestens eines bleibt aktiv.</p>
    </fieldset>
  );
}
