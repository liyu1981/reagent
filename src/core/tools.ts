import type { AgentTool } from '@earendil-works/pi-agent-core';
import { type TSchema, Type } from '@earendil-works/pi-ai';
import { getAgentConfig } from './config';
import type { EditorMutationBridge } from './editor-mutations';
import { buildUseSkillTool, enabledSkillDefinitions, USE_SKILL_TOOL_ID } from './skill-registry';
import { DEFAULT_STORAGE_PREFIX } from './storage';
import type { AgentToolBuildContext, AgentToolDescriptor, AgentToolGroup } from './types';

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
 * Resolve the browser's Origin Private File System root. This is the `<opfs>`
 * prefix every filesystem namespace folder hangs off; the host never picks a
 * folder — the agent only ever works inside OPFS.
 */
export async function getOpfsRoot(): Promise<FileSystemDirectoryHandle | null> {
  const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  if (storage?.getDirectory === undefined) {
    return null;
  }
  try {
    return await storage.getDirectory();
  } catch {
    return null;
  }
}

interface ToolRequirements {
  editor?: boolean;
  opfs?: boolean;
}

/**
 * Wrap a tool factory in a registry descriptor. The metadata (id/label/
 * description) is read from a probe build at module load; only the descriptor's
 * `build` ever runs against a real editor / filesystem.
 */
function defineTool<S extends TSchema>(
  group: AgentToolGroup,
  requires: ToolRequirements,
  factory: (ctx: AgentToolBuildContext) => AgentTool<S>,
): AgentToolDescriptor {
  const probe = factory({});
  return {
    id: probe.name,
    name: probe.name,
    label: probe.label,
    description: probe.description,
    group,
    requiresEditor: requires.editor,
    requiresOpfs: requires.opfs,
    namespace: (probe as AgentTool<S> & { namespace?: string }).namespace,
    build: factory as (ctx: AgentToolBuildContext) => AgentTool<any>,
  };
}

function opfsSegments(path: string | undefined): string[] {
  if (path === undefined) {
    return [];
  }
  return path
    .split('/')
    .map(segment => segment.trim())
    .filter(segment => segment !== '' && segment !== '.');
}

async function resolveOpfsDir(
  handle: FileSystemDirectoryHandle,
  namespace: string,
  segments: string[],
  create: boolean,
): Promise<FileSystemDirectoryHandle> {
  // The first hop is the per-agent namespace folder.
  let dir: FileSystemDirectoryHandle = await handle.getDirectoryHandle(namespace, { create });
  for (const segment of segments) {
    dir = await dir.getDirectoryHandle(segment, { create });
  }
  return dir;
}

export interface OpfsStats {
  files: number;
  bytes: number;
}

async function collectOpfsStats(dir: FileSystemDirectoryHandle): Promise<OpfsStats> {
  let files = 0;
  let bytes = 0;
  for await (const [, entry] of dir) {
    if (entry.kind === 'directory') {
      const nested = await collectOpfsStats(entry);
      files += nested.files;
      bytes += nested.bytes;
      continue;
    }
    const file = await entry.getFile();
    files += 1;
    bytes += file.size;
  }
  return { files, bytes };
}

/** Count files and bytes under an agent filesystem namespace. */
export async function getOpfsStats(
  handle: FileSystemDirectoryHandle | null | undefined,
  namespace: string,
): Promise<OpfsStats> {
  const root = handle !== undefined && handle !== null ? handle : await getOpfsRoot();
  if (root === null) {
    return { files: 0, bytes: 0 };
  }
  try {
    const dir = await root.getDirectoryHandle(namespace, { create: false });
    return await collectOpfsStats(dir);
  } catch {
    return { files: 0, bytes: 0 };
  }
}

export interface OpfsEntry {
  name: string;
  kind: 'file' | 'directory';
  size?: number;
}

/** List directory entries under an agent filesystem namespace. */
export async function listOpfsEntries(
  handle: FileSystemDirectoryHandle | null | undefined,
  namespace: string,
  path: string[],
): Promise<OpfsEntry[]> {
  const root = handle !== undefined && handle !== null ? handle : await getOpfsRoot();
  if (root === null) {
    return [];
  }
  let dir: FileSystemDirectoryHandle;
  try {
    dir = await resolveOpfsDir(root, namespace, path, false);
  } catch {
    return [];
  }
  const entries: OpfsEntry[] = [];
  for await (const [name, entry] of dir) {
    const kind = entry.kind === 'directory' ? ('directory' as const) : ('file' as const);
    let size: number | undefined;
    if (kind === 'file') {
      size = (await (entry as FileSystemFileHandle).getFile()).size;
    }
    entries.push({ name, kind, size });
  }
  return entries;
}

/**
 * The built-in OPFS (Origin Private File System) tool set. Returns descriptors
 * for one per-agent namespace folder under the browser's Origin Private File
 * System root — the tools work inside `<opfs>/<id>/` and create the folder when
 * it does not exist yet. Hosts install them by passing the result as
 * `extraDescriptors`.
 */
