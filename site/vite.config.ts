import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// The library lives at the repo root; its version is the "current" version the
// site advertises in the header.
import { version as libraryVersion } from '../package.json';

// Project page on GitHub Pages is served from /reagent/.
// The dev server stays at the root for convenience.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/reagent/' : '/',
  define: {
    __APP_VERSION__: JSON.stringify(libraryVersion),
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  server: {
    // Listen on all interfaces so the dev server is reachable from other hosts.
    host: '0.0.0.0',
    fs: {
      // The docs markdown lives in ../docs and the built library in ../dist.
      allow: ['..'],
    },
  },
}));
