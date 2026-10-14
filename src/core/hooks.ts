import { useCallback, useContext, useSyncExternalStore } from 'react';

import { getAgentConfig, subscribeAgentConfig, updateAgentConfig } from './config';
import { ReAgentContext, type ReAgentContextValue } from './reagent-provider';
import { DEFAULT_STORAGE_PREFIX } from './storage';
import type { AgentConfig, AgentSession, AgentSessionNode } from './types';

export function useReAgent(): ReAgentContextValue {
  const context = useContext(ReAgentContext);
  if (context === null) {
    throw new Error('useReAgent must be used within a <ReAgentProvider>');
  }
  return context;
}

/**
 * Config is backed by the external `AgentConfig` store rather than React state,
 * so settings panels can be reused on a `/settings` page outside a
 * `<ReAgentProvider>`. Inside a provider it reads that provider's storage
 * namespace; outside, it falls back to the default one.
 */
export function useReAgentConfig() {
  const context = useContext(ReAgentContext);
  const prefix = context?.storagePrefix ?? DEFAULT_STORAGE_PREFIX;

  const subscribe = useCallback(
    (listener: () => void) => subscribeAgentConfig(listener, prefix),
    [prefix],
  );
  const read = useCallback(() => getAgentConfig(prefix), [prefix]);
  const config = useSyncExternalStore(subscribe, read);
  const update = useCallback(
    (patch: Partial<AgentConfig>) => updateAgentConfig(patch, prefix),
    [prefix],
  );
  return { config, update };
}

export function useReAgentSession(): {
  session: AgentSession | null;
  messages: NonNullable<AgentSession['messages']>;
} {
  const { activeSession } = useReAgent();
  return { session: activeSession, messages: activeSession?.messages ?? [] };
}

export function useReAgentSessions() {
  const {
    sessions,
    sessionTree,
    activeSession,
    createSession,
    forkSession,
    loadSession,
    renameSession,
    deleteSession,
  } = useReAgent();
  return {
    sessions,
    tree: sessionTree as AgentSessionNode[],
    activeSession,
    create: createSession,
    fork: forkSession,
    load: loadSession,
    rename: renameSession,
    remove: deleteSession,
  };
}

export function useReAgentRegistry() {
  const { models, config, toolLabels } = useReAgent();
  return { models, config, toolLabels };
}
