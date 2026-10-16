import {
  Agent,
  type AgentMessage,
  type AgentTool,
  type ThinkingLevel,
} from '@earendil-works/pi-agent-core';
import type { EditorMutationBridge } from './editor-mutations';
import { browserSafeFetch } from './fetch';
import { getModel, getModels } from './models';
import { DEFAULT_STORAGE_PREFIX } from './storage';
import { buildAgentTools } from './tools';
import type { AgentToolDescriptor } from './types';

export interface AgentBuildOptions {
  providerId: string;
  modelId: string;
  systemPrompt: string;
  thinkingLevel: ThinkingLevel;
  messages?: AgentMessage[];
  sessionId?: string;
  editor?: EditorMutationBridge;
  /** Extra tools (e.g. MCP) merged into the built-in editor tools. */
  extraTools?: AgentTool<any>[];
  /** Host-injected descriptors merged into the registry. */
  extraDescriptors?: AgentToolDescriptor[];
  /** Registry ids of built-in tools the user switched off. */
  disabledToolIds?: string[];
  /** Storage namespace for this agent. Defaults to the shared `agent` prefix. */
  prefix?: string;
}

export function buildAgent(options: AgentBuildOptions): Agent {
  const prefix = options.prefix ?? DEFAULT_STORAGE_PREFIX;
  const model = getModel(options.providerId, options.modelId, prefix);
  if (model === undefined) {
    throw new Error(`Unknown model: ${options.providerId}/${options.modelId}`);
  }
  const agent = new Agent({
    initialState: {
      systemPrompt: options.systemPrompt,
      model,
      thinkingLevel: options.thinkingLevel,
      tools: buildAgentTools({
        editor: options.editor,
        extraTools: options.extraTools,
        extraDescriptors: options.extraDescriptors,
        disabledIds: options.disabledToolIds,
        prefix,
      }),
      messages: options.messages ?? [],
    },
    // Resolve the registry lazily at call time: the model catalog can be
    // rebuilt (e.g. after changing the Ollama base URL), and the agent must
    // follow the current instance rather than a stale capture.
    streamFn: (model, context, options) =>
      getModels(prefix).streamSimple(model, context, {
        ...options,
        fetch: browserSafeFetch(options?.fetch, model.provider),
      }),
    toolExecution: 'parallel',
    sessionId: options.sessionId,
  });
  return agent;
}
