// SPDX-License-Identifier: MPL-2.0
/** Node adapter for the same operation/receipt contract used by the web shell. */
import { open } from 'node:fs/promises';
import { basename } from 'node:path';
import { createHash } from 'node:crypto';
import { executeFileOperationV1, type FileOperationRequestV1 } from '@lolly-tools/core/file-operation-v1';
import { safeFileName, type FileFactsV1 } from '@lolly-tools/core/file-v1';
import { DEFAULT_IMAGE_OPTIONS, MAX_CONVERT_FILE_BYTES, MAX_CONVERT_PIXELS, conversionFindings, encodeToTargetBytes, resizedDimensions, validateConvertFiles, validateImageOptions } from '@lolly-tools/core/image-operation-v1';
import { imageDimensions, sfntKind, fontConversionTargets, convertFontContainer, sniffAnimatedRaster, convertDataFile, readDataOptions } from '@lolly/engine';
import { isJxl } from '../../../engine/src/jxl.ts';
import { runJxl } from './jxl.ts';
import { sniffFormat } from './format-sniff.ts';

const mime: Record<string, string> = { jxl: 'image/jxl', 'jxl-lossless': 'image/jxl', 'jxl-recompress': 'image/jxl', 'jpeg-original': 'image/jpeg', png: 'image/png', jpeg: 'image/jpeg', jpg: 'image/jpeg', webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml', ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', csv: 'text/csv', tsv: 'text/tab-separated-values', json: 'application/json', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
export const NODE_FILE_TARGETS = { image: ['png', 'jpeg', 'webp', 'avif', 'jxl', 'jxl-lossless', 'jxl-recompress', 'jpeg-original'], font: ['ttf', 'otf', 'woff'], data: ['csv', 'tsv', 'json', 'xlsx'], pdf: ['pdf-clean', 'pdf-optimize'] } as const;

/** Bounded even if a file grows after stat; never follows directories or devices. */
export async function readOperationFile(path: string): Promise<File> {
  const handle = await open(path, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) throw new Error('Choose a regular file.');
    validateConvertFiles([stat]);
    const chunks: Uint8Array[] = []; let total = 0;
    while (true) {
      const chunk = Buffer.alloc(Math.min(1024 * 1024, MAX_CONVERT_FILE_BYTES + 1 - total));
      const { bytesRead } = await handle.read(chunk);
      if (!bytesRead) break;
      total += bytesRead;
      if (total > MAX_CONVERT_FILE_BYTES) throw new Error('File exceeds 128 MB.');
      chunks.push(chunk.subarray(0, bytesRead));
    }
    const name = basename(path);
    return new File(chunks as BlobPart[], name, { type: mime[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream' });
  } finally { await handle.close(); }
}

export async function describeOperationFile(file: File, signal?: AbortSignal): Promise<FileFactsV1> {
  validateConvertFiles([file]); signal?.throwIfAborted();
  const bytes = new Uint8Array(await file.arrayBuffer()); signal?.throwIfAborted();
  const detected = sfntKind(bytes) ?? sniffFormat(bytes);
  const format = detected === 'jpg' ? 'jpeg' : detected ?? file.name.split('.').pop()?.toLowerCase() ?? 'unknown';
  const jxl = isJxl(bytes) ? (await runJxl({ operation: 'probe', bytes }, signal)).info : undefined;
  const dimensions = jxl ? { w: jxl.width, h: jxl.height } : imageDimensions(bytes, file.type);
  return { name: file.name, format, formatSource: detected ? 'detected' : 'declared', mime: mime[format] ?? (file.type || 'application/octet-stream'), size: file.size, sha256: createHash('sha256').update(bytes).digest('hex'), ...(dimensions ? { width: dimensions.w, height: dimensions.h } : {}) };
}

export async function runNodeFileOperation(file: File, request: FileOperationRequestV1, signal?: AbortSignal, execution: 'device' | 'instance' = 'device') {
  return executeFileOperationV1(file, request, {
    describe: describeOperationFile,
    effects(input) {
      if (['jxl-recompress', 'jpeg-original'].includes(request.target)) return { metadata: 'preserved', findings: conversionFindings('raster', request.target) };
      const raster = ['jxl', 'png', 'jpeg', 'jpg', 'webp', 'avif', 'tiff', 'bmp', 'gif', 'apng'].includes(input.format);
      // A workbook sniffs as a zip; its name says it is the spreadsheet kind.
      const kind = input.format === 'zip' && /\.xlsx$/i.test(input.name) ? 'xlsx' : input.format;
      return { metadata: request.target === 'pdf-clean' ? 'changed' : raster ? 'removed' : 'not-checked', findings: conversionFindings(input.format === 'jxl' ? 'jxl' : raster ? 'raster' : kind, request.target, request.options) };
    },
    async execute(source, operation) {
      if (operation.operation !== 'convert') throw new Error('Supported operation: convert.');
      const options = { ...DEFAULT_IMAGE_OPTIONS, ...operation.options }; validateImageOptions(options);
      const bytes = new Uint8Array(await source.arrayBuffer()); signal?.throwIfAborted();
      const facts = await describeOperationFile(source, signal);
      let result: Uint8Array | string;
      let zip = false;
      const font = sfntKind(bytes);
      if (['jxl-recompress', 'jpeg-original'].includes(operation.target)) {
        if (options.maxEdge || options.targetBytes) throw new Error('Original JPEG preservation does not support resizing or a target file size.');
        result = (await runJxl({ operation: operation.target === 'jxl-recompress' ? 'recompress' : 'restore', bytes }, signal)).bytes;
      } else if (facts.format === 'pdf' && ['pdf-clean', 'pdf-optimize'].includes(operation.target)) {
        const { runPdfFileOperation } = await import('./pdf-file-operation.ts');
        result = await runPdfFileOperation(bytes, operation.target as 'pdf-clean' | 'pdf-optimize', signal);
      } else if (font) {
        if (!fontConversionTargets(bytes).includes(operation.target as 'ttf' | 'otf' | 'woff')) throw new Error('That font container conversion is not supported; outline types are never relabelled.');
        result = convertFontContainer(bytes, operation.target as 'ttf' | 'otf' | 'woff');
      } else if (['csv', 'tsv', 'json', 'xlsx'].includes(facts.format) || facts.format === 'zip' && /\.xlsx$/i.test(source.name)) {
        const data = await convertDataFile(/\.xlsx$/i.test(source.name) ? 'xlsx' : facts.format, bytes, operation.target, readDataOptions(operation.options), source.name);
        result = data.bytes; zip = data.zip;
      } else {
        if (!(NODE_FILE_TARGETS.image as readonly string[]).includes(operation.target)) throw new Error('Unsupported image output format.');
        // SVG is deliberately not handed to a native decoder: external-resource and
        // stylesheet semantics differ. The web adapter owns that render path.
        if (!['jxl', 'png', 'jpeg', 'webp', 'avif', 'tiff', 'bmp', 'gif', 'apng'].includes(facts.format)) throw new Error('This Node adapter accepts still raster images, supported fonts and tabular data.');
        if (sniffAnimatedRaster(bytes, { name: source.name, mime: source.type })) throw new Error('Animated images are refused: still conversion would lose animation.');
        const { default: sharp } = await import('sharp');
        const decoded = isJxl(bytes) ? await runJxl({ operation: 'decode', bytes }, signal) : null;
        const imageSource = () => decoded
          ? sharp(decoded.bytes, { raw: { width: decoded.info!.width, height: decoded.info!.height, channels: 4 } })
          : sharp(bytes, { limitInputPixels: MAX_CONVERT_PIXELS });
        const metadata = await imageSource().metadata();
        if ((metadata.pages ?? 1) > 1) throw new Error('Multi-page or animated images need an explicit page/frame operation.');
        const rotated = [5, 6, 7, 8].includes(metadata.orientation ?? 0);
        const dimensions = resizedDimensions(rotated ? metadata.height! : metadata.width!, rotated ? metadata.width! : metadata.height!, options.maxEdge);
        const encode = async (quality: number) => {
          signal?.throwIfAborted();
          let image = imageSource().autoOrient().resize(dimensions.width, dimensions.height, { fit: 'inside', withoutEnlargement: true }).toColourspace('srgb');
          if (operation.target === 'jpeg') image = image.flatten({ background: options.background });
          if (['jxl', 'jxl-lossless'].includes(operation.target)) {
            const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
            const encoded = await runJxl({ operation: 'encode', bytes: new Uint8Array(data), width: info.width, height: info.height, options: { quality, lossless: operation.target === 'jxl-lossless' } }, signal);
            return { size: encoded.bytes.length, bytes: encoded.bytes };
          }
          const encoded = await image.toFormat(operation.target as 'png' | 'jpeg' | 'webp' | 'avif', operation.target === 'png' ? {} : { quality: Math.round(quality * 100) }).toBuffer();
          signal?.throwIfAborted(); return { size: encoded.length, bytes: encoded };
        };
        const output = operation.target === 'jxl-lossless' ? await encode(options.quality) : await encodeToTargetBytes(encode, options, signal);
        if (options.targetBytes && output.size > options.targetBytes) throw new Error('Lossless output exceeds the target size. Increase the target or reduce the dimensions.');
        result = output.bytes;
      }
      const extension = zip ? 'zip' : operation.target.startsWith('jxl') ? 'jxl' : operation.target === 'jpeg-original' ? 'jpg' : operation.target.startsWith('pdf-') ? 'pdf' : operation.target === 'jpeg' ? 'jpg' : operation.target;
      const output = new File([result as BlobPart], safeFileName(`${source.name.replace(/\.[^.]+$/, '')}.${extension}`), { type: zip ? 'application/zip' : extension === 'pdf' ? 'application/pdf' : mime[operation.target] ?? 'application/octet-stream' });
      validateConvertFiles([output]); return output;
    },
  }, { signal, execution });
}
