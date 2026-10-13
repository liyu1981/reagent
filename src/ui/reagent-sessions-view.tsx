import {
  ArrowLeft,
  ChevronRight,
  GitBranch,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from '../core/i18n';

import type { AgentSessionNode } from '../core/types';

import { ConfirmDialog } from '../primitives/confirm-dialog';
import { Badge } from '../primitives/badge';
import { Button } from '../primitives/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../primitives/dropdown-menu';
import { Input } from '../primitives/input';
import { cn } from '../lib/utils';

import { useReAgent } from '../core/hooks';

function relativeTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function filterTree(nodes: AgentSessionNode[], query: string): AgentSessionNode[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return nodes;
  }
  const result: AgentSessionNode[] = [];
  for (const node of nodes) {
    const children = filterTree(node.children, query);
    if (node.title.toLowerCase().includes(needle) || children.length > 0) {
      result.push({ ...node, children });
    }
  }
  return result;
}

/**
 * The conversation chooser. Like the settings view, it replaces the chat
 * surface (same `<ReAgentRoot>`) and has a back button; the tree can be
 * searched, loaded, branched, renamed and pruned.
 */
export function ReAgentSessionsView() {
  const { setView, config, sessionTree, loadSession, createSession } = useReAgent();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => filterTree(sessionTree, query), [sessionTree, query]);

  const open = (id: string) => {
    void loadSession(id);
    setView('chat');
  };

  return (
    <>
      <header
        data-slot="reagent-sessions-header"
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
          <p className="text-sm font-medium">{t('agent.sessionTree')}</p>
          <p className="truncate text-xs text-muted-foreground">
            {t('agent.sessionTreeDescription')}
          </p>
        </div>
      </header>

      <div className="flex items-center gap-1.5 px-3 pt-2">
        <Input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder={t('agent.sessionSearch')}
          className="h-8 flex-1"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void createSession();
            setView('chat');
          }}
        >
          <Plus />
          {t('agent.sessionNew')}
        </Button>
      </div>

      <div className="thin-scrollbar min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pt-2 pb-3">
        {filtered.length === 0 && (
          <p className="px-1 py-4 text-center text-sm text-muted-foreground">
            {t('agent.sessionEmpty')}
          </p>
        )}
        {filtered.map(node => (
          <SessionNode
            key={node.id}
            node={node}
            depth={0}
            activeId={config.activeSessionId}
            onLoad={open}
          />
        ))}
      </div>
    </>
  );
}

function SessionNode({
  node,
  depth,
  activeId,
  onLoad,
}: {
  node: AgentSessionNode;
  depth: number;
  activeId: string | null;
  onLoad: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { forkSession, renameSession, deleteSession } = useReAgent();
  const [expanded, setExpanded] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState(node.title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isActive = activeId === node.id;

  const commitRename = () => {
    const title = draftTitle.trim();
    if (title !== '' && title !== node.title) {
      void renameSession(node.id, title);
    }
    setRenaming(false);
  };

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-1 rounded-lg px-1.5 py-1 hover:bg-muted/60',
          isActive && 'bg-accent/60',
        )}
        style={{ paddingLeft: `${depth * 16 + 6}px` }}
      >
        {node.children.length > 0 ? (
          <button
            type="button"
            onClick={() => setExpanded(value => !value)}
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted"
            aria-label={expanded ? t('agent.sessionCollapse') : t('agent.sessionExpand')}
          >
            <ChevronRight
              className={cn('size-3.5 transition-transform', expanded && 'rotate-90')}
            />
          </button>
        ) : (
          <span className="size-4 shrink-0" />
        )}
        <GitBranch className="size-3.5 shrink-0 text-muted-foreground" />

        {renaming ? (
          <Input
            value={draftTitle}
            autoFocus
            onChange={event => setDraftTitle(event.target.value)}
            onBlur={commitRename}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                commitRename();
              } else if (event.key === 'Escape') {
                setRenaming(false);
                setDraftTitle(node.title);
              }
            }}
            className="h-6 flex-1 text-xs"
          />
        ) : (
          <button
            type="button"
            onClick={() => onLoad(node.id)}
            className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          >
            <span className="truncate text-xs font-medium">{node.title}</span>
            {isActive && <Badge variant="secondary">{t('agent.active')}</Badge>}
            <span className="ml-auto shrink-0 text-[0.65rem] text-muted-foreground">
              <MessageSquare className="mr-0.5 inline size-2.5" />
              {node.messages.length} · {relativeTime(node.updatedAt)}
            </span>
          </button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              className="shrink-0 opacity-0 group-hover:opacity-100"
              aria-label={t('agent.sessionActions')}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onLoad(node.id)}>
              {t('agent.sessionLoad')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void forkSession(node.id)}>
              {t('agent.sessionBranch')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setDraftTitle(node.title);
                setRenaming(true);
              }}
            >
              <Pencil className="size-3.5" />
              {t('agent.sessionRename')}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
              <Trash2 className="size-3.5" />
              {t('agent.sessionDelete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {expanded &&
        node.children.map(child => (
          <SessionNode
            key={child.id}
            node={child}
            depth={depth + 1}
            activeId={activeId}
            onLoad={onLoad}
          />
        ))}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('agent.sessionDeleteTitle')}
        description={t('agent.sessionDeleteKeepChildren', { name: node.title })}
        confirmLabel={t('agent.sessionDelete')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={() => {
          void deleteSession(node.id);
          setConfirmDelete(false);
        }}
      />
    </div>
  );
}
