// SPDX-License-Identifier: MPL-2.0
/** Optional history supplied by a collaboration transport. */

import type { SavedStateData } from '../bridge/state.ts';

export type CollabHistoryScope = 'shared' | 'memory';
export type CollabHistoryDurability = 'durable' | 'session';

/**
 * The negotiated P2P shared-history capability (plan 221 section 9). A peer that announces
 * the SAME value in the connection hello can exchange shared revisions; a peer that
 * announces nothing (an older client) or a value this build does not recognise leaves
 * shared history and shared restore disabled, while ordinary editing and each side's
 * own memory-only session history continue unchanged. Additive and version-pinned: a
 * `history-v2` would be a new string, and a `history-v1` peer would read it as absent.
 */
export const HISTORY_PROTOCOL_VERSION = 'history-v1';

/** True when this build can exchange shared history with a peer that announced `peer`. */
export function historySharingAgreed(peer: string | undefined): boolean {
  return peer === HISTORY_PROTOCOL_VERSION;
}

export interface CollabHistoryEntry {
  readonly id: string;
  readonly documentId: string;
  readonly parentId?: string;
  readonly toolId: string;
  readonly label: string;
  readonly reason: 'checkpoint' | 'save' | 'recovery';
  readonly actor: { readonly id: string; readonly label?: string };
  readonly at: string;
  readonly revision: number;
  readonly preview?: string | null;
}

export interface CollabHistoryPage {
  readonly entries: readonly CollabHistoryEntry[];
  readonly before?: string;
}

export interface CollabHistoryCapability {
  readonly scope: CollabHistoryScope;
  readonly durability: CollabHistoryDurability;
  readonly canRestore: boolean;
  readonly canSaveCopy: boolean;
  list(options?: { before?: string; limit?: number }): Promise<CollabHistoryPage>;
  read(id: string): Promise<SavedStateData | null>;
  restore?(id: string): Promise<void>;
  saveCopy?(id: string): Promise<SavedStateData | null>;
}

/** A checkpoint a client mints itself and hands to a {@link CapturableCollabHistory}. */
export interface CollabHistoryCheckpoint {
  readonly documentId: string;
  readonly toolId: string;
  readonly label?: string;
  /** The self-reported peer identity; not independently verified on the P2P track. */
  readonly actorId: string;
  readonly actorLabel?: string;
  readonly at?: string;
  readonly data: SavedStateData;
  readonly preview?: string | null;
}

/**
 * A history the client fills from its own converged snapshots (the memory-only P2P
 * track), as opposed to one a server drives (Work, which accepts no client capture).
 * `capture` is memory-only by contract, and `dispose` is the ephemerality guarantee:
 * a session that has left drops its log. Restore stays gated on the base contract.
 */
export interface CapturableCollabHistory extends CollabHistoryCapability {
  capture(checkpoint: CollabHistoryCheckpoint): CollabHistoryEntry;
  dispose(): void;
}

/** True for a history the client feeds itself (P2P memory), false for a server-driven
 *  one (Work). The tool layer routes its edit signal into capture only when true. */
export function isCapturableCollabHistory(
  history: CollabHistoryCapability | undefined,
): history is CapturableCollabHistory {
  return !!history && typeof (history as Partial<CapturableCollabHistory>).capture === 'function';
}

/** Shared policy for Work and P2P transports. */
export function collabHistoryPolicy(input: {
  track: 'work' | 'p2p';
  role: 'writer' | 'observer';
  host: boolean;
}): Pick<CollabHistoryCapability, 'scope' | 'durability' | 'canRestore' | 'canSaveCopy'> {
  if (input.track === 'work') {
    return { scope: 'shared', durability: 'durable', canRestore: input.role === 'writer', canSaveCopy: true };
  }
  return {
    scope: input.host ? 'shared' : 'memory',
    durability: 'session',
    canRestore: input.host && input.role === 'writer',
    canSaveCopy: true,
  };
}
