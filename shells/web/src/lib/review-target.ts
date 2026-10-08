// SPDX-License-Identifier: MPL-2.0
/**
 * The thread a link or notification asked this tab to open, held per session until the
 * comments panel for that session takes the target. In memory only: no storage, no requests.
 * A target expires after {@link REVIEW_TARGET_TTL_MS}, so a stale link cannot jump a
 * document opened much later; whoever sets it again (for example after an access
 * approval) starts a fresh window.
 */
import { interactionKey } from '@lolly-tools/core/canvas-interaction-v1';
import { commentId } from '@lolly-tools/core/canvas-review-v1';

export const REVIEW_TARGET_TTL_MS = 120_000;

type Listener = (sessionId: string, threadId: string) => void;
const targets = new Map<string, { threadId: string; expires: number }>();
const listeners = new Set<Listener>();

function prune(now: number): void {
  for (const [id, target] of targets) if (target.expires <= now) targets.delete(id);
}

/**
 * Hold `threadId` as the review target of `sessionId` and tell listeners. Returns false,
 * holding nothing, when either id is not valid (thread ids follow the core `commentId` rule).
 */
export function setReviewTarget(sessionId: string, threadId: string): boolean {
  if (!interactionKey(sessionId) || !commentId(threadId)) return false;
  const now = Date.now();
  prune(now);
  targets.set(sessionId, { threadId, expires: now + REVIEW_TARGET_TTL_MS });
  for (const fn of [...listeners]) {
    try { fn(sessionId, threadId); } catch { /* one listener never stops the others */ }
  }
  return true;
}

/** The unexpired target of `sessionId`, removed as it is taken; undefined when none. */
export function takeReviewTarget(sessionId: string): string | undefined {
  const target = targets.get(sessionId);
  if (!target) return undefined;
  targets.delete(sessionId);
  return target.expires > Date.now() ? target.threadId : undefined;
}

/**
 * Called for every target set from now on. A listener that acts on the target takes it
 * with {@link takeReviewTarget}, so it is not acted on again later.
 */
export function onReviewTarget(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
