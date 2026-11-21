// SPDX-License-Identifier: MPL-2.0
/**
 * Picture references for saved work (plan 373).
 *
 * A saved session, a revision or an export history entry used to carry its
 * picture as a data URL inside its own record, so every list of sessions read
 * every picture. From session format 5 a record carries a short reference
 * instead, and the bytes live once in a shell's preview store, keyed by the hash
 * of the bytes:
 *
 *   { key: '<32 hex>', type: 'image/svg+xml', width: 640, height: 480,
 *     route: 'export-svg', recipe?: '<32 hex>' }
 *
 * Everything here is pure and total over untrusted input: it reads bytes and
 * strings, never storage, so the web shell, both Tauri shells and the Node shell
 * agree on what a reference is and on how a picture becomes one. Storage itself
 * is each shell's own business (IndexedDB rows on the web, files under
 * `saved-state/previews/` on Tauri and in the Node session directory).
 *
 * Formats that leave the device (`.lolly`, backups, device sync, beam) still
 * carry a data URL; `pictureDataUrl` rebuilds the exact text a thumbnail writer
 * produced before this change (percent-encoded SVG, base64 raster), so a pack
 * written from stored bytes matches one written from the old field.
 */

import { sha256, bytesToHex, base64ToBytes, bytesToBin } from './bytes.ts';

/** Picture types a reference may name. SVG is drawn first when a tool can draw it;
 *  WebP is the raster form a preview writer makes; PNG is that form where the
 *  browser cannot encode WebP. JPEG, GIF and AVIF are kept only as received bytes
 *  (a pack or a backup made elsewhere), never re-encoded. */
export const PREVIEW_TYPES = ['image/svg+xml', 'image/webp', 'image/png', 'image/jpeg', 'image/gif', 'image/avif'] as const;
export type PreviewType = typeof PREVIEW_TYPES[number];

/** Which renderer drew a picture. A picture says how it was made, so a reader can
 *  tell a faithful render from bytes another build or another device supplied.
 *  `stand-in` is a picture of the document's words, drawn where a tool has nothing
 *  to photograph: not the tool's render, and the route tells a reader that. */
export const PREVIEW_ROUTES = ['export-svg', 'export-raster', 'baked', 'operations-svg', 'tool-svg', 'received', 'legacy', 'stand-in'] as const;
export type PreviewRoute = typeof PREVIEW_ROUTES[number];

/** The largest picture one entry may hold, SVG or raster. */
export const PREVIEW_MAX_BYTES = 256 * 1024;

/** The one raster size class: a picture fitted inside this box. */
export const PREVIEW_TILE = { width: 720, height: 560 } as const;

/** The largest width or height a reference may state. */
const MAX_SIDE = 32_768;

export interface SessionPreviewRef {
  /** The first 16 bytes of the SHA-256 of the picture bytes, as lower-case hex. */
  key: string;
  type: PreviewType;
  /** Intrinsic size in CSS pixels; 0 when the picture does not state one. */
  width: number;
  height: number;
  /** How the picture was drawn. Absent on references written before this field. */
  route?: PreviewRoute;
  /** The hash of the recipe that drew it, when one did. */
  recipe?: string;
  /** Byte length of the picture, when known. */
  bytes?: number;
}

const HEX32 = /^[0-9a-f]{32}$/;

/**
 * A picture reference read from untrusted storage, or null. The key must be 32
 * lower-case hex characters, the type one of PREVIEW_TYPES and the sizes whole
 * numbers in range; anything else reads as absent, never half-applied.
 */
export function readPreviewRef(value: unknown): SessionPreviewRef | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { key, type, width, height, route, recipe, bytes } = value as Record<string, unknown>;
  if (typeof key !== 'string' || !HEX32.test(key)) return null;
  if (typeof type !== 'string' || !(PREVIEW_TYPES as readonly string[]).includes(type)) return null;
  const side = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= MAX_SIDE;
  if (!side(width) || !side(height)) return null;
  const ref: SessionPreviewRef = { key, type: type as PreviewType, width, height };
  if (typeof route === 'string' && (PREVIEW_ROUTES as readonly string[]).includes(route)) ref.route = route as PreviewRoute;
  if (typeof recipe === 'string' && HEX32.test(recipe)) ref.recipe = recipe;
  if (typeof bytes === 'number' && Number.isInteger(bytes) && bytes > 0 && bytes <= 64 * 1024 * 1024) ref.bytes = bytes;
  return ref;
}

