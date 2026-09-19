import { cn } from '../lib/cn';
import { CheckIcon } from './Icons';

export interface Choice<T extends string | number> {
  value: T;
  label: string;
  hint?: string;
}

interface ChoiceGroupProps<T extends string | number> {
  name: string;
  legend: string;
  options: readonly Choice<T>[];
  value: T;
  onChange: (value: T) => void;
  legendClassName?: string;
  /** Tiles per row; defaults to one row with all options. */
  columns?: number;
}

/** Native radio buttons styled as chunky toggle tiles (keyboard arrows work out of the box). */
export function ChoiceGroup<T extends string | number>({ name, legend, options, value, onChange, legendClassName, columns }: ChoiceGroupProps<T>) {
  return (
    <fieldset>
      <legend className={cn('mb-2 font-mono text-[11px] font-bold uppercase tracking-wider text-gray', legendClassName)}>{legend}</legend>
      <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${columns ?? options.length}, minmax(0, 1fr))` }}>
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <label
              key={String(option.value)}
              className={cn(
                'flex min-h-14 cursor-pointer flex-col items-center justify-center rounded-xl border-3 border-black px-2 py-2 text-center transition-[transform,box-shadow,background-color] duration-100',
                'has-focus-visible:outline-3 has-focus-visible:outline-dashed has-focus-visible:outline-offset-3 has-focus-visible:outline-black',
                checked ? 'bg-yellow shadow-hard' : 'bg-white shadow-hard-xs hover:bg-yellow-light',
              )}
            >
              <input
                type="radio"
                name={name}
                value={String(option.value)}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <span className="flex items-center gap-1 text-lg font-black leading-none">
                {checked && <CheckIcon size={16} strokeWidth={3.5} />}
                {option.label}
              </span>
              {option.hint && <span className="mt-1 text-[11px] font-medium leading-tight text-gray">{option.hint}</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
