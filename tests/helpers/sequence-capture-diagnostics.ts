// SPDX-License-Identifier: MPL-2.0
/** Test-only source-plate observations. No pixels or image addresses leave the page. */
export const SOURCE_CAPTURE_LIMIT = 32;
export const SOURCE_CAPTURE_IMAGE_LIMIT = 256;
export const SOURCE_CAPTURE_BYTE_LIMIT = 16 * 1024 * 1024;

type CaptureStatus = 'PENDING' | 'HASHED' | 'CAPTURE_REFUSED' | 'READBACK_REFUSED' | 'TOO_LARGE';
export interface SourceCapture {
  index: number;
  width: number;
  height: number;
  images: { total: number; checked: number; ready: number; pending: number; failed: number; overflow: number };
  status: CaptureStatus;
  rgbaSha256: string | null;
}
export interface SourceCaptureDiagnostics {
  enabled: boolean;
  captures: SourceCapture[];
  overflow: number;
}
interface CaptureNode { querySelectorAll(selector: string): ArrayLike<unknown> }
interface CaptureCanvas {
  width: number;
  height: number;
  getContext(kind: '2d'): { getImageData(x: number, y: number, width: number, height: number): { data: Uint8ClampedArray } } | null;
}
export const newSourceCaptureDiagnostics = (): SourceCaptureDiagnostics => ({ enabled: false, captures: [], overflow: 0 });

function beginCapture(run: SourceCaptureDiagnostics, node: unknown): SourceCapture | null {
  if (run.captures.length >= SOURCE_CAPTURE_LIMIT) { run.overflow++; return null; }
  const source = node as Partial<CaptureNode> | null;
  const images = typeof source?.querySelectorAll === 'function' ? source.querySelectorAll('img') : [];
  const checked = Math.min(images.length, SOURCE_CAPTURE_IMAGE_LIMIT);
  let ready = 0, pending = 0, failed = 0;
  for (let i = 0; i < checked; i++) {
    const image = images[i] as { complete?: unknown; naturalWidth?: unknown; naturalHeight?: unknown };
    if (image?.complete !== true) pending++;
    else if (typeof image.naturalWidth === 'number' && image.naturalWidth > 0
      && typeof image.naturalHeight === 'number' && image.naturalHeight > 0) ready++;
    else failed++;
  }
  const row: SourceCapture = { index: run.captures.length, width: 0, height: 0,
    images: { total: images.length, checked, ready, pending, failed, overflow: images.length - checked },
    status: 'PENDING', rgbaSha256: null };
  run.captures.push(row);
  return row;
}

async function completeCapture(row: SourceCapture, canvas: CaptureCanvas): Promise<void> {
  const { width, height } = canvas;
  if (!Number.isSafeInteger(width) || width < 1 || !Number.isSafeInteger(height) || height < 1
    || width > SOURCE_CAPTURE_BYTE_LIMIT / 4 / height) { row.status = 'TOO_LARGE'; return; }
  row.width = width; row.height = height;
  try {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No source readback');
    const bytes = context.getImageData(0, 0, width, height).data;
    if (bytes.byteLength !== width * height * 4) throw new Error('Incomplete source readback');
    const digest = await crypto.subtle.digest('SHA-256', bytes as Uint8ClampedArray<ArrayBuffer>);
    row.rgbaSha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    row.status = 'HASHED';
  } catch { row.status = 'READBACK_REFUSED'; }
}

/** Observe the actual capture result, preserving the library's arguments, receiver and errors. */
export function observeSourceCaptures<N, A extends unknown[], C extends CaptureCanvas>(
  library: { toCanvas(node: N, ...args: A): Promise<C> }, run: SourceCaptureDiagnostics,
): () => void {
  const original = library.toCanvas;
  const observed: typeof original = async function (this: typeof library, node, ...args) {
    const row = beginCapture(run, node);
    let canvas: C;
    try { canvas = await original.call(this, node, ...args); }
    catch (error) { if (row) row.status = 'CAPTURE_REFUSED'; throw error; }
    if (row) await completeCapture(row, canvas);
    return canvas;
  };
  library.toCanvas = observed;
  run.enabled = true;
  return () => { if (library.toCanvas === observed) library.toCanvas = original; };
}