/** The content key of picture bytes: SHA-256, first 16 bytes, hex. */
export async function previewContentKey(bytes: Uint8Array): Promise<string> {
  return bytesToHex((await sha256(bytes)).subarray(0, 16));
}

/** The file extension a stored picture takes on disk and in a pack. */
export function previewFileExt(type: PreviewType): string {
  return type === 'image/svg+xml' ? 'svg' : type === 'image/jpeg' ? 'jpg' : type.slice('image/'.length);
}

/** How a data URL carried its payload, so the same text can be written again. */
export type DataUrlForm = 'base64' | 'percent';

export interface DecodedPicture {
  bytes: Uint8Array;
  type: PreviewType;
  form: DataUrlForm;
}

/**
 * The bytes of an image data URL, or null when the URL is not one of
 * PREVIEW_TYPES or does not decode. Accepts the two forms thumbnail writers use:
 * `data:image/svg+xml,<percent-encoded>` and `data:image/<type>;base64,<...>`,
 * with any media-type parameters in between.
 */
export function decodePictureDataUrl(url: unknown): DecodedPicture | null {
  if (typeof url !== 'string' || !url.startsWith('data:')) return null;
  const comma = url.indexOf(',');
  if (comma < 0) return null;
  const head = url.slice(5, comma).split(';').map(part => part.trim());
  const type = (head[0] ?? '').toLowerCase() === 'image/jpg' ? 'image/jpeg' : (head[0] ?? '').toLowerCase();
  if (!(PREVIEW_TYPES as readonly string[]).includes(type)) return null;
  const base64 = head.slice(1).some(part => part.toLowerCase() === 'base64');
  const payload = url.slice(comma + 1);
  try {
    if (base64) {
      const bytes = base64ToBytes(payload.replace(/\s+/g, ''));
      return bytes.length ? { bytes, type: type as PreviewType, form: 'base64' } : null;
    }
    const text = decodeURIComponent(payload);
    const bytes = new TextEncoder().encode(text);
    return bytes.length ? { bytes, type: type as PreviewType, form: 'percent' } : null;
  } catch {
    return null;
  }
}

/**
 * The data URL a thumbnail writer produced for these bytes before plan 373: SVG
 * as `data:image/svg+xml,` plus `encodeURIComponent(text)`, every other type as
 * base64. `form` overrides that choice, for bytes that arrived the other way.
 */
export function pictureDataUrl(bytes: Uint8Array, type: PreviewType, form?: DataUrlForm): string {
  const percent = form ? form === 'percent' : type === 'image/svg+xml';
  if (percent) return `data:${type},${encodeURIComponent(new TextDecoder().decode(bytes))}`;
  return `data:${type};base64,${btoa(bytesToBin(bytes))}`;
}

const u16be = (b: Uint8Array, i: number): number => (b[i]! << 8) | b[i + 1]!;
const u32be = (b: Uint8Array, i: number): number => ((b[i]! << 24) >>> 0) + (b[i + 1]! << 16) + (b[i + 2]! << 8) + b[i + 3]!;
const u24le = (b: Uint8Array, i: number): number => b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16);

/** A CSS length in px from an SVG width/height attribute, or 0. */
function svgLength(value: string | undefined): number {
  if (!value) return 0;
  const m = /^\s*([0-9]*\.?[0-9]+)\s*(px)?\s*$/i.exec(value);
  return m ? Math.round(Number(m[1])) : 0;
}

/**
 * The intrinsic size a picture states, read from its header alone (no decoder):
 * PNG IHDR, the WebP chunk header, the JPEG start-of-frame, the GIF screen
 * descriptor, the AVIF `ispe` box, or an SVG root's width, height and viewBox.
 * `{ width: 0, height: 0 }` when the header does not say.
 */
