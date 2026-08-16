// SPDX-License-Identifier: MPL-2.0
/**
 * `host.images` for the Node shells: decode / resize / encode, backed by sharp.
 *
 * Why it exists: the contract in packages/core/src/host-v1.ts is optional and tools
 * feature-detect it, so a shell without it is "allowed". But the CLI having none at
 * all meant `lolly convert-image …` could only ever fail. sharp is already a
 * dependency of this repo and gives Node the same read-broad/write-web-safe split the
 * browser path has (HEIC, AVIF, TIFF and friends decode in; only webp/jpeg/png come
 * out), so the honest fix is to implement the contract rather than route an image
 * transform through a headless browser.
 *
 * ATTACHMENT IS CONDITIONAL. `createNodeImagesAPI()` returns null when sharp cannot be
 * resolved (a lean install, or the esbuild-bundled Vercel MCP function where bare
 * specifiers stay external). A shell then leaves `host.images` undefined, which is
 * exactly the signal the contract defines. That is better than an API present that
 * throws on every call. The resolve check is a synchronous `require.resolve`, so it
 * costs nothing; the native module itself is imported lazily on first use.
 */
import { createRequire } from 'node:module';
import type { ImagesAPI, ImageInfo, ImageResizeOpts, ImageEncodeOpts, ImageResult } from '@lolly-tools/core/host-v1';

/** The slice of sharp's surface this module uses (typed locally: sharp is an
 *  optional runtime dependency, so its types must not be a build requirement). */
interface SharpLike {
  metadata(): Promise<{ width?: number; height?: number; format?: string; pages?: number; autoOrient?: { width?: number; height?: number } }>;
  rotate(): SharpLike;
  resize(opts: { width?: number; height?: number; fit: 'inside'; withoutEnlargement: true }): SharpLike;
  toFormat(fmt: string, opts?: { quality?: number }): SharpLike;
  toBuffer(opts: { resolveWithObject: true }): Promise<{ data: Buffer; info: { width: number; height: number; format: string } }>;
}
type SharpFactory = (input: Buffer, opts?: { animated?: boolean }) => SharpLike;

const MIME: Record<string, string> = {
  jpeg: 'image/jpeg', jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  gif: 'image/gif', avif: 'image/avif', heif: 'image/heic', heic: 'image/heic',
  tiff: 'image/tiff', svg: 'image/svg+xml', bmp: 'image/bmp',
};

/** True when sharp is installed and loadable here. Sync + cheap (no native load). */
export function isImagesAvailable(): boolean {
  try {
    createRequire(import.meta.url).resolve('sharp');
    return true;
  } catch {
    return false;
  }
}

let sharpModule: Promise<SharpFactory> | null = null;
function loadSharp(): Promise<SharpFactory> {
  sharpModule ??= import('sharp').then(m => (m.default ?? m) as unknown as SharpFactory);
  return sharpModule;
}

async function toBuffer(input: Uint8Array | Blob): Promise<Buffer> {
  if (input instanceof Uint8Array) return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  return Buffer.from(await input.arrayBuffer());
}

/** Contract quality is 0..1; sharp wants 1..100. Out-of-range values clamp. */
function q100(quality: number | undefined): number | undefined {
  if (typeof quality !== 'number' || !Number.isFinite(quality)) return undefined;
  return Math.max(1, Math.min(100, Math.round((quality <= 1 ? quality * 100 : quality))));
}

/**
 * Build the API, or null when sharp is unavailable (see the module header: the
 * caller must then leave host.images undefined rather than attach a throwing stub).
 */
export function createNodeImagesAPI(): ImagesAPI | null {
  if (!isImagesAvailable()) return null;

  async function open(input: Uint8Array | Blob): Promise<{ img: SharpLike; buf: Buffer }> {
    const sharp = await loadSharp();
    const buf = await toBuffer(input);
    if (!buf.length) throw new Error('host.images: empty input - nothing to decode.');
    return { img: sharp(buf), buf };
  }

  async function finish(img: SharpLike, format: string, quality?: number): Promise<ImageResult> {
    const fmt = format === 'jpg' ? 'jpeg' : format;
    const opts = q100(quality) !== undefined && fmt !== 'png' ? { quality: q100(quality)! } : undefined;
    const { data, info } = await img.toFormat(fmt, opts).toBuffer({ resolveWithObject: true });
    return {
      bytes: new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
      mime: MIME[info.format] ?? `image/${info.format}`,
      width: info.width,
      height: info.height,
    };
  }

  return {
    async decode(input): Promise<ImageInfo> {
      const { img } = await open(input);
      // `.rotate()` with no argument applies the EXIF orientation, so the metadata
      // read after it reports the ORIENTED dimensions the contract promises. These are
      // the same ones resize/encode will produce.
      const meta = await img.rotate().metadata();
      if (!meta.width || !meta.height) {
        throw new Error('host.images: these bytes are not a decodable image here.');
      }
      const fmt = (meta.format ?? '').toLowerCase();
      return {
        width: meta.width,
        height: meta.height,
        mime: MIME[fmt] ?? (fmt ? `image/${fmt}` : 'application/octet-stream'),
        // `pages` is how sharp reports multi-frame containers (GIF/APNG/animated WebP).
        // Absent for formats it doesn't page, which is why `animated` is optional.
        ...(meta.pages !== undefined ? { animated: meta.pages > 1 } : {}),
      };
    },

    async resize(input, opts: ImageResizeOpts = {}): Promise<ImageResult> {
      const { img } = await open(input);
      const meta = await img.metadata();
      const srcFmt = (meta.format ?? 'png').toLowerCase();
      // maxEdge caps the LONGEST edge; width/height fit within a box. Both are
      // never-upscale (withoutEnlargement), which is the contract's promise and the
      // reason an already-small image comes back at its own size.
      const box: { width?: number; height?: number } = {};
      if (typeof opts.maxEdge === 'number' && opts.maxEdge > 0) {
        box.width = Math.round(opts.maxEdge);
        box.height = Math.round(opts.maxEdge);
      }
      if (typeof opts.width === 'number' && opts.width > 0) box.width = Math.round(opts.width);
      if (typeof opts.height === 'number' && opts.height > 0) box.height = Math.round(opts.height);
      // Default output: the source format where it is one we may WRITE, else PNG.
      // (The contract narrows output to webp/jpeg/png; a HEIC in becomes a PNG out
      // unless the caller pins `format`.)
      const outFmt = opts.format ?? (['jpeg', 'jpg', 'png', 'webp'].includes(srcFmt) ? srcFmt : 'png');
      let pipe = img.rotate();
      if (box.width || box.height) pipe = pipe.resize({ ...box, fit: 'inside', withoutEnlargement: true });
      return finish(pipe, outFmt, opts.quality);
    },

    async encode(input, opts: ImageEncodeOpts): Promise<ImageResult> {
      if (!opts?.format) throw new Error('host.images.encode: `format` is required (webp | jpeg | png).');
      const { img } = await open(input);
      return finish(img.rotate(), opts.format, opts.quality);
    },
  };
}
