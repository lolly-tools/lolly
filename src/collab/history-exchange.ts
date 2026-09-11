// SPDX-License-Identifier: MPL-2.0
/**
 * history-exchange - the small request/response control frames of the negotiated
 * `history-v1` capability (plan 221 section 9). One peer asks another for the revisions it is
 * willing to share; the answer is bounded METADATA only - payloads and previews are
 * blobs the Beam transport moves separately (a later increment) and never ride these
 * frames.
 *
 * Everything here is pure: frames are plain JSON objects (they travel on the reliable
 * beam-json control path, off the live editing lane), `send` is injected, and every
 * inbound frame is treated as hostile until validated (section 11.21) - a malformed one
 * is dropped, never reflected or thrown. The exchange is gated twice:
 *   - on the handshake - `sharing()` false makes a request inert and answers a peer's
 *     request with a `not-shared` error; and
 *   - on disclosure - the default is the current state plus changes made during THIS
 *     collaboration (the 'session' range); earlier revisions ('all') need an explicit
 *     host grant (`allowEarlier`), or the answer is `forbidden` (plan 221 section 9).
 */

import { HISTORY_PROTOCOL_VERSION } from '../lib/collab-history.ts';
import { base64ToBytes as strictBase64ToBytes, bytesToBase64 } from '../lib/util/bytes.ts';
import type { CollabHistoryCapability, CollabHistoryEntry } from '../lib/collab-history.ts';
import { sriSha256 } from './beam-protocol.ts';
import type { SavedStateData } from '../bridge/state.ts';

export type HistoryRange = 'session' | 'all';
export type HistoryErrorCode = 'not-shared' | 'forbidden' | 'unsupported' | 'malformed';

/** Bounded revision metadata - a {@link CollabHistoryEntry} minus its preview blob. */
export type HistoryWireEntry = Omit<CollabHistoryEntry, 'preview'>;

export type HistoryFrame =
  | { readonly p: typeof HISTORY_PROTOCOL_VERSION; readonly t: 'list-req'; readonly id: string; readonly documentId: string; readonly range: HistoryRange }
  | { readonly p: typeof HISTORY_PROTOCOL_VERSION; readonly t: 'list-res'; readonly id: string; readonly entries: readonly HistoryWireEntry[]; readonly complete: boolean; readonly checksum: string }
  | { readonly p: typeof HISTORY_PROTOCOL_VERSION; readonly t: 'blob-req'; readonly id: string; readonly revisionId: string }
  | { readonly p: typeof HISTORY_PROTOCOL_VERSION; readonly t: 'blob-meta'; readonly id: string; readonly total: number; readonly hash: string; readonly chunks: number }
  | { readonly p: typeof HISTORY_PROTOCOL_VERSION; readonly t: 'blob-chunk'; readonly id: string; readonly seq: number; readonly data: string }
  | { readonly p: typeof HISTORY_PROTOCOL_VERSION; readonly t: 'blob-cancel'; readonly id: string }
  | { readonly p: typeof HISTORY_PROTOCOL_VERSION; readonly t: 'err'; readonly id: string; readonly code: HistoryErrorCode; readonly message?: string };

const MAX_ID = 128;
const MAX_TOOL = 64;
const MAX_LABEL = 200;
const MAX_ACTOR = 64;
const MAX_AT = 40;
const MAX_REQ_ID = 64;
const MAX_MSG = 200;
const MAX_ENTRIES = 500;
const MAX_HASH = 128;
/** One payload chunk before base64, "16 KiB-class" (plan 221 section 9). base64 of it stays
 *  well under the transport's 64 KiB frame ceiling, so a chunk is always one frame. */
const BLOB_CHUNK_BYTES = 16 * 1024;
/** A revision payload ceiling. Generous against plan section 5's ~40-150 KiB typical; a peer
 *  that claims more is refused rather than trusted to size a buffer. */
const MAX_BLOB_BYTES = 4 * 1024 * 1024;
const MAX_BLOB_CHUNKS = Math.ceil(MAX_BLOB_BYTES / BLOB_CHUNK_BYTES) + 1;
const MAX_B64_CHUNK = 24 * 1024;
const REASONS = new Set<CollabHistoryEntry['reason']>(['checkpoint', 'save', 'recovery']);
const CODES = new Set<HistoryErrorCode>(['not-shared', 'forbidden', 'unsupported', 'malformed']);

// Not `lib/util/guards.ts`'s isRecord: this one admits an array, which the entry
// decode below relies on.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
function str(value: unknown, max: number): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= max ? value : undefined;
}
function intInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

/** The strict decode, softened: a peer's malformed base64 is a `null` entry to
 *  skip, never a throw inside the exchange. */
