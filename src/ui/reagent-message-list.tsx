import type { AgentMessage } from '@earendil-works/pi-agent-core';
import { Bot, ChevronDown, Loader2 } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useReAgent } from '../core/hooks';
import { useTranslation } from '../core/i18n';
import { cn } from '../lib/utils';
import { ReAgentMessage, ReAgentToolChip } from './reagent-message';

export interface ReAgentMessageListProps extends ComponentProps<'div'> {
  renderMessage?: (message: AgentMessage, index: number) => ReactNode;
}

export function ReAgentMessageList({
  className,
  renderMessage,
  ...props
}: ReAgentMessageListProps) {
  const { t } = useTranslation();
  const {
    activeSession,
    models,
    streamingText,
    streamingThinking,
    isThinking,
    toolCalls,
    error,
    expandedToolCalls,
    toggleToolCall,
  } = useReAgent();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const messages = activeSession?.messages ?? [];

  const toolResults = useMemo(() => {
    const map = new Map<string, AgentMessage>();
    for (const message of messages) {
      if (message.role === 'toolResult') {
        map.set(message.toolCallId, message);
      }
    }
    return map;
  }, [messages]);

  useEffect(() => {
    const element = scrollRef.current;
    if (element !== null) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages, streamingText, toolCalls]);

  return (
    <div
      ref={scrollRef}
      data-slot="reagent-message-list"
      className={cn('thin-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto p-2', className)}
      {...props}
    >
      {messages.length === 0 && models.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-1.5 px-3 py-8 text-center">
          <Bot className="size-5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">{t('agent.noModelsHint')}</p>
        </div>
      )}

      {messages.map((message, index) =>
        renderMessage !== undefined ? (
          <div key={`${message.role}-${message.timestamp}-${index}`}>
            {renderMessage(message, index)}
          </div>
        ) : (
          <ReAgentMessage
            key={`${message.role}-${message.timestamp}-${index}`}
            message={message}
            index={index}
            toolResults={toolResults}
          />
        ),
      )}

      {isThinking && streamingText === '' && (
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setThinkingExpanded(prev => !prev)}
            aria-expanded={thinkingExpanded}
            className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground transition hover:text-foreground"
          >
            <Loader2 className="size-3 animate-spin" />
            {t('agent.thinking')}
            <ChevronDown
              className={cn('size-3 transition-transform', thinkingExpanded && 'rotate-180')}
            />
          </button>
          {thinkingExpanded && streamingThinking !== '' && (
            <pre className="thin-scrollbar max-h-48 overflow-y-auto whitespace-pre-wrap rounded-xl border border-border/40 bg-muted/40 px-3 py-2 font-sans text-xs leading-relaxed text-muted-foreground">
              {streamingThinking}
            </pre>
          )}
        </div>
      )}

      {streamingText !== '' && (
        <div className="flex items-start gap-2">
          <div className="glass-control-opaque mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg">
            <Bot className="size-3.5 text-muted-foreground" />
          </div>
          <div className="min-w-0 max-w-[88%] rounded-2xl border border-border/40 bg-muted/40 px-3 py-2">
            <pre className="whitespace-pre-wrap font-sans text-sm">{streamingText}</pre>
          </div>
        </div>
      )}

      {toolCalls.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {toolCalls.map(chip => (
            <ReAgentToolChip
              key={chip.id}
              label={chip.label}
              status={chip.status}
              args={chip.args}
              result={chip.result}
              expanded={expandedToolCalls.has(chip.id)}
              onToggle={() => toggleToolCall(chip.id)}
            />
          ))}
        </div>
      )}

      {error !== null && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
          {t('agent.errorPrefix')} {error}
        </div>
      )}
    </div>
  );
}
