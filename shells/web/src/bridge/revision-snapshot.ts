// SPDX-License-Identifier: MPL-2.0
import { MAX_REVISION_SNAPSHOT } from './revision-limits.ts';
import type { SavedStateData } from './state.ts';

/** Deterministic JSON, retaining row identity/order. Refuse transient bytes instead
 * of claiming a File, typed array, or temporary URL is a recoverable document. */
export function canonicalRevisionData(data: SavedStateData): SavedStateData {
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
      result = Object.fromEntries(Object.keys(record).sort().filter(key => !(durable && key === 'url'))
        .map(key => [key, normalise(record[key])]).filter(([, item]) => item !== undefined));
    }
    seen.delete(value);
    return result;
  };
  return normalise(data) as SavedStateData;
}

export async function revisionSnapshot(data: SavedStateData): Promise<{ data: SavedStateData; hash: string; bytes: number }> {
  const frozen = canonicalRevisionData(data);
  const bytes = new TextEncoder().encode(JSON.stringify(frozen));
  if (bytes.byteLength > MAX_REVISION_SNAPSHOT) throw new Error('This document is too large for automatic history. Save an editable .lolly file.');
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
  return { data: frozen, hash, bytes: bytes.byteLength };
}

