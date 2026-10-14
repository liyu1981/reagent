# Installation

## Install the package

```bash
# pnpm (default)
pnpm add @liyu1981/reagent

# npm
npm install @liyu1981/reagent
```

ReAgent has peer dependencies. Install them alongside it if your app does not
already use them:

```bash
# pnpm (default)
pnpm add @earendil-works/pi-agent-core @earendil-works/pi-ai react react-dom

# npm
npm install @earendil-works/pi-agent-core @earendil-works/pi-ai react react-dom
```

| Peer | Version |
| ---- | ------- |
| `@earendil-works/pi-agent-core` | `0.84.2` |
| `@earendil-works/pi-ai` | `0.84.2` |
| `react` | `^19.2.0` |
| `react-dom` | `^19.2.0` |

> ReAgent is a client-side package. Render it from a browser entry point (Vite,
> Next.js client component, etc.), not from a server component.

## Styles (Tailwind v4)

ReAgent's components are styled with Tailwind v4 utilities, so your app must use
Tailwind v4. In your global stylesheet, import Tailwind **first**, then
ReAgent's styles, and point `@source` at the built package so Tailwind
generates the utilities ReAgent uses:

```css
@import "tailwindcss";
@import "@liyu1981/reagent/styles.css";
@source "../node_modules/@liyu1981/reagent/dist";
```

The `@source` path is relative to the CSS file that contains it — adjust it if
your stylesheet lives elsewhere.

## TypeScript

No extra configuration is required; the package ships its own declarations:

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler", // or "node16" / "nodenext"
    "jsx": "react-jsx"
  }
}
```

Next: [Quick start](./quick-start) →