export function pictureSize(bytes: Uint8Array, type: PreviewType): { width: number; height: number } {
  const none = { width: 0, height: 0 };
  const clampSide = (w: number, h: number) => (w > 0 && h > 0 && w <= MAX_SIDE && h <= MAX_SIDE ? { width: w, height: h } : none);
  try {
    if (type === 'image/png') {
      if (bytes.length < 24 || bytes[12] !== 0x49 || bytes[13] !== 0x48) return none;
      return clampSide(u32be(bytes, 16), u32be(bytes, 20));
    }
    if (type === 'image/gif') {
      if (bytes.length < 10) return none;
      return clampSide(bytes[6]! | (bytes[7]! << 8), bytes[8]! | (bytes[9]! << 8));
    }
    if (type === 'image/webp') {
      if (bytes.length < 30) return none;
      const chunk = String.fromCharCode(bytes[12]!, bytes[13]!, bytes[14]!, bytes[15]!);
      if (chunk === 'VP8X') return clampSide(u24le(bytes, 24) + 1, u24le(bytes, 27) + 1);
      if (chunk === 'VP8L') {
        const b0 = bytes[21]!, b1 = bytes[22]!, b2 = bytes[23]!, b3 = bytes[24]!;
        return clampSide(1 + (((b1 & 0x3f) << 8) | b0), 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)));
      }
      if (chunk === 'VP8 ') return clampSide((bytes[26]! | (bytes[27]! << 8)) & 0x3fff, (bytes[28]! | (bytes[29]! << 8)) & 0x3fff);
      return none;
    }
    if (type === 'image/jpeg') {
      let i = 2;
      while (i + 9 < bytes.length) {
        if (bytes[i] !== 0xff) { i++; continue; }
        const marker = bytes[i + 1]!;
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return clampSide(u16be(bytes, i + 7), u16be(bytes, i + 5));
        }
        if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
        i += 2 + u16be(bytes, i + 2);
      }
      return none;
    }
    if (type === 'image/avif') {
      for (let i = 4; i + 16 <= bytes.length && i < 4096; i++) {
        if (bytes[i] === 0x69 && bytes[i + 1] === 0x73 && bytes[i + 2] === 0x70 && bytes[i + 3] === 0x65) {
          return clampSide(u32be(bytes, i + 8), u32be(bytes, i + 12));
        }
      }
      return none;
    }
    // SVG: the root element's own width/height, else its viewBox.
    const head = new TextDecoder().decode(bytes.subarray(0, 4096));
    const root = /<svg\b([^>]*)>/i.exec(head)?.[1] ?? '';
    const attr = (name: string): string | undefined => new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(root)?.[1];
    const w = svgLength(attr('width')), h = svgLength(attr('height'));
    if (w && h) return clampSide(w, h);
    const box = attr('viewBox')?.trim().split(/[\s,]+/).map(Number);
    if (box && box.length === 4 && box.every(Number.isFinite)) return clampSide(Math.round(box[2]!), Math.round(box[3]!));
    return none;
  } catch {
    return none;
  }
}

/**
 * Whether bytes look like the type they claim: the magic number for a raster, an
 * `<svg` root for SVG. A picture that fails this is not stored, because a
 * renamed file is the commonest way junk reaches a thumbnail field.
 */
export function pictureMatchesType(bytes: Uint8Array, type: PreviewType): boolean {
  const ascii = (at: number, s: string): boolean => [...s].every((c, i) => bytes[at + i] === c.charCodeAt(0));
  switch (type) {
    case 'image/png': return bytes.length > 8 && bytes[0] === 0x89 && ascii(1, 'PNG');
    case 'image/jpeg': return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8;
    case 'image/gif': return ascii(0, 'GIF8');
    case 'image/webp': return ascii(0, 'RIFF') && ascii(8, 'WEBP');
    case 'image/avif': return ascii(4, 'ftyp');
    case 'image/svg+xml': return /<svg[\s>]/i.test(new TextDecoder().decode(bytes.subarray(0, 4096)));
    default: return false;
  }
}

/** A picture reference for bytes, or null when they are not a picture of `type`. */
export async function previewRefFor(bytes: Uint8Array, type: PreviewType, facts: { route: PreviewRoute; recipe?: string }): Promise<SessionPreviewRef | null> {
  if (!bytes.length || !pictureMatchesType(bytes, type)) return null;
  const { width, height } = pictureSize(bytes, type);
  return {
    key: await previewContentKey(bytes), type, width, height, route: facts.route,
    ...(facts.recipe && HEX32.test(facts.recipe) ? { recipe: facts.recipe } : {}), bytes: bytes.length,
  };
}
