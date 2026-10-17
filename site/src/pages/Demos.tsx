import { saveMcpServers, updateAgentConfig } from '@liyu1981/reagent';
import { useLayoutEffect, useState } from 'react';

import { CodeBlock } from '../components/CodeBlock';
import { BatteriesDemo, prepareBatteriesDemo } from '../demos/BatteriesDemo';
import { VanillaDemo } from '../demos/VanillaDemo';
import { WebMcpDemo } from '../demos/WebMcpDemo';
import {
  clearAgentStorage,
  readDemoMode,
  requestSessionReset,
  writeDemoMode,
  type DemoMode,
} from '../lib/agent-storage';
import { cn } from '../lib/cn';
import type { SiteTheme } from '../lib/theme';
import batteriesSource from '../demos/BatteriesDemo.tsx?raw';
import vanillaSource from '../demos/VanillaDemo.tsx?raw';
import webmcpSource from '../demos/WebMcpDemo.tsx?raw';

type Surface = 'glass' | 'solid';

const TABS: { id: DemoMode; label: string; blurb: string }[] = [
  {
    id: 'vanilla',
    label: 'Vanilla',
    blurb: 'Just the preset — no extra tools, skills or MCP servers.',
  },
  {
    id: 'batteries',
    label: 'Skills · Tools · MCP',
    blurb: 'Two host-defined skills, a custom tool and the Exa MCP server.',
  },
  {
    id: 'webmcp',
    label: 'WebMCP',
    blurb: 'The page exposes WebMCP tools; ReAgent auto-detects and uses them.',
  },
];

/** Strip the host-owned extras so the vanilla demo starts from a clean slate. */
function resetToVanilla(): void {
  updateAgentConfig({ skills: [] });
  saveMcpServers([]);
}

function applyDemo(mode: DemoMode): void {
  if (mode === 'batteries') {
    prepareBatteriesDemo();
  } else {
    resetToVanilla();
  }
}

export function Demos({ theme }: { theme: SiteTheme }) {
  const [active] = useState<DemoMode>(readDemoMode);
  const [surface, setSurface] = useState<Surface>('glass');
  const [notice, setNotice] = useState<string | null>(null);

  // Apply the selected setup before the agent's mount effect runs. A layout
  // effect runs ahead of the provider's passive effect; StrictMode may run it
  // twice, and it is idempotent.
  useLayoutEffect(() => {
    applyDemo(active);
  }, [active]);

  function select(id: DemoMode): void {
    if (id === active) {
      return;
    }
    // Persist the choice, then reload so the old provider is gone before its
    // conversations are cleared and the new setup is applied.
    writeDemoMode(id);
    requestSessionReset();
    window.location.reload();
  }

  function notify(message: string, level?: 'success' | 'error') {
    setNotice(`${level === 'error' ? '⚠️ ' : '✓ '}${message}`);
    window.setTimeout(() => setNotice(null), 2500);
  }

  const tab = TABS.find(entry => entry.id === active) ?? TABS[0];
  const source =
    active === 'vanilla' ? vanillaSource : active === 'batteries' ? batteriesSource : webmcpSource;
  const Demo =
    active === 'vanilla' ? VanillaDemo : active === 'batteries' ? BatteriesDemo : WebMcpDemo;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Demos</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
          Three ways to use ReAgent. Each demo runs live and shows its exact source — open the
          settings gear to add a model key, then chat.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-border p-1 text-sm">
          {TABS.map(entry => (
            <button
              key={entry.id}
              type="button"
              onClick={() => select(entry.id)}
              className={cn(
                'rounded-lg px-4 py-1.5 font-medium transition',
                active === entry.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {entry.label}
            </button>
          ))}
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
                    ? 'bg-accent text-accent-foreground'
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
            Reset data
          </button>
        </div>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">{tab.blurb}</p>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="relative h-[640px] overflow-hidden rounded-2xl">
          <Demo theme={theme} surface={surface} notify={notify} />
          {notice !== null && (
            <div className="pointer-events-none absolute bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full border border-border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-lg">
              {notice}
            </div>
          )}
        </div>

        <CodeBlock code={source} language="tsx" className="h-[640px]" />
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Switching demos reloads with a fresh conversation so the system prompt and tools match the
        selected setup. Your model key stays in your browser.
      </p>
    </div>
  );
}
