# Models & providers

ReAgent wraps `pi-ai`'s model registry and adds browser storage plus a
verification step.

## Browser CORS limitation (cloud providers disabled)

ReAgent runs the agent loop **in the browser**, so it calls providers directly
from the page. That is fine for a local endpoint, but cloud gateways are a
problem:

- A CORS preflight can reject SDK headers (`x-stainless-*`, …).
- Worse, most gateways **omit `Access-Control-Allow-Origin` on error
  responses**. When a request fails (bad key, unknown model, rate limit), the
  browser reports only an opaque *"No 'Access-Control-Allow-Origin' header"*
  error and hides the real status/body — impossible to diagnose or handle from
  client-side code.

Because of this, **all cloud providers are temporarily disabled** and will
return once requests can be routed through a backend/proxy. The switch is
`CLOUD_PROVIDERS_ENABLED` (currently `false`). Until then the only usable
provider is the **Custom Local LLM** — any OpenAI-compatible endpoint (Ollama,
LM Studio, vLLM, …) the browser can reach.

## Providers

When cloud providers are enabled, ReAgent registers **every provider `pi-ai`
ships** (via `builtinProviders()`), plus one custom OpenAI-compatible endpoint.
Common API-key providers include:

| Provider id | Notes |
| ----------- | ----- |
| `openai`, `anthropic`, `openrouter`, `deepseek`, `groq` | First-class cloud providers. |
| `google`, `mistral`, `xai`, `together`, `cerebras`, `nvidia`, `huggingface`, `moonshotai`, `zai`, `baseten`, `vercel-ai-gateway`, … | Also API key based. |
| `amazon-bedrock`, `google-vertex`, `github-copilot`, `cloudflare-*`, `openai-codex`, … | Environment/OAuth-oriented; listed but not driven by a plain key. |
| `ollama` | Custom local/OpenAI-compatible endpoint; defaults to `http://localhost:11434`, usually no key. |

The settings UI groups these into **Custom Local LLM** and a searchable
**Cloud providers** dropdown. The exact set depends on the installed `pi-ai`
version — call `getModels().getProviders()` for the full list.

A few pi-ai providers are intentionally **not registered** because browsers
cannot call them — see **Disabled providers** below.

## Auth format per provider

The key is sent with whatever header the provider's API expects. Audit of the
current set:

| Header sent | Providers |
| ----------- | --------- |
| `Authorization: Bearer <key>` | `openai`, `openrouter`, `deepseek`, `groq`, `mistral`, `xai`, `together`, `cerebras`, `baseten`, `huggingface`, `nvidia`, `moonshotai`, `moonshotai-cn`, `zai`, `zai-coding-cn`, `xiaomi`, `xiaomi-token-plan-*`, `qwen-token-plan*`, `ant-ling`, `cloudflare-workers-ai`, `github-copilot`, `openai-codex` |
| `x-api-key: <key>` | `anthropic`, `kimi-coding` |
| `x-goog-api-key: <key>` | `google` |
| `api-key: <key>` | `azure-openai-responses` |
| `cf-aig-authorization: Bearer <key>` | `cloudflare-ai-gateway` |
| AWS SigV4 credentials or Bedrock bearer token | `amazon-bedrock` |
| `GOOGLE_CLOUD_API_KEY` or Google ADC (OAuth) | `google-vertex` |
| OAuth access token (`Authorization: Bearer`) | `openai-codex`, `github-copilot` (OAuth), `anthropic`/`kimi-coding`/`openrouter`/`xai` when authenticated via OAuth |
| mixed by model API | `opencode`, `opencode-go`, `xai` |
| gateway-defined | `vercel-ai-gateway` — see below |

### Gateways that want a different header

pi-ai's Anthropic client always sends the key as `x-api-key`. The **Vercel AI
Gateway** serves the same Anthropic Messages API but authenticates with
`Authorization: Bearer $AI_GATEWAY_API_KEY`, so ReAgent's browser `fetch`
normalizes the request per provider: for `vercel-ai-gateway` it rewrites
`x-api-key` to `Authorization: Bearer`.

Every other provider already sends the right header for its API and is left
alone. On top of that, the fetch drops SDK telemetry headers (`x-stainless-*`,
`x-goog-api-client`, `x-session-affinity`, `x-app`, `x-request-id`,
`x-should-retry`) and `anthropic-dangerous-direct-browser-access` everywhere
except `api.anthropic.com` (which needs it for browser CORS).

### Disabled providers

These pi-ai providers are **not registered** — browsers cannot call them
directly, so they would only produce confusing CORS/network failures. They are
listed in `UNSUPPORTED_PROVIDER_IDS` and hidden from the model settings:

| Provider | Why it is disabled |
| -------- | ------------------ |
| `fireworks` | Its Anthropic endpoint (`/inference/v1/messages`) returns no CORS headers at all. |
| `minimax`, `minimax-cn` | The CORS preflight rejects the headers the Anthropic client sends (only `Authorization` is allowed; `x-api-key` and `anthropic-version` are not). |

This only affects ReAgent's in-browser registry; calling these providers from a
server with `pi-ai` directly is unaffected.

## Credentials

Keys are stored per provider in `localStorage` under
`agent.credential.<providerId>`:

```ts
import { clearApiKey, hasCredential, saveApiKey } from '@liyu1981/reagent';

await saveApiKey('openai', 'sk-…');
hasCredential('openai'); // true
await clearApiKey('openai');
```

For a local, keyless model set the base URL:

```ts
import { getOllamaBaseUrl, setOllamaBaseUrl } from '@liyu1981/reagent';

setOllamaBaseUrl('http://localhost:11434');
```

## Verifying & listing

Only **verified** providers contribute models to the picker. Verification runs a
tiny request (or, for the local provider, a `GET /v1/models` probe):

```ts
import { isVerified, listAvailableModels, refreshModels, testConnection } from '@liyu1981/reagent';

await testConnection('anthropic'); // resolves to the model id on success
isVerified('anthropic');          // true
await refreshModels();            // refresh remote model lists
listAvailableModels();            // [{ provider, providerName, model }]
```

## Driving models programmatically

```ts
import { getModel, getModels } from '@liyu1981/reagent';

const model = getModel('openai', 'gpt-4o-mini');
const response = await getModels().completeSimple(model, {
  messages: [{ role: 'user', content: 'Hello', timestamp: Date.now() }],
});
```

## Default model selection

When a session starts, ReAgent picks the last-used model if it is still
available, otherwise a local (Ollama) model, otherwise the first available one.

Next: [Tools & skills](./tools-and-skills) →
