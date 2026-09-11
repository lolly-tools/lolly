// SPDX-License-Identifier: MPL-2.0
/**
 * collab-session-source - the registry a TRANSPORT registers itself in, so that a
 * mounted tool can become a collab without the tool view knowing what a transport
 * is (plan 100 section 5).
 *
 * The exact sibling of `canvas-sync-provider.ts` (read its header first - this
 * mirrors it deliberately, down to the last-wins rule and the test-only clear), and
 * the two answer different questions. `canvas-sync-provider` hands over a
 * `CanvasSyncAdapter`: a convergence document, and nothing else. That is enough to
 * SYNC, which is what `collab-plumbing.ts` needs, and it is not enough to be IN a
 * collab: presence has a roster, a connection state, a chosen display name, a
 * palette slot and a leave frame, none of which an adapter carries. So a session
 * source hands over a whole {@link CollabSessionHandle} - the one thing
 * `createCollabSession` asks a transport for.
 *
 * ── WHY A FACTORY, NOT A HANDLE ───────────────────────────────────────────────
 *
 * A provider is registered once, for the app; a handle belongs to ONE mount. A
 * private collab is pinned to the session slot the ceremony was run from (section 6.2a),
 * and an org room is pinned to a document - so the registrant is asked, per mount,
 * whether THIS tool on THIS slot is part of a live collab, and answers `null` for
 * every mount that is not. Returning `null` is the normal case even when a
 * transport IS registered: a user in a collab on one session still opens other
 * tools single-player.
 *
 * ── INERTNESS IS THE CONTRACT ─────────────────────────────────────────────────
 *
 * Nothing in this repo registers a source (it ships no server, no socket, and no
 * ceremony transport - plans/99 section 1.1), so {@link acquireCollabSession} returns
 * `null` and every presence surface in `views/tool.ts` stays unbuilt. The dormant
 * path is deliberately *one function call, one truthiness test, and no allocation*
 * - which is why this takes positional arguments rather than the context OBJECT the
 * factory receives. A context literal built at the call site would be a per-mount
 * allocation charged to every single-player user forever, for a value nobody reads
 * (plan 100 section 11.14's solo-cost discipline). The object is built here, after we know
 * somebody is listening.
 *
 * A factory that throws is a transport failing to start, not a reason to fail the
 * mount: it is caught, logged, and read as "no collab", so a broken provider costs
 * the user their collab and never their tool.
 */

import type { CollabSessionHandle } from './collab-session.ts';

/** What the registrant is told about the mount it is being asked about. */
export interface CollabSessionContext {
  /** The tool being mounted (`tool.manifest.id`). */
  readonly toolId: string;
  /** The saved-session slot this mount resumed, or `null` for a fresh open. The
   *  private-collab ceremony pins a session to a slot, so this is the field that
   *  usually decides the answer. */
  readonly slot: string | null;
}

/** Register one of these to make a mount joinable. `null` = not a collab. */
export type CollabSessionFactory = (context: CollabSessionContext) => CollabSessionHandle | null;

let current: CollabSessionFactory | undefined;

/** Register the collab session source; returns an unregister fn (last-wins). */
export function registerCollabSessionSource(factory: CollabSessionFactory): () => void {
  current = factory;
  return () => { if (current === factory) current = undefined; };
}

/** The registered factory, or undefined when dormant (no transport). */
export function getCollabSessionSource(): CollabSessionFactory | undefined {
  return current;
}

/**
 * The handle for this mount, or `null`. THE call site is `views/tool.ts`'s presence
 * block; see this file's header for why the arguments are positional.
 */
export function acquireCollabSession(toolId: string, slot: string | null): CollabSessionHandle | null {
  const factory = current;
  // The whole cost of a single-player mount, and nothing is allocated to pay it.
  if (!factory) return null;
  try {
    return factory({ toolId, slot }) ?? null;
  } catch (e) {
    console.warn('[lolly:collab] session source failed', e);
    return null;
  }
}

/** TEST-ONLY: clear the registry back to its dormant default. */
export function _clearCollabSessionSourceForTests(): void {
  current = undefined;
}
