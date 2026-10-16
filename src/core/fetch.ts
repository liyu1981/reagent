import type { FetchFunction } from '@earendil-works/pi-ai';

/**
 * Browser request normalization.
 *
 * Two classes of problems break browser provider calls even with a valid key:
 *
 * 1. Headers that CORS preflights reject. Stainless-generated SDKs add
 *    `x-stainless-*`; pi-ai adds `anthropic-dangerous-direct-browser-access`
 *    and `x-session-affinity`/`x-app`; the Google SDK adds `x-goog-api-client`.
 * 2. Auth headers a gateway does not accept. pi-ai's Anthropic client always
 *    sends the key as `x-api-key`, but some Anthropic-protocol gateways want
 *    `Authorization: Bearer` instead.
 *
 * Telemetry headers are stripped globally; the auth header is normalized per
 * provider (the model's `provider` id is available at request time).
 */

/** Prefixes stripped wholesale (SDK telemetry). */
const STRIPPED_PREFIXES = ['x-stainless-'];

/** Exact header names that are client hints rather than API contract. */
const STRIPPED_HEADERS = new Set([
  'x-goog-api-client',
  'x-session-affinity',
  'x-app',
  'x-request-id',
  'x-should-retry',
]);

/** Needed for browser CORS only by the direct Anthropic API. */
const BROWSER_ACCESS_HEADER = 'anthropic-dangerous-direct-browser-access';

interface ProviderAuthProfile {
  /** Send the key as `Authorization: Bearer` instead of the SDK's `x-api-key`. */
  bearer?: boolean;
  /** Extra request headers this provider's CORS preflight rejects. */
  drop?: readonly string[];
}

/**
 * Provider-specific overrides, audited against each API's JSON/protocol docs
 * and CORS preflight (`Access-Control-Allow-Headers`). Providers not listed
 * already use the correct header for their API:
 *   openai-completions / openai-responses / mistral -> `Authorization: Bearer`
 *   anthropic-messages                              -> `x-api-key`
 *   google-generative-ai                            -> `x-goog-api-key`
 *   azure-openai-responses                          -> `api-key`
 *   cloudflare-ai-gateway                           -> `cf-aig-authorization`
 *
 * (Fireworks and MiniMax are not registered at all — see
 * `UNSUPPORTED_PROVIDER_IDS` in `models.ts`.)
 */
const PROVIDER_AUTH: Record<string, ProviderAuthProfile> = {
  // Anthropic Messages API, but authenticated with `Authorization: Bearer`.
  'vercel-ai-gateway': { bearer: true },
};

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }
  return input instanceof URL ? input.href : input.url;
}

function hostOf(input: RequestInfo | URL): string | null {
  try {
    const base = typeof location === 'undefined' ? undefined : location.href;
    return new URL(requestUrl(input), base).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function sanitizeHeaders(
  headers: HeadersInit | undefined,
  host: string | null,
  profile: ProviderAuthProfile | undefined,
): HeadersInit | undefined {
  if (headers === undefined) {
    return undefined;
  }
  const next = new Headers(headers);
  const keepBrowserAccess = host === 'api.anthropic.com';
  for (const name of [...next.keys()]) {
    const lower = name.toLowerCase();
    if (
      STRIPPED_PREFIXES.some(prefix => lower.startsWith(prefix)) ||
      STRIPPED_HEADERS.has(lower) ||
      (lower === BROWSER_ACCESS_HEADER && !keepBrowserAccess) ||
      profile?.drop?.includes(lower)
    ) {
      next.delete(name);
    }
  }

  if (profile?.bearer === true) {
    const key = next.get('x-api-key');
    if (key !== null && next.get('authorization') === null) {
      next.set('authorization', `Bearer ${key}`);
    }
    next.delete('x-api-key');
  }

  return next;
}

/**
 * Wrap a fetch implementation so requests are acceptable to browser CORS
 * preflights and carry the auth header the provider actually expects.
 */
export function browserSafeFetch(base?: FetchFunction, providerId?: string): FetchFunction {
  const impl = base ?? fetch;
  const profile = providerId === undefined ? undefined : PROVIDER_AUTH[providerId];
  return (input, init) =>
    impl(
      input,
      init === undefined
        ? init
        : { ...init, headers: sanitizeHeaders(init.headers, hostOf(input), profile) },
    );
}
