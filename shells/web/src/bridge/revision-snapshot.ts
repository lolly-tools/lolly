// SPDX-License-Identifier: MPL-2.0
import { deflateSync, inflateSync } from 'fflate';
import { MAX_REVISION_EXPANDED, MAX_REVISION_SNAPSHOT } from './revision-limits.ts';
import type { SavedStateData } from './state.ts';
import { canonicalDocument, type RevisionCapture } from './revision-capture.ts';
import { t } from '../i18n.ts';
export { isRefetchableRemote } from './revision-capture.ts';

/** A checkpoint as `revision-payloads` keeps it: the snapshot's canonical JSON,
 * deflated. A saved document never holds bytes (canonicalRevisionData refuses
 * typed arrays), so a row carrying `deflated` bytes can only be one of these.
 * Rows written before compression hold the document itself and still read. */
export interface RevisionPayload {
  revisionPayload: 1;
  encoding: 'deflate-raw';
  /** Byte length of the canonical JSON once inflated. */
  size: number;
  deflated: Uint8Array;
}
export interface RevisionSnapshot { data: SavedStateData; hash: string; bytes: number }
export interface PackedRevisionSnapshot extends RevisionSnapshot {
  /** Bytes the payload occupies in storage: the deflated length. */
  stored: number;
  payload: RevisionPayload;
}

// Translated when thrown: these reach the editor's toasts and History.
const TOO_LARGE = (): string => t('This document is too large for automatic history. Save an editable .lolly file.');
const unreadable = (): never => { throw new Error(t('This saved version could not be read.')); };

export function isRevisionPayload(value: unknown): value is RevisionPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return row.revisionPayload === 1 && row.encoding === 'deflate-raw' && Number.isSafeInteger(row.size)
    && Object.prototype.toString.call(row.deflated) === '[object Uint8Array]';
}

/** Inflate a stored payload back into the document. The declared size bounds
 * the buffer, and a stream that inflates to a different length is refused. */
export function unpackRevision(payload: RevisionPayload): SavedStateData {
  if (payload.size < 2 || payload.size > MAX_REVISION_EXPANDED) unreadable();
  const json = inflateSync(payload.deflated, { out: new Uint8Array(payload.size + 1) });
  if (json.byteLength !== payload.size) unreadable();
  const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(json));
  if (!value || typeof value !== 'object' || Array.isArray(value)) unreadable();
  return value as SavedStateData;
}

/** Deterministic JSON, retaining row identity/order. Refuse transient bytes instead
 * of claiming a File, typed array, or temporary URL is a recoverable document.
 * A stored payload is inflated first, so callers compare documents, not bytes.
 * The walk itself is revision-capture.ts's, shared with the write path. */
export function canonicalRevisionData(input: SavedStateData | RevisionPayload): SavedStateData {
  return canonicalDocument(isRevisionPayload(input) ? unpackRevision(input) : input);
}

/** zlib's deflateBound: no deflate stream of `n` bytes is longer than this, so
 * JSON under it fits the budget without compressing it to find out. */
export function deflateBound(n: number): number {
  return n + (n >> 12) + (n >> 14) + (n >> 25) + 13;
}

/** The browser's own compressor streams the work in chunks; fflate covers a
 * webview without `deflate-raw`. Both write raw deflate, which fflate reads. */
