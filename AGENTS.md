# AGENTS.md

Context for agents working in the **ReAgent** repository: a composable React AI
agent published to npm as **`@liyu1981/reagent`**, plus the documentation/demo
site that ships with it.

## Package manager

- The repo is a **pnpm workspace** rooted here (`pnpm-workspace.yaml` lists
  `site`; the root package is the library). **Always use `pnpm`** — never `npm`,
  `yarn`, or `npx install` — for development. (The published package documents
  the `npm install` equivalent for users.)
- pnpm 12 settings (e.g. `allowBuilds`) live in `pnpm-workspace.yaml`, not
  `package.json`. `packageManager` is pinned in `package.json`.
- Common commands (run from the repo root):

  ```bash
  pnpm install              # install the whole workspace
  pnpm build                # tsc -p tsconfig.build.json -> dist/
  pnpm typecheck            # tsc -p tsconfig.json --noEmit
  pnpm format               # biome format --write src
  pnpm site:dev             # run the docs/demo site (Vite, binds 0.0.0.0)
  pnpm site:build           # build the library, then the site -> site/dist
  ```

- `pnpm-lock.yaml` is committed at the repo root; `package-lock.json` must not
  exist.

## Build

```bash
pnpm build          # the library: tsc -p tsconfig.build.json -> dist/
pnpm site:build     # pnpm build && pnpm --filter @liyu1981/reagent-site build
```

- The library is built with plain `tsc` (`tsconfig.build.json` extends
  `tsconfig.json` with `noEmit: false`, `declaration: true`, `outDir: dist`).
  `dist/` and `site/dist/` are build artifacts and are **gitignored — never edit
  them**; edit `src/` and `site/src/`.
- `pnpm site:build` builds the library first; the site imports the built
  `dist/`, not the source.
- `npm pack --dry-run` / `pnpm publish` runs the `prepublishOnly` hook, which
  rebuilds `dist/` before packing.

## Project layout

```
src/                    the library (published as @liyu1981/reagent)
  core/                 headless: config, models, mcp, session-store,
                        skill-registry, tools, prompt, agent, attachments,
                        messages, i18n, reagent-provider, hooks
  ui/                   ReAgent UI parts + the styled <ReAgent> preset
    settings/           in-component settings view (model/prompt/skills/
                        tools/mcp panels)
  primitives/           small Radix-based UI primitives (button, dialog, …)
  lib/utils.ts          cn() helper
  index.ts              the public barrel (only what is exported here is API)
styles.css              Tailwind entry + design tokens + glass classes
docs/                   documentation markdown (source of truth for the site)
site/                   Vite demo + documentation site (GitHub Pages)
  src/demos/            the two live demos (also shown as source via ?raw)
  src/pages/            Home, Demos, Docs
  src/components/       Layout, Markdown, CodeBlock, AgentPlayground, icons
  src/docs.ts           imports docs/*.md with ?raw and structures them
.github/workflows/      deploy-pages.yml (build library + site -> Pages)
```

## Library architecture

- **`core/` is headless.** `reagent-provider.tsx` owns the agent runtime and
  React state; `hooks.ts` exposes `useReAgent`, `useReAgentConfig`,
  `useReAgentSession`, `useReAgentSessions`, `useReAgentRegistry`.
  `ui/` parts call `useReAgent()` and must render inside a `ReAgentProvider`
  (the `<ReAgent>` preset already does).
- **Config** is one versioned `AgentConfig` snapshot in `localStorage`
  (`agent.config`), read through a tiny external store
  (`getAgentConfig`/`updateAgentConfig`/`subscribeAgentConfig`). Legacy
  per-feature keys are migrated once at load. API keys are per-provider in
  `localStorage`; sessions are in IndexedDB (`reagent-agent`, v2).
- **Providers** come from `pi-ai`: `openai`, `anthropic`, `openrouter`,
  `deepseek`, `groq`, plus an OpenAI-compatible `ollama` entry. Only providers
  whose connection was verified with `testConnection()` contribute models to
  `listAvailableModels()`; `models.ts` has a small external store
  (`subscribeModels`/`getModelsVersion`) so the UI recomputes when the registry
  is rebuilt or refreshed.
- **Defaults are intentionally empty.** A bare `<ReAgent />` has **no tools, no
  skills and no MCP servers**, and a generic system prompt:
  - `tools.ts` — `EDITOR_TOOLS` are built *and listed* only when an
    `EditorMutationBridge` is supplied; `SKILL_TOOL_DESCRIPTOR` (`use_skill`) is
    added only when at least one skill is enabled. `extraDescriptors` /
    `extraTools` are host additions.
  - `skill-registry.ts` — `BUILTIN_SKILLS` is empty; skills are host-defined via
    `updateAgentConfig({ skills })` or the user's Settings → Skills.
  - `config.ts` — `DEFAULT_MCP_SERVERS` is empty; MCP is opt-in via
    `saveMcpServers` / the settings UI. Exa is just one server a host may add.
  - `prompt.ts` — `EDITOR_GUARDRAIL` is only appended when an editor/draft is
    present.
