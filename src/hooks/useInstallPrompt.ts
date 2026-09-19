import { useCallback, useEffect, useState } from 'react';

/** Chrome/Edge/Android fire this before showing their own install banner. Not in lib.dom yet. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallMethod = 'prompt' | 'ios' | 'manual' | 'installed';

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iPadDesktopMode = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/i.test(ua) || iPadDesktopMode;
}

/**
 * How this device can install the app:
 * - 'prompt': the browser offered an install prompt we can trigger (Android, Chrome, Edge)
 * - 'ios': Safari on iPhone/iPad, install goes through the share sheet
 * - 'manual': other browsers, only a hint is possible
 * - 'installed': already running from the home screen
 */
export function useInstallPrompt(): { method: InstallMethod; install: () => Promise<boolean> } {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return false;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    setDeferred(null);
    return choice.outcome === 'accepted';
  }, [deferred]);

  const method: InstallMethod = installed ? 'installed' : deferred ? 'prompt' : isIOS() ? 'ios' : 'manual';
  return { method, install };
}
