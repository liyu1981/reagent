# Quick start

The fastest path is the `<ReAgent />` preset. Give it a sized container and it
handles the chat surface, conversation tree and settings.

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

That's it. On first load ReAgent opens a new session and shows a hint that no
model is verified yet.

## Configure a model

> **Cloud providers are temporarily disabled** — calling AI gateways straight
> from the browser makes their errors opaque (missing CORS headers). See
> [Models & providers](./models). For now, use a local OpenAI-compatible
> endpoint.

1. Open the **gear** icon in the header.
2. Pick the **Model** tab.
3. Under **Custom Local LLM**, set the base URL of your OpenAI-compatible
   server — e.g. `http://localhost:11434` for Ollama — and press **Save**.
4. Press **Test**. Once verified, the model appears in the composer's picker.

Keys are stored in `localStorage` and sent directly from the browser to the
provider.

## Full-height panel

`ReAgent` fills its parent (`flex h-full`), so constrain an ancestor rather
than the component itself:

```tsx
<div className="grid h-dvh grid-cols-[1fr_380px]">
  <main>…your app…</main>
  <aside className="min-h-0 border-l">
    <ReAgent />
  </aside>
</div>
```

## Host integrations

Everything host-specific is an optional prop. A slightly richer setup:

```tsx
import { ReAgent } from '@liyu1981/reagent';

<ReAgent
  theme="dark"
  surface="solid"
  renderMarkdown={MarkdownView}
  uploadFile={async file => {
    const asset = await upload(file);
    return `![${asset.name}](${asset.url})`;
  }}
  notify={(message, level) => toast[level ?? 'success'](message)}
  messages={{ 'agent.chatPlaceholder': 'Ask about your docs…' }}
/>
```

See [Host integrations](./host-integrations) for the complete list.

Next: [Styling](./styling) →
