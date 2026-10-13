# Tools & skills

## Tools

ReAgent ships **no tools by default** — a bare `<ReAgent />` is just chat. Tools
come from three places:

1. **Editor tools** — built automatically when you pass an `editor`
   `EditorMutationBridge` (see [Host integrations](./host-integrations)).
2. **The skill loader** — added automatically when at least one skill is enabled.
3. **Host descriptors and raw tools** — the `extraDescriptors` and `extraTools`
   props.

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

## Descriptors

A tool descriptor is registry metadata (shown in the Tools panel) plus a lazy
factory:

```ts
interface AgentToolDescriptor {
  id: string;
  name: string;
  label: string;
  description: string;
  group: 'content' | 'editor' | 'web' | 'skills' | 'mcp';
  requiresEditor?: boolean;
  defaultEnabled?: boolean;
  build: (ctx: { editor?: EditorMutationBridge }) => AgentTool<any>;
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
