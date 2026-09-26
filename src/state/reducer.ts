import type { Level, VocabularyItem } from '../data/types';
import type { CommunityTopic } from '../community/types';
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
  | { type: 'custom/add'; items: VocabularyItem[]; theme?: string; linkIds?: string[] }
  | { type: 'custom/remove'; ids: string[] }
  | { type: 'custom/removeTheme'; theme: string; ids: string[] }
  | { type: 'custom/renameTheme'; from: string; to: string }
  | { type: 'community/topics'; topics: CommunityTopic[]; syncedAt: number }
  | { type: 'community/shared'; theme: string; topic: CommunityTopic }
  | { type: 'community/report'; id: string }
  | { type: 'settings/showCommunity'; showCommunity: boolean }
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

    case 'custom/add': {
      const known = new Set(state.customWords.map((item) => item.id));
      const fresh = action.items.filter((item) => !known.has(item.id));
      // Words that already exist in the app join the topic instead of being added twice.
      let themeLinks = state.themeLinks;
      if (action.theme && action.linkIds && action.linkIds.length > 0) {
        const current = themeLinks[action.theme] ?? [];
        const added = action.linkIds.filter((id) => !current.includes(id) && !known.has(id));
        if (added.length > 0) themeLinks = { ...themeLinks, [action.theme]: [...current, ...added] };
      }
      if (fresh.length === 0 && themeLinks === state.themeLinks) return state;
      return { ...state, customWords: [...state.customWords, ...fresh], themeLinks };
    }

    case 'custom/removeTheme': {
      // `ids` are the group's own words (the "Ohne Thema" group has no theme to match on).
      const { [action.theme]: _gone, ...themeLinks } = state.themeLinks;
      const next = action.ids.length > 0 ? reducer(state, { type: 'custom/remove', ids: action.ids }) : state;
      // Linked bundled words only lose the topic; their progress stays.
      return { ...next, themeLinks };
    }

    case 'custom/remove': {
      const gone = new Set(action.ids);
      const customWords = state.customWords.filter((item) => !gone.has(item.id));
      if (customWords.length === state.customWords.length) return state;
      // Their progress goes with them; a running round drops the removed cards.
      const progress = Object.fromEntries(Object.entries(state.progress).filter(([id]) => !gone.has(id)));
      let session = state.session;
      if (session && session.queue.some((id) => gone.has(id))) {
        const queue = session.queue.filter((id) => !gone.has(id));
        session = queue.length > 0 ? { ...session, queue } : null;
      }
      return { ...state, customWords, progress, session };
    }

    case 'custom/renameTheme': {
      // After a merge the community's spelling of the topic wins, so one topic stays one topic.
      if (action.from === action.to) return state;
      const customWords = state.customWords.map((item) => (item.theme === action.from ? { ...item, theme: action.to } : item));
      const { [action.from]: moved, ...rest } = state.themeLinks;
      const themeLinks = moved ? { ...rest, [action.to]: [...new Set([...(rest[action.to] ?? []), ...moved])] } : state.themeLinks;
      const { [action.from]: sharedId, ...sharedRest } = state.community.shared;
      const shared = sharedId ? { ...sharedRest, [action.to]: sharedId } : state.community.shared;
      return { ...state, customWords, themeLinks, community: { ...state.community, shared } };
    }

    case 'community/topics':
      return { ...state, community: { ...state.community, topics: action.topics, syncedAt: action.syncedAt } };

    case 'community/shared': {
      // The shared (possibly merged) copy replaces the cached one right away, without waiting for the next sync.
      const topics = state.community.topics.some((t) => t.id === action.topic.id)
        ? state.community.topics.map((t) => (t.id === action.topic.id ? action.topic : t))
        : [action.topic, ...state.community.topics];
      return { ...state, community: { ...state.community, topics, shared: { ...state.community.shared, [action.theme]: action.topic.id } } };
    }

    case 'community/report': {
      if (state.community.reported.includes(action.id)) return state;
      return { ...state, community: { ...state.community, reported: [...state.community.reported, action.id] } };
    }

    case 'settings/showCommunity': {
      if (state.settings.showCommunity === action.showCommunity) return state;
      // Community cards may sit in the running round: start fresh.
      return { ...state, settings: { ...state.settings, showCommunity: action.showCommunity }, session: null };
    }

    case 'progress/reset':
      // The learner's own words stay; only the learning state is cleared.
      return { ...defaultState(), settings: { ...state.settings }, customWords: state.customWords, themeLinks: state.themeLinks, community: state.community };

    case 'app/reset-all':
      return defaultState();
  }
}
