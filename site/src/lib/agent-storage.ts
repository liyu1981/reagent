const SESSIONS_DB = 'reagent-agent';
const MODE_KEY = 'reagent-demo.mode';
const RESET_FLAG = 'reagent-demo.reset';

export type DemoMode = 'vanilla' | 'batteries' | 'filesystem' | 'webmcp' | 'host';

function deleteDatabase(name: string): Promise<void> {
  return new Promise(resolve => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

/** Wipe all agent localStorage keys and conversations, then reload. */
export async function clearAgentStorage(): Promise<void> {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('agent.')) {
      localStorage.removeItem(key);
    }
  }
  await deleteDatabase(SESSIONS_DB);
  window.location.reload();
}

/** The demo tab to show after a reload. */
export function readDemoMode(): DemoMode {
  const stored = localStorage.getItem(MODE_KEY);
  return stored === 'batteries' || stored === 'filesystem' || stored === 'webmcp' || stored === 'host'
    ? stored
    : 'vanilla';
}

export function writeDemoMode(mode: DemoMode): void {
  localStorage.setItem(MODE_KEY, mode);
}

/**
 * Ask the next page load to start from no conversations. The actual delete
 * happens before React mounts (see `main.tsx`), which avoids racing the
 * current provider's final session save during unmount.
 */
export function requestSessionReset(): void {
  sessionStorage.setItem(RESET_FLAG, '1');
}

/** Clear conversations once, if a reset was requested. */
export async function consumeSessionReset(): Promise<void> {
  if (sessionStorage.getItem(RESET_FLAG) !== '1') {
    return;
  }
  sessionStorage.removeItem(RESET_FLAG);
  await deleteDatabase(SESSIONS_DB);
}
