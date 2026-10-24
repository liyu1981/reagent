import { Check, ChevronDown, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useReAgent, useReAgentConfig } from '../../core/hooks';
import { useToast, useTranslation } from '../../core/i18n';
import { getOpfsStats } from '../../core/tools';
import { setKeyRetention } from '../../core/models';
import { cn } from '../../lib/utils';
import { Button } from '../../primitives/button';
import { ConfirmDialog } from '../../primitives/confirm-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '../../primitives/popover';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const RETENTION_OPTIONS: ReadonlyArray<{ value: number | null; labelKey: string }> = [
  { value: HOUR_MS, labelKey: 'agent.keyRetention1h' },
  { value: DAY_MS, labelKey: 'agent.keyRetention1d' },
  { value: 7 * DAY_MS, labelKey: 'agent.keyRetention7d' },
  { value: 30 * DAY_MS, labelKey: 'agent.keyRetention30d' },
  { value: null, labelKey: 'agent.keyRetentionForever' },
];

/**
 * The General settings tab. Sections: API key retention and the installed
 * filesystem tools. "Keep forever" is opt-in behind a warning and a second
 * confirmation.
 */
export function ReAgentGeneralPanel() {
  const { t } = useTranslation();
  const toast = useToast();
  const { storagePrefix, filesystem, setView } = useReAgent();
  const { config } = useReAgentConfig();
  const [open, setOpen] = useState(false);
  const [confirmForever, setConfirmForever] = useState(false);
  const [fsStats, setFsStats] = useState<{ files: number; bytes: number } | null>(null);

  useEffect(() => {
    const handle = filesystem?.opfs ?? null;
    const namespace = filesystem?.namespace ?? '';
    if (handle === null) {
      setFsStats(null);
      return;
    }
    let cancelled = false;
    void getOpfsStats(handle, namespace).then(next => {
      if (!cancelled) {
        setFsStats(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [filesystem?.opfs, filesystem?.namespace]);

  const retention = config.keyRetentionMs;
  const currentLabelKey =
    RETENTION_OPTIONS.find(option => option.value === retention)?.labelKey ??
    'agent.keyRetention7d';

  function apply(value: number | null) {
    const removed = setKeyRetention(value, storagePrefix);
    toast.success(
      removed.length > 0
        ? t('agent.keyRetentionSavedExpiry', { count: removed.length })
        : t('agent.keyRetentionSaved'),
    );
  }

  function handleSelect(value: number | null) {
    setOpen(false);
    if (value === null && retention !== null) {
      setConfirmForever(true);
      return;
    }
    apply(value);
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {t('agent.keyRetentionTitle')}
        </p>
        <div className="space-y-3 rounded-xl border border-border/50 p-3">
          <p className="text-xs text-muted-foreground">{t('agent.keyRetentionDescription')}</p>
          <div className="max-w-64">
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="h-8 w-full justify-between font-normal"
                >
                  <span className="truncate">{t(currentLabelKey)}</span>
                  <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-1">
                {RETENTION_OPTIONS.map(option => (
                  <button
                    key={option.labelKey}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={cn(
                      'flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted',
                      option.value === null && 'text-amber-600 dark:text-amber-400',
                    )}
                  >
                    <Check
                      className={cn('size-3.5 shrink-0', option.value !== retention && 'opacity-0')}
                    />
                    {t(option.labelKey)}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </div>
          {retention === null && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-600 dark:text-amber-400">
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
              <span>{t('agent.keyRetentionForeverWarning')}</span>
            </div>
          )}
        </div>
      </section>

      {filesystem !== null ? (
        <section className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t('agent.fsTitle')}
          </p>
          <div className="space-y-3 rounded-xl border border-border/50 p-3">
            <p className="text-xs text-muted-foreground">
              {t('agent.fsDescription', { fs: filesystem.namespace })}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('agent.fsStats', { files: fsStats?.files ?? 0, bytes: fsStats?.bytes ?? 0 })}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => setView('filesystem')}
              disabled={filesystem.opfs === null}
            >
              {t('agent.fsBrowse')}
            </Button>
          </div>
        </section>
      ) : null}

      <ConfirmDialog
        open={confirmForever}
        onOpenChange={setConfirmForever}
        title={t('agent.keyRetentionForeverTitle')}
        description={t('agent.keyRetentionForeverWarning')}
        confirmLabel={t('agent.keyRetentionForeverConfirm')}
        cancelLabel={t('agent.cancel')}
        destructive
        onConfirm={() => apply(null)}
      />
    </div>
  );
}
