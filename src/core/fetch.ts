import type { FetchFunction } from '@earendil-works/pi-ai';

/**
 * Browser provider requests pick up client-identification headers that CORS
 * preflights frequently reject, so a valid key still fails against gateways
 * such as the Vercel AI Gateway. ReAgent runs in the browser, so drop the
 * known non-standard ones before the request leaves the page.
 *
 * Audit (headers set by the provider SDKs / pi-ai):
 *   Anthropic SDK  x-stainless-*, anthropic-dangerous-direct-browser-access,
 *                  anthropic-version, anthropic-beta, x-api-key
 *   OpenAI SDK     x-stainless-*, openai-*, x-api-key, api-key
 *   Google GenAI   x-goog-api-client, x-goog-api-key, x-goog-upload-*
 *   pi-ai          x-session-affinity, x-app
 *
 * Standard/safelisted headers (accept, content-type, authorization, x-api-key,
 * anthropic-version/-beta, openai-*, x-goog-api-key, and any host-configured
 * provider header such as `cf-aig-authorization`) are all preserved.
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

/**
 * The direct Anthropic API needs this opt-in header for browser CORS; gateways
 * reject it, so it is only kept for `api.anthropic.com`.
 */
const BROWSER_ACCESS_HEADER = 'anthropic-dangerous-direct-browser-access';

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
  keepBrowserAccess: boolean,
): HeadersInit | undefined {
  if (headers === undefined) {
    return undefined;
  }
  const next = new Headers(headers);
  for (const name of [...next.keys()]) {
    const lower = name.toLowerCase();
    if (
      STRIPPED_PREFIXES.some(prefix => lower.startsWith(prefix)) ||
      STRIPPED_HEADERS.has(lower) ||
      (lower === BROWSER_ACCESS_HEADER && !keepBrowserAccess)
    ) {
      next.delete(name);
    }
  }
  return next;
}

/** Wrap a fetch implementation so browser-hostile headers never reach the network. */
export function browserSafeFetch(base?: FetchFunction): FetchFunction {
  const impl = base ?? fetch;
  return (input, init) => {
    const keepBrowserAccess = hostOf(input) === 'api.anthropic.com';
    return impl(
      input,
      init === undefined
        ? init
        : { ...init, headers: sanitizeHeaders(init.headers, keepBrowserAccess) },
    );
  };
}
