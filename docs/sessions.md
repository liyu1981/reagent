# Sessions & persistence

Conversations are first-class and form a **tree**: any session can be forked
from any message, producing a branch that stays linked to its origin.

## Storage

Sessions persist to `IndexedDB` (database `reagent-agent`, object store
`sessions`). No server is involved. The active session id and the last-used
model live in the `AgentConfig` in `localStorage`.

## Session shape

```ts
interface AgentSession {
  id: string;
  parentId: string | null;
  forkFromIndex: number | null;
  title: string;
  providerId: string;
  modelId: string;
  thinkingLevel: ThinkingLevel;
  systemPrompt: string;
  createdAt: number;
  updatedAt: number;
  messages: AgentMessage[];
}
```

## Store API

Use the store directly for custom UIs or background work:

```ts
import {
  listSessions,
  getSession,
  saveSession,
  deleteSession,
  buildSessionTree,
  forkSession,
  newSessionId,
} from '@liyu1981/reagent';

const sessions = await listSessions();
const tree = buildSessionTree(sessions); // AgentSessionNode[]
```

`deleteSession` reparents children to the deleted node's parent, so branches
survive their origin being removed.

## React hooks

Inside a `ReAgentProvider`:

```tsx
import { useReAgentSession, useReAgentSessions } from '@liyu1981/reagent';

function Toolbar() {
  const { session, messages } = useReAgentSession();
  const { tree, activeSession, create, fork, load, rename, remove } = useReAgentSessions();
  // …
}
```

The full context — streaming status, tool chips, attachments, view state — is
available from `useReAgent()`.

Next: [Headless usage](./headless) →
