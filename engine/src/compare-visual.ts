// SPDX-License-Identifier: MPL-2.0
/** Bounded preview comparison. No codecs, DOM, storage, or source mutation. */
import type { VisualComparisonPage, VisualComparisonRequest, VisualComparisonResult, VisualPageDifference } from '@lolly-tools/core/host-v1';
const MAX_EDGE = 768, MAX_PAGES = 12, MAX_PIXELS = 8 * 1024 * 1024;

function validPage(page: VisualComparisonPage): boolean {
  return Number.isInteger(page.page) && page.page > 0 && Number.isFinite(page.width) && page.width > 0
    && Number.isFinite(page.height) && page.height > 0 && Number.isInteger(page.pixelWidth) && page.pixelWidth > 0
    && Number.isInteger(page.pixelHeight) && page.pixelHeight > 0 && page.pixelWidth * page.pixelHeight <= MAX_PIXELS
    && page.rgba instanceof Uint8ClampedArray && page.rgba.length === page.pixelWidth * page.pixelHeight * 4;
}

/** The viewer and comparator share nearest-neighbour sampling and white compositing. */
export function renderComparisonPage(page: VisualComparisonPage | undefined, grid: Pick<VisualPageDifference, 'width' | 'height' | 'scale'>, alignment: 'native' | 'fit'): Uint8ClampedArray {
  const { width, height, scale } = grid;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > MAX_EDGE * MAX_EDGE || !Number.isFinite(scale) || scale <= 0) throw new Error('Invalid comparison frame.');
  if (page && !validPage(page)) throw new Error('Invalid comparison page.');
  const out = new Uint8ClampedArray(width * height * 4); out.fill(255);
  if (!page) return out;
  const dw = alignment === 'fit' ? width : page.width * scale, dh = alignment === 'fit' ? height : page.height * scale;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (x + .5 >= dw || y + .5 >= dh) continue;
    const sx = Math.min(page.pixelWidth - 1, Math.floor((x + .5) * page.pixelWidth / dw));
    const sy = Math.min(page.pixelHeight - 1, Math.floor((y + .5) * page.pixelHeight / dh));
    const src = (sy * page.pixelWidth + sx) * 4, dst = (y * width + x) * 4, alpha = page.rgba[src + 3]! / 255;
    for (let c = 0; c < 3; c++) out[dst + c] = Math.round(page.rgba[src + c]! * alpha + 255 * (1 - alpha));
  }
  return out;
}

export function compareVisualSources(request: VisualComparisonRequest, signal?: AbortSignal): VisualComparisonResult {
  signal?.throwIfAborted();
  if (request.version !== 1) throw new Error('Unsupported comparison version.');
  const { before, after } = request;
  const threshold = request.options?.threshold ?? 0;
  const options = { alignment: request.options?.alignment === 'fit' ? 'fit' as const : 'native' as const, threshold: Number.isFinite(threshold) ? Math.max(0, Math.min(255, Math.round(threshold))) : 0 };
  const limitations = new Set<string>(['Previews use nearest-neighbour samples on white, at most 768 pixels per edge. Matching previews do not establish original pixel or structural equality.']);
  let partial = false;
  const limit = (message: string): void => { partial = true; limitations.add(message); };
  for (const source of [before, after]) {
    if (!Number.isInteger(source.totalPages) || source.totalPages < 1 || source.pages.length > MAX_PAGES
      || source.pages.some(p => !validPage(p) || p.page > source.totalPages)
      || new Set(source.pages.map(p => p.page)).size !== source.pages.length
      || source.pages.reduce((sum, p) => sum + p.pixelWidth * p.pixelHeight, 0) > MAX_PIXELS) throw new Error('Invalid or oversized comparison preview.');
    if (source.fidelity && source.fidelity.level !== 'complete') {
      partial = true;
      if (!source.fidelity.limitations.length) limitations.add('A source preview has incomplete fidelity.');
    }
    for (const message of source.fidelity?.limitations ?? []) limitations.add(message);
  }
  const total = Math.max(before.totalPages, after.totalPages), pages: VisualPageDifference[] = [];
  if (total > MAX_PAGES) limit('Only the first 12 pages were compared.');
  let byteEquality: VisualComparisonResult['byteEquality'] = 'unknown';
  if (before.bytes && after.bytes) {
    if (Math.max(before.bytes.length, after.bytes.length) > 32 * 1024 * 1024) limitations.add('Byte equality was not checked above 32 MiB.');
    else byteEquality = before.bytes.length === after.bytes.length && before.bytes.every((b, i) => b === after.bytes![i]) ? 'equal' : 'different';
  }
  const summary = { added: 0, removed: 0, changed: 0, unchanged: 0, unavailable: 0, total };
  for (let page = 1; page <= Math.min(MAX_PAGES, total); page++) {
    signal?.throwIfAborted();
    const a = before.pages.find(p => p.page === page), b = after.pages.find(p => p.page === page);
    const w = Math.max(a?.width ?? 1, b?.width ?? 1), h = Math.max(a?.height ?? 1, b?.height ?? 1);
    const density = Math.max(1, ...[a, b].flatMap(p => p ? [p.pixelWidth / p.width, p.pixelHeight / p.height] : []));
    const scale = Math.min(density, MAX_EDGE / Math.max(w, h));
    const width = Math.max(1, Math.min(MAX_EDGE, Math.ceil(w * scale))), height = Math.max(1, Math.min(MAX_EDGE, Math.ceil(h * scale)));
    const result: VisualPageDifference = { page, kind: 'unchanged', width, height, scale, sizeChanged: !!a && !!b && (a.width !== b.width || a.height !== b.height || a.unit !== b.unit), changedPixels: 0, sampledPixels: 0, mask: new Uint8Array(width * height) };
    if ((!a && page <= before.totalPages) || (!b && page <= after.totalPages) || before.fidelity?.level === 'unavailable' || after.fidelity?.level === 'unavailable') {
      result.kind = 'unavailable'; limit('Some pages could not be rendered; they are not treated as absent or equal.');
    } else if (!a || !b) { result.kind = a ? 'removed' : 'added'; }
    else {
      if (a.unit !== b.unit && options.alignment === 'native') limit('Source units differ. Native alignment compares numeric sizes, not physical size. Choose fit to compare composition.');
      const left = renderComparisonPage(a, result, options.alignment), right = renderComparisonPage(b, result, options.alignment);
      let x0 = width, y0 = height, x1 = -1, y1 = -1;
      for (let i = 0; i < width * height; i++) {
        if (i % 32768 === 0) signal?.throwIfAborted();
        const offset = i * 4;
        if (Math.max(Math.abs(left[offset]! - right[offset]!), Math.abs(left[offset + 1]! - right[offset + 1]!), Math.abs(left[offset + 2]! - right[offset + 2]!)) > options.threshold) {
          result.mask[i] = 255; result.changedPixels++;
          const x = i % width, y = Math.floor(i / width); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        }
      }
      result.sampledPixels = width * height;
      if (result.changedPixels) result.bounds = { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
      if (result.changedPixels || result.sizeChanged) result.kind = 'changed';
    }
    summary[result.kind]++; pages.push(result);
  }
  return { version: 1, before: { ...before.identity }, after: { ...after.identity }, mode: 'visual', options, byteEquality,
    appearance: summary.added + summary.removed + summary.changed ? 'different' : partial ? 'undetermined' : 'same-rendered-pixels',
    completeness: partial ? 'partial' : 'complete', summary, pages, limitations: [...limitations] };
}
