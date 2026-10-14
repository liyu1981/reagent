/**
 * Storage namespacing.
 *
 * Every store ReAgent persists — the `AgentConfig`, provider credentials,
 * MCP keys and the conversation IndexedDB — is keyed by a **prefix**. The
 * default (`agent`) reproduces the historical keys exactly, so existing
 * installs keep working. A host that renders several agents on the same page
 * (or ships several apps on one origin) passes a different `storagePrefix` to
 * each `<ReAgentProvider>` / `<ReAgent>` and the agents stop colliding.
 */

export const DEFAULT_STORAGE_PREFIX = 'agent';

/** Normalize a caller-supplied prefix, falling back to the default. */
export function resolveStoragePrefix(prefix?: string | null): string {
  const value = (prefix ?? '').trim();
  return value === '' ? DEFAULT_STORAGE_PREFIX : value;
}

/** localStorage key for `key` inside `prefix`, e.g. `agent.config`. */
export function storageKey(prefix: string, key: string): string {
  return `${prefix}.${key}`;
}

/**
 * IndexedDB database name for a prefix. The default keeps the original
 * `reagent-agent` name; custom prefixes get `<prefix>-agent`.
 */
export function storageDatabase(prefix: string): string {
  return prefix === DEFAULT_STORAGE_PREFIX ? 'reagent-agent' : `${prefix}-agent`;
}
