import ReactMarkdown, { type Components } from 'react-markdown';
import { Link } from 'react-router-dom';
import remarkGfm from 'remark-gfm';

import { cn } from '../lib/cn';
import { highlightCode } from '../lib/highlight';

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
  if (href === '.' || href === '..' || href === '../' || href === '../../' || href === '../..') {
    return '/';
  }
  const clean = href.replace(/^\.\//, '').replace(/^\/+/, '').replace(/\/+$/, '');
  if (clean === '' || clean === 'docs') {
    return '/docs';
  }
  return clean.startsWith('docs/') ? `/${clean}` : `/docs/${clean}`;
}

const components: Components = {
  a({ href, children }) {
    const route = href === undefined ? null : toRoute(href);
    if (route !== null && !route.startsWith('#')) {
      return <Link to={route}>{children}</Link>;
    }
    const external = href !== undefined && /^https?:/i.test(href);
    return (
      <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>
        {children}
      </a>
    );
  },
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
