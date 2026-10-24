import { useEffect, useMemo } from 'react';
import { Link, NavLink, useLocation, useNavigate, useParams } from 'react-router-dom';

import { CloudProviderTestBench } from '../components/CloudProviderTestBench';
import { Markdown } from '../components/Markdown';
import { ArrowLeftIcon, ArrowRightIcon } from '../components/icons';
import { DOCS, DOC_GROUPS, docNeighbours, getDoc } from '../docs';
import { docHeadings } from '../lib/doc-toc';
import { cn } from '../lib/cn';

function stripTitle(content: string): string {
  return content.replace(/^#\s[^\n]*\n+/, '');
}

export function Docs() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const doc = getDoc(slug);
  const { prev, next } = docNeighbours(doc.slug);
  const headings = useMemo(() => docHeadings(doc.content), [doc.content]);
  const activeHeading = location.hash === '' ? null : decodeURIComponent(location.hash.slice(1));

  useEffect(() => {
    if (location.hash === '') {
      window.scrollTo({ top: 0 });
      return;
    }
    const id = decodeURIComponent(location.hash.slice(1));
    const timer = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ block: 'start' });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [doc.slug, location.hash]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      {/* Mobile doc picker */}
      <div className="mb-6 lg:hidden">
        <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="doc-picker">
          Documentation
        </label>
        <select
          id="doc-picker"
          value={doc.slug}
          onChange={event => navigate(`/docs/${event.target.value}`)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          {DOC_GROUPS.map(group => (
            <optgroup key={group} label={group}>
              {DOCS.filter(entry => entry.group === group).map(entry => (
                <option key={entry.slug} value={entry.slug}>
                  {entry.title}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="flex gap-10">
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto pr-4">
            {DOC_GROUPS.map(group => (
              <div key={group} className="mb-6">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group}
                </p>
                <ul className="space-y-0.5 text-sm">
                  {DOCS.filter(entry => entry.group === group).map(entry => (
                    <li key={entry.slug}>
                      <NavLink
                        to={`/docs/${entry.slug}`}
                        className={({ isActive }) =>
                          cn(
                            'block rounded-lg px-3 py-1.5 transition',
                            isActive
                              ? 'bg-accent font-medium text-accent-foreground'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                          )
                        }
                      >
                        {entry.title}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        <article className="min-w-0 flex-1">
          <div className="mb-8 border-b border-border/70 pb-6">
            <p className="text-sm font-medium text-primary">{doc.group}</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{doc.title}</h1>
            <p className="mt-3 text-lg text-muted-foreground">{doc.summary}</p>
          </div>

          <Markdown content={stripTitle(doc.content)} />

          {doc.slug === 'browser-support' && (
            <div className="mt-10">
              <CloudProviderTestBench />
            </div>
          )}

          <nav className="mt-14 grid gap-3 border-t border-border/70 pt-6 sm:grid-cols-2">
            {prev !== null ? (
              <Link
                to={`/docs/${prev.slug}`}
                className="group flex flex-col rounded-xl border border-border p-4 transition hover:bg-accent/50"
              >
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ArrowLeftIcon className="size-3.5" /> Previous
                </span>
                <span className="mt-1 font-medium">{prev.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {next !== null && (
              <Link
                to={`/docs/${next.slug}`}
                className="group flex flex-col rounded-xl border border-border p-4 text-right transition hover:bg-accent/50"
              >
                <span className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
                  Next <ArrowRightIcon className="size-3.5" />
                </span>
                <span className="mt-1 font-medium">{next.title}</span>
              </Link>
            )}
          </nav>
        </article>

        {headings.length > 0 && (
          <aside className="hidden w-56 shrink-0 xl:block">
            <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto border-l border-border/70 pl-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                On this page
              </p>
              <ul className="space-y-0.5 text-sm">
                {headings.map(heading => (
                  <li key={heading.id}>
                    <Link
                      to={{ pathname: location.pathname, hash: `#${heading.id}` }}
                      className={cn(
                        'block rounded-md py-1 transition',
                        heading.depth === 3 ? 'pl-6 text-xs' : 'px-3',
                        activeHeading === heading.id
                          ? 'bg-accent font-medium text-accent-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      {heading.text}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
