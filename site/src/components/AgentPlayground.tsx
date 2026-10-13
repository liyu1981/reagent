import type { ReAgentSurface } from '@liyu1981/reagent';
import { useState } from 'react';

import { VanillaDemo } from '../demos/VanillaDemo';
import { clearAgentStorage } from '../lib/agent-storage';
import { cn } from '../lib/cn';
import type { SiteTheme } from '../lib/theme';

export function AgentPlayground({ theme, className }: { theme: SiteTheme; className?: string }) {
  const [surface, setSurface] = useState<ReAgentSurface>('glass');
  const [notice, setNotice] = useState<string | null>(null);

  function notify(message: string, level?: 'success' | 'error') {
    setNotice(`${level === 'error' ? '⚠️ ' : '✓ '}${message}`);
    window.setTimeout(() => setNotice(null), 2500);
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500/70" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          Live demo — runs entirely in your browser
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-border p-0.5 text-xs">
            {(['glass', 'solid'] as const).map(value => (
              <button
                key={value}
                type="button"
                onClick={() => setSurface(value)}
                className={cn(
                  'rounded-md px-2.5 py-1 capitalize transition',
                  surface === value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {value}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void clearAgentStorage()}
            className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground transition hover:text-foreground"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="relative h-[640px] overflow-hidden rounded-2xl">
        <VanillaDemo theme={theme} surface={surface} notify={notify} />
        {notice !== null && (
          <div className="pointer-events-none absolute bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full border border-border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-lg">
            {notice}
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        First time? Open the <strong className="text-foreground">⚙&nbsp;settings</strong> in the
        agent header, go to <strong className="text-foreground">Model</strong>, paste a provider API
        key (or point it at a local Ollama server) and press{' '}
        <strong className="text-foreground">Test</strong>. Keys stay in your browser's
        localStorage and are sent directly to the provider.
      </p>
    </div>
  );
}
