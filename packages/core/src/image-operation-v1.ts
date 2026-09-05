// SPDX-License-Identifier: MPL-2.0
/** Shared, DOM-free conversion policy and machine-readable output receipts. */
import { FILE_CONTRACT_VERSION, type FileFactsV1, type FileOperationFindingV1, type FileOperationReportV1 } from './file-v1.ts';

export interface ImageConversionOptions { maxEdge: number; quality: number; background: string; targetBytes?: number }
export const DEFAULT_IMAGE_OPTIONS: ImageConversionOptions = { maxEdge: 0, quality: 0.92, background: '#ffffff' };
export const MAX_CONVERT_FILE_BYTES = 128 * 1024 * 1024;
export const MAX_CONVERT_BATCH_BYTES = 256 * 1024 * 1024;
export const MAX_CONVERT_FILES = 20;
export const MAX_CONVERT_PIXELS = 40_000_000;

export function validateConvertFiles(files: ArrayLike<{ size: number }>): void {
  if (files.length > MAX_CONVERT_FILES) throw new Error('Choose up to 20 files at a time.');
  let total = 0;
  for (const file of Array.from(files)) {
    if (file.size > MAX_CONVERT_FILE_BYTES) throw new Error('This converter supports files up to 128 MB. Choose a smaller file.');
    total += file.size;
  }
  if (total > MAX_CONVERT_BATCH_BYTES) throw new Error('Choose a batch smaller than 256 MB.');
}

export function resizedDimensions(width: number, height: number, maxEdge = 0): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || width * height > MAX_CONVERT_PIXELS) {
    throw new Error('This converter supports images up to 40 megapixels. Resize the original before importing it.');
  }
  if (!Number.isInteger(maxEdge) || maxEdge < 0 || maxEdge > 16384) throw new Error('Set the longest edge between 1 and 16384 pixels, or leave it at 0 for the original size.');
  const scale = maxEdge ? Math.min(1, maxEdge / Math.max(width, height)) : 1;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function validateImageOptions(options: ImageConversionOptions): void {
  resizedDimensions(1, 1, options.maxEdge);
  if (!Number.isFinite(options.quality) || options.quality < .1 || options.quality > 1) throw new Error('Quality must be between 0.1 and 1.');
  if (!/^#[a-f\d]{6}$/i.test(options.background)) throw new Error('Background must be a six-digit hex colour.');
  if (options.targetBytes !== undefined && (!Number.isSafeInteger(options.targetBytes) || options.targetBytes < 0 || options.targetBytes > MAX_CONVERT_FILE_BYTES)) throw new Error('Target bytes must be between 0 and 128 MB.');
}

/** Highest tested quality under the requested size. No false success when unreachable. */
export async function encodeToTargetBytes<T extends { size: number }>(encode: (quality: number) => Promise<T>, options: ImageConversionOptions, signal?: AbortSignal): Promise<T> {
  validateImageOptions(options); signal?.throwIfAborted();
  const initial = await encode(options.quality);
  if (!options.targetBytes || initial.size <= options.targetBytes) return initial;
  let low = .1, high = options.quality, best: T | undefined;
  const minimum = await encode(low);
  if (minimum.size > options.targetBytes) throw new Error('That size cannot be reached at these dimensions. Reduce the longest edge or choose a larger byte target.');
  best = minimum;
  for (let i = 0; i < 6; i++) {
    signal?.throwIfAborted();
    const quality = (low + high) / 2; const result = await encode(quality);
    if (result.size <= options.targetBytes) { best = result; low = quality; } else high = quality;
  }
  return best;
}

export function conversionFindings(kind: string, target: string): FileOperationFindingV1[] {
  const warning = (code: string, message: string): FileOperationFindingV1 => ({ code, severity: 'warning', message });
  if (target === 'pdf-clean') return [warning('pdf-descriptive-metadata', 'Removes descriptive Info/XMP metadata, not attachments, comments, form values, scripts or hidden content. This is not redaction.'), warning('pdf-rewrite', 'Rewrites the PDF without rasterizing pages. Signed and password-protected PDFs are refused.')];
  if (target === 'pdf-optimize') return [warning('pdf-structural-only', 'Structural compression only: images are not downsampled. Keeps the original bytes if the rewrite is larger; savings are not guaranteed.'), warning('pdf-rewrite', 'Signed and password-protected PDFs are refused. Check the finished document before delivery.')];
  if (kind === 'raster' || (['svg', 'svgz'].includes(kind) && !['svg', 'svgz'].includes(target))) {
    const findings = [warning('metadata-not-carried', 'Image re-encoding does not carry over source metadata or content credentials.'),
      warning('colour-not-verified', 'Renderer-converted colour. CMYK, spot colours, HDR and print fidelity are not verified.')];
    if (kind !== 'raster') findings.push(warning('vector-rasterized', 'The SVG becomes pixels. Text and shapes will no longer be editable vectors.'));
    if (target === 'jpeg') findings.push(warning('alpha-flattened', 'JPEG cannot keep transparency. Transparent areas use your chosen background colour.'));
    if (target === 'pdf') findings.push(warning('image-pdf', 'One image on one PDF page; not editable vector artwork. One pixel becomes one PDF point.'));
    if (target === 'ico') findings.push(warning('icon-size', 'The icon is reduced to at most 256 × 256 pixels.'));
    return findings;
  }
  if (['pdf', 'docx', 'pptx'].includes(kind)) return [warning('layout-not-preserved', 'Markdown extracts content, not page layout. Check reading order, tables and images before delivery.'),
    ...(kind === 'pdf' ? [warning('text-layer-only', 'Reads an existing text layer, without OCR. PDFs above 200 pages are refused rather than silently truncated.')] : [])];
  if (['csv', 'tsv', 'xlsx', 'json'].includes(kind)) return [warning('values-only', 'Converts cell values, not formatting or formulas. Excel input uses the first sheet.'),
    ...(target === 'json' ? [warning('json-headers', 'Column headings become object keys. Duplicate or empty headings are refused.')] : []),
    ...(target === 'tsv' ? [warning('tsv-whitespace', 'Tabs and line breaks within cells become spaces.')] : [])];
  if (['ttf', 'otf', 'woff'].includes(kind)) return [warning('font-container', 'Keeps the outline format. Font licensing and embedding rights are not verified; WOFF wrapper metadata is not carried into an unpacked font.')];
  return [];
}

export function conversionReport(input: FileFactsV1, output: FileFactsV1, kind: string, options: ImageConversionOptions): FileOperationReportV1 {
  const raster = kind === 'raster' || (['svg', 'svgz'].includes(kind) && !['svg', 'svgz'].includes(output.format));
  const changes = [`${input.format.toUpperCase()} → ${output.format.toUpperCase()}`, `${input.size} → ${output.size} bytes`];
  if (input.width && output.width) changes.push(`${input.width} × ${input.height} → ${output.width} × ${output.height} pixels`);
  return { version: FILE_CONTRACT_VERSION, operation: 'convert', state: 'succeeded', inputs: [input], outputs: [output],
    options: raster ? { maxEdge: options.maxEdge, quality: options.quality, background: options.background } : {}, changes,
    findings: conversionFindings(kind, output.format), metadata: raster ? 'removed' : ['svg', 'svgz'].includes(kind) ? 'preserved' : 'not-checked', execution: 'device' };
}

export async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
