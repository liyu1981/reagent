# For coding agents

ReAgent publishes two machine-readable resources for AI coding agents, served
from the site root next to these docs:

- **[`llms.txt`](./llms.txt)** — a compact **guide index**. It states what
  ReAgent is and links to every documentation page plus the key source files,
  so an agent can fetch one small file to discover the rest. It follows the
  [llms.txt](https://llmstxt.org) convention.
- **[`skill.md`](./skill.md)** — a self-contained **integration skill**. It
  covers install, the Tailwind v4 setup, minimal usage, the common props, host
  integrations, headless composition, multi-agent storage and the usual
  pitfalls. Drop it into an agent's context (or a skills directory) and it can
  wire ReAgent into a React app end to end.

## URLs

| File | URL |
| ---- | --- |
| Guide index | `https://liyu1981.github.io/reagent/llms.txt` |
| Integration skill | `https://liyu1981.github.io/reagent/skill.md` |

Both are plain-text/markdown and are kept in sync with these documentation
pages.

## Suggested workflow

1. Fetch `llms.txt` to get the map of the docs.
2. Fetch `skill.md` and follow it for the actual integration.
3. Reach for the individual pages under **Guides** and **Reference** when the
   skill points you there (models, tools & skills, multiple agents, …).

The live component is also the fastest reference: the [Demos](/demos) page shows
each example running, with its full source beside it.
