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
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { imageDimensions } from '@lolly/engine';
import { catalogFile } from './content-roots.ts';
import { isSvgDocument } from './format-sniff.ts';
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
  // catalogFile throws when no profile resolves here (a content-free install), which
  // this catch already treats the same way as a missing directory: system fonts.
  try { mod.GlobalFonts?.loadFontsFromDir(catalogFile('fonts')); } catch { /* system fonts it is */ }
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

/** The canvas module without the catalog's faces, or null when it is not
 *  installed. For a caller that draws no text, so loading the canvas never pays
 *  for the font scan (a couple of hundred milliseconds on a brand that ships
 *  its faces). */
async function bareCanvas(): Promise<NodeCanvasModule | null> {
  if (!isCanvasAvailable()) return null;
  try { return await loadCanvasModule(); } catch { return null; }
}

/** The canvas module, or null when it is not installed. Every caller in this
 *  package goes through here so "not installed" is one shape, not five. */
export async function nodeCanvas(): Promise<NodeCanvasModule | null> {
  const mod = await bareCanvas();
  if (mod) registerCatalogFonts(mod);
  return mod;
}

// ─── decode limits ────────────────────────────────────────────────────────────

/**
 * What decoding may allocate, for a host that decodes pictures other people send
 * (the hosted MCP server). A decode's memory follows the picture's declared size,
 * not its byte count: a 150-byte SVG that declares 20000 x 20000 pixels is a 1.6 GB
 * canvas. Each limit is checked against the size the picture states BEFORE any
 * pixels are allocated, and a picture over a limit is refused with an
 * `ImagePixelLimitError` that gives the picture's size and the limit.
 *
 * One object is shared by every decode it should bound together (one render), so
 * `budgetPixels` holds across them. No limits at all is the default: the CLI and
 * the TUI decode the user's own files.
 *
 * A known limit of the budget: it counts the pictures decoded, not the canvases a
 * hook then draws them into. Such a canvas is checked against `maxPixels` only, so
 * a render's peak memory can be a few times what its decodes alone would take.
 */
export interface DecodeLimits {
  /** The largest picture one decode accepts, in pixels (width x height). */
  maxPixels?: number;
  /** The pixels every decode sharing this object may allocate between them. */
  budgetPixels?: number;
  /** Pixels admitted so far against `budgetPixels`. */
  used?: number;
  /** Each refusal's message, in order, as thrown by the refused decode. */
  refusals?: string[];
  /** Each picture refused, once per picture, for `decodeRefusalWarnings`. */
  refused?: DecodeRefusal[];
}

/** One picture a `DecodeLimits` refused. */
export interface DecodeRefusal {
  /** The limit it was over: one picture's cap, the render's budget, or a size
   *  that could not be read before decoding. */
  limit: 'picture' | 'budget' | 'unknown-size';
  width?: number;
  height?: number;
  /** The picture's name, when the decode was given one. */
  source?: string;
  /** A digest of the picture's bytes, so a picture refused twice counts once. */
  key: string;
}

/** A decode refused by a `DecodeLimits` before it allocated anything. */
export class ImagePixelLimitError extends Error {
  override name = 'ImagePixelLimitError';
}

/** One picture's pixel cap on a hosted server: 4096 x 4096, room for a
 *  12-megapixel phone photo and at most a 64 MB RGBA canvas. */
export const HOSTED_DECODE_MAX_PIXELS = 4096 * 4096;
/** The pixels one hosted render may decode in total, so many pictures at the cap
 *  cannot add up to what one oversized picture was refused for. */
export const HOSTED_DECODE_BUDGET_PIXELS = 4 * HOSTED_DECODE_MAX_PIXELS;

/** A fresh set of the hosted limits, for one render. */
export function hostedDecodeLimits(): DecodeLimits {
  return { maxPixels: HOSTED_DECODE_MAX_PIXELS, budgetPixels: HOSTED_DECODE_BUDGET_PIXELS, used: 0, refusals: [], refused: [] };
}

const pixels = (n: number): string => n.toLocaleString('en');

/** The picture a decode is working on: its bytes, and its name when it has one. */
interface Picture { bytes: Uint8Array; source?: string | undefined }

