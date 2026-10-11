// SPDX-License-Identifier: MPL-2.0
import { unzipAsync } from './zip.ts';
export const OFFICE_READ_ERROR = 'This document could not be read safely. Choose a valid Office file within the reading limits.';
export function comparisonXml(text: string): Document {
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error(OFFICE_READ_ERROR);
  const document = new DOMParser().parseFromString(text, 'application/xml');
  if (document.getElementsByTagName('parsererror').length) throw new Error(OFFICE_READ_ERROR);
  return document;
}
/** Existing readers receive validated parts; no oversized part is silently omitted. */
export async function comparisonOfficeParts(bytes: Uint8Array, signal?: AbortSignal): Promise<Record<string, Uint8Array>> {
  let entries = 0;
  const parts = await unzipAsync(bytes, { maxEntryBytes: 8 * 1024 * 1024, maxTotalBytes: 64 * 1024 * 1024, tooLarge: () => OFFICE_READ_ERROR,
    pick: name => ++entries <= 4096 && (/\.(xml|rels)$/i.test(name) || /vbaProject\.bin$/i.test(name)) });
  if (entries > 4096) throw new Error(OFFICE_READ_ERROR);
  const paths = new Set<string>();
  let checked = 0;
  for (const [path, bytes] of Object.entries(parts)) {
    if (++checked % 32 === 0) await new Promise<void>(resolve => setTimeout(resolve, 0));
    signal?.throwIfAborted(); const canonical = path.toLowerCase();
    if (paths.has(canonical) || /vbaProject\.bin$/i.test(path)) throw new Error(OFFICE_READ_ERROR); paths.add(canonical);
    comparisonXml(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  }
  return parts;
}
