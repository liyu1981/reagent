import { Check, Loader2, RefreshCw, Server } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useReAgent, useReAgentConfig } from '../../core/hooks';
import { useToast, useTranslation } from '../../core/i18n';
import {
  EXA_SERVER_ID,
  getExaApiKey,
  getMcpManager,
  type McpServerStatus,
  saveMcpServers,
  setExaApiKey,
  syncMcpServersWithTimeout,
} from '../../core/mcp';
import type { McpServerConfig } from '../../core/types';
import { Badge } from '../../primitives/badge';
import { Button } from '../../primitives/button';
import { Input } from '../../primitives/input';
import { Label } from '../../primitives/label';
import { Switch } from '../../primitives/switch';

export function ReAgentMcpPanel() {
  const { config, update } = useReAgentConfig();
  const { storagePrefix } = useReAgent();
  const { t } = useTranslation();
  const toast = useToast();
  const mcp = useMemo(() => getMcpManager(storagePrefix), [storagePrefix]);
  const servers = config.mcp;
  const [statuses, setStatuses] = useState<McpServerStatus[]>(() => mcp.getStatuses());
  const [keyDraft, setKeyDraft] = useState(() => getExaApiKey(storagePrefix));
  const [testing, setTesting] = useState(false);

  useEffect(() => mcp.subscribe(() => setStatuses(mcp.getStatuses())), [mcp]);

  const persist = useCallback(
    (next: McpServerConfig[]) => {
      update({ mcp: next });
      saveMcpServers(next, storagePrefix);
      setStatuses(mcp.getStatuses(next));
    },
    [update],
  );

  const handleToggle = useCallback(
    async (id: string, enabled: boolean) => {
      persist(servers.map(server => (server.id === id ? { ...server, enabled } : server)));
      if (enabled) {
        await syncMcpServersWithTimeout(storagePrefix);
        setStatuses(mcp.getStatuses());
      }
    },
    [persist, servers],
  );

  const handleSaveKey = useCallback(async () => {
    setExaApiKey(keyDraft, storagePrefix);
    toast.success(t('agent.mcpKeySaved'));
    await mcp.reset();
    await syncMcpServersWithTimeout(storagePrefix);
    setStatuses(mcp.getStatuses());
  }, [keyDraft, t]);

  const handleTest = useCallback(async () => {
    setTesting(true);
    await mcp.reset();
    await syncMcpServersWithTimeout(storagePrefix);
    setStatuses(mcp.getStatuses());
    setTesting(false);
  }, []);

  const statusLabel = (status: McpServerStatus): string => {
    if (status.connecting) {
      return t('agent.mcpConnecting');
    }
    if (status.connected) {
      return t('agent.mcpConnected', { count: status.toolCount });
    }
    if (status.authRequired) {
      return t('agent.mcpAuthRequired');
    }
    if (status.error !== undefined) {
      return t('agent.mcpError');
    }
    return t('agent.mcpDisconnected');
  };

  return (
    <div className="space-y-4">
      {servers.map(server => {
        const status = statuses.find(candidate => candidate.id === server.id);
        const isExa = server.id === EXA_SERVER_ID;
        return (
          <div key={server.id} className="space-y-2 rounded-xl border border-border/50 p-3">
            <div className="flex items-center gap-2">
              <Server className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">{server.name}</span>
              <Switch
                checked={server.enabled}
                onCheckedChange={value => void handleToggle(server.id, value)}
                aria-label={server.name}
              />
              <span className="ml-auto">
                {server.enabled && status !== undefined && (
                  <Badge
                    variant={status.connected ? 'secondary' : 'outline'}
                    className="gap-1"
                    title={status.error}
                  >
                    {status.connecting && <Loader2 className="size-3 animate-spin" />}
                    {status.connected && <Check className="size-3" />}
                    {statusLabel(status)}
                  </Badge>
                )}
              </span>
            </div>

            <p className="truncate font-mono text-xs text-muted-foreground" title={server.url}>
              {server.url}
            </p>

            {isExa && (
              <div className="space-y-1.5">
                <Label className="text-xs">{t('agent.mcpExaKeyLabel')}</Label>
                <div className="flex gap-1.5">
                  <Input
                    type="password"
                    value={keyDraft}
                    onChange={event => setKeyDraft(event.target.value)}
                    placeholder={t('agent.mcpExaKeyPlaceholder')}
                    className="h-8 flex-1"
                    autoComplete="off"
                  />
                  <Button variant="outline" size="sm" onClick={() => void handleSaveKey()}>
                    {t('agent.save')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleTest()}
                    disabled={testing}
                  >
                    {testing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                    {t('agent.mcpTest')}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{t('agent.mcpExaKeyHint')}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