function refuse(limits: DecodeLimits, pic: Picture, record: Omit<DecodeRefusal, 'key' | 'source'>, message: string): never {
  limits.refusals?.push(message);
  if (limits.refused) {
    const key = createHash('sha256').update(pic.bytes).digest('hex');
    const seen = limits.refused.find((r) => r.key === key && r.limit === record.limit);
    if (!seen) limits.refused.push({ ...record, key, ...(pic.source ? { source: pic.source } : {}) });
    else if (!seen.source && pic.source) seen.source = pic.source;
  }
  throw new ImagePixelLimitError(message);
}

/** Admit one picture of `w` x `h` against `limits`, or refuse the picture. */
function admit(limits: DecodeLimits | undefined, pic: Picture, w: number, h: number): void {
  if (!limits) return;
  const area = w * h;
  if (limits.maxPixels && area > limits.maxPixels) {
    refuse(limits, pic, { limit: 'picture', width: w, height: h }, `A ${w} x ${h} picture was not decoded: this server decodes pictures of up to ${pixels(limits.maxPixels)} pixels.`);
  }
  const used = limits.used ?? 0;
  if (limits.budgetPixels && used + area > limits.budgetPixels) {
    refuse(limits, pic, { limit: 'budget', width: w, height: h }, `A ${w} x ${h} picture was not decoded: this render has used ${pixels(used)} of the ${pixels(limits.budgetPixels)} pixels it may decode.`);
  }
  limits.used = used + area;
}

/**
 * Which pictures of a group were left out, as a bracketed list for a warning: each
 * one `label` gives a name, at most eight, then how many more (named or not).
 * Empty when none of them has a name.
 */
function whichPictures(group: DecodeRefusal[], label: (r: DecodeRefusal) => string | undefined): string {
  const named = group.map(label).filter((x): x is string => !!x);
  if (!named.length) return '';
  const shown = named.slice(0, 8);
  const rest = group.length - shown.length;
  const list = rest > 0
    ? `${shown.join(', ')} and ${rest} more`
    : shown.length > 1 ? `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}` : shown[0];
  return ` (${list})`;
}

/**
 * What a render's refusals come to, for the person who asked for the render: one
 * sentence per limit, giving how many pictures were left out and which, by name
 * where the decode had one. A picture refused more than once (a hook that retries)
 * counts once.
 */
export function decodeRefusalWarnings(limits: DecodeLimits | undefined): string[] {
  const refused = limits?.refused ?? [];
  const out: string[] = [];
  const size = (r: DecodeRefusal): string => `${r.width} x ${r.height}`;
  const count = (n: number): string => (n === 1 ? 'A picture was' : `${n} pictures were`);
  const over = refused.filter((r) => r.limit === 'picture');
  if (over.length === 1) {
    const r = over[0]!;
    out.push(`A ${size(r)} picture${r.source ? ` (${r.source})` : ''} was not decoded: this server decodes pictures of up to ${pixels(limits?.maxPixels ?? 0)} pixels.`);
  } else if (over.length > 1) {
    out.push(`${over.length} pictures were not decoded: this server decodes pictures of up to ${pixels(limits?.maxPixels ?? 0)} pixels, and these are larger${whichPictures(over, (r) => (r.source ? `${r.source} at ${size(r)}` : size(r)))}.`);
  }
  const budget = refused.filter((r) => r.limit === 'budget');
  if (budget.length) {
    out.push(`${count(budget.length)} not decoded: ${budget.length === 1 ? 'it' : 'each'} would have taken this render past the ${pixels(limits?.budgetPixels ?? 0)} pixels it may decode${whichPictures(budget, (r) => r.source)}.`);
  }
  const unknown = refused.filter((r) => r.limit === 'unknown-size');
  if (unknown.length) {
    out.push(`${count(unknown.length)} not decoded: this server decodes only pictures whose size it can read first${whichPictures(unknown, (r) => r.source)}.`);
  }
  return out;
}

const limited = (limits?: DecodeLimits): limits is DecodeLimits => !!(limits && (limits.maxPixels || limits.budgetPixels));

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

