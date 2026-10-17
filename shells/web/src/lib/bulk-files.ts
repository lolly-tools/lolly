// SPDX-License-Identifier: MPL-2.0
/**
 * plans/147 M2 - "Bulk from files": run a file-transform tool over N picked files.
 *
 * The live runtime already turns ONE input file into output bytes through its
 * exportFile hook (the file in → file out path the Download button uses). This walks
 * a list of files through that same path - `runOne(i)` sets file i on the runtime and
 * returns its exportFile output - and gathers the results into zip-ready entries. A
 * file that throws is recorded in `failed` and skipped, never aborting the run, so one
 * unreadable image doesn't lose the other forty conversions.
 *
 * Deliberately engine-free: the caller passes the engine's storeZip in. That keeps
 * the loop (per-file error isolation + name de-duplication, the only non-trivial
 * logic) unit-testable without the engine, and leaves the one legal export container
 * change (the zip) on the shell side that owns delivery.
 *
 * zipBulkFiles streams (plan 203 R4): each output is framed as a ZIP member the
 * moment it is made and kept as a Blob, so a batch never holds every result's bytes
 * at once and the finished archive is never one more full-size buffer. The archive
 * has exactly the bytes storeZip writes for the same entries: each member comes
 * from storeZip itself, and only the member offsets and the end record are written
 * here. collectBulkFiles keeps the older shape, every entry in memory, for callers
 * that want the entries themselves.
 *
 * The loop is foreground by design: it drives the runtime mounted in the current tool
 * view, so it cannot be a navigate-away background job. Callers show inline progress.
 */
import { allocateFileName } from '@lolly-tools/core/file-v1';

/** One output of a tool's exportFile hook (see engine ExportFileResult). */
export interface BulkExportItem {
  bytes: Uint8Array | ArrayBuffer | ArrayLike<number>;
  filename?: string;
}

export interface BulkFilesResult {
  /** Zip-ready, collision-free entries (empty when every file failed). */
  entries: { name: string; bytes: Uint8Array }[];
  /** Names of the files that threw and were skipped. */
  failed: string[];
}

/** The engine's storeZip, as far as this module needs. */
export type StoreZip = (entries: { name: string; bytes: Uint8Array }[]) => Uint8Array;

export interface BulkZipResult {
  /** The archive, or null when every file failed. */
  blob: Blob | null;
  /** Outputs in the archive. */
  count: number;
  /** Names of the files that threw and were skipped. */
  failed: string[];
}

type Progress = (done: number, total: number, name: string) => void;

/** The loop both shapes share: each file's outputs go to `emit` under a collision-free name. */
async function runBulkFiles(
  files: readonly { name: string }[],
  runOne: (index: number) => Promise<BulkExportItem[]>,
  emit: (name: string, bytes: Uint8Array) => void,
  onProgress?: Progress,
): Promise<string[]> {
  const failed: string[] = [];
  const used = new Set<string>();
  for (let i = 0; i < files.length; i++) {
    onProgress?.(i, files.length, files[i]!.name);
    let outputs: { filename: string; bytes: Uint8Array }[];
    try {
      outputs = (await runOne(i)).map(it => ({ filename: it.filename || files[i]!.name, bytes: it.bytes instanceof Uint8Array ? it.bytes : new Uint8Array(it.bytes) }));
    } catch {
      failed.push(files[i]!.name);
      continue;
    }
    for (const out of outputs) emit(allocateFileName(out.filename, used), out.bytes);
  }
  onProgress?.(files.length, files.length, '');
  return failed;
}

export async function collectBulkFiles(
  files: readonly { name: string }[],
  runOne: (index: number) => Promise<BulkExportItem[]>,
  onProgress?: Progress,
): Promise<BulkFilesResult> {
  const entries: { name: string; bytes: Uint8Array }[] = [];
  const failed = await runBulkFiles(files, runOne, (name, bytes) => { entries.push({ name, bytes }); }, onProgress);
  return { entries, failed };
}

/**
 * A storeZip archive built a member at a time. Each member is framed by storeZip
 * on its own; this keeps its local record as a Blob and its central record, then
 * writes the offsets and the end record storeZip would have written for all of
 * them together.
 */
export class StoreZipStream {
  readonly #storeZip: StoreZip;
  readonly #locals: Blob[] = [];
  readonly #centrals: Uint8Array[] = [];
  readonly #names = new Set<string>();
  #offset = 0;
  #centralBytes = 0;
  constructor(storeZip: StoreZip) { this.#storeZip = storeZip; }
  get count(): number { return this.#centrals.length; }

  add(name: string, bytes: Uint8Array): void {
    if (this.#names.has(name)) throw new Error(`storeZip: duplicate entry name "${name}"`);
    if (this.#centrals.length >= 0xffff - 1) throw new Error('Too many archive members.');
    const one = this.#storeZip([{ name, bytes }]);
    const view = new DataView(one.buffer, one.byteOffset, one.byteLength);
    const end = one.byteLength - 22;
    const centralSize = view.getUint32(end + 12, true), centralOffset = view.getUint32(end + 16, true);
    if (view.getUint32(end, true) !== 0x06054b50 || view.getUint16(end + 10, true) !== 1 || centralOffset + centralSize !== end) throw new Error('storeZip wrote an archive this stream cannot extend.');
    const central = one.slice(centralOffset, end);
    new DataView(central.buffer).setUint32(42, this.#offset, true);
    if (this.#offset + centralOffset + this.#centralBytes + centralSize + 22 > 0xffffffff) throw new Error('ZIP64 output is not supported.');
    // Only the framed member is kept, as a Blob; the source bytes can go.
    this.#locals.push(new Blob([one.subarray(0, centralOffset) as BlobPart]));
    this.#centrals.push(central);
    this.#names.add(name);
    this.#offset += centralOffset;
    this.#centralBytes += centralSize;
  }

  finish(type = 'application/zip'): Blob {
    const end = new Uint8Array(22), view = new DataView(end.buffer);
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(8, this.count, true);
    view.setUint16(10, this.count, true);
    view.setUint32(12, this.#centralBytes, true);
    view.setUint32(16, this.#offset, true);
    return new Blob([...this.#locals, ...this.#centrals, end] as BlobPart[], { type });
  }
}

/** Run the batch straight into a storeZip archive, one member at a time. */
export async function zipBulkFiles(
  files: readonly { name: string }[],
  runOne: (index: number) => Promise<BulkExportItem[]>,
  storeZip: StoreZip,
  onProgress?: Progress,
): Promise<BulkZipResult> {
  const zip = new StoreZipStream(storeZip);
  const failed = await runBulkFiles(files, runOne, (name, bytes) => zip.add(name, bytes), onProgress);
  return { blob: zip.count ? zip.finish() : null, count: zip.count, failed };
}
