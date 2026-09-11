// SPDX-License-Identifier: MPL-2.0
import { executeFileOperationV1, type FileOperationRequestV1 } from '@lolly-tools/core/file-operation-v1';
import { imageDimensions, extractFileMetadata, sfntKind } from '@lolly/engine';
import { safeFileName, type FileFactsV1 } from '@lolly-tools/core/file-v1';
import { DEFAULT_IMAGE_OPTIONS, conversionFindings, sha256Bytes, validateImageOptions, validateConvertFiles } from './file-conversion.ts';
import { convert, detectKind, targetsFor, type Target } from './convert-codecs.ts';

export async function describeFile(file: File, signal?: AbortSignal): Promise<FileFactsV1> {
  validateConvertFiles([file]);
  signal?.throwIfAborted();
  const bytes = new Uint8Array(await file.arrayBuffer()); signal?.throwIfAborted();
  const dimensions = imageDimensions(bytes, file.type);
  const rawFormat = sfntKind(bytes) ?? extractFileMetadata(bytes).format.toLowerCase();
  const detected = ['unknown', 'binary', ''].includes(rawFormat) ? undefined : rawFormat;
  return { name: file.name, format: detected || file.name.split('.').pop()?.toLowerCase() || 'unknown', formatSource: detected ? 'detected' : 'declared', mime: file.type || 'application/octet-stream', size: file.size, sha256: await sha256Bytes(bytes), ...(dimensions ? { width: dimensions.w, height: dimensions.h } : {}) };
}
export async function runWebFileOperation(file: File, request: FileOperationRequestV1, signal?: AbortSignal, filename?: string) {
  return executeFileOperationV1(file, request, {
    describe: describeFile,
    effects(input) {
      if (request.operation === 'media.transmux') return { metadata: 'changed', findings: [{ code: 'container-rewritten', severity: 'warning', message: 'Media packets are copied without re-encoding. Container metadata may change; source content credentials are not carried. Copies that would drop tracks are refused.' }] };
      const kind = ['png', 'jpeg', 'jpg', 'webp', 'gif', 'avif', 'bmp', 'tiff'].includes(input.format) ? 'raster' : input.format;
      const raster = kind === 'raster' || ['svg', 'svgz'].includes(kind) && !['svg', 'svgz'].includes(request.target);
      return { metadata: request.target === 'pdf-clean' ? 'changed' : raster ? 'removed' : ['svg', 'svgz'].includes(kind) ? 'preserved' : 'not-checked', findings: conversionFindings(kind, request.target) };
    },
    async execute(source, operation) {
      if (operation.operation === 'media.transmux') {
        if (!['mp4', 'mov', 'mkv', 'webm'].includes(operation.target)) throw new Error('Unsupported media container.');
        const { transmuxContainer } = await import('./transmux.ts');
        const { BlobSource } = await import('mediabunny');
        const result = await transmuxContainer(new BlobSource(source), operation.target as 'mp4' | 'mov' | 'mkv' | 'webm', { signal });
        if (!result) throw new Error('That container cannot carry this media.');
        if (result.droppedTracks) throw new Error('That copy would drop media or subtitle tracks. Choose a compatible container; the original is unchanged.');
        return new File([result.blob], safeFileName(`${source.name.replace(/\.[^.]+$/, '')}.${result.ext}`), { type: result.mime });
      }
      if (operation.operation !== 'convert') throw new Error('This adapter supports the convert operation.');
      const options = { ...DEFAULT_IMAGE_OPTIONS, ...operation.options }; validateImageOptions(options);
      const bytes = new Uint8Array(await source.arrayBuffer());
      const kind = detectKind(bytes, source);
      const target = targetsFor(kind).find(t => t.id === operation.target) as Target | undefined;
      if (!target) throw new Error(`Conversion to ${operation.target} is not supported for this file.`);
      const blob = await convert(bytes, kind, target, source, options, signal);
      const ext = blob.type === 'application/zip' ? 'zip' : target.ext;
      const name = filename && ext === target.ext ? filename : `${(filename ?? source.name).replace(/\.[^.]+$/, '')}.${ext}`;
      return new File([blob], safeFileName(name), { type: blob.type });
    },
  }, { signal });
}