/** MIME sniffed from the BYTES, never a filename - the contract's own rule. An SVG
 *  is a document whose root element is `<svg>` (`isSvgDocument`). */
export function sniffImageMime(bytes: Uint8Array): string {
  for (const [mime, test] of MIME_BY_MAGIC) {
    try { if (test(bytes)) return mime; } catch { /* short buffer */ }
  }
  if (isSvgDocument(bytes)) return 'image/svg+xml';
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
 *
 * Whether the bytes are an SVG is read from the bytes, never from `mime`: Skia
 * decodes a raster eagerly, so raster bytes labelled `image/svg+xml` would
 * otherwise be decoded before the header check below could refuse them. `mime`
 * only helps size a raster whose signature the sniff does not know. `source` is
 * the picture's name, for a refusal (`decodeRefusalWarnings`).
 */
export async function decodeToCanvas(bytes: Uint8Array, mime?: string, limits?: DecodeLimits, source?: string): Promise<NodeCanvas | null> {
  const sniffed = sniffImageMime(bytes);
  const svg = sniffed === 'image/svg+xml';
  const kind = sniffed !== 'application/octet-stream' ? sniffed : (mime && mime !== 'image/svg+xml' ? mime : sniffed);
  const pic: Picture = { bytes, source };
  // Only an SVG can draw text while it decodes, so only an SVG pays for the faces.
  const mod = svg ? await nodeCanvas() : await bareCanvas();
  if (!mod) return null;
  const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sharp = svg ? null : await loadSharp();
  // A raster's size is read from its header before a decoder sees it: sharp's
  // header-only metadata, else the engine's own reader. Under a limit, a picture
  // whose size cannot be read that way is refused rather than decoded to find out.
  // An SVG's size is checked once Skia has parsed it, before its canvas exists.
  if (!svg && limited(limits)) {
    const size = await headerSize(buf, kind, sharp);
    if (!size) refuse(limits, pic, { limit: 'unknown-size' }, 'A picture was not decoded: its size could not be read before decoding, and this server decodes only pictures whose size it knows.');
    admit(limits, pic, size.w, size.h);
  }
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
    const w = Math.max(1, img.width), h = Math.max(1, img.height);
    if (svg) admit(limits, pic, w, h);
    const canvas = mod.createCanvas(w, h);
    canvas.getContext('2d').drawImage(img, 0, 0);
    return canvas;
  } catch (err) {
    if (err instanceof ImagePixelLimitError) throw err;
    return null;
  }
}

/** A raster's stored size from its header, with nothing decoded. */
async function headerSize(buf: Buffer, kind: string, sharp: SharpFn | null): Promise<{ w: number; h: number } | null> {
  if (sharp) {
    try {
      const meta = await sharp(buf).metadata();
      if (meta.width && meta.height) return { w: meta.width, h: meta.height };
    } catch { /* not a format sharp reads; the engine's reader may still know */ }
  }
  const dims = imageDimensions(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength), kind);
  return dims && dims.w > 0 && dims.h > 0 ? dims : null;
}

// ─── host.raster (the v1.105 contract) ────────────────────────────────────────

export interface NodeRasterOptions {
  readUrl?: (url: string) => Promise<Uint8Array>;
  /** Bounds `decode` and `measure` on a host that decodes other people's pictures. */
  limits?: DecodeLimits;
}

