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
with the artifact tools to let the model read text files:

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
async. Pass it to the preset `<ReAgent>`, or to `<ReAgentProvider>` if you build
your own layout. Use it for host checks that must not interrupt the
conversation: a proxy session that expires every few minutes, a re-auth or
top-up prompt, a quota check. While the gate runs — and when it blocks — the
typed input, the attachments and the transcript are untouched: nothing is sent
to the model and nothing is appended to the conversation.

| Gate returns | Effect |
| ------------ | ------ |
| `undefined`, `true`, `{ ok: true }` | The call continues. |
| `false`, `{ ok: false }` | The call stops; the user sees the default "not sent" line. |
| `{ ok: false, message, ui }` | The call stops with your reason, and optionally your inline UI. |
| throws / rejects | Treated as a block; the error message is the reason. |

The context is `ReAgentCallContext`: `session` (`null` when the call would start
a new conversation), `model` (`{ providerId, modelId }` or `null`), `prompt`
(the text that would be sent, selection wrapper already applied) and
`attachmentCount`. The gate runs once per send, not per model round-trip —
tool-call continuations inside a single turn are not gated.

### Waiting on a dialog

The cleanest way to re-confirm auth: `await` your own modal inside the gate. The
send button is disabled and shows a spinner while the promise is pending, and
the call continues in the same `send()` once you resolve it — no retry, no
intermediate state in the transcript.

```tsx
import { useCallback, useRef, useState } from 'react';

function useAuthGate() {
  const [open, setOpen] = useState(false);
  const answer = useRef<((ok: boolean) => void) | null>(null);

  const beforeAgentCall = useCallback(async () => {
    if (await proxy.sessionStillValid()) {
      return; // pass straight through
    }
    const ok = await new Promise<boolean>(resolve => {
      answer.current = resolve;
      setOpen(true);
    });
    return ok ? undefined : { ok: false, message: 'Re-authentication was cancelled.' };
  }, []);

  const dialog = (
    <ReAuthDialog
      open={open}
      onConfirm={async () => {
        await proxy.reauthenticate();
        answer.current?.(true);
        setOpen(false);
      }}
      onCancel={() => {
        answer.current?.(false);
        setOpen(false);
      }}
    />
  );

  return { beforeAgentCall, dialog };
}

// const { beforeAgentCall, dialog } = useAuthGate();
// <ReAgent beforeAgentCall={beforeAgentCall} /> … {dialog}
```

With a promise-based dialog manager, the gate is a one-liner:

```tsx
<ReAgent
  beforeAgentCall={async () =>
    (await host.ensureFreshSession()) ? undefined : { ok: false, message: 'Session expired.' }
  }
/>
```

### Inline host UI

When the fix does not deserve a modal, return `ui` instead: a `ReactNode`
rendered in the transcript by `<ReAgentCallGateNotice />` (the preset already
places it between the transcript and the composer, below the reason and next to
a dismiss button).

```tsx
import { useReAgent } from '@liyu1981/reagent';

function ReAuthPrompt() {
  const { send, clearCallBlock } = useReAgent(); // works: rendered inside the provider
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await proxy.reauthenticate();
            await send(); // retries the call; the gate runs again first
          } finally {
            setBusy(false);
          }
        }}
      >
        Sign in
      </button>
      <button type="button" onClick={clearCallBlock}>
        Later
      </button>
    </div>
  );
}

// in the gate:
return { ok: false, message: 'Your proxy session expired.', ui: <ReAuthPrompt /> };
```

Things to keep in mind:

- **`ui` is a snapshot.** It is a `ReactNode` held in provider state, so inline
  closures keep the values from the render in which the gate ran. Pass a
  component element (`<ReAuthPrompt />`) and let it own its hooks and state
  instead of capturing changing values in the gate.
- **Where it renders.** The notice lives inside `<ReAgentProvider>`, so
  `useReAgent()` works in your UI, and your own React contexts work as long as
  they are ancestors of `<ReAgent>`.
- **Dismissing vs. retrying.** `clearCallBlock()` drops the notice without
  sending; a successful `send()` clears it automatically. Editing the input does
  not clear it, and the typed text plus attachments survive a block.
- **Copy.** Override `agent.callBlocked` and `agent.dismiss` through the
  `messages` (or `translate`) prop.
- **No AbortSignal.** The gate gets none, so resolve your promise yourself if the
  dialog can disappear another way — otherwise `gating` stays `true` and the
  send button stays disabled.

### Building your own layout

Headless layouts (`ReAgentProvider` + the exported parts) read the same state
from `useReAgent()` and can render the block anywhere:

```ts
const { gating, callBlock, clearCallBlock } = useReAgent();
// gating         — a gate is running; disable the send button
// callBlock      — { message?, ui? } of the last block, or null
// clearCallBlock()
```

Types: `ReAgentCallContext`, `ReAgentCallDecision`, `ReAgentCallGate`,
`ReAgentCallBlock`; the normalization helper is `resolveCallGate()`.

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
