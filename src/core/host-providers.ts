import { type Api, createProvider, type Model, type Provider } from '@earendil-works/pi-ai';
import { anthropicMessagesApi } from '@earendil-works/pi-ai/api/anthropic-messages.lazy';
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy';
import { openAIResponsesApi } from '@earendil-works/pi-ai/api/openai-responses.lazy';
import type { ComponentType } from 'react';

/**
 * Host-injectable LLM provider.
 *
 * A host can register one (or more) of its own providers. Each ships a React
 * component that renders the host's own setup flow in Settings, and calls
 * `setConfig` when it is done. The resulting connection details live **only in
 * memory** — never in localStorage — so a host can run its own auth (OAuth,
 * an API token it already holds, …) without ReAgent persisting the secret.
 *
 * If the end user is already signed in, the host returns the config from
 * `getConfig`, so the provider is usable the moment `<ReAgent>` mounts.
 */

/** Request shapes a host provider may speak. Defaults to `openai-completions`. */
export type ReAgentHostProviderApi =
  | 'openai-completions'
  | 'openai-responses'
  | 'anthropic-messages';

/** Connection details a host hands back to ReAgent (kept in memory only). */
export interface ReAgentHostProviderConfig {
  /** Base URL of the OpenAI/Anthropic-compatible endpoint. */
  baseUrl: string;
  /** The API key / token to send. */
  apiKey: string;
  /**
   * How the key is attached to requests. Defaults to
   * `Authorization: Bearer <apiKey>`; return other headers (or override
   * `authorization`) for a different scheme.
   */
  authHeaders?: (apiKey: string) => Record<string, string>;
  /** Extra headers sent with every request. */
  headers?: Record<string, string>;
  /** Request shape. Defaults to `openai-completions`. */
  api?: ReAgentHostProviderApi;
  /** The model ids to expose. */
  models?: string[];
}

/** Props passed to a host provider's settings component. */
export interface ReAgentHostProviderProps {
  /** The current in-memory config, or `null` when not set up. */
  config: ReAgentHostProviderConfig | null;
  /** Call when setup finishes (or with `null` to sign out). */
  setConfig: (config: ReAgentHostProviderConfig | null) => void;
}

/** A host provider registration. */
export interface ReAgentHostProvider {
  /** Unique provider id (namespaces its models). */
  id: string;
  /** Display name. */
  name: string;
  /** The host's setup UI, rendered in Settings. */
  component: ComponentType<ReAgentHostProviderProps>;
  /** Return the config when the user is already signed in. */
  getConfig?: () => ReAgentHostProviderConfig | null;
}

const descriptors = new Map<string, ReAgentHostProvider>();
const configs = new Map<string, ReAgentHostProviderConfig>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

/** Subscribe to host-provider registration / config changes. */
export function subscribeHostProviders(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Register (or unregister) the host providers for this agent. */
export function registerHostProviders(providers: ReAgentHostProvider[]): void {
  const ids = new Set(providers.map(provider => provider.id));
  for (const id of [...descriptors.keys()]) {
    if (!ids.has(id)) {
      descriptors.delete(id);
      configs.delete(id);
    }
  }
  for (const provider of providers) {
    descriptors.set(provider.id, provider);
  }
}

export function getHostProviderConfig(id: string): ReAgentHostProviderConfig | null {
  return configs.get(id) ?? null;
}

/** Set (or clear with `null`) the in-memory config for a host provider. */
export function setHostProviderConfig(id: string, config: ReAgentHostProviderConfig | null): void {
  if (config === null) {
    configs.delete(id);
  } else {
    configs.set(id, config);
  }
  notify();
}

/** Headers a host provider wants on its requests, or `null` when unconfigured. */
export function hostProviderRequestHeaders(id: string): Record<string, string> | null {
  const config = configs.get(id);
  if (config === undefined) {
    return null;
  }
  const auth =
    config.authHeaders !== undefined
      ? config.authHeaders(config.apiKey)
      : { authorization: `Bearer ${config.apiKey}` };
  return { ...auth, ...(config.headers ?? {}) };
}

interface ActiveHostProvider {
  descriptor: ReAgentHostProvider;
  config: ReAgentHostProviderConfig;
}

/** Host providers with a live config, for the model registry. */
export function activeHostProviders(): ActiveHostProvider[] {
  const out: ActiveHostProvider[] = [];
  for (const [id, config] of configs) {
    const descriptor = descriptors.get(id);
    if (descriptor !== undefined) {
      out.push({ descriptor, config });
    }
  }
  return out;
}

function hostModel(
  id: string,
  providerId: string,
  baseUrl: string,
  api: ReAgentHostProviderApi,
): Model<Api> {
  return {
    id,
    name: id,
    api,
    provider: providerId,
    baseUrl,
    reasoning: false,
    input: ['text'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128_000,
    maxTokens: 32_000,
    compat: { supportsDeveloperRole: false, supportsReasoningEffort: false },
  } as Model<Api>;
}

function apiFor(api: ReAgentHostProviderApi) {
  if (api === 'anthropic-messages') {
    return anthropicMessagesApi();
  }
  if (api === 'openai-responses') {
    return openAIResponsesApi();
  }
  return openAICompletionsApi();
}

/** Build a pi-ai provider from a host's config. */
export function buildHostProvider(
  descriptor: ReAgentHostProvider,
  config: ReAgentHostProviderConfig,
): Provider<Api> {
  const api = config.api ?? 'openai-completions';
  const baseUrl = config.baseUrl.replace(/\/$/, '');
  return createProvider({
    id: descriptor.id,
    name: descriptor.name,
    baseUrl,
    auth: {
      apiKey: {
        name: descriptor.name,
        resolve: async () => ({ auth: { apiKey: config.apiKey } }),
      },
    },
    models: (config.models ?? []).map(id => hostModel(id, descriptor.id, baseUrl, api)),
    api: apiFor(api),
  });
}
