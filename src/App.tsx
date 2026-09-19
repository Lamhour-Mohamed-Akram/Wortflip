import type { ReactNode } from 'react';
import { BottomNav } from './components/BottomNav';
import { useTab } from './hooks/useTab';
import { ReloadPrompt } from './pwa/ReloadPrompt';
import { DifficultScreen } from './screens/DifficultScreen';
import { LearnScreen } from './screens/LearnScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { ProgressScreen } from './screens/ProgressScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { WordsScreen } from './screens/WordsScreen';
import { AppProvider, useApp } from './state/AppContext';

export function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}

function Shell() {
  const { state, dispatch } = useApp();
  const [tab, setTab] = useTab();

  if (!state.settings.onboarded) {
    return (
      <Frame>
        <OnboardingScreen
          onStart={(levels) => {
            dispatch({ type: 'onboarding/complete', levels });
            setTab('lernen');
          }}
        />
      </Frame>
    );
  }

  return (
    <Frame nav={<BottomNav active={tab} onSelect={setTab} />}>
      {tab === 'lernen' && <LearnScreen onNavigate={setTab} />}
      {tab === 'woerter' && <WordsScreen onNavigate={setTab} />}
      {tab === 'fortschritt' && <ProgressScreen />}
      {tab === 'schwierig' && <DifficultScreen onNavigate={setTab} />}
      {tab === 'einstellungen' && <SettingsScreen />}
    </Frame>
  );
}

/** Full-screen on phones; a centered, phone-sized "device" window on larger screens. */
function Frame({ children, nav }: { children: ReactNode; nav?: ReactNode }) {
  return (
    <div className="dot-grid min-h-screen-safe bg-yellow-light md:flex md:items-center md:justify-center md:p-6">
      <div className="dot-grid relative flex h-screen-safe w-full flex-col overflow-hidden bg-white md:h-[min(56rem,calc(100dvh-3rem))] md:max-w-[27rem] md:rounded-[2rem] md:border-3 md:border-black md:shadow-hard-lg">
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</main>
        {nav}
        <ReloadPrompt />
      </div>
    </div>
  );
}
