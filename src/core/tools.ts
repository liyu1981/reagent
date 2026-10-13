import type { AgentTool } from '@earendil-works/pi-agent-core';
import { Type, type TSchema } from '@earendil-works/pi-ai';

import type { AgentToolBuildContext, AgentToolDescriptor, AgentToolGroup } from './types';
import { buildUseSkillTool, enabledSkillDefinitions, USE_SKILL_TOOL_ID } from './skill-registry';
import type { EditorMutationBridge } from './editor-mutations';

function textBlocks(...texts: string[]) {
  return {
    content: texts.filter(t => t !== '').map(text => ({ type: 'text' as const, text })),
    details: {},
  };
}

function requireEditor(editor: EditorMutationBridge | undefined): EditorMutationBridge {
  if (editor === undefined) {
    throw new Error('No editor is open — this tool requires the editor page.');
  }
  return editor;
}

/**
 * Wrap a tool factory in a registry descriptor. The metadata (id/label/
 * description) is read from a probe build at module load; only the descriptor's
 * `build` ever runs against a real editor.
 */
function defineTool<S extends TSchema>(
  group: AgentToolGroup,
  requiresEditor: boolean,
  factory: (ctx: AgentToolBuildContext) => AgentTool<S>,
): AgentToolDescriptor {
  const probe = factory({});
  return {
    id: probe.name,
    name: probe.name,
    label: probe.label,
    description: probe.description,
    group,
    requiresEditor,
    build: factory as (ctx: AgentToolBuildContext) => AgentTool<any>,
  };
}

/**
 * The editor tool set. These are only built (and only listed in the Tools
 * panel) when the host supplies an `EditorMutationBridge`, so a host without an
 * editor pays nothing. Content search, tags, web fetch and front-matter are
 * supplied by the host as injected descriptors.
 */
export const EDITOR_TOOLS: AgentToolDescriptor[] = [
  defineTool('editor', true, ctx => ({
    name: 'get_content',
    label: 'Get content',
    description:
      "Return the current editor's markdown content (without the frontmatter section). Requires the editor page to be open.",
    parameters: Type.Object({}),
    execute: async () => {
      const ed = requireEditor(ctx.editor);
      const content = ed.getContent();
      return textBlocks(content || '(empty)');
    },
  })),

  defineTool('editor', true, ctx => ({
    name: 'update_content',
    label: 'Update content',
    description:
      'Stage a replacement for the FULL markdown body of the open editor (without the frontmatter section). Only use this when changing the whole document. If the user is revising a selected chunk, use update_selection instead — never update_content. The editor is NOT modified yet — the change is held and shown in the review dialog after you call save, where the user accepts, edits or rejects it.',
    parameters: Type.Object({
      content_md: Type.String({
        description:
          'New FULL markdown body (must NOT include frontmatter --- delimiters). Not a fragment.',
      }),
    }),
    execute: async (_id, args) => {
      const ed = requireEditor(ctx.editor);
      ed.setContent((args as { content_md: string }).content_md);
      return textBlocks('Replaced the content section in the editor (not yet saved).');
    },
  })),

  defineTool('editor', true, ctx => ({
    name: 'get_selection',
    label: 'Get selection',
    description:
      "Return the user's current editor selection as markdown, expanded to whole blocks. Returns 'No selection.' when nothing is selected. Requires the editor page to be open.",
    parameters: Type.Object({}),
    execute: async () => {
      const ed = requireEditor(ctx.editor);
      const selection = ed.getSelection();
      if (selection === null) {
        return textBlocks('No selection.');
      }
      return textBlocks(selection.markdown || '(empty selection)');
    },
  })),

  defineTool('editor', true, ctx => ({
    name: 'update_selection',
    label: 'Update selection',
    description:
      "Stage a replacement for only the user's current editor selection (whole blocks) — the rest of the document is untouched. Always use this (never update_content) when the user's message starts with 'Revise the following selection' or otherwise targets a selected chunk. Pass ONLY the revised markdown for the selection. The editor is NOT modified until the user finishes the review dialog opened by save.",
    parameters: Type.Object({
      content_md: Type.String({
        description:
          'Full revised markdown for the selection (must NOT include frontmatter --- delimiters)',
      }),
    }),
    execute: async (_id, args) => {
      const ed = requireEditor(ctx.editor);
      ed.updateSelection((args as { content_md: string }).content_md);
      return textBlocks('Replaced the selection in the editor (not yet saved).');
    },
  })),

  defineTool('editor', true, ctx => ({
    name: 'get_commit_note',
    label: 'Get commit note',
    description:
      'Return the current value of the editor\'s "Commit Note" field. This text is used as the commit message when the user saves the page. Requires the editor page to be open.',
    parameters: Type.Object({}),
    execute: async () => {
      const ed = requireEditor(ctx.editor);
      const note = ed.getCommitNote();
      return textBlocks(note || '(empty)');
    },
  })),

  defineTool('editor', true, ctx => ({
    name: 'set_commit_note',
    label: 'Set commit note',
    description:
      'Set the editor\'s "Commit Note" field. This becomes the commit message recorded when the user saves the page. Keep it short and descriptive (e.g. "Fix typo in intro"). Mutates the editor UI only — the value is persisted when the user clicks Save. Use get_commit_note first to see the current value.',
    parameters: Type.Object({
      commit_note: Type.String({
        description: 'Short commit message used for the next save',
      }),
    }),
    execute: async (_id, args) => {
      const ed = requireEditor(ctx.editor);
      const note = (args as { commit_note: string }).commit_note.trim();
      if (note === '') {
        throw new Error('commit_note cannot be empty.');
      }
      ed.setCommitNote(note);
      return textBlocks(`Set the commit note to: ${note}`);
    },
  })),

  defineTool('editor', true, ctx => ({
    name: 'save',
    label: 'Save draft',
    description:
      "Submit your staged content changes for the user's review. Opens the review dialog where the user decides which changes to keep; the editor is only updated after they finish the review, and nothing is persisted to the server (the user saves afterwards). Call this once after you finish editing.",
    parameters: Type.Object({}),
    execute: async () => {
      const ed = requireEditor(ctx.editor);
      ed.openReview();
      return textBlocks(
        'Changes submitted for review. The user will review the diff and save. You can consider this task complete.',
      );
    },
  })),
];

