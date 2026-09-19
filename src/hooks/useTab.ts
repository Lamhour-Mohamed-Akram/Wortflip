import { useCallback, useEffect, useState } from 'react';

export type Tab = 'lernen' | 'woerter' | 'fortschritt' | 'schwierig' | 'einstellungen';

export const TABS: readonly Tab[] = ['lernen', 'woerter', 'fortschritt', 'schwierig', 'einstellungen'];

function readTab(): Tab {
  const hash = window.location.hash.replace(/^#\/?/, '');
  return (TABS as readonly string[]).includes(hash) ? (hash as Tab) : 'lernen';
}

/** Tiny hash router so a refresh (and the browser back button) keeps the current tab. */
export function useTab(): [Tab, (tab: Tab) => void] {
  const [tab, setTabState] = useState<Tab>(readTab);

  useEffect(() => {
    const onHashChange = () => setTabState(readTab());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const setTab = useCallback((next: Tab) => {
    if (readTab() === next) return;
    window.location.hash = `/${next}`;
  }, []);

  return [tab, setTab];
}
