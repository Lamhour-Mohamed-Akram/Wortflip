export const DAY_MS = 24 * 60 * 60 * 1000;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Local calendar day as "YYYY-MM-DD". */
export function dayKey(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Day key shifted by `days` whole calendar days (DST-safe). */
export function shiftedDayKey(timestamp: number, days: number): string {
  const d = new Date(timestamp);
  return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days).getTime());
}

/** Start of the local calendar day. */
export function startOfDay(timestamp: number): number {
  const d = new Date(timestamp);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
