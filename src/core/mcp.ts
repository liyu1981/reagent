import type { AgentTool } from '@earendil-works/pi-agent-core';
import { type TSchema, Type } from '@earendil-works/pi-ai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { type Tool, ToolListChangedNotificationSchema } from '@modelcontextprotocol/sdk/types.js';

import { getAgentConfig, updateAgentConfig } from './config';
import { EXA_SERVER_ID, type McpServerConfig } from './types';

/**
 * MCP (Model Context Protocol) support for the in-editor agent.
 *
 * Remote servers are reached directly from the browser over Streamable HTTP
 * (for example Exa's `https://mcp.exa.ai/mcp`, which allows cross-origin
 * requests). Their tools are adapted into Pi `AgentTool`s and merged into the
 * agent's tool set. Nothing is configured by default.
 */

export type { McpServerConfig };
export { EXA_SERVER_ID };

const EXA_KEY_KEY = 'agent.mcp.exa.apiKey';
const CONNECT_TIMEOUT_MS = 5000;

/** Configured servers (empty until the host or user adds one). */
export function listMcpServers(): McpServerConfig[] {
  return getAgentConfig().mcp;
}

export function saveMcpServers(servers: McpServerConfig[]): void {
  updateAgentConfig({ mcp: servers });
  void mcpManager.reset();
}

export function getExaApiKey(): string {
  return localStorage.getItem(EXA_KEY_KEY) ?? '';
}

export function setExaApiKey(key: string): void {
  const trimmed = key.trim();

  if (trimmed === '') {
    localStorage.removeItem(EXA_KEY_KEY);
  } else {
    localStorage.setItem(EXA_KEY_KEY, trimmed);
  }
}

/** Server id + tool name → an LLM-safe, namespaced tool name (≤ 64 chars). */
export function mcpToolName(serverId: string, toolName: string): string {
  return `mcp__${serverId}__${toolName}`.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64);
}

export interface McpServerStatus {
  id: string;
  name: string;
  enabled: boolean;
  connected: boolean;
  connecting: boolean;
  toolCount: number;
  error?: string;
  authRequired: boolean;
}

interface Connection {
  config: McpServerConfig;
  client?: Client;
  transport?: StreamableHTTPClientTransport;
  tools: AgentTool<any>[];
  error?: string;
  authRequired?: boolean;
}

interface CallContent {
  type?: string;
  text?: string;
}

/**
 * `callTool` can return either a standard `CallToolResult` or the legacy
 * compatibility shape (`toolResult` instead of `content`), so accept both.
 */
function callResultText(result: unknown): string {
  const record = (result ?? {}) as { content?: unknown; toolResult?: unknown };
  const content = Array.isArray(record.content) ? (record.content as CallContent[]) : [];

  if (content.length === 0) {
    return record.toolResult === undefined ? '(no content)' : JSON.stringify(record.toolResult);
  }

  const parts = content.map(block => {
    if (block.type === 'text') {
      return block.text ?? '';
    }
    if (block.type === 'image') {
      return '[image]';
    }
    if (block.type === 'resource') {
      return '[resource]';
    }
    return '[unsupported content]';
  });

  const joined = parts.join('\n').trim();
  return joined !== '' ? joined : '(no content)';
}

function isCallError(result: unknown): boolean {
  return (result as { isError?: unknown }).isError === true;
}

/** Heuristic for "this server wants an API key / is rate-limiting us". */
function looksLikeAuthError(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /api[ _-]?key|unauthor|forbidden|exaApiKey|rate.?limit|quota|\b(401|402|403|429)\b/i.test(
    text,
  );
}

function normalizeInputSchema(schema: unknown): TSchema {
  if (
    schema !== null &&
    typeof schema === 'object' &&
    (schema as { type?: unknown }).type === 'object'
  ) {
    return schema as TSchema;
  }

  return { type: 'object', properties: {} } as TSchema;
}

class McpManager {
  private readonly connections = new Map<string, Connection>();
  private readonly connecting = new Set<string>();
  private readonly listeners = new Set<() => void>();
  private readonly authListeners = new Set<(serverId: string) => void>();

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  onAuthRequired = (listener: (serverId: string) => void): (() => void) => {
    this.authListeners.add(listener);
    return () => {
      this.authListeners.delete(listener);
    };
  };

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private notifyAuthRequired(serverId: string): void {
    const connection = this.connections.get(serverId);
    if (connection !== undefined) {
      connection.authRequired = true;
    }
    for (const listener of this.authListeners) {
      listener(serverId);
    }
    this.emit();
  }

  getTools(): AgentTool<any>[] {
    return [...this.connections.values()].flatMap(connection => connection.tools);
  }

