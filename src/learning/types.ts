import type { Level } from '../data/types';

export type WordStatus = 'new' | 'learning' | 'mastered';

/** Left swipe = "Noch lernen" (again), right swipe = "Kenne ich" (good). */
export type Rating = 'again' | 'good';

export interface WordProgress {
  id: string;
  status: WordStatus;
  /** 0 = currently being learned; 1..5 = position on the review ladder (1, 3, 7, 14, 30 days). */
  box: number;
  /** When the word should be shown again (epoch ms). null = never reviewed. */
  dueAt: number | null;
  lastReviewedAt: number | null;
  /** Total "Kenne ich" answers. */
  correct: number;
  /** Total "Noch lernen" answers. Used to find difficult words. */
  incorrect: number;
  /** Consecutive "Kenne ich" answers. */
  streak: number;
}

export type SessionKind = 'daily' | 'extra' | 'focus' | 'custom';

export interface SessionState {
  kind: SessionKind;
  /** Ids still to be shown, in order. Cards answered with "Noch lernen" are re-inserted here. */
  queue: string[];
  /** Number of distinct cards in this session. */
  total: number;
  correct: number;
  incorrect: number;
  startedAt: number;
}

export type SessionSize = 10 | 20 | 30;

export interface Settings {
  levels: Level[];
  sessionSize: SessionSize;
  /** Show the English translation on the back of the card (on by default, can be switched off to stay in German). */
  showTranslation: boolean;
  /** Show topics shared by other learners (community). */
  showCommunity: boolean;
  onboarded: boolean;
}

export interface StreakState {
  current: number;
  best: number;
  /** Local calendar day ("YYYY-MM-DD") of the last review. */
  lastActiveDay: string | null;
}

export interface Stats {
  totalReviews: number;
  totalCorrect: number;
  /** Reviews per local calendar day ("YYYY-MM-DD"), pruned to recent days. */
  reviewsByDay: Record<string, number>;
}
