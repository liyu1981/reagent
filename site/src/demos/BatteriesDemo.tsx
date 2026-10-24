import type { AgentSkillConfig, AgentToolDescriptor } from '@liyu1981/reagent';
import { getFileSystemTools, ReAgent, saveMcpServers, updateAgentConfig } from '@liyu1981/reagent';
import { Type } from '@earendil-works/pi-ai';

import { AgentMarkdown } from '../components/Markdown';

/**
 * Host-defined skills. They live in the AgentConfig, are advertised to the
 * model through the system prompt, and are loaded on demand via `use_skill`.
 */
const SKILLS: AgentSkillConfig[] = [
  {
    id: 'summarize',
    name: 'Summarize',
    description: 'Use when the user asks for a summary, recap or TL;DR.',
    content: `# Summarize

Produce a tight summary:
- Lead with the single most important takeaway.
- Follow with 3–5 bullet points, one idea each.
- Keep the user's terminology; never invent facts.
- End with one sentence on what to do next, if anything.`,
    enabled: true,
  },
  {
    id: 'brainstorm',
    name: 'Brainstorm',
    description: 'Use when the user wants ideas, options or a plan for an open-ended problem.',
    content: `# Brainstorm

Generate ideas before judging them:
- Offer 5–8 distinct options, one line each.
- Favor range over depth; avoid restating the same idea.
- Then mark the two you would try first and say why in one sentence each.`,
    enabled: true,
  },
];

/** The built-in filesystem tools, installed for a per-agent namespace. */
const FILESYSTEM_TOOLS = getFileSystemTools('demo');

/** A host-defined tool: the model can ask for the current time. */
const clockTool: AgentToolDescriptor = {
  id: 'current_time',
  name: 'current_time',
  label: 'Current time',
  description: 'Return the current date and time in ISO 8601 format.',
  group: 'web',
  build: () => ({
    name: 'current_time',
    label: 'Current time',
    description: 'Return the current date and time in ISO 8601 format.',
    parameters: Type.Object({}),
    execute: async () => ({
      content: [{ type: 'text', text: new Date().toISOString() }],
      details: {},
    }),
  }),
};

/**
 * Seed the host-defined skills and connect the Exa MCP server. Call this
 * before mounting `<BatteriesDemo />` so the first session picks them up.
 */
export function prepareBatteriesDemo(): void {
  updateAgentConfig({ skills: SKILLS });
  saveMcpServers([
    { id: 'exa', name: 'Exa', url: 'https://mcp.exa.ai/mcp', enabled: true },
  ]);
}

/**
 * Skills + a custom tool + a remote MCP server, with everything else left to
 * the package defaults.
 */
export function BatteriesDemo({
  theme,
  surface = 'glass',
  notify,
}: {
  theme: 'light' | 'dark';
  surface?: 'glass' | 'solid';
  notify?: (message: string, level?: 'success' | 'error') => void;
}) {
  return (
    <ReAgent
      theme={theme}
      surface={surface}
      renderMarkdown={AgentMarkdown}
      extraDescriptors={[clockTool, ...FILESYSTEM_TOOLS]}
      notify={notify}
    />
  );
}