async function sourceBytes(src: RasterSource, opts: NodeRasterOptions = {}): Promise<Uint8Array> {
  if (src instanceof Uint8Array) return src;
  if (typeof src === 'string') {
    if (opts.readUrl) return opts.readUrl(src);
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
  if (ref && typeof ref.url === 'string') return sourceBytes(ref.url, opts);
  throw new Error('host.raster: unreadable source.');
}

/** A web address with an authority part (`https://host/...`). */
const WEB_URL = /^[a-z][a-z0-9+.-]*:\/\//i;

/**
 * A URL as a refusal may show it: no query, no fragment and no user name or
 * password. A signed link (an S3 `X-Amz-Signature`, a CDN token) carries its
 * secret in the query, and a refusal is written into what the render answers.
 */
function shownUrl(url: string): string {
  const s = url.trim();
  if (!WEB_URL.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.host) return `${u.protocol}//${u.host}${u.pathname}`;
  } catch { /* not parseable: cut the same parts by hand */ }
  return s.replace(/[?#].*$/s, '').replace(/^([a-z][a-z0-9+.-]*:\/\/)[^/]*@/i, '$1');
}

const shortName = (name: string): string => (name.length > 80 ? `${name.slice(0, 77)}...` : name);

/**
 * What a raster source is called, for a refusal: an asset's name or id, a file's
 * name, or the last part of a URL's path. Inline bytes (`data:`, `blob:`, a byte
 * array) have no name. A name or id that is itself a URL is shown without its
 * query, fragment or user name (`shownUrl`).
 */
export function pictureName(src: unknown): string | undefined {
  const fromUrl = (url: string): string | undefined => {
    if (/^\s*(data|blob):/i.test(url)) return undefined;
    const last = shownUrl(url).replace(/[?#].*$/s, '').split('/').filter(Boolean).pop();
    let name = last ?? '';
    try { name = decodeURIComponent(name); } catch { /* keep it as written */ }
    if (!name || /^[a-z][a-z0-9+.-]*:$/i.test(name)) return undefined;
    return shortName(name);
  };
  if (typeof src === 'string') return fromUrl(src);
  if (!src || typeof src !== 'object' || src instanceof Uint8Array) return undefined;
  const ref = src as { name?: unknown; id?: unknown; url?: unknown; meta?: { name?: unknown } };
  for (const v of [ref.meta?.name, ref.name]) if (typeof v === 'string' && v.trim()) return shortName(shownUrl(v));
  if (typeof ref.id === 'string' && ref.id.trim() && !/^\s*(data|blob):/i.test(ref.id)) return shortName(shownUrl(ref.id));
  return typeof ref.url === 'string' ? fromUrl(ref.url) : undefined;
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
export function createNodeRasterAPI(opts: NodeRasterOptions = {}): RasterAPI | null {
  if (!isCanvasAvailable()) return null;
  return {
    canRaster(): boolean {
      return isCanvasAvailable();
    },
    async measure(src: RasterSource): Promise<ImageInfo> {
      const bytes = await sourceBytes(src, opts);
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
      const canvas = await decodeToCanvas(bytes, mime, opts.limits, pictureName(src));
      if (!canvas) throw new Error('host.raster: these bytes are not a decodable image here.');
      return { width: canvas.width, height: canvas.height, mime };
    },
    async decode(src: RasterSource): Promise<ImageBitmap> {
      const bytes = await sourceBytes(src, opts);
      const canvas = await decodeToCanvas(bytes, undefined, opts.limits, pictureName(src));
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

/** Where `installNodeCanvas` keeps the realm's current decode limits on `target`. */
const LIMITS = Symbol.for('lolly.nodeCanvas.limits');

/**
 * Register the catalog's faces the first time this context touches text: setting
 * `font`, drawing text or measuring text. Skia resolves a family when text is drawn, so
 * registering just before is in time for every face a hook names.
 */
function registerFontsOnText(mod: NodeCanvasModule, cx: object): void {
  const ctx = cx as Record<string, unknown>;
  for (const name of ['fillText', 'strokeText', 'measureText']) {
    const fn = ctx[name];
    if (typeof fn !== 'function') continue;
    ctx[name] = (...args: unknown[]): unknown => { registerCatalogFonts(mod); return (fn as (...a: unknown[]) => unknown).apply(cx, args); };
  }
  let font: PropertyDescriptor | undefined;
  for (let owner: object | null = cx; owner && !font; owner = Object.getPrototypeOf(owner)) {
    font = Object.getOwnPropertyDescriptor(owner, 'font');
  }
  if (font?.get && font.set) {
    const { get, set } = font;
    Object.defineProperty(cx, 'font', {
      configurable: true,
      enumerable: true,
      get(): unknown { return get.call(cx); },
      set(v: unknown): void { registerCatalogFonts(mod); set.call(cx, v); },
    });
  }
}

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
 *
 * The module is loaded through `loadCanvasModule()`, the one lazy `import()` in
 * this file, and never through a require of its own. The hosted MCP function
 * bundle aliases that import to a module that refuses to load
 * (scripts/build-mcp-fn.ts, ABSENT_RUNTIMES), so there the install answers false
 * and the realm keeps its honest "no canvas", even if the package were on disk.
 * The CLI, the TUI and a local or self-hosted MCP server all install the canvas.
 *
 * The catalog's faces are registered the first time a realm context sets a font,
 * draws or measures text, not here: most runs never draw text in a canvas, and
 * the scan costs a couple of hundred milliseconds on a brand that ships its faces.
 *
 * `opts.limits` bounds every decode the realm's `Image` and `createImageBitmap`
 * make, and the size of every `<canvas>` it backs (one over the cap answers
 * `getContext` with null, as a browser does for a canvas it cannot allocate).
 * The shims are installed once per process, so the limits are read from `target`
 * at call time and each install replaces them.
 */
export async function installNodeCanvas(
  win: { HTMLCanvasElement?: { prototype: Record<string, unknown> }; document?: unknown },
  target: Record<string, unknown> = globalThis as unknown as Record<string, unknown>,
  opts: { limits?: DecodeLimits } = {},
): Promise<boolean> {
  const mod = await bareCanvas();
  if (!mod) return false;
  (target as Record<symbol, unknown>)[LIMITS] = opts.limits;
  const limitsNow = (): DecodeLimits | undefined => (target as Record<symbol, DecodeLimits | undefined>)[LIMITS];

  // 1. <canvas>.getContext('2d') / toBlob / toDataURL on the jsdom element.
  const proto = win?.HTMLCanvasElement?.prototype;
  if (proto && !(proto as Record<string, unknown>)['_lollyNodeCanvas']) {
    proto['_lollyNodeCanvas'] = true;
    const back = (el: WithBacking & { width?: number; height?: number }): NodeCanvas => {
      let c = el[BACKING];
      const w = Math.max(1, Math.round(Number(el.width) || 300));
      const h = Math.max(1, Math.round(Number(el.height) || 150));
      if (!c || c.width !== w || c.height !== h) {
        const cap = limitsNow()?.maxPixels;
        if (cap && w * h > cap) throw new ImagePixelLimitError(`A ${w} x ${h} canvas was not made: this server makes canvases of up to ${pixels(cap)} pixels.`);
        c = mod.createCanvas(w, h);
        // drawImage takes whatever this shim hands out (an Image shim, another
        // <canvas>), so unwrap at the one seam rather than at every call site.
        const cx = c.getContext('2d') as NodeCanvasCtx & { drawImage: (...a: unknown[]) => void };
        const orig = cx.drawImage.bind(cx);
        cx.drawImage = (img: unknown, ...rest: unknown[]): void => { orig(drawable(img), ...(rest as number[])); };
        registerFontsOnText(mod, cx);
        el[BACKING] = c;
      }
      return c;
    };
    proto['getContext'] = function getContext(this: WithBacking, kind: string): unknown {
      if (kind !== '2d') return null;
      try { return back(this).getContext('2d'); } catch (err) {
        if (err instanceof ImagePixelLimitError) return null;
        throw err;
      }
    };
    proto['toDataURL'] = function toDataURL(this: WithBacking, mime = 'image/png', quality?: number): string {
      const q = typeof quality === 'number' ? Math.max(1, Math.min(100, Math.round(quality * 100))) : undefined;
      let out: Buffer;
      try { out = q === undefined ? back(this).toBuffer(mime) : back(this).toBuffer(mime, q); } catch (err) {
        if (err instanceof ImagePixelLimitError) return 'data:,';
        throw err;
      }
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
            const canvas = bytes ? await decodeToCanvas(bytes, undefined, limitsNow()) : null;
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
      const canvas = bytes ? await decodeToCanvas(bytes, undefined, limitsNow()) : null;
      if (!canvas) throw new Error('createImageBitmap: these bytes are not a decodable image here.');
      return canvas;
    };
  }

  // 5. ImageData, for a hook that builds pixels before it has a context.
  if (typeof target['ImageData'] !== 'function') target['ImageData'] = mod.ImageData;

  return true;
}
