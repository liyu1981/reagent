import { Globe } from 'lucide-react';

import { useReAgent } from '../../core/hooks';
import { useTranslation } from '../../core/i18n';
import { Badge } from '../../primitives/badge';

/**
 * Shows the tools the current page exposes through WebMCP
 * (`document.modelContext`). ReAgent adds them to the agent automatically.
 */
export function ReAgentWebMcpPanel() {
  const { webmcp } = useReAgent();
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{t('agent.webmcpDescription')}</p>

      {!webmcp.available ? (
        <p className="text-sm text-muted-foreground">{t('agent.webmcpUnavailable')}</p>
      ) : webmcp.tools.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('agent.webmcpEmpty')}</p>
      ) : (
        <div className="space-y-2">
          {webmcp.tools.map(tool => (
            <div
              key={tool.name}
              className="flex items-start gap-3 rounded-xl border border-border/50 p-3"
            >
              <Globe className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  {tool.label}
                  <Badge variant="outline">{t('agent.webmcpBadge')}</Badge>
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                  {tool.description}
                </p>
                <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                  {tool.name}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
