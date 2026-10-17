# Browser support & cloud providers

ReAgent runs the agent loop **in the browser**, so it calls model providers
directly from the page. Cloud gateways generally do not permit that:

- A CORS preflight must list every custom header the client sends
  (`x-stainless-*`, `anthropic-beta`, …). ReAgent strips the SDK telemetry
  headers, but gateways still vary.
- More importantly, most gateways **omit `Access-Control-Allow-Origin` on error
  responses** (a few omit it entirely). When a request fails — bad key,
  unknown model, rate limit, unsupported feature — the browser reports only an
  opaque *"No 'Access-Control-Allow-Origin' header"* error and hides the real
  status and body. That makes the failure impossible to diagnose or handle from
  client-side code.

Because of this, **cloud providers are disabled** except for the few verified
to allow browser requests.

## Status

Every provider `pi-ai` ships (42 at the time of writing), plus the custom local
endpoint. **To be tested** means we have not yet verified whether that gateway
allows browser (CORS) requests.

| Provider | Status | Notes |
| -------- | ------ | ----- |
| Custom local LLM (`ollama`) | ✅ Supported | Any OpenAI-compatible endpoint the browser can reach. Always available. |
| OpenRouter (`openrouter`) | ✅ Supported | Verified end-to-end (test + send). Its `/models` list is public. |
| Fireworks (`fireworks`) | ❌ Not supported | `/inference/v1/messages` returns no CORS headers. |
| MiniMax (`minimax`) | ❌ Not supported | Preflight rejects the Anthropic client's headers. |
| MiniMax CN (`minimax-cn`) | ❌ Not supported | Same as MiniMax. |
| OpenCode Zen (`opencode`) | ❌ Not supported | Tested; CORS-blocked. |
| OpenCode Go (`opencode-go`) | ❌ Not supported | Tested; CORS-blocked. |
| Vercel AI Gateway (`vercel-ai-gateway`) | ❌ Not supported | Tested; CORS-blocked. |
| Amazon Bedrock (`amazon-bedrock`) | ❓ To be tested | |
| Ant Ling (`ant-ling`) | ❓ To be tested | |
| Anthropic (`anthropic`) | ❓ To be tested | |
| Azure (`azure`) | ❓ To be tested | |
| Baseten (`baseten`) | ❓ To be tested | |
| Cerebras (`cerebras`) | ❓ To be tested | |
| Cloudflare AI Gateway (`cloudflare-ai-gateway`) | ❓ To be tested | |
| Cloudflare Workers AI (`cloudflare-workers-ai`) | ❓ To be tested | |
| DeepSeek (`deepseek`) | ❓ To be tested | |
| GitHub Copilot (`github-copilot`) | ❓ To be tested | |
| Google (`google`) | ❓ To be tested | |
| Google Vertex AI (`google-vertex`) | ❓ To be tested | |
| Groq (`groq`) | ❓ To be tested | |
| Hugging Face (`huggingface`) | ❓ To be tested | |
| Kimi For Coding (`kimi-coding`) | ❓ To be tested | |
| Meta (`meta`) | ❓ To be tested | |
| Mistral (`mistral`) | ❓ To be tested | |
| Moonshot AI (`moonshotai`) | ❓ To be tested | |
| Moonshot AI CN (`moonshotai-cn`) | ❓ To be tested | |
| NVIDIA (`nvidia`) | ❓ To be tested | |
| OpenAI (`openai`) | ❓ To be tested | |
| OpenAI Codex legacy (`openai-codex`) | ❓ To be tested | OAuth-only. |
| Qwen Token Plan (`qwen-token-plan`) | ❓ To be tested | |
| Qwen Token Plan CN (`qwen-token-plan-cn`) | ❓ To be tested | |
| Qwen Token Plan Individual (`qwen-token-plan-individual`) | ❓ To be tested | |
| Radius (`radius`) | ❓ To be tested | |
| Together (`together`) | ❓ To be tested | |
| TypeSafe (`typesafe`) | ❓ To be tested | |
| xAI (`xai`) | ❓ To be tested | |
| Xiaomi (`xiaomi`) | ❓ To be tested | |
| Xiaomi Token Plan AMS (`xiaomi-token-plan-ams`) | ❓ To be tested | |
| Xiaomi Token Plan CN (`xiaomi-token-plan-cn`) | ❓ To be tested | |
| Xiaomi Token Plan SGP (`xiaomi-token-plan-sgp`) | ❓ To be tested | |
| Z.AI (`zai`) | ❓ To be tested | |
| Z.AI Coding CN (`zai-coding-cn`) | ❓ To be tested | |

Only the providers in `BROWSER_SUPPORTED_PROVIDERS` (`@liyu1981/reagent`) are
registered; everything else is hidden from **Settings → Model**.

## What still works

The **Custom Local LLM** provider is always available — point ReAgent at any
OpenAI-compatible server the browser can reach: Ollama on
`http://localhost:11434`, LM Studio, vLLM, … See
[Models & providers](./models).

## Making more providers work

Browser-direct calls to a gateway that does not send CORS headers cannot be
fixed in client code. Such a provider needs a **backend/proxy** that performs
the request server-side (CORS does not apply to server-to-server traffic) and
returns the response to the page. When that exists, add the provider to
`BROWSER_SUPPORTED_PROVIDERS`.

Next: [Models & providers](./models) →
