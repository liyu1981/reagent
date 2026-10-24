import type { AgentTool } from '@earendil-works/pi-agent-core';
import { cva } from 'class-variance-authority';
import { useState } from 'react';
import type { EditorMutationBridge } from '../core/editor-mutations';
import { useReAgent } from '../core/hooks';
import type { ReAgentHostProvider } from '../core/host-providers';
import { useTranslation } from '../core/i18n';
import type {
  ReAgentMarkdown,
  ReAgentMessages,
  ReAgentNotify,
  ReAgentTheme,
  ReAgentTranslate,
} from '../core/messages';
import { ReAgentProvider } from '../core/reagent-provider';
import type { AgentDraft, AgentToolDescriptor, ReAgentFilesConfig } from '../core/types';
import { cn } from '../lib/utils';
import { Button } from '../primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../primitives/dialog';
import { Input } from '../primitives/input';
import {
  ReAgentComposer,
  ReAgentComposerAttach,
  ReAgentComposerAttachments,
  ReAgentComposerInput,
  ReAgentComposerRow,
  ReAgentComposerSelectionChip,
  ReAgentComposerStatus,
  ReAgentContextMeter,
  ReAgentModelPicker,
  ReAgentSendButton,
  ReAgentThinkingPicker,
} from './reagent-composer';
import { ReAgentFilePreviewProvider } from './reagent-file-attachment';
import { ReAgentFileBrowser } from './reagent-file-browser';
import {
  ReAgentCloseButton,
  ReAgentHeader,
  ReAgentNewSessionButton,
  ReAgentSessionTreeTrigger,
  ReAgentSettingsTrigger,
} from './reagent-header';
import { ReAgentMessageList } from './reagent-message-list';
import { ReAgentRoot } from './reagent-root';
import { ReAgentSessionsView } from './reagent-sessions-view';
import { ReAgentSettingsView } from './settings/reagent-settings-view';

export interface ReAgentProps {
  draft?: AgentDraft | null;
  editor?: EditorMutationBridge | null;
  selection?: string | null;
  onClearSelection?: () => void;
  onClose?: () => void;
  /** `glass` (default) is the frosted panel; `solid` is a flat near-white surface. */
  surface?: ReAgentSurface;
  className?: string;
  /** Host integrations (all optional). */
  theme?: ReAgentTheme;
  language?: string;
  messages?: Partial<ReAgentMessages>;
  translate?: ReAgentTranslate;
  notify?: ReAgentNotify;
  renderMarkdown?: ReAgentMarkdown;
  uploadFile?: (file: File) => Promise<string>;
  /** Opt-in durable conversation attachments. */
  files?: ReAgentFilesConfig | null;
  extraTools?: AgentTool<any>[];
  extraDescriptors?: AgentToolDescriptor[];
  /**
   * Namespace for persisted state (localStorage + the conversation IndexedDB).
   * Give each agent on a page a different value to keep them independent.
   */
  storagePrefix?: string;
  /** Host-injected LLM providers (own setup UI; config kept in memory only). */
  hostProviders?: ReAgentHostProvider[];
}

export type ReAgentSurface = 'glass' | 'solid';

const surfaceVariants = cva('relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl', {
  variants: {
    surface: {
      glass: 'glass-control-opaque',
      // Near-white in light mode, near-black counterpart in dark mode. The
      // `[data-surface='solid']` rule in index.css flattens descendant glass
      // bubbles to match.
      solid:
        'border border-border/70 bg-[#fafafa] shadow-[0_8px_40px_-8px_rgba(0,0,0,0.25)] dark:border-white/10 dark:bg-background dark:shadow-[0_8px_40px_-8px_rgba(0,0,0,0.6)]',
    },
  },
  defaultVariants: { surface: 'glass' },
});

/**
 * The default, styled agent composition. It is only one arrangement of the
 * parts — import `ReAgentProvider` + the `ui/` parts (and `core/hooks`) to
 * build a different one.
 */
export function ReAgent({
  draft,
  editor,
  selection,
  onClearSelection,
  onClose,
  surface,
  className,
  theme,
  language,
  messages,
  translate,
  notify,
  renderMarkdown,
  uploadFile,
  files,
  extraTools,
  extraDescriptors,
  storagePrefix,
  hostProviders,
}: ReAgentProps) {
  return (
    <ReAgentProvider
      editor={editor}
      draft={draft}
      selection={selection}
      onClearSelection={onClearSelection}
      theme={theme}
      language={language}
      messages={messages}
      translate={translate}
      notify={notify}
      renderMarkdown={renderMarkdown}
      uploadFile={uploadFile}
      files={files}
      extraTools={extraTools}
      extraDescriptors={extraDescriptors}
      storagePrefix={storagePrefix}
      hostProviders={hostProviders}
    >
      <ReAgentChrome onClose={onClose} surface={surface} className={className} />
    </ReAgentProvider>
  );
}

function ReAgentChrome({
  onClose,
  surface = 'glass',
  className,
}: {
  onClose?: () => void;
  surface?: ReAgentSurface;
  className?: string;
}) {
  const { view } = useReAgent();
  return (
    <ReAgentRoot data-surface={surface} className={cn(surfaceVariants({ surface }), className)}>
      <ReAgentFilePreviewProvider>
        {view === 'filesystem' ? (
          <ReAgentFileBrowser />
        ) : view === 'settings' ? (
          <ReAgentSettingsView />
        ) : view === 'sessions' ? (
          <ReAgentSessionsView />
        ) : (
          <>
            <ReAgentHeader>
              <ReAgentSessionTreeTrigger />
              <ReAgentNewSessionButton />
              <ReAgentSettingsTrigger />
              {onClose !== undefined && <ReAgentCloseButton onClick={onClose} />}
            </ReAgentHeader>

            <ReAgentMessageList />

            <footer className="p-2">
              <ReAgentComposer>
                <ReAgentComposerSelectionChip />
                <ReAgentComposerAttachments />
                <ReAgentComposerInput />
                <ReAgentComposerRow>
                  <ReAgentComposerAttach />
                  <div className="flex items-center gap-1.5">
                    <ReAgentComposerStatus />
                    <ReAgentContextMeter />
                    <ReAgentThinkingPicker />
                    <ReAgentModelPicker />
                    <ReAgentSendButton />
                  </div>
                </ReAgentComposerRow>
              </ReAgentComposer>
            </footer>
          </>
        )}

        <ExaKeyDialog />
      </ReAgentFilePreviewProvider>
    </ReAgentRoot>
  );
}

function ExaKeyDialog() {
  const { exaKeyPrompt, setExaKeyPrompt, saveExaKey } = useReAgent();
  const { t } = useTranslation();
  const [key, setKey] = useState('');
  return (
    <Dialog open={exaKeyPrompt} onOpenChange={setExaKeyPrompt}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('agent.exaKeyTitle')}</DialogTitle>
          <DialogDescription>{t('agent.exaKeyDescription')}</DialogDescription>
        </DialogHeader>
        <Input
          type="password"
          value={key}
          onChange={event => setKey(event.target.value)}
          placeholder={t('agent.exaKeyPlaceholder')}
          autoComplete="off"
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setExaKeyPrompt(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={() => void saveExaKey(key)} disabled={key.trim() === ''}>
            {t('agent.saveKey')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type { AgentDraft };
