import {
  addCustomCloudProvider,
  clearApiKey,
  getCustomCloudProviders,
  hasCredential,
  isVerified,
  listBuiltinCloudProviders,
  removeCustomCloudProvider,
  saveApiKey,
  setCustomCloudProviders,
  subscribeAgentConfig,
  testConnection,
} from '@liyu1981/reagent';
import { useEffect, useReducer, useRef, useState } from 'react';

import { cn } from '../lib/cn';

/**
 * Cloud provider test bench for the "Browser support & cloud providers" doc.
 *
 * Every provider pi-ai ships is re-enabled through ReAgent's custom-provider
 * mechanism (`addCustomCloudProvider({ id })`), which makes it appear in
 * Settings → Model of any ReAgent running on the default storage prefix. From
 * here a provider can be enabled, keyed and tested (CORS check) in place, so
 * maintaining the support table no longer needs a code change.
 */

interface RowStatus {
  state: 'testing' | 'ok' | 'error';
  message: string;
}

const BUILTIN_PROVIDERS = listBuiltinCloudProviders();

export function CloudProviderTestBench() {
  const [, refresh] = useReducer((tick: number) => tick + 1, 0);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Record<string, RowStatus>>({});
  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => subscribeAgentConfig(refresh), []);

  const enabled = new Set(getCustomCloudProviders().map(spec => spec.id));

  function toggle(id: string) {
    if (enabled.has(id)) {
      removeCustomCloudProvider(id);
    } else {
      addCustomCloudProvider({ id });
    }
  }

  function enableAll() {
    const specs = [...getCustomCloudProviders()];
    for (const provider of BUILTIN_PROVIDERS) {
      if (!specs.some(spec => spec.id === provider.id)) {
        specs.push({ id: provider.id });
      }
    }
    setCustomCloudProviders(specs);
  }

  function disableAll() {
    const builtinIds = new Set(BUILTIN_PROVIDERS.map(provider => provider.id));
    setCustomCloudProviders(
      getCustomCloudProviders().filter(spec => !builtinIds.has(spec.id)),
    );
  }

  async function handleTest(id: string) {
    const key = (keys[id] ?? '').trim();
    if (key !== '') {
      await saveApiKey(id, key);
    }
    setStatus(prev => ({ ...prev, [id]: { state: 'testing', message: 'Testing…' } }));
    try {
      const models = await testConnection(id);
      setStatus(prev => ({
        ...prev,
        [id]: { state: 'ok', message: `Connected · ${models}` },
      }));
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const message = /failed to fetch|networkerror|load failed|fetch failed/i.test(detail)
        ? 'CORS/network blocked — the real error is hidden from the browser.'
        : detail === 'not_configured'
          ? 'No API key saved for this provider.'
          : detail;
      setStatus(prev => ({ ...prev, [id]: { state: 'error', message } }));
    }
  }

  async function handleClear(id: string) {
    await clearApiKey(id);
    setKeys(prev => ({ ...prev, [id]: '' }));
    setStatus(prev => ({ ...prev, [id]: { state: 'ok', message: 'Key cleared.' } }));
  }

  const verifiedCount = BUILTIN_PROVIDERS.filter(provider => isVerified(provider.id)).length;

  return (
    <div className="rounded-2xl border border-border bg-card/50 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold tracking-tight">Provider test bench</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Re-enable every pi-ai built-in cloud provider (currently{' '}
            <span className="font-medium text-foreground">{verifiedCount}</span> verified) without
            touching the library. Enabled providers appear in{' '}
            <span className="font-medium text-foreground">Settings → Model</span> of the demos; keys
            are kept in this browser (see Settings → General → API key retention).
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={enableAll}
            className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            Enable all
          </button>
          <button
            type="button"
            onClick={disableAll}
            className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            Disable all
          </button>
        </div>
      </div>

      <div className="thin-scrollbar mt-4 max-h-[28rem] overflow-y-auto rounded-xl border border-border/60">
        {BUILTIN_PROVIDERS.map(provider => {
          const rowStatus = status[provider.id];
          const configured = hasCredential(provider.id);
          const verified = isVerified(provider.id);
          const isEnabled = enabled.has(provider.id);
          return (
            <div
              key={provider.id}
              className="flex flex-wrap items-center gap-2 border-b border-border/40 px-3 py-2 text-sm last:border-b-0"
            >
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{provider.name}</span>{' '}
                <span className="text-xs text-muted-foreground">({provider.id})</span>
              </span>
              {configured && (
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">
                  key set
                </span>
              )}
              {verified && (
                <span className="rounded-full border border-emerald-500/40 px-2 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                  verified
                </span>
              )}
              <input
                type="password"
                value={keys[provider.id] ?? ''}
                onChange={event => setKeys(prev => ({ ...prev, [provider.id]: event.target.value }))}
                placeholder="API key…"
                className="h-7 w-36 rounded-lg border border-border bg-background px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              />
              <button
                type="button"
                onClick={() => void handleTest(provider.id)}
                disabled={rowStatus?.state === 'testing'}
                className={cn(
                  'rounded-lg border border-border px-2 py-1 text-xs transition hover:bg-accent',
                  rowStatus?.state === 'testing'
                    ? 'text-muted-foreground'
                    : 'text-foreground',
                )}
              >
                {rowStatus?.state === 'testing' ? 'Testing…' : 'Test'}
              </button>
              <button
                type="button"
                onClick={() => void handleClear(provider.id)}
                disabled={!configured}
                className="rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground transition hover:bg-accent disabled:opacity-40"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => toggle(provider.id)}
                className={cn(
                  'w-20 rounded-lg border px-2 py-1 text-xs transition',
                  isEnabled
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                {isEnabled ? 'Enabled' : 'Enable'}
              </button>
              {rowStatus !== undefined && (
                <p
                  className={cn(
                    'w-full text-xs',
                    rowStatus.state === 'error' ? 'text-destructive' : 'text-muted-foreground',
                  )}
                >
                  {rowStatus.message}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Re-enabling only registers the provider — a successful Test is what marks it verified.
      </p>
    </div>
  );
}
