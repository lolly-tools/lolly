// SPDX-License-Identifier: MPL-2.0
import { deflateSync, inflateSync } from 'fflate';
import { MAX_REVISION_EXPANDED, MAX_REVISION_SNAPSHOT } from './revision-limits.ts';
import type { SavedStateData } from './state.ts';

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

const TOO_LARGE = 'This document is too large for automatic history. Save an editable .lolly file.';
const unreadable = (): never => { throw new Error('This saved version could not be read.'); };

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
 * A stored payload is inflated first, so callers compare documents, not bytes. */
export function canonicalRevisionData(input: SavedStateData | RevisionPayload): SavedStateData {
  const data = isRevisionPayload(input) ? unpackRevision(input) : input;
  const seen = new Set<object>();
  const normalise = (value: unknown): unknown => {
    if (value === undefined) return undefined;
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      if (value.startsWith('blob:')) throw new Error('History needs a saved asset for this temporary file.');
      return value;
    }
    if (typeof value !== 'object' || seen.has(value)) throw new Error('This document contains a value history cannot save yet.');
    const proto = Object.getPrototypeOf(value);
    if (!Array.isArray(value) && proto !== Object.prototype && proto !== null) throw new Error('Save imported files to the library before keeping history.');
    seen.add(value);
    let result: unknown;
    if (Array.isArray(value)) result = value.map(item => normalise(item) ?? null);
    else {
      const record = value as Record<string, unknown>;
      const baked = !!record.meta && typeof record.meta === 'object' && (record.meta as Record<string, unknown>).baked === true;
      const durable = !baked && (record.source === 'library' || record.source === 'user') && typeof record.id === 'string';
      result = Object.fromEntries(Object.keys(record).sort().filter(key => !(durable && (key === 'url' || key === 'original')))
        .map(key => [key, normalise(record[key])]).filter(([, item]) => item !== undefined));
    }
    seen.delete(value);
    return result;
  };
  return normalise(data) as SavedStateData;
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

async function freeze(input: SavedStateData | RevisionPayload): Promise<{ data: SavedStateData; json: Uint8Array<ArrayBuffer>; hash: string }> {
  const data = canonicalRevisionData(input);
  const json = new TextEncoder().encode(JSON.stringify(data));
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', json)), b => b.toString(16).padStart(2, '0')).join('');
  return { data, json, hash };
}

/** Canonical document, its hash and its JSON length, for writes and integrity
 * checks alike. `hash` and `bytes` describe the JSON, never the compressed form,
 * so checkpoints written before compression keep verifying. A new document is
 * admitted when its deflated JSON fits MAX_REVISION_SNAPSHOT; a stored payload
 * was admitted when it was written and is not measured again. */
export async function revisionSnapshot(input: SavedStateData | RevisionPayload): Promise<RevisionSnapshot> {
  const { data, json, hash } = await freeze(input);
  if (!isRevisionPayload(input)) {
    if (json.byteLength > MAX_REVISION_EXPANDED) throw new Error(TOO_LARGE);
    if (deflateBound(json.byteLength) > MAX_REVISION_SNAPSHOT && (await pack(json, hash)).deflated.byteLength > MAX_REVISION_SNAPSHOT) throw new Error(TOO_LARGE);
  }
  return { data, hash, bytes: json.byteLength };
}

/** The same snapshot plus the compressed payload a checkpoint stores. */
export async function packedRevisionSnapshot(input: SavedStateData): Promise<PackedRevisionSnapshot> {
  const { data, json, hash } = await freeze(input);
  if (json.byteLength > MAX_REVISION_EXPANDED) throw new Error(TOO_LARGE);
  const payload = await pack(json, hash);
  if (payload.deflated.byteLength > MAX_REVISION_SNAPSHOT) throw new Error(TOO_LARGE);
  return { data, hash, bytes: json.byteLength, stored: payload.deflated.byteLength, payload };
}
