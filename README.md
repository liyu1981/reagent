# ReAgent

**Composable React AI agent** — drop an in-app chat, a conversation tree and a
complete settings surface into any React app. The agent loop runs entirely in
the browser on top of [`pi-agent-core`](https://www.npmjs.com/package/@earendil-works/pi-agent-core)
and `pi-ai`; your keys and conversations stay on the device.

[![npm](https://img.shields.io/npm/v/@liyu1981/reagent?color=6366f1&label=npm)](https://www.npmjs.com/package/@liyu1981/reagent)
[![license](https://img.shields.io/npm/l/@liyu1981/reagent?color=blue)](./LICENSE)
[![docs](https://img.shields.io/badge/docs-live-6366f1)](https://liyu1981.github.io/reagent/)
[![deploy](https://github.com/liyu1981/reagent/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/liyu1981/reagent/actions/workflows/deploy-pages.yml)

📖 **[Documentation](https://liyu1981.github.io/reagent/#/docs)** ·
🧪 **[Demos](https://liyu1981.github.io/reagent/#/demos)** ·
🚀 **[Live demo](https://liyu1981.github.io/reagent/)** ·
📦 **[npm](https://www.npmjs.com/package/@liyu1981/reagent)**

---

## Features

- **Browser-native agent loop.** Requests go straight from the browser to the
  provider you choose. No backend proxy, no keys on your servers.
- **Conversation tree.** Fork any session from any message; branches stay linked
  to their origin and survive deletion of their parent.
- **Zero opinions by default.** A bare `<ReAgent />` is just chat: no built-in
  tools, skills or MCP servers. Add exactly what your app needs.
- **Built-in settings.** Model, system prompt, skills, tools and MCP servers —
  a full settings surface out of the box.
- **Any provider.** OpenAI, Anthropic, OpenRouter, DeepSeek, Groq and any
  OpenAI-compatible endpoint such as Ollama, LM Studio or vLLM.
- **Composable and headless.** Use the styled preset, or compose
  `ReAgentProvider` with the exported UI parts and hooks.
- **Themeable.** Tailwind v4 utilities with zero-specificity design tokens.
- **Local-first.** API keys and config in `localStorage`, conversations in
  `IndexedDB`.

## Install

```bash
# pnpm (default)
pnpm add @liyu1981/reagent

# npm
npm install @liyu1981/reagent
```

Peer dependencies: `@earendil-works/pi-agent-core@0.84.2`,
`@earendil-works/pi-ai@0.84.2`, `react@^19.2.0`, `react-dom@^19.2.0`.

## Quick start

```tsx
import { ReAgent } from '@liyu1981/reagent';

export function AgentPanel() {
  return (
    <div style={{ height: 'min(720px, 80vh)' }}>
      <ReAgent surface="glass" theme="dark" />
    </div>
  );
}
```

## Demos

Two live demos, each with its full source on screen:

- **[Vanilla](https://liyu1981.github.io/reagent/#/demos)** — the preset and
  nothing else.
- **[Skills, tools & MCP](https://liyu1981.github.io/reagent/#/demos)** —
  host-defined skills, a custom tool and the Exa MCP server.

On first load ReAgent opens a session and points you at **Settings → Model** to
add a provider key (or a local Ollama URL) and verify the connection.

### Styles (Tailwind v4)

ReAgent ships Tailwind utilities. In your global stylesheet, after Tailwind:

```css
@import "tailwindcss";
@import "@liyu1981/reagent/styles.css";
@source "../node_modules/@liyu1981/reagent/dist";
```

Design tokens (`--background`, `--card`, `--border`, `--muted-foreground`,
`--primary`, `--accent`, `--destructive`, `--ring`, …) are the theming contract.
The package registers them as Tailwind theme colors and ships low-specificity
fallbacks, so an existing shadcn/ui theme just works.

## `<ReAgent />` props

Every host integration is optional.

| Prop | Type | Default | Purpose |
| ---- | ---- | ------- | ------- |
| `surface` | `'glass' \| 'solid'` | `'glass'` | Panel styling. |
| `theme` | `'light' \| 'dark'` | `'light'` | Theme for markdown/rendering. |
| `language` | `string` | `'en'` | Answer language and default copy. |
| `renderMarkdown` | `ComponentType<{ content; theme? }>` | plain `<pre>` | Render messages. |
| `uploadFile` | `(file: File) => Promise<string>` | — | Persist a file, return markdown. |
| `notify` | `(message, level?) => void` | no-op | Success/error notifications. |
| `messages` / `translate` | copy overrides / translator | English | i18n. |
| `extraTools` | `AgentTool<any>[]` | `[]` | Raw tools (e.g. MCP). |
| `extraDescriptors` | `AgentToolDescriptor[]` | `[]` | Registry tools shown in the Tools panel. |
| `draft` / `editor` / `selection` | editor integration | — | Let the agent edit an open document. |
| `onClose` / `onClearSelection` | callbacks | — | Header/selection hooks. |

See the [components reference](https://liyu1981.github.io/reagent/#/docs/components)
for the full list.

## Headless

`<ReAgent />` is only one arrangement. Import the provider, UI parts and hooks
to build your own:

```tsx
import { ReAgentProvider, ReAgentRoot, ReAgentMessageList, useReAgent } from '@liyu1981/reagent';

function CustomChat() {
  const { send, status } = useReAgent();
  return (
    <ReAgentRoot className="flex h-full flex-col">
      <ReAgentMessageList className="flex-1" />
      <button onClick={() => void send()} disabled={status === 'streaming'}>
        Send
      </button>
    </ReAgentRoot>
  );
}

<ReAgentProvider>
  <CustomChat />
</ReAgentProvider>;
```

`useReAgent()` exposes the full runtime (sessions, streaming state, tool calls,
composer state, `send`/`stop`, …). Configuration lives in an external store and
works outside React via `getAgentConfig` / `updateAgentConfig`.

## Providers

| Provider | Notes |
| -------- | ----- |
| `openai` | API key |
| `anthropic` | API key |
| `openrouter` | API key |
| `deepseek` | API key |
| `groq` | API key |
| `ollama` | OpenAI-compatible; defaults to `http://localhost:11434`, no key |

Credentials are managed from the settings UI or programmatically:

```ts
import { saveApiKey, setOllamaBaseUrl, testConnection, listAvailableModels } from '@liyu1981/reagent';

await saveApiKey('openai', 'sk-…');
await testConnection('openai');
listAvailableModels();
```

## Repository layout

```
.
├── src/            # the library (@liyu1981/reagent)
├── styles.css      # Tailwind entry + design tokens
├── docs/           # documentation markdown (source for the site)
└── site/           # Vite demo + documentation site (GitHub Pages)
```

## Docs & demo site

The `site/` package is a Vite app that powers the live documentation and the
interactive demo. On every push to `main`,
[`.github/workflows/deploy-pages.yml`](./.github/workflows/deploy-pages.yml)
builds the library and the site and publishes `site/dist` to GitHub Pages.

Enable it once under **Settings → Pages → Build and deployment → Source: GitHub
Actions**.

## Development

```bash
pnpm install
pnpm build                  # build the library to dist/
pnpm typecheck              # typecheck the library
pnpm site:build             # build the library + the site
pnpm site:dev               # run the docs/demo site locally
```

## License

[MIT](./LICENSE) © Yu Li
