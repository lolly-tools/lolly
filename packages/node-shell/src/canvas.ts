// SPDX-License-Identifier: MPL-2.0
/**
 * A real 2D canvas for the Node shells, over `@napi-rs/canvas` (Skia).
 *
 * Why it exists: a handful of transforms in this app REBUILD PIXELS rather than
 * describe them - PDF redaction burns opaque bars onto a rasterised page, the
 * redact utility repaints an image and re-encodes it, the failed-export gate
 * re-decodes its own output and samples it. jsdom answers `getContext('2d')`
 * with "Not implemented", so every one of those escalated to the browser tier -
 * a 200 MB Chromium download to paint a black rectangle.
 *
 * ATTACHMENT IS CONDITIONAL, the same stance as images.ts/sharp:
 * `isCanvasAvailable()` is a synchronous `require.resolve`, the native module
 * loads lazily on first use, and a shell that cannot resolve it leaves the
 * capability off rather than attaching something that throws on every call.
 *
 * Two surfaces, for two kinds of caller:
 *
 *   • `createNodeRasterAPI()` builds `host.raster` (the v1.105 contract) - the
 *     realm-portable primitives a tool hook is SUPPOSED to use.
 *   • `installNodeCanvas()` makes the jsdom realm itself genuinely
 *     raster-capable: `document.createElement('canvas').getContext('2d')`,
 *     `toBlob`, `toDataURL`, `new Image()`, `createImageBitmap` and
 *     `URL.createObjectURL`. Shipped tool hooks predate `host.raster` and still
 *     reach for those directly, and a tool ships as DATA from another
 *     repository, so the honest fix here is to make the realm's answer true
 *     rather than to rewrite every tool. `host.raster.canRaster()` then reports
 *     the truth instead of a hopeful yes.
 *
 * EXIF orientation is applied on decode (through sharp when it is installed),
 * because the browser applies it too and a bar drawn against the oriented image
 * would otherwise land on different pixels here.
 */
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { repoRoot } from './repo-root.ts';
import type {
  ImageEncodeOpts, ImageInfo, ImageResult, RasterAPI, RasterFrame, RasterSource,
} from '@lolly-tools/core/host-v1';

// ─── the module, resolved conditionally ───────────────────────────────────────

/** The slice of @napi-rs/canvas this module uses. Typed locally: the package is an
 *  optional runtime dependency, so its types must not be a build requirement. */
