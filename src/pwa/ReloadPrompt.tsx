import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '../components/Button';
import { CheckIcon, SparkleIcon } from '../components/Icons';

/**
 * New versions are installed in the background but only activated after the
 * user confirms, so a running learning session is never interrupted.
 */
export function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error('Service worker registration failed', error);
    },
  });

  useEffect(() => {
    if (!offlineReady) return;
    const timer = window.setTimeout(() => setOfflineReady(false), 4500);
    return () => window.clearTimeout(timer);
  }, [offlineReady, setOfflineReady]);

  if (!offlineReady && !needRefresh) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[calc(0.75rem+env(safe-area-inset-top))] z-40 flex justify-center px-4">
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border-3 border-black bg-white p-3 shadow-hard animate-toast-in"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-xl border-2 border-black bg-yellow">
          {needRefresh ? <SparkleIcon size={20} /> : <CheckIcon size={20} />}
        </span>
        {needRefresh ? (
          <>
            <p className="flex-1 text-sm font-bold leading-tight">Neue Version verfügbar.</p>
            <Button size="sm" onClick={() => void updateServiceWorker(true)}>
              Aktualisieren
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)} aria-label="Später aktualisieren">
              Später
            </Button>
          </>
        ) : (
          <p className="flex-1 text-sm font-bold leading-tight">Wortflip ist jetzt offline verfügbar.</p>
        )}
      </div>
    </div>
  );
}
