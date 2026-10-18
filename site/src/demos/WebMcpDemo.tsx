import { installWebMCP } from '@mcp-b/webmcp-polyfill';
import { ReAgent } from '@liyu1981/reagent';
import { useEffect } from 'react';

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
          title: 'Count page words',
          description: 'Count the words on the current page.',
          inputSchema: { type: 'object', properties: {} },
          execute: () => {
            const text = document.body.innerText.replace(/\s+/g, ' ').trim();
            return String(text === '' ? 0 : text.split(' ').length);
          },
        },
        { signal: controller.signal },
      );
    };

    void register();
    return () => controller.abort();
  }, []);

  return <ReAgent theme={theme} surface={surface} renderMarkdown={AgentMarkdown} notify={notify} />;
}
