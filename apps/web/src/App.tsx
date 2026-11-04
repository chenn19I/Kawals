import { lazy, Suspense, useEffect, useRef, type ReactElement } from 'react';
import { useLang } from './lib/i18n';
import { screenTitle } from './lib/copy';
import { useHashScreen } from './state/useHashScreen';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { HomeScreen } from './screens/HomeScreen';
import { CheckScreen } from './screens/CheckScreen';
import { MemoryScreen } from './screens/MemoryScreen';
import { MarketScreen } from './components/MarketScreen';
import { LearningCurveScreen } from './components/LearningCurveScreen';
import { StatusScreen } from './screens/StatusScreen';

// The gallery is the only screen that always needs the Three.js chunk. Loading
// it on demand keeps the isometric rig out of the first paint.
const MaskotGalleryScreen = lazy(async () => {
  const module = await import('./components/MaskotGalleryScreen');
  return { default: module.MaskotGalleryScreen };
});

export function App(): ReactElement {
  const { screen, navigate } = useHashScreen();
  const { lang, tx } = useLang();
  const mainRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    document.title = screenTitle(screen, lang);
  }, [screen, lang]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    mainRef.current?.focus({ preventScroll: true });
  }, [screen]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        {tx('Skip to content', 'Lewati ke konten')}
      </a>
      <Header active={screen} navigate={navigate} />
      <main className="page" id="main" tabIndex={-1} ref={mainRef}>
        <div className="screen-stage" key={screen}>
          {screen === 'home' ? <HomeScreen navigate={navigate} /> : null}
          {screen === 'check' ? <CheckScreen /> : null}
          {screen === 'memory' ? <MemoryScreen /> : null}
          {screen === 'market' ? <MarketScreen /> : null}
          {screen === 'learning' ? <LearningCurveScreen /> : null}
          {screen === 'status' ? <StatusScreen /> : null}
          {screen === 'maskot' ? (
            <Suspense
              fallback={
                <div className="state-block" role="status" aria-live="polite">
                  <span className="spinner" aria-hidden="true" />
                  <p>{tx('Loading the maskot lab...', 'Memuat lab maskot...')}</p>
                </div>
              }
            >
              <MaskotGalleryScreen />
            </Suspense>
          ) : null}
        </div>
      </main>
      <Footer navigate={navigate} />
    </div>
  );
}
