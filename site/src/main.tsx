import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';

import { App } from './App';
import { consumeSessionReset } from './lib/agent-storage';
import './styles.css';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('#root not found');
}

async function bootstrap(): Promise<void> {
  // Finish any pending demo reset before the agent mounts.
  await consumeSessionReset();

  createRoot(container as HTMLElement).render(
    <StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </StrictMode>,
  );
}

void bootstrap();
