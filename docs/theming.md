# Theming

## Dark mode

ReAgent's fallback tokens define both light and dark values. Dark mode is
activated by a `.dark` class on an ancestor, or by defining your own dark
tokens:

```css
:root {
  --background: oklch(0.98 0 0);
  --foreground: oklch(0.2 0 0);
  /* … */
}

.dark {
  --background: oklch(0.16 0 0);
  --foreground: oklch(0.96 0 0);
  /* … */
}
```

Tailwind v4's `dark:` variant is media-based by default. To use a class, opt in
once in your stylesheet (this is what the demo does):

```css
@custom-variant dark (&:where(.dark, .dark *));
```

Then flip the class from your app:

```tsx
document.documentElement.classList.toggle('dark', isDark);
```

## The `theme` prop

`theme` (`'light' | 'dark'`) is **not** the CSS theme. It is the theme passed to
your `renderMarkdown` component and to a few built-in renderers so they can pick
appropriate code/syntax colors. Set it to match your CSS theme:

```tsx
<ReAgent theme={isDark ? 'dark' : 'light'} />
```

## Language

`language` is a BCP-47-ish tag (e.g. `'en'`, `'zh-CN'`). It selects the default
copy where translations exist and tells the model which language to answer in
(via the `{{language}}` placeholder in the system prompt).

```tsx
<ReAgent language="zh-CN" />
```

## Copy & i18n

Every visible string has a stable `agent.*` key with an English default. Override
any subset with `messages`, or supply a full `translate` function:

```tsx
<ReAgent
  messages={{
    'agent.chatPlaceholder': 'Ask the assistant…',
    'agent.newChat': 'New',
  }}
/>
```

```tsx
import type { ReAgentTranslate } from '@liyu1981/reagent';

const t: ReAgentTranslate = (key, vars) => myI18n.t(key, vars);

<ReAgent translate={t} />;
```

The same translator is available to nested components through
`useTranslation()` (from `@liyu1981/reagent`).

Next: [Components & props](./components) →
