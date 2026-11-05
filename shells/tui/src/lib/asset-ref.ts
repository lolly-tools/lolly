// SPDX-License-Identifier: MPL-2.0
/**
 * What a picture field's typed value or a CSV row's picture column becomes: a tool
 * link renders the linked tool, a file on this computer is read into a baked ref,
 * and anything else is a catalog asset id.
 *
 * A file is read only when its bytes are a picture, by the check the CLI uses
 * (`pictureFileMime`: the leading bytes, an SVG by its root element, at most the
 * first 64 KiB read before the decision). The file's name decides nothing, so a CSV
 * someone sent that puts `~/.aws/credentials` in a `logo` column cannot copy that
 * file into the exported picture: the import is refused with `NotAPictureError`.
 */
import { readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { isToolUrl } from '@lolly/engine';
import { bakedImageRef, pictureFileMime } from '../../../cli/src/block-files.ts';
import type { InputValue } from '../../../../engine/src/inputs.ts';

/** The parts of the host bridge a picture value is resolved through. */
export interface AssetRefHost {
  compose?: { renderUrl?: (url: string) => Promise<unknown> } | undefined;
  assets: { get: (id: string) => Promise<unknown> };
}

/** Expand a leading ~ to the home directory. */
export function expandHome(p: string): string {
  return p.startsWith('~') && (p.length === 1 || p[1] === '/') ? homedir() + p.slice(1) : p;
}

/** A file on this computer that a picture value points at, whose bytes are not a picture. */
export class NotAPictureError extends Error {
  override name = 'NotAPictureError';
  /** The value as typed, or as the CSV row gives the path. */
  readonly value: string;
  /** The blocks field it was in, for an import. */
  readonly fieldId: string | null;
  constructor(value: string, fieldId: string | null = null) {
    super(`${fieldId ? `${fieldId}: ` : ''}"${value}" is a file on this computer but not a picture Lolly recognises, so it was not read.`);
    this.value = value;
    this.fieldId = fieldId;
  }
}

/**
 * Resolve a raw asset id, lolly.tools URL or local path to the AssetRef the template
 * reads. setInput and setField do not resolve refs (only createRuntime does), so the
 * caller resolves first: a tool URL goes to compose.renderUrl, an existing file that
 * is a picture becomes a self-contained baked ref (as in the CLI), and anything else
 * is a catalog asset id through host.assets.get. Throws `NotAPictureError` for a file
 * that is not a picture, before more than its first bytes are read.
 */
export async function resolveAssetRef(raw: string, host: AssetRefHost): Promise<InputValue> {
  if (isToolUrl(raw)) {
    const ref = await host.compose?.renderUrl?.(raw);
    if (!ref) throw new Error('tool render unavailable in this shell');
    return ref as InputValue;
  }
  const abs = expandHome(raw);
  let isFile = false;
  try { isFile = (await stat(abs)).isFile(); } catch { /* not a local file: a catalog id */ }
  if (isFile) {
    const mime = await pictureFileMime(abs);
    if (mime === 'application/octet-stream') throw new NotAPictureError(raw);
    const bytes = new Uint8Array(await readFile(abs));
    return await bakedImageRef(basename(abs), bytes, mime) as InputValue;
  }
  const ref = await host.assets.get(raw);
  if (!ref) throw new Error(`asset “${raw}” not found`);
  return ref as InputValue;
}

/**
 * Resolve the picture columns of imported rows in place. A relative path is tried
 * from the working directory, then beside the CSV (`csvDir`). A value that resolves
 * nowhere is left empty and counted; a file that is not a picture refuses the whole
 * import with `NotAPictureError`, so nothing of a CSV that points at one is imported.
 * Returns how many pictures were not found.
 */
export async function resolveRowPictures(
  rows: Record<string, unknown>[],
  assetFields: readonly string[],
  csvDir: string,
  host: AssetRefHost,
): Promise<number> {
  let unresolved = 0;
  for (const row of rows) {
    for (const fid of assetFields) {
      const raw = String(row[fid] ?? '').trim();
      if (!raw) { row[fid] = null; continue; }
      try {
        row[fid] = await resolveFrom([raw, join(csvDir, raw)], host);
      } catch (e) {
        if (e instanceof NotAPictureError) throw new NotAPictureError(raw, fid);
        row[fid] = null;
        unresolved++;
      }
    }
  }
  return unresolved;
}

/** The first of `candidates` that resolves; a file that is not a picture stops the search. */
async function resolveFrom(candidates: readonly string[], host: AssetRefHost): Promise<InputValue> {
  let last: unknown;
  for (const c of candidates) {
    try { return await resolveAssetRef(c, host); } catch (e) {
      if (e instanceof NotAPictureError) throw e;
      last = e;
    }
  }
  throw last;
}
