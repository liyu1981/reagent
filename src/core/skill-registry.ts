import type { AgentTool } from '@earendil-works/pi-agent-core';
import { Type } from '@earendil-works/pi-ai';

import { getAgentConfig } from './config';
import { DEFAULT_STORAGE_PREFIX } from './storage';
import type { AgentConfig, AgentSkillDefinition } from './types';

/**
 * Skill registry for the agent: a small built-in set (code-defined, toggleable)
 * merged with the user's custom, browser-stored skills. Only the enabled ones
 * are advertised in the system prompt; full bodies load on demand through the
 * `use_skill` tool.
 */

export const USE_SKILL_TOOL_ID = 'use_skill';

/*
 * ReAgent ships no built-in skills on purpose: skills are entirely
 * host-defined. Add them to the `AgentConfig` (`skills`) — or let users create
 * them in Settings → Skills — and they are advertised through the system
 * prompt and loaded on demand via the `use_skill` tool. The constant remains so
 * a host can fork the package and ship its own code-defined set.
 */
export const BUILTIN_SKILLS: AgentSkillDefinition[] = [];

export function listSkillDefinitions(
  config: AgentConfig = getAgentConfig(),
): AgentSkillDefinition[] {
  const disabled = new Set(config.skillsDisabledBuiltins);
  const builtins = BUILTIN_SKILLS.map(skill => ({
    ...skill,
    enabled: !disabled.has(skill.id),
  }));
  const custom: AgentSkillDefinition[] = config.skills.map(skill => ({
    id: skill.id,
    name: skill.name,
    description: skill.description,
    content: skill.content,
    source: 'custom',
    enabled: skill.enabled,
  }));
  return [...builtins, ...custom];
}

export function enabledSkillDefinitions(
  config: AgentConfig = getAgentConfig(),
): AgentSkillDefinition[] {
  return listSkillDefinitions(config).filter(skill => skill.enabled && skill.name.trim() !== '');
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * The system-prompt section advertising enabled skills. Empty when there are
 * none. Full skill content is deliberately withheld — the model loads it via
 * the `use_skill` tool.
 */
export function skillsSystemPrompt(config: AgentConfig = getAgentConfig()): string {
  const skills = enabledSkillDefinitions(config);
  if (skills.length === 0) {
    return '';
  }

  const lines = [
    '## Skills',
    'You can load specialized instructions for specific tasks. When a task matches a skill description below, call the `use_skill` tool with the skill name, then follow the returned instructions.',
    '',
    '<available_skills>',
  ];

  for (const skill of skills) {
    lines.push('  <skill>');
    lines.push(`    <name>${escapeXml(skill.name)}</name>`);
    lines.push(`    <description>${escapeXml(skill.description)}</description>`);
    lines.push('  </skill>');
  }

  lines.push('</available_skills>');
  return lines.join('\n');
}

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }], details: {} };
}

const useSkillParameters = Type.Object({
  name: Type.String({ description: 'Exact name of the skill to load' }),
});

/** The on-demand skill loader. Reads the live registry on every call. */
export function buildUseSkillTool(
  prefix: string = DEFAULT_STORAGE_PREFIX,
): AgentTool<typeof useSkillParameters> {
  return {
    name: USE_SKILL_TOOL_ID,
    label: 'Use skill',
    description:
      'Load the full instructions for one of the available skills by its exact name. Call this when a task matches a skill description, then follow the returned instructions.',
    parameters: useSkillParameters,
    execute: async (_id, args) => {
      const skills = enabledSkillDefinitions(getAgentConfig(prefix));
      const wanted = args.name.trim().toLowerCase();
      const skill = skills.find(candidate => candidate.name.trim().toLowerCase() === wanted);

      if (skill === undefined) {
        const names = skills.map(candidate => candidate.name);
        const hint = names.length > 0 ? names.join(', ') : 'none configured';
        return textResult(`No enabled skill named "${args.name}". Available skills: ${hint}.`);
      }

      return textResult(`<skill name="${skill.name}">\n${skill.content}\n</skill>`);
    },
  };
}

/** Enabled skill tools (empty when no skill is enabled). */
export function buildSkillTools(prefix: string = DEFAULT_STORAGE_PREFIX): AgentTool<any>[] {
  return enabledSkillDefinitions(getAgentConfig(prefix)).length === 0
    ? []
    : [buildUseSkillTool(prefix)];
}
