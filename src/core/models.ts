import './polyfills';

import {
  type Api,
  type Credential,
  type CredentialInfo,
  type CredentialStore,
  createModels,
  createProvider,
  type Model,
  type MutableModels,
  type Provider,
} from '@earendil-works/pi-ai';
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy';
import { builtinProviders } from '@earendil-works/pi-ai/providers/all';

import { getAgentConfig, updateAgentConfig } from './config';
import { browserSafeFetch } from './fetch';
import { activeHostProviders, buildHostProvider, getHostProviderConfig } from './host-providers';
import { DEFAULT_STORAGE_PREFIX, storageKey } from './storage';
import { DEFAULT_OLLAMA_BASE_URL, OLLAMA_PROVIDER_ID } from './types';

export { OLLAMA_PROVIDER_ID };

function readJson<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? undefined : (JSON.parse(raw) as T);
  } catch {
    return undefined;
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

/**
 * localStorage-backed CredentialStore implementing pi-ai's read/modify/delete
 * contract. Keys stay on the device; pi-ai resolves them per request and sends
 * them straight to the provider the user chose. Namespaced per storage prefix.
 */
class LocalCredentialStore implements CredentialStore {
  private readonly chains = new Map<string, Promise<unknown>>();

  constructor(private readonly prefix: string) {}

  private credentialKey(providerId: string): string {
    return storageKey(this.prefix, `credential.${providerId}`);
  }

  async read(providerId: string): Promise<Credential | undefined> {
    return readJson<Credential>(this.credentialKey(providerId));
  }

  async list(): Promise<readonly CredentialInfo[]> {
    const base = `${storageKey(this.prefix, 'credential.')}`;
    const infos: CredentialInfo[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key === null || !key.startsWith(base)) {
        continue;
      }
      const providerId = key.slice(base.length);
      const credential = readJson<Credential>(key);
      if (credential !== undefined) {
        infos.push({ providerId, type: credential.type });
      }
    }
    return infos;
  }

  async modify(
    providerId: string,
    fn: (current: Credential | undefined) => Promise<Credential | undefined>,
  ): Promise<Credential | undefined> {
    const chain = this.chains.get(providerId) ?? Promise.resolve();
    const run = chain.then(async () => {
      const current = readJson<Credential>(this.credentialKey(providerId));
      const next = await fn(current);
      if (next === undefined) {
        localStorage.removeItem(this.credentialKey(providerId));
      } else {
        writeJson(this.credentialKey(providerId), next);
      }
      return next;
    });
    const tracked = run.catch(() => undefined);
    this.chains.set(providerId, tracked);
    void tracked.then(() => {
      // Evict the chain once it settles, unless a newer modify superseded it.
      if (this.chains.get(providerId) === tracked) {
        this.chains.delete(providerId);
      }
    });
    return run;
  }

  async delete(providerId: string): Promise<void> {
    localStorage.removeItem(this.credentialKey(providerId));
  }
}

const credentialStores = new Map<string, LocalCredentialStore>();

function credentialStore(prefix: string): LocalCredentialStore {
  let store = credentialStores.get(prefix);
  if (store === undefined) {
    store = new LocalCredentialStore(prefix);
    credentialStores.set(prefix, store);
  }
  return store;
}

export function getOllamaBaseUrl(prefix: string = DEFAULT_STORAGE_PREFIX): string {
  return getAgentConfig(prefix).providers[OLLAMA_PROVIDER_ID]?.baseUrl ?? DEFAULT_OLLAMA_BASE_URL;
}

export function setOllamaBaseUrl(url: string, prefix: string = DEFAULT_STORAGE_PREFIX): void {
  const normalized = url.trim().replace(/\/+$/, '') || DEFAULT_OLLAMA_BASE_URL;
  const config = getAgentConfig(prefix);
  updateAgentConfig(
    {
      providers: {
        ...config.providers,
        [OLLAMA_PROVIDER_ID]: { ...config.providers[OLLAMA_PROVIDER_ID], baseUrl: normalized },
      },
    },
    prefix,
  );
  unverify(OLLAMA_PROVIDER_ID, prefix);
  rebuildModels(prefix);
  // Warm the catalog for the new endpoint. The test button then re-renders the
  // UI once the user confirms the connection.
  void getModels(prefix)
    .refresh({ providers: [OLLAMA_PROVIDER_ID], force: true })
    .then(() => notifyModels(prefix))
    .catch(() => undefined);
}