export function getFileSystemTools(id: string): AgentToolDescriptor[] {
  return [
    defineTool('filesystem', { opfs: true }, ctx => ({
      name: 'opfs_list',
      namespace: id,
      label: 'List files',
      description: `List the files and folders in the agent filesystem (Origin Private File System) under "${id}". Paths are relative to the agent filesystem root.`,
      parameters: Type.Object({
        path: Type.Optional(
          Type.String({
            description:
              'Directory to list, relative to the agent filesystem root. Defaults to the root.',
          }),
        ),
      }),
      execute: async (_toolCallId, args) => {
        const handle = ctx.opfs ?? (await getOpfsRoot());
        if (handle === undefined || handle === null) {
          throw new Error(
            'No filesystem is available — no Origin Private File System directory was found.',
          );
        }
        const segments = opfsSegments((args as { path?: string }).path);
        const dir = await resolveOpfsDir(handle, id, segments, true);
        const lines: string[] = [];
        for await (const [name, entry] of dir) {
          lines.push(entry.kind === 'directory' ? `${name}/` : name);
        }
        return textBlocks(lines.length > 0 ? lines.join('\n') : '(empty)');
      },
    })),

    defineTool('filesystem', { opfs: true }, ctx => ({
      name: 'opfs_read',
      namespace: id,
      label: 'Read file',
      description: `Read a text file from the agent filesystem (Origin Private File System) under "${id}". Paths are relative to the agent filesystem root.`,
      parameters: Type.Object({
        path: Type.String({
          description: 'File path, relative to the agent filesystem root.',
        }),
      }),
      execute: async (_toolCallId, args) => {
        const handle = ctx.opfs ?? (await getOpfsRoot());
        if (handle === undefined || handle === null) {
          throw new Error(
            'No filesystem is available — no Origin Private File System directory was found.',
          );
        }
        const segments = opfsSegments((args as { path: string }).path);
        if (segments.length === 0) {
          throw new Error('A file path is required.');
        }
        const file = await (
          await resolveOpfsDir(handle, id, segments.slice(0, -1), true)
        ).getFileHandle(segments[segments.length - 1]);
        const content = await (await file.getFile()).text();
        return textBlocks(content || '(empty)');
      },
    })),

    defineTool('filesystem', { opfs: true }, ctx => ({
      name: 'opfs_write',
      namespace: id,
      label: 'Write file',
      description: `Write (create or overwrite) a text file in the agent filesystem (Origin Private File System) under "${id}". Paths are relative to the agent filesystem root.`,
      parameters: Type.Object({
        path: Type.String({
          description: 'File path, relative to the agent filesystem root.',
        }),
        content: Type.String({
          description: 'Full content to write to the file.',
        }),
      }),
      execute: async (_toolCallId, args) => {
        const handle = ctx.opfs ?? (await getOpfsRoot());
        if (handle === undefined || handle === null) {
          throw new Error(
            'No filesystem is available — no Origin Private File System directory was found.',
          );
        }
        const segments = opfsSegments((args as { path: string }).path);
        if (segments.length === 0) {
          throw new Error('A file path is required.');
        }
        const parentSegments = segments.slice(0, -1);
        const file = await (await resolveOpfsDir(handle, id, parentSegments, true)).getFileHandle(
          segments[segments.length - 1],
          { create: true },
        );
        const writable = await file.createWritable();
        await writable.write((args as { content: string }).content);
        await writable.close();
        return textBlocks('Wrote file.');
      },
    })),
  ];
}

/**
 * The editor tool set. These are only built (and only listed in the Tools
 * panel) when the host supplies an `EditorMutationBridge`, so a host without an
 * editor pays nothing. Content search, tags, web fetch and front-matter are
 * supplied by the host as injected descriptors.
 */
export const EDITOR_TOOLS: AgentToolDescriptor[] = [
  defineTool('editor', { editor: true }, ctx => ({
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

  defineTool('editor', { editor: true }, ctx => ({
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

  defineTool('editor', { editor: true }, ctx => ({
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

  defineTool('editor', { editor: true }, ctx => ({
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

  defineTool('editor', { editor: true }, ctx => ({
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

  defineTool('editor', { editor: true }, ctx => ({
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

  defineTool('editor', { editor: true }, ctx => ({
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
  build: ctx => buildUseSkillTool(ctx.prefix) as AgentTool<any>,
};

export interface BuildAgentToolsOptions {
  editor?: EditorMutationBridge;
  /** Origin-private filesystem root override for filesystem tools; defaults to the browser's OPFS root. */
  opfs?: FileSystemDirectoryHandle | null;
  extraTools?: AgentTool<any>[];
  /** Host-injected descriptors (shown in the tools panel and built into the run). */
  extraDescriptors?: AgentToolDescriptor[];
  disabledIds?: string[];
  /** Storage prefix the skill registry should read from. */
  prefix?: string;
}

/** Build the enabled tool instances from a descriptor list. */
export function buildToolsFromDescriptors(
  descriptors: AgentToolDescriptor[],
  options: BuildAgentToolsOptions = {},
): AgentTool<any>[] {
  const { editor, opfs, disabledIds = [], prefix } = options;
  const disabled = new Set(disabledIds);
  const out: AgentTool<any>[] = [];
  for (const descriptor of descriptors) {
    if (disabled.has(descriptor.id)) {
      continue;
    }
    if (descriptor.requiresEditor === true && editor === undefined) {
      continue;
    }
    out.push(descriptor.build({ editor, opfs, prefix }));
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
  hasSkills?: boolean;
}): AgentToolDescriptor[] {
  const { editor, extraDescriptors = [], hasSkills = false } = options;
  return [
    ...(editor !== undefined ? EDITOR_TOOLS : []),
    ...(hasSkills ? [SKILL_TOOL_DESCRIPTOR] : []),
    ...extraDescriptors,
  ];
}

/** The active descriptors plus any raw extra tools (e.g. MCP). */
export function buildAgentTools(options: BuildAgentToolsOptions = {}): AgentTool<any>[] {
  const {
    editor,
    opfs,
    extraTools = [],
    extraDescriptors = [],
    disabledIds,
    prefix = DEFAULT_STORAGE_PREFIX,
  } = options;
  const hasSkills = enabledSkillDefinitions(getAgentConfig(prefix)).length > 0;
  return [
    ...buildToolsFromDescriptors(activeToolDescriptors({ editor, extraDescriptors, hasSkills }), {
      editor,
      opfs,
      disabledIds,
      prefix,
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
