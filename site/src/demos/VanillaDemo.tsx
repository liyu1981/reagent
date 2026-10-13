import { ReAgent } from '@liyu1981/reagent';

import { AgentMarkdown } from '../components/Markdown';

/**
 * The absolute minimum: the styled preset, a markdown renderer and a sized
 * container. No extra tools, no skills, no MCP servers.
 */
export function VanillaDemo({
  theme,
  surface = 'glass',
  notify,
}: {
  theme: 'light' | 'dark';
  surface?: 'glass' | 'solid';
  notify?: (message: string, level?: 'success' | 'error') => void;
}) {
  return (
    <ReAgent
      theme={theme}
      surface={surface}
      renderMarkdown={AgentMarkdown}
      notify={notify}
    />
  );
}
