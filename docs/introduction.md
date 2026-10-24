# Introduction

ReAgent is a **composable React AI agent**. It gives you an in-app chat with a
conversation tree, a self-contained settings view (model, prompt, skills, tools
and MCP servers) and a headless core you can rearrange however you like.

It is built on top of
[`@earendil-works/pi-agent-core`](https://www.npmjs.com/package/@earendil-works/pi-agent-core)
and `pi-ai`, but you don't have to think about the loop unless you want to.

## Why ReAgent

- **Runs in the browser.** The agent loop executes client-side. API keys and
  conversations stay on the device — nothing is proxied through your server.
- **Bring your own providers.** OpenAI, Anthropic, OpenRouter, DeepSeek, Groq
  and any OpenAI-compatible endpoint (Ollama, LM Studio, vLLM, …).
- **Zero opinions by default.** A bare `<ReAgent />` is just chat — no built-in
  tools, skills or MCP servers. Add exactly what your app needs through props and
  `updateAgentConfig`.
- **Batteries available, never forced.** Use the styled preset, or compose
  `ReAgentProvider` with the exported UI parts and hooks.
- **Themeable.** Ships Tailwind v4 utilities and design tokens. Override the
  tokens or replace the markup entirely.
- **Conversations as a tree.** Sessions persist to IndexedDB and can be
  forked/branched from any message.
- **MCP native.** Connect remote [Model Context Protocol](https://modelcontextprotocol.io)
  servers and their tools appear in the model's toolbox — opt-in, nothing is
  configured by default.

## What's in the box

| Layer | Exports | Purpose |
| ----- | ------- | ------- |
| Preset | `ReAgent` | Styled chat + sessions + settings, one component. |
| Provider | `ReAgentProvider` | State, agent runtime, config, hooks. |
| UI parts | `ReAgentRoot`, `ReAgentHeader`, `ReAgentMessageList`, `ReAgentComposer`, `ReAgentSessionsView`, `ReAgentSettingsView`, … | Composable, unstyled-by-default building blocks. |
| Hooks | `useReAgent`, `useReAgentSession`, `useReAgentSessions`, `useReAgentConfig`, `useReAgentRegistry` | Access state and actions from your own components. |
| Core | `config`, `models`, `mcp`, `session-store`, `prompt`, `tools`, `skill-registry`, `agent`, `i18n` | Use the agent without any UI. |

## A note on persistence & keys

ReAgent intentionally uses **browser storage** for everything user-specific:

- API keys → `localStorage` (per provider, never leaves the browser).
- Agent configuration (model, prompt, skills, MCP) → `localStorage`.
- Conversations → `IndexedDB` (database `reagent-agent`).

That makes it ideal for local-first tools, static sites and GitHub Pages
demos — and it means you should call that out to your users.

## See it in action

The [live demos](/demos) cover the range:

- **Vanilla** — the preset and nothing else.
- **Skills, tools & MCP** — host-defined skills, a custom tool and the Exa MCP
  server.
- **Filesystem · Attachments** — OPFS attachments and tools with a fake,
  in-page LLM (no API key needed).
- **WebMCP** and **Host provider** — page tools and a host-injected model.

Each demo displays its full source.

Next: [Installation](./installation) →
