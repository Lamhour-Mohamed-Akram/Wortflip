import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type Dispatch, type ReactNode } from 'react';
import { fetchTopicIds, fetchTopics } from '../community/api';
import { COMMUNITY_ENABLED, SYNC_INTERVAL_MS } from '../community/config';
import { communityCatalogue } from '../community/merge';
import { pendingTopics, shareAndMerge, shareErrorMessage } from '../community/share';
import { dataset, itemById, type Level, type VocabularyItem } from '../data';
import { applyThemeLinks, buildTopicIndex, type ThemeLinks, type TopicIndex } from '../data/custom';
import { themeLinks as bundledLinks } from '../data/vocabulary/themes';
import { getLocalStorage, loadState, saveState, type AppState } from '../learning/storage';
import { reducer, type Action } from './reducer';

interface AppContextValue {
  state: AppState;
  dispatch: Dispatch<Action>;
  /** False when the browser refuses to persist (progress then only lives until reload). */
  persistent: boolean;
  /** Bundled words, the learner's own words and community words: everything the app can show and schedule. */
  items: readonly VocabularyItem[];
  byId: ReadonlyMap<string, VocabularyItem>;
  itemsFor: (levels: readonly Level[]) => VocabularyItem[];
  /** Which words belong to which topics (a word may be in several). */
  topics: TopicIndex;
  /** Community sharing runs here; the screen only shows its state and can trigger a retry. */
  share: { sharing: string | null; error: string | null; retry: () => void };
}

const AppContext = createContext<AppContextValue | null>(null);

function mergeLinks(a: ThemeLinks, b: ThemeLinks): ThemeLinks {
  const out: ThemeLinks = { ...a };
  for (const [theme, ids] of Object.entries(b)) out[theme] = [...new Set([...(out[theme] ?? []), ...ids])];
  return out;
}

const storage = getLocalStorage();
const validIds: ReadonlySet<string> = new Set(itemById.keys());

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => loadState(storage, validIds));

  useEffect(() => {
    saveState(storage, state);
  }, [state]);

  const { customWords, themeLinks, community } = state;
  const { showCommunity } = state.settings;
  const ownRef = useRef<readonly VocabularyItem[]>(dataset.items);
  const catalogue = useMemo(() => {
    const own = [...applyThemeLinks(dataset.items, themeLinks), ...customWords];
    ownRef.current = own;
    let items: readonly VocabularyItem[] = own;
    let allLinks: ThemeLinks = mergeLinks(bundledLinks, themeLinks);
    if (showCommunity && community.topics.length > 0) {
      const extra = communityCatalogue(community.topics, own, new Set(community.reported));
      items = [...applyThemeLinks(own, extra.links), ...extra.items];
      allLinks = mergeLinks(allLinks, extra.links);
    }
    const plain = items === own && customWords.length === 0 && Object.keys(themeLinks).length === 0;
    const byId = plain ? itemById : new Map(items.map((item) => [item.id, item]));
    const itemsFor = (levels: readonly Level[]) => items.filter((item) => levels.includes(item.level));
    const topics = buildTopicIndex(items, allLinks);
    return { items, byId, itemsFor, topics };
  }, [customWords, themeLinks, community, showCommunity]);

  // Pending shares go out by themselves: at start, whenever own topics change, and when the
  // connection comes back. A failed attempt waits for the next of those moments.
  const stateRef = useRef(state);
  stateRef.current = state;
  const sharingRef = useRef(false);
  const [shareState, setShareState] = useState<{ sharing: string | null; error: string | null }>({ sharing: null, error: null });
  const runShares = useCallback(async () => {
    if (!COMMUNITY_ENABLED || sharingRef.current || !navigator.onLine) return;
    sharingRef.current = true;
    try {
      for (const [theme, words] of pendingTopics(stateRef.current, ownRef.current)) {
        setShareState({ sharing: theme, error: null });
        try {
          await shareAndMerge(theme, words, ownRef.current, dispatch);
          setShareState({ sharing: null, error: null });
        } catch (error) {
          setShareState({ sharing: null, error: shareErrorMessage(error) });
          break; // offline or refused: try again at the next moment
        }
      }
    } finally {
      sharingRef.current = false;
      setShareState((s) => (s.sharing ? { ...s, sharing: null } : s));
    }
  }, []);
  const pendingKey = [...pendingTopics(state, ownRef.current).keys()].join('|');
  useEffect(() => {
    if (!COMMUNITY_ENABLED || !showCommunity || !pendingKey) return;
    void runShares();
    const onOnline = () => void runShares();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [pendingKey, showCommunity, runShares]);

  // Community sync: once per app start (and when switched on), then every SYNC_INTERVAL_MS at most.
  const syncedAt = community.syncedAt;
  const knownTopicIds = community.topics.map((t) => t.id).join(',');
  useEffect(() => {
    if (!COMMUNITY_ENABLED || !showCommunity || !navigator.onLine) return;
    if (syncedAt !== null && Date.now() - syncedAt < SYNC_INTERVAL_MS) return;
    let cancelled = false;
    (async () => {
      try {
        const visible = await fetchTopicIds();
        const known = new Set(knownTopicIds ? knownTopicIds.split(',') : []);
        const missing = visible.filter((id) => !known.has(id));
        const fetched = missing.length > 0 ? await fetchTopics(missing) : [];
        if (cancelled) return;
        const visibleSet = new Set(visible);
        dispatch({
          type: 'community/topics',
          topics: [...community.topics.filter((t) => visibleSet.has(t.id)), ...fetched],
          syncedAt: Date.now(),
        });
      } catch {
        // Offline or the project is paused: the cached topics stay.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCommunity, syncedAt]);

  const share = useMemo(() => ({ ...shareState, retry: () => void runShares() }), [shareState, runShares]);
  const value = useMemo(
    () => ({ state, dispatch, persistent: storage !== null, share, ...catalogue }),
    [state, catalogue, share],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