function legacyVerified(prefix: string): string[] {
  const raw = localStorage.getItem(storageKey(prefix, 'verified.providers'));
  if (raw === null) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Providers whose connection was verified by a successful test. */
export function isVerified(providerId: string, prefix: string = DEFAULT_STORAGE_PREFIX): boolean {
  // A host-injected provider is verified as soon as it has a config.
  if (getHostProviderConfig(providerId) !== null) {
    return true;
  }
  const config = getAgentConfig(prefix);
  if (config.providers[providerId]?.verified !== undefined) {
    return config.providers[providerId]?.verified === true;
  }
  return legacyVerified(prefix).includes(providerId);
}

function markVerified(providerId: string, prefix: string): void {
  const config = getAgentConfig(prefix);
  updateAgentConfig(
    {
      providers: {
        ...config.providers,
        [providerId]: { ...config.providers[providerId], verified: true },
      },
    },
    prefix,
  );
}

function unverify(providerId: string, prefix: string): void {
  const config = getAgentConfig(prefix);
  if (config.providers[providerId] === undefined) {
    return;
  }
  updateAgentConfig(
    {
      providers: {
        ...config.providers,
        [providerId]: { ...config.providers[providerId], verified: false },
      },
    },
    prefix,
  );
}

export function hasCredential(
  providerId: string,
  prefix: string = DEFAULT_STORAGE_PREFIX,
): boolean {
  return localStorage.getItem(storageKey(prefix, `credential.${providerId}`)) !== null;
}

export async function saveApiKey(
  providerId: string,
  key: string,
  prefix: string = DEFAULT_STORAGE_PREFIX,
): Promise<void> {
  await credentialStore(prefix).modify(providerId, async () => ({
    type: 'api_key' as const,
    key: key.trim(),
  }));
  unverify(providerId, prefix);
}

export async function clearApiKey(
  providerId: string,
  prefix: string = DEFAULT_STORAGE_PREFIX,
): Promise<void> {
  await credentialStore(prefix).delete(providerId);
  unverify(providerId, prefix);
}

function ollamaModel(id: string, baseUrl: string): Model<'openai-completions'> {
  return {
    id,
    name: id,
    api: 'openai-completions',
    provider: OLLAMA_PROVIDER_ID,
    baseUrl,
    reasoning: false,
    input: ['text'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 32000,
    compat: {
      supportsDeveloperRole: false,
      supportsReasoningEffort: false,
    },
  };
}

async function fetchOllamaModels(
  apiBase: string,
  v1Url: string,
  signal: AbortSignal,
): Promise<Model<'openai-completions'>[]> {
  let ids: string[] = [];
  try {
    const response = await fetch(`${v1Url}/models`, { signal });
    if (response.ok) {
      const data = (await response.json()) as { data?: Array<{ id: string }> };
      ids = (data?.data ?? []).map(m => m.id);
    }
  } catch {
    // fall through to the native Ollama endpoint
  }
  if (ids.length === 0) {
    try {
      const response = await fetch(`${apiBase}/api/tags`, { signal });
      if (response.ok) {
        const data = (await response.json()) as { models?: Array<{ name: string }> };
        ids = (data?.models ?? []).map(m => m.name);
      }
    } catch {
      // ignore — the list stays on its static defaults
    }
  }
  return ids.filter(id => !/embed|vision|clip/i.test(id)).map(id => ollamaModel(id, v1Url));
}

function buildOllamaProvider(baseUrl: string) {
  const v1Url = `${baseUrl}/v1`;
  return createProvider({
    id: OLLAMA_PROVIDER_ID,
    name: 'Custom Local LLM (OpenAI compatible)',
    baseUrl: v1Url,
    auth: {
      apiKey: {
        name: 'Custom Local LLM (OpenAI compatible)',
        resolve: async () => ({ auth: { apiKey: 'local' } }),
      },
    },
    models: [],
    fetchModels: async ({ signal }) => fetchOllamaModels(baseUrl, v1Url, signal),
    api: openAICompletionsApi(),
  });
}

/**
 * Providers we deliberately do not register: they cannot be reached from the
 * browser (no usable CORS for direct requests), so offering them would only
 * produce confusing failures. See `docs/models.md`.
 *
 * - `fireworks`   — `/inference/v1/messages` returns no CORS headers.
 * - `minimax`     — preflight rejects the headers the Anthropic client sends.
 * - `minimax-cn`  — same as `minimax`.
 * - `vercel-ai-gateway`, `opencode`, `opencode-go` — tested, CORS-blocked.
 *
 * `openrouter` is the only provider verified to work from the browser so far.
 */
export const BROWSER_SUPPORTED_PROVIDERS: ReadonlySet<string> = new Set(['openrouter']);

// Live provider model catalogs keyed by provider id. pi-ai ships static
// catalogs that go stale, so the Test button / refresh replaces them with what
// the provider actually serves.
const liveModels = new Map<string, Model<Api>[]>();

interface ModelsEndpoint {
  url: string;
  headers: Record<string, string>;
}

/**
 * Candidate model-listing endpoints for a provider, in order of likelihood.
 * Providers disagree on whether the base URL already carries the API version
 * segment, and some (e.g. OpenCode) only set it per model, so we derive the
 * base and try both spellings.
 */
function listEndpoints(provider: Provider<Api>, apiKey: string | undefined): ModelsEndpoint[] {
  const model = provider.getModels()[0];
  const base = (provider.baseUrl ?? model?.baseUrl)?.replace(/\/$/, '');
  const api = model?.api;
  if (base === undefined || api === undefined) {
    return [];
  }
  if (api === 'google-generative-ai') {
    return [
      {
        url: `${base}/models${apiKey === undefined ? '' : `?key=${encodeURIComponent(apiKey)}`}`,
        headers: {},
      },
    ];
  }

  const headers: Record<string, string> = {};
  if (apiKey !== undefined) {
    headers.authorization = `Bearer ${apiKey}`;
    headers['x-api-key'] = apiKey;
  }
  try {
    if (new URL(base).hostname === 'api.anthropic.com') {
      headers['anthropic-version'] = '2023-06-01';
    }
  } catch {
    // relative base — skip the host check
  }

  return /\/v\d+[a-z]*$/.test(base)
    ? [{ url: `${base}/models`, headers }]
    : [
        { url: `${base}/v1/models`, headers },
        { url: `${base}/models`, headers },
      ];
}

function parseModelIds(data: {
  data?: Array<{ id?: string }>;
  models?: Array<{ name?: string }>;
}): string[] {
  if (Array.isArray(data.data)) {
    return data.data.map(model => model.id).filter((id): id is string => typeof id === 'string');
  }
  if (Array.isArray(data.models)) {
    return data.models
      .map(model => model.name?.replace(/^models\//, ''))
      .filter((id): id is string => typeof id === 'string' && id !== '');
  }
  return [];
}

/**
 * Model ids a provider reports, or `undefined` when it exposes no listing
 * endpoint. Throws on an explicit auth failure (401/403).
 */
async function fetchModelIds(
  provider: Provider<Api>,
  apiKey: string | undefined,
): Promise<string[] | undefined> {
  for (const endpoint of listEndpoints(provider, apiKey)) {
    let response: Response;
    try {
      response = await browserSafeFetch(undefined, provider.id)(endpoint.url, {
        headers: endpoint.headers,
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      continue;
    }
    if (response.status === 404 || response.status === 405) {
      continue;
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error(`HTTP ${response.status}`);
    }
    if (!response.ok) {
      continue;
    }
    return parseModelIds((await response.json()) as Parameters<typeof parseModelIds>[0]);
  }
  return undefined;
}

/** Build registry models from live ids, reusing catalog metadata where known. */
function buildLiveModels(provider: Provider<Api>, ids: string[]): Model<Api>[] | undefined {
  const catalog = new Map(provider.getModels().map(model => [model.id, model]));
  const template = provider.getModels()[0];
  const models: Model<Api>[] = [];
  for (const id of ids) {
    const known = catalog.get(id);
    if (known !== undefined) {
      models.push(known);
    } else if (template !== undefined) {
      models.push({ ...template, id, name: id });
    }
  }
  return models.length > 0 ? models : undefined;
}

/** Wrap a provider so `getModels` serves its live catalog once fetched. */
function withLiveModels(provider: Provider<Api>): Provider<Api> {
  return {
    ...provider,
    getModels: () => liveModels.get(provider.id) ?? provider.getModels(),
    refreshModels: async context => {
      if (!context.allowNetwork || context.signal.aborted) {
        return;
      }
      const apiKey = context.credential?.type === 'api_key' ? context.credential.key : undefined;
      const ids = await fetchModelIds(provider, apiKey);
      if (ids === undefined) {
        return;
      }
      const models = buildLiveModels(provider, ids);
      if (models !== undefined) {
        await context.publish({ update: () => liveModels.set(provider.id, models) });
      }
    },
  };
}

function buildModels(prefix: string): MutableModels {
  const models = createModels({ credentials: credentialStore(prefix) });
  // Host-injected providers first, then browser-verified built-ins, then our
  // keyless OpenAI-compatible endpoint.
  for (const { descriptor, config } of activeHostProviders()) {
    models.setProvider(buildHostProvider(descriptor, config));
  }
  for (const provider of builtinProviders()) {
    if (!BROWSER_SUPPORTED_PROVIDERS.has(provider.id)) {
      continue;
    }
    models.setProvider(withLiveModels(provider));
  }
  models.setProvider(buildOllamaProvider(getOllamaBaseUrl(prefix)));
  return models;
}

const modelsByPrefix = new Map<string, MutableModels>();

// A tiny external store so the UI can recompute its model list whenever the
// registry is rebuilt or refreshed (e.g. after changing the Ollama base URL).
const modelsListeners = new Map<string, Set<() => void>>();
const modelsVersions = new Map<string, number>();

function listenersFor(prefix: string): Set<() => void> {
  let set = modelsListeners.get(prefix);
  if (set === undefined) {
    set = new Set();
    modelsListeners.set(prefix, set);
  }
  return set;
}

function notifyModels(prefix: string): void {
  modelsVersions.set(prefix, (modelsVersions.get(prefix) ?? 0) + 1);
  for (const listener of listenersFor(prefix)) {
    listener();
  }
}

export function subscribeModels(
  listener: () => void,
  prefix: string = DEFAULT_STORAGE_PREFIX,
): () => void {
  const listeners = listenersFor(prefix);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getModelsVersion(prefix: string = DEFAULT_STORAGE_PREFIX): number {
  return modelsVersions.get(prefix) ?? 0;
}

export function getModels(prefix: string = DEFAULT_STORAGE_PREFIX): MutableModels {
  let models = modelsByPrefix.get(prefix);
  if (models === undefined) {
    models = buildModels(prefix);
    modelsByPrefix.set(prefix, models);
  }
  return models;
}

export function rebuildModels(prefix: string = DEFAULT_STORAGE_PREFIX): MutableModels {
  const models = buildModels(prefix);
  modelsByPrefix.set(prefix, models);
  notifyModels(prefix);
  return models;
}

export function getModel(
  providerId: string,
  modelId: string,
  prefix: string = DEFAULT_STORAGE_PREFIX,
) {
  return getModels(prefix).getModel(providerId, modelId);
}

/**
 * Models from providers whose connection was verified with a successful test.
 * This is the only list the agent UI should offer, so unconfigured providers
 * never show up in the model selector.
 */
export function listAvailableModels(prefix: string = DEFAULT_STORAGE_PREFIX): Array<{
  provider: string;
  providerName: string;
  model: Model<Api>;
}> {
  const modelsAll = getModels(prefix);
  const out: Array<{ provider: string; providerName: string; model: Model<Api> }> = [];
  for (const provider of modelsAll.getProviders()) {
    if (!isVerified(provider.id, prefix)) {
      continue;
    }
    for (const model of modelsAll.getModels(provider.id)) {
      out.push({ provider: provider.id, providerName: provider.name, model });
    }
  }
  return out;
}

export async function refreshModels(prefix: string = DEFAULT_STORAGE_PREFIX): Promise<void> {
  await getModels(prefix).refresh();
  notifyModels(prefix);
}

/**
 * Validate a provider without sending a chat completion: resolve its
 * credential and list its models. The listing also refreshes the picker with
 * the provider's actual models (pi-ai's static catalog can be stale).
 * Providers without a listing endpoint are accepted once their credential
 * resolves. Rejects with a human-readable message.
 */
export async function testConnection(
  providerId: string,
  prefix: string = DEFAULT_STORAGE_PREFIX,
): Promise<string> {
  const registry = getModels(prefix);
  const resolution = await registry.getAuth(providerId);
  if (resolution === undefined) {
    throw new Error('not_configured');
  }

  if (providerId === OLLAMA_PROVIDER_ID) {
    const v1Url = registry.getProvider(providerId)?.baseUrl;
    if (v1Url === undefined) {
      throw new Error('no_model');
    }
    const base = v1Url.replace(/\/v1\/?$/, '');
    const response = await fetch(`${base}/v1/models`, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = (await response.json()) as { data?: Array<{ id: string }> };
    const probeCount = data?.data?.length ?? 0;
    // Populate the provider catalog *before* marking it verified, so the model
    // picker already has models when React re-renders from the config update.
    await registry.refresh({ providers: [providerId], force: true });
    markVerified(providerId, prefix);
    const count = registry.getModels(providerId).length || probeCount;
    return count > 0 ? `${count} model${count === 1 ? '' : 's'}` : 'reachable';
  }

  const provider = registry.getProvider(providerId);
  if (provider === undefined) {
    throw new Error('no_model');
  }
  const ids = await fetchModelIds(provider, resolution.auth.apiKey);
  if (ids === undefined) {
    // No listing endpoint — a resolved credential is as far as we can test.
    markVerified(providerId, prefix);
    return 'reachable';
  }
  const models = buildLiveModels(provider, ids);
  if (models !== undefined) {
    liveModels.set(providerId, models);
    notifyModels(prefix);
  }
  markVerified(providerId, prefix);
  const count = models?.length ?? registry.getModels(providerId).length;
  return count > 0 ? `${count} model${count === 1 ? '' : 's'}` : 'reachable';
}
