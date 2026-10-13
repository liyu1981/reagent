import type { ThinkingLevel } from '@earendil-works/pi-agent-core';

import type { AgentConfig, AgentSkillConfig, McpServerConfig } from './types';
import { DEFAULT_OLLAMA_BASE_URL } from './types';

/**
 * The single source of truth for every agent knob that used to be scattered
 * across `agent.lastModel`, `agent.ollama.baseUrl`, `agent.skills`,
 * `agent.systemPrompt.custom`, `agent.mcp.servers`, … A versioned snapshot is
 * persisted under one localStorage key and exposed through a tiny external
 * store so React and the agent runtime share it.
 */

const CONFIG_KEY = 'agent.config';

// No MCP servers are configured by default — MCP is entirely opt-in.
export const DEFAULT_MCP_SERVERS: McpServerConfig[] = [];

export function defaultAgentConfig(): AgentConfig {
  return {
    version: 1,
    model: null,
    thinkingLevel: 'low',
    providers: { ollama: { baseUrl: DEFAULT_OLLAMA_BASE_URL } },
    systemPrompt: { mode: 'default', custom: '' },
    skills: [],
    skillsDisabledBuiltins: [],
    toolsDisabled: [],
    mcp: DEFAULT_MCP_SERVERS.map(server => ({ ...server })),
    activeSessionId: null,
  };
}

function readJson<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? undefined : (JSON.parse(raw) as T);
  } catch {
    return undefined;
  }
}

function isSkillConfig(value: unknown): value is AgentSkillConfig {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<AgentSkillConfig>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.description === 'string' &&
    typeof candidate.content === 'string' &&
    typeof candidate.enabled === 'boolean'
  );
}

function normalize(raw: Partial<AgentConfig> | undefined): AgentConfig {
  const base = defaultAgentConfig();
  if (raw === undefined) {
    return base;
  }
  const providers = { ...base.providers, ...(raw.providers ?? {}) };
  const skills = Array.isArray(raw.skills) ? raw.skills.filter(isSkillConfig) : [];
  const mcp =
    Array.isArray(raw.mcp) && raw.mcp.length > 0
      ? raw.mcp.filter(
          (server): server is McpServerConfig =>
            server !== null &&
            typeof server === 'object' &&
            typeof (server as McpServerConfig).id === 'string' &&
            typeof (server as McpServerConfig).url === 'string',
        )
      : base.mcp;
  return {
    version: 1,
    model: raw.model ?? null,
    thinkingLevel: (raw.thinkingLevel ?? base.thinkingLevel) as ThinkingLevel,
    providers,
    systemPrompt: {
      mode: raw.systemPrompt?.mode === 'custom' ? 'custom' : 'default',
      custom: typeof raw.systemPrompt?.custom === 'string' ? raw.systemPrompt.custom : '',
    },
    skills,
    skillsDisabledBuiltins: Array.isArray(raw.skillsDisabledBuiltins)
      ? raw.skillsDisabledBuiltins.filter((id): id is string => typeof id === 'string')
      : [],
    toolsDisabled: Array.isArray(raw.toolsDisabled)
      ? raw.toolsDisabled.filter((id): id is string => typeof id === 'string')
      : [],
    mcp,
    activeSessionId: typeof raw.activeSessionId === 'string' ? raw.activeSessionId : null,
  };
}

/** Build a config from the legacy per-feature localStorage keys. */
function migrateLegacy(): AgentConfig {
  const config = defaultAgentConfig();

  const lastModel = readJson<{ providerId: string; modelId: string }>('agent.lastModel');
  if (lastModel !== undefined && typeof lastModel.providerId === 'string') {
    config.model = lastModel;
  }

  const ollamaBase = localStorage.getItem('agent.ollama.baseUrl');
  if (ollamaBase !== null) {
    config.providers.ollama = { ...config.providers.ollama, baseUrl: ollamaBase };
  }

  const verified = readJson<string[]>('agent.verified.providers');
  if (Array.isArray(verified)) {
    for (const id of verified) {
      config.providers[id] = { ...config.providers[id], verified: true };
    }
  }

  const skills = readJson<unknown>('agent.skills');
  if (Array.isArray(skills)) {
    config.skills = skills.filter(isSkillConfig);
  }

  const customPrompt = localStorage.getItem('agent.systemPrompt.custom');
  if (customPrompt !== null && customPrompt.trim() !== '') {
    config.systemPrompt = { mode: 'custom', custom: customPrompt };
  }

  const servers = readJson<McpServerConfig[]>('agent.mcp.servers');
  if (Array.isArray(servers) && servers.length > 0) {
    config.mcp = servers;
  }

  return config;
}

function loadAgentConfig(): AgentConfig {
  const stored = readJson<AgentConfig>(CONFIG_KEY);
  if (stored !== undefined) {
    return normalize(stored);
  }
  const migrated = migrateLegacy();
  persistAgentConfig(migrated);
  return migrated;
}

function persistAgentConfig(config: AgentConfig): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch {
    // quota / privacy mode — keep the in-memory copy
  }
}

let cache: AgentConfig | null = null;
const listeners = new Set<() => void>();

export function getAgentConfig(): AgentConfig {
  if (cache === null) {
    cache = loadAgentConfig();
  }
  return cache;
}

export function setAgentConfig(next: AgentConfig): AgentConfig {
  cache = next;
  persistAgentConfig(next);
  for (const listener of listeners) {
    listener();
  }
  return cache;
}

export function updateAgentConfig(patch: Partial<AgentConfig>): AgentConfig {
  return setAgentConfig({ ...getAgentConfig(), ...patch });
}

export function subscribeAgentConfig(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function newSkillId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
