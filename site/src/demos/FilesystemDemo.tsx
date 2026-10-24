import type { FetchFunction } from '@earendil-works/pi-ai';
import type { ReAgentHostProvider, ReAgentHostProviderConfig } from '@liyu1981/reagent';
import { createOpfsFiles, ReAgent, updateAgentConfig } from '@liyu1981/reagent';
import { useRef, useState } from 'react';

import { AgentMarkdown } from '../components/Markdown';

const FAKE_PROVIDER_ID = 'fake-filesystem';
const FAKE_MODEL_ID = 'fake-filesystem';
const FAKE_BASE_URL = 'https://fake-filesystem.invalid/v1';

const FILES = createOpfsFiles('filesystem-demo');
const SUGGESTED_PROMPT = 'Write a note about our solar system.';

interface FakeToolCall {
  function?: {
    name?: string;
    arguments?: string;
  };
}

interface FakeChatMessage {
  role?: string;
  content?: unknown;
  tool_calls?: FakeToolCall[];
}

interface FakeChatRequest {
  messages?: FakeChatMessage[];
  tools?: { function?: { name?: string } }[];
}

interface DemoProps {
  theme: 'light' | 'dark';
  surface?: 'glass' | 'solid';
  notify?: (message: string, level?: 'success' | 'error') => void;
}

function textOf(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (!Array.isArray(content)) {
    return '';
  }
  return content
    .map(part => {
      if (typeof part === 'string') {
        return part;
      }
      if (
        part !== null &&
        typeof part === 'object' &&
        'text' in part &&
        typeof part.text === 'string'
      ) {
        return part.text;
      }
      return '';
    })
    .join('');
}

function lastMessageText(messages: FakeChatMessage[], role: string): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === role) {
      return textOf(messages[index]?.content);
    }
  }
  return '';
}

function lastAssistantToolName(messages: FakeChatMessage[]): string | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== 'assistant') {
      continue;
    }
    const call = message.tool_calls?.[message.tool_calls.length - 1];
    if (call?.function?.name !== undefined) {
      return call.function.name;
    }
  }
  return undefined;
}

function lastToolResult(messages: FakeChatMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'tool') {
      return textOf(messages[index]?.content);
    }
  }
  return '';
}

function lastUserIndex(messages: FakeChatMessage[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') {
      return index;
    }
  }
  return -1;
}

function attachmentPath(systemPrompt: string): string | undefined {
  const manifest = systemPrompt.split('## Files attached by the user')[1] ?? '';
  const matches = [...manifest.matchAll(/ at `([^`]+)`/g)];
  return matches.length === 0 ? undefined : matches[matches.length - 1]?.[1];
}

let callCounter = 0;

function completionChunk(delta: Record<string, unknown>, finishReason: string | null): unknown {
  return {
    id: 'chatcmpl-fake-filesystem',
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model: FAKE_MODEL_ID,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  };
}

function sseResponse(chunks: unknown[]): Response {
  const body =
    chunks.map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join('') + 'data: [DONE]\n\n';
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
    },
  });
}

function textResponse(text: string): Response {
  return sseResponse([
    completionChunk({ role: 'assistant', content: text }, null),
    completionChunk({}, 'stop'),
  ]);
}

function toolResponse(name: string, args: Record<string, unknown>): Response {
  callCounter += 1;
  return sseResponse([
    completionChunk(
      {
        role: 'assistant',
        tool_calls: [
          {
            index: 0,
            id: `call_fake_${callCounter}`,
            type: 'function',
            function: { name, arguments: JSON.stringify(args) },
          },
        ],
      },
      null,
    ),
    completionChunk({}, 'tool_calls'),
  ]);
}

/**
 * A deterministic fake OpenAI-compatible endpoint. It really does call the
 * filesystem tools: list the namespace, read the attached file's text, or
 * write a note when the user asks for one.
 */
const fakeFetch: FetchFunction = async (input, init) => {
  const url =
    typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
  if (!url.startsWith(FAKE_BASE_URL)) {
    return fetch(input, init);
  }
  let body: FakeChatRequest = {};
  if (typeof init?.body === 'string') {
    try {
      body = JSON.parse(init.body) as FakeChatRequest;
    } catch {
      body = {};
    }
  }
  const messages = body.messages ?? [];
  const tools = new Set(
    (body.tools ?? [])
      .map(tool => tool.function?.name)
      .filter((name): name is string => name !== undefined),
  );
  const systemPrompt = messages
    .filter(message => message.role === 'system')
    .map(message => textOf(message.content))
    .join('\n\n');
  const userText = lastMessageText(messages, 'user');
  const path = attachmentPath(systemPrompt);
  const currentTurn = messages.slice(lastUserIndex(messages) + 1);
  const toolResults = currentTurn.filter(message => message.role === 'tool').length;
  const lastToolName = lastAssistantToolName(currentTurn);

  if (toolResults === 0) {
    if (tools.has('opfs_write') && /\b(write|create|save|note)\b/i.test(userText)) {
      return toolResponse('opfs_write', {
        path: 'fake-llm-note.md',
        content: 'This note was written by the fake LLM through the OPFS filesystem tools.',
      });
    }
    if (tools.has('opfs_list')) {
      return toolResponse('opfs_list', {});
    }
    return textResponse(
      'This is a fake LLM. Install the filesystem tools to let it list and read files.',
    );
  }

  if (lastToolName === 'opfs_list' && path !== undefined && tools.has('opfs_read')) {
    return toolResponse('opfs_read', { path });
  }

  const result = lastToolResult(currentTurn);
  if (lastToolName === 'opfs_write') {
    return textResponse(
      'I wrote `fake-llm-note.md` through the filesystem tools. Click the eye icon on the attachment below to preview it, or open **Settings → Filesystem → Browse files** to see it.\n\nThe fake model did this without calling a real LLM.',
    );
  }
  if (lastToolName === 'opfs_read') {
    const excerpt = result.length > 1500 ? `${result.slice(0, 1500)}…` : result;
    return textResponse(
      `I read the attached file \`${path ?? 'file'}\` with \`opfs_read\`:\n\n\`\`\`\n${excerpt}\n\`\`\`\n\nThis response came from the fake LLM, not a real model.`,
    );
  }
  const excerpt = result.length > 1500 ? `${result.slice(0, 1500)}…` : result;
  return textResponse(
    `I used \`${lastToolName ?? 'the filesystem tool'}\`. Result:\n\n\`\`\`\n${excerpt}\n\`\`\`\n\nThis response came from the fake LLM, not a real model.`,
  );
};

