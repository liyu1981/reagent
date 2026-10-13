import { Bot, GitBranch, Plus, Settings, X } from 'lucide-react';
import type { ComponentProps } from 'react';

import { Button } from '../primitives/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../primitives/tooltip';
import { cn } from '../lib/utils';
import { useTranslation } from '../core/i18n';

import { useReAgent } from '../core/hooks';

function ReAgentHeader({ className, children, ...props }: ComponentProps<'header'>) {
  return (
    <header
      data-slot="reagent-header"
      className={cn(
        'flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2',
        className,
      )}
      {...props}
    >
      <ReAgentSessionTitle />
      <div className="flex items-center gap-0.5">{children}</div>
    </header>
  );
}

function ReAgentSessionTitle({ className, ...props }: ComponentProps<'span'>) {
  const { activeSession } = useReAgent();
  const { t } = useTranslation();
  return (
    <span
      data-slot="reagent-session-title"
      className={cn('flex min-w-0 items-center gap-1.5 text-sm font-medium', className)}
      {...props}
    >
      <Bot className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{activeSession?.title ?? t('agent.title')}</span>
    </span>
  );
}

function ReAgentSessionTreeTrigger({ className, ...props }: ComponentProps<typeof Button>) {
  const { setView } = useReAgent();
  const { t } = useTranslation();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          data-slot="reagent-session-tree-trigger"
          className={cn(className)}
          onClick={() => setView('sessions')}
          aria-label={t('agent.sessionTree')}
          {...props}
        >
          <GitBranch />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{t('agent.sessionTree')}</TooltipContent>
    </Tooltip>
  );
}

function ReAgentNewSessionButton({ className, ...props }: ComponentProps<typeof Button>) {
  const { createSession } = useReAgent();
  const { t } = useTranslation();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          data-slot="reagent-new-session"
          className={cn(className)}
          onClick={() => void createSession()}
          aria-label={t('agent.newChat')}
          {...props}
        >
          <Plus />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{t('agent.newChat')}</TooltipContent>
    </Tooltip>
  );
}

function ReAgentForkButton({ className, ...props }: ComponentProps<typeof Button>) {
  const { activeSession, forkSession } = useReAgent();
  const { t } = useTranslation();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          data-slot="reagent-fork"
          className={cn(className)}
          disabled={activeSession === null}
          onClick={() => {
            if (activeSession !== null) {
              void forkSession(activeSession.id);
            }
          }}
          aria-label={t('agent.sessionBranch')}
          {...props}
        >
          <GitBranch />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{t('agent.sessionBranch')}</TooltipContent>
    </Tooltip>
  );
}

function ReAgentSettingsTrigger({ className, ...props }: ComponentProps<typeof Button>) {
  const { setView } = useReAgent();
  const { t } = useTranslation();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          data-slot="reagent-settings-trigger"
          className={cn(className)}
          onClick={() => setView('settings')}
          aria-label={t('agent.settingsOpen')}
          {...props}
        >
          <Settings />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{t('agent.settingsOpen')}</TooltipContent>
    </Tooltip>
  );
}

function ReAgentCloseButton({ className, ...props }: ComponentProps<typeof Button>) {
  const { t } = useTranslation();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          data-slot="reagent-close"
          className={cn(className)}
          aria-label={t('agent.close')}
          {...props}
        >
          <X />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{t('agent.close')}</TooltipContent>
    </Tooltip>
  );
}

export {
  ReAgentCloseButton,
  ReAgentForkButton,
  ReAgentHeader,
  ReAgentNewSessionButton,
  ReAgentSessionTitle,
  ReAgentSessionTreeTrigger,
  ReAgentSettingsTrigger,
};
