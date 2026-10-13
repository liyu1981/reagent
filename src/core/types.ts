import type { AgentMessage, AgentTool, ThinkingLevel } from '@earendil-works/pi-agent-core';

import type { EditorMutationBridge } from './editor-mutations';

export const OLLAMA_PROVIDER_ID = 'ollama';
export const EXA_SERVER_ID = 'exa';
export const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434';

export interface AgentModelRef {
  providerId: string;
  modelId: string;
}

export interface AgentProviderSettings {
  baseUrl?: string;
  verified?: boolean;
}

export interface AgentSkillConfig {
  id: string;
  name: string;
  description: string;
  content: string;
  enabled: boolean;
}

export interface AgentSystemPromptConfig {
  mode: 'default' | 'custom';
  custom: string;
}

export interface McpServerConfig {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
}

export interface AgentConfig {
  version: 1;
  model: AgentModelRef | null;
  thinkingLevel: ThinkingLevel;
  providers: Record<string, AgentProviderSettings>;
  systemPrompt: AgentSystemPromptConfig;
  skills: AgentSkillConfig[];
  skillsDisabledBuiltins: string[];
  toolsDisabled: string[];
  mcp: McpServerConfig[];
  activeSessionId: string | null;
}

export type AgentToolGroup = 'content' | 'editor' | 'web' | 'skills' | 'mcp';

export interface AgentToolBuildContext {
  editor?: EditorMutationBridge;
}

export interface AgentToolDescriptor {
  id: string;
  name: string;
  label: string;
  description: string;
  group: AgentToolGroup;
  requiresEditor?: boolean;
  defaultEnabled?: boolean;
  build: (ctx: AgentToolBuildContext) => AgentTool<any>;
}

export interface AgentSkillDefinition {
  id: string;
  name: string;
  description: string;
  content: string;
  source: 'builtin' | 'custom';
  enabled: boolean;
}

export interface AgentSession {
  id: string;
  parentId: string | null;
  forkFromIndex: number | null;
  title: string;
  providerId: string;
  modelId: string;
  thinkingLevel: ThinkingLevel;
  systemPrompt: string;
  createdAt: number;
  updatedAt: number;
  messages: AgentMessage[];
}

export interface AgentSessionNode extends AgentSession {
  children: AgentSessionNode[];
}

export interface AgentDraft {
  slug: string;
  title: string;
  content: string;
}

/** Structural selection type so hosts don't share a type with the package. */
export interface ReAgentSelection {
  from: number;
  to: number;
  markdown: string;
}

export interface ToolChip {
  id: string;
  name: string;
  label: string;
  status: 'running' | 'done' | 'error';
  args?: Record<string, unknown>;
  result?: unknown;
}

export interface AgentAttachment {
  id: string;
  name: string;
  mimeType: string;
  data: string;
}
