import { Download, Eye, FileText, Loader2, X } from 'lucide-react';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { formatFileSize, isTextFile } from '../core/attachments';
import { useReAgent } from '../core/hooks';
import { useTranslation } from '../core/i18n';
import type { ReAgentFileRef, ReAgentFileStore } from '../core/types';
import { cn } from '../lib/utils';
import { Button } from '../primitives/button';

const TEXT_PREVIEW_MAX = 200_000;

function isImageFile(file: ReAgentFileRef): boolean {
  return file.mimeType.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(file.name);
}

function isPdfFile(file: ReAgentFileRef): boolean {
  return file.mimeType === 'application/pdf' || /\.pdf$/i.test(file.name);
}

function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type PreviewState =
  | { status: 'loading' }
  | { status: 'image'; url: string }
  | { status: 'pdf'; url: string }
  | { status: 'text'; text: string }
  | { status: 'unsupported' }
  | { status: 'error'; message: string };

export interface ReAgentFilePreviewPanelProps {
  file: ReAgentFileRef;
  load: () => Promise<Blob>;
  onClose: () => void;
}

/**
 * The preview surface itself. It is deliberately not a page-level dialog:
 * `ReAgentFilePreviewProvider` renders it inside the ReAgent root.
 */
export function ReAgentFilePreviewPanel({ file, load, onClose }: ReAgentFilePreviewPanelProps) {
  const { t } = useTranslation();
  const [state, setState] = useState<PreviewState>({ status: 'loading' });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setState({ status: 'loading' });

    void (async () => {
      try {
        if (isImageFile(file) || isPdfFile(file)) {
          const blob = await load();
          if (cancelled) {
            return;
          }
          objectUrl = URL.createObjectURL(blob);
          setState({ status: isImageFile(file) ? 'image' : 'pdf', url: objectUrl });
          return;
        }
        if (isTextFile(file)) {
          const text = await (await load()).text();
          if (!cancelled) {
            setState({
              status: 'text',
              text:
                text.length > TEXT_PREVIEW_MAX ? `${text.slice(0, TEXT_PREVIEW_MAX)}\n\n…` : text,
            });
          }
          return;
        }
        setState({ status: 'unsupported' });
      } catch (err) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: t('agent.filePreviewFailed', {
              detail: err instanceof Error ? err.message : String(err),
            }),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl !== null) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [file, load, t]);

  async function download(): Promise<void> {
    try {
      downloadBlob(await load(), file.name);
    } catch {
      // The panel already reports load failures; the download button is not
      // shown for unsupported files.
    }
  }

  return (
    <>
      <header className="flex items-start gap-2 border-b border-border/60 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold" title={file.name}>
            {file.name}
          </h2>
          <p className="truncate text-xs text-muted-foreground">
            {formatFileSize(file.size)} · {file.mimeType || 'file'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('agent.close')}
          className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </header>
      <div className="thin-scrollbar min-h-0 flex-1 overflow-auto bg-muted/30 p-3">
        {state.status === 'loading' && (
          <div className="flex h-24 items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        )}
        {state.status === 'image' && (
          <img src={state.url} alt={file.name} className="mx-auto max-h-full rounded-lg" />
        )}
        {state.status === 'pdf' && (
          <iframe title={file.name} src={state.url} className="h-[60vh] w-full rounded-lg" />
        )}
        {state.status === 'text' && (
          <pre className="whitespace-pre-wrap break-words font-mono text-xs">{state.text}</pre>
        )}
        {state.status === 'unsupported' && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t('agent.filePreviewUnavailable')}
          </p>
        )}
        {state.status === 'error' && (
          <p className="py-8 text-center text-sm text-destructive">{state.message}</p>
        )}
      </div>
      <footer className="flex justify-end border-t border-border/60 px-4 py-3">
        {state.status !== 'unsupported' && state.status !== 'error' && (
          <Button type="button" variant="outline" onClick={() => void download()}>
            <Download className="size-4" />
            {t('agent.fileDownload')}
          </Button>
        )}
      </footer>
    </>
  );
}

interface ReAgentFilePreviewContextValue {
  open: (file: ReAgentFileRef, load: () => Promise<Blob>) => void;
}

const ReAgentFilePreviewContext = createContext<ReAgentFilePreviewContextValue | null>(null);

