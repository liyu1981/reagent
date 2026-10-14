# Multiple agents & storage

ReAgent persists everything it can to the browser:

- the agent **config** (model, thinking level, prompt, skills, tools, MCP) and
  the **API keys** in `localStorage`;
- the **conversations** in `IndexedDB`.

By default that storage lives under the shared `agent` namespace, so two
agents rendered on the same page would fight over the same active session,
keys and settings. Give each one a **`storagePrefix`** and they become fully
independent.

## Namespacing an agent

With the preset:

```tsx
<div className="grid grid-cols-2 gap-4">
  <div className="h-[640px]">
    <ReAgent storagePrefix="assistant" />
  </div>
  <div className="h-[640px]">
    <ReAgent storagePrefix="reviewer" />
  </div>
</div>
```

Or with the headless provider:

```tsx
<ReAgentProvider storagePrefix="assistant">
  <ReAgentRoot>…</ReAgentRoot>
</ReAgentProvider>
```

## What the prefix maps to

| Stored value | Key / database |
| ------------ | -------------- |
| Agent config | `localStorage["<prefix>.config"]` |
| Provider credentials | `localStorage["<prefix>.credential.<providerId>"]` |
| Verified providers | `localStorage["<prefix>.verified.providers"]` |
| MCP / Exa key | `localStorage["<prefix>.mcp.exa.apiKey"]` |
| Conversations | IndexedDB database `<prefix>-agent` |

The **default** prefix is `agent`, which reproduces the historical keys and the
original `reagent-agent` database, so existing installs keep their data. A
custom prefix uses `<prefix>-agent` for its database.

## Reading the prefix

`useReAgent().storagePrefix` exposes the active namespace. The config store,
model registry, MCP manager and session store are all keyed to it
automatically. `useReAgentConfig()` resolves the namespace from the surrounding
provider, and falls back to the default when used outside one.

## Isolating just the conversations

If you only need separate **conversation histories** while sharing one model
configuration, give the agents different prefixes and copy the shared config
yourself, or keep one agent per namespace. Storage is the unit of isolation:
two agents with different prefixes never see each other's sessions, keys or
settings.

Next: [Headless usage](./headless) →
