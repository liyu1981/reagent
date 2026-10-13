import { getAgentConfig, updateAgentConfig } from './config';

/**
 * User-editable system prompt for the in-editor agent.
 *
 * The custom prompt is stored in the shared `AgentConfig` (browser-local).
 * When set it replaces the built-in `agent.systemPrompt` text; `{{language}}`
 * is still interpolated so the assistant answers in the UI language.
 */

/** The raw custom system prompt, or '' when the built-in one is in use. */
export function getCustomSystemPrompt(): string {
  const config = getAgentConfig();
  return config.systemPrompt.mode === 'custom' ? config.systemPrompt.custom : '';
}

/**
 * Save a custom system prompt. Whitespace-only input clears the override and
 * restores the built-in prompt.
 */
export function setCustomSystemPrompt(text: string): void {
  if (text.trim() === '') {
    clearCustomSystemPrompt();
    return;
  }
  updateAgentConfig({ systemPrompt: { mode: 'custom', custom: text } });
}

export function clearCustomSystemPrompt(): void {
  updateAgentConfig({ systemPrompt: { mode: 'default', custom: '' } });
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
export function resolveSystemPrompt(defaultPrompt: string, language: string): string {
  const custom = getCustomSystemPrompt();
  if (custom.trim() === '') {
    return defaultPrompt;
  }
  return custom.replaceAll('{{language}}', language);
}