/** Open a file preview inside the nearest ReAgent container. */
export function useReAgentFilePreview(): ReAgentFilePreviewContextValue | null {
  return useContext(ReAgentFilePreviewContext);
}

/**
 * Hosts the contained file-preview surface. The preset `<ReAgent>` wraps its
 * root with this provider, so previews stay inside the panel instead of
 * covering the whole page.
 */
export function ReAgentFilePreviewProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<{
    file: ReAgentFileRef;
    load: () => Promise<Blob>;
  } | null>(null);
  const open = useCallback((file: ReAgentFileRef, load: () => Promise<Blob>) => {
    setRequest({ file, load });
  }, []);
  const close = useCallback(() => setRequest(null), []);
  const value = useMemo(() => ({ open }), [open]);

  return (
    <ReAgentFilePreviewContext.Provider value={value}>
      {children}
      {request !== null && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/45 p-3 backdrop-blur-sm"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) {
              close();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={request.file.name}
            className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border/70 bg-background text-foreground shadow-2xl"
          >
            <ReAgentFilePreviewPanel file={request.file} load={request.load} onClose={close} />
          </div>
        </div>
      )}
    </ReAgentFilePreviewContext.Provider>
  );
}

export interface ReAgentFileAttachmentProps {
  file: ReAgentFileRef;
  /** Override the store from `useReAgent().files`. */
  store?: ReAgentFileStore | null;
  compact?: boolean;
  onRemove?: () => void;
  className?: string;
}

/** One stored file: thumbnail, metadata, preview/download/remove actions. */
export function ReAgentFileAttachment({
  file,
  store,
  compact = false,
  onRemove,
  className,
}: ReAgentFileAttachmentProps) {
  const { files } = useReAgent();
  const { t } = useTranslation();
  const preview = useReAgentFilePreview();
  const resolvedStore = store === undefined ? (files?.store ?? null) : store;
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<Blob> => {
    if (resolvedStore === null) {
      throw new Error(t('agent.fileStoreUnavailable'));
    }
    return resolvedStore.get(file);
  }, [file, resolvedStore, t]);

  useEffect(() => {
    if (resolvedStore === null || !isImageFile(file)) {
      setThumbnail(null);
      return;
    }
    let cancelled = false;
    let url: string | null = null;
    void resolvedStore
      .get(file)
      .then(blob => {
        if (cancelled) {
          return;
        }
        url = URL.createObjectURL(blob);
        setThumbnail(url);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (url !== null) {
        URL.revokeObjectURL(url);
      }
    };
  }, [file, resolvedStore]);

  async function download(): Promise<void> {
    setDownloading(true);
    setError(null);
    try {
      downloadBlob(await load(), file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div
      data-slot="reagent-file-attachment"
      className={cn(
        'flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 p-1.5 text-xs',
        compact && 'rounded-md p-1',
        className,
      )}
    >
      {thumbnail !== null ? (
        <img src={thumbnail} alt={file.name} className="size-9 shrink-0 rounded-md object-cover" />
      ) : (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border/40 bg-card">
          <FileText className="size-4 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium" title={file.name}>
          {file.name}
        </p>
        {error !== null ? (
          <p className="truncate text-destructive" title={error}>
            {error}
          </p>
        ) : (
          <p className="truncate text-[10px] text-muted-foreground">
            {formatFileSize(file.size)} · {file.mimeType || 'file'}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={() => {
            if (preview !== null) {
              preview.open(file, load);
            } else {
              setFallbackOpen(true);
            }
          }}
          aria-label={t('agent.filePreview')}
          title={t('agent.filePreview')}
          className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <Eye className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => void download()}
          disabled={downloading}
          aria-label={t('agent.fileDownload')}
          title={t('agent.fileDownload')}
          className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          {downloading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Download className="size-3.5" />
          )}
        </button>
        {onRemove !== undefined && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={t('agent.removeAttachment')}
            title={t('agent.removeAttachment')}
            className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      {preview === null && fallbackOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 backdrop-blur-sm"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) {
              setFallbackOpen(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={file.name}
            className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border/70 bg-background text-foreground shadow-2xl"
          >
            <ReAgentFilePreviewPanel
              file={file}
              load={load}
              onClose={() => setFallbackOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
