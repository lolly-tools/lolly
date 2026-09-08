// SPDX-License-Identifier: MPL-2.0
/**
 * rtc-history - the P2P track's revision history, held in memory and nowhere else.
 *
 * The ephemeral invitee's guarantee (plan 221 section 9) is that nothing about a shared
 * session outlives it on this device: no IndexedDB row, no recovery journal, no
 * thumbnail cache, no app-activity entry. A plain in-process array satisfies that by
 * construction - this module never reaches for `host.state`, `openDB`, the network or
 * an object URL - and `dispose()` drops the log on leave so a remount begins empty.
 *
 * Like the Work adapter (`org/collab-history.ts`), this is a read/copy view: shared
 * restore over a live P2P document needs the negotiated barrier protocol (plan 221
 * section 9's `history-v1`), which is later work, so `canRestore` is false even for a host
 * writer whatever `collabHistoryPolicy` allows in principle. "Save a copy" is the only
 * path that turns a shared revision into durable local work, and it goes through the
 * caller's real persistent bridge deliberately - never through this store.
 */

import type { SavedStateData } from '../bridge/state.ts';
import { collabHistoryPolicy } from '../lib/collab-history.ts';
import type { CapturableCollabHistory, CollabHistoryCheckpoint, CollabHistoryEntry, CollabHistoryPage } from '../lib/collab-history.ts';

export interface P2PCollabHistory extends CapturableCollabHistory {
  /** Always offered on this track, so the contract's optional member is required here. */
  saveCopy(id: string): Promise<SavedStateData | null>;
}

export interface P2PHistoryOptions {
  readonly role: 'writer' | 'observer';
  /** True for the inviter, who owns the durable document (section 9); false for an invitee. */
  readonly host: boolean;
  /** Upper bound on retained checkpoints. Memory-only, so keep it modest. */
  readonly limit?: number;
}

const DEFAULT_LIMIT = 200;

export function createP2PCollabHistory(options: P2PHistoryOptions): P2PCollabHistory {
  const policy = collabHistoryPolicy({ track: 'p2p', role: options.role, host: options.host });
  const limit = Math.max(1, options.limit ?? DEFAULT_LIMIT);
  let disposed = false;
  let seq = 0;
  // Newest last; `list()` reverses. Each row carries its own frozen payload.
  const log: { readonly entry: CollabHistoryEntry; readonly data: SavedStateData }[] = [];

  return {
    scope: policy.scope,
    durability: policy.durability,
    canRestore: false,
    canSaveCopy: policy.canSaveCopy,

    capture(checkpoint: CollabHistoryCheckpoint): CollabHistoryEntry {
      const revision = ++seq;
      const entry: CollabHistoryEntry = {
        id: `p2p:${revision}`,
        documentId: checkpoint.documentId,
        toolId: checkpoint.toolId,
        label: checkpoint.label ?? `Revision ${revision}`,
        reason: 'checkpoint',
        actor: checkpoint.actorLabel ? { id: checkpoint.actorId, label: checkpoint.actorLabel } : { id: checkpoint.actorId },
        at: checkpoint.at ?? new Date().toISOString(),
        revision,
        preview: checkpoint.preview ?? null,
      };
      // A disposed session is over; still mint a stable id so a racing caller does not
      // reuse one, but never retain the payload. Nothing about this session persists.
      if (!disposed) {
        log.push({ entry, data: checkpoint.data });
        while (log.length > limit) log.shift();
      }
      return entry;
    },

    async list(query?: { before?: string; limit?: number }): Promise<CollabHistoryPage> {
      let rows = log.slice().reverse();
      if (query?.before) {
        const cut = rows.findIndex(row => row.entry.id === query.before);
        if (cut >= 0) rows = rows.slice(cut + 1);
      }
      const page = typeof query?.limit === 'number' ? rows.slice(0, Math.max(0, query.limit)) : rows;
      const before = page.length < rows.length ? page[page.length - 1]?.entry.id : undefined;
      return { entries: page.map(row => row.entry), before };
    },

    async read(id: string): Promise<SavedStateData | null> {
      return log.find(row => row.entry.id === id)?.data ?? null;
    },

    async saveCopy(id: string): Promise<SavedStateData | null> {
      return this.read(id);
    },

    dispose(): void {
      disposed = true;
      log.length = 0;
    },
  };
}
