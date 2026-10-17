# Models & providers

ReAgent wraps `pi-ai`'s model registry and adds browser storage plus a
verification step.

> **Cloud providers are mostly disabled.** ReAgent calls providers directly from
> the browser, and most gateways do not allow that (their missing CORS headers
> hide the real error). Only verified providers are registered — see
> [Browser support & cloud providers](./browser-support).

## Live model refresh

The Test button (and the refresh on load) lists the provider's actual models and
replaces pi-ai's static catalog in the picker, so a stale catalog no longer hides
the real models. The live list is held in memory — reloading falls back to the
bundled catalog until the next test/refresh.

## Providers

ReAgent registers the providers listed in `BROWSER_SUPPORTED_PROVIDERS` (only
`openrouter` today) plus one custom OpenAI-compatible endpoint:

| Provider id | Notes |
| ----------- | ----- |
| `openrouter` | Browser-verified. API key. |
| `ollama` | Custom local/OpenAI-compatible endpoint; defaults to `http://localhost:11434`, usually no key. |

The auth formats and notes below are reference material for the full pi-ai set.

## Auth format per provider

The key is sent with whatever header the provider's API expects. Reference for
the full pi-ai set (most are currently disabled — see
[Browser support & cloud providers](./browser-support)):

| Header sent | Providers |
| ----------- | --------- |
| `Authorization: Bearer <key>` | `openai`, `openrouter`, `deepseek`, `groq`, `mistral`, `xai`, `together`, `cerebras`, `baseten`, `huggingface`, `nvidia`, `moonshotai`, `moonshotai-cn`, `meta`, `zai`, `zai-coding-cn`, `xiaomi`, `xiaomi-token-plan-*`, `qwen-token-plan*`, `ant-ling`, `cloudflare-workers-ai`, `github-copilot`, `openai-codex` |
| `x-api-key: <key>` | `anthropic`, `kimi-coding` |
| `x-goog-api-key: <key>` | `google` |
| `api-key: <key>` | `azure` |
| `cf-aig-authorization: Bearer <key>` | `cloudflare-ai-gateway` |
| AWS SigV4 credentials or Bedrock bearer token | `amazon-bedrock` |
| `GOOGLE_CLOUD_API_KEY` or Google ADC (OAuth) | `google-vertex` |
| OAuth access token (`Authorization: Bearer`) | `openai-codex`, `github-copilot` (OAuth), `anthropic`/`kimi-coding`/`openrouter`/`xai` when authenticated via OAuth |
| mixed by model API | `opencode`, `opencode-go`, `xai`, `azure` |
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
