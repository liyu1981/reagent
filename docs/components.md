# Components & props

## `<ReAgent />`

The styled preset. It wraps `ReAgentProvider` and renders the full chrome:
header, message list, composer, sessions view and settings view.

```tsx
import { ReAgent, type ReAgentProps } from '@liyu1981/reagent';
```

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `draft` | `AgentDraft \| null` | `null` | The document the user is editing, injected into the system prompt and editor tools. |
| `editor` | `EditorMutationBridge \| null` | `null` | Bridge that lets the agent stage edits into a live editor. |
| `selection` | `string \| null` | `null` | Selected text to bring into the conversation. |
| `onClearSelection` | `() => void` | — | Called when the user clears the selection chip. |
| `onClose` | `() => void` | — | When provided, shows a close button in the header. |
| `surface` | `'glass' \| 'solid'` | `'glass'` | Panel styling. |
| `className` | `string` | — | Extra classes merged onto the root. |
| `theme` | `'light' \| 'dark'` | `'light'` | Theme for markdown/rendering. |
| `language` | `string` | `'en'` | Answer language + default copy. |
| `messages` | `Partial<Record<string, string>>` | — | Copy overrides. |
| `translate` | `ReAgentTranslate` | — | Full translator (wins over `messages`). |
| `notify` | `ReAgentNotify` | no-op | Success/error notification sink. |
| `renderMarkdown` | `ReAgentMarkdown` | plain `<pre>` | Renders assistant/user markdown. |
| `uploadFile` | `(file: File) => Promise<string>` | — | Persist a non-vision file; return markdown to insert. |
| `extraTools` | `AgentTool<any>[]` | `[]` | Raw agent tools merged into the run (e.g. MCP). |
| `extraDescriptors` | `AgentToolDescriptor[]` | `[]` | Tool descriptors shown in the Tools panel and built into the run. |
| `storagePrefix` | `string` | `'agent'` | Namespace for all persisted state (localStorage + IndexedDB). See [Multiple agents & storage](./multiple-agents). |

### `ReAgentMarkdown`

```ts
type ReAgentMarkdown = ComponentType<{ content: string; theme?: ReAgentTheme }>;
```

### `ReAgentNotify`

```ts
type ReAgentNotify = (message: string, level?: 'success' | 'error') => void;
```

## UI parts

Every layer the preset uses is exported so you can build a different
arrangement. They carry `data-slot` attributes and merge `className`, but no
required visual style of their own.

| Part | Notes |
| ---- | ----- |
| `ReAgentRoot` | Layout container. |
| `ReAgentHeader` + `ReAgentSessionTreeTrigger`, `ReAgentNewSessionButton`, `ReAgentSettingsTrigger`, `ReAgentCloseButton`, `ReAgentForkButton`, `ReAgentSessionTitle` | Header controls. |
| `ReAgentMessageList` | Scrollable transcript. |
| `ReAgentMessage`, `ReAgentToolCall`, `ReAgentToolChip`, `messageText` | Message rendering primitives. |
| `ReAgentComposer` + `ReAgentComposerInput`, `ReAgentComposerRow`, `ReAgentComposerAttach`, `ReAgentComposerAttachments`, `ReAgentComposerSelectionChip`, `ReAgentComposerStatus`, `ReAgentModelPicker`, `ReAgentThinkingPicker`, `ReAgentSendButton` | The composer and its controls. |
| `ReAgentSessionsView` | Conversation-tree browser. |
| `ReAgentSettingsView` + `ReAgentModelPanel`, `ReAgentPromptPanel`, `ReAgentSkillsPanel`, `ReAgentToolsPanel`, `ReAgentMcpPanel` | Settings tabs. |

Because these call `useReAgent()`, they must be rendered inside a
`ReAgentProvider` (the presets already are).

Next: [Host integrations](./host-integrations) →
