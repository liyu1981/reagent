---
name: integrate-reagent
description: Add the @liyu1981/reagent React AI agent to a React app — install, Tailwind setup, usage, model configuration, host integrations and multi-agent storage.
---

# Integrate ReAgent

ReAgent is a composable React AI agent: an in-app chat with a conversation
tree and a self-contained settings view (model, prompt, skills, tools, MCP).
The agent loop runs **in the browser** on `@earendil-works/pi-agent-core` and
`pi-ai`; API keys and conversations stay on the device.

This skill is a self-contained integration guide. The live docs are at
<https://liyu1981.github.io/reagent/#/docs> and the index at
<https://liyu1981.github.io/reagent/llms.txt>.

## 1. Install

```bash
pnpm add @liyu1981/reagent
# npm install @liyu1981/reagent
```

Peer dependencies (install alongside if the app doesn't already have them):
`@earendil-works/pi-agent-core@0.84.2`, `@earendil-works/pi-ai@0.84.2`,
`react@^19.2.0`, `react-dom@^19.2.0`.

ReAgent is **client-only**. Render it from a browser entry point (Vite, a
Next.js client component, …), never from a server component.

## 2. Tailwind v4 styles

The package ships Tailwind utilities. In the app's global stylesheet, after
Tailwind:

```css
@import "tailwindcss";
@import "@liyu1981/reagent/styles.css";
@source "../node_modules/@liyu1981/reagent/dist";
```

If the app uses **class-based dark mode**, opt in once:

```css
@custom-variant dark (&:where(.dark, .dark *));
```

The design tokens (`--background`, `--card`, `--border`, `--muted-foreground`,
`--primary`, `--accent`, `--destructive`, `--ring`, …) are the theming contract;
the package registers them as Tailwind theme colors with low-specificity
fallbacks, so an existing shadcn/ui theme just works.

## 3. Render the agent

Give it a sized container — it fills its parent.

```tsx
import { ReAgent } from '@liyu1981/reagent';

export function AgentPanel() {
  return (
    <div style={{ height: 'min(720px, 80vh)' }}>
      <ReAgent theme="dark" surface="glass" />
    </div>
  );
}
```

On first load ReAgent opens a session and points the user at
**Settings → Model**. The user pastes a provider key (or a local Ollama URL)
and clicks **Test**. Keys live in `localStorage` and go straight to the
provider.

## 4. Common props

| Prop | Type | Default | Purpose |
| ---- | ---- | ------- | ------- |
| `surface` | `'glass' \| 'solid'` | `'glass'` | Panel styling. |
| `theme` | `'light' \| 'dark'` | `'light'` | Theme for markdown rendering. |
| `language` | `string` | `'en'` | Answer language and default copy. |
| `renderMarkdown` | `ComponentType<{ content; theme? }>` | plain `<pre>` | Render messages. |
| `notify` | `(message, level?) => void` | no-op | Toast sink. |
| `uploadFile` | `(file: File) => Promise<string>` | — | Persist a file, return markdown. |
| `extraTools` | `AgentTool<any>[]` | `[]` | Raw tools (e.g. MCP). |
| `extraDescriptors` | `AgentToolDescriptor[]` | `[]` | Registry tools shown in the Tools panel. |
| `messages` / `translate` | copy overrides / translator | English | i18n. |
| `storagePrefix` | `string` | `'agent'` | Namespace all persisted state. |

## 5. Two agents on one page

Every agent persists its config, keys and conversations. By default that is
shared under the `agent` namespace, so two agents would collide. Give each a
`storagePrefix`:

```tsx
<ReAgent storagePrefix="assistant" />
<ReAgent storagePrefix="reviewer" />
```

Each prefix owns its own `localStorage` keys (`<prefix>.config`,
`<prefix>.credential.*`, `<prefix>.mcp.exa.apiKey`) and its own IndexedDB
database (`<prefix>-agent`; the default prefix keeps `reagent-agent`).

## 6. Custom integrations

```tsx
import { ReAgent } from '@liyu1981/reagent';
import ReactMarkdown from 'react-markdown';

<ReAgent
  renderMarkdown={({ content }) => <ReactMarkdown>{content}</ReactMarkdown>}
  uploadFile={async file => {
    const asset = await upload(file);
    return `![${asset.name}](${asset.url})`;
  }}
  notify={(message, level) => toast[level ?? 'success'](message)}
  messages={{ 'agent.chatPlaceholder': 'Ask about your data…' }}
/>
```

Tools can be provided two ways: `extraDescriptors` (full metadata, shown in the
Tools panel, toggleable) or `extraTools` (raw `AgentTool`s such as MCP servers).
Without an `extraDescriptors`/editor integration the agent has **no built-in
tools** and a generic system prompt.

## 7. Headless

`<ReAgent>` is only one arrangement. Compose `ReAgentProvider` with the exported
UI parts and hooks:

```tsx
import { ReAgentProvider, ReAgentRoot, ReAgentMessageList, useReAgent } from '@liyu1981/reagent';

function Chat() {
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

<ReAgentProvider storagePrefix="assistant">
  <Chat />
</ReAgentProvider>;
```

`useReAgent()`, `useReAgentConfig()`, `useReAgentSession()`,
`useReAgentSessions()` and `useReAgentRegistry()` expose the runtime. The
config store also works outside React via `getAgentConfig` /
`updateAgentConfig` / `subscribeAgentConfig`.

## 8. Pitfalls

- **Height:** `<ReAgent>` is `h-full`; constrain an ancestor, not the component.
- **Tailwind scope:** if `@source` is wrong, styles silently go missing. It is
  relative to the CSS file that contains it.
- **Providers:** pi-ai's full built-in provider set is registered; only providers
  whose connection was verified with `testConnection()` contribute models.
- **First run:** with no verified model the header shows a hint — that is normal
  until a key is added in Settings → Model.
- **Do not import server-side**; storage uses `localStorage` and `IndexedDB`.

## 9. Reference

- Docs: <https://liyu1981.github.io/reagent/#/docs>
- Demos (with full source): <https://liyu1981.github.io/reagent/#/demos>
- Repository: <https://github.com/liyu1981/reagent>
- npm: <https://www.npmjs.com/package/@liyu1981/reagent>
