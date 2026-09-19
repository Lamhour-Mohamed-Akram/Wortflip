import { startOfDay } from '../learning/time';

const DAY_MS = 24 * 60 * 60 * 1000;

/** "später heute", "morgen", "in 3 Tagen" */
export function formatRelativeDay(target: number, now: number): string {
  const days = Math.round((startOfDay(target) - startOfDay(now)) / DAY_MS);
  if (days <= 0) return 'später heute';
  if (days === 1) return 'morgen';
  return `in ${days} Tagen`;
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/** Two-letter German weekday for a "YYYY-MM-DD" key. */
export function weekdayLabel(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const date = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  return WEEKDAYS[date.getDay()] ?? '';
}
