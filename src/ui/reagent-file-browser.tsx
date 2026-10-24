import { ArrowLeft, Folder } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { guessMimeType } from '../core/attachments';
import { createOpfsFileStore } from '../core/file-store';
import { useReAgent } from '../core/hooks';
import { useTranslation } from '../core/i18n';
import { getOpfsStats, listOpfsEntries, type OpfsEntry, type OpfsStats } from '../core/tools';
import { ReAgentFileAttachment } from './reagent-file-attachment';

/**
 * Full-surface browser over the installed filesystem namespace. Opened from
 * the general settings "Browse files" action; replaces the chat surface while
 * the view is `filesystem`.
 */
export function ReAgentFileBrowser() {
  const { filesystem, setView } = useReAgent();
  const { t } = useTranslation();
  const namespace = filesystem?.namespace ?? '';
  const opfs = filesystem?.opfs ?? null;
  const [path, setPath] = useState<string[]>([]);
  const [entries, setEntries] = useState<OpfsEntry[]>([]);
  const [stats, setStats] = useState<OpfsStats | null>(null);
  const store = useMemo(() => createOpfsFileStore(namespace, { root: opfs }), [namespace, opfs]);

  useEffect(() => {
    if (opfs === null) {
      return;
    }
    let cancelled = false;
    void listOpfsEntries(opfs, namespace, path).then(next => {
      if (!cancelled) {
        setEntries(next);
      }
    });
    void getOpfsStats(opfs, namespace).then(next => {
      if (!cancelled) {
        setStats(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [opfs, namespace, path]);

  if (opfs === null) {
    return null;
  }

  const segments = [namespace, ...path];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
        <button
          type="button"
          onClick={() => {
            if (path.length > 0) {
              setPath(path.slice(0, -1));
              return;
            }
            setView('chat');
          }}
          aria-label="Back"
          className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
        </button>
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{segments.join(' / ')}</p>
        {path.length > 0 ? (
          <button
            type="button"
            onClick={() => setPath([])}
            className="rounded-md px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            Root
          </button>
        ) : null}
      </header>
      <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No files.</p>
        ) : (
          <ul className="space-y-1">
            {entries.map(entry => {
              const relativePath = [...path, entry.name].join('/');
              return (
                <li key={entry.name}>
                  {entry.kind === 'directory' ? (
                    <button
                      type="button"
                      onClick={() => setPath([...path, entry.name])}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-muted"
                    >
                      <Folder className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">Folder</span>
                    </button>
                  ) : (
                    <ReAgentFileAttachment
                      file={{
                        id: relativePath,
                        name: entry.name,
                        mimeType: guessMimeType(entry.name),
                        size: entry.size ?? 0,
                        path: relativePath,
                      }}
                      store={store}
                      compact
                      className="w-full"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <footer className="border-t border-border/60 px-3 py-2 text-xs text-muted-foreground">
        {stats === null ? null : t('agent.fsStats', { files: stats.files, bytes: stats.bytes })}
      </footer>
    </div>
  );
}
