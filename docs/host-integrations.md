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

## File attachments

Attachments are opt-in. Pass a `ReAgentFileStore` to keep any file in the
conversation, preview it, and download it later. With a store configured, the
composer accepts all file types (or only the types in `accept`), and the
user-message renderer shows a file card instead of dropping the attachment.
Previews open **inside the ReAgent panel**; they are not page-level dialogs.

```tsx
import { createOpfsFileStore } from '@liyu1981/reagent';

<ReAgent files={{ store: createOpfsFileStore('notes') }} />;
```

ReAgent ships an OPFS-backed store so files never leave the browser. Pair it
with the filesystem tools to let the model read text files:

```tsx
import { createOpfsFiles } from '@liyu1981/reagent';

const files = createOpfsFiles('notes');

<ReAgent
  files={{ store: files.store, maxBytes: 25 * 1024 * 1024 }}
  extraDescriptors={files.descriptors}
/>;
```

A custom store only needs `put`, `get` and an optional `remove`:

```ts
type ReAgentFileStore = {
  put(file: File): Promise<ReAgentFileRef>;
  get(ref: ReAgentFileRef): Promise<Blob>;
  remove?(ref: ReAgentFileRef): Promise<void>;
};
```

`maxBytes` defaults to 25 MB. Set `accept` to narrow the file picker (MIME
patterns or extensions); omit it to accept every file type.

For files the model cannot read (PDFs, archives, …), you can still use
`uploadFile`. It receives the `File` and returns markdown to insert into the
message. Without a file store, images the active model supports are sent as
vision attachments automatically; if the model can't see images, ReAgent falls
back to `uploadFile`. When `files` is configured it takes precedence over
`uploadFile` for non-image files.

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

## Gating agent calls

`beforeAgentCall` runs **before every agent call** (every send) and may be
async. It is the place for host checks that should not interrupt the
conversation: refreshing a proxy session, re-confirming auth every few minutes,
topping up credits. Return nothing (or `true`, or `{ ok: true }`) to let the call
through; return `false` or `{ ok: false, message, ui }` to stop it. While the gate
runs — and when it blocks — the user's input, attachments and transcript are
untouched: nothing is sent to the model, nothing is appended to the
conversation.

```tsx
<ReAgent
  beforeAgentCall={async ({ session, prompt }) => {
    if (await proxy.sessionStillValid()) {
      return;
    }
    // Either await your own dialog here…
    // await openReAuthDialog();
    // …or hand the user a UI to click, rendered in the transcript:
    return {
      ok: false,
      message: 'Your proxy session expired. Confirm it to send this message.',
      ui: <ReAuthButton />,
    };
  }}
/>;
```

The block is rendered by `<ReAgentCallGateNotice />`, which the preset already
places between the transcript and the composer. `ui` runs inside the provider,
so it can call `useReAgent().send()` to retry; the input is still there, and the
gate runs again. A gate that throws counts as a block, with the error message as
the reason.

Headless layouts (`ReAgentProvider` + your own parts) read the same state from
`useReAgent()`:

```ts
const { gating, callBlock, clearCallBlock } = useReAgent();
// gating        — a gate is running; the send button should be disabled
// callBlock     — { message?, ui? } of the last block, or null
// clearCallBlock()
```

Types: `ReAgentCallContext` (`session`, `model`, `prompt`, `attachmentCount`),
`ReAgentCallDecision` and `ReAgentCallGate`. The gate runs once per send, not per
model round-trip — tool-call continuations inside one turn are not gated.

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
