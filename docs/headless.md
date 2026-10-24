# Headless usage

`<ReAgent />` is only *one* arrangement of the parts. For a completely custom
UI, use `ReAgentProvider` with the hooks and, optionally, some of the exported
UI parts.

## Provider + hooks

```tsx
import {
  ReAgentProvider,
  useReAgent,
  useReAgentSession,
  ReAgentRoot,
  ReAgentMessageList,
  ReAgentComposer,
  ReAgentComposerInput,
  ReAgentSendButton,
} from '@liyu1981/reagent';

function MinimalChat() {
  const { status, send, stop } = useReAgent();
  const { messages } = useReAgentSession();

  return (
    <ReAgentRoot className="flex h-full flex-col border">
      <ReAgentMessageList className="flex-1" />
      <div className="flex gap-2 border-t p-2">
        <ReAgentComposer className="flex-1">
          <ReAgentComposerInput />
        </ReAgentComposer>
        <ReAgentSendButton />
        {status === 'streaming' && <button onClick={stop}>Stop</button>}
      </div>
    </ReAgentRoot>
  );
}

export function App() {
  return (
    <div style={{ height: 600 }}>
      <ReAgentProvider theme="light">
        <MinimalChat />
      </ReAgentProvider>
    </div>
  );
}
```

Every part rendered inside the provider can call `useReAgent()`. If you use
`ReAgentFileAttachment` in a custom layout, wrap that layout in
`ReAgentFilePreviewProvider` so previews stay inside your container.

## The context value

`useReAgent()` returns:

| Field | Description |
| ----- | ----------- |
| `config`, `updateConfig` | The global `AgentConfig` snapshot and a patcher. |
| `models`, `activeModel`, `visionEnabled` | Available models and the active model's capabilities. |
| `sessions`, `sessionTree`, `activeSession` | Conversation data. |
| `createSession`, `forkSession`, `loadSession`, `renameSession`, `deleteSession` | Session actions. |
| `changeModel`, `changeThinking` | Change the active model / thinking level. |
| `status`, `streamingText`, `isThinking`, `toolCalls`, `error` | Run state. |
| `input`, `setInput`, `attachments`, `addFiles`, `removeAttachment`, `uploading` | Composer state. |
| `files` | Opt-in `ReAgentFilesConfig` (store, accept, max size — 25 MB default) or `null`. |
| `selection`, `selectionExpanded`, `toggleSelectionExpanded`, `clearSelection`, `draft` | Selection / draft state. |
| `expandedToolCalls`, `toggleToolCall` | Tool-call disclosure state. |
| `send`, `stop` | Run the agent / abort it. |
| `view`, `setView`, `exaKeyPrompt`, `setExaKeyPrompt`, `saveExaKey` | Navigation & prompts. |
| `toolLabels`, `tools` | Tool registry metadata. |
| `t`, `language`, `theme`, `notify`, `renderMarkdown` | Host integrations passed down. |

## Config without the provider

Configuration lives in an external store, so it works outside React too and in
components rendered outside the provider (e.g. a standalone `/settings` page):

```ts
import { getAgentConfig, updateAgentConfig, subscribeAgentConfig } from '@liyu1981/reagent';

updateAgentConfig({ thinkingLevel: 'high' });
const unsubscribe = subscribeAgentConfig(() => console.log(getAgentConfig()));
```

In React, prefer `useReAgentConfig()`:

```tsx
import { useReAgentConfig } from '@liyu1981/reagent';

function SettingsPage() {
  const { config, update } = useReAgentConfig();
  return (
    <button onClick={() => update({ thinkingLevel: 'high' })}>
      {config.thinkingLevel}
    </button>
  );
}
```

## Build an agent directly

If you only want the runtime and none of the UI:

```ts
import { buildAgent } from '@liyu1981/reagent';

const agent = buildAgent({
  providerId: 'openai',
  modelId: 'gpt-4o-mini',
  systemPrompt: 'You are helpful.',
  thinkingLevel: 'low',
  messages: [],
});

agent.subscribe(event => {
  if (event.type === 'message_update') console.log(event);
});

await agent.prompt('Hello');
```

---

That's the tour. Head back to the [demo](../../) to try it, or read the
[README](https://github.com/liyu1981/reagent#readme) for a condensed overview.
