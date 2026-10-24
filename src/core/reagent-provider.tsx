import type { AgentMessage, AgentTool, ThinkingLevel } from '@earendil-works/pi-agent-core';
import { Agent } from '@earendil-works/pi-agent-core';
import type { Api, ImageContent, Model } from '@earendil-works/pi-ai';
import type { ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { buildAgent } from './agent';
import {
  blobToBase64,
  DEFAULT_MAX_FILE_BYTES,
  formatFileSize,
  getMessageFiles,
  isReAgentFileRef,
  makeVisionImage,
  setMessageFiles,
} from './attachments';
import {
  getAgentConfig,
  subscribeAgentConfig,
  updateAgentConfig as updateConfigPatch,
} from './config';
import type { EditorMutationBridge } from './editor-mutations';
import {
  getHostProviderConfig,
  type ReAgentHostProvider,
  type ReAgentHostProviderConfig,
  registerHostProviders,
  setHostProviderConfig,
} from './host-providers';
import { EXA_SERVER_ID, getMcpManager, setExaApiKey, syncMcpServersWithTimeout } from './mcp';
import {
  makeTranslator,
  type ReAgentMarkdown,
  type ReAgentNotify,
  type ReAgentTheme,
  type ReAgentTranslate,
} from './messages';
import {
  getModel,
  getModelsVersion,
  listAvailableModels,
  OLLAMA_PROVIDER_ID,
  pruneExpiredCredentials,
  rebuildModels,
  refreshModels,
  subscribeModels,
} from './models';
import { EDITOR_GUARDRAIL, filesSystemPrompt, resolveSystemPrompt } from './prompt';
import {
  buildSessionTree,
  deleteSession as deleteSessionRecord,
  forkSession as forkSessionRecord,
  listSessions,
  newSessionId,
  saveSession,
} from './session-store';
import { enabledSkillDefinitions, skillsSystemPrompt } from './skill-registry';
import { resolveStoragePrefix, storageKey } from './storage';
import { buildAgentTools, getOpfsRoot, listToolDescriptors } from './tools';
import type {
  AgentAttachment,
  AgentConfig,
  AgentDraft,
  AgentSession,
  AgentSessionNode,
  AgentToolDescriptor,
  ReAgentFileRef,
  ReAgentFilesConfig,
  ToolChip,
} from './types';
import { hasWebMcp, listWebMcpTools, subscribeWebMcp } from './webmcp';

export interface ModelOption {
  provider: string;
  providerName: string;
  model: Model<Api>;
}

export interface ReAgentContextValue {
  config: AgentConfig;
  updateConfig: (patch: Partial<AgentConfig>) => void;
  /** Storage namespace this agent persists under. */
  storagePrefix: string;
  models: ModelOption[];
  activeModel: Model<Api> | undefined;
  visionEnabled: boolean;

  sessions: AgentSession[];
  sessionTree: AgentSessionNode[];
  activeSession: AgentSession | null;

  createSession: () => Promise<void>;
  forkSession: (id: string, atIndex?: number) => Promise<void>;
  loadSession: (id: string) => Promise<void>;
  renameSession: (id: string, title: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  changeModel: (providerId: string, modelId: string) => void;
  changeThinking: (level: ThinkingLevel) => void;

  status: 'idle' | 'streaming';
  streamingText: string;
  /** Reasoning text streamed so far for the current turn. */
  streamingThinking: string;
  isThinking: boolean;
  toolCalls: ToolChip[];
  error: string | null;

  input: string;
  setInput: (value: string) => void;
  attachments: AgentAttachment[];
  addFiles: (files: FileList) => Promise<void>;
  removeAttachment: (id: string) => void;
  uploading: boolean;

  selection: string | null;
  selectionExpanded: boolean;
  toggleSelectionExpanded: () => void;
  clearSelection: () => void;
  draft: AgentDraft | null;

  expandedToolCalls: Set<string>;
  toggleToolCall: (id: string) => void;

  send: () => Promise<void>;
  stop: () => void;

  view: ReAgentView;
  setView: (view: ReAgentView) => void;
  exaKeyPrompt: boolean;
  setExaKeyPrompt: (open: boolean) => void;
  saveExaKey: (key: string) => Promise<void>;

  toolLabels: Map<string, string>;
  tools: AgentToolDescriptor[];
  /** Installed built-in filesystem tools (host-installed via `getFileSystemTools`). */
  filesystem: {
    namespace: string;
    tools: AgentToolDescriptor[];
    /** Origin-private filesystem root (browser OPFS) the namespace folder hangs off. */
    opfs: FileSystemDirectoryHandle | null;
  } | null;
  /** Opt-in conversation file attachments. */
  files: ReAgentFilesConfig | null;
  /** WebMCP tools the current page exposes (empty when unavailable). */
  webmcp: { available: boolean; toolCount: number; tools: AgentTool<any>[] };
  /** Host-injected providers and their in-memory config. */
  hostProviders: {
    id: string;
    name: string;
    component: ReAgentHostProvider['component'];
    config: ReAgentHostProviderConfig | null;
    setConfig: (config: ReAgentHostProviderConfig | null) => void;
  }[];

  t: ReAgentTranslate;
  language: string;
  theme: ReAgentTheme;
  notify: ReAgentNotify;
  renderMarkdown: ReAgentMarkdown | undefined;
}

export type ReAgentView = 'chat' | 'settings' | 'sessions' | 'filesystem';

export const ReAgentContext = createContext<ReAgentContextValue | null>(null);

function readLastModel(prefix: string): { providerId: string; modelId: string } | undefined {
  try {
    const raw = localStorage.getItem(storageKey(prefix, 'lastModel'));
    return raw === null ? undefined : (JSON.parse(raw) as { providerId: string; modelId: string });
  } catch {
    return undefined;
  }
}

function newId(): string {
  return newSessionId();
}

export interface ReAgentProviderProps {
  editor?: EditorMutationBridge | null;
  extraTools?: AgentTool<any>[];
  /** Host tool descriptors merged into the registry (and the tools panel). */
  extraDescriptors?: AgentToolDescriptor[];
  draft?: AgentDraft | null;
  selection?: string | null;
  onClearSelection?: () => void;
  /** Theme for markdown rendering / surfaces. Defaults to `light`. */
  theme?: ReAgentTheme;
  /** BCP-47-ish language tag used by the built-in prompt. Defaults to `en`. */
  language?: string;
  /** Override copy; falls back to the English defaults. */
  messages?: Partial<Record<string, string>>;
  /** Full translator override (wins over `messages`). */
  translate?: ReAgentTranslate;
  /** Notification sink; defaults to a no-op. */
  notify?: ReAgentNotify;
  /** Render assistant markdown; defaults to a plain `<pre>`. */
  renderMarkdown?: ReAgentMarkdown;
  /** Upload a file the model cannot read; returns markdown to insert. */
  uploadFile?: (file: File) => Promise<string>;
  /** Opt-in durable conversation attachments. */
  files?: ReAgentFilesConfig | null;
  /**
   * Namespace for all persisted state (localStorage keys + the conversation
   * IndexedDB). Defaults to the shared `agent` prefix; pass a different value
   * to run several independent agents on one page/origin.
   */
  storagePrefix?: string;
  /** Host-injected LLM providers (own setup UI; config kept in memory only). */
  hostProviders?: ReAgentHostProvider[];
  children: ReactNode;
}

export function ReAgentProvider({
  editor,
  extraTools,
  extraDescriptors,
  draft,
  selection,
  onClearSelection,
  theme = 'light',
  language = 'en',
  messages,
  translate,
  notify,
  renderMarkdown,
  uploadFile,
  files,
  storagePrefix,
  hostProviders,
  children,
}: ReAgentProviderProps) {
  const t = useMemo(() => translate ?? makeTranslator(messages), [translate, messages]);
  const prefix = resolveStoragePrefix(storagePrefix);
  const mcp = useMemo(() => getMcpManager(prefix), [prefix]);
  const subscribeConfig = useCallback(
    (listener: () => void) => subscribeAgentConfig(listener, prefix),
    [prefix],
  );
  const readConfig = useCallback(() => getAgentConfig(prefix), [prefix]);
  const config = useSyncExternalStore(subscribeConfig, readConfig);
  const updateConfig = useCallback(
    (patch: Partial<AgentConfig>) => updateConfigPatch(patch, prefix),
    [prefix],
  );

  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [streamingThinking, setStreamingThinking] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [toolChips, setToolChips] = useState<ToolChip[]>([]);
  const [expandedToolCalls, setExpandedToolCalls] = useState<Set<string>>(new Set());
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mcpTools, setMcpTools] = useState<AgentTool<any>[]>([]);
  const [webmcpTools, setWebmcpTools] = useState<AgentTool<any>[]>([]);
  const [exaKeyPrompt, setExaKeyPrompt] = useState(false);
  const [attachments, setAttachments] = useState<AgentAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectionExpanded, setSelectionExpanded] = useState(false);
  const [view, setView] = useState<ReAgentView>('chat');
  const [opfsRoot, setOpfsRoot] = useState<FileSystemDirectoryHandle | null>(null);

  const agentRef = useRef<Agent | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const latestRef = useRef<AgentSession | null>(null);
  const sessionsRef = useRef<AgentSession[]>([]);
  const draftRef = useRef(draft ?? null);
  const editorRef = useRef(editor);
  const opfsRef = useRef<FileSystemDirectoryHandle | null>(null);
  const pendingFilesRef = useRef<ReAgentFileRef[]>([]);
  const createdFilesRef = useRef<ReAgentFileRef[]>([]);
  const extraToolsRef = useRef(extraTools);
  const webmcpToolsRef = useRef<AgentTool<any>[]>([]);
  const extraDescriptorsRef = useRef(extraDescriptors);
  const configRef = useRef(config);
  const contentEditedRef = useRef(false);
  const sessionsReadyRef = useRef(false);
  const lastClampedRef = useRef<string | null>(null);
  const selectionRef = useRef(selection);
  const creatingSessionRef = useRef(false);

  configRef.current = config;
  extraToolsRef.current = extraTools;
  extraDescriptorsRef.current = extraDescriptors;
  sessionsRef.current = sessions;

  useEffect(() => {
    draftRef.current = draft ?? null;
  }, [draft]);

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    let cancelled = false;
    void getOpfsRoot().then(handle => {
      if (!cancelled) {
        setOpfsRoot(handle);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    opfsRef.current = opfsRoot;
  }, [opfsRoot]);

  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

  // Rebuild the live agent's tool set from the current MCP + WebMCP + host tools.
  const rebuildAgentTools = useCallback(() => {
    const agent = agentRef.current;
    const active = latestRef.current;
    if (agent === null || active === null || agent.state.isStreaming) {
      return;
    }
    agent.state.tools = buildAgentTools({
      editor: editorRef.current ?? undefined,
      opfs: opfsRef.current ?? undefined,
      extraTools: [...mcp.getTools(), ...webmcpToolsRef.current, ...(extraToolsRef.current ?? [])],
      extraDescriptors: extraDescriptorsRef.current ?? [],
      disabledIds: configRef.current.toolsDisabled,
      prefix,
    });
  }, [mcp, prefix]);

  useEffect(() => {
    setMcpTools(mcp.getTools());
    return mcp.subscribe(() => {
      setMcpTools(mcp.getTools());
      rebuildAgentTools();
    });
  }, [mcp, rebuildAgentTools]);

  // Auto-detect the page's WebMCP tools and keep them in sync.
  useEffect(() => {
    if (!hasWebMcp()) {
      return;
    }
    let cancelled = false;
    const refresh = () => {
      void listWebMcpTools().then(tools => {
        if (cancelled) {
          return;
        }
        webmcpToolsRef.current = tools;
        setWebmcpTools(tools);
        rebuildAgentTools();
      });
    };
    refresh();
    const unsubscribe = subscribeWebMcp(refresh);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [rebuildAgentTools]);

  useEffect(
    () =>
      mcp.onAuthRequired(serverId => {
        if (serverId === EXA_SERVER_ID) {
          setExaKeyPrompt(true);
        }
      }),
    [],
  );

  // Register host providers (and any already-signed-in config) before the model
  // registry is first built, so their models are available immediately.
  useState(() => {
    const list = hostProviders ?? [];
    registerHostProviders(list);
    for (const provider of list) {
      const initial = provider.getConfig?.();
      if (initial !== undefined && initial !== null) {
        setHostProviderConfig(provider.id, initial);
      }
    }
    rebuildModels(prefix);
    return true;
  });
  const setHostConfig = useCallback(
    (id: string, next: ReAgentHostProviderConfig | null) => {
      setHostProviderConfig(id, next);
      rebuildModels(prefix);
    },
    [prefix],
  );

  const modelsVersion = useSyncExternalStore(
    useCallback((listener: () => void) => subscribeModels(listener, prefix), [prefix]),
    useCallback(() => getModelsVersion(prefix), [prefix]),
  );

  // Drop API keys that outlived the retention window — on mount and whenever
  // the window changes — so expired keys also unverify their provider.
  useEffect(() => {
    pruneExpiredCredentials(prefix);
  }, [prefix, config.keyRetentionMs]);
  const models = useMemo(() => listAvailableModels(prefix), [config, modelsVersion, prefix]);

  const activeSession = sessions.find(session => session.id === config.activeSessionId) ?? null;
  const activeModel =
    activeSession !== null
      ? getModel(activeSession.providerId, activeSession.modelId, prefix)
      : undefined;
  const visionEnabled = activeModel?.input.includes('image') ?? false;

  const toolLabels = useMemo(() => {
    const map = new Map<string, string>();
    const descriptors = listToolDescriptors(extraDescriptorsRef.current ?? [], {
      hasEditor: editorRef.current !== undefined && editorRef.current !== null,
      hasSkills: enabledSkillDefinitions(getAgentConfig(prefix)).length > 0,
    });
    for (const descriptor of descriptors) {
      map.set(descriptor.name, descriptor.label);
    }
    for (const tool of mcpTools) {
      map.set(tool.name, tool.label);
    }
    for (const tool of webmcpTools) {
      map.set(tool.name, tool.label);
    }
    return map;
  }, [mcpTools, webmcpTools, config, prefix]);

  const persistSession = useCallback(async (sessionNow: AgentSession, messages: AgentMessage[]) => {
    const updated: AgentSession = { ...sessionNow, messages, updatedAt: Date.now() };
    latestRef.current = updated;
    await saveSession(updated, prefix);
    setSessions(prev => prev.map(session => (session.id === updated.id ? updated : session)));
  }, []);

  const patchActive = useCallback((messages: AgentMessage[]) => {
    const active = latestRef.current;
    if (active === null) {
      return;
    }
    const next = { ...active, messages };
    latestRef.current = next;
    setSessions(prev => prev.map(session => (session.id === next.id ? next : session)));
  }, []);

  const buildSystemPrompt = useCallback((base: string): string => {
    const draftNow = draftRef.current;
    const hasEditor = editorRef.current !== undefined && editorRef.current !== null;
    if (draftNow === null && !hasEditor) {
      return base;
    }
    const withDraft =
      draftNow === null
        ? base
        : `${base}\n\n## Current draft the user is editing\n- slug: ${draftNow.slug}\n- title: ${draftNow.title}\n\n\`\`\`markdown\n${draftNow.content}\n\`\`\`\n\nWhen the user asks something about their draft, answer using this draft. Edits to the draft are staged with update_frontmatter and update_content, and the commit message with set_commit_note; call save when you are done to open the review dialog — the editor is only updated after the user finishes reviewing. When the user is revising a selected chunk, read it with get_selection and return the replacement with update_selection instead of update_content.`;
    return `${withDraft}\n\n${EDITOR_GUARDRAIL}`;
  }, []);

  const currentBasePrompt = useCallback((): string => {
    const answerLanguage = language.startsWith('zh') ? 'Chinese' : 'English';
    const base = resolveSystemPrompt(
      t('agent.systemPrompt', { language: answerLanguage }),
      answerLanguage,
      prefix,
    );
    const skills = skillsSystemPrompt(getAgentConfig(prefix));
    return skills === '' ? base : `${base}\n\n${skills}`;
  }, [language, t, prefix]);

  const defaultModel = useCallback((): { providerId: string; modelId: string } | undefined => {
    const available = listAvailableModels(prefix);
    const configured = configRef.current.model;
    const last = configured ?? readLastModel(prefix);
    if (
      last !== null &&
      last !== undefined &&
      available.some(m => m.provider === last.providerId && m.model.id === last.modelId)
    ) {
      return last;
    }
    const ollamaFirst = available.find(m => m.provider === OLLAMA_PROVIDER_ID);
    const fallback = ollamaFirst ?? available[0];
    return fallback !== undefined
      ? { providerId: fallback.provider, modelId: fallback.model.id }
      : undefined;
  }, [prefix]);

  const subscribeAgent = useCallback(
    (instance: Agent, sessionNow: AgentSession) => {
      unsubRef.current?.();
      unsubRef.current = instance.subscribe(event => {
        if (agentRef.current !== instance || latestRef.current?.id !== sessionNow.id) {
          return;
        }
        switch (event.type) {
          case 'agent_start':
            setStreaming(true);
            setError(null);
            contentEditedRef.current = false;
            createdFilesRef.current = [];
            break;
          case 'message_start':
            if (event.message.role === 'user' && pendingFilesRef.current.length > 0) {
              setMessageFiles(event.message, pendingFilesRef.current);
              pendingFilesRef.current = [];
            }
            if (event.message.role === 'assistant') {
              setStreamingText('');
              setStreamingThinking('');
              setIsThinking(false);
            }
            patchActive([...instance.state.messages]);
            break;
          case 'message_update': {
            const ev = event.assistantMessageEvent;
            if (ev.type === 'text_delta') {
              setStreamingText(prev => prev + ev.delta);
            } else if (ev.type === 'thinking_start') {
              setIsThinking(true);
              setStreamingThinking('');
            } else if (ev.type === 'thinking_delta') {
              setStreamingThinking(prev => prev + ev.delta);
            } else if (ev.type === 'thinking_end') {
              setIsThinking(false);
            }
            break;
          }
          case 'message_end':
            patchActive([...instance.state.messages]);
            if (event.message.role === 'assistant') {
              setStreamingText('');
              setStreamingThinking('');
              setIsThinking(false);
            }
            break;
          case 'tool_execution_start':
            setToolChips(prev => [
              ...prev,
              {
                id: event.toolCallId,
                name: event.toolName,
                label: toolLabels.get(event.toolName) ?? event.toolName,
                status: 'running',
                args: event.args,
              },
            ]);
            break;
          case 'tool_execution_end':
            if (
              !event.isError &&
              (event.toolName === 'update_content' ||
                event.toolName === 'update_frontmatter' ||
                event.toolName === 'update_selection')
            ) {
              contentEditedRef.current = true;
            }
            if (!event.isError) {
              for (const file of resultFileRefs(event.result)) {
                if (!createdFilesRef.current.some(existing => existing.id === file.id)) {
                  createdFilesRef.current.push(file);
                }
              }
            }
            setToolChips(prev =>
              prev.map(chip =>
                chip.id === event.toolCallId
                  ? { ...chip, status: event.isError ? 'error' : 'done', result: event.result }
                  : chip,
              ),
            );
            break;
          case 'agent_end':
            pendingFilesRef.current = [];
            if (createdFilesRef.current.length > 0) {
              const lastAssistant = [...instance.state.messages]
                .reverse()
                .find(message => message.role === 'assistant');
              if (lastAssistant !== undefined) {
                const merged = new Map(
                  getMessageFiles(lastAssistant).map(file => [file.id, file] as const),
                );
                for (const file of createdFilesRef.current) {
                  merged.set(file.id, file);
                }
                setMessageFiles(lastAssistant, [...merged.values()]);
              }
              createdFilesRef.current = [];
            }
            patchActive([...instance.state.messages]);
            setStreaming(false);
            setStreamingText('');
            setIsThinking(false);
            if (instance.state.errorMessage) {
              setError(instance.state.errorMessage);
            }
            void persistSession(latestRef.current ?? sessionNow, instance.state.messages);
            setToolChips([]);
            setExpandedToolCalls(new Set());
            if (contentEditedRef.current) {
              contentEditedRef.current = false;
              editorRef.current?.openReview();
            }
            break;
          default:
            break;
        }
      });
    },
    [patchActive, persistSession, toolLabels],
  );

  const buildForSession = useCallback(
    async (sessionNow: AgentSession): Promise<Agent | null> => {
      agentRef.current?.abort();
      await syncMcpServersWithTimeout(prefix);

      const extra = [
        ...mcp.getTools(),
        ...webmcpToolsRef.current,
        ...(extraToolsRef.current ?? []),
      ];
      try {
        const instance = buildAgent({
          providerId: sessionNow.providerId,
          modelId: sessionNow.modelId,
          systemPrompt: currentBasePrompt(),
          thinkingLevel: sessionNow.thinkingLevel,
          messages: sessionNow.messages,
          sessionId: sessionNow.id,
          editor: editorRef.current ?? undefined,
          opfs: opfsRef.current ?? undefined,
          extraTools: extra,
          extraDescriptors: extraDescriptorsRef.current ?? [],
          disabledToolIds: configRef.current.toolsDisabled,
          prefix,
        });
        agentRef.current = instance;
        latestRef.current = { ...sessionNow, messages: [...instance.state.messages] };
        subscribeAgent(instance, sessionNow);
        return instance;
      } catch (err) {
        agentRef.current = null;
        setError(err instanceof Error ? err.message : String(err));
        return null;
      }
    },
    [currentBasePrompt, subscribeAgent, prefix],
  );

  const createSession = useCallback(async (): Promise<AgentSession | null> => {
    const model = defaultModel();
    if (model === undefined) {
      setError(t('agent.noModelsHint'));
      return null;
    }
    agentRef.current?.abort();
    const now = Date.now();
    const next: AgentSession = {
      id: newId(),
      parentId: null,
      forkFromIndex: null,
      title: t('agent.untitled'),
      providerId: model.providerId,
      modelId: model.modelId,
      thinkingLevel: configRef.current.thinkingLevel,
      systemPrompt: currentBasePrompt(),
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    await saveSession(next, prefix);
    setSessions(prev => [...prev, next]);
    latestRef.current = next;
    updateConfig({ activeSessionId: next.id, model });
    await buildForSession(next);
    setStreaming(false);
    setStreamingText('');
    setToolChips([]);
    setError(null);
    return next;
  }, [buildForSession, currentBasePrompt, defaultModel, t]);

  const loadSession = useCallback(
    async (id: string) => {
      const target = sessionsRef.current.find(session => session.id === id);
      if (target === undefined) {
        return;
      }
      agentRef.current?.abort();
      updateConfig({ activeSessionId: id });
      latestRef.current = target;
      setStreaming(false);
      setStreamingText('');
      setToolChips([]);
      setError(null);
      await buildForSession(target);
    },
    [buildForSession],
  );

  const forkSession = useCallback(
    async (id: string, atIndex?: number) => {
      const source = sessionsRef.current.find(session => session.id === id);
      if (source === undefined) {
        return;
      }
      const model = defaultModel();
      const fork = await forkSessionRecord(source, atIndex ?? source.messages.length, {
        providerId: model?.providerId ?? source.providerId,
        modelId: model?.modelId ?? source.modelId,
        thinkingLevel: configRef.current.thinkingLevel,
        systemPrompt: currentBasePrompt(),
      });
      setSessions(prev => [...prev, fork]);
      agentRef.current?.abort();
      updateConfig({ activeSessionId: fork.id });
      latestRef.current = fork;
      setStreaming(false);
      setStreamingText('');
      setToolChips([]);
      setError(null);
      setView('chat');
      await buildForSession(fork);
    },
    [buildForSession, currentBasePrompt, defaultModel],
  );

  const renameSession = useCallback(async (id: string, title: string) => {
    const target = sessionsRef.current.find(session => session.id === id);
    if (target === undefined) {
      return;
    }
    const updated = { ...target, title, updatedAt: Date.now() };
    if (latestRef.current?.id === id) {
      latestRef.current = updated;
    }
    await saveSession(updated, prefix);
    setSessions(prev => prev.map(session => (session.id === id ? updated : session)));
  }, []);

  const deleteSession = useCallback(
    async (id: string) => {
      const target = sessionsRef.current.find(session => session.id === id);
      const grandparent = target?.parentId ?? null;
      await deleteSessionRecord(id, prefix);
      const remaining = sessionsRef.current
        .filter(session => session.id !== id)
        .map(session =>
          session.parentId === id ? { ...session, parentId: grandparent } : session,
        );
      setSessions(remaining);
      if (configRef.current.activeSessionId === id) {
        const next = remaining.reduce<AgentSession | null>(
          (acc, session) => (acc === null || session.updatedAt > acc.updatedAt ? session : acc),
          null,
        );
        if (next !== null) {
          await loadSession(next.id);
        } else {
          agentRef.current?.abort();
          agentRef.current = null;
          latestRef.current = null;
          updateConfig({ activeSessionId: null });
        }
      }
    },
    [loadSession],
  );

  // Initial load: refresh models, list sessions, pick the active one.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await refreshModels(prefix).catch(() => undefined);
      const all = await listSessions(prefix);
      if (cancelled) {
        return;
      }
      all.sort((a, b) => a.updatedAt - b.updatedAt);
      setSessions(all);
      const configuredId = configRef.current.activeSessionId;
      const active =
        all.find(session => session.id === configuredId) ??
        all.reduce<AgentSession | null>(
          (acc, session) => (acc === null || session.updatedAt > acc.updatedAt ? session : acc),
          null,
        );
      const clamped = clampedSelection(selectionRef.current);
      if (clamped !== null) {
        lastClampedRef.current = clamped;
        await createSession();
      } else if (active !== null) {
        latestRef.current = active;
        updateConfig({ activeSessionId: active.id });
        await buildForSession(active);
      } else {
        await createSession();
      }
      sessionsReadyRef.current = true;
    })();
    return () => {
      cancelled = true;
      unsubRef.current?.();
      unsubRef.current = null;
      const agent = agentRef.current;
      const session = latestRef.current;
      if (agent !== null && session !== null) {
        void saveSession(
          {
            ...session,
            messages: [...agent.state.messages],
            updatedAt: Date.now(),
          },
          prefix,
        );
      }
      agent?.abort();
      agentRef.current = null;
    };
  }, []);

  // Once a model becomes available (e.g. after verifying a connection), open a
  // session if none is active so the user can start chatting right away and the
  // "no verified model" hint clears.
  useEffect(() => {
    if (!sessionsReadyRef.current || config.activeSessionId !== null || models.length === 0) {
      return;
    }
    if (creatingSessionRef.current) {
      return;
    }
    creatingSessionRef.current = true;
    void createSession().finally(() => {
      creatingSessionRef.current = false;
    });
  }, [config.activeSessionId, models, createSession]);

  // A clamped selection always opens a fresh root session.
  useEffect(() => {
    const clamped = clampedSelection(selection);
    if (clamped === null) {
      lastClampedRef.current = null;
      return;
    }
    if (!sessionsReadyRef.current || clamped === lastClampedRef.current) {
      return;
    }
    lastClampedRef.current = clamped;
    void createSession();
  }, [selection, createSession]);

  useEffect(() => {
    if (selection === null || selection === undefined || selection.trim() === '') {
      setSelectionExpanded(false);
    }
  }, [selection]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if ((text === '' && attachments.length === 0) || streaming) {
      return;
    }
    let sessionNow = latestRef.current;
    if (sessionNow === null) {
      const created = await createSession();
      if (created === null) {
        return;
      }
      sessionNow = created;
    }
    const instance = agentRef.current;
    if (instance === null) {
      return;
    }
    latestRef.current = sessionNow;
    const sentAttachments = attachments;
    const sentFiles = sentAttachments.flatMap(attachment =>
      attachment.file === undefined ? [] : [attachment.file],
    );
    const filesystemToolsActive = (extraDescriptorsRef.current ?? []).some(
      descriptor =>
        descriptor.group === 'filesystem' &&
        !(configRef.current.toolsDisabled ?? []).includes(descriptor.id),
    );
    const knownFiles = new Map<string, ReAgentFileRef>();
    for (const file of [...sessionNow.messages.flatMap(getMessageFiles), ...sentFiles]) {
      knownFiles.set(file.id, file);
    }
    // pi-agent-core 1.x keeps the prompt in the transcript's leading system
    // message (`state.systemPrompt` is read-only), so update that message.
    const nextPrompt = [
      buildSystemPrompt(currentBasePrompt()),
      filesSystemPrompt([...knownFiles.values()], filesystemToolsActive),
    ]
      .filter(section => section !== '')
      .join('\n\n');
    const [head, ...rest] = instance.state.messages;
    if (head !== undefined && head.role === 'system') {
      instance.state.messages = [{ ...head, content: nextPrompt }, ...rest];
    }
    const prompt =
      selection !== null && selection !== undefined && selection.trim() !== ''
        ? `Revise the following selection.\n\n\`\`\`markdown\n${selection}\n\`\`\`\n\nInstruction: ${text}`
        : text;
    const promptText = prompt === '' && sentFiles.length > 0 ? t('agent.filesOnlyPrompt') : prompt;
    const images: ImageContent[] = sentAttachments.flatMap(attachment =>
      attachment.data === undefined || attachment.data === ''
        ? []
        : [
            {
              type: 'image' as const,
              data: attachment.data,
              mimeType: attachment.dataMimeType ?? attachment.mimeType,
            },
          ],
    );
    pendingFilesRef.current = sentFiles;
    setInput('');
    setAttachments([]);
    setStreaming(true);
    setError(null);
    try {
      if (images.length > 0) {
        await instance.prompt(promptText, images);
      } else {
        await instance.prompt(promptText);
      }
      if (sessionNow.title === t('agent.untitled')) {
        const titleText = text === '' ? (sentAttachments[0]?.name ?? '') : text;
        const title = titleText.slice(0, 40) + (titleText.length > 40 ? '…' : '');
        await persistSession({ ...sessionNow, title }, instance.state.messages);
      }
    } catch (err) {
      pendingFilesRef.current = [];
      setStreaming(false);
      setAttachments(sentAttachments);
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [
    attachments,
    buildSystemPrompt,
    createSession,
    currentBasePrompt,
    input,
    persistSession,
    selection,
    streaming,
    t,
  ]);

  const stop = useCallback(() => {
    agentRef.current?.abort();
  }, []);

  const insertReference = useCallback((markdown: string) => {
    setInput(prev =>
      prev.trim() === '' ? `${markdown}\n` : `${prev.replace(/\s*$/, '')}\n\n${markdown}\n`,
    );
  }, []);

  const addFiles = useCallback(
    async (incoming: FileList) => {
      const list = Array.from(incoming);
      if (list.length === 0) {
        return;
      }
      setUploading(true);
      setError(null);
      try {
        for (const file of list) {
          const isImage = file.type.startsWith('image/');
          if (files !== undefined && files !== null) {
            const maxBytes = files.maxBytes ?? DEFAULT_MAX_FILE_BYTES;
            if (file.size > maxBytes) {
              setError(
                t('agent.fileTooLarge', {
                  name: file.name,
                  size: formatFileSize(maxBytes),
                }),
              );
              continue;
            }
            const ref = await files.store.put(file);
            let data: string | undefined;
            let dataMimeType: string | undefined;
            if (isImage && visionEnabled) {
              const blob = await makeVisionImage(file);
              dataMimeType = blob.type === '' ? ref.mimeType || 'image/png' : blob.type;
              data = await blobToBase64(blob);
            }
            setAttachments(prev => [
              ...prev,
              {
                id: ref.id,
                name: ref.name,
                mimeType: ref.mimeType,
                data,
                dataMimeType,
                file: ref,
              },
            ]);
            continue;
          }
          if (isImage && visionEnabled) {
            const blob = await makeVisionImage(file);
            const mimeType = blob.type === '' ? file.type || 'image/png' : blob.type;
            const data = await blobToBase64(blob);
            setAttachments(prev => [
              ...prev,
              { id: newId(), name: file.name, mimeType, dataMimeType: mimeType, data },
            ]);
            continue;
          }
          if (uploadFile === undefined) {
            if (isImage) {
              setError(t('agent.uploadImageUnsupported'));
            }
            continue;
          }
          const markdown = await uploadFile(file);
          insertReference(markdown);
          if (isImage && !visionEnabled) {
            setError(t('agent.uploadImageUnsupported'));
          }
        }
      } catch (err) {
        setError(
          t('agent.uploadFailed', {
            detail: err instanceof Error ? err.message : String(err),
          }),
        );
      } finally {
        setUploading(false);
      }
    },
    [files, insertReference, t, uploadFile, visionEnabled],
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(attachment => attachment.id !== id));
  }, []);

  const changeModel = useCallback(
    (providerId: string, modelId: string) => {
      const instance = agentRef.current;
      const active = latestRef.current;
      if (instance !== null && active !== null) {
        const model = getModel(providerId, modelId, prefix);
        if (model !== undefined) {
          instance.state.model = model;
        }
        const next = { ...active, providerId, modelId };
        latestRef.current = next;
        void persistSession(next, instance.state.messages);
      }
      updateConfig({ model: { providerId, modelId } });
    },
    [persistSession, prefix, updateConfig],
  );

  const changeThinking = useCallback(
    (level: ThinkingLevel) => {
      const instance = agentRef.current;
      const active = latestRef.current;
      if (instance !== null && active !== null) {
        instance.state.thinkingLevel = level;
        const next = { ...active, thinkingLevel: level };
        latestRef.current = next;
        void persistSession(next, instance.state.messages);
      }
      updateConfig({ thinkingLevel: level });
    },
    [persistSession],
  );

  const toggleToolCall = useCallback((id: string) => {
    setExpandedToolCalls(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    onClearSelection?.();
  }, [onClearSelection]);

  const saveExaKey = useCallback(async (key: string) => {
    setExaApiKey(key, prefix);
    setExaKeyPrompt(false);
    await mcp.reset();
    await syncMcpServersWithTimeout(prefix);
    setMcpTools(mcp.getTools());
  }, []);

  const sessionTree = useMemo(() => buildSessionTree(sessions), [sessions]);

  const installedFilesystemTools = (extraDescriptorsRef.current ?? []).filter(
    descriptor => descriptor.group === 'filesystem',
  );
  const filesystem =
    installedFilesystemTools.length > 0 && installedFilesystemTools[0]?.namespace !== undefined
      ? {
          namespace: installedFilesystemTools[0].namespace,
          tools: installedFilesystemTools,
          opfs: opfsRoot,
        }
      : null;

  const value: ReAgentContextValue = {
    config,
    updateConfig,
    storagePrefix: prefix,
    models,
    activeModel,
    visionEnabled,
    sessions,
    sessionTree,
    activeSession,
    createSession: async () => {
      await createSession();
    },
    forkSession,
    loadSession,
    renameSession,
    deleteSession,
    changeModel,
    changeThinking,
    status: streaming ? 'streaming' : 'idle',
    streamingText,
    streamingThinking,
    isThinking,
    toolCalls: toolChips,
    error,
    input,
    setInput,
    attachments,
    addFiles,
    removeAttachment,
    uploading,
    selection: clampedSelection(selection),
    selectionExpanded,
    toggleSelectionExpanded: () => setSelectionExpanded(expanded => !expanded),
    clearSelection,
    draft: draft ?? null,
    expandedToolCalls,
    toggleToolCall,
    send: handleSend,
    stop,
    view,
    setView,
    exaKeyPrompt,
    setExaKeyPrompt,
    saveExaKey,
    toolLabels,
    webmcp: { available: hasWebMcp(), toolCount: webmcpTools.length, tools: webmcpTools },
    hostProviders: (hostProviders ?? []).map(provider => ({
      id: provider.id,
      name: provider.name,
      component: provider.component,
      config: getHostProviderConfig(provider.id),
      setConfig: (next: ReAgentHostProviderConfig | null) => setHostConfig(provider.id, next),
    })),
    tools: listToolDescriptors(extraDescriptorsRef.current ?? [], {
      hasEditor: editor !== undefined && editor !== null,
      hasSkills: enabledSkillDefinitions(getAgentConfig(prefix)).length > 0,
    }),
    filesystem,
    files: files ?? null,
    t,
    language,
    theme,
    notify: notify ?? (() => undefined),
    renderMarkdown,
  };

  return <ReAgentContext.Provider value={value}>{children}</ReAgentContext.Provider>;
}

function resultFileRefs(result: unknown): ReAgentFileRef[] {
  if (result === null || typeof result !== 'object') {
    return [];
  }
  const details = (result as { details?: unknown }).details;
  if (details === null || typeof details !== 'object') {
    return [];
  }
  const files = (details as { files?: unknown }).files;
  return Array.isArray(files) ? files.filter(isReAgentFileRef) : [];
}

function clampedSelection(selection: string | null | undefined): string | null {
  if (selection === null || selection === undefined || selection.trim() === '') {
    return null;
  }
  return selection;
}
