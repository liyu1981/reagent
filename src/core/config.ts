import type { ThinkingLevel } from '@earendil-works/pi-agent-core';

import { DEFAULT_STORAGE_PREFIX, storageKey } from './storage';
import type { AgentConfig, AgentSkillConfig, McpServerConfig } from './types';
import { DEFAULT_OLLAMA_BASE_URL } from './types';

/**
 * The single source of truth for every agent knob that used to be scattered
 * across `agent.lastModel`, `agent.ollama.baseUrl`, `agent.skills`,
 * `agent.systemPrompt.custom`, `agent.mcp.servers`, … A versioned snapshot is
 * persisted under one namespaced localStorage key and exposed through a tiny
 * external store so React and the agent runtime share it.
 *
 * State is kept per storage prefix, so several agents can coexist on one page.
 */

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
function migrateLegacy(prefix: string): AgentConfig {
  const config = defaultAgentConfig();

  const lastModel = readJson<{ providerId: string; modelId: string }>(
    storageKey(prefix, 'lastModel'),
  );
  if (lastModel !== undefined && typeof lastModel.providerId === 'string') {
    config.model = lastModel;
  }

  const ollamaBase = localStorage.getItem(storageKey(prefix, 'ollama.baseUrl'));
  if (ollamaBase !== null) {
    config.providers.ollama = { ...config.providers.ollama, baseUrl: ollamaBase };
  }

  const verified = readJson<string[]>(storageKey(prefix, 'verified.providers'));
  if (Array.isArray(verified)) {
    for (const id of verified) {
      config.providers[id] = { ...config.providers[id], verified: true };
    }
  }

  const skills = readJson<unknown>(storageKey(prefix, 'skills'));
  if (Array.isArray(skills)) {
    config.skills = skills.filter(isSkillConfig);
  }

  const customPrompt = localStorage.getItem(storageKey(prefix, 'systemPrompt.custom'));
  if (customPrompt !== null && customPrompt.trim() !== '') {
    config.systemPrompt = { mode: 'custom', custom: customPrompt };
  }

  const servers = readJson<McpServerConfig[]>(storageKey(prefix, 'mcp.servers'));
  if (Array.isArray(servers) && servers.length > 0) {
    config.mcp = servers;
  }

  return config;
}

const caches = new Map<string, AgentConfig>();
const listenerSets = new Map<string, Set<() => void>>();

function listenersFor(prefix: string): Set<() => void> {
  let set = listenerSets.get(prefix);
  if (set === undefined) {
    set = new Set();
    listenerSets.set(prefix, set);
  }
  return set;
}

function loadAgentConfig(prefix: string): AgentConfig {
  const stored = readJson<AgentConfig>(storageKey(prefix, 'config'));
  if (stored !== undefined) {
    return normalize(stored);
  }
  const migrated = migrateLegacy(prefix);
  persistAgentConfig(prefix, migrated);
  return migrated;
}

function persistAgentConfig(prefix: string, config: AgentConfig): void {
  try {
    localStorage.setItem(storageKey(prefix, 'config'), JSON.stringify(config));
  } catch {
    // quota / privacy mode — keep the in-memory copy
  }
}

export function getAgentConfig(prefix: string = DEFAULT_STORAGE_PREFIX): AgentConfig {
  let cache = caches.get(prefix);
  if (cache === undefined) {
    cache = loadAgentConfig(prefix);
    caches.set(prefix, cache);
  }
  return cache;
}

export function setAgentConfig(
  next: AgentConfig,
  prefix: string = DEFAULT_STORAGE_PREFIX,
): AgentConfig {
  caches.set(prefix, next);
  persistAgentConfig(prefix, next);
  for (const listener of listenersFor(prefix)) {
    listener();
  }
  return next;
}

export function updateAgentConfig(
  patch: Partial<AgentConfig>,
  prefix: string = DEFAULT_STORAGE_PREFIX,
): AgentConfig {
  return setAgentConfig({ ...getAgentConfig(prefix), ...patch }, prefix);
}

export function subscribeAgentConfig(
  listener: () => void,
  prefix: string = DEFAULT_STORAGE_PREFIX,
): () => void {
  const listeners = listenersFor(prefix);
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