async function deflate(json: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  if (typeof CompressionStream === 'function') {
    try {
      const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch { /* fall back to fflate below */ }
  }
  return deflateSync(json, { level: 6 });
}

// Recovery drafts measure a large document every few seconds and the next
// checkpoint usually stores the same content, so the last packing is reused.
let lastPacked: { hash: string; payload: RevisionPayload } | null = null;
async function pack(json: Uint8Array<ArrayBuffer>, hash: string): Promise<RevisionPayload> {
  if (lastPacked?.hash === hash) return lastPacked.payload;
  const payload: RevisionPayload = { revisionPayload: 1, encoding: 'deflate-raw', size: json.byteLength, deflated: await deflate(json) };
  lastPacked = { hash, payload };
  return payload;
}

type Frozen = { data: SavedStateData; json: Uint8Array<ArrayBuffer>; hash: string };
/** Hash a canonical document's JSON text: the one step every write shares. */
async function hashed(data: SavedStateData, text: string): Promise<Frozen> {
  const json = new TextEncoder().encode(text);
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', json)), b => b.toString(16).padStart(2, '0')).join('');
  return { data, json, hash };
}
// A flush hands one capture to both the draft and the checkpoint: it is hashed once.
const captured = new WeakMap<RevisionCapture, Promise<Frozen>>();
function hashCapture(capture: RevisionCapture): Promise<Frozen> {
  let frozen = captured.get(capture);
  if (!frozen) { frozen = hashed(capture.data, capture.json); captured.set(capture, frozen); }
  return frozen;
}
async function freeze(input: SavedStateData | RevisionPayload): Promise<Frozen> {
  const data = canonicalRevisionData(input);
  return hashed(data, JSON.stringify(data));
}
/** A new document is admitted when its JSON fits MAX_REVISION_EXPANDED and its
 * deflated JSON fits MAX_REVISION_SNAPSHOT. */
async function admitNew({ json, hash }: Frozen): Promise<void> {
  if (json.byteLength > MAX_REVISION_EXPANDED) throw new Error(TOO_LARGE());
  if (deflateBound(json.byteLength) > MAX_REVISION_SNAPSHOT && (await pack(json, hash)).deflated.byteLength > MAX_REVISION_SNAPSHOT) throw new Error(TOO_LARGE());
}

/** Canonical document, its hash and its JSON length, for writes and integrity
 * checks alike. `hash` and `bytes` describe the JSON, never the compressed form,
 * so checkpoints written before compression keep verifying. A new document is
 * admitted when its deflated JSON fits MAX_REVISION_SNAPSHOT; a stored payload
 * was admitted when it was written and is not measured again. */
export async function revisionSnapshot(input: SavedStateData | RevisionPayload): Promise<RevisionSnapshot> {
  const frozen = await freeze(input);
  if (!isRevisionPayload(input)) await admitNew(frozen);
  return { data: frozen.data, hash: frozen.hash, bytes: frozen.json.byteLength };
}

/** A recovery draft's snapshot from a capture, which is canonical already: the
 * document is hashed without being walked a second time. */
export async function captureSnapshot(capture: RevisionCapture): Promise<RevisionSnapshot> {
  const frozen = await hashCapture(capture);
  await admitNew(frozen);
  return { data: frozen.data, hash: frozen.hash, bytes: frozen.json.byteLength };
}

async function packFrozen({ data, json, hash }: Frozen): Promise<PackedRevisionSnapshot> {
  if (json.byteLength > MAX_REVISION_EXPANDED) throw new Error(TOO_LARGE());
  const payload = await pack(json, hash);
  if (payload.deflated.byteLength > MAX_REVISION_SNAPSHOT) throw new Error(TOO_LARGE());
  return { data, hash, bytes: json.byteLength, stored: payload.deflated.byteLength, payload };
}

/** The same snapshot plus the compressed payload a checkpoint stores. */
export async function packedRevisionSnapshot(input: SavedStateData): Promise<PackedRevisionSnapshot> {
  return packFrozen(await freeze(input));
}

/** A checkpoint's snapshot and payload from a capture, walked once. */
export async function packCapture(capture: RevisionCapture): Promise<PackedRevisionSnapshot> {
  return packFrozen(await hashCapture(capture));
}

/** Deflate a canonical document a restore already verified, so restored history
 * costs its deflated size (plan 277 P4 section 5). Not measured against
 * MAX_REVISION_SNAPSHOT: the checkpoint was admitted where it was written. */
export async function packCanonical(data: SavedStateData): Promise<{ payload: RevisionPayload; stored: number }> {
  const json = new TextEncoder().encode(JSON.stringify(data));
  const payload: RevisionPayload = { revisionPayload: 1, encoding: 'deflate-raw', size: json.byteLength, deflated: await deflate(json) };
  return { payload, stored: payload.deflated.byteLength };
}
