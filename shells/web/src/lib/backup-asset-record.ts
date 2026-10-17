// SPDX-License-Identifier: MPL-2.0
/** Binary fields travel as ZIP entries, never JSON-ified typed arrays. */
import { entrySink, type BundleEntry, type PartSink } from './bundle.ts';

function credentialBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) {
    if (value.byteLength > 16 * 1024 * 1024) throw new Error('Content Credentials in this backup are too large.');
    return value;
  }
  // v1 writers/importers left JSON.stringify(Uint8Array) objects in some stores.
  if (!value || typeof value !== 'object') throw new Error('Invalid legacy Content Credentials.');
  const keys = Object.keys(value);
  if (keys.length > 16 * 1024 * 1024 || keys.some((k, i) => k !== String(i))) throw new Error('Invalid legacy Content Credentials.');
  const values = Object.values(value);
  if (values.some(v => !Number.isInteger(v) || v < 0 || v > 255)) throw new Error('Invalid legacy Content Credentials.');
  return Uint8Array.from(values);
}

/** Write a record's bytes as stored parts and return its metadata. The blob goes
 * to the sink as a Blob, so a streamed archive reads it in chunks rather than
 * holding it (plan 203 R4); its bytes, and any Content Credentials, stay exact. */
export async function writeBackupAsset(record: Record<string, unknown>, prefix: string, sink: PartSink): Promise<Record<string, unknown>> {
  const { blob, credential, ...meta } = record;
  const result: Record<string, unknown> = { ...meta, _file: null, _mime: '' };
  if (blob instanceof Blob) {
    result._file = `${prefix}.bin`; result._mime = blob.type;
    await sink.blob(`${prefix}.bin`, blob);
  }
  if (credential != null) {
    result._credentialFile = `${prefix}.c2pa`;
    await sink.bytes(`${prefix}.c2pa`, credentialBytes(credential), true);
  }
  return result;
}

/** writeBackupAsset into an in-memory entry map. */
export function packBackupAsset(record: Record<string, unknown>, prefix: string, entries: Record<string, BundleEntry>): Promise<Record<string, unknown>> {
  return writeBackupAsset(record, prefix, entrySink(entries));
}

export function unpackBackupAsset(meta: Record<string, unknown>, files: Record<string, Uint8Array>, prefix: string): Record<string, unknown> {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) throw new Error('Invalid asset metadata in backup.');
  const { _file, _mime, _credentialFile, ...record } = meta;
  const part = (path: unknown): Uint8Array => {
    if (typeof path !== 'string' || !path.startsWith(prefix) || !Object.hasOwn(files, path)) throw new Error('An asset byte part is missing from this backup.');
    return files[path]!;
  };
  if (_file != null) record.blob = new Blob([part(_file) as BlobPart], { type: typeof _mime === 'string' ? _mime : 'application/octet-stream' });
  if (_credentialFile != null) {
    record.credential = credentialBytes(part(_credentialFile));
  } else if (record.credential != null) {
    record.credential = credentialBytes(record.credential);
  }
  return record;
}
