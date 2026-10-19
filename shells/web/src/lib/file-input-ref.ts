// SPDX-License-Identifier: MPL-2.0
/**
 * The one read that turns a picked, dropped or handed-over File into the in-memory
 * FileRef a `file` input carries. Every door into a utility's file input uses it: the
 * sidebar picker, the canvas drop zone, a native "Open with" verb that already chose
 * the tool, and the bulk "files" run, so all of them produce the same model value. A
 * pick is a full read into memory, so each one is held to the same cap (the manifest's
 * `maxSize`, else the engine backstop) before a byte is read.
 */
import { DEFAULT_FILE_MAX_BYTES } from '@lolly/engine';
import type { InputFile } from '@lolly-tools/core/host-v1';

/** The most bytes a `file` input reads: its manifest `maxSize`, else the engine backstop. */
export function fileInputCap(input: { maxSize?: number } | null | undefined): number {
  return input?.maxSize ?? DEFAULT_FILE_MAX_BYTES;
}

/**
 * Read a File into the FileRef the input model carries (bytes + metadata). The bytes
 * live only in memory and are never uploaded; the url is a local object URL for
 * previews.
 */
export async function fileToRef(file: File): Promise<InputFile> {
  return {
    __file: true,
    name: file.name,
    mime: file.type || 'application/octet-stream',
    size: file.size,
    bytes: new Uint8Array(await file.arrayBuffer()),
    url: URL.createObjectURL(file),
  };
}

/** {@link fileToRef} behind the input's cap: null, with nothing read, when the file is larger. */
export async function cappedFileRef(file: File, input: { maxSize?: number } | null | undefined): Promise<InputFile | null> {
  return file.size > fileInputCap(input) ? null : fileToRef(file);
}
