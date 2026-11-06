import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameProvider } from './state/GameContext';
import { NavCtx, parentOf, type Screen } from './state/nav';
import { ErrorBoundary } from './components/ui';
import { HomeScreen, IntroScreen, LabScreen, LevelScreen } from './screens/HomeScreens';
import { UnitScreen } from './screens/UnitScreen';
import { ReviewScreen } from './screens/ReviewScreen';
import { BrainScreen } from './screens/BrainScreen';
import { ParentsScreen } from './screens/ParentsScreen';
import { initSpeech, stopSpeech } from './audio/speech';

function Shell() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const current = useRef(screen);
  current.current = screen;

  const go = useCallback((s: Screen) => {
    stopSpeech();
    try {
      window.history.pushState({ alienlab: true }, '');
    } catch {
      /* sandboxed frames may block history */
    }
    setScreen(s);
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    initSpeech();
    try {
      window.history.replaceState({ alienlab: true }, '');
    } catch {
      /* ignore */
    }
    // Browser "back" always lands on a safe screen (lab / home), never mid-step.
    const onPop = () => {
      const parent = parentOf(current.current);
      if (parent) {
        stopSpeech();
        setScreen(parent);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const nav = useMemo(() => ({ screen, go }), [screen, go]);
  const key = screen.name + ('unitId' in screen ? screen.unitId : '') + ('mode' in screen ? screen.mode : '');

  let body;
  switch (screen.name) {
    case 'home':
      body = <HomeScreen />;
      break;
    case 'intro':
      body = <IntroScreen />;
      break;
    case 'level':
      body = <LevelScreen />;
      break;
    case 'lab':
      body = <LabScreen message={screen.message} />;
      break;
    case 'unit':
      body = <UnitScreen key={screen.unitId} unitId={screen.unitId} />;
      break;
    case 'review':
      body = <ReviewScreen key={screen.mode} mode={screen.mode} />;
      break;
    case 'brain':
      body = <BrainScreen />;
      break;
    case 'parents':
      body = <ParentsScreen />;
      break;
  }

  return (
    <NavCtx.Provider value={nav}>
      <ErrorBoundary resetKey={key} onReset={() => setScreen({ name: 'lab' })}>
        <div className="min-h-dvh" data-screen={screen.name}>
          {body}
        </div>
      </ErrorBoundary>
    </NavCtx.Provider>
  );
}

export default function App() {
  return (
    <GameProvider>
      <Shell />
    </GameProvider>
  );
}
