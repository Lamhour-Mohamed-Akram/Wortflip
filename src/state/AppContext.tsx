import { createContext, useContext, useEffect, useMemo, useReducer, type Dispatch, type ReactNode } from 'react';
import { itemById } from '../data';
import { getLocalStorage, loadState, saveState, type AppState } from '../learning/storage';
import { reducer, type Action } from './reducer';

interface AppContextValue {
  state: AppState;
  dispatch: Dispatch<Action>;
  /** False when the browser refuses to persist (progress then only lives until reload). */
  persistent: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

const storage = getLocalStorage();
const validIds: ReadonlySet<string> = new Set(itemById.keys());

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => loadState(storage, validIds));

  useEffect(() => {
    saveState(storage, state);
  }, [state]);

  const value = useMemo(
    () => ({ state, dispatch, persistent: storage !== null }),
    [state],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
