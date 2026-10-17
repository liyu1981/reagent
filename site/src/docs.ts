import browserSupport from '../../docs/browser-support.md?raw';
import components from '../../docs/components.md?raw';
import forAgents from '../../docs/for-agents.md?raw';
import headless from '../../docs/headless.md?raw';
import hostIntegrations from '../../docs/host-integrations.md?raw';
import installation from '../../docs/installation.md?raw';
import introduction from '../../docs/introduction.md?raw';
import models from '../../docs/models.md?raw';
import multipleAgents from '../../docs/multiple-agents.md?raw';
import quickStart from '../../docs/quick-start.md?raw';
import sessions from '../../docs/sessions.md?raw';
import styling from '../../docs/styling.md?raw';
import theming from '../../docs/theming.md?raw';
import toolsAndSkills from '../../docs/tools-and-skills.md?raw';
import webmcp from '../../docs/webmcp.md?raw';

export interface DocEntry {
  slug: string;
  title: string;
  group: string;
  summary: string;
  content: string;
}

export const DOCS: DocEntry[] = [
  {
    slug: 'introduction',
    title: 'Introduction',
    group: 'Getting started',
    summary: 'What ReAgent is and why you would use it.',
    content: introduction,
  },
  {
    slug: 'installation',
    title: 'Installation',
    group: 'Getting started',
    summary: 'Install the package and wire up Tailwind v4.',
    content: installation,
  },
  {
    slug: 'quick-start',
    title: 'Quick start',
    group: 'Getting started',
    summary: 'Render the agent and configure a model.',
    content: quickStart,
  },
  {
    slug: 'styling',
    title: 'Styling',
    group: 'Guides',
    summary: 'Tailwind setup, tokens and surfaces.',
    content: styling,
  },
  {
    slug: 'theming',
    title: 'Theming',
    group: 'Guides',
    summary: 'Dark mode, the theme prop, copy overrides.',
    content: theming,
  },
  {
    slug: 'host-integrations',
    title: 'Host integrations',
    group: 'Guides',
    summary: 'Markdown, tools, uploads and the editor bridge.',
    content: hostIntegrations,
  },
  {
    slug: 'models',
    title: 'Models & providers',
    group: 'Guides',
    summary: 'Credentials, verification and model selection.',
    content: models,
  },
  {
    slug: 'browser-support',
    title: 'Browser support & cloud providers',
    group: 'Guides',
    summary: 'Why cloud providers are disabled, and what works.',
    content: browserSupport,
  },
  {
    slug: 'tools-and-skills',
    title: 'Tools & skills',
    group: 'Guides',
    summary: 'Built-in tools, descriptors, skills and MCP.',
    content: toolsAndSkills,
  },
  {
    slug: 'sessions',
    title: 'Sessions & persistence',
    group: 'Guides',
    summary: 'The conversation tree and IndexedDB storage.',
    content: sessions,
  },
  {
    slug: 'multiple-agents',
    title: 'Multiple agents & storage',
    group: 'Guides',
    summary: 'Run independent agents with a storage prefix.',
    content: multipleAgents,
  },
  {
    slug: 'webmcp',
    title: 'WebMCP',
    group: 'Reference',
    summary: 'Auto-detect and use tools the page exposes via document.modelContext.',
    content: webmcp,
  },
  {
    slug: 'components',
    title: 'Components & props',
    group: 'Reference',
    summary: 'Every export and the ReAgent props table.',
    content: components,
  },
  {
    slug: 'headless',
    title: 'Headless usage',
    group: 'Reference',
    summary: 'Build a custom UI on the provider and hooks.',
    content: headless,
  },
  {
    slug: 'for-agents',
    title: 'For coding agents',
    group: 'Reference',
    summary: 'The llms.txt index and skill.md integration guide.',
    content: forAgents,
  },
];

export const DOC_GROUPS = ['Getting started', 'Guides', 'Reference'] as const;

export function getDoc(slug: string | undefined): DocEntry {
  return DOCS.find(doc => doc.slug === slug) ?? DOCS[0];
}

export function docNeighbours(slug: string): { prev: DocEntry | null; next: DocEntry | null } {
  const index = DOCS.findIndex(doc => doc.slug === slug);
  return {
    prev: index > 0 ? DOCS[index - 1] : null,
    next: index >= 0 && index < DOCS.length - 1 ? DOCS[index + 1] : null,
  };
}
