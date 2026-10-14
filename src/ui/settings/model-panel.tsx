import { Check, ChevronsUpDown, KeyRound, Loader2, RefreshCw, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useReAgent } from '../../core/hooks';
import { useToast, useTranslation } from '../../core/i18n';
import {
  clearApiKey,
  getModels,
  getOllamaBaseUrl,
  hasCredential,
  isVerified,
  OLLAMA_PROVIDER_ID,
  refreshModels,
  saveApiKey,
  setOllamaBaseUrl,
  testConnection,
} from '../../core/models';
import { cn } from '../../lib/utils';
import { Badge } from '../../primitives/badge';
import { Button } from '../../primitives/button';
import { Input } from '../../primitives/input';
import { Label } from '../../primitives/label';
import { Popover, PopoverContent, PopoverTrigger } from '../../primitives/popover';

interface ProviderOption {
  id: string;
  name: string;
}

type PanelStatus = { ok: boolean; message: string };

/** shadcn-style combobox (Popover + searchable list, never a native select). */
function ProviderCombobox({
  providers,
  value,
  onChange,
}: {
  providers: ProviderOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = providers.find(provider => provider.id === value);

  const needle = query.trim().toLowerCase();
  const filtered =
    needle === ''
      ? providers
      : providers.filter(
          provider =>
            provider.name.toLowerCase().includes(needle) ||
            provider.id.toLowerCase().includes(needle),
        );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-8 w-full justify-between font-normal"
        >
          <span className="truncate">{selected?.name ?? t('agent.selectProviderPlaceholder')}</span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] gap-1 p-1">
        <Input
          autoFocus
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder={t('agent.searchProviders')}
          className="h-8"
        />
        <div className="thin-scrollbar max-h-56 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              {t('agent.noProvidersFound')}
            </p>
          )}
          {filtered.map(provider => (
            <button
              key={provider.id}
              type="button"
              onClick={() => {
                onChange(provider.id);
                setOpen(false);
                setQuery('');
              }}
              className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
            >
              <Check className={cn('size-3.5 shrink-0', provider.id !== value && 'opacity-0')} />
              <span className="min-w-0 flex-1 truncate">{provider.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{provider.id}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function StatusMessage({ status }: { status: PanelStatus }) {
  return (
    <p className={status.ok ? 'text-xs text-muted-foreground' : 'text-xs text-destructive'}>
      {status.ok ? (
        <span className="flex items-center gap-1">
          <Check className="size-3" />
          {status.message}
        </span>
      ) : (
        <span className="flex items-start gap-1">
          <X className="mt-0.5 size-3 shrink-0" />
          {status.message}
        </span>
      )}
    </p>
  );
}

export function ReAgentModelPanel() {
  const { t } = useTranslation();
  const toast = useToast();
  const { storagePrefix } = useReAgent();
  const providers = useMemo(
    () =>
      getModels(storagePrefix)
        .getProviders()
        .map(provider => ({ id: provider.id, name: provider.name })),
    [storagePrefix],
  );
  const cloudProviders = useMemo(
    () => providers.filter(provider => provider.id !== OLLAMA_PROVIDER_ID),
    [providers],
  );

  const [selectedProvider, setSelectedProvider] = useState(
    () =>
      cloudProviders.find(provider => provider.id === 'openai')?.id ?? cloudProviders[0]?.id ?? '',
  );
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [configured, setConfigured] = useState<Record<string, boolean>>({});
  const [verified, setVerified] = useState<Record<string, boolean>>({});
  const [ollamaUrl, setOllamaUrl] = useState(getOllamaBaseUrl(storagePrefix));
  const [refreshing, setRefreshing] = useState(false);
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<Record<string, PanelStatus>>({});

  useEffect(() => {
    const saved: Record<string, boolean> = {};
    const proven: Record<string, boolean> = {};
    for (const provider of providers) {
      saved[provider.id] = hasCredential(provider.id, storagePrefix);
      proven[provider.id] = isVerified(provider.id, storagePrefix);
    }
    setConfigured(saved);
    setVerified(proven);
  }, [providers]);

  async function handleSaveKey(providerId: string) {
    const key = (keys[providerId] ?? '').trim();
    if (key === '') {
      return;
    }
    await saveApiKey(providerId, key, storagePrefix);
    setConfigured(prev => ({ ...prev, [providerId]: true }));
    setStatus(prev => ({ ...prev, [providerId]: { ok: true, message: t('agent.keySaved') } }));
  }

  async function handleClearKey(providerId: string) {
    await clearApiKey(providerId, storagePrefix);
    setConfigured(prev => ({ ...prev, [providerId]: false }));
    setStatus(prev => ({ ...prev, [providerId]: { ok: true, message: t('agent.keyCleared') } }));
  }

  async function handleTest(providerId: string) {
    setTesting(prev => ({ ...prev, [providerId]: true }));
    setStatus(prev => ({ ...prev, [providerId]: { ok: true, message: t('agent.testing') } }));
    try {
      const modelId = await testConnection(providerId, storagePrefix);
      setVerified(prev => ({ ...prev, [providerId]: true }));
      setStatus(prev => ({
        ...prev,
        [providerId]: { ok: true, message: t('agent.connected', { model: modelId }) },
      }));
    } catch (err) {
      const code = err instanceof Error ? err.message : String(err);
      const message =
        code === 'not_configured'
          ? t('agent.testNotConfigured')
          : code === 'no_model'
            ? t('agent.testNoModel')
            : t('agent.testFailed', { detail: String(err instanceof Error ? err.message : err) });
      setStatus(prev => ({ ...prev, [providerId]: { ok: false, message } }));
    } finally {
      setTesting(prev => ({ ...prev, [providerId]: false }));
    }
  }

  const handleSaveOllama = useCallback(() => {
    setOllamaBaseUrl(ollamaUrl, storagePrefix);
    toast.success(t('agent.ollamaSaved'));
  }, [ollamaUrl, t]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshModels(storagePrefix);
    setRefreshing(false);
    toast.success(t('agent.modelsRefreshed'));
  }, [t]);

  const selectedName =
    cloudProviders.find(provider => provider.id === selectedProvider)?.name ?? '';

  return (
    <div className="space-y-6">
      {/* Custom / local OpenAI-compatible endpoint */}
      <section className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {t('agent.customLocalLlm')}
        </p>
        <div className="space-y-1.5 rounded-xl border border-border/50 p-3">
          <div className="flex gap-1.5">
            <Input
              value={ollamaUrl}
              onChange={event => setOllamaUrl(event.target.value)}
              placeholder="http://localhost:11434"
              className="h-8 flex-1"
            />
            <Button variant="outline" size="sm" onClick={handleSaveOllama}>
              {t('agent.save')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('agent.ollamaBaseUrlHint')}</p>
          <div className="flex gap-1.5">
            <Input
              type="password"
              value={keys[OLLAMA_PROVIDER_ID] ?? ''}
              onChange={event =>
                setKeys(prev => ({ ...prev, [OLLAMA_PROVIDER_ID]: event.target.value }))
              }
              placeholder={t('agent.ollamaKeyPlaceholder')}
              className="h-8 min-w-32 flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleSaveKey(OLLAMA_PROVIDER_ID)}
              disabled={(keys[OLLAMA_PROVIDER_ID] ?? '').trim() === ''}
            >
              {t('agent.saveKey')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleTest(OLLAMA_PROVIDER_ID)}
              disabled={testing[OLLAMA_PROVIDER_ID]}
            >
              {testing[OLLAMA_PROVIDER_ID] ? <Loader2 className="animate-spin" /> : <Check />}
              {t('agent.testConnection')}
            </Button>
          </div>
          {status[OLLAMA_PROVIDER_ID] !== undefined && (
            <StatusMessage status={status[OLLAMA_PROVIDER_ID]} />
          )}
        </div>
      </section>

      {/* Cloud providers */}
      <section className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {t('agent.cloudProviders')}
        </p>
        <div className="space-y-2 rounded-xl border border-border/50 p-3">
          <ProviderCombobox
            providers={cloudProviders}
            value={selectedProvider}
            onChange={setSelectedProvider}
          />

          {selectedProvider !== '' && (
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <KeyRound className="size-3.5 text-muted-foreground" />
                {selectedName}
                {configured[selectedProvider] && (
                  <Badge variant="secondary">{t('agent.keySet')}</Badge>
                )}
                {verified[selectedProvider] && (
                  <Badge variant="outline" className="gap-1">
                    <Check className="size-3" />
                    {t('agent.verified')}
                  </Badge>
                )}
              </Label>
              <div className="flex flex-wrap gap-1.5">
                <Input
                  type="password"
                  value={keys[selectedProvider] ?? ''}
                  onChange={event =>
                    setKeys(prev => ({ ...prev, [selectedProvider]: event.target.value }))
                  }
                  placeholder={t('agent.apiKeyPlaceholder')}
                  className="h-8 min-w-32 flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleSaveKey(selectedProvider)}
                  disabled={(keys[selectedProvider] ?? '').trim() === ''}
                >
                  {t('agent.saveKey')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleClearKey(selectedProvider)}
                  disabled={!configured[selectedProvider]}
                >
                  {t('agent.clearKey')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleTest(selectedProvider)}
                  disabled={testing[selectedProvider]}
                >
                  {testing[selectedProvider] ? <Loader2 className="animate-spin" /> : <Check />}
                  {t('agent.testConnection')}
                </Button>
              </div>
              {status[selectedProvider] !== undefined && (
                <StatusMessage status={status[selectedProvider]} />
              )}
            </div>
          )}
        </div>
      </section>

      <div className="flex items-center justify-between border-t border-border/60 pt-4">
        <span className="text-sm">{t('agent.refreshModels')}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handleRefresh()}
          disabled={refreshing}
        >
          {refreshing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          {t('agent.refresh')}
        </Button>
      </div>
    </div>
  );
}
