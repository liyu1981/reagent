# Tools & skills

## Tools

ReAgent ships **no tools by default** — a bare `<ReAgent />` is just chat. Tools
come from three places:

1. **Editor tools** — built automatically when you pass an `editor`
   `EditorMutationBridge` (see [Host integrations](./host-integrations)).
2. **The skill loader** — added automatically when at least one skill is enabled.
3. **Host descriptors and raw tools** — the `extraDescriptors` and `extraTools`
   props.
4. **Built-in filesystem tools** — installable via `getFileSystemTools`
   (see [Filesystem tools](#filesystem-tools)).

Editor tools, available only when an editor is supplied:

| Tool | Purpose |
| ---- | ------- |
| `get_content` | Read the current document body. |
| `update_content` | Stage a full-body replacement. |
| `get_selection` | Read the current selection as markdown. |
| `update_selection` | Stage a selection-only replacement. |
| `get_commit_note` | Read the commit note. |
| `set_commit_note` | Set the commit note. |
| `save` | Submit staged changes for review. |

Edits are **staged**, not applied: the user reviews them via `openReview()`
before anything persists.

## Filesystem tools

ReAgent ships a small set of built-in tools for the browser's Origin Private
File System (OPFS). The tools work inside `<opfs>/<id>/` — the browser's private
OPFS root plus one namespace folder named by the agent id — and create that
folder when it does not exist yet. The host never picks a folder; nothing outside
the browser's OPFS is ever touched. The tools are installed by calling
`getFileSystemTools` with the agent id and passing the result as
`extraDescriptors`. Nothing is installed by default.

```tsx
import { getFileSystemTools } from '@liyu1981/reagent';

const filesystemTools = getFileSystemTools('notes');

<ReAgentProvider editor={editor} extraDescriptors={filesystemTools}>
  {children}
</ReAgentProvider>
```

Each namespace maps to one isolated folder inside the OPFS root, so different
agents keep separate filesystems.

| Tool | Purpose |
| ---- | ------- |
| `opfs_list` | List files and folders under a path (relative to the namespace root). |
| `opfs_read` | Read a file's text content. |
| `opfs_write` | Create or overwrite a file (creates parent folders as needed). |

`opfs_write` covers create-or-overwrite; there is no separate create tool. All
paths are relative to `<opfs>/<id>/`.

### Filesystem settings UI

When filesystem tools are installed, the general settings tab renders the
filesystem section: the configured namespace, an aggregate stats line (how many
files the folder holds and how many bytes it occupies) and a **Browse files**
button. Browsing swaps the chat surface for a full-surface file browser scoped
to that namespace — folders are navigable, files are sized, and the current
folder is shown in the breadcrumb.

## Descriptors

A tool descriptor is registry metadata (shown in the Tools panel) plus a lazy
factory:

```ts
interface AgentToolDescriptor {
  id: string;
  name: string;
  label: string;
  description: string;
  group: 'content' | 'editor' | 'web' | 'skills' | 'mcp' | 'filesystem';
  requiresEditor?: boolean;
  requiresOpfs?: boolean;
  defaultEnabled?: boolean;
  build: (ctx: { editor?: EditorMutationBridge; opfs?: FileSystemDirectoryHandle | null }) => AgentTool<any>;
}
```

Pass them to `<ReAgent extraDescriptors={…} />` (or
`<ReAgentProvider extraDescriptors={…} />`). They appear in **Settings → Tools**
where users can switch them off.

Utility functions:

```ts
import {
  EDITOR_TOOLS,
  activeToolDescriptors,
  buildAgentTools,
  buildToolsFromDescriptors,
  getFileSystemTools,
  listToolDescriptors,
} from '@liyu1981/reagent';
```

## Skills

Skills are reusable instruction blocks. ReAgent ships **none** — every skill is
host-defined. Add them to the `AgentConfig` (`skills`) and they are advertised
in the system prompt; when a task matches a skill's description the model calls
`use_skill` to load its full content. Users can also create skills in
**Settings → Skills**, which are stored in `localStorage`.

```ts
import { updateAgentConfig } from '@liyu1981/reagent';

updateAgentConfig({
  skills: [
    {
      id: 'summarize',
      name: 'Summarize',
      description: 'Use when the user asks for a summary.',
      content: '# Summarize\n\nProduce a tight summary…',
      enabled: true,
    },
  ],
});
```

Helpers:

```ts
import { listSkillDefinitions, enabledSkillDefinitions, skillsSystemPrompt } from '@liyu1981/reagent';

skillsSystemPrompt();        // the "## Skills" section for the system prompt
enabledSkillDefinitions();   // the currently enabled skills
```

## System prompt

The effective prompt is `custom (if set) → built-in → + skills`. When you also
supply an editor, an editor-specific guardrail is appended as well. Manage the
custom prompt with:

```ts
import {
  getCustomSystemPrompt,
  setCustomSystemPrompt,
  clearCustomSystemPrompt,
  resolveSystemPrompt,
  EDITOR_GUARDRAIL,
} from '@liyu1981/reagent';
```

## MCP servers

No MCP servers are configured by default. Remote MCP servers are managed by
`mcpManager`; their tools are exposed to the agent and listed in the **MCP**
settings tab.

```ts
import { listMcpServers, saveMcpServers, mcpManager, syncMcpServersWithTimeout } from '@liyu1981/reagent';

saveMcpServers([{ id: 'exa', name: 'Exa', url: 'https://mcp.exa.ai/mcp', enabled: true }]);
await syncMcpServersWithTimeout();
mcpManager.getTools(); // AgentTool[]
```

Next: [Sessions & persistence](./sessions) →
