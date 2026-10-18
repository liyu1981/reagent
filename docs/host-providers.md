# Host providers

A host can inject its **own LLM provider** — with its own setup UI and its own
auth — without ReAgent ever persisting the secret. This is the seam for apps
that already have an account system (OAuth, an internal token, a proxy, …).

## Registering a provider

Pass one or more `hostProviders` to `<ReAgent>` (or `<ReAgentProvider>`):

```tsx
import type { ReAgentHostProvider } from '@liyu1981/reagent';

const myProvider: ReAgentHostProvider = {
  id: 'my-llm',
  name: 'My LLM',
  // Rendered in Settings, above the local/cloud sections.
  component: MySetupPanel,
  // Return the config right away when the user is already signed in.
  getConfig: () => (mySession ? myConfig() : null),
};

<ReAgent hostProviders={[myProvider]} />;
```

### The setup component

`component` receives `{ config, setConfig }`. Render whatever flow you need —
a sign-in button, an OAuth redirect, a key form — and call `setConfig` when it
is done (or with `null` to sign out):

```tsx
function MySetupPanel({ config, setConfig }) {
  if (config === null) {
    return <button onClick={async () => setConfig(await signIn())}>Sign in</button>;
  }
  return <button onClick={() => setConfig(null)}>Sign out</button>;
}
```

### The config

```ts
interface ReAgentHostProviderConfig {
  baseUrl: string;
  apiKey: string;
  /** How the key is attached; default `Authorization: Bearer <key>`. */
  authHeaders?: (apiKey: string) => Record<string, string>;
  /** Extra headers sent with every request. */
  headers?: Record<string, string>;
  /** Request shape; default `openai-completions`. */
  api?: 'openai-completions' | 'openai-responses' | 'anthropic-messages';
  /** The model ids to expose. */
  models?: string[];
}
```

## Persistence

The config is kept **in memory only** — ReAgent never writes it to
`localStorage`. Persist the login however fits your app and return it from
`getConfig`; ReAgent then has it the moment it mounts.

## Notes

- Registered providers appear at the top of **Settings → Model**, and their
  models are offered in the composer's picker.
- `authHeaders` shapes how the key reaches the API (a custom header, a
  different scheme, …) and overrides the default bearer header.
- See the [host provider demo](/demos) — it uses a fake provider.

Next: [WebMCP](./webmcp) →
