import { Bot, ChevronDown, GitBranch, Sparkles, X } from 'lucide-react';

import type { AgentMessage } from '@earendil-works/pi-agent-core';

import { cn } from '../lib/utils';
import { useMarkdown, useResolvedTheme, useTranslation } from '../core/i18n';

import { useReAgent } from '../core/hooks';

function DefaultMarkdown({ content }: { content: string; theme?: 'light' | 'dark' }) {
  return <pre className="whitespace-pre-wrap font-sans text-sm">{content}</pre>;
}

export function messageText(message: AgentMessage): string {
  if (message.role === 'assistant') {
    return message.content
      .filter(block => block.type === 'text')
      .map(block => (block.type === 'text' ? block.text : ''))
      .join('\n');
  }
  if (message.role === 'user') {
    return typeof message.content === 'string'
      ? message.content
      : message.content
          .filter(block => block.type === 'text')
          .map(block => (block.type === 'text' ? block.text : ''))
          .join('\n');
  }
  return '';
}

interface ToolCallBlock {
  type: 'toolCall';
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

function toolCallBlocks(message: AgentMessage): ToolCallBlock[] {
  if (message.role !== 'assistant') {
    return [];
  }
  return message.content.filter((block): block is ToolCallBlock => block.type === 'toolCall');
}

export interface ReAgentMessageProps {
  message: AgentMessage;
  index: number;
  toolResults?: Map<string, AgentMessage>;
  className?: string;
}

export function ReAgentMessage({ message, index, toolResults, className }: ReAgentMessageProps) {
  const { t } = useTranslation();
  const resolvedTheme = useResolvedTheme();
  const Markdown = useMarkdown() ?? DefaultMarkdown;
  const { activeSession, forkSession, toolLabels, expandedToolCalls, toggleToolCall } =
    useReAgent();

  const branchFromHere = () => {
    if (activeSession !== null) {
      void forkSession(activeSession.id, index + 1);
    }
  };

  if (message.role === 'user') {
    const text = messageText(message);
    const images =
      typeof message.content === 'string'
        ? []
        : message.content.filter(
            (block): block is { type: 'image'; data: string; mimeType: string } =>
              block.type === 'image',
          );
    return (
      <div className={cn('group flex justify-end', className)}>
        <div className="max-w-[88%] space-y-1.5 rounded-2xl bg-accent px-3 py-2 text-sm text-accent-foreground">
          {images.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {images.map((img, imgIndex) => (
                <img
                  key={`${message.timestamp}-img-${imgIndex}`}
                  src={`data:${img.mimeType};base64,${img.data}`}
                  alt=""
                  className="max-h-48 rounded-lg"
                />
              ))}
            </div>
          )}
          {text !== '' && <p className="whitespace-pre-wrap">{text}</p>}
        </div>
        <BranchButton onClick={branchFromHere} label={t('agent.sessionBranchFromHere')} />
      </div>
    );
  }

  if (message.role === 'toolResult') {
    return null;
  }
  if (message.role !== 'assistant') {
    return null;
  }

  const text = messageText(message);
  const calledTools = toolCallBlocks(message);
  if (text === '' && calledTools.length === 0) {
    return null;
  }

  return (
    <div className={cn('group flex items-start gap-2', className)}>
      <div className="glass-control-opaque mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg">
        <Bot className="size-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0 max-w-[88%] space-y-1.5">
        {text !== '' && (
          <div className="glass-control-opaque rounded-2xl px-3 py-2">
            <Markdown content={text} theme={resolvedTheme} />
          </div>
        )}
        {calledTools.map(call => (
          <ReAgentToolCall
            key={call.id}
            call={call}
            result={toolResults?.get(call.id)}
            label={toolLabels.get(call.name) ?? call.name}
            expanded={expandedToolCalls.has(call.id)}
            onToggle={() => toggleToolCall(call.id)}
          />
        ))}
      </div>
      <BranchButton onClick={branchFromHere} label={t('agent.sessionBranchFromHere')} />
    </div>
  );
}

function BranchButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="mt-0.5 self-start rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
    >
      <GitBranch className="size-3" />
    </button>
  );
}

interface ReAgentToolCallProps {
  call: ToolCallBlock;
  result?: AgentMessage;
  label: string;
  expanded: boolean;
  onToggle: () => void;
}

export function ReAgentToolCall({ call, result, label, expanded, onToggle }: ReAgentToolCallProps) {
  const { t } = useTranslation();
  const hasDetails = result !== undefined;
  return (
    <div>
      <button
        type="button"
        onClick={hasDetails ? onToggle : undefined}
        className={`flex items-center gap-1 rounded-lg border border-border/40 px-2 py-1 text-xs font-normal ${hasDetails ? 'cursor-pointer hover:bg-muted/40' : ''}`}
      >
        <Sparkles className="size-3" />
        <span>{t('agent.usedTool', { tool: label })}</span>
        {hasDetails && (
          <ChevronDown
            className={`size-3 shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        )}
      </button>
      {expanded && hasDetails && result !== undefined && result.role === 'toolResult' && (
        <div className="mt-1 space-y-1 rounded-lg border border-border/40 bg-muted/30 p-2 text-xs">
          <div>
            <span className="font-medium text-muted-foreground">{t('agent.toolArgs')}:</span>
            <pre className="mt-0.5 max-h-40 overflow-auto whitespace-pre-wrap break-all font-mans text-foreground/80">
              {JSON.stringify(call.arguments, null, 2)}
            </pre>
          </div>
          <div>
            <span className="font-medium text-muted-foreground">
              {result.isError ? t('agent.toolError') : t('agent.toolResult')}:
            </span>
            <pre className="mt-0.5 max-h-40 overflow-auto whitespace-pre-wrap break-all font-mans text-foreground/80">
              {result.content
                .map(block => (block.type === 'text' ? block.text : '[image]'))
                .join('\n')}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export function ReAgentToolChip({
  label,
  status,
  args,
  result,
  expanded,
  onToggle,
}: {
  label: string;
  status: 'running' | 'done' | 'error';
  args?: Record<string, unknown>;
  result?: unknown;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const hasDetails = args !== undefined;
  return (
    <div>
      <button
        type="button"
        onClick={hasDetails ? onToggle : undefined}
        className={`flex items-center gap-1 rounded-lg border border-border/40 bg-muted/40 px-2 py-1 text-xs ${hasDetails ? 'cursor-pointer hover:bg-muted/60' : ''}`}
      >
        {status === 'running' && <Sparkles className="size-3 animate-pulse" />}
        {status === 'done' && <Sparkles className="size-3" />}
        {status === 'error' && <X className="size-3 text-destructive" />}
        <span>{label}</span>
        {hasDetails && (
          <ChevronDown
            className={`size-3 shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        )}
      </button>
      {expanded && hasDetails && (
        <div className="mt-1 space-y-1 rounded-lg border border-border/40 bg-muted/30 p-2 text-xs">
          <div>
            <span className="font-medium text-muted-foreground">{t('agent.toolArgs')}:</span>
            <pre className="mt-0.5 max-h-40 overflow-auto whitespace-pre-wrap break-all font-mans text-foreground/80">
              {JSON.stringify(args, null, 2)}
            </pre>
          </div>
          {result !== undefined && (
            <div>
              <span className="font-medium text-muted-foreground">{t('agent.toolResult')}:</span>
              <pre className="mt-0.5 max-h-40 overflow-auto whitespace-pre-wrap break-all font-mans text-foreground/80">
                {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
