// SPDX-License-Identifier: MPL-2.0
/** Shell-owned decoding. Only bounded, transient RGBA previews reach the worker. */
import type { ComparisonIdentity, HostV1, VisualComparisonPage, VisualComparisonSource } from '@lolly-tools/core/host-v1';
import { sniffAnimatedRaster } from '@lolly/engine';
const MAX_BYTES = 32 * 1024 * 1024, MAX_EDGE = 768, MAX_PAGES = 12;
export const VISUAL_FORMATS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'bmp', 'svg', 'pdf']);

function canvasFor(width: number, height: number, vector = false): HTMLCanvasElement {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error('This preview has invalid dimensions.');
  const scale = Math.min(vector ? 2 : 1, MAX_EDGE / Math.max(width, height));
  const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale)); return canvas;
}
function pixels(canvas: HTMLCanvasElement, page: number, width: number, height: number, unit: 'px' | 'pt'): VisualComparisonPage {
  const context = canvas.getContext('2d'); if (!context) throw new Error('Canvas previews are unavailable.');
  return { page, width, height, unit, pixelWidth: canvas.width, pixelHeight: canvas.height, rgba: context.getImageData(0, 0, canvas.width, canvas.height).data };
}
/** SVG is loaded as an isolated static image, never inserted into the document. */
async function svgPage(svg: string, page: number, unit: 'px' | 'pt', signal?: AbortSignal, size?: { width: number; height: number; rotation?: number }): Promise<VisualComparisonPage> {
  if (svg.length > 8 * 1024 * 1024) throw new Error('This SVG preview exceeds the size limit.');
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml'), root = doc.documentElement;
  if (root.localName !== 'svg' || doc.querySelector('parsererror')) throw new Error('This SVG could not be read.');
  const box = root.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
  // Browser measurement resolves CSS units. A viewBox also supplies dimensions for percentage-sized SVGs.
  const length = (name: string, fallback: number): number => {
    const value = root.getAttribute(name) ?? '';
    const match = /^(\d*\.?\d+)(px|pt|mm|cm|in)?$/.exec(value);
    const factors: Record<string, number> = { px: 1, pt: 96 / 72, mm: 96 / 25.4, cm: 96 / 2.54, in: 96 };
    return match ? Number(match[1]) * factors[match[2] ?? 'px']! : fallback;
  };
  const width = size?.width ?? length('width', box?.[2] ?? 300), height = size?.height ?? length('height', box?.[3] ?? 150);
  const rotation = size?.rotation ?? 0, sideways = rotation === 90 || rotation === 270;
  const outWidth = sideways ? height : width, outHeight = sideways ? width : height, canvas = canvasFor(outWidth, outHeight, true);
  root.setAttribute('width', String(sideways ? canvas.height : canvas.width)); root.setAttribute('height', String(sideways ? canvas.width : canvas.height));
  if (!box) root.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(root)], { type: 'image/svg+xml' })), img = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      const cleanup = (): void => { signal?.removeEventListener('abort', abort); img.onload = null; img.onerror = null; };
      const abort = (): void => { cleanup(); img.src = ''; reject(new DOMException('Comparison cancelled.', 'AbortError')); };
      if (signal?.aborted) { abort(); return; }
      signal?.addEventListener('abort', abort, { once: true });
      img.onload = () => { cleanup(); resolve(); }; img.onerror = () => { cleanup(); reject(new Error('This SVG preview could not be decoded.')); }; img.src = url;
    });
    signal?.throwIfAborted();
    const context = canvas.getContext('2d'); if (!context) throw new Error('Canvas previews are unavailable.');
    context.translate(canvas.width / 2, canvas.height / 2); context.rotate(rotation * Math.PI / 180);
    const w = sideways ? canvas.height : canvas.width, h = sideways ? canvas.width : canvas.height;
    context.drawImage(img, -w / 2, -h / 2, w, h);
    return pixels(canvas, page, outWidth, outHeight, unit);
  } finally { URL.revokeObjectURL(url); }
}

export async function comparisonVisualSource(file: File, host: HostV1, signal?: AbortSignal, identity?: ComparisonIdentity): Promise<VisualComparisonSource> {
  signal?.throwIfAborted();
  if (file.size > MAX_BYTES) throw new Error('Choose images or PDFs up to 32 MiB per side.');
  const format = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!VISUAL_FORMATS.has(format)) throw new Error('Choose a PNG, JPEG, WebP, GIF, AVIF, BMP, SVG or PDF.');
  const bytes = new Uint8Array(await file.arrayBuffer()); signal?.throwIfAborted();
  const sourceId = identity ?? { id: crypto.randomUUID(), kind: 'file', label: file.name };
  const limitations: string[] = []; const pages: VisualComparisonPage[] = []; let totalPages = 1;
  if (format === 'pdf') {
    if (!host.pdf?.pages) throw new Error('PDF previews are unavailable in this host.');
    const result = await host.pdf.pages(bytes, { maxPages: MAX_PAGES, signal }).catch(() => { signal?.throwIfAborted(); throw new Error('This PDF could not be previewed. It may be encrypted, damaged or unsupported.'); }); signal?.throwIfAborted();
    totalPages = result.totalPages ?? Math.max(1, ...result.pages.map(p => p.page), ...(result.failed ?? []));
    limitations.push('PDF previews use the shared renderer. Embedded font versions, annotations and unsupported PDF features may not be reproduced exactly.');
    if (result.truncated) limitations.push('Only the first 12 PDF pages are available in this comparison.');
    if (result.totalPages === undefined) limitations.push('The PDF provider did not report the original page count.');
    for (const p of result.pages.slice(0, MAX_PAGES)) {
      signal?.throwIfAborted(); limitations.push(...p.limitations ?? []);
      try { pages.push(await svgPage(p.svg, p.page, 'pt', signal, { width: p.widthPt, height: p.heightPt, rotation: p.rotation })); }
      catch { signal?.throwIfAborted(); limitations.push('A PDF page preview could not be decoded.'); }
    }
  } else if (format === 'svg') {
    const svg = new TextDecoder().decode(bytes);
    if (/<(?:[\w-]+:)?(?:text|foreignObject|animate\w*|set)\b|(?:href|url\()\s*[=:]?\s*["']?(?:https?:|\/\/)/i.test(svg)) limitations.push('SVG text uses available fonts; external resources, foreign content and animation may be omitted or substituted. Saved font versions are not verified.');
    pages.push(await svgPage(svg, 1, 'px', signal));
  } else {
    if (!host.raster?.canRaster()) throw new Error('Image previews are unavailable in this host.');
    if (sniffAnimatedRaster(bytes)) limitations.push('Animated images compare one decoded frame only.');
    const bitmap = await host.raster.decode(new Blob([bytes as BlobPart], { type: file.type }));
    try {
      signal?.throwIfAborted(); const canvas = canvasFor(bitmap.width, bitmap.height), context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas previews are unavailable.');
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); pages.push(pixels(canvas, 1, bitmap.width, bitmap.height, 'px'));
    } finally { bitmap.close(); }
  }
  signal?.throwIfAborted();
  return { identity: sourceId, pages, totalPages, bytes, fidelity: { level: limitations.length ? 'partial' : 'complete', limitations: [...new Set(limitations)] } };
}
