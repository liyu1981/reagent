import { Check, KeyRound, Loader2, RefreshCw, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../../core/i18n';
import { useToast } from '../../core/i18n';

import { Badge } from '../../primitives/badge';
import { Button } from '../../primitives/button';
import { Input } from '../../primitives/input';
import { Label } from '../../primitives/label';
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

export function ReAgentModelPanel() {
  const { t } = useTranslation();
  const toast = useToast();
  const providers = useMemo(
    () =>
      getModels()
        .getProviders()
        .map(provider => ({ id: provider.id, name: provider.name })),
    [],
  );

  const [keys, setKeys] = useState<Record<string, string>>({});
  const [configured, setConfigured] = useState<Record<string, boolean>>({});
  const [verified, setVerified] = useState<Record<string, boolean>>({});
  const [ollamaUrl, setOllamaUrl] = useState(getOllamaBaseUrl());
  const [refreshing, setRefreshing] = useState(false);
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<Record<string, { ok: boolean; message: string }>>({});

  useEffect(() => {
    const saved: Record<string, boolean> = {};
    const proven: Record<string, boolean> = {};
    for (const provider of providers) {
      saved[provider.id] = hasCredential(provider.id);
      proven[provider.id] = isVerified(provider.id);
    }
    setConfigured(saved);
    setVerified(proven);
  }, [providers]);

  async function handleSaveKey(providerId: string) {
    const key = (keys[providerId] ?? '').trim();
    if (key === '') {
      return;
    }
    await saveApiKey(providerId, key);
    setConfigured(prev => ({ ...prev, [providerId]: true }));
    setStatus(prev => ({ ...prev, [providerId]: { ok: true, message: t('agent.keySaved') } }));
  }

  async function handleClearKey(providerId: string) {
    await clearApiKey(providerId);
    setConfigured(prev => ({ ...prev, [providerId]: false }));
    setStatus(prev => ({ ...prev, [providerId]: { ok: true, message: t('agent.keyCleared') } }));
  }

  async function handleTest(providerId: string) {
    setTesting(prev => ({ ...prev, [providerId]: true }));
    setStatus(prev => ({ ...prev, [providerId]: { ok: true, message: t('agent.testing') } }));
    try {
      const modelId = await testConnection(providerId);
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
    setOllamaBaseUrl(ollamaUrl);
    toast.success(t('agent.ollamaSaved'));
  }, [ollamaUrl, t]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshModels();
    setRefreshing(false);
    toast.success(t('agent.modelsRefreshed'));
  }, [t]);

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        {providers.map(provider => (
          <div key={provider.id} className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <KeyRound className="size-3.5 text-muted-foreground" />
              {provider.id === OLLAMA_PROVIDER_ID ? t('agent.customLocalLlm') : provider.name}
              {configured[provider.id] && <Badge variant="secondary">{t('agent.keySet')}</Badge>}
              {verified[provider.id] && (
                <Badge variant="outline" className="gap-1">
                  <Check className="size-3" />
                  {t('agent.verified')}
                </Badge>
              )}
            </Label>

            {provider.id === OLLAMA_PROVIDER_ID ? (
              <div className="space-y-1.5">
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
                    value={keys[provider.id] ?? ''}
                    onChange={event =>
                      setKeys(prev => ({ ...prev, [provider.id]: event.target.value }))
                    }
                    placeholder={t('agent.ollamaKeyPlaceholder')}
                    className="h-8 min-w-32 flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleSaveKey(provider.id)}
                    disabled={(keys[provider.id] ?? '').trim() === ''}
                  >
                    {t('agent.saveKey')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleTest(provider.id)}
                    disabled={testing[provider.id]}
                  >
                    {testing[provider.id] ? <Loader2 className="animate-spin" /> : <Check />}
                    {t('agent.testConnection')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                <Input
                  type="password"
                  value={keys[provider.id] ?? ''}
                  onChange={event =>
                    setKeys(prev => ({ ...prev, [provider.id]: event.target.value }))
                  }
                  placeholder={t('agent.apiKeyPlaceholder')}
                  className="h-8 min-w-32 flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleSaveKey(provider.id)}
                  disabled={(keys[provider.id] ?? '').trim() === ''}
                >
                  {t('agent.saveKey')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleClearKey(provider.id)}
                  disabled={!configured[provider.id]}
                >
                  {t('agent.clearKey')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleTest(provider.id)}
                  disabled={testing[provider.id]}
                >
                  {testing[provider.id] ? <Loader2 className="animate-spin" /> : <Check />}
                  {t('agent.testConnection')}
                </Button>
              </div>
            )}

            {status[provider.id] !== undefined && (
              <p
                className={
                  status[provider.id].ok
                    ? 'text-xs text-muted-foreground'
                    : 'text-xs text-destructive'
                }
              >
                {status[provider.id].ok ? (
                  <span className="flex items-center gap-1">
                    <Check className="size-3" />
                    {status[provider.id].message}
                  </span>
                ) : (
                  <span className="flex items-start gap-1">
                    <X className="mt-0.5 size-3 shrink-0" />
                    {status[provider.id].message}
                  </span>
                )}
              </p>
            )}
          </div>
        ))}
      </div>

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
