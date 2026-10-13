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
import { blobToBase64, makeVisionImage } from './attachments';
import { getAgentConfig, subscribeAgentConfig, updateAgentConfig } from './config';
import type { EditorMutationBridge } from './editor-mutations';
import { EXA_SERVER_ID, mcpManager, setExaApiKey, syncMcpServersWithTimeout } from './mcp';
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
  refreshModels,
  subscribeModels,
} from './models';
import { EDITOR_GUARDRAIL, resolveSystemPrompt } from './prompt';
import {
  buildSessionTree,
  deleteSession as deleteSessionRecord,
  forkSession as forkSessionRecord,
  listSessions,
  newSessionId,
  saveSession,
} from './session-store';
import { enabledSkillDefinitions, skillsSystemPrompt } from './skill-registry';
import { buildAgentTools, listToolDescriptors } from './tools';
import type {
  AgentAttachment,
  AgentConfig,
  AgentDraft,
  AgentSession,
  AgentSessionNode,
  AgentToolDescriptor,
  ToolChip,
} from './types';

export interface ModelOption {
  provider: string;
  providerName: string;
  model: Model<Api>;
}

export interface ReAgentContextValue {
  config: AgentConfig;
  updateConfig: (patch: Partial<AgentConfig>) => void;
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

  t: ReAgentTranslate;
  language: string;
  theme: ReAgentTheme;
  notify: ReAgentNotify;
  renderMarkdown: ReAgentMarkdown | undefined;
}

export type ReAgentView = 'chat' | 'settings' | 'sessions';

export const ReAgentContext = createContext<ReAgentContextValue | null>(null);

const LAST_MODEL_KEY = 'agent.lastModel';

