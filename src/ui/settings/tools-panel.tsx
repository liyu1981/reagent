import { useTranslation } from '../../core/i18n';

import { Switch } from '../../primitives/switch';
import type { AgentToolGroup } from '../../core/types';

import { useReAgent, useReAgentConfig } from '../../core/hooks';

const GROUPS: AgentToolGroup[] = ['content', 'editor', 'web', 'skills', 'mcp'];

export function ReAgentToolsPanel() {
  const { config, update } = useReAgentConfig();
  const { tools: allTools } = useReAgent();
  const { t } = useTranslation();
  const disabled = new Set(config.toolsDisabled);

  const toggle = (id: string, enabled: boolean) => {
    const next = new Set(config.toolsDisabled);
    if (enabled) {
      next.delete(id);
    } else {
      next.add(id);
    }
    update({ toolsDisabled: [...next] });
  };

  return (
    <div className="space-y-5">
      {GROUPS.map(group => {
        const tools = allTools.filter(descriptor => descriptor.group === group);
        if (tools.length === 0) {
          return null;
        }
        return (
          <div key={group} className="space-y-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {t(`agent.toolsGroup.${group}`)}
            </p>
            {tools.map(tool => (
              <div
                key={tool.id}
                className="flex items-start gap-3 rounded-xl border border-border/50 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{tool.label}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {tool.description}
                  </p>
                </div>
                <Switch
                  checked={!disabled.has(tool.id)}
                  onCheckedChange={enabled => toggle(tool.id, enabled)}
                  aria-label={tool.label}
                />
              </div>
            ))}
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">{t('agent.toolsDisabledHint')}</p>
    </div>
  );
}
