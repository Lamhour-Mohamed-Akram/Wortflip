import { dayKey, shiftedDayKey } from './time';
import type { Rating, Stats } from './types';

const KEEP_DAYS = 60;

export function createStats(): Stats {
  return { totalReviews: 0, totalCorrect: 0, reviewsByDay: {} };
}

export function recordReview(stats: Stats, rating: Rating, now: number): Stats {
  const today = dayKey(now);
  const cutoff = shiftedDayKey(now, -KEEP_DAYS);
  const reviewsByDay: Record<string, number> = {};
  for (const [day, count] of Object.entries(stats.reviewsByDay)) {
    if (day >= cutoff) reviewsByDay[day] = count;
  }
  reviewsByDay[today] = (reviewsByDay[today] ?? 0) + 1;
  return {
    totalReviews: stats.totalReviews + 1,
    totalCorrect: stats.totalCorrect + (rating === 'good' ? 1 : 0),
    reviewsByDay,
  };
}

/** Success rate in percent (0 to 100), or null when nothing was reviewed yet. */
export function accuracy(stats: Stats): number | null {
  if (stats.totalReviews === 0) return null;
  return Math.round((stats.totalCorrect / stats.totalReviews) * 100);
}

/** Review counts for the last `days` days, oldest first. */
export function recentDays(stats: Stats, now: number, days: number): { day: string; count: number }[] {
  const out: { day: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = shiftedDayKey(now, -i);
    out.push({ day, count: stats.reviewsByDay[day] ?? 0 });
  }
  return out;
}
