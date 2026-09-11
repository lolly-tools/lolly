// SPDX-License-Identifier: MPL-2.0
/** Explicit, byte-identical result reuse. Never goes through upload normalization,
 * never signs or rewrites a finished copy, never replaces an edited library asset. */
import type { AssetRef } from '@lolly-tools/core/host-v1';
import type { FileFactsV1, FileReferenceV1 } from '@lolly-tools/core/file-v1';
import type { FileOperationStore } from './file-operation-store.ts';
import { sha256Bytes } from './file-conversion.ts';

export interface FileResultLibraryHost {
  assets: {
    _getUserRecord(id: string): Promise<{ blob?: Blob; version?: string; checksum?: string } | null>;
    _uploadUserAsset(record: { id: string; type: AssetRef['type']; format: string; blob: Blob; version: string; checksum: string; width?: number; height?: number; meta: Record<string, unknown> }, options: { expectedVersion: null }): Promise<void>;
    get(id: string, options?: { version?: string }): Promise<AssetRef>;
  };
}
export function fileResultType(facts: FileFactsV1): AssetRef['type'] {
  if (/^image\/(png|jpeg|webp|avif|gif|bmp)$/.test(facts.mime)) return 'raster';
  if (/^audio\//.test(facts.mime)) return 'audio';
  if (/^video\//.test(facts.mime)) return 'video';
  if (/^(ttf|otf|woff|woff2)$/.test(facts.format)) return 'font';
  if (/^(txt|md|csv|tsv|json|xml|yaml|yml)$/.test(facts.format)) return 'text';
  // SVG/HTML/ZIP/PDF are opaque files here. An exact-byte handoff must not
  // promote unsanitized document markup into a trusted vector/interactive asset.
  return 'data';
}
export function canDesignWithFile(facts: FileFactsV1): boolean {
  return fileResultType(facts) === 'raster' && Number.isFinite(facts.width) && Number.isFinite(facts.height)
    && facts.width! > 0 && facts.height! > 0 && facts.width! <= 16384 && facts.height! <= 16384;
}
export function fileResultDesignSeed(ref: AssetRef, facts: FileFactsV1): Record<string, unknown> {
  if (!canDesignWithFile(facts)) throw new Error('This copy cannot be placed as a verified image.');
  return { __export_width: facts.width, __export_height: facts.height, __export_unit: 'px', boxes: [
    { id: 'file-artboard', kind: 'frame', x: 0, y: 0, w: facts.width, h: facts.height, rot: 0, bg: '#ffffff', name: facts.name, clipChildren: true },
    // Design's runtime resolves by id on mount; do not imply a version pin its
    // current URL/session path does not enforce. Dependency pinning is separate.
    { id: 'file-image', kind: 'image', frame: 'file-artboard', x: 0, y: 0, w: facts.width, h: facts.height, rot: 0, name: facts.name, image: { id: ref.id }, fit: 'contain' },
  ] };
}
export async function addFileResultToLibrary(store: Pick<FileOperationStore, 'list' | 'getOutput'>, operationId: string, host: FileResultLibraryHost): Promise<AssetRef> {
  const record = (await store.list()).find(r => r.id === operationId);
  const facts = record?.state === 'succeeded' ? record.report?.outputs[0] : undefined;
  if (!record || !facts?.sha256) throw new Error('This operation has no verified saved result.');
  const file = await store.getOutput(operationId);
  if (!file) throw new Error('The saved copy is missing. Retry with the original file.');
  const id = `user/file-result/${operationId}`;
  const existing = await host.assets._getUserRecord(id);
  if (existing) {
    if (!existing.version || !existing.blob || await sha256Bytes(new Uint8Array(await existing.blob.arrayBuffer())) !== facts.sha256) throw new Error('The library copy has been edited. Your edited asset was kept; download this result to keep another copy.');
    return host.assets.get(id, { version: existing.version });
  }
  const version = crypto.randomUUID();
  const reference: FileReferenceV1 = { id, version, role: 'output', facts,
    derivedFrom: { id: `file-source:${operationId}`, sha256: record.input.sha256 } };
  await host.assets._uploadUserAsset({ id, version, type: fileResultType(facts), format: facts.format, blob: file, checksum: facts.sha256,
    width: facts.width, height: facts.height, meta: { name: file.name, tags: ['converted'], fileReference: reference,
      operationId, sourceBytesRetained: false, ...(facts.durationMs ? { durationMs: facts.durationMs } : {}) } }, { expectedVersion: null });
  return host.assets.get(id, { version });
}
