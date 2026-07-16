import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { translations, type Lang, type TranslationKey } from './i18n';

type Theme = 'dark' | 'light';

type AppContextType = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKey) => string;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem('lgphone-theme') as Theme) || 'dark';
  });
  const [lang, setLangState] = useState<Lang>(() => {
    return (localStorage.getItem('lgphone-lang') as Lang) || 'vi';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('lgphone-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('lgphone-lang', lang);
  }, [lang]);

  const setTheme = (t: Theme) => setThemeState(t);
  const setLang = (l: Lang) => setLangState(l);
  const t = (key: TranslationKey) => translations[lang][key] || translations.vi[key] || key;

  return (
    <AppContext.Provider value={{ theme, setTheme, lang, setLang, t }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
