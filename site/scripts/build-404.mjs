import { copyFile } from 'node:fs/promises';

// GitHub Pages serves 404.html for unknown paths. Copy the built SPA shell so
// deep links such as /reagent/docs/tools-and-skills boot the app correctly.
await copyFile(new URL('../dist/index.html', import.meta.url), new URL('../dist/404.html', import.meta.url));
