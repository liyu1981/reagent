import type { ReAgentHostProvider, ReAgentHostProviderConfig } from '@liyu1981/reagent';
import { ReAgent } from '@liyu1981/reagent';

import { AgentMarkdown } from '../components/Markdown';

interface DemoProps {
  theme: 'light' | 'dark';
  surface?: 'glass' | 'solid';
  notify?: (message: string, level?: 'success' | 'error') => void;
}

// Stand-in for the host's own persisted login (e.g. an OAuth session). ReAgent
// keeps the *config* in memory only; the host is free to remember its login
// however it likes.
let fakeSignedIn = false;

const FAKE_CONFIG: ReAgentHostProviderConfig = {
  baseUrl: 'https://fake-llm.invalid/v1',
  apiKey: 'fake-api-key',
  models: ['fake-fast', 'fake-smart'],
};

function FakeSetup({
  config,
  setConfig,
}: {
  config: ReAgentHostProviderConfig | null;
  setConfig: (config: ReAgentHostProviderConfig | null) => void;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-border/50 p-3">
      {config === null ? (
        <button
          type="button"
          onClick={() => {
            fakeSignedIn = true;
            setConfig(FAKE_CONFIG);
          }}
          className="rounded-lg bg-primary px-2.5 py-1 text-sm font-medium text-primary-foreground"
        >
          Sign in to FakeLLM
        </button>
      ) : (
        <div className="flex items-center justify-between text-sm">
          <span>
            Signed in as <strong className="font-medium">fake@example.com</strong>
          </span>
          <button
            type="button"
            onClick={() => {
              fakeSignedIn = false;
              setConfig(null);
            }}
            className="rounded-lg border border-border px-2.5 py-1 text-sm"
          >
            Sign out
          </button>
        </div>
      )}
      <p className="text-xs text-destructive">
        Fake provider — it does not reach a real LLM. Sending a message will fail on purpose.
      </p>
    </div>
  );
}

const fakeProvider: ReAgentHostProvider = {
  id: 'fake-llm',
  name: 'Fake LLM (host provider)',
  component: FakeSetup,
  // If the user already signed in (e.g. before a reload), ReAgent picks this up
  // the moment it mounts.
  getConfig: () => (fakeSignedIn ? FAKE_CONFIG : null),
};

export function HostProviderDemo({ theme, surface = 'glass', notify }: DemoProps) {
  return (
    <ReAgent
      theme={theme}
      surface={surface}
      renderMarkdown={AgentMarkdown}
      hostProviders={[fakeProvider]}
      notify={notify}
    />
  );
}
