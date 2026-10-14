import type { AgentMessage, ThinkingLevel } from '@earendil-works/pi-agent-core';

import { newSkillId } from './config';
import { DEFAULT_STORAGE_PREFIX, storageDatabase } from './storage';
import type { AgentSession, AgentSessionNode } from './types';

const DB_VERSION = 2;
const STORE = 'sessions';

function openDb(prefix: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(storageDatabase(prefix), DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      let store: IDBObjectStore;
      if (!db.objectStoreNames.contains(STORE)) {
        store = db.createObjectStore(STORE, { keyPath: 'id' });
      } else {
        store = request.transaction!.objectStore(STORE);
      }
      if (!store.indexNames.contains('by-parent')) {
        store.createIndex('by-parent', 'parentId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'));
  });
}

function normalize(row: AgentSession): AgentSession {
  return {
    ...row,
    parentId: row.parentId ?? null,
    forkFromIndex: row.forkFromIndex ?? null,
    messages: Array.isArray(row.messages) ? row.messages : [],
  };
}

export async function listSessions(
  prefix: string = DEFAULT_STORAGE_PREFIX,
): Promise<AgentSession[]> {
  const db = await openDb(prefix);
  const tx = db.transaction(STORE, 'readonly');
  const rows = await txResult(tx.objectStore(STORE).getAll() as IDBRequest<AgentSession[]>);
  await txDone(tx);
  db.close();
  return rows.map(normalize).sort((a, b) => a.updatedAt - b.updatedAt);
}

export async function getSession(
  id: string,
  prefix: string = DEFAULT_STORAGE_PREFIX,
): Promise<AgentSession | undefined> {
  const db = await openDb(prefix);
  const tx = db.transaction(STORE, 'readonly');
  const row = await txResult(tx.objectStore(STORE).get(id) as IDBRequest<AgentSession | undefined>);
  await txDone(tx);
  db.close();
  return row === undefined ? undefined : normalize(row);
}

export async function saveSession(
  session: AgentSession,
  prefix: string = DEFAULT_STORAGE_PREFIX,
): Promise<void> {
  const db = await openDb(prefix);
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put(session);
  await txDone(tx);
  db.close();
}

/**
 * Delete a session and reparent its children to the deleted node's parent, so
 * forks survive their origin being removed.
 */
export async function deleteSession(
  id: string,
  prefix: string = DEFAULT_STORAGE_PREFIX,
): Promise<void> {
  const db = await openDb(prefix);
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  const all = await txResult(store.getAll() as IDBRequest<AgentSession[]>);
  const target = all.find(row => row.id === id);
  const grandparent = target?.parentId ?? null;
  for (const row of all) {
    if (row.parentId === id) {
      store.put({ ...row, parentId: grandparent });
    }
  }
  store.delete(id);
  await txDone(tx);
  db.close();
}

/** Build the fork forest, newest-first within each level. */
export function buildSessionTree(sessions: AgentSession[]): AgentSessionNode[] {
  const nodes = new Map<string, AgentSessionNode>();
  for (const session of sessions) {
    nodes.set(session.id, { ...session, children: [] });
  }
  const roots: AgentSessionNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId === null ? undefined : nodes.get(node.parentId);
    if (parent === undefined) {
      roots.push(node);
    } else {
      parent.children.push(node);
    }
  }
  const sort = (list: AgentSessionNode[]): void => {
    list.sort((a, b) => b.updatedAt - a.updatedAt);
    for (const node of list) {
      sort(node.children);
    }
  };
  sort(roots);
  return roots;
}

export interface ForkOptions {
  providerId: string;
  modelId: string;
  thinkingLevel: ThinkingLevel;
  systemPrompt: string;
}

/**
 * Create a new session that copies `source.messages` up to `atIndex` (default:
 * everything). `AgentMessage` has no stable id, so the fork is anchored by
 * message index; `forkFromIndex` records how many messages were inherited.
 */
export async function forkSession(
  source: AgentSession,
  atIndex: number,
  options: ForkOptions,
  prefix: string = DEFAULT_STORAGE_PREFIX,
): Promise<AgentSession> {
  const now = Date.now();
  const clamped = Math.max(0, Math.min(atIndex, source.messages.length));
  const fork: AgentSession = {
    id: newSessionId(),
    parentId: source.id,
    forkFromIndex: clamped,
    title: `${source.title} › branch`,
    providerId: options.providerId,
    modelId: options.modelId,
    thinkingLevel: options.thinkingLevel,
    systemPrompt: options.systemPrompt,
    createdAt: now,
    updatedAt: now,
    messages: source.messages.slice(0, clamped) as AgentMessage[],
  };
  await saveSession(fork, prefix);
  return fork;
}

export function newSessionId(): string {
  return newSkillId();
}
