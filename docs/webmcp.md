# WebMCP

[WebMCP](https://webmachinelearning.github.io/webmcp/) (the W3C Web Machine
Learning "Web Model Context") lets a page expose JavaScript tools to an AI
agent running on that page through `document.modelContext`.

ReAgent **auto-detects** it: when the current page provides a model context, its
registered tools are added to the agent automatically — no props, no
configuration. When the page adds or removes a tool (the `toolchange` event),
the agent's tool set updates live.

## How it works

- On mount, ReAgent checks `document.modelContext`.
- If present, it calls `getTools()` and adapts each tool into an agent tool
  (name, title, description, JSON-Schema parameters and a callback that runs
  `executeTool`).
- It subscribes to `toolchange`, so page tools can come and go at runtime.

Host-provided `extraTools` / `extraDescriptors` still work alongside WebMCP
tools.

## Exposing tools from your page

```ts
document.modelContext?.registerTool({
  name: 'get_page_theme',
  title: 'Get page theme',
  description: 'Return the current page theme: "light" or "dark".',
  inputSchema: { type: 'object', properties: {} },
  execute: () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light'),
});
```

Browsers without a native implementation can be polyfilled. The WebMCP
[demo](/demos) uses
[`@mcp-b/webmcp-polyfill`](https://www.npmjs.com/package/@mcp-b/webmcp-polyfill)'s
`installWebMCP()`.

## API

```ts
import { hasWebMcp, listWebMcpTools, subscribeWebMcp } from '@liyu1981/reagent';

hasWebMcp();                 // does the page expose a model context?
await listWebMcpTools();     // the page's tools as agent tools
const off = subscribeWebMcp(() => { /* tools changed */ });
```

Inside a provider, `useReAgent().webmcp` gives `{ available, toolCount }`.

## Notes

- WebMCP is available only in a **secure context** (HTTPS or `localhost`).
- Tool names must be 1–128 characters of ASCII alphanumerics, `_`, `-` or `.`.
- See the [WebMCP demo](/demos) — the page registers two tools and the agent
  can call them.

Next: [Headless usage](./headless) →
