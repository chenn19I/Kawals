import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type Lang = 'en' | 'id';

const STORAGE_KEY = 'kawal.lang';

interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Pick the English or Indonesian string. */
  tx: (en: string, id: string) => string;
  /** Pick an English or Indonesian value of any type. */
  pick: <T>(en: T, id: T) => T;
}

const LangContext = createContext<LangContextValue | null>(null);

function readLang(): Lang {
  if (typeof window === 'undefined') return 'en';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'id' ? 'id' : 'en';
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readLang);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => setLangState(next), []);
  const tx = useCallback((en: string, id: string) => (lang === 'en' ? en : id), [lang]);
  const pick = useCallback(
    <T,>(en: T, id: T): T => (lang === 'en' ? en : id),
    [lang],
  );

  const value = useMemo(
    () => ({ lang, setLang, tx, pick }),
    [lang, setLang, tx, pick],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  const context = useContext(LangContext);
  if (!context) throw new Error('useLang must be used inside LangProvider');
  return context;
}