/**
 * The on-demand skill loader. Advertised only when at least one skill is
 * enabled, so a skill-less agent has no dead tool in its toolbox.
 */
export const SKILL_TOOL_DESCRIPTOR: AgentToolDescriptor = {
  id: USE_SKILL_TOOL_ID,
  name: USE_SKILL_TOOL_ID,
  label: 'Use skill',
  description:
    'Load the full instructions for one of the available skills by its exact name. Call this when a task matches a skill description, then follow the returned instructions.',
  group: 'skills',
  requiresEditor: false,
  build: () => buildUseSkillTool() as AgentTool<any>,
};

export interface BuildAgentToolsOptions {
  editor?: EditorMutationBridge;
  extraTools?: AgentTool<any>[];
  /** Host-injected descriptors (shown in the tools panel and built into the run). */
  extraDescriptors?: AgentToolDescriptor[];
  disabledIds?: string[];
}

/** Build the enabled tool instances from a descriptor list. */
export function buildToolsFromDescriptors(
  descriptors: AgentToolDescriptor[],
  options: BuildAgentToolsOptions = {},
): AgentTool<any>[] {
  const { editor, disabledIds = [] } = options;
  const disabled = new Set(disabledIds);
  const out: AgentTool<any>[] = [];
  for (const descriptor of descriptors) {
    if (disabled.has(descriptor.id)) {
      continue;
    }
    if (descriptor.requiresEditor === true && editor === undefined) {
      continue;
    }
    out.push(descriptor.build({ editor }));
  }
  return out;
}

/**
 * Descriptors that are live for the current runtime: editor tools when an
 * editor is open, the skill loader when skills are enabled, plus every
 * host-injected descriptor.
 */
export function activeToolDescriptors(options: {
  editor?: EditorMutationBridge;
  extraDescriptors?: AgentToolDescriptor[];
}): AgentToolDescriptor[] {
  const { editor, extraDescriptors = [] } = options;
  return [
    ...(editor !== undefined ? EDITOR_TOOLS : []),
    ...(enabledSkillDefinitions().length > 0 ? [SKILL_TOOL_DESCRIPTOR] : []),
    ...extraDescriptors,
  ];
}

/** The active descriptors plus any raw extra tools (e.g. MCP). */
export function buildAgentTools(options: BuildAgentToolsOptions = {}): AgentTool<any>[] {
  const { editor, extraTools = [], extraDescriptors = [], disabledIds } = options;
  return [
    ...buildToolsFromDescriptors(activeToolDescriptors({ editor, extraDescriptors }), {
      editor,
      disabledIds,
    }),
    ...extraTools,
  ];
}

/** Every descriptor the Tools panel should list for the current runtime. */
export function listToolDescriptors(
  extraDescriptors: AgentToolDescriptor[] = [],
  options: { hasEditor?: boolean; hasSkills?: boolean } = {},
): AgentToolDescriptor[] {
  return [
    ...(options.hasEditor === true ? EDITOR_TOOLS : []),
    ...(options.hasSkills === true ? [SKILL_TOOL_DESCRIPTOR] : []),
    ...extraDescriptors,
  ];
}
