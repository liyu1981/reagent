import { useContext, useSyncExternalStore } from 'react';

import { getAgentConfig, subscribeAgentConfig, updateAgentConfig } from './config';
import type { AgentSession, AgentSessionNode } from './types';

import { ReAgentContext, type ReAgentContextValue } from './reagent-provider';

export function useReAgent(): ReAgentContextValue {
  const context = useContext(ReAgentContext);
  if (context === null) {
    throw new Error('useReAgent must be used within a <ReAgentProvider>');
  }
  return context;
}

/**
 * Config is backed by the global `AgentConfig` store rather than the React
 * context, so settings panels can be reused on the `/settings` page (outside a
 * `<ReAgentProvider>`).
 */
export function useReAgentConfig() {
  const config = useSyncExternalStore(subscribeAgentConfig, getAgentConfig);
  return { config, update: updateAgentConfig };
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
