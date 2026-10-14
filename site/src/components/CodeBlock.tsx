import { useMemo, useState } from 'react';

import { cn } from '../lib/cn';
import { highlightCode } from '../lib/highlight';
import { CheckIcon, CopyIcon } from './icons';

export function CodeBlock({
  code,
  language,
  className,
  showCopy = true,
}: {
  code: string;
  language?: string;
  className?: string;
  showCopy?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const html = useMemo(() => highlightCode(code, language), [code, language]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border border-border bg-muted/60',
        className,
      )}
    >
      {language !== undefined && (
        <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-3 py-1.5">
          <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
            {language}
          </span>
        </div>
      )}
      {showCopy && (
        <button
          type="button"
          onClick={copy}
          aria-label="Copy code"
          className="absolute right-2 top-2 rounded-md border border-border bg-background/80 p-1.5 text-muted-foreground opacity-0 transition hover:text-foreground group-hover:opacity-100"
        >
          {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
        </button>
      )}
      <pre className="code-scroll min-h-0 flex-1 overflow-auto p-3 text-[13px] leading-relaxed">
        <code
          className="hljs font-mono"
          // Highlighted by highlight.js; the input is our own source strings.
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </pre>
    </div>
  );
}
