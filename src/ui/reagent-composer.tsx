import type { ThinkingLevel } from '@earendil-works/pi-agent-core';
import {
  ArrowUp,
  Bot,
  Check,
  ChevronDown,
  Lightbulb,
  Loader2,
  Plus,
  Sparkles,
  Square,
  X,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { ComponentProps, KeyboardEvent } from 'react';
import { useTranslation } from '../core/i18n';

import { Badge } from '../primitives/badge';
import { Button } from '../primitives/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../primitives/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '../primitives/popover';
import { cn } from '../lib/utils';

import { useReAgent } from '../core/hooks';

const THINKING_LEVELS: ThinkingLevel[] = ['off', 'low', 'medium', 'high'];
const SELECTION_PREVIEW_MAX = 400;

function selectionPreview(selection: string): string {
  const flat = selection.replace(/\s+/g, ' ').trim();
  if (flat.length <= 42) {
    return flat;
  }
  const cut = flat.slice(0, 42);
  const word = cut.slice(0, cut.lastIndexOf(' '));
  return `${word.length > 16 ? word : cut}…`;
}

export function ReAgentComposer({ className, children, ...props }: ComponentProps<'form'>) {
  const { send } = useReAgent();
  return (
    <form
      data-slot="reagent-composer"
      onSubmit={event => {
        event.preventDefault();
        void send();
      }}
      className={cn(
        'rounded-2xl border border-input/60 bg-card p-2 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30 dark:bg-muted',
        className,
      )}
      {...props}
    >
      {children}
    </form>
  );
}

export function ReAgentComposerSelectionChip({ className, ...props }: ComponentProps<'div'>) {
  const { selection, selectionExpanded, toggleSelectionExpanded, clearSelection } = useReAgent();
  const { t } = useTranslation();
  if (selection === null) {
    return null;
  }
  return (
    <div data-slot="reagent-selection" className={cn('mb-1.5', className)} {...props}>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={toggleSelectionExpanded}
          aria-expanded={selectionExpanded}
          aria-label={selectionExpanded ? t('agent.selectionCollapse') : t('agent.selectionExpand')}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-border/50 bg-muted/40 px-2 py-1 text-left text-xs text-muted-foreground transition-colors hover:bg-muted"
        >
          <Sparkles className="size-3 shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            {t('agent.selectionClamped', {
              preview: selectionPreview(selection),
              count: selection.length,
            })}
          </span>
          <ChevronDown
            className={cn(
              'size-3 shrink-0 transition-transform',
              selectionExpanded && 'rotate-180',
            )}
          />
        </button>
        <button
          type="button"
          onClick={clearSelection}
          aria-label={t('agent.clearSelection')}
          className="rounded p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="size-3" />
        </button>
      </div>
      {selectionExpanded && (
        <div className="mt-1 rounded-lg border border-border/50 bg-muted/30 p-2">
          <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
            {selection.slice(0, SELECTION_PREVIEW_MAX)}
            {selection.length > SELECTION_PREVIEW_MAX && (
              <span className="opacity-70">
                {' '}
                {t('agent.selectionMore', { count: selection.length - SELECTION_PREVIEW_MAX })}
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

export function ReAgentComposerAttachments({ className, ...props }: ComponentProps<'div'>) {
  const { attachments, removeAttachment } = useReAgent();
  const { t } = useTranslation();
  if (attachments.length === 0) {
    return null;
  }
  return (
    <div
      data-slot="reagent-attachments"
      className={cn('mb-1.5 flex flex-wrap gap-1.5', className)}
      {...props}
    >
      {attachments.map(attachment => (
        <div key={attachment.id} className="relative">
          <img
            src={`data:${attachment.mimeType};base64,${attachment.data}`}
            alt={attachment.name}
            className="size-14 rounded-lg border border-border/50 object-cover"
          />
          <button
            type="button"
            onClick={() => removeAttachment(attachment.id)}
            aria-label={t('agent.removeAttachment')}
            className="absolute -top-1 -right-1 rounded-full border border-border/60 bg-background p-0.5 text-muted-foreground shadow-sm hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function ReAgentComposerInput({ className, ...props }: ComponentProps<'textarea'>) {
  const { input, setInput, send } = useReAgent();
  const { t } = useTranslation();
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (element === null) {
      return;
    }
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
  }, [input]);

  return (
    <textarea
      ref={ref}
      data-slot="reagent-composer-input"
      value={input}
      onChange={event => setInput(event.target.value)}
      onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          void send();
        }
      }}
      placeholder={t('agent.chatPlaceholder')}
      rows={1}
      className={cn(
        'max-h-40 min-h-9 w-full resize-none border-0 bg-transparent px-1 py-1.5 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export function ReAgentComposerRow({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="reagent-composer-row"
      className={cn('flex items-center justify-between gap-2 pt-1', className)}
      {...props}
    />
  );
}

export function ReAgentComposerAttach({ className, ...props }: ComponentProps<'div'>) {
  const { addFiles, uploading } = useReAgent();
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className={cn('flex items-center gap-1', className)} {...props}>
      <input
        ref={inputRef}
        type="file"
        hidden
        multiple
        accept="image/*,application/pdf,.md,.txt,.doc,.docx"
        onChange={event => {
          const files = event.target.files;
          if (files !== null) {
            void addFiles(files);
          }
          event.target.value = '';
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="rounded-full"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        aria-label={t('agent.upload')}
      >
        {uploading ? <Loader2 className="animate-spin" /> : <Plus />}
      </Button>
    </div>
  );
}

export function ReAgentComposerStatus({ className, ...props }: ComponentProps<'div'>) {
  const { status } = useReAgent();
  if (status !== 'streaming') {
    return null;
  }
  return (
    <div className={cn('flex items-center', className)} {...props}>
      <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
    </div>
  );
}

export function ReAgentThinkingPicker({ className, ...props }: ComponentProps<typeof Button>) {
  const { activeSession, changeThinking } = useReAgent();
  const { t } = useTranslation();
  const level = activeSession?.thinkingLevel ?? 'off';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          data-slot="reagent-thinking-picker"
          className={cn('rounded-full', className)}
          aria-label={t('agent.thinkingLevelField')}
          {...props}
        >
          <Lightbulb className={cn('size-3.5', level === 'off' && 'text-muted-foreground/50')} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top">
        <DropdownMenuLabel>{t('agent.thinkingLevelField')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={level}
          onValueChange={value => changeThinking(value as ThinkingLevel)}
        >
          {THINKING_LEVELS.map(candidate => (
            <DropdownMenuRadioItem key={candidate} value={candidate}>
              {t(`agent.level.${candidate}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ReAgentModelPicker({ className, ...props }: ComponentProps<typeof Button>) {
  const { models, activeSession, activeModel, changeModel } = useReAgent();
  const { t } = useTranslation();
  const visionEnabled = activeModel?.input.includes('image') ?? false;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-slot="reagent-model-picker"
          className={cn('h-7 max-w-[14rem] gap-1.5 rounded-full px-2', className)}
          disabled={models.length === 0}
          aria-label={t('agent.selectModelPlaceholder')}
          {...props}
        >
          <Bot className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{activeModel?.name ?? t('agent.selectModelPlaceholder')}</span>
          {visionEnabled && (
            <Badge variant="secondary" className="px-1 py-0 text-[0.6rem]">
              {t('agent.tagVision')}
            </Badge>
          )}
          {activeModel?.reasoning === true && (
            <Badge variant="secondary" className="px-1 py-0 text-[0.6rem]">
              {t('agent.tagReasoning')}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-64 p-1">
        <div className="thin-scrollbar max-h-56 overflow-y-auto">
          {models.map(option => {
            const selected =
              option.provider === activeSession?.providerId &&
              option.model.id === activeSession.modelId;
            return (
              <button
                key={`${option.provider}::${option.model.id}`}
                type="button"
                onClick={() => changeModel(option.provider, option.model.id)}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
              >
                <Check className={cn('size-3.5 shrink-0', !selected && 'opacity-0')} />
                <span className="min-w-0 flex-1 truncate">{option.model.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {option.providerName}
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ReAgentSendButton({ className, ...props }: ComponentProps<typeof Button>) {
  const { status, stop, send, input, attachments, models, uploading } = useReAgent();
  const { t } = useTranslation();
  if (status === 'streaming') {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        data-slot="reagent-stop"
        className={cn('rounded-full', className)}
        onClick={stop}
        aria-label={t('agent.stop')}
        {...props}
      >
        <Square />
      </Button>
    );
  }
  return (
    <Button
      type="button"
      size="icon-sm"
      data-slot="reagent-send"
      className={cn('rounded-full', className)}
      onClick={() => void send()}
      disabled={
        (input.trim() === '' && attachments.length === 0) || models.length === 0 || uploading
      }
      {...props}
    >
      <ArrowUp />
      <span className="sr-only">{t('agent.send')}</span>
    </Button>
  );
}

export { THINKING_LEVELS };
