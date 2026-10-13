import { useCallback, useEffect, useState } from 'react';

export type SiteTheme = 'light' | 'dark';

const KEY = 'reagent-site.theme';

function initial(): SiteTheme {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
  } catch {
    // ignore
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useSiteTheme(): { theme: SiteTheme; toggle: () => void; setTheme: (t: SiteTheme) => void } {
  const [theme, setThemeState] = useState<SiteTheme>(initial);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const setTheme = useCallback((next: SiteTheme) => setThemeState(next), []);
  const toggle = useCallback(() => setThemeState(prev => (prev === 'dark' ? 'light' : 'dark')), []);

  return { theme, toggle, setTheme };
}
