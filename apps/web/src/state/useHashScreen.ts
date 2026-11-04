import { useCallback, useEffect, useState } from 'react';

export type Screen = 'home' | 'check' | 'memory' | 'status' | 'market' | 'learning' | 'maskot';

const ALIASES: Record<string, Screen> = {
  '': 'home',
  home: 'home',
  beranda: 'home',
  check: 'check',
  periksa: 'check',
  market: 'market',
  pasar: 'market',
  learning: 'learning',
  belajar: 'learning',
  memo: 'memory',
  memory: 'memory',
  memori: 'memory',
  status: 'status',
  maskot: 'maskot',
  mascot: 'maskot',
  galeri: 'maskot',
};

function readScreen(): Screen {
  const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0]?.toLowerCase() ?? '';
  return ALIASES[raw] ?? 'home';
}

function hashFor(screen: Screen): string {
  return screen === 'home' ? '#/' : `#/${screen}`;
}

export function useHashScreen(): {
  screen: Screen;
  navigate: (screen: Screen) => void;
} {
  const [screen, setScreen] = useState<Screen>(readScreen);

  useEffect(() => {
    const onChange = (): void => setScreen(readScreen());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((next: Screen): void => {
    const target = hashFor(next);
    if (window.location.hash !== target) window.location.hash = target;
    setScreen(next);
  }, []);

  return { screen, navigate };
}
