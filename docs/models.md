# Models & providers

ReAgent wraps `pi-ai`'s model registry and adds browser storage plus a
verification step.

## Built-in providers

| Provider id | Notes |
| ----------- | ----- |
| `openai` | OpenAI API key. |
| `anthropic` | Anthropic API key. |
| `openrouter` | OpenRouter API key. |
| `deepseek` | DeepSeek API key. |
| `groq` | Groq API key. |
| `ollama` | Any OpenAI-compatible endpoint; defaults to `http://localhost:11434`, no key. |

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
