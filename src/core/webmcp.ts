import type { AgentTool } from '@earendil-works/pi-agent-core';
import { type TSchema, Type } from '@earendil-works/pi-ai';

/**
 * WebMCP support: a page can expose tools to an in-page agent through the
 * emerging `document.modelContext` API (W3C Web Machine Learning "WebMCP").
 *
 * ReAgent detects the API, turns the page's registered tools into `AgentTool`s
 * and merges them into the run. Registration is live: the `toolchange` event
 * refreshes the tool set.
 *
 * A browser without native support can be polyfilled (e.g. with
 * `@mcp-b/webmcp-polyfill`'s `installWebMCP()`); ReAgent simply checks the API.
 */

/** A tool registered with the page's model context. */
export interface WebMcpTool {
  name: string;
  title?: string;
  description: string;
  inputSchema?: unknown;
  origin?: string;
}

interface WebMcpModelContext extends EventTarget {
  getTools(options?: { fromOrigins?: string[] }): Promise<WebMcpTool[]>;
  executeTool(
    tool: WebMcpTool,
    input?: Record<string, unknown>,
    options?: { signal?: AbortSignal },
  ): Promise<unknown>;
}

function modelContext(): WebMcpModelContext | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  return (document as Document & { modelContext?: WebMcpModelContext }).modelContext;
}

/** Whether the current page exposes a WebMCP model context. */
export function hasWebMcp(): boolean {
  return modelContext() !== undefined;
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

function toAgentTool(context: WebMcpModelContext, tool: WebMcpTool): AgentTool<any> {
  return {
    name: tool.name,
    label: tool.title ?? tool.name,
    description: tool.description,
    parameters: Type.Unsafe<TSchema>(normalizeInputSchema(tool.inputSchema)),
    execute: async (_toolCallId, args, signal) => {
      const result = await context.executeTool(
        tool,
        (args ?? {}) as Record<string, unknown>,
        signal ? { signal } : undefined,
      );
      const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      return { content: [{ type: 'text' as const, text }], details: result };
    },
  };
}

/** The current page's WebMCP tools, as agent tools (empty when unavailable). */
export async function listWebMcpTools(): Promise<AgentTool<any>[]> {
  const context = modelContext();
  if (context === undefined) {
    return [];
  }
  const tools = await context.getTools();
  return tools.map(tool => toAgentTool(context, tool));
}

/** Subscribe to the page's `toolchange` events. No-op when WebMCP is absent. */
export function subscribeWebMcp(listener: () => void): () => void {
  const context = modelContext();
  if (context === undefined) {
    return () => undefined;
  }
  context.addEventListener('toolchange', listener);
  return () => context.removeEventListener('toolchange', listener);
}
