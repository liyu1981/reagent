import { useCallback, useEffect, useState } from 'react';

/** The concrete theme applied to the document. */
export type SiteTheme = 'light' | 'dark';

/** The user's choice; `system` follows the OS preference. */
export type ThemePreference = 'light' | 'dark' | 'system';

const KEY = 'reagent-site.theme';

function prefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function systemTheme(): SiteTheme {
  return prefersDark() ? 'dark' : 'light';
}

function initialPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch {
    // ignore
  }
  return 'system';
}

/**
 * Theme preference with a `system` default. `theme` is the resolved light/dark
 * value to hand to components; `preference` is what the user picked and is what
 * the switcher reflects.
 */
export function useSiteTheme(): {
  preference: ThemePreference;
  theme: SiteTheme;
  setPreference: (preference: ThemePreference) => void;
} {
  const [preference, setPreferenceState] = useState<ThemePreference>(initialPreference);
  const [system, setSystem] = useState<SiteTheme>(systemTheme);

  // Follow the OS preference live while `system` is selected.
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystem(query.matches ? 'dark' : 'light');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const theme: SiteTheme = preference === 'system' ? system : preference;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, preference);
    } catch {
      // ignore
    }
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => setPreferenceState(next), []);

  return { preference, theme, setPreference };
}
