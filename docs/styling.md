# Styling

ReAgent is built with [Tailwind CSS v4](https://tailwindcss.com). It ships two
things:

1. `styles.css` — a small stylesheet with design-token **fallbacks** and a few
   component classes (the frosted glass surface, thin scrollbars).
2. Utility class names inside the compiled components.

For Tailwind to emit the utilities ReAgent uses, it must scan the package:

```css
@import "tailwindcss";
@import "@liyu1981/reagent/styles.css";
@source "../node_modules/@liyu1981/reagent/dist";
```

## Design tokens

ReAgent reads the standard shadcn-style CSS variables. They are declared with
`:where()` so they have **zero specificity** — any theme you define wins.

`--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`,
`--popover-foreground`, `--primary`, `--primary-foreground`, `--secondary`,
`--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`,
`--accent-foreground`, `--destructive`, `--border`, `--input`, `--ring`,
`--radius`.

If your app already defines these (a typical shadcn/ui theme), ReAgent picks
them up automatically.

## Surfaces

`<ReAgent surface="…" />` selects the frame:

| Value | Look |
| ----- | ---- |
| `glass` (default) | Frosted, translucent panel (`backdrop-filter`). |
| `solid` | Flat near-white (light) / near-black (dark) plane. |

Under the hood `solid` flattens every nested `.glass-control-opaque` to a single
plane.

## Component classes

The stylesheet exposes a couple of opt-in classes you can reuse:

- `.glass-control-opaque` — the frosted panel background.
- `.thin-scrollbar` — an 8px themed scrollbar.

## Without Tailwind

Tailwind is a build-time requirement for the shipped components, but the
*headless* core has no styling at all. If you want to avoid Tailwind, build your
own UI on top of `ReAgentProvider` and the hooks — none of ReAgent's layout
parts are required, and you can render messages however you like. See
[Headless](./headless).

Next: [Theming](./theming) →