- **Sessions** are a fork tree: `AgentSession.parentId` + `forkFromIndex`,
  rendered by `ReAgentSessionsView`. Deleting a session reparents its children.
- The agent's `streamFn` resolves `getModels()` lazily at call time
  (`core/agent.ts`), so a rebuilt registry (e.g. after changing the Ollama base
  URL) is picked up without rebuilding the agent.

## Host integration

Everything app-specific is optional and lives on `<ReAgent>` /
`<ReAgentProvider>`: `renderMarkdown`, `uploadFile`, `notify`,
`messages`/`translate`, `extraTools`, `extraDescriptors`, `draft`, `editor`,
`selection`, `theme`, `language`, `surface`. See `docs/host-integrations.md`.
`EditorMutationBridge` is the seam for hosts that let the agent edit an open
document; without it there is no editor UI and no editor tools.

## Styling

- Tailwind CSS **v4**. Consumers import, after Tailwind:

  ```css
  @import "@liyu1981/reagent/styles.css";
  @source "../node_modules/@liyu1981/reagent/dist";
  ```

- `styles.css` defines the tokens (`--background`, `--card`, `--border`, …) as
  low-specificity `:where()` fallbacks **and** registers them as Tailwind theme
  colors via `@theme inline`, so `bg-background` / `text-muted-foreground` /
  `border-border` resolve even without a host theme. Hosts can override the
  tokens; the `inline` mapping keeps their values live.
- Surfaces: `surface="glass"` (default, frosted `.glass-control-opaque`) or
  `surface="solid"` (flat; flattens descendant glass via `[data-surface]`).
- Class-based dark mode uses `.dark`; the site opts in with
  `@custom-variant dark (&:where(.dark, .dark *))`.

## Docs & demo site

- `docs/*.md` is the source of truth. The site imports each file with `?raw` in
  `site/src/docs.ts` and renders it with `react-markdown` — **add a new doc to
  `DOCS` there** and it appears in the sidebar and prev/next nav. Stripping the
  leading `# H1` happens in `site/src/pages/Docs.tsx`.
- The site is a Vite + React 19 + `HashRouter` app (hash routing avoids GitHub
  Pages SPA 404s). `base` is `/reagent/` for builds.
- Two demos live in `site/src/demos/` (`VanillaDemo`, `BatteriesDemo`). The
  Demos page renders each live **and** shows its file verbatim via
  `import …tsx?raw`, so keep those files self-contained and readable. Demo
  switching applies config before mount and resets conversations on the next
  load (`site/src/lib/agent-storage.ts`).

## Publishing

- Package name `@liyu1981/reagent`; `exports` maps `.` → `dist/index.js`
  (+ types) and `./styles.css` → `styles.css`; `files` ships `dist`,
  `styles.css`, `README.md`, `LICENSE`.
- `prepublishOnly` builds; `publishConfig.access` is `public`. Publish with
  `pnpm publish --access public`.
- The docs/demo site deploys via `.github/workflows/deploy-pages.yml` on push to
  `main` (build library → build site → upload `site/dist`). GitHub Pages must be
  set to **Source: GitHub Actions**.

## Conventions

- **Commits are opt-in.** Do **not** run `git commit` (or `git push`) unless the
  user explicitly asks you to commit. When they do, commit only the requested
  change, then stop: do not chain additional commits, and do not commit any
  later edits unless asked again.
- **Never install or run a browser** (Chromium, Chrome, Playwright, Puppeteer,
  Firefox, …) in this environment — the system libraries are unavailable and
  must not be installed. There is no browser-based verification; rely on
  `pnpm typecheck`, `pnpm build`, `pnpm site:build`, curl/preview, and code
  inspection.
- **Biome is the formatter** for the library (`biome.json`, linter disabled).
  Its scope is `src/**/*.{ts,tsx}` only — it does **not** touch `styles.css`
  (Tailwind v4 syntax breaks its CSS parser) or the site. Run `pnpm format`
  after editing `src/`. Enforced style: semicolons, trailing commas, single
  quotes, 2-space indent, 100-col width.
- **TypeScript is strict.** `noUnusedLocals` / `noUnusedParameters` are on.
- The site is not covered by Biome; match the surrounding style and keep it
  type-checked (`site` runs `tsc --noEmit` as part of its build).
- `dist/` is the only thing npm consumers see — if it isn't exported from
  `src/index.ts`, it isn't public API.
- Do not add comments to code unless asked; keep doc comments where they already
  explain non-obvious behavior.
