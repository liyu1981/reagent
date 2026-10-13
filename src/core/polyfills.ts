/**
 * Browser polyfills for `AbortSignal` helpers that some mobile browsers still
 * lack. `pi-ai` uses `AbortSignal.any()` while refreshing provider model lists
 * and streaming, so on older Android Chrome/WebView the settings screen throws
 * "AbortSignal.any is not a function". Installing these shims here (this module
 * is imported first by the package entry) keeps those devices working.
 *
 * The shims are only defined when the native implementation is missing.
 */

interface AbortSignalStatics {
  any?: (signals: AbortSignal[]) => AbortSignal;
  timeout?: (milliseconds: number) => AbortSignal;
  abort?: (reason?: unknown) => AbortSignal;
}

function installAbortSignalPolyfills(): void {
  if (typeof AbortSignal === 'undefined' || typeof AbortController === 'undefined') {
    return;
  }

  const Signal = AbortSignal as typeof AbortSignal & AbortSignalStatics;

  if (typeof Signal.any !== 'function') {
    Signal.any = (signals: AbortSignal[]): AbortSignal => {
      const controller = new AbortController();
      const aborted = signals.find(signal => signal.aborted);
      if (aborted !== undefined) {
        controller.abort(aborted.reason);
        return controller.signal;
      }

      const onAbort = (event: Event): void => {
        controller.abort((event.target as AbortSignal).reason);
      };
      controller.signal.addEventListener(
        'abort',
        () => {
          for (const signal of signals) {
            signal.removeEventListener('abort', onAbort);
          }
        },
        { once: true },
      );
      for (const signal of signals) {
        signal.addEventListener('abort', onAbort, { once: true });
      }
      return controller.signal;
    };
  }

  if (typeof Signal.timeout !== 'function') {
    Signal.timeout = (milliseconds: number): AbortSignal => {
      const controller = new AbortController();
      setTimeout(() => {
        controller.abort(new DOMException('TimeoutError', 'TimeoutError'));
      }, milliseconds);
      return controller.signal;
    };
  }

  if (typeof Signal.abort !== 'function') {
    Signal.abort = (reason?: unknown): AbortSignal => {
      const controller = new AbortController();
      controller.abort(reason);
      return controller.signal;
    };
  }
}

installAbortSignalPolyfills();
