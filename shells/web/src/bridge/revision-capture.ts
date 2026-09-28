// SPDX-License-Identifier: MPL-2.0
/**
 * The one canonicalisation a history write makes (plan 277 P4 phase 1, phase 0
 * finding 3). Before this, a draft or checkpoint cloned the document, pinned its
 * uploads (which canonicalised the document once), then canonicalised it again
 * before hashing.
 * Here pinning, sorting and copying happen in a single walk, synchronously, so the
 * result is also the frozen copy the editor hands to the store, out of reach of
 * later edits.
 *
 * No fflate, no DOM: the editor's controller imports this on every edit.
 */
import type { SavedStateData } from './state.ts';
import { isToolUrl } from '../../../../engine/src/tool-url.ts';
import { t } from '../i18n.ts';

/** A document ready for history: canonical, pinned, and its JSON text. The
 * controller compares `json` with what it last wrote (the hash short-circuit)
 * and hands the whole capture to the store, which hashes it once. */
export interface RevisionCapture {
  readonly data: SavedStateData;
  readonly json: string;
}

// These reach the editor's toasts, so they are translated when thrown.
const TEMPORARY = (): string => t('History needs a saved asset for this temporary file.');
const UNSUPPORTED = (): string => t('This document contains a value history cannot save yet.');
const IMPORTED = (): string => t('Save imported files to the library before keeping history.');

/** A `source: 'remote'` asset reference whose id the runtime resolves again on
 * every open: a plain http(s) file, or a Lolly tool link it renders again. */
export function isRefetchableRemote(record: Record<string, unknown>): boolean {
  return record.source === 'remote' && typeof record.id === 'string' && (/^https?:\/\//i.test(record.id) || isToolUrl(record.id));
}
const holdsBlobUrl = (value: unknown): boolean => typeof value === 'string' ? value.startsWith('blob:')
  : !!value && typeof value === 'object' && typeof (value as { url?: unknown }).url === 'string' && (value as { url: string }).url.startsWith('blob:');

/** The version pin a new capture adds to a versioned upload, or undefined. */
function uploadPin(record: Record<string, unknown>): { format: string; version: string } | undefined {
  const { id, version, format } = record;
  if (record.source !== 'user' || typeof id !== 'string' || !id.startsWith('user/') || record.pin !== undefined) return undefined;
  if (typeof version !== 'string' || !version || typeof format !== 'string' || !format) return undefined;
  return { format, version };
}

/**
 * Deterministic JSON, retaining row identity and order. Refuses transient bytes
 * instead of claiming a File, typed array or temporary URL is a recoverable
 * document. With `pin`, a new capture also keeps an upload's version (the pin)
 * and a re-fetchable remote file or tool link by its id alone. The output is
 * byte-for-byte what canonicalising a pinned copy used to give, so hashes of
 * existing checkpoints still match.
 */
export function canonicalDocument(input: SavedStateData, pin = false): SavedStateData {
  const seen = new Set<object>();
  const normalise = (value: unknown): unknown => {
    if (value === undefined) return undefined;
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      if (value.startsWith('blob:')) throw new Error(TEMPORARY());
      return value;
    }
    if (typeof value !== 'object' || seen.has(value)) throw new Error(UNSUPPORTED());
    const isArray = Array.isArray(value);
    if (!isArray) {
      const proto: unknown = Object.getPrototypeOf(value);
      if (proto !== Object.prototype && proto !== null) throw new Error(IMPORTED());
    }
    seen.add(value);
    let result: unknown;
    if (isArray) {
      const list = value as unknown[];
      const out = new Array<unknown>(list.length);
      for (let i = 0; i < list.length; i++) {
        const item = normalise(list[i]);
        out[i] = item === undefined ? null : item;
      }
      result = out;
    } else {
      const record = value as Record<string, unknown>;
      const meta = record.meta;
      const baked = !!meta && typeof meta === 'object' && (meta as Record<string, unknown>).baked === true;
      const durable = !baked && (record.source === 'library' || record.source === 'user') && typeof record.id === 'string';
      // A remote reference whose id is fetched again on open keeps its id. Its
      // page-local blob: copy is dropped rather than refused (plan 277 P1, review
      // B2); a new capture drops any copy of the bytes.
      const refetchable = !baked && isRefetchableRemote(record);
      const added = pin ? uploadPin(record) : undefined;
      const keys = Object.keys(record);
      if (added) keys.push('pin');
      keys.sort();
      const out: Record<string, unknown> = {};
      for (const key of keys) {
        if ((key === 'url' || key === 'original') && (durable || (refetchable && (pin || holdsBlobUrl(record[key]))))) continue;
        const item = normalise(key === 'pin' && added ? added : record[key]);
        if (item === undefined) continue;
        // A key named __proto__ stays an own property, as Object.fromEntries made such a key.
        if (key === '__proto__') Object.defineProperty(out, key, { value: item, enumerable: true, writable: true, configurable: true });
        else out[key] = item;
      }
      result = out;
    }
    seen.delete(value);
    return result;
  };
  return normalise(input) as SavedStateData;
}

/** Freeze a document for history in one pass: pinned, canonical and serialised. */
export function captureRevision(data: SavedStateData): RevisionCapture {
  const canonical = canonicalDocument(data, true);
  return { data: canonical, json: JSON.stringify(canonical) };
}
