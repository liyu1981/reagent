import type { AgentMessage, AgentTool, ThinkingLevel } from '@earendil-works/pi-agent-core';

import type { EditorMutationBridge } from './editor-mutations';
import type { ReAgentHostProviderApi } from './host-providers';

export const OLLAMA_PROVIDER_ID = 'ollama';
export const EXA_SERVER_ID = 'exa';
export const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434';
/** Default lifetime of stored API keys; `null` (keep forever) is opt-in. */
export const DEFAULT_KEY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export interface AgentModelRef {
  providerId: string;
  modelId: string;
}

export interface AgentProviderSettings {
  baseUrl?: string;
  verified?: boolean;
}

export interface ReAgentCloudModelSpec {
  id: string;
  name?: string;
  contextWindow?: number;
  maxTokens?: number;
  reasoning?: boolean;
}

/**
 * A cloud provider the host (or the end user) adds on top of ReAgent's
 * browser-verified set, in pi-ai's provider vocabulary. With only an `id` the
 * spec re-enables pi-ai's built-in provider of that id; with a `baseUrl` it
 * defines a new OpenAI/Anthropic-compatible endpoint. Stored in the agent
 * config, so it survives reloads.
 */
export interface ReAgentCloudProviderSpec {
  /** Unique provider id. Without `baseUrl` it must match a pi-ai built-in. */
  id: string;
  /** Display name in the model picker. Defaults to the id. */
  name?: string;
  /** Base URL of an OpenAI/Anthropic-compatible endpoint (creates a provider). */
  baseUrl?: string;
  /** Request shape of the endpoint. Defaults to `openai-completions`. */
  api?: ReAgentHostProviderApi;
  /** Static model ids (or entries); the live `/models` listing refreshes them. */
  models?: Array<string | ReAgentCloudModelSpec>;
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
  /** Lifetime of stored API keys in ms, or `null` to keep them forever. */
  keyRetentionMs: number | null;
  /** Extra cloud providers registered into the model registry. */
  customProviders: ReAgentCloudProviderSpec[];
  systemPrompt: AgentSystemPromptConfig;
  skills: AgentSkillConfig[];
  skillsDisabledBuiltins: string[];
  toolsDisabled: string[];
  mcp: McpServerConfig[];
  activeSessionId: string | null;
}

export type AgentToolGroup = 'content' | 'editor' | 'web' | 'skills' | 'mcp' | 'filesystem';

export interface AgentToolBuildContext {
  editor?: EditorMutationBridge;
  /** Origin-private filesystem root for filesystem tools; defaults to the browser's OPFS root. */
  opfs?: FileSystemDirectoryHandle | null;
  /** Storage prefix of the agent being built. */
  prefix?: string;
}

export interface AgentToolDescriptor {
  id: string;
  name: string;
  label: string;
  description: string;
  group: AgentToolGroup;
  requiresEditor?: boolean;
  requiresOpfs?: boolean;
  defaultEnabled?: boolean;
  /** Filesystem namespace folder under the OPFS root (`<opfs>/<namespace>/`). */
  namespace?: string;
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
  /** Inline base64 payload, used for vision images. */
  data?: string;
  /** MIME type of the inline payload (vision images may be re-encoded). */
  dataMimeType?: string;
  /** Durable reference when a file store is configured. */
  file?: ReAgentFileRef;
}

/** A file persisted by a host-provided store. */
export interface ReAgentFileRef {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  /** Store-specific relative path/location, e.g. `uploads/report.pdf`. */
  path?: string;
  /** Optional direct URL for host stores that expose files over HTTP. */
  url?: string;
}

/** Host-provided persistence for conversation attachments. */
export interface ReAgentFileStore {
  put(file: File): Promise<ReAgentFileRef>;
  get(ref: ReAgentFileRef): Promise<Blob>;
  remove?(ref: ReAgentFileRef): Promise<void>;
}

/** Opt-in conversation file attachments. */
export interface ReAgentFilesConfig {
  store: ReAgentFileStore;
  /** Passed to the composer file input; all files are accepted when omitted. */
  accept?: string;
  /** Reject files larger than this many bytes (default 25 MB). */
  maxBytes?: number;
}