  getStatuses(servers: McpServerConfig[] = listMcpServers()): McpServerStatus[] {
    return servers.map(config => {
      const connection = this.connections.get(config.id);
      return {
        id: config.id,
        name: config.name,
        enabled: config.enabled,
        connected: connection !== undefined && connection.error === undefined,
        connecting: this.connecting.has(config.id),
        toolCount: connection?.tools.length ?? 0,
        error: connection?.error,
        authRequired: connection?.authRequired ?? false,
      };
    });
  }

  /** Connect enabled servers, reconnect changed ones, drop disabled ones. */
  async sync(servers: McpServerConfig[] = listMcpServers()): Promise<void> {
    const enabled = servers.filter(server => server.enabled);
    const wanted = new Set(enabled.map(server => server.id));

    for (const id of [...this.connections.keys()]) {
      if (!wanted.has(id)) {
        await this.disconnect(id);
      }
    }

    await Promise.all(enabled.map(server => this.ensure(server)));
    this.emit();
  }

  /** Close and forget every connection (after a config / key change). */
  async reset(): Promise<void> {
    await Promise.all([...this.connections.keys()].map(id => this.disconnect(id)));
    this.emit();
  }

  private async ensure(config: McpServerConfig): Promise<void> {
    const existing = this.connections.get(config.id);

    if (
      existing !== undefined &&
      existing.config.url === config.url &&
      existing.error === undefined
    ) {
      return;
    }
    if (this.connecting.has(config.id)) {
      return;
    }

    if (existing !== undefined) {
      await this.disconnect(config.id);
    }

    this.connecting.add(config.id);
    this.emit();

    try {
      this.connections.set(config.id, await this.connect(config));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.connections.set(config.id, { config, tools: [], error: message });
    } finally {
      this.connecting.delete(config.id);
      this.emit();
    }
  }

  private async connect(config: McpServerConfig): Promise<Connection> {
    const url = new URL(config.url);

    if (config.id === EXA_SERVER_ID) {
      const key = getExaApiKey();
      if (key !== '') {
        url.searchParams.set('exaApiKey', key);
      }
    }

    const transport = new StreamableHTTPClientTransport(url);
    const client = new Client({ name: 'reagent', version: '1.0.0' }, { capabilities: {} });
    await client.connect(transport);

    const connection: Connection = { config, client, transport, tools: [] };

    const refreshTools = async (): Promise<void> => {
      const { tools } = await client.listTools();
      connection.tools = tools.map(tool => this.toAgentTool(connection, tool));
      this.emit();
    };

    client.setNotificationHandler(ToolListChangedNotificationSchema, refreshTools);
    await refreshTools();

    return connection;
  }

  private async disconnect(id: string): Promise<void> {
    const connection = this.connections.get(id);

    if (connection === undefined) {
      return;
    }

    this.connections.delete(id);

    try {
      await connection.client?.close();
    } catch {
      // already gone
    }
  }

  private toAgentTool(connection: Connection, tool: Tool): AgentTool<any> {
    const client = connection.client;
    const serverId = connection.config.id;

    return {
      name: mcpToolName(serverId, tool.name),
      label:
        tool.annotations?.title ?? `${connection.config.name}: ${tool.name.replace(/_/g, ' ')}`,
      description: `${tool.description ?? ''}\n\n(MCP server: ${connection.config.name})`.trim(),
      parameters: Type.Unsafe<TSchema>(normalizeInputSchema(tool.inputSchema)),
      execute: async (_toolCallId, args, signal) => {
        if (client === undefined) {
          throw new Error(`MCP server "${connection.config.name}" is not connected`);
        }

        try {
          const result = await client.callTool(
            { name: tool.name, arguments: (args ?? {}) as Record<string, unknown> },
            undefined,
            signal ? { signal } : undefined,
          );
          const text = callResultText(result);

          if (isCallError(result)) {
            if (serverId === EXA_SERVER_ID && looksLikeAuthError(text)) {
              this.notifyAuthRequired(serverId);
            }
            throw new Error(text);
          }

          return { content: [{ type: 'text' as const, text }], details: result };
        } catch (error) {
          if (serverId === EXA_SERVER_ID && looksLikeAuthError(error)) {
            this.notifyAuthRequired(serverId);
          }
          throw error;
        }
      },
    };
  }
}

export const mcpManager = new McpManager();

/** Resolve once `sync` settles or the timeout elapses, whichever is first. */
export async function syncMcpServersWithTimeout(): Promise<void> {
  await Promise.race([
    mcpManager.sync(listMcpServers()),
    new Promise<void>(resolve => {
      setTimeout(resolve, CONNECT_TIMEOUT_MS);
    }),
  ]);
}
