import { createElement, isValidElement, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import { Link, useLocation } from 'react-router-dom';
import remarkGfm from 'remark-gfm';

import { cn } from '../lib/cn';
import { highlightCode } from '../lib/highlight';
import { slugifyHeading } from '../lib/slug';

const BASE_URL = import.meta.env.BASE_URL;

/**
 * Map a markdown link from the docs to a route. External URLs and in-page
 * anchors are returned as-is (null means "render a real anchor").
 */
function toRoute(href: string): string | null {
  if (/^(https?:|mailto:|tel:)/i.test(href)) {
    return null;
  }
  if (href.startsWith('#')) {
    return href;
  }
  // Static files (llms.txt, skill.md, …) resolve as real links, not routes.
  if (/\.[a-z0-9]+$/i.test(href)) {
    return null;
  }
  if (href === '.' || href === '..' || href === '../' || href === '../../' || href === '../..') {
    return '/';
  }
  const clean = href.replace(/^\.\//, '').replace(/^\/+/, '').replace(/\/+$/, '');
  if (clean === '' || clean === 'docs') {
    return '/docs';
  }
  return clean.startsWith('docs/') ? `/${clean}` : `/docs/${clean}`;
}

function nodeText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(nodeText).join('');
  }
  if (isValidElement(node)) {
    return nodeText((node.props as { children?: ReactNode }).children);
  }
  return '';
}

function heading(level: 1 | 2 | 3 | 4 | 5 | 6) {
  return ({ children }: { children?: ReactNode }) =>
    createElement(
      `h${level}`,
      { id: slugifyHeading(nodeText(children)), className: 'scroll-mt-20' },
      children,
    );
}

function MarkdownLink({ href, children }: { href?: string; children?: ReactNode }) {
  const location = useLocation();
  if (href !== undefined && href.startsWith('#')) {
    return <Link to={{ pathname: location.pathname, hash: href }}>{children}</Link>;
  }
  const external = href !== undefined && /^https?:/i.test(href);
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  }
  const route = href === undefined ? null : toRoute(href);
  if (route !== null) {
    return <Link to={route}>{children}</Link>;
  }
  if (href !== undefined && /\.[a-z0-9]+$/i.test(href)) {
    return <a href={`${BASE_URL}${href.replace(/^\.?\//, '')}`}>{children}</a>;
  }
  return <a href={href}>{children}</a>;
}

const components: Components = {
  a: MarkdownLink,
  h1: heading(1),
  h2: heading(2),
  h3: heading(3),
  h4: heading(4),
  h5: heading(5),
  h6: heading(6),
  code({ className, children }) {
    const language = /language-(\w+)/.exec(className ?? '')?.[1];
    if (language !== undefined) {
      const raw = String(children).replace(/\n$/, '');
      return (
        <code
          className={cn('hljs', className)}
          // Highlighted locally from the docs/demo source strings.
          dangerouslySetInnerHTML={{ __html: highlightCode(raw, language) }}
        />
      );
    }
    return <code className={className}>{children}</code>;
  },
};

export function Markdown({ content, className }: { content: string; className?: string }) {
  return (
    <div
      className={cn(
        'prose prose-slate max-w-none dark:prose-invert',
        'prose-headings:font-semibold prose-headings:tracking-tight',
        'prose-a:font-medium prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
        'prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:font-normal prose-code:text-[0.85em] prose-code:before:content-none prose-code:after:content-none',
        'prose-pre:bg-muted prose-pre:text-foreground prose-pre:border prose-pre:border-border',
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

/** Adapter matching ReAgent's `renderMarkdown` prop. */
export function AgentMarkdown({
  content,
  theme,
}: {
  content: string;
  theme?: 'light' | 'dark';
}) {
  return (
    <Markdown
      content={content}
      className={cn(
        'prose-sm',
        theme === 'dark' ? 'prose-invert' : 'prose-slate',
        'prose-p:my-2 prose-pre:my-2 prose-ul:my-2 prose-ol:my-2 prose-headings:mt-3 prose-headings:mb-1.5',
      )}
    />
  );
}
