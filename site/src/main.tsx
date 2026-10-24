import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { App } from './App';
import { consumeSessionReset } from './lib/agent-storage';
import './styles.css';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('#root not found');
}

const BASE_URL = import.meta.env.BASE_URL;
const BASENAME = BASE_URL === '/' ? '/' : BASE_URL.replace(/\/$/, '');

/** Convert bookmarks from the old hash router to real browser paths. */
function normalizeLegacyHash(): void {
  const hash = window.location.hash;
  if (hash === '') {
    return;
  }
  const base = BASE_URL.replace(/\/$/, '');
  if (hash === '#filesystem-tools') {
    window.history.replaceState(null, '', `${base}/docs/tools-and-skills#filesystem-tools`);
    return;
  }
  if (hash.startsWith('#/')) {
    window.history.replaceState(null, '', `${base}${hash.slice(1)}`);
  }
}

normalizeLegacyHash();

// A deploy replaces hashed chunks while a tab may still hold the old bundle, so
// a later dynamic import (e.g. a provider API) 404s. Reload once to pick up the
// new asset manifest; the timestamp guard prevents a reload loop if the asset
// is genuinely unavailable.
const CHUNK_RELOAD_KEY = 'reagent:chunk-reload';
window.addEventListener('vite:preloadError', event => {
  event.preventDefault();
  const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? '0');
  if (Date.now() - last < 10_000) {
    return;
  }
  sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  window.location.reload();
});

async function bootstrap(): Promise<void> {
  // Finish any pending demo reset before the agent mounts.
  await consumeSessionReset();

  createRoot(container as HTMLElement).render(
    <StrictMode>
      <BrowserRouter basename={BASENAME}>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
}

void bootstrap();
