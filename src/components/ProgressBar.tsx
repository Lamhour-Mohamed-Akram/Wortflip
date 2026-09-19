interface ProgressBarProps {
  value: number;
  max: number;
  label: string;
}

export function ProgressBar({ value, max, label }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      className="h-4 w-full overflow-hidden rounded-full border-2 border-black bg-white"
    >
      <div
        className="stripes-diagonal h-full rounded-full bg-yellow-dark transition-[width] duration-300 ease-out"
        style={{ width: `${pct}%`, borderRight: pct > 0 && pct < 100 ? '2px solid #111111' : undefined }}
      />
    </div>
  );
}
