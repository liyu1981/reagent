# Host integrations

ReAgent is provider- and document-agnostic. Everything that couples it to *your*
app is an optional prop or an exported function.

## Markdown rendering

Assistant and user messages contain markdown. By default ReAgent renders it in a
plain `<pre>`. Pass `renderMarkdown` to use your renderer:

```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function MarkdownView({ content }: { content: string; theme?: 'light' | 'dark' }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>;
}

<ReAgent renderMarkdown={MarkdownView} />;
```

## Custom tools

There are two ways to add tools.

**Descriptors** (`extraDescriptors`) are the richer option: they appear in the
built-in **Tools** settings panel, can be toggled by the user, and are built
lazily with the editor context.

```tsx
import type { AgentToolDescriptor } from '@liyu1981/reagent';
import { Type } from '@earendil-works/pi-ai';

const searchPages: AgentToolDescriptor = {
  id: 'search_pages',
  name: 'search_pages',
  label: 'Search pages',
  description: 'Full-text search across the site.',
  group: 'web',
  defaultEnabled: true,
  build: () => ({
    name: 'search_pages',
    label: 'Search pages',
    description: 'Full-text search across the site.',
    parameters: Type.Object({ query: Type.String() }),
    execute: async (_id, { query }) => ({
      content: [{ type: 'text', text: await search(query) }],
      details: {},
    }),
  }),
};

<ReAgent extraDescriptors={[searchPages]} />;
```

**Raw tools** (`extraTools`) skip the registry entirely — useful for dynamic
tools such as MCP servers:

```tsx
<ReAgent extraTools={mcpTools} />;
```

## File uploads

For files the model cannot read (PDFs, archives, …), provide `uploadFile`. It
receives the `File` and returns markdown to insert into the message. Images that
the active model supports are sent as vision attachments automatically; if the
model can't see images, ReAgent falls back to `uploadFile`.

```tsx
<ReAgent
  uploadFile={async file => {
    const asset = await api.upload(file);
    return `![${asset.name}](${asset.url})`;
  }}
/>;
```

## Notifications

Wire `notify` into your toast system:

```tsx
<ReAgent notify={(message, level) => toast[level ?? 'success'](message)} />
```

## Editor integration

If the agent should edit a document the user has open, implement
`EditorMutationBridge` and pass it as `editor`:

```ts
interface EditorMutationBridge {
  getFrontMatter: () => EditorFrontMatter;
  getFrontMatterYaml: () => string;
  setFrontMatter: (patch: FrontMatterPatch) => void;
  getContent: () => string;
  setContent: (markdown: string) => void;
  getSelection: () => ReAgentSelection | null;
  updateSelection: (markdown: string) => void;
  openReview: () => void;
  getCommitNote: () => string;
  setCommitNote: (note: string) => void;
}
```

The built-in editor tools (`get_content`, `update_content`, `get_selection`,
`update_selection`, `get_commit_note`, `set_commit_note`, `save`) are only
available while an editor is provided. Pass the open document as `draft` so the
agent can reason about it.

## Deploys and stale chunks

ReAgent (through `pi-ai`) loads provider API adapters with dynamic `import()`,
so your bundler splits them into hashed chunks. When you deploy a new build
while a user still has the old page open, a later dynamic import can 404 with
"Failed to fetch dynamically imported module". Recover by reloading once when
Vite reports a preload error:

```ts
window.addEventListener('vite:preloadError', () => window.location.reload());
```

Add a small time guard so a genuinely missing asset doesn't reload in a loop.
The demo site does exactly this in `site/src/main.tsx`.

Next: [Models & providers](./models) →
