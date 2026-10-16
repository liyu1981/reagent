import type { ComponentType } from 'react';

/**
 * Default English copy for every visible ReAgent string. A host can override
 * any subset through `<ReAgentProvider messages={…}>` or supply its own
 * `translate` function. Keys are stable and namespaced `agent.*`.
 */
export type ReAgentMessages = Record<string, string>;

export type ReAgentTranslate = (key: string, vars?: Record<string, unknown>) => string;

export type ReAgentNotify = (message: string, level?: 'success' | 'error') => void;

export type ReAgentMarkdown = ComponentType<{ content: string; theme?: ReAgentTheme }>;

export type ReAgentTheme = 'light' | 'dark';

export const DEFAULT_MESSAGES: ReAgentMessages = {
  'agent.active': 'Active',
  'agent.apiKeyPlaceholder': 'Enter API key…',
  'agent.chatPlaceholder': 'Ask the agent…',
  'agent.clearKey': 'Clear key',
  'agent.cloudProviders': 'Cloud providers',
  'agent.clearSelection': 'Clear selection',
  'agent.close': 'Close',
  'agent.connected': 'Connected · {{model}}',
  'agent.customLocalLlm': 'Custom Local LLM (OpenAI compatible)',
  'agent.customPromptCleared': 'Using the built-in system prompt.',
  'agent.customPromptDescription':
    'Override the built-in assistant instructions. Stored only in this browser.',
  'agent.customPromptHint':
    'Use {{token}} to insert the answer language ("English" or "Chinese"). Changes apply to existing sessions too.',
  'agent.customPromptLoadDefault': 'Load built-in prompt',
  'agent.customPromptPlaceholder': 'Leave empty to use the built-in prompt.',
  'agent.customPromptReset': 'Reset',
  'agent.customPromptSaved': 'System prompt saved.',
  'agent.customPromptTitle': 'System prompt',
  'agent.deleteChat': 'Delete conversation',
  'agent.errorPrefix': 'Agent error:',
  'agent.exaKeyDescription':
    'Exa rejected the request. Add an API key to keep using web search — you can also set it later in Settings → Agent.',
  'agent.exaKeyPlaceholder': 'Paste your Exa API key…',
  'agent.exaKeyTitle': 'Exa API key required',
  'agent.keyCleared': 'API key cleared.',
  'agent.keySaved': 'API key saved.',
  'agent.keySet': 'Set',
  'agent.level.high': 'High',
  'agent.level.low': 'Low',
  'agent.level.max': 'Max',
  'agent.level.medium': 'Medium',
  'agent.level.minimal': 'Minimal',
  'agent.level.off': 'Off',
  'agent.level.xhigh': 'Extra high',
  'agent.mcpAuthRequired': 'API key needed',
  'agent.mcpConnected': '{{count}} tool(s)',
  'agent.mcpConnecting': 'Connecting…',
  'agent.mcpDescription':
    'Connect remote MCP servers and expose their tools to the agent. Requests go directly from your browser to the server.',
  'agent.mcpDisconnected': 'Not connected',
  'agent.mcpError': 'Connection failed',
  'agent.mcpExaKeyHint':
    'Optional. Without a key Exa answers anonymous requests with lower rate limits.',
  'agent.mcpExaKeyLabel': 'Exa API key',
  'agent.mcpExaKeyPlaceholder': 'Paste your Exa API key…',
  'agent.mcpKeySaved': 'Exa API key saved.',
  'agent.mcpTest': 'Reconnect',
  'agent.mcpTitle': 'MCP servers',
  'agent.modelsRefreshed': 'Models refreshed.',
  'agent.newChat': 'New chat',
  'agent.noKeyNeeded': 'no key needed',
  'agent.noMessages': 'No messages yet.',
  'agent.noModelsFound': 'No models found.',
  'agent.noModelsHint':
    'No verified model yet. Configure and test a connection in Settings → Agent to start chatting.',
  'agent.noProvidersFound': 'No providers found.',
  'agent.ollamaBaseUrlField': 'Ollama base URL',
  'agent.ollamaBaseUrlHint':
    'Used for the local OpenAI-compatible provider. Set to your Ollama server, e.g. http://localhost:11434.',
  'agent.ollamaKeyPlaceholder': 'No key required',
  'agent.ollamaSaved': 'Ollama base URL saved.',
  'agent.refresh': 'Refresh',
  'agent.refreshModels': 'Refresh available models',
  'agent.removeAttachment': 'Remove attachment',
  'agent.save': 'Save',
  'agent.saveKey': 'Save key',
  'agent.searchModels': 'Search models…',
  'agent.searchProviders': 'Search providers…',
  'agent.selectModelPlaceholder': 'Select a model…',
  'agent.selectProviderPlaceholder': 'Select a provider…',
  'agent.selectionClamped': 'Clamped selection: “{{preview}}” ({{count}} chars)',
  'agent.selectionCollapse': 'Hide selection',
  'agent.selectionExpand': 'Show selection',
  'agent.selectionMore': '…and {{count}} more chars',
  'agent.send': 'Send',
  'agent.sessionActions': 'Conversation actions',
  'agent.sessionBranch': 'Branch',
  'agent.sessionBranchFromHere': 'Branch from here',
  'agent.sessionCollapse': 'Collapse branch',
  'agent.sessionDelete': 'Delete',
  'agent.sessionDeleteKeepChildren':
    '“{{name}}” will be removed. Conversations branched from it are kept and move up a level.',
  'agent.sessionDeleteTitle': 'Delete conversation?',
  'agent.sessionEmpty': 'No conversations yet.',
  'agent.sessionExpand': 'Expand branch',
  'agent.sessionLoad': 'Open',
  'agent.sessionNew': 'New',
  'agent.sessionRename': 'Rename',
  'agent.sessionSearch': 'Search conversations…',
  'agent.sessionTree': 'Conversations',
  'agent.sessionTreeDescription':
    'One conversation is active at a time. Load, branch or delete any conversation; branches stay linked to their origin.',
  'agent.settingsBack': 'Back to chat',
  'agent.settingsDescription':
    'API keys are stored only in this browser and sent directly to the provider you choose.',
  'agent.settingsOpen': 'Agent settings',
  'agent.settingsTabMcp': 'MCP',
  'agent.settingsTabModel': 'Model',
  'agent.settingsTabPrompt': 'Prompt',
  'agent.settingsTabSkills': 'Skills',
  'agent.settingsTabTools': 'Tools',
  'agent.settingsTitle': 'Agent settings',
  'agent.skillContent': 'Instructions',
  'agent.skillContentPlaceholder': 'Full markdown instructions…',
  'agent.skillDelete': 'Delete',
  'agent.skillDeleteDescription': 'This removes “{{name}}” from this browser.',
  'agent.skillDeleteTitle': 'Delete skill?',
  'agent.skillDescription': 'Description',
  'agent.skillDescriptionPlaceholder': 'When should the assistant use this skill?',
  'agent.skillEditTitle': 'Edit skill',
  'agent.skillName': 'Name',
  'agent.skillNamePlaceholder': 'e.g. Release notes writer',
  'agent.skillNameRequired': 'Skill name is required.',
  'agent.skillNewTitle': 'New skill',
  'agent.skillsAdd': 'Add skill',
  'agent.skillsBuiltin': 'Built-in skills',
  'agent.skillsBuiltinBadge': 'built-in',
  'agent.skillsCustom': 'Custom skills',
  'agent.skillsDescription':
    'Reusable instructions the assistant loads on demand when a task matches. Stored only in this browser.',
  'agent.skillsEmpty': 'No skills yet. Add one to give the assistant specialized instructions.',
  'agent.skillsSaved': 'Skills saved.',
  'agent.skillsTitle': 'Skills',
  'agent.stop': 'Stop',
  'agent.systemPrompt':
    "You are a helpful AI assistant embedded in a web application. Answer the user's questions clearly and concisely, and use the tools available to you when they help. If a request is ambiguous, ask a brief clarifying question instead of guessing. Answer in {{language}}.",
  'agent.tagReasoning': 'reasoning',
  'agent.tagVision': 'vision',
  'agent.testConnection': 'Test',
  'agent.testCorsFailed':
    'The provider blocked the browser request before granting CORS access, so the real reason is hidden. Check the API key and that the model is available on this endpoint.',
  'agent.testFailed': 'Connection failed: {{detail}}',
  'agent.testNoModel': 'No model available for this provider.',
  'agent.testNotConfigured': 'No API key configured for this provider.',
  'agent.testing': 'Testing connection…',
  'agent.thinking': 'Thinking…',
  'agent.thinkingLevelField': 'Thinking level',
  'agent.title': 'Agent',
  'agent.togglePanel': 'Toggle agent panel',
  'agent.toolArgs': 'Arguments',
  'agent.toolDone': 'Done',
  'agent.toolError': 'Failed',
  'agent.toolResult': 'Result',
  'agent.toolsDisabledHint': 'Switch a tool off to hide it from the model.',
  'agent.toolsGroup.content': 'Content',
  'agent.toolsGroup.editor': 'Editor',
  'agent.toolsGroup.mcp': 'MCP',
  'agent.toolsGroup.skills': 'Skills',
  'agent.toolsGroup.web': 'Web',
  'agent.untitled': 'Untitled',
  'agent.upload': 'Add file or image',
  'agent.uploadFailed': 'Upload failed: {{detail}}',
  'agent.uploadImageUnsupported':
    'This model cannot read images — the image was uploaded as an asset instead.',
  'agent.uploading': 'Uploading…',
  'agent.usedTool': 'Used {{tool}}',
  'agent.verified': 'Verified',
};

/** Interpolate `{{token}}` placeholders. */
export function interpolate(template: string, vars?: Record<string, unknown>): string {
  if (vars === undefined) {
    return template;
  }
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => String(vars[key] ?? ''));
}

/** Build a `t()` backed by the defaults merged with the host's overrides. */
export function makeTranslator(messages?: Partial<ReAgentMessages>): ReAgentTranslate {
  const table: ReAgentMessages = { ...DEFAULT_MESSAGES };
  if (messages !== undefined) {
    for (const [key, value] of Object.entries(messages)) {
      if (typeof value === 'string') {
        table[key] = value;
      }
    }
  }
  return (key, vars) => interpolate(table[key] ?? key, vars);
}
