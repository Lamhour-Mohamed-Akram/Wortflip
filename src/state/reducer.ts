import type { Level } from '../data/types';
import { createProgress, isDifficult, reviewWord } from '../learning/scheduler';
import { answerCard } from '../learning/session';
import { recordReview } from '../learning/stats';
import { defaultState, type AppState } from '../learning/storage';
import { recordActivity } from '../learning/streak';
import type { Rating, SessionSize, SessionState } from '../learning/types';

export type Action =
  | { type: 'onboarding/complete'; levels: Level[] }
  | { type: 'settings/levels'; levels: Level[] }
  | { type: 'settings/sessionSize'; sessionSize: SessionSize }
  | { type: 'settings/showTranslation'; showTranslation: boolean }
  | { type: 'session/set'; session: SessionState | null }
  | { type: 'review'; id: string; rating: Rating; now: number }
  | { type: 'progress/reset' }
  | { type: 'app/reset-all' };

function sameLevels(a: readonly Level[], b: readonly Level[]): boolean {
  return a.length === b.length && a.every((level) => b.includes(level));
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'onboarding/complete':
      return {
        ...state,
        settings: { ...state.settings, levels: action.levels, onboarded: true },
        session: null,
      };

    case 'settings/levels': {
      if (sameLevels(state.settings.levels, action.levels)) return state;
      // The running session may contain words from a level that is no longer
      // selected, so it is discarded (all answers given so far are already saved).
      return { ...state, settings: { ...state.settings, levels: action.levels }, session: null };
    }

    case 'settings/sessionSize': {
      if (state.settings.sessionSize === action.sessionSize) return state;
      return { ...state, settings: { ...state.settings, sessionSize: action.sessionSize }, session: null };
    }

    case 'settings/showTranslation': {
      if (state.settings.showTranslation === action.showTranslation) return state;
      // Only changes what the card back shows; the running session stays.
      return { ...state, settings: { ...state.settings, showTranslation: action.showTranslation } };
    }

    case 'session/set':
      return { ...state, session: action.session };

    case 'review': {
      const previous = state.progress[action.id] ?? createProgress(action.id);
      const next = reviewWord(previous, action.rating, action.now);
      const session = state.session
        ? answerCard(state.session, action.id, action.rating, isDifficult(next))
        : null;
      return {
        ...state,
        progress: { ...state.progress, [action.id]: next },
        stats: recordReview(state.stats, action.rating, action.now),
        streak: recordActivity(state.streak, action.now),
        session,
      };
    }

    case 'progress/reset':
      return { ...defaultState(), settings: { ...state.settings } };

    case 'app/reset-all':
      return defaultState();
  }
}
