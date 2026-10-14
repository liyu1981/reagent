import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

import { cn } from '../lib/cn';
import type { ThemePreference } from '../lib/theme';
import { GithubIcon, MonitorIcon, MoonIcon, SunIcon } from './icons';

const NAV = [
  { to: '/demos', label: 'Demos' },
  { to: '/docs', label: 'Docs' },
];

const THEME_OPTIONS: { value: ThemePreference; label: string; Icon: typeof SunIcon }[] = [
  { value: 'system', label: 'System theme', Icon: MonitorIcon },
  { value: 'light', label: 'Light theme', Icon: SunIcon },
  { value: 'dark', label: 'Dark theme', Icon: MoonIcon },
];

const THEME_ICONS: Record<ThemePreference, typeof SunIcon> = {
  system: MonitorIcon,
  light: SunIcon,
  dark: MoonIcon,
};

const THEME_CYCLE: ThemePreference[] = ['system', 'light', 'dark'];

function nextPreference(current: ThemePreference): ThemePreference {
  return THEME_CYCLE[(THEME_CYCLE.indexOf(current) + 1) % THEME_CYCLE.length];
}

/**
 * Three-way picker on wider screens; a single cycling button on phones so the
 * header never overflows.
 */
function ThemeSwitcher({
  preference,
  onChange,
}: {
  preference: ThemePreference;
  onChange: (preference: ThemePreference) => void;
}) {
  const CycleIcon = THEME_ICONS[preference];
  return (
    <>
      <div
        role="group"
        aria-label="Theme"
        className="ml-1 hidden items-center rounded-lg border border-border p-0.5 sm:flex"
      >
        {THEME_OPTIONS.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            aria-label={label}
            aria-pressed={preference === value}
            title={label}
            className={cn(
              'rounded-md p-1.5 transition',
              preference === value
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-4" />
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange(nextPreference(preference))}
        aria-label={`Theme: ${preference}`}
        title="Change theme"
        className="rounded-lg p-2 text-muted-foreground transition hover:text-foreground sm:hidden"
      >
        <CycleIcon className="size-4" />
      </button>
    </>
  );
}

export function Layout({
  preference,
  onPreferenceChange,
}: {
  preference: ThemePreference;
  onPreferenceChange: (preference: ThemePreference) => void;
}) {
  const location = useLocation();
  const isDocs = location.pathname.startsWith('/docs');

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
                <circle cx="12" cy="12" r="3.2" />
              </svg>
            </span>
            ReAgent
            <span className="ml-1 hidden rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
              v{__APP_VERSION__}
            </span>
          </Link>

          <nav className="ml-auto flex items-center gap-1 text-sm">
            {NAV.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-1.5 transition',
                    isActive || (item.to === '/docs' && isDocs)
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
            <a
              href="https://www.npmjs.com/package/@liyu1981/reagent"
              target="_blank"
              rel="noreferrer"
              className="hidden rounded-lg px-3 py-1.5 text-muted-foreground transition hover:text-foreground sm:inline"
            >
              npm
            </a>
            <a
              href="https://github.com/liyu1981/reagent"
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub repository"
              className="rounded-lg p-2 text-muted-foreground transition hover:text-foreground"
            >
              <GithubIcon className="size-4" />
            </a>
            <ThemeSwitcher preference={preference} onChange={onPreferenceChange} />
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border/70">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:px-6">
          <p>
            MIT licensed. Built on{' '}
            <a
              className="text-foreground hover:underline"
              href="https://www.npmjs.com/package/@earendil-works/pi-agent-core"
              target="_blank"
              rel="noreferrer"
            >
              pi-agent-core
            </a>{' '}
            &amp; pi-ai.
          </p>
          <div className="flex items-center gap-4">
            <Link to="/docs" className="hover:text-foreground">
              Documentation
            </Link>
            <a
              href="https://github.com/liyu1981/reagent"
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground"
            >
              GitHub
            </a>
            <a
              href="https://www.npmjs.com/package/@liyu1981/reagent"
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground"
            >
              npm
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
