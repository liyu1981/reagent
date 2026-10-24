import { formatFileSize } from './attachments';
import { getAgentConfig, updateAgentConfig } from './config';
import { DEFAULT_STORAGE_PREFIX } from './storage';
import type { ReAgentFileRef } from './types';

/**
 * User-editable system prompt for the in-editor agent.
 *
 * The custom prompt is stored in the shared `AgentConfig` (browser-local).
 * When set it replaces the built-in `agent.systemPrompt` text; `{{language}}`
 * is still interpolated so the assistant answers in the UI language.
 */

/** The raw custom system prompt, or '' when the built-in one is in use. */
export function getCustomSystemPrompt(prefix: string = DEFAULT_STORAGE_PREFIX): string {
  const config = getAgentConfig(prefix);
  return config.systemPrompt.mode === 'custom' ? config.systemPrompt.custom : '';
}

/**
 * Save a custom system prompt. Whitespace-only input clears the override and
 * restores the built-in prompt.
 */
export function setCustomSystemPrompt(text: string, prefix: string = DEFAULT_STORAGE_PREFIX): void {
  if (text.trim() === '') {
    clearCustomSystemPrompt(prefix);
    return;
  }
  updateAgentConfig({ systemPrompt: { mode: 'custom', custom: text } }, prefix);
}

export function clearCustomSystemPrompt(prefix: string = DEFAULT_STORAGE_PREFIX): void {
  updateAgentConfig({ systemPrompt: { mode: 'default', custom: '' } }, prefix);
}

/**
 * Appended to the system prompt only when the host supplies an editor, so the
 * last instruction the model reads is the requirement to stage revisions
 * instead of only describing them in chat.
 */
export const EDITOR_GUARDRAIL = `## Guardrail — always stage revisions
If your reply contains new or revised content for the open draft, you MUST pass that content to update_content (the full body) or update_selection (the selection only) and then call save. Never present a revision as chat text alone: a reply that shows changed content without calling the tool is incomplete. If you did not change the draft, do not call save.`;

/**
 * Resolve the effective base prompt: the custom override when present,
 * otherwise the provided built-in default. `{{language}}` is interpolated in
 * both paths (the built-in default is usually already interpolated by i18n,
 * which is harmless).
 */
export function resolveSystemPrompt(
  defaultPrompt: string,
  language: string,
  prefix: string = DEFAULT_STORAGE_PREFIX,
): string {
  const custom = getCustomSystemPrompt(prefix);
  if (custom.trim() === '') {
    return defaultPrompt;
  }
  return custom.replaceAll('{{language}}', language);
}

/**
 * System-prompt section describing files attached to the conversation. Kept
 * out of the visible user text: the UI renders the refs as attachment cards.
 */
export function filesSystemPrompt(files: ReAgentFileRef[], hasFilesystemTools: boolean): string {
  if (files.length === 0) {
    return '';
  }
  const shown = files.slice(0, 50);
  const lines = shown.map(file => {
    const details = [file.mimeType, formatFileSize(file.size)]
      .filter(part => part !== '')
      .join(', ');
    const location = file.path !== undefined ? ` at \`${file.path}\`` : '';
    return `- ${file.name} (${details})${location}`;
  });
  if (files.length > shown.length) {
    lines.push(`- …and ${files.length - shown.length} more`);
  }
  const instruction = hasFilesystemTools
    ? 'Files are stored in your agent filesystem. Use opfs_list to inspect it and opfs_read to read text files. Do not claim to have read a binary file you cannot read.'
    : 'The files are stored for the user to preview or download; their contents are not available to you unless a tool exposes them.';
  return `## Files attached by the user\n${lines.join('\n')}\n\n${instruction}`;
}