export interface NodeCanvasCtx {
  fillStyle: string;
  font: string;
  textAlign: string;
  textBaseline: string;
  globalAlpha: number;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  beginPath(): void;
  closePath(): void;
  fill(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arcTo(x1: number, y1: number, x2: number, y2: number, r: number): void;
  drawImage(img: unknown, ...args: number[]): void;
  getImageData(x: number, y: number, w: number, h: number): { width: number; height: number; data: Uint8ClampedArray };
  putImageData(data: unknown, x: number, y: number): void;
  createImageData(w: number, h: number): { width: number; height: number; data: Uint8ClampedArray };
}
export interface NodeCanvas {
  width: number;
  height: number;
  getContext(kind: '2d'): NodeCanvasCtx;
  toBuffer(mime: string, quality?: number): Buffer;
}
interface NodeCanvasModule {
  createCanvas(w: number, h: number): NodeCanvas;
  loadImage(src: Buffer | string): Promise<{ width: number; height: number }>;
  ImageData: new (data: Uint8ClampedArray, w: number, h: number) => unknown;
  GlobalFonts?: { loadFontsFromDir(dir: string): number };
}

/**
 * Register the catalog's own faces, once, the way raster.ts feeds them to resvg:
 * a mark painted here must use the brand's type, not whatever the OS happens to
 * have - and a container image often has nothing at all, which would silently
 * drop an attribution stamp rather than fail. Best-effort by design: a missing
 * directory leaves the system fonts in charge.
 */
let fontsRegistered = false;
function registerCatalogFonts(mod: NodeCanvasModule): void {
  if (fontsRegistered) return;
  fontsRegistered = true;
  try { mod.GlobalFonts?.loadFontsFromDir(join(repoRoot(), 'catalog', 'fonts')); } catch { /* system fonts it is */ }
}

/** True when @napi-rs/canvas is installed and loadable here. Sync + cheap. */
export function isCanvasAvailable(): boolean {
  try {
    createRequire(import.meta.url).resolve('@napi-rs/canvas');
    return true;
  } catch {
    return false;
  }
}

let canvasModule: Promise<NodeCanvasModule> | null = null;
function loadCanvasModule(): Promise<NodeCanvasModule> {
  canvasModule ??= import('@napi-rs/canvas' as string).then((m) => ((m as { default?: unknown }).default ?? m) as NodeCanvasModule);
  return canvasModule;
}

/** The canvas module, or null when it is not installed. Every caller in this
 *  package goes through here so "not installed" is one shape, not five. */
export async function nodeCanvas(): Promise<NodeCanvasModule | null> {
  if (!isCanvasAvailable()) return null;
  try {
    const mod = await loadCanvasModule();
    registerCatalogFonts(mod);
    return mod;
  } catch { return null; }
}

// ─── decoding: bytes → drawable pixels ────────────────────────────────────────

type SharpPipe = {
  rotate(): SharpPipe;
  ensureAlpha(): SharpPipe;
  raw(): SharpPipe;
  metadata(): Promise<{ width?: number; height?: number; format?: string; pages?: number }>;
  toBuffer(opts: { resolveWithObject: true }): Promise<{ data: Buffer; info: { width: number; height: number } }>;
};
type SharpFn = (input: Buffer) => SharpPipe;
let sharpModule: Promise<SharpFn | null> | null = null;
function loadSharp(): Promise<SharpFn | null> {
  sharpModule ??= import('sharp')
    .then((m) => ((m as { default?: unknown }).default ?? m) as unknown as SharpFn)
    .catch(() => null);
  return sharpModule;
}

const MIME_BY_MAGIC: [string, (b: Uint8Array) => boolean][] = [
  ['image/png', (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47],
  ['image/jpeg', (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ['image/gif', (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46],
  ['image/webp', (b) => b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45],
  ['image/avif', (b) => b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70],
];

/** MIME sniffed from the BYTES, never a filename - the contract's own rule. */
export function sniffImageMime(bytes: Uint8Array): string {
  for (const [mime, test] of MIME_BY_MAGIC) {
    try { if (test(bytes)) return mime; } catch { /* short buffer */ }
  }
  const head = Buffer.from(bytes.subarray(0, 256)).toString('utf8');
  if (/<svg[\s>]/i.test(head) || /^\s*<\?xml/.test(head)) return 'image/svg+xml';
  return 'application/octet-stream';
}

/**
 * Decode encoded image bytes onto a fresh canvas, EXIF orientation applied.
 *
 * sharp is the decoder of record when it is installed: it reads more formats
 * than Skia does and it is the only one of the two that honours EXIF
 * orientation, which is what keeps bar geometry identical to the browser's. SVG
 * goes to Skia's own loader (sharp would need a rasterisation size decided here,
 * and the SVG's intrinsic size is exactly what a caller wants).
 */
export async function decodeToCanvas(bytes: Uint8Array, mime?: string): Promise<NodeCanvas | null> {
  const mod = await nodeCanvas();
  if (!mod) return null;
  const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const kind = mime && mime !== 'application/octet-stream' ? mime : sniffImageMime(bytes);
  const sharp = kind === 'image/svg+xml' ? null : await loadSharp();
  if (sharp) {
    try {
      const { data, info } = await sharp(buf).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const canvas = mod.createCanvas(info.width, info.height);
      const cx = canvas.getContext('2d');
      const px = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
      cx.putImageData(new mod.ImageData(px, info.width, info.height), 0, 0);
      return canvas;
    } catch { /* fall through to Skia's own decoders */ }
  }
  try {
    const img = await mod.loadImage(buf);
    const canvas = mod.createCanvas(Math.max(1, img.width), Math.max(1, img.height));
    canvas.getContext('2d').drawImage(img, 0, 0);
    return canvas;
  } catch {
    return null;
  }
}

// ─── host.raster (the v1.105 contract) ────────────────────────────────────────

async function sourceBytes(src: RasterSource): Promise<Uint8Array> {
  if (src instanceof Uint8Array) return src;
  if (typeof src === 'string') {
    if (src.startsWith('data:')) {
      const comma = src.indexOf(',');
      if (comma < 0) throw new Error('host.raster: malformed data: URL.');
      const meta = src.slice(5, comma);
      const body = src.slice(comma + 1);
      return /;base64/i.test(meta) ? new Uint8Array(Buffer.from(body, 'base64')) : new TextEncoder().encode(decodeURIComponent(body));
    }
    const res = await fetch(src);
    if (!res.ok) throw new Error(`host.raster: could not read ${src} (HTTP ${res.status}).`);
    return new Uint8Array(await res.arrayBuffer());
  }
  if (typeof (src as Blob).arrayBuffer === 'function') return new Uint8Array(await (src as Blob).arrayBuffer());
  const ref = src as { url?: string };
  if (ref && typeof ref.url === 'string') return sourceBytes(ref.url);
  throw new Error('host.raster: unreadable source.');
}

/** Encode finished pixels. sharp writes the bytes when it is present (it drops
 *  every metadata block on re-encode, which is what a redacted derivative needs);
 *  Skia's own encoder is the fallback. */
async function encodeCanvas(canvas: NodeCanvas, format: string, quality?: number): Promise<{ bytes: Uint8Array; mime: string }> {
  const fmt = format === 'jpg' ? 'jpeg' : format;
  const mime = `image/${fmt}`;
  const q = typeof quality === 'number' && Number.isFinite(quality)
    ? Math.max(1, Math.min(100, Math.round(quality <= 1 ? quality * 100 : quality)))
    : undefined;
  // Passed positionally only when there is one: Skia's binding refuses an explicit
  // `undefined` here rather than treating it as "your default".
  const buf = q === undefined ? canvas.toBuffer(mime) : canvas.toBuffer(mime, q);
  return { bytes: new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength), mime };
}

/**
 * `host.raster` for the Node shells, or null when @napi-rs/canvas is absent (the
 * caller must then leave `host.raster` undefined - the contract's own signal).
 *
 * `decode` hands back a canvas, not an `ImageBitmap`: the contract's consumers
 * read `width`/`height` and pass the value to `ctx.drawImage`, and a canvas
 * satisfies both here. The declared type stays `ImageBitmap` so a tool written
 * against the contract compiles unchanged.
 */
export function createNodeRasterAPI(): RasterAPI | null {
  if (!isCanvasAvailable()) return null;
  return {
    canRaster(): boolean {
      return isCanvasAvailable();
    },
    async measure(src: RasterSource): Promise<ImageInfo> {
      const bytes = await sourceBytes(src);
      const mime = sniffImageMime(bytes);
      const sharp = mime === 'image/svg+xml' ? null : await loadSharp();
      if (sharp) {
        const meta = await sharp(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)).rotate().metadata();
        if (meta.width && meta.height) {
          return {
            width: meta.width, height: meta.height, mime,
            ...(meta.pages !== undefined ? { animated: meta.pages > 1 } : {}),
          };
        }
      }
      const canvas = await decodeToCanvas(bytes, mime);
      if (!canvas) throw new Error('host.raster: these bytes are not a decodable image here.');
      return { width: canvas.width, height: canvas.height, mime };
    },
    async decode(src: RasterSource): Promise<ImageBitmap> {
      const bytes = await sourceBytes(src);
      const canvas = await decodeToCanvas(bytes);
      if (!canvas) throw new Error('host.raster: these bytes are not a decodable image here.');
      return canvas as unknown as ImageBitmap;
    },
    async encode(source: ImageBitmap | RasterFrame, opts: ImageEncodeOpts): Promise<ImageResult> {
      if (!opts?.format) throw new Error('host.raster.encode: `format` is required (webp | jpeg | png).');
      const mod = await nodeCanvas();
      if (!mod) throw new Error('host.raster: no canvas in this install.');
      let canvas: NodeCanvas;
      const frame = source as RasterFrame;
      // A canvas is tested for FIRST: Skia's Canvas exposes a `data` accessor of
      // its own, so the RasterFrame check would swallow one and then hand its
      // non-typed-array value to ImageData.
      if (typeof (source as unknown as NodeCanvas)?.getContext === 'function') {
        canvas = source as unknown as NodeCanvas;
      } else if (ArrayBuffer.isView(frame?.data) && typeof frame.width === 'number') {
        canvas = mod.createCanvas(frame.width, frame.height);
        canvas.getContext('2d').putImageData(new mod.ImageData(frame.data, frame.width, frame.height), 0, 0);
      } else {
        const bmp = source as ImageBitmap;
        canvas = mod.createCanvas(Math.max(1, bmp.width), Math.max(1, bmp.height));
        canvas.getContext('2d').drawImage(bmp, 0, 0);
      }
      const { bytes, mime } = await encodeCanvas(canvas, opts.format, opts.quality);
      return { bytes, mime, width: canvas.width, height: canvas.height };
    },
  };
}

// ─── the realm shim (jsdom + the Node globals a tool hook actually reaches for) ─

/** The napi canvas behind a jsdom `<canvas>` element or an `Image` shim. */
const BACKING = Symbol.for('lolly.nodeCanvas.backing');
/** Blob URLs this shim minted, so an `Image.src = blobUrl` can find its bytes. */
const blobUrls = new Map<string, Blob>();

interface WithBacking { [BACKING]?: NodeCanvas }

/** Unwrap anything this shim hands out into something Skia can draw. */
function drawable(img: unknown): unknown {
  const backed = (img as WithBacking)?.[BACKING];
  return backed ?? img;
}

async function blobBytes(v: unknown): Promise<Uint8Array | null> {
  if (v instanceof Uint8Array) return v;
  if (typeof v === 'string') {
    const blob = blobUrls.get(v);
    if (blob) return new Uint8Array(await blob.arrayBuffer());
    if (v.startsWith('data:')) return sourceBytes(v);
    return null;
  }
  if (v && typeof (v as Blob).arrayBuffer === 'function') return new Uint8Array(await (v as Blob).arrayBuffer());
  return null;
}

/**
 * Make a jsdom realm genuinely raster-capable. Returns false (changing nothing)
 * when @napi-rs/canvas is not installed, so a lean install keeps its honest
 * "this shell has no canvas" answer instead of gaining one that throws.
 *
 * `win` is the jsdom window whose HTMLCanvasElement prototype gets the context;
 * `target` is the realm tool hooks actually run in, which is the Node global
 * scope, not the window - `new Function('host', …)` closes over neither.
 *
 * Nothing here overwrites a property that already works: each install is
 * conditional, so calling it twice, or in a realm that already has a canvas, is
 * a no-op.
 */
export function installNodeCanvas(
  win: { HTMLCanvasElement?: { prototype: Record<string, unknown> }; document?: unknown },
  target: Record<string, unknown> = globalThis as unknown as Record<string, unknown>,
): boolean {
  if (!isCanvasAvailable()) return false;
  const mod = createRequire(import.meta.url)('@napi-rs/canvas') as NodeCanvasModule;

  // 1. <canvas>.getContext('2d') / toBlob / toDataURL on the jsdom element.
  const proto = win?.HTMLCanvasElement?.prototype;
  if (proto && !(proto as Record<string, unknown>)['_lollyNodeCanvas']) {
    proto['_lollyNodeCanvas'] = true;
    const back = (el: WithBacking & { width?: number; height?: number }): NodeCanvas => {
      let c = el[BACKING];
      const w = Math.max(1, Math.round(Number(el.width) || 300));
      const h = Math.max(1, Math.round(Number(el.height) || 150));
      if (!c || c.width !== w || c.height !== h) {
        c = mod.createCanvas(w, h);
        // drawImage takes whatever this shim hands out (an Image shim, another
        // <canvas>), so unwrap at the one seam rather than at every call site.
        const cx = c.getContext('2d') as NodeCanvasCtx & { drawImage: (...a: unknown[]) => void };
        const orig = cx.drawImage.bind(cx);
        cx.drawImage = (img: unknown, ...rest: unknown[]): void => { orig(drawable(img), ...(rest as number[])); };
        el[BACKING] = c;
      }
      return c;
    };
    proto['getContext'] = function getContext(this: WithBacking, kind: string): unknown {
      return kind === '2d' ? back(this).getContext('2d') : null;
    };
    proto['toDataURL'] = function toDataURL(this: WithBacking, mime = 'image/png', quality?: number): string {
      const q = typeof quality === 'number' ? Math.max(1, Math.min(100, Math.round(quality * 100))) : undefined;
      const out = q === undefined ? back(this).toBuffer(mime) : back(this).toBuffer(mime, q);
      return `data:${mime};base64,${out.toString('base64')}`;
    };
    proto['toBlob'] = function toBlob(this: WithBacking, cb: (b: unknown) => void, mime = 'image/png', quality?: number): void {
      try {
        const q = typeof quality === 'number' ? Math.max(1, Math.min(100, Math.round(quality * 100))) : undefined;
        const buf = q === undefined ? back(this).toBuffer(mime) : back(this).toBuffer(mime, q);
        cb(new Blob([new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength) as BlobPart], { type: mime }));
      } catch { cb(null); }
    };
  }

  // 2. URL.createObjectURL - the registry an Image src resolves through. jsdom's
  //    own is not on the Node global URL a hook sees, and Skia cannot fetch blob:.
  const URLCtor = target['URL'] as (typeof URL) | undefined;
  if (URLCtor && typeof URLCtor.createObjectURL !== 'function') {
    let n = 0;
    URLCtor.createObjectURL = (blob: Blob): string => {
      const url = `blob:lolly-node/${Date.now().toString(36)}-${n++}`;
      blobUrls.set(url, blob);
      return url;
    };
    URLCtor.revokeObjectURL = (url: string): void => { blobUrls.delete(url); };
  }

  // 3. new Image() - src as a blob URL, a data: URL or raw bytes, onload/onerror.
  if (typeof target['Image'] !== 'function') {
    class NodeImage {
      width = 0;
      height = 0;
      naturalWidth = 0;
      naturalHeight = 0;
      complete = false;
      onload: (() => void) | null = null;
      onerror: ((e?: unknown) => void) | null = null;
      [BACKING]?: NodeCanvas;
      #src = '';
      get src(): string { return this.#src; }
      set src(v: string) {
        this.#src = String(v);
        void (async (): Promise<void> => {
          try {
            const bytes = await blobBytes(v);
            const canvas = bytes ? await decodeToCanvas(bytes) : null;
            if (!canvas) throw new Error('undecodable');
            this[BACKING] = canvas;
            this.width = this.naturalWidth = canvas.width;
            this.height = this.naturalHeight = canvas.height;
            this.complete = true;
            this.onload?.();
          } catch (err) {
            this.onerror?.(err);
          }
        })();
      }
    }
    target['Image'] = NodeImage;
  }

  // 4. createImageBitmap - the modern decode path, same decoder as Image.
  if (typeof target['createImageBitmap'] !== 'function') {
    target['createImageBitmap'] = async (src: unknown): Promise<unknown> => {
      const bytes = await blobBytes(src);
      const canvas = bytes ? await decodeToCanvas(bytes) : null;
      if (!canvas) throw new Error('createImageBitmap: these bytes are not a decodable image here.');
      return canvas;
    };
  }

  // 5. ImageData, for a hook that builds pixels before it has a context.
  if (typeof target['ImageData'] !== 'function') target['ImageData'] = mod.ImageData;

  return true;
}
