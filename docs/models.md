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
`openrouter` today) plus one custom OpenAI-compatible endpoint — and, on top of
that, any [custom cloud provider](#custom-cloud-providers) the host or user
registers:

| Provider id | Notes |
| ----------- | ----- |
| `openrouter` | Browser-verified. API key. |
| `ollama` | Custom local/OpenAI-compatible endpoint; defaults to `http://localhost:11434`, usually no key. |

The auth formats and notes below are reference material for the full pi-ai set.

## Custom cloud providers

Any other provider can be registered at runtime with **custom cloud
providers**, in pi-ai's provider vocabulary. A spec is either just an id —
re-enabling the pi-ai built-in of that id — or a full definition with a
`baseUrl`, `api` and `models`:

```ts
import {
  addCustomCloudProvider,
  getCustomCloudProviders,
  listBuiltinCloudProviders,
  removeCustomCloudProvider,
  setCustomCloudProviders,
} from '@liyu1981/reagent';

// Re-enable a pi-ai built-in (needs a key + Test before its models appear).
addCustomCloudProvider({ id: 'anthropic' });

// Add an OpenAI/Anthropic-compatible endpoint pi-ai does not know.
addCustomCloudProvider({
  id: 'my-proxy',
  name: 'My proxy',
  baseUrl: 'https://llm.example.com/v1',
  api: 'openai-completions', // or 'openai-responses' / 'anthropic-messages'
  models: [
    'fast',
    { id: 'smart', contextWindow: 200_000, maxTokens: 64_000, reasoning: true },
  ],
});

listBuiltinCloudProviders(); // every provider pi-ai ships, as { id, name }
getCustomCloudProviders();   // the current set (persisted in the agent config)
removeCustomCloudProvider('my-proxy');
setCustomCloudProviders([]); // replace the whole set
```

Custom providers join the model registry like any other: they appear in
**Settings → Model**, contribute models only after a saved key plus a
successful **Test**, and survive reloads. The docs page
[Browser support & cloud providers](./browser-support) ships a test bench that
re-enables every built-in provider through this API.

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

### Key retention

Every saved key is stamped with its save time and deleted once it outlives the
retention window — **Settings → General → API key retention**, default 7 days.
An expired key also un-verifies its provider, so its models disappear until a
new key is saved and tested. The "Keep forever" option is opt-in behind a
warning and a second confirmation.

```ts
import { getKeyRetention, pruneExpiredCredentials, setKeyRetention } from '@liyu1981/reagent';

getKeyRetention(); // 604800000 (7 days), or null = keep forever
setKeyRetention(24 * 60 * 60 * 1000); // 24 hours — keys outside it are removed now
pruneExpiredCredentials(); // force a sweep without changing the window
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