const FAKE_CONFIG: ReAgentHostProviderConfig = {
  baseUrl: FAKE_BASE_URL,
  apiKey: 'fake-api-key',
  models: [FAKE_MODEL_ID],
  fetch: fakeFetch,
};

function FakeSetup() {
  return (
    <div className="space-y-2 rounded-xl border border-border/50 p-3 text-sm">
      <p className="font-medium">Fake Filesystem LLM</p>
      <p className="text-xs text-muted-foreground">
        This provider is an in-page mock. It speaks the OpenAI chat protocol, calls the real OPFS
        filesystem tools, and never contacts a model server.
      </p>
    </div>
  );
}

const fakeProvider: ReAgentHostProvider = {
  id: FAKE_PROVIDER_ID,
  name: 'Fake Filesystem LLM',
  component: FakeSetup,
  getConfig: () => FAKE_CONFIG,
};

/** Select the fake model before the provider mounts. */
export function prepareFilesystemDemo(): void {
  updateAgentConfig({
    model: { providerId: FAKE_PROVIDER_ID, modelId: FAKE_MODEL_ID },
    thinkingLevel: 'off',
    toolsDisabled: [],
  });
}

function SuggestedPrompt() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(SUGGESTED_PROMPT);
    } catch {
      inputRef.current?.select();
      document.execCommand('copy');
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      <input
        ref={inputRef}
        readOnly
        value={SUGGESTED_PROMPT}
        onFocus={event => event.currentTarget.select()}
        aria-label="Suggested prompt"
        className="min-w-0 flex-1 rounded-md border border-amber-500/30 bg-background/70 px-2 py-1 text-xs text-foreground outline-none"
      />
      <button
        type="button"
        onClick={() => void copy()}
        className="shrink-0 rounded-md border border-amber-500/40 bg-background/70 px-2 py-1 text-xs font-medium transition hover:bg-background"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

/**
 * Filesystem + attachments with a fake LLM. Copy the suggested prompt or
 * attach a text file, then ask about it. Open Settings → Filesystem → Browse
 * files to inspect the namespace.
 */
export function FilesystemDemo({ theme, surface = 'glass', notify }: DemoProps) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
        <strong className="font-semibold">Fake LLM demo.</strong> No real model is called. Copy this
        prompt and paste it into the chat:
        <SuggestedPrompt />
        <p className="mt-1.5">
          Or attach a text file and ask the fake model to read it. The fake model really calls{' '}
          <code>opfs_list</code>, <code>opfs_read</code> and <code>opfs_write</code>.
        </p>
      </div>
      <div className="min-h-0 flex-1">
        <ReAgent
          theme={theme}
          surface={surface}
          renderMarkdown={AgentMarkdown}
          files={{ store: FILES.store, accept: 'text/*,.md,.txt,.json,.csv,.log,.yml,.yaml' }}
          extraDescriptors={FILES.descriptors}
          hostProviders={[fakeProvider]}
          notify={notify}
        />
      </div>
    </div>
  );
}