function readLastModel(): { providerId: string; modelId: string } | undefined {
  try {
    const raw = localStorage.getItem(LAST_MODEL_KEY);
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
  children,
}: ReAgentProviderProps) {
  const t = useMemo(() => translate ?? makeTranslator(messages), [translate, messages]);
  const config = useSyncExternalStore(subscribeAgentConfig, getAgentConfig);

  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [toolChips, setToolChips] = useState<ToolChip[]>([]);
  const [expandedToolCalls, setExpandedToolCalls] = useState<Set<string>>(new Set());
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mcpTools, setMcpTools] = useState<AgentTool<any>[]>([]);
  const [exaKeyPrompt, setExaKeyPrompt] = useState(false);
  const [attachments, setAttachments] = useState<AgentAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectionExpanded, setSelectionExpanded] = useState(false);
  const [view, setView] = useState<ReAgentView>('chat');

  const agentRef = useRef<Agent | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const latestRef = useRef<AgentSession | null>(null);
  const sessionsRef = useRef<AgentSession[]>([]);
  const draftRef = useRef(draft ?? null);
  const editorRef = useRef(editor);
  const extraToolsRef = useRef(extraTools);
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
    selectionRef.current = selection;
  }, [selection]);

  useEffect(() => {
    setMcpTools(mcpManager.getTools());
    return mcpManager.subscribe(() => {
      const tools = mcpManager.getTools();
      setMcpTools(tools);
      const agent = agentRef.current;
      const active = latestRef.current;
      if (agent !== null && active !== null && !agent.state.isStreaming) {
        agent.state.tools = buildAgentTools({
          editor: editorRef.current ?? undefined,
          extraTools: [...tools, ...(extraToolsRef.current ?? [])],
          extraDescriptors: extraDescriptorsRef.current ?? [],
          disabledIds: configRef.current.toolsDisabled,
        });
      }
    });
  }, []);

  useEffect(
    () =>
      mcpManager.onAuthRequired(serverId => {
        if (serverId === EXA_SERVER_ID) {
          setExaKeyPrompt(true);
        }
      }),
    [],
  );

  const modelsVersion = useSyncExternalStore(subscribeModels, getModelsVersion);
  const models = useMemo(() => listAvailableModels(), [config, modelsVersion]);

  const activeSession = sessions.find(session => session.id === config.activeSessionId) ?? null;
  const activeModel =
    activeSession !== null ? getModel(activeSession.providerId, activeSession.modelId) : undefined;
  const visionEnabled = activeModel?.input.includes('image') ?? false;

  const toolLabels = useMemo(() => {
    const map = new Map<string, string>();
    const descriptors = listToolDescriptors(extraDescriptorsRef.current ?? [], {
      hasEditor: editorRef.current !== undefined && editorRef.current !== null,
      hasSkills: enabledSkillDefinitions().length > 0,
    });
    for (const descriptor of descriptors) {
      map.set(descriptor.name, descriptor.label);
    }
    for (const tool of mcpTools) {
      map.set(tool.name, tool.label);
    }
    return map;
  }, [mcpTools, config]);

  const persistSession = useCallback(async (sessionNow: AgentSession, messages: AgentMessage[]) => {
    const updated: AgentSession = { ...sessionNow, messages, updatedAt: Date.now() };
    latestRef.current = updated;
    await saveSession(updated);
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
    );
    const skills = skillsSystemPrompt();
    return skills === '' ? base : `${base}\n\n${skills}`;
  }, [language, t]);

  const defaultModel = useCallback((): { providerId: string; modelId: string } | undefined => {
    const available = listAvailableModels();
    const configured = configRef.current.model;
    const last = configured ?? readLastModel();
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
  }, []);

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
            break;
          case 'message_start':
            if (event.message.role === 'assistant') {
              setStreamingText('');
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
            } else if (ev.type === 'thinking_end') {
              setIsThinking(false);
            }
            break;
          }
          case 'message_end':
            patchActive([...instance.state.messages]);
            if (event.message.role === 'assistant') {
              setStreamingText('');
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
            setToolChips(prev =>
              prev.map(chip =>
                chip.id === event.toolCallId
                  ? { ...chip, status: event.isError ? 'error' : 'done', result: event.result }
                  : chip,
              ),
            );
            break;
          case 'agent_end':
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
      await syncMcpServersWithTimeout();

      const extra = [...mcpManager.getTools(), ...(extraToolsRef.current ?? [])];
      try {
        const instance = buildAgent({
          providerId: sessionNow.providerId,
          modelId: sessionNow.modelId,
          systemPrompt: currentBasePrompt(),
          thinkingLevel: sessionNow.thinkingLevel,
          messages: sessionNow.messages,
          sessionId: sessionNow.id,
          editor: editorRef.current ?? undefined,
          extraTools: extra,
          extraDescriptors: extraDescriptorsRef.current ?? [],
          disabledToolIds: configRef.current.toolsDisabled,
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
    [currentBasePrompt, subscribeAgent],
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
    await saveSession(next);
    setSessions(prev => [...prev, next]);
    latestRef.current = next;
    updateAgentConfig({ activeSessionId: next.id, model });
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
      updateAgentConfig({ activeSessionId: id });
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
      updateAgentConfig({ activeSessionId: fork.id });
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
    await saveSession(updated);
    setSessions(prev => prev.map(session => (session.id === id ? updated : session)));
  }, []);

  const deleteSession = useCallback(
    async (id: string) => {
      const target = sessionsRef.current.find(session => session.id === id);
      const grandparent = target?.parentId ?? null;
      await deleteSessionRecord(id);
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
          updateAgentConfig({ activeSessionId: null });
        }
      }
    },
    [loadSession],
  );

  // Initial load: refresh models, list sessions, pick the active one.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await refreshModels().catch(() => undefined);
      const all = await listSessions();
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
        updateAgentConfig({ activeSessionId: active.id });
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
        void saveSession({
          ...session,
          messages: [...agent.state.messages],
          updatedAt: Date.now(),
        });
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
    instance.state.systemPrompt = buildSystemPrompt(currentBasePrompt());
    const prompt =
      selection !== null && selection !== undefined && selection.trim() !== ''
        ? `Revise the following selection.\n\n\`\`\`markdown\n${selection}\n\`\`\`\n\nInstruction: ${text}`
        : text;
    const sentAttachments = attachments;
    const images: ImageContent[] = sentAttachments.map(attachment => ({
      type: 'image' as const,
      data: attachment.data,
      mimeType: attachment.mimeType,
    }));
    setInput('');
    setAttachments([]);
    setStreaming(true);
    setError(null);
    try {
      if (images.length > 0) {
        await instance.prompt(prompt, images);
      } else {
        await instance.prompt(prompt);
      }
      if (sessionNow.title === t('agent.untitled')) {
        const titleText = text === '' ? (sentAttachments[0]?.name ?? '') : text;
        const title = titleText.slice(0, 40) + (titleText.length > 40 ? '…' : '');
        await persistSession({ ...sessionNow, title }, instance.state.messages);
      }
    } catch (err) {
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
    async (files: FileList) => {
      const list = Array.from(files);
      if (list.length === 0) {
        return;
      }
      setUploading(true);
      setError(null);
      try {
        for (const file of list) {
          const isImage = file.type.startsWith('image/');
          if (isImage && visionEnabled) {
            const blob = await makeVisionImage(file);
            const mimeType = blob.type === '' ? file.type || 'image/png' : blob.type;
            const data = await blobToBase64(blob);
            setAttachments(prev => [...prev, { id: newId(), name: file.name, mimeType, data }]);
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
    [insertReference, t, uploadFile, visionEnabled],
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(attachment => attachment.id !== id));
  }, []);

  const changeModel = useCallback(
    (providerId: string, modelId: string) => {
      const instance = agentRef.current;
      const active = latestRef.current;
      if (instance !== null && active !== null) {
        const model = getModel(providerId, modelId);
        if (model !== undefined) {
          instance.state.model = model;
        }
        const next = { ...active, providerId, modelId };
        latestRef.current = next;
        void persistSession(next, instance.state.messages);
      }
      updateAgentConfig({ model: { providerId, modelId } });
    },
    [persistSession],
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
      updateAgentConfig({ thinkingLevel: level });
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
    setExaApiKey(key);
    setExaKeyPrompt(false);
    await mcpManager.reset();
    await syncMcpServersWithTimeout();
    setMcpTools(mcpManager.getTools());
  }, []);

  const sessionTree = useMemo(() => buildSessionTree(sessions), [sessions]);

  const value: ReAgentContextValue = {
    config,
    updateConfig: updateAgentConfig,
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
    tools: listToolDescriptors(extraDescriptorsRef.current ?? [], {
      hasEditor: editor !== undefined && editor !== null,
      hasSkills: enabledSkillDefinitions().length > 0,
    }),
    t,
    language,
    theme,
    notify: notify ?? (() => undefined),
    renderMarkdown,
  };

  return <ReAgentContext.Provider value={value}>{children}</ReAgentContext.Provider>;
}

function clampedSelection(selection: string | null | undefined): string | null {
  if (selection === null || selection === undefined || selection.trim() === '') {
    return null;
  }
  return selection;
}