function base64ToBytes(b64: string): Uint8Array | null {
  try { return strictBase64ToBytes(b64); } catch { return null; }
}

/** A stable, non-crypto content hash (FNV-1a, 32-bit hex) over the entries. Detects
 *  transport corruption of the metadata list; it is not, and is not treated as, proof
 *  of who authored it - inbound entries are validated field by field regardless. */
export function checksumEntries(entries: readonly HistoryWireEntry[]): string {
  const canonical = JSON.stringify(entries.map(e => [e.id, e.documentId, e.parentId ?? '', e.toolId, e.label, e.reason, e.actor.id, e.actor.label ?? '', e.at, e.revision]));
  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function parseEntry(value: unknown): HistoryWireEntry | null {
  if (!isRecord(value) || !isRecord(value.actor)) return null;
  const id = str(value.id, MAX_ID);
  const documentId = str(value.documentId, MAX_ID);
  const toolId = str(value.toolId, MAX_TOOL);
  const label = str(value.label, MAX_LABEL);
  const actorId = str(value.actor.id, MAX_ACTOR);
  const at = str(value.at, MAX_AT);
  const reason = value.reason as CollabHistoryEntry['reason'];
  if (!id || !documentId || !toolId || !label || !actorId || !at) return null;
  if (!REASONS.has(reason)) return null;
  if (typeof value.revision !== 'number' || !Number.isFinite(value.revision)) return null;
  const parentId = value.parentId === undefined ? undefined : str(value.parentId, MAX_ID);
  if (value.parentId !== undefined && !parentId) return null;
  const actorLabel = value.actor.label === undefined ? undefined : str(value.actor.label, MAX_ACTOR);
  if (value.actor.label !== undefined && !actorLabel) return null;
  return {
    id, documentId, toolId, label, reason, at, revision: value.revision,
    actor: actorLabel ? { id: actorId, label: actorLabel } : { id: actorId },
    ...(parentId ? { parentId } : {}),
  };
}

/** Shape-check an untrusted inbound value into a frame, or null to drop it. */
export function parseFrame(value: unknown): HistoryFrame | null {
  if (!isRecord(value) || value.p !== HISTORY_PROTOCOL_VERSION) return null;
  const id = str(value.id, MAX_REQ_ID);
  if (!id) return null;
  if (value.t === 'list-req') {
    const documentId = str(value.documentId, MAX_ID);
    if (!documentId) return null;
    if (value.range !== 'session' && value.range !== 'all') return null;
    return { p: HISTORY_PROTOCOL_VERSION, t: 'list-req', id, documentId, range: value.range };
  }
  if (value.t === 'list-res') {
    if (!Array.isArray(value.entries) || value.entries.length > MAX_ENTRIES) return null;
    if (typeof value.complete !== 'boolean') return null;
    const checksum = str(value.checksum, MAX_ID);
    if (!checksum) return null;
    const entries: HistoryWireEntry[] = [];
    for (const raw of value.entries) {
      const entry = parseEntry(raw);
      if (!entry) return null; // one bad row taints the page: refuse it whole.
      entries.push(entry);
    }
    return { p: HISTORY_PROTOCOL_VERSION, t: 'list-res', id, entries, complete: value.complete, checksum };
  }
  if (value.t === 'blob-req') {
    const revisionId = str(value.revisionId, MAX_ID);
    if (!revisionId) return null;
    return { p: HISTORY_PROTOCOL_VERSION, t: 'blob-req', id, revisionId };
  }
  if (value.t === 'blob-meta') {
    if (!intInRange(value.total, 0, MAX_BLOB_BYTES) || !intInRange(value.chunks, 0, MAX_BLOB_CHUNKS)) return null;
    const hash = str(value.hash, MAX_HASH);
    if (!hash) return null;
    return { p: HISTORY_PROTOCOL_VERSION, t: 'blob-meta', id, total: value.total, hash, chunks: value.chunks };
  }
  if (value.t === 'blob-chunk') {
    if (!intInRange(value.seq, 0, MAX_BLOB_CHUNKS - 1)) return null;
    const data = str(value.data, MAX_B64_CHUNK);
    if (!data) return null;
    return { p: HISTORY_PROTOCOL_VERSION, t: 'blob-chunk', id, seq: value.seq, data };
  }
  if (value.t === 'blob-cancel') {
    return { p: HISTORY_PROTOCOL_VERSION, t: 'blob-cancel', id };
  }
  if (value.t === 'err') {
    const code = value.code as HistoryErrorCode;
    if (!CODES.has(code)) return null;
    const message = value.message === undefined ? undefined : str(value.message, MAX_MSG);
    return { p: HISTORY_PROTOCOL_VERSION, t: 'err', id, code, ...(message ? { message } : {}) };
  }
  return null;
}

export type HistoryExchangeFailure = HistoryErrorCode | 'timeout' | 'disposed' | 'unavailable' | 'corrupt';

export class HistoryExchangeError extends Error {
  readonly code: HistoryExchangeFailure;
  constructor(code: HistoryExchangeFailure, message?: string) {
    super(message ?? code);
    this.name = 'HistoryExchangeError';
    this.code = code;
  }
}

export interface HistoryExchange {
  /** Ask the peer for the revisions it will share. Rejects if sharing is unavailable. */
  requestList(range?: HistoryRange): Promise<readonly HistoryWireEntry[]>;
  /** Fetch one revision's full payload, chunked and hash-verified. Rejects if sharing
   *  is unavailable, the peer withholds it, or the bytes fail their checksum. */
  requestPayload(revisionId: string): Promise<SavedStateData>;
  /** Feed one untrusted inbound value (a beam-json frame). Non-history frames are ignored. */
  handleFrame(value: unknown): void;
  /** Abandon every in-flight request and refuse new ones. Idempotent. */
  dispose(): void;
}

interface Pending {
  resolve(entries: readonly HistoryWireEntry[]): void;
  reject(error: HistoryExchangeError): void;
  timer: unknown;
}

interface BlobRequest {
  resolve(data: SavedStateData): void;
  reject(error: HistoryExchangeError): void;
  timer: unknown;
  meta?: { total: number; hash: string; chunks: number };
  received: Map<number, Uint8Array>;
  bytes: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;

export function createHistoryExchange(opts: {
  documentId: string;
  sharing(): boolean;
  send(frame: HistoryFrame): void;
  listShared(range: HistoryRange): Promise<readonly HistoryWireEntry[]>;
  /** Read one revision's payload for a peer, or null to withhold it (not disclosed /
   *  not found). Absent means this side answers no payload request. */
  readShared?(revisionId: string): Promise<SavedStateData | null>;
  allowEarlier?(): boolean;
  newId?(): string;
  timeoutMs?: number;
  setTimer?(fn: () => void, ms: number): unknown;
  clearTimer?(handle: unknown): void;
}): HistoryExchange {
  const newId = opts.newId ?? ((): string => crypto.randomUUID());
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const setTimer = opts.setTimer ?? ((fn, ms): unknown => setTimeout(fn, ms));
  const clearTimer = opts.clearTimer ?? ((handle): void => { clearTimeout(handle as ReturnType<typeof setTimeout>); });
  const pending = new Map<string, Pending>();
  const blobs = new Map<string, BlobRequest>();
  const outbound = new Map<string, { cancelled: boolean }>();
  let disposed = false;

  const err = (id: string, code: HistoryErrorCode, message?: string): void => {
    opts.send({ p: HISTORY_PROTOCOL_VERSION, t: 'err', id, code, ...(message ? { message } : {}) });
  };
  const settle = (id: string): Pending | undefined => {
    const entry = pending.get(id);
    if (entry) { clearTimer(entry.timer); pending.delete(id); }
    return entry;
  };
  const settleBlob = (id: string): BlobRequest | undefined => {
    const req = blobs.get(id);
    if (req) { clearTimer(req.timer); blobs.delete(id); }
    return req;
  };
  const failBlob = (id: string, code: HistoryExchangeFailure, message?: string): void => {
    const req = settleBlob(id);
    if (!req) return;
    // Tell the responder to stop, in case chunks are still coming.
    opts.send({ p: HISTORY_PROTOCOL_VERSION, t: 'blob-cancel', id });
    req.reject(new HistoryExchangeError(code, message));
  };

  const respondList = async (frame: Extract<HistoryFrame, { t: 'list-req' }>): Promise<void> => {
    if (!opts.sharing()) { err(frame.id, 'not-shared'); return; }
    if (frame.range === 'all' && opts.allowEarlier?.() !== true) { err(frame.id, 'forbidden', 'earlier revisions are not shared'); return; }
    let all: readonly HistoryWireEntry[];
    try { all = await opts.listShared(frame.range); } catch { err(frame.id, 'unsupported'); return; }
    if (disposed) return;
    const entries = all.slice(0, MAX_ENTRIES);
    opts.send({ p: HISTORY_PROTOCOL_VERSION, t: 'list-res', id: frame.id, entries, complete: entries.length === all.length, checksum: checksumEntries(entries) });
  };

  const respondBlob = async (frame: Extract<HistoryFrame, { t: 'blob-req' }>): Promise<void> => {
    if (!opts.sharing()) { err(frame.id, 'not-shared'); return; }
    if (!opts.readShared) { err(frame.id, 'unsupported'); return; }
    let data: SavedStateData | null;
    try { data = await opts.readShared(frame.revisionId); } catch { err(frame.id, 'unsupported'); return; }
    if (disposed) return;
    if (!data) { err(frame.id, 'forbidden', 'that revision is not shared'); return; }
    let bytes: Uint8Array; let hash: string;
    try {
      bytes = new TextEncoder().encode(JSON.stringify(data));
      if (bytes.length > MAX_BLOB_BYTES) { err(frame.id, 'unsupported', 'payload too large'); return; }
      hash = await sriSha256(bytes);
    } catch { err(frame.id, 'unsupported'); return; }
    if (disposed) return;
    const chunks = Math.ceil(bytes.length / BLOB_CHUNK_BYTES);
    const track = { cancelled: false };
    outbound.set(frame.id, track);
    opts.send({ p: HISTORY_PROTOCOL_VERSION, t: 'blob-meta', id: frame.id, total: bytes.length, hash, chunks });
    for (let seq = 0; seq < chunks; seq++) {
      if (disposed || track.cancelled) break;
      opts.send({ p: HISTORY_PROTOCOL_VERSION, t: 'blob-chunk', id: frame.id, seq, data: bytesToBase64(bytes.subarray(seq * BLOB_CHUNK_BYTES, (seq + 1) * BLOB_CHUNK_BYTES)) });
      // Yield between chunks so a large payload never blocks a live edit on this turn.
      if (seq + 1 < chunks) await Promise.resolve();
    }
    outbound.delete(frame.id);
  };

  const onBlobMeta = (frame: Extract<HistoryFrame, { t: 'blob-meta' }>): void => {
    const req = blobs.get(frame.id);
    if (!req) return;
    if (req.meta) { failBlob(frame.id, 'corrupt', 'duplicate blob-meta'); return; }
    req.meta = { total: frame.total, hash: frame.hash, chunks: frame.chunks };
    if (frame.chunks === 0 && frame.total === 0) void finalizeBlob(frame.id);
  };

  const onBlobChunk = (frame: Extract<HistoryFrame, { t: 'blob-chunk' }>): void => {
    const req = blobs.get(frame.id);
    if (!req?.meta) return; // a chunk with no meta, or an unknown id: dropped.
    if (frame.seq >= req.meta.chunks || req.received.has(frame.seq)) { failBlob(frame.id, 'corrupt', 'out-of-range or duplicate chunk'); return; }
    const bytes = base64ToBytes(frame.data);
    if (!bytes) { failBlob(frame.id, 'corrupt', 'undecodable chunk'); return; }
    req.bytes += bytes.length;
    if (req.bytes > req.meta.total) { failBlob(frame.id, 'corrupt', 'declared length overrun'); return; }
    req.received.set(frame.seq, bytes);
    if (req.received.size === req.meta.chunks) void finalizeBlob(frame.id);
  };

  async function finalizeBlob(id: string): Promise<void> {
    const req = blobs.get(id);
    if (!req?.meta) return;
    const { total, hash, chunks } = req.meta;
    const all = new Uint8Array(total);
    let offset = 0;
    for (let seq = 0; seq < chunks; seq++) {
      const part = req.received.get(seq);
      if (!part || offset + part.length > total) { failBlob(id, 'corrupt', 'assembly failed'); return; }
      all.set(part, offset); offset += part.length;
    }
    if (offset !== total) { failBlob(id, 'corrupt', 'declared length mismatch'); return; }
    let actual: string;
    try { actual = await sriSha256(all); } catch { failBlob(id, 'corrupt', 'could not hash the payload'); return; }
    if (disposed) return;
    if (actual !== hash) { failBlob(id, 'corrupt', 'the payload failed its checksum'); return; }
    let data: unknown;
    try { data = JSON.parse(new TextDecoder().decode(all)); } catch { failBlob(id, 'corrupt', 'unparseable payload'); return; }
    if (!isRecord(data)) { failBlob(id, 'corrupt', 'payload is not an object'); return; }
    // settleBlob after the awaits guards a late err/dispose that already claimed this id.
    settleBlob(id)?.resolve(data as SavedStateData);
  }

  return {
    requestList(range: HistoryRange = 'session'): Promise<readonly HistoryWireEntry[]> {
      if (disposed) return Promise.reject(new HistoryExchangeError('disposed'));
      if (!opts.sharing()) return Promise.reject(new HistoryExchangeError('unavailable', 'shared history is not available with this peer'));
      const id = newId();
      return new Promise<readonly HistoryWireEntry[]>((resolve, reject) => {
        const timer = setTimer(() => { settle(id); reject(new HistoryExchangeError('timeout')); }, timeoutMs);
        pending.set(id, { resolve, reject, timer });
        opts.send({ p: HISTORY_PROTOCOL_VERSION, t: 'list-req', id, documentId: opts.documentId, range });
      });
    },

    requestPayload(revisionId: string): Promise<SavedStateData> {
      if (disposed) return Promise.reject(new HistoryExchangeError('disposed'));
      if (!opts.sharing()) return Promise.reject(new HistoryExchangeError('unavailable', 'shared history is not available with this peer'));
      const id = newId();
      return new Promise<SavedStateData>((resolve, reject) => {
        const timer = setTimer(() => { failBlob(id, 'timeout'); }, timeoutMs);
        blobs.set(id, { resolve, reject, timer, received: new Map(), bytes: 0 });
        opts.send({ p: HISTORY_PROTOCOL_VERSION, t: 'blob-req', id, revisionId });
      });
    },

    handleFrame(value: unknown): void {
      if (disposed) return;
      const frame = parseFrame(value);
      if (!frame) return; // not ours, or malformed: dropped, never reflected.
      switch (frame.t) {
        case 'list-req': void respondList(frame); return;
        case 'blob-req': void respondBlob(frame); return;
        case 'blob-cancel': { const track = outbound.get(frame.id); if (track) track.cancelled = true; return; }
        case 'list-res': {
          const entry = settle(frame.id);
          if (!entry) return; // a stale or unknown id: no request waits on it.
          if (checksumEntries(frame.entries) !== frame.checksum) entry.reject(new HistoryExchangeError('corrupt', 'the revision list failed its checksum'));
          else entry.resolve(frame.entries);
          return;
        }
        case 'blob-meta': onBlobMeta(frame); return;
        case 'blob-chunk': onBlobChunk(frame); return;
        case 'err': {
          const entry = settle(frame.id);
          if (entry) { entry.reject(new HistoryExchangeError(frame.code, frame.message)); return; }
          settleBlob(frame.id)?.reject(new HistoryExchangeError(frame.code, frame.message));
          return;
        }
      }
    },

    dispose(): void {
      disposed = true;
      for (const [, entry] of pending) { clearTimer(entry.timer); entry.reject(new HistoryExchangeError('disposed')); }
      pending.clear();
      for (const [, req] of blobs) { clearTimer(req.timer); req.reject(new HistoryExchangeError('disposed')); }
      blobs.clear();
      for (const [, track] of outbound) track.cancelled = true;
      outbound.clear();
    },
  };
}

/** A revision's shareable metadata: the entry without its preview blob. */
export function toWireEntry(entry: CollabHistoryEntry): HistoryWireEntry {
  const { preview: _preview, ...rest } = entry;
  return rest;
}

export interface HistoryExchangeBinding {
  /** Ask the peer for the revisions it will share (metadata only). */
  requestList(range?: HistoryRange): Promise<readonly HistoryWireEntry[]>;
  /** Fetch one shared revision's full payload, hash-verified. */
  requestPayload(revisionId: string): Promise<SavedStateData>;
  dispose(): void;
}

/**
 * Bind an exchange to a transport's reliable beam-json control path. The exchange
 * discloses THIS side's memory history and answers a peer's requests; a request from
 * this side rides `sendJson`. History frames coexist with beam transfers on the same
 * lane - each is discriminated (`p:'history-v1'` vs the transfer's `{v,t,beamId}`) and
 * ignores the other - so `onJson` may hand over every beam-json value it sees.
 */
export function bindHistoryExchange(opts: {
  documentId: string;
  sharing(): boolean;
  allowEarlier?(): boolean;
  history: Pick<CollabHistoryCapability, 'list' | 'read'>;
  sendJson(frame: HistoryFrame): void;
  onJson(fn: (json: unknown) => void): () => void;
}): HistoryExchangeBinding {
  const exchange = createHistoryExchange({
    documentId: opts.documentId,
    sharing: opts.sharing,
    ...(opts.allowEarlier ? { allowEarlier: opts.allowEarlier } : {}),
    send: opts.sendJson,
    listShared: async () => (await opts.history.list()).entries.map(toWireEntry),
    readShared: id => opts.history.read(id),
  });
  const off = opts.onJson(json => { exchange.handleFrame(json); });
  return {
    requestList: range => exchange.requestList(range),
    requestPayload: id => exchange.requestPayload(id),
    dispose: () => { off(); exchange.dispose(); },
  };
}
