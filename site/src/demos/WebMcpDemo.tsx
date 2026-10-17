import { installWebMCP } from '@mcp-b/webmcp-polyfill';
import { ReAgent } from '@liyu1981/reagent';
import { useEffect, useState } from 'react';

import { AgentMarkdown } from '../components/Markdown';

interface DemoProps {
  theme: 'light' | 'dark';
  surface?: 'glass' | 'solid';
  notify?: (message: string, level?: 'success' | 'error') => void;
}

// Install the WebMCP runtime at module load so ReAgent detects the context when
// it mounts (a child's effects run before this component's). Idempotent, and it
// keeps a native implementation if the browser already provides one.
installWebMCP();

/**
 * WebMCP demo. The page registers tools with `document.modelContext`, and
 * ReAgent auto-detects them and hands them to the model — no props needed.
 */
export function WebMcpDemo({ theme, surface = 'glass', notify }: DemoProps) {
  const [toolCount, setToolCount] = useState(0);

  useEffect(() => {
    const context = document.modelContext;
    if (context === undefined) {
      return;
    }
    const controller = new AbortController();

    const register = async () => {
      await context.registerTool(
        {
          name: 'get_page_theme',
          title: 'Get page theme',
          description: 'Return the current page theme: "light" or "dark".',
          inputSchema: { type: 'object', properties: {} },
          execute: () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light'),
        },
        { signal: controller.signal },
      );
      await context.registerTool(
        {
          name: 'count_words',
          title: 'Count words',
          description: 'Count the words in a piece of text.',
          inputSchema: {
            type: 'object',
            properties: { text: { type: 'string', description: 'The text to count.' } },
            required: ['text'],
          },
          execute: input => {
            const text = input.text.trim();
            return String(text === '' ? 0 : text.split(/\s+/).length);
          },
        },
        { signal: controller.signal },
      );
      setToolCount((await context.getTools()).length);
    };

    void register();
    return () => controller.abort();
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2 text-xs text-muted-foreground">
        <span
          className={
            toolCount > 0
              ? 'size-2 rounded-full bg-emerald-500'
              : 'size-2 rounded-full bg-muted-foreground/50'
          }
        />
        {toolCount > 0
          ? `WebMCP active — ${toolCount} page tool${toolCount === 1 ? '' : 's'} exposed to the agent`
          : 'WebMCP unavailable in this browser'}
      </div>
      <div className="min-h-0 flex-1">
        <ReAgent theme={theme} surface={surface} renderMarkdown={AgentMarkdown} notify={notify} />
      </div>
    </div>
  );
}
