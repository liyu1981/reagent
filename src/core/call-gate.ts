import type { ReactNode } from 'react';

import type { AgentModelRef, AgentSession } from './types';

/**
 * Host hooks that run **before each agent call** — i.e. each time the user's
 * message is about to be sent to the model. A gate is the place to refresh a
 * proxy session, re-confirm auth, or open a payment prompt: it may await the
 * user's answer and its own UI, and the call only proceeds if it allows it.
 * Nothing is appended to the conversation while a gate runs or when it blocks.
 */

export interface ReAgentCallContext {
  /** Session the call would run in; `null` when it would start a new one. */
  session: AgentSession | null;
  /** Model the call would use, when one is selected. */
  model: AgentModelRef | null;
  /** Prompt text that would be sent (selection wrapper already applied). */
  prompt: string;
  attachmentCount: number;
}

/** Why a call was stopped, plus the host UI that can resolve it. */
export interface ReAgentCallBlock {
  /** Reason shown under the default "call stopped" line. */
  message?: string;
  /**
   * Optional host UI (sign-in button, retry, …) rendered in the transcript.
   * It runs inside the provider, so `useReAgent().send()` retries the call.
   */
  ui?: ReactNode;
}

/**
 * Return `undefined`/`true`/`{ ok: true }` to let the call through, or
 * `false`/`{ ok: false, message?, ui? }` to stop it. Throwing also stops the
 * call and shows the error message.
 */
export type ReAgentCallDecision =
  | boolean
  | void
  | { ok: true }
  | { ok: false; message?: string; ui?: ReactNode };

export type ReAgentCallGate = (
  context: ReAgentCallContext,
) => ReAgentCallDecision | Promise<ReAgentCallDecision>;

/** Run a gate and normalize its answer: `null` means "let the call through". */
export async function resolveCallGate(
  gate: ReAgentCallGate,
  context: ReAgentCallContext,
): Promise<ReAgentCallBlock | null> {
  let decision: ReAgentCallDecision;
  try {
    decision = await gate(context);
  } catch (err) {
    return { message: err instanceof Error ? err.message : String(err) };
  }
  if (decision === undefined || decision === null || decision === true) {
    return null;
  }
  if (decision === false) {
    return {};
  }
  return decision.ok ? null : { message: decision.message, ui: decision.ui };
}
