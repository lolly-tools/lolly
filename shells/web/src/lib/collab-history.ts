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
  /** `named` is a version someone saved with a name; `restore` is the result of a restore. */
  readonly reason: 'checkpoint' | 'save' | 'recovery' | 'named' | 'restore';
  readonly actor: { readonly id: string; readonly label?: string };
  readonly at: string;
  readonly revision: number;
  readonly preview?: string | null;
  /** Everyone who changed the document since the previous entry; labels never carry an email address. */
  readonly contributors?: readonly { readonly id: string; readonly label?: string }[];
}

/** What a restore reports: the entry that undoes it, and inputs it left as they were. */
export interface CollabHistoryRestoreResult {
  readonly undoId?: string;
  /** Inputs the live document could not take, left unchanged. */
  readonly skipped?: readonly string[];
  /** Inputs locked for the person restoring, left unchanged. */
  readonly vetoed?: readonly string[];
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
  /** Resolves with nothing (an older host) or with what the restore did; `Promise<void>` stays valid. */
  restore?(id: string): Promise<CollabHistoryRestoreResult | undefined> | Promise<void>;
  saveCopy?(id: string): Promise<SavedStateData | null>;
  /** Save the current document as a named version. */
  saveVersion?(label: string): Promise<void>;
  /** A preview image URL for one entry, or null when none can be made. */
  preview?(id: string): Promise<string | null>;
  /** Delete one saved version (managers only; the host refuses everyone else). */
  remove?(id: string): Promise<void>;
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
