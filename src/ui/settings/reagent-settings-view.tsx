import { ArrowLeft } from 'lucide-react';
import { useTranslation } from '../../core/i18n';

import { Button } from '../../primitives/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../primitives/tabs';

import { useReAgent } from '../../core/hooks';
import { ReAgentMcpPanel } from './mcp-panel';
import { ReAgentModelPanel } from './model-panel';
import { ReAgentPromptPanel } from './prompt-panel';
import { ReAgentSkillsPanel } from './skills-panel';
import { ReAgentToolsPanel } from './tools-panel';

/**
 * The in-component settings page. It replaces the chat surface (the same
 * `<ReAgentRoot>`) with a tabbed settings layout and a back button returning to
 * the conversation.
 */
export function ReAgentSettingsView() {
  const { setView } = useReAgent();
  const { t } = useTranslation();

  return (
    <>
      <header
        data-slot="reagent-settings-header"
        className="flex items-start gap-1.5 border-b border-border/60 px-2 py-2"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="mt-0.5"
          onClick={() => setView('chat')}
          aria-label={t('agent.settingsBack')}
        >
          <ArrowLeft />
        </Button>
        <div className="min-w-0">
          <p className="text-sm font-medium">{t('agent.settingsTitle')}</p>
          <p className="truncate text-xs text-muted-foreground">{t('agent.settingsDescription')}</p>
        </div>
      </header>

      <Tabs defaultValue="model" className="min-h-0 flex-1 gap-2">
        <div className="px-3 pt-2">
          <TabsList className="flex-wrap">
            <TabsTrigger value="model">{t('agent.settingsTabModel')}</TabsTrigger>
            <TabsTrigger value="prompt">{t('agent.settingsTabPrompt')}</TabsTrigger>
            <TabsTrigger value="skills">{t('agent.settingsTabSkills')}</TabsTrigger>
            <TabsTrigger value="tools">{t('agent.settingsTabTools')}</TabsTrigger>
            <TabsTrigger value="mcp">{t('agent.settingsTabMcp')}</TabsTrigger>
          </TabsList>
        </div>
        <div
          data-slot="reagent-settings-content"
          className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-3"
        >
          <TabsContent value="model">
            <ReAgentModelPanel />
          </TabsContent>
          <TabsContent value="prompt">
            <ReAgentPromptPanel />
          </TabsContent>
          <TabsContent value="skills">
            <ReAgentSkillsPanel />
          </TabsContent>
          <TabsContent value="tools">
            <ReAgentToolsPanel />
          </TabsContent>
          <TabsContent value="mcp">
            <ReAgentMcpPanel />
          </TabsContent>
        </div>
      </Tabs>
    </>
  );
}
