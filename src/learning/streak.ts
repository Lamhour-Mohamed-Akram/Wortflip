import { dayKey, shiftedDayKey } from './time';
import type { StreakState } from './types';

export function createStreak(): StreakState {
  return { current: 0, best: 0, lastActiveDay: null };
}

/** Call once per review; extends or restarts the daily streak. */
export function recordActivity(streak: StreakState, now: number): StreakState {
  const today = dayKey(now);
  if (streak.lastActiveDay === today) return streak;
  const yesterday = shiftedDayKey(now, -1);
  const current = streak.lastActiveDay === yesterday ? streak.current + 1 : 1;
  return { current, best: Math.max(streak.best, current), lastActiveDay: today };
}

/** The streak as it should be displayed: 0 once a full day was skipped. */
export function currentStreak(streak: StreakState, now: number): number {
  if (streak.lastActiveDay === null) return 0;
  const today = dayKey(now);
  const yesterday = shiftedDayKey(now, -1);
  return streak.lastActiveDay === today || streak.lastActiveDay === yesterday ? streak.current : 0;
}

/** True when the user already reviewed something today. */
export function activeToday(streak: StreakState, now: number): boolean {
  return streak.lastActiveDay === dayKey(now);
}
