import { useState } from 'react';
import { Link } from 'react-router-dom';

import { AgentPlayground } from '../components/AgentPlayground';
import { CodeBlock } from '../components/CodeBlock';
import { CheckIcon, CopyIcon } from '../components/icons';
import { cn } from '../lib/cn';
import type { SiteTheme } from '../lib/theme';

const PACKAGE_MANAGERS = ['pnpm', 'npm'] as const;
type PackageManager = (typeof PACKAGE_MANAGERS)[number];

const INSTALL: Record<PackageManager, string> = {
  pnpm: 'pnpm add @liyu1981/reagent',
  npm: 'npm install @liyu1981/reagent',
};

const QUICK_START = `import { ReAgent } from '@liyu1981/reagent';

export function AgentPanel() {
  return (
    <div className="h-[640px]">
      <ReAgent
        theme="dark"
        renderMarkdown={MarkdownView}
        notify={(message, level) => toast[level ?? 'success'](message)}
      />
    </div>
  );
}`;

const FEATURES = [
  {
    title: 'Browser-native agent loop',
    body: 'The whole loop runs client-side on pi-agent-core. Requests go straight from the browser to the provider you pick.',
  },
  {
    title: 'Conversation tree',
    body: 'Fork any session from any message. Branches stay linked to their origin and are reparented safely when you delete.',
  },
  {
    title: 'Built-in settings',
    body: 'Model, system prompt, skills, tools and MCP servers — a complete settings surface you get for free.',
  },
  {
    title: 'Any provider',
    body: 'OpenAI, Anthropic, OpenRouter, DeepSeek, Groq and any OpenAI-compatible endpoint such as Ollama or LM Studio.',
  },
  {
    title: 'Composable & headless',
    body: 'Use the styled preset, or drop down to ReAgentProvider, the UI parts and the hooks to build your own arrangement.',
  },
  {
    title: 'Local-first by design',
    body: 'API keys and config live in localStorage, conversations in IndexedDB. Nothing is proxied through your server.',
  },
];

export function Home({ theme }: { theme: SiteTheme }) {
  const [copied, setCopied] = useState(false);
  const [pkg, setPkg] = useState<PackageManager>('pnpm');

  async function copyInstall() {
    try {
      await navigator.clipboard.writeText(INSTALL[pkg]);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  function scrollToDemo() {
    document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-[-12rem] h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute right-[-8rem] top-24 h-80 w-80 rounded-full bg-accent/40 blur-3xl" />
        </div>

        <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-20 text-center sm:px-6 sm:pt-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            ⚗️ Composable React AI agent
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
            Drop an AI agent into your React app
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg text-muted-foreground">
            ReAgent gives you an in-app chat with a conversation tree and a full
            settings surface — model, prompt, skills, tools and MCP — running
            entirely in the browser.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={scrollToDemo}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              Try the live demo
            </button>
            <Link
              to="/docs"
              className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium transition hover:bg-accent hover:text-accent-foreground"
            >
              Read the docs
            </Link>
            <Link
              to="/demos"
              className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium transition hover:bg-accent hover:text-accent-foreground"
            >
              Browse demos
            </Link>
          </div>

          <div className="mx-auto mt-8 max-w-md rounded-xl border border-border bg-card/70 p-2 text-left shadow-sm backdrop-blur">
            <div className="mb-1 flex items-center gap-1 px-1 text-[11px]">
              {PACKAGE_MANAGERS.map(manager => (
                <button
                  key={manager}
                  type="button"
                  onClick={() => setPkg(manager)}
                  className={cn(
                    'rounded px-1.5 py-0.5 font-medium transition',
                    pkg === manager
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {manager}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 px-1 font-mono text-sm">
              <span className="select-none text-muted-foreground">$</span>
              <span className="flex-1 truncate">{INSTALL[pkg]}</span>
              <button
                type="button"
                onClick={copyInstall}
                aria-label="Copy install command"
                className="rounded-md p-1.5 text-muted-foreground transition hover:text-foreground"
              >
                {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Live demo */}
      <section id="demo" className="mx-auto w-full max-w-5xl scroll-mt-20 px-4 pb-20 sm:px-6">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">See it in action</h2>
          <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
            This is the real <code className="rounded bg-muted px-1.5 py-0.5 text-sm">&lt;ReAgent /&gt;</code>{' '}
            component. Add your own key in settings and chat.
          </p>
        </div>
        <AgentPlayground theme={theme} />
      </section>

      {/* Features */}
      <section className="border-y border-border/70 bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            Everything you need, nothing you don't
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(feature => (
              <div
                key={feature.title}
                className="rounded-2xl border border-border bg-card p-5 shadow-sm"
              >
                <h3 className="font-medium">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick start */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              One component to get started
            </h2>
            <p className="mt-4 text-muted-foreground">
              The preset wires up the chat surface, session tree and settings. Give it a sized
              container and you're done. Swap in your own markdown renderer, upload handler and
              notifications through optional props.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              {[
                'Peer deps: pi-agent-core, pi-ai, React 19',
                'Tailwind v4 utilities with zero-specificity tokens',
                'Headless core for fully custom UIs',
              ].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <CheckIcon className="mt-0.5 size-4 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
            <Link
              to="/docs/quick-start"
              className="mt-8 inline-flex rounded-xl border border-border px-4 py-2 text-sm font-medium transition hover:bg-accent hover:text-accent-foreground"
            >
              Quick start guide →
            </Link>
          </div>
          <CodeBlock code={QUICK_START} language="tsx" />
        </div>
      </section>
    </div>
  );
}
