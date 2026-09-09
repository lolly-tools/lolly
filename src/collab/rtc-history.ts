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
import { pinRevisionAssets } from '../bridge/revision-asset-pins.ts';
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
  /** UTF-8 snapshot and metadata budgets, independent of the entry count. */
  readonly maxBytes?: number;
  readonly maxEntryBytes?: number;
}

const DEFAULT_LIMIT = 200;
const MAX_BYTES = 16 * 1024 * 1024;
const MAX_ENTRY_BYTES = 4 * 1024 * 1024;
const bounded = (value: number | undefined, ceiling: number): number =>
  value !== undefined && Number.isFinite(value) ? Math.max(1, Math.min(ceiling, Math.floor(value))) : ceiling;

export function createP2PCollabHistory(options: P2PHistoryOptions): P2PCollabHistory {
  const policy = collabHistoryPolicy({ track: 'p2p', role: options.role, host: options.host });
  const limit = bounded(options.limit, DEFAULT_LIMIT);
  const maxBytes = bounded(options.maxBytes, MAX_BYTES);
  const maxEntryBytes = Math.min(maxBytes, bounded(options.maxEntryBytes, MAX_ENTRY_BYTES));
  let disposed = false;
  let seq = 0;
  let bytes = 0;
  // Newest last; `list()` reverses. Each row carries its own frozen payload.
  const log: { readonly entry: CollabHistoryEntry; readonly json: string; readonly bytes: number }[] = [];

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
      // Serialize once at the ownership boundary. Keeping caller-owned objects or
      // returning them from read/list lets a later edit rewrite an earlier point.
      if (!disposed) {
        const json = JSON.stringify(pinRevisionAssets(checkpoint.data));
        const size = new TextEncoder().encode(json).byteLength + new TextEncoder().encode(JSON.stringify(entry)).byteLength;
        if (size > maxEntryBytes) throw new Error('This checkpoint is too large for session history. Save an editable copy.');
        log.push({ entry, json, bytes: size });
        bytes += size;
        while (log.length > limit || bytes > maxBytes) bytes -= log.shift()!.bytes;
      }
      return structuredClone(entry);
    },

    async list(query?: { before?: string; limit?: number }): Promise<CollabHistoryPage> {
      let rows = log.slice().reverse();
      if (query?.before) {
        const revision = /^p2p:([1-9]\d*)$/.exec(query.before)?.[1];
        rows = revision ? rows.filter(row => row.entry.revision < Number(revision)) : [];
      }
      const page = rows.slice(0, bounded(query?.limit, DEFAULT_LIMIT));
      const before = page.length < rows.length ? page[page.length - 1]?.entry.id : undefined;
      return { entries: page.map(row => structuredClone(row.entry)), before };
    },

    async read(id: string): Promise<SavedStateData | null> {
      const row = log.find(row => row.entry.id === id);
      return row ? JSON.parse(row.json) as SavedStateData : null;
    },

    async saveCopy(id: string): Promise<SavedStateData | null> {
      return this.read(id);
    },

    dispose(): void {
      disposed = true;
      log.length = 0;
      bytes = 0;
    },
  };
}
