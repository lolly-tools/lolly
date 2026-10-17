// SPDX-License-Identifier: MPL-2.0
/**
 * Facts read from a finished export's bytes: container, pixel and page size,
 * page count, timing, alpha channel, colour model, metadata, credential
 * presence, encryption and fonts.
 *
 * This is the measuring half of the export report (`preflight-output.ts`
 * compares these facts with the request). Every member is a `Fact`: a value
 * the bytes do not carry, or that a bounded reader could not reach, is an
 * unknown with a reason. An absent fact is never written as zero or false.
 *
 * Pure and total: no DOM, no I/O, no clock, and `inspectOutput` never throws.
 * Each container reader runs under a guard, walks with explicit caps, and a
 * reader that fails leaves its facts unknown and records a limit.
 *
 * Linear in time as well as bounded in size, because `inspectOutput` runs on
 * the web shell's main thread after an export. A cap on the number of objects
 * does not stop a scan that is itself proportional to the rest of the file, so
 * no text scan here may restart from every later position: searches only move
 * forward, number runs use bounded counts, and no pattern ends in an unbounded
 * `[^>]*` or `[^\]]*` that a missing delimiter would rescan.
 * `tests/output-facts.test.ts` holds the inputs that once broke this.
 */

import type { Fact, UnknownReason } from '@lolly-tools/core';
import { Unzlib, unzlibSync } from 'fflate';
import { sniffFormat, type SniffedFormat } from './format-sniff.ts';
import { scanJpegSegments, JPEG_APP_IDS } from './jpeg-segments.ts';
import { readMpfIndex } from './file-metadata.ts';
import { extractC2paStore } from './c2pa-extract.ts';

/** Largest file inspected at all. Above this only the container and size are reported. */
export const OUTPUT_INSPECT_MAX_BYTES = 512 * 1024 * 1024;
/** Largest text-based file (PDF, SVG, EPS) scanned as text. */
export const OUTPUT_TEXT_SCAN_MAX_BYTES = 64 * 1024 * 1024;
/** Total bytes inflated from PDF streams for one file. */
export const OUTPUT_PDF_INFLATE_BUDGET = 32 * 1024 * 1024;
/** Most chunks, boxes, blocks or entries walked in one container. */
export const OUTPUT_MAX_STRUCTURES = 200_000;

export type OutputNature = 'raster' | 'vector' | 'mixed' | 'archive';
export type OutputColour = 'rgb' | 'cmyk' | 'gray' | 'indexed' | 'mixed';

/**
 * A page or artboard size in points (1/72 inch), and the box it was read from.
 * An SVG print sheet reports `TrimBox` from its `data-trim-box`, or `MediaBox`
 * when the root carries only `data-media-box`; any other SVG root is `svg-root`.
 */
export interface OutputPage {
  readonly width: number;
  readonly height: number;
  readonly box: 'TrimBox' | 'MediaBox' | 'BoundingBox' | 'svg-root';
  /** False when a later page has a different size from the first. */
  readonly uniform: boolean;
}

/** PDF fonts: font dictionaries, those with an embedded program, and unembedded standard faces. */
export interface OutputFonts {
  readonly declared: number;
  readonly embedded: number;
  readonly standard: number;
}

export interface OutputFacts {
  /** The container read from the bytes, or null when no signature matched. */
  readonly container: SniffedFormat | null;
  readonly bytes: number;
  readonly nature: Fact<OutputNature>;
  /** Pixel size of a raster or video frame, or of an SVG whose root is in pixels. */
  readonly width: Fact<number>;
  readonly height: Fact<number>;
  /** Physical size in points: a PDF page box, an EPS bounding box, an SVG root in physical units. */
  readonly page: Fact<OutputPage>;
  readonly pages: Fact<number>;
  /** Raster resolution recorded in the file, in dots per inch. */
  readonly dpi: Fact<number>;
  readonly durationMs: Fact<number>;
  readonly frames: Fact<number>;
  /** An alpha channel or transparency key is present. It does not prove a transparent pixel. */
  readonly alpha: Fact<boolean>;
  readonly colour: Fact<OutputColour>;
  /** An embedded ICC profile or PDF output intent is present. */
  readonly icc: Fact<boolean>;
  /** The file signals a high dynamic range transfer (PQ or HLG) or carries a gain map. */
  readonly hdr: Fact<boolean>;
  /** Descriptive metadata (XMP, EXIF, text chunks, a PDF Info dictionary or tags) is present. */
  readonly metadata: Fact<boolean>;
  /** A C2PA manifest store is present. Presence is not verification. */
  readonly credential: Fact<boolean>;
  readonly encrypted: Fact<boolean>;
  readonly fonts: Fact<OutputFonts>;
  /** SVG `<text>` elements, which depend on the viewer's fonts. */
  readonly liveText: Fact<number>;
  /** SVG `@font-face` rules carried inside the file. */
  readonly fontFaces: Fact<number>;
  /** Where each known value came from, keyed by fact name. */
  readonly basis: Readonly<Record<string, string>>;
  /** What the readers could not examine, as stable codes. */
  readonly limits: readonly string[];
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type Builder = Mutable<Omit<OutputFacts, 'basis' | 'limits'>> & { basis: Record<string, string>; limits: string[] };

const known = <T>(value: T): Fact<T> => ({ known: true, value });
const unknown = <T>(why: UnknownReason): Fact<T> => ({ known: false, why });

/** Containers that have a C2PA binding, so a missing store is a fact about the file. */
const CREDENTIAL_CONTAINERS: ReadonlySet<SniffedFormat> = new Set([
  'png', 'apng', 'jpg', 'gif', 'webp', 'avif', 'heic', 'tiff', 'pdf', 'svg', 'mp4', 'webm',
]);

const u16be = (b: Uint8Array, o: number): number => ((b[o] ?? 0) << 8) | (b[o + 1] ?? 0);
const u32be = (b: Uint8Array, o: number): number => (((b[o] ?? 0) << 24) | ((b[o + 1] ?? 0) << 16) | ((b[o + 2] ?? 0) << 8) | (b[o + 3] ?? 0)) >>> 0;
const u16le = (b: Uint8Array, o: number): number => (b[o] ?? 0) | ((b[o + 1] ?? 0) << 8);
const u24le = (b: Uint8Array, o: number): number => (b[o] ?? 0) | ((b[o + 1] ?? 0) << 8) | ((b[o + 2] ?? 0) << 16);
const u32le = (b: Uint8Array, o: number): number => ((b[o] ?? 0) | ((b[o + 1] ?? 0) << 8) | ((b[o + 2] ?? 0) << 16) | ((b[o + 3] ?? 0) << 24)) >>> 0;
const tag4 = (b: Uint8Array, o: number): string => String.fromCharCode(b[o] ?? 0, b[o + 1] ?? 0, b[o + 2] ?? 0, b[o + 3] ?? 0);
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Latin-1 view of a byte range, built in chunks so a large file does not overflow the call stack. */
function latin1(b: Uint8Array, start = 0, end = b.length): string {
  let s = '';
  for (let i = start; i < end; i += 0x8000) s += String.fromCharCode(...b.subarray(i, Math.min(end, i + 0x8000)));
  return s;
}

/**
 * Every fact this module can state about one file.
 *
 * Total: a reader that throws, runs out of input or reaches a cap leaves its
 * facts unknown (`'not-resolved'`) and records a limit. A property the
 * container cannot carry at all is unknown with `'not-computable'`.
 */
export function inspectOutput(input: Uint8Array): OutputFacts {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(0);
  let container: SniffedFormat | null = null;
  try { container = sniffFormat(bytes); } catch { container = null; }
  const f: Builder = {
    container, bytes: bytes.length,
    nature: unknown('not-computable'), width: unknown('not-computable'), height: unknown('not-computable'),
    page: unknown('not-computable'), pages: unknown('not-computable'), dpi: unknown('not-computable'),
    durationMs: unknown('not-computable'), frames: unknown('not-computable'), alpha: unknown('not-computable'),
    colour: unknown('not-computable'), icc: unknown('not-computable'), hdr: unknown('not-computable'),
    metadata: unknown('not-computable'), credential: unknown('not-computable'), encrypted: unknown('not-computable'),
    fonts: unknown('not-computable'), liveText: unknown('not-computable'), fontFaces: unknown('not-computable'),
    basis: {}, limits: [],
  };
  if (bytes.length > OUTPUT_INSPECT_MAX_BYTES) {
    f.limits.push('over-inspection-budget');
    return f;
  }
  const reader = container ? READERS[container] : undefined;
  if (reader) {
    try { reader(bytes, f); } catch {
      f.limits.push(`${container}-reader-failed`);
    }
  }
  f.limits = [...new Set(f.limits)];
  if (container && CREDENTIAL_CONTAINERS.has(container)) {
    try {
      f.credential = known(extractC2paStore(bytes) !== null);
      f.basis.credential = `${container}.c2pa-store`;
    } catch {
      f.credential = unknown('not-resolved');
      f.limits.push('credential-reader-failed');
    }
  }
  return f;
}

type Reader = (b: Uint8Array, f: Builder) => void;

// ─── PNG and APNG ───────────────────────────────────────────────────────────

const readPng: Reader = (b, f) => {
  let at = 8, n = 0, colourType = -1, trns = false, iccFound = false, cicpTransfer = -1;
  let declaredFrames = 0, fctl = 0, delayMs = 0, meta = false, dpi: number | null = null, ended = false;
  while (at + 12 <= b.length && n++ < OUTPUT_MAX_STRUCTURES) {
    const len = u32be(b, at), type = tag4(b, at + 4), d = at + 8;
    if (d + len + 4 > b.length) { f.limits.push('png-truncated'); break; }
    if (type === 'IHDR' && len >= 13) {
      f.width = known(u32be(b, d)); f.height = known(u32be(b, d + 4));
      f.basis.width = f.basis.height = 'png.IHDR';
      colourType = b[d + 9] ?? -1;
    } else if (type === 'tRNS') trns = true;
    else if (type === 'pHYs' && len >= 9 && b[d + 8] === 1) dpi = round2(u32be(b, d) * 0.0254);
    else if (type === 'iCCP') iccFound = true;
    else if (type === 'cICP' && len >= 4) cicpTransfer = b[d + 1] ?? -1;
    else if (type === 'acTL' && len >= 8) declaredFrames = u32be(b, d);
    else if (type === 'fcTL' && len >= 26) {
      fctl++;
      const num = u16be(b, d + 20), den = u16be(b, d + 22) || 100;
      delayMs += (num / den) * 1000;
    } else if (type === 'tEXt' || type === 'zTXt' || type === 'iTXt' || type === 'eXIf') meta = true;
    else if (type === 'IEND') { ended = true; break; }
    at = d + len + 4;
  }
  if (colourType < 0) return;
  f.nature = known('raster'); f.basis.nature = 'png.IHDR';
  f.alpha = known(colourType === 4 || colourType === 6 || trns); f.basis.alpha = trns ? 'png.tRNS' : 'png.IHDR.colourType';
  f.colour = known(colourType === 3 ? 'indexed' : colourType === 0 || colourType === 4 ? 'gray' : 'rgb'); f.basis.colour = 'png.IHDR.colourType';
  f.icc = known(iccFound); f.basis.icc = 'png.iCCP';
  f.hdr = known(cicpTransfer === 16 || cicpTransfer === 18); f.basis.hdr = 'png.cICP';
  f.dpi = dpi === null ? unknown('not-set') : known(dpi); if (dpi !== null) f.basis.dpi = 'png.pHYs';
  f.pages = known(1); f.basis.pages = 'png';
  if (ended) { f.metadata = known(meta); f.basis.metadata = 'png.text-chunks'; }
  else f.metadata = unknown('not-resolved');
  if (declaredFrames > 0) {
    f.frames = known(declaredFrames); f.basis.frames = 'png.acTL';
    if (fctl === declaredFrames && ended) { f.durationMs = known(Math.round(delayMs)); f.basis.durationMs = 'png.fcTL'; }
    else f.durationMs = unknown('not-resolved');
  } else {
    f.frames = known(1); f.basis.frames = 'png';
  }
};

// ─── JPEG ───────────────────────────────────────────────────────────────────

const readJpeg: Reader = (b, f) => {
  const scan = scanJpegSegments(b);
  if (!scan) return;
  let components = 0, meta = false, iccFound = false, dpi: number | null = null;
  for (const seg of scan.segments) {
    const m = seg.marker, p = seg.start + 4;
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc && !components) {
      f.height = known(u16be(b, p + 1)); f.width = known(u16be(b, p + 3));
      f.basis.width = f.basis.height = 'jpeg.SOF';
      components = b[p + 5] ?? 0;
    } else if (m === 0xe0 && seg.appId === JPEG_APP_IDS.JFIF) {
      const units = b[p + 7], density = u16be(b, p + 8);
      if (density > 0 && units === 1) dpi = density;
      else if (density > 0 && units === 2) dpi = round2(density * 2.54);
    } else if (m === 0xe1 && (seg.appId === JPEG_APP_IDS.EXIF || seg.appId === JPEG_APP_IDS.XMP)) meta = true;
    else if (m === 0xe2 && seg.appId === JPEG_APP_IDS.ICC) iccFound = true;
  }
  if (!components) return;
  f.nature = known('raster'); f.basis.nature = 'jpeg.SOF';
  f.alpha = known(false); f.basis.alpha = 'jpeg';
  f.colour = known(components === 4 ? 'cmyk' : components === 1 ? 'gray' : 'rgb'); f.basis.colour = 'jpeg.SOF.components';
  f.icc = known(iccFound); f.basis.icc = 'jpeg.APP2';
  f.metadata = known(meta); f.basis.metadata = 'jpeg.APP1';
  f.dpi = dpi === null ? unknown('not-set') : known(dpi); if (dpi !== null) f.basis.dpi = 'jpeg.JFIF';
  let gainMap = false;
  try { gainMap = readMpfIndex(b)?.gainMap === true; } catch { f.limits.push('jpeg-mpf-reader-failed'); }
  f.hdr = known(gainMap); f.basis.hdr = 'jpeg.MPF.gain-map';
  f.frames = known(1); f.basis.frames = 'jpeg';
  f.pages = known(1); f.basis.pages = 'jpeg';
};

// ─── WebP ───────────────────────────────────────────────────────────────────

const readWebp: Reader = (b, f) => {
  let at = 12, n = 0, alpha = false, anim = false, frames = 0, delay = 0, iccFound = false, meta = false, sized = false;
  const end = Math.min(b.length, 8 + u32le(b, 4));
  while (at + 8 <= end && n++ < OUTPUT_MAX_STRUCTURES) {
    const type = tag4(b, at), len = u32le(b, at + 4), d = at + 8;
    if (d + len > b.length) { f.limits.push('webp-truncated'); break; }
    if (type === 'VP8X' && len >= 10) {
      const flags = b[d] ?? 0;
      alpha ||= (flags & 0x10) !== 0; anim ||= (flags & 0x02) !== 0;
      iccFound ||= (flags & 0x20) !== 0; meta ||= (flags & 0x0c) !== 0;
      f.width = known(1 + u24le(b, d + 4)); f.height = known(1 + u24le(b, d + 7)); sized = true;
      f.basis.width = f.basis.height = 'webp.VP8X';
    } else if (type === 'VP8L' && len >= 5 && !sized) {
      const bits = u32le(b, d + 1);
      f.width = known((bits & 0x3fff) + 1); f.height = known(((bits >>> 14) & 0x3fff) + 1); sized = true;
      alpha ||= ((bits >>> 28) & 1) === 1;
      f.basis.width = f.basis.height = 'webp.VP8L';
    } else if (type === 'VP8 ' && len >= 10 && !sized) {
      f.width = known(u16le(b, d + 6) & 0x3fff); f.height = known(u16le(b, d + 8) & 0x3fff); sized = true;
      f.basis.width = f.basis.height = 'webp.VP8';
    } else if (type === 'ALPH') alpha = true;
    else if (type === 'ICCP') iccFound = true;
    else if (type === 'EXIF' || type === 'XMP ') meta = true;
    else if (type === 'ANMF' && len >= 16) { frames++; delay += u24le(b, d + 12); }
    at = d + len + (len & 1);
  }
  if (!sized) return;
  f.nature = known('raster'); f.basis.nature = 'webp';
  f.alpha = known(alpha); f.basis.alpha = 'webp.VP8X.ALPH';
  f.colour = known('rgb'); f.basis.colour = 'webp';
  f.icc = known(iccFound); f.basis.icc = 'webp.ICCP';
  f.metadata = known(meta); f.basis.metadata = 'webp.EXIF.XMP';
  f.hdr = known(false); f.basis.hdr = 'webp';
  f.frames = known(anim ? frames : 1); f.basis.frames = anim ? 'webp.ANMF' : 'webp';
  if (anim) { f.durationMs = known(delay); f.basis.durationMs = 'webp.ANMF'; }
  f.pages = known(1); f.basis.pages = 'webp';
};

// ─── GIF ────────────────────────────────────────────────────────────────────

/** Skip GIF data sub-blocks (length-prefixed, zero-terminated) from `p`. */
function skipSubBlocks(b: Uint8Array, p: number): number {
  let guard = 0;
  while (p < b.length && guard++ < OUTPUT_MAX_STRUCTURES) {
    const len = b[p] ?? 0;
    p += 1;
    if (len === 0) return p;
    p += len;
  }
  return b.length + 1;
}

const readGif: Reader = (b, f) => {
  if (b.length < 13) return;
  f.width = known(u16le(b, 6)); f.height = known(u16le(b, 8)); f.basis.width = f.basis.height = 'gif.screen';
  let p = 13;
  const packed = b[10] ?? 0;
  if (packed & 0x80) p += 3 * (1 << ((packed & 0x07) + 1));
  let frames = 0, delayCs = 0, transparent = false, meta = false, ended = false, guard = 0;
  while (p < b.length && guard++ < OUTPUT_MAX_STRUCTURES) {
    const block = b[p++];
    if (block === 0x3b) { ended = true; break; }
    if (block === 0x2c) {
      frames++;
      const lp = b[p + 8] ?? 0;
      p += 9;
      if (lp & 0x80) p += 3 * (1 << ((lp & 0x07) + 1));
      p = skipSubBlocks(b, p + 1);
    } else if (block === 0x21) {
      const label = b[p] ?? 0;
      if (label === 0xf9 && (b[p + 1] ?? 0) >= 4) {
        transparent ||= ((b[p + 2] ?? 0) & 1) === 1;
        delayCs += u16le(b, p + 3);
      } else if (label === 0xfe) meta = true;
      else if (label === 0xff && latin1(b, p + 2, Math.min(b.length, p + 13)) === 'XMP DataXMP') meta = true;
      p = skipSubBlocks(b, p + 1);
    } else break;
  }
  f.nature = known('raster'); f.basis.nature = 'gif';
  f.colour = known('indexed'); f.basis.colour = 'gif';
  f.icc = known(false); f.basis.icc = 'gif';
  f.hdr = known(false); f.basis.hdr = 'gif';
  f.pages = known(1); f.basis.pages = 'gif';
  if (!ended) { f.limits.push('gif-truncated'); f.alpha = unknown('not-resolved'); f.frames = unknown('not-resolved'); return; }
  f.alpha = known(transparent); f.basis.alpha = 'gif.GCE.transparency';
  f.frames = known(frames); f.basis.frames = 'gif.image-descriptors';
  f.metadata = known(meta); f.basis.metadata = 'gif.extensions';
  if (frames > 1) { f.durationMs = known(delayCs * 10); f.basis.durationMs = 'gif.GCE.delay'; }
};

// ─── TIFF ───────────────────────────────────────────────────────────────────

const readTiff: Reader = (b, f) => {
  const le = b[0] === 0x49;
  const u16 = (o: number): number => (le ? u16le(b, o) : u16be(b, o));
  const u32 = (o: number): number => (le ? u32le(b, o) : u32be(b, o));
  let ifd = u32(4), pages = 0, guard = 0;
  const seen = new Set<number>();
  const tags = new Map<number, { type: number; count: number; at: number }>();
  while (ifd > 0 && ifd + 2 <= b.length && !seen.has(ifd) && guard++ < 1024) {
    seen.add(ifd);
    const count = u16(ifd);
    if (ifd + 2 + count * 12 + 4 > b.length) { f.limits.push('tiff-truncated'); break; }
    if (pages === 0) {
      for (let i = 0; i < count; i++) {
        const e = ifd + 2 + i * 12;
        tags.set(u16(e), { type: u16(e + 2), count: u32(e + 4), at: e + 8 });
      }
    }
    pages++;
    ifd = u32(ifd + 2 + count * 12);
  }
  const value = (tag: number): number | null => {
    const t = tags.get(tag);
    if (!t) return null;
    return t.type === 3 ? u16(t.at) : u32(t.at);
  };
  const width = value(256), height = value(257);
  if (width === null || height === null) return;
  f.width = known(width); f.height = known(height); f.basis.width = f.basis.height = 'tiff.IFD0';
  f.nature = known('raster'); f.basis.nature = 'tiff';
  f.pages = known(pages); f.basis.pages = 'tiff.IFD-chain';
  f.frames = known(1); f.basis.frames = 'tiff';
  const photometric = value(262), extra = tags.get(338);
  // ExtraSamples: 1 is associated alpha, 2 unassociated, 0 unspecified data.
  const extraKind = extra ? u16(extra.count <= 2 ? extra.at : u32(extra.at)) : null;
  f.alpha = known(extraKind === 1 || extraKind === 2); f.basis.alpha = 'tiff.ExtraSamples';
  if (photometric !== null) {
    const colour: OutputColour | null = photometric === 5 ? 'cmyk' : photometric <= 1 ? 'gray' : photometric === 3 ? 'indexed' : photometric === 2 || photometric === 6 ? 'rgb' : null;
    f.colour = colour ? known(colour) : unknown('not-computable'); if (colour) f.basis.colour = 'tiff.PhotometricInterpretation';
  }
  f.icc = known(tags.has(34675)); f.basis.icc = 'tiff.ICCProfile';
  f.metadata = known([270, 305, 306, 315, 700, 33432, 34665].some(t => tags.has(t))); f.basis.metadata = 'tiff.IFD0';
  f.hdr = unknown('not-computable');
  const xres = tags.get(282);
  if (xres && xres.type === 5) {
    const off = u32(xres.at), num = u32(off), den = u32(off + 4) || 1;
    const unit = value(296) ?? 2;
    if (num > 0 && unit !== 1) { f.dpi = known(round2(unit === 3 ? (num / den) * 2.54 : num / den)); f.basis.dpi = 'tiff.XResolution'; }
    else f.dpi = unknown('not-set');
  } else f.dpi = unknown('not-set');
};

// ─── ISO base media: MP4, AVIF, HEIC ────────────────────────────────────────

interface Box { readonly type: string; readonly start: number; readonly data: number; readonly end: number }

/** Sibling boxes in [start, end), including 64-bit sizes. Stops at the first malformed box. */
function boxes(b: Uint8Array, start: number, end: number): Box[] {
  const out: Box[] = [];
  let at = start;
  while (at + 8 <= end && out.length < 10_000) {
    let size = u32be(b, at), header = 8;
    const type = tag4(b, at + 4);
    if (size === 1) {
      if (at + 16 > end) break;
      size = u32be(b, at + 8) * 0x1_0000_0000 + u32be(b, at + 12);
      header = 16;
    } else if (size === 0) size = end - at;
    if (size < header || at + size > end) break;
    out.push({ type, start: at, data: at + header, end: at + size });
    at += size;
  }
  return out;
}
const child = (b: Uint8Array, box: Box | undefined, type: string, skip = 0): Box | undefined =>
  box ? boxes(b, box.data + skip, box.end).find(x => x.type === type) : undefined;

/** The colour-information box payload: transfer characteristic for nclx, or an ICC flag. */
function colr(b: Uint8Array, box: Box): { transfer: number | null; icc: boolean } {
  const kind = tag4(b, box.data);
  if (kind === 'nclx' && box.end - box.data >= 7) return { transfer: u16be(b, box.data + 6), icc: false };
  return { transfer: null, icc: kind === 'prof' || kind === 'rICC' };
}

const readHeif: Reader = (b, f) => {
  const top = boxes(b, 0, b.length);
  const meta = top.find(x => x.type === 'meta');
  const iprp = child(b, meta, 'iprp', 4), ipco = child(b, iprp, 'ipco');
  if (!ipco) return;
  let w = 0, h = 0, alpha = false, iccFound = false, transfer: number | null = null;
  for (const p of boxes(b, ipco.data, ipco.end)) {
    if (p.type === 'ispe' && p.end - p.data >= 12) {
      const pw = u32be(b, p.data + 4), ph = u32be(b, p.data + 8);
      if (pw * ph > w * h) { w = pw; h = ph; }
    } else if (p.type === 'colr') {
      const c = colr(b, p); iccFound ||= c.icc; if (c.transfer !== null) transfer = c.transfer;
    } else if (p.type === 'auxC') {
      const urn = latin1(b, p.data + 4, Math.min(p.end, p.data + 84));
      alpha ||= urn.includes('auxiliary:alpha') || urn.includes('auxid:1');
    }
  }
  if (!w || !h) return;
  f.width = known(w); f.height = known(h); f.basis.width = f.basis.height = 'heif.ispe';
  f.nature = known('raster'); f.basis.nature = 'heif';
  f.alpha = known(alpha); f.basis.alpha = 'heif.auxC';
  f.icc = known(iccFound); f.basis.icc = 'heif.colr';
  f.hdr = known(transfer === 16 || transfer === 18); f.basis.hdr = 'heif.colr.nclx';
  f.colour = known('rgb'); f.basis.colour = 'heif';
  const iinf = child(b, meta, 'iinf', 4);
  if (iinf) {
    const text = latin1(b, iinf.data, Math.min(iinf.end, iinf.data + 65_536));
    f.metadata = known(text.includes('Exif') || text.includes('application/rdf+xml')); f.basis.metadata = 'heif.iinf';
  }
  f.frames = known(1); f.basis.frames = 'heif';
  f.pages = known(1); f.basis.pages = 'heif';
};

const readMp4: Reader = (b, f) => {
  const moov = boxes(b, 0, b.length).find(x => x.type === 'moov');
  if (!moov) { f.limits.push('mp4-no-moov'); return; }
  const kids = boxes(b, moov.data, moov.end);
  const mvhd = kids.find(x => x.type === 'mvhd');
  if (mvhd) {
    const v1 = b[mvhd.data] === 1;
    const scale = u32be(b, mvhd.data + (v1 ? 20 : 12));
    const dur = v1 ? u32be(b, mvhd.data + 24) * 0x1_0000_0000 + u32be(b, mvhd.data + 28) : u32be(b, mvhd.data + 16);
    if (scale > 0) { f.durationMs = known(Math.round((dur / scale) * 1000)); f.basis.durationMs = 'mp4.mvhd'; }
  }
  let transfer: number | null = null, video = false;
  for (const trak of kids.filter(x => x.type === 'trak')) {
    const mdia = child(b, trak, 'mdia');
    const hdlr = child(b, mdia, 'hdlr');
    if (!hdlr || tag4(b, hdlr.data + 8) !== 'vide') continue;
    video = true;
    const tkhd = child(b, trak, 'tkhd');
    if (tkhd) {
      const off = tkhd.data + (b[tkhd.data] === 1 ? 88 : 76);
      f.width = known(Math.round(u32be(b, off) / 65536)); f.height = known(Math.round(u32be(b, off + 4) / 65536));
      f.basis.width = f.basis.height = 'mp4.tkhd';
    }
    const stbl = child(b, child(b, mdia, 'minf'), 'stbl');
    const stsd = child(b, stbl, 'stsd');
    const entry = stsd ? boxes(b, stsd.data + 8, stsd.end)[0] : undefined;
    if (entry) {
      const c = boxes(b, entry.data + 78, entry.end).find(x => x.type === 'colr');
      if (c) transfer = colr(b, c).transfer;
    }
    const stsz = child(b, stbl, 'stsz');
    if (stsz) { f.frames = known(u32be(b, stsz.data + 8)); f.basis.frames = 'mp4.stsz'; }
    break;
  }
  f.nature = known('raster'); f.basis.nature = 'mp4';
  if (video) { f.hdr = known(transfer === 16 || transfer === 18); f.basis.hdr = 'mp4.colr.nclx'; }
  f.alpha = known(false); f.basis.alpha = 'mp4';
  const udta = kids.find(x => x.type === 'udta' || x.type === 'meta');
  f.metadata = known(!!udta); f.basis.metadata = 'mp4.udta';
};

// ─── WebM (Matroska / EBML) ─────────────────────────────────────────────────

/** An EBML element id (marker bits kept) and payload range. */
interface Element { readonly id: number; readonly data: number; readonly end: number; readonly unknownSize: boolean }

function ebmlElements(b: Uint8Array, start: number, end: number, stopAt?: number): Element[] {
  const out: Element[] = [];
  let at = start;
  while (at < end && out.length < OUTPUT_MAX_STRUCTURES) {
    const first = b[at];
    if (!first) break;
    let idw = 1;
    while (idw <= 4 && !(first & (0x80 >> (idw - 1)))) idw++;
    if (idw > 4 || at + idw > end) break;
    let id = 0;
    for (let i = 0; i < idw; i++) id = id * 256 + (b[at + i] ?? 0);
    const s = at + idw, sf = b[s];
    if (!sf) break;
    let sw = 1;
    while (sw <= 8 && !(sf & (0x80 >> (sw - 1)))) sw++;
    if (sw > 8 || s + sw > end) break;
    let size = sf & (0xff >> sw), allOnes = size === (0xff >> sw);
    for (let i = 1; i < sw; i++) { size = size * 256 + (b[s + i] ?? 0); allOnes &&= b[s + i] === 0xff; }
    const data = s + sw, stop = allOnes ? end : Math.min(end, data + size);
    out.push({ id, data, end: stop, unknownSize: allOnes });
    if (allOnes || id === stopAt) break;
    at = data + size;
  }
  return out;
}
const uintAt = (b: Uint8Array, e: Element): number => { let v = 0; for (let i = e.data; i < e.end && i < e.data + 8; i++) v = v * 256 + (b[i] ?? 0); return v; };
const floatAt = (b: Uint8Array, e: Element): number => {
  const view = new DataView(b.buffer, b.byteOffset + e.data, e.end - e.data);
  return e.end - e.data === 4 ? view.getFloat32(0) : e.end - e.data === 8 ? view.getFloat64(0) : Number.NaN;
};

const readWebm: Reader = (b, f) => {
  const top = ebmlElements(b, 0, b.length);
  const segment = top.find(e => e.id === 0x18538067);
  if (!segment) return;
  let scale = 1_000_000, duration: number | null = null, transfer: number | null = null, tags = false;
  for (const e of ebmlElements(b, segment.data, segment.end, 0x1f43b675)) {
    if (e.id === 0x1549a966) {
      for (const i of ebmlElements(b, e.data, e.end)) {
        if (i.id === 0x2ad7b1) scale = uintAt(b, i) || scale;
        else if (i.id === 0x4489) duration = floatAt(b, i);
      }
    } else if (e.id === 0x1654ae6b) {
      for (const entry of ebmlElements(b, e.data, e.end).filter(x => x.id === 0xae)) {
        const fields = ebmlElements(b, entry.data, entry.end);
        const video = fields.find(x => x.id === 0xe0);
        if (!video) continue;
        for (const v of ebmlElements(b, video.data, video.end)) {
          if (v.id === 0xb0) { f.width = known(uintAt(b, v)); f.basis.width = 'webm.PixelWidth'; }
          else if (v.id === 0xba) { f.height = known(uintAt(b, v)); f.basis.height = 'webm.PixelHeight'; }
          else if (v.id === 0x55b0) {
            const t = ebmlElements(b, v.data, v.end).find(x => x.id === 0x55ba);
            if (t) transfer = uintAt(b, t);
          }
        }
        break;
      }
    } else if (e.id === 0x1254c367) tags = true;
  }
  f.nature = known('raster'); f.basis.nature = 'webm';
  if (duration !== null && Number.isFinite(duration)) { f.durationMs = known(Math.round((duration * scale) / 1_000_000)); f.basis.durationMs = 'webm.Info.Duration'; }
  f.hdr = known(transfer === 16 || transfer === 18); f.basis.hdr = 'webm.Colour.TransferCharacteristics';
  f.metadata = known(tags); f.basis.metadata = 'webm.Tags';
};

// ─── SVG ────────────────────────────────────────────────────────────────────

const POINTS_PER: Readonly<Record<string, number>> = { pt: 1, pc: 12, in: 72, mm: 72 / 25.4, cm: 72 / 2.54, q: 72 / 101.6 };

/** An SVG length: a number in px (unitless or px) or in a physical unit. */
function svgLength(value: string | undefined): { px?: number; pt?: number } | null {
  const m = /^\s*([0-9]*\.?[0-9]+(?:e[+-]?\d+)?)\s*(px|pt|pc|in|mm|cm|q)?\s*$/i.exec(value ?? '');
  if (!m) return null;
  const n = Number(m[1]), unit = (m[2] ?? 'px').toLowerCase();
  if (!Number.isFinite(n) || n <= 0) return null;
  return unit === 'px' ? { px: n, pt: n * 0.75 } : { pt: n * POINTS_PER[unit]! };
}
const attr = (tag: string, name: string): string | undefined =>
  new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag)?.slice(1).find(v => v !== undefined);

/** Longest root start tag read. Lolly's own roots are a few hundred bytes. */
const SVG_ROOT_TAG_MAX = 256 * 1024;

/**
 * The first `<svg` start tag, or null. One search for the tag and one for its
 * closing `>`: a pattern such as `/<svg\b[^>]*>/` retries from every later
 * `<svg` when no `>` follows, which is quadratic in the length of the file.
 */
function svgRootTag(text: string, f: Builder): string | null {
  const open = /<svg\b/i.exec(text);
  if (!open) return null;
  const close = text.indexOf('>', open.index);
  if (close < 0 || close - open.index > SVG_ROOT_TAG_MAX) { f.limits.push('svg-root-unread'); return null; }
  return text.slice(open.index, close + 1);
}

/** An `x y w h` box in points, as the print wrapper writes data-trim-box and data-media-box. */
function svgBox(value: string | undefined): { w: number; h: number } | null {
  const nums = (value ?? '').trim().split(/\s+/).map(Number);
  if (nums.length !== 4 || !nums.every(Number.isFinite) || nums[2]! <= 0 || nums[3]! <= 0) return null;
  return { w: nums[2]!, h: nums[3]! };
}

/** Occurrences of a pattern with no variable-length tail, counted without building an array. */
function countMatches(text: string, re: RegExp): number {
  let n = 0;
  re.lastIndex = 0;
  while (re.exec(text)) n++;
  return n;
}

const readSvg: Reader = (b, f) => {
  if (b.length > OUTPUT_TEXT_SCAN_MAX_BYTES) { f.limits.push('svg-over-scan-budget'); return; }
  const text = new TextDecoder('utf-8').decode(b);
  const root = svgRootTag(text, f);
  if (!root) return;
  const w = svgLength(attr(root, 'width')), h = svgLength(attr(root, 'height'));
  // A print sheet (shells/web/src/bridge/export.ts wrapArtworkSvgWithMarks) is sized to
  // the whole sheet in points and records its trim and media boxes on the root.
  const trim = svgBox(attr(root, 'data-trim-box'));
  const sheet = !!svgBox(attr(root, 'data-media-box'));
  if (trim) {
    f.page = known({ width: round2(trim.w), height: round2(trim.h), box: 'TrimBox', uniform: true }); f.basis.page = 'svg.data-trim-box';
  }
  if (w && h) {
    if (w.px !== undefined && h.px !== undefined) { f.width = known(round2(w.px)); f.height = known(round2(h.px)); f.basis.width = f.basis.height = 'svg.root'; }
    if (!trim) { f.page = known({ width: round2(w.pt!), height: round2(h.pt!), box: sheet ? 'MediaBox' : 'svg-root', uniform: true }); f.basis.page = 'svg.root'; }
  } else {
    f.width = unknown('not-set'); f.height = unknown('not-set');
    if (!trim) f.page = unknown('not-set');
  }
  const images = countMatches(text, /<image\b/gi);
  f.nature = known(images > 0 ? 'mixed' : 'vector'); f.basis.nature = 'svg.image-elements';
  f.liveText = known(countMatches(text, /<text\b/gi)); f.basis.liveText = 'svg.text-elements';
  f.fontFaces = known(countMatches(text, /@font-face\b/gi)); f.basis.fontFaces = 'svg.font-face-rules';
  f.metadata = known(/<metadata\b|xmpmeta/i.test(text)); f.basis.metadata = 'svg.metadata';
  f.colour = known('rgb'); f.basis.colour = 'svg';
  f.alpha = unknown('needs-render');
  f.pages = known(1); f.basis.pages = 'svg';
};

// ─── EPS ────────────────────────────────────────────────────────────────────

const readEps: Reader = (b, f) => {
  let start = 0, end = b.length;
  if (b[0] === 0xc5 && b[1] === 0xd0) { start = u32le(b, 4); end = Math.min(b.length, start + u32le(b, 8)); }
  if (end - start > OUTPUT_TEXT_SCAN_MAX_BYTES) { f.limits.push('eps-over-scan-budget'); return; }
  const text = latin1(b, start, end);
  const box = /%%HiResBoundingBox:\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/.exec(text)
    ?? /%%BoundingBox:\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/.exec(text);
  if (box) {
    const [x1, y1, x2, y2] = box.slice(1, 5).map(Number) as [number, number, number, number];
    f.page = known({ width: round2(Math.abs(x2 - x1)), height: round2(Math.abs(y2 - y1)), box: 'BoundingBox', uniform: true });
    f.basis.page = 'eps.BoundingBox';
  }
  const cmyk = /setcmykcolor|%%DocumentProcessColors:/.test(text), rgb = /setrgbcolor/.test(text);
  if (cmyk || rgb) { f.colour = known(cmyk && rgb ? 'mixed' : cmyk ? 'cmyk' : 'rgb'); f.basis.colour = 'eps.operators'; }
  f.nature = known(/\b(?:colorimage|image)\b/.test(text) ? 'mixed' : 'vector'); f.basis.nature = 'eps.operators';
  f.metadata = known(/%%(?:Title|Creator|CreationDate):|xmpmeta/.test(text)); f.basis.metadata = 'eps.DSC';
  f.pages = known(1); f.basis.pages = 'eps';
};

// ─── ZIP ────────────────────────────────────────────────────────────────────

const readZip: Reader = (b, f) => {
  f.nature = known('archive'); f.basis.nature = 'zip';
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65_557); i--) {
    if (b[i] === 0x50 && b[i + 1] === 0x4b && b[i + 2] === 0x05 && b[i + 3] === 0x06) { eocd = i; break; }
  }
  if (eocd < 0) { f.limits.push('zip-no-central-directory'); f.encrypted = unknown('not-resolved'); return; }
  const total = u16le(b, eocd + 10);
  let at = u32le(b, eocd + 16), encrypted = false, n = 0;
  for (; n < total && at + 46 <= b.length && u32le(b, at) === 0x02014b50; n++) {
    encrypted ||= (u16le(b, at + 8) & 1) === 1 || u16le(b, at + 10) === 99;
    at += 46 + u16le(b, at + 28) + u16le(b, at + 30) + u16le(b, at + 32);
  }
  if (n < total) { f.limits.push('zip-central-directory-truncated'); f.encrypted = encrypted ? known(true) : unknown('not-resolved'); return; }
  f.encrypted = known(encrypted); f.basis.encrypted = 'zip.central-directory.flags';
};

// ─── BMP ────────────────────────────────────────────────────────────────────

const readBmp: Reader = (b, f) => {
  if (b.length < 30) return;
  f.width = known(u32le(b, 18) | 0); f.height = known(Math.abs(u32le(b, 22) | 0)); f.basis.width = f.basis.height = 'bmp.DIB';
  f.nature = known('raster'); f.basis.nature = 'bmp';
  f.frames = known(1); f.basis.frames = 'bmp';
};

// ─── PDF ────────────────────────────────────────────────────────────────────

const STANDARD_14 = /^\/(?:Times-(?:Roman|Bold|Italic|BoldItalic)|Helvetica(?:-Bold|-Oblique|-BoldOblique)?|Courier(?:-Bold|-Oblique|-BoldOblique)?|Symbol|ZapfDingbats)$/;

interface PdfObject { readonly dict: string; readonly stream?: Uint8Array }

/** Longest PDF object dictionary kept, in characters. */
const PDF_DICT_MAX = 65_536;
/** Largest single PDF stream inflated. */
const PDF_STREAM_INFLATE_MAX = 8 * 1024 * 1024;
/** Compressed bytes handed to the inflater at a time, so one push cannot expand past the cap by much. */
const INFLATE_INPUT_CHUNK = 4096;
/** Deflate's largest expansion is 1032 to 1; the margin covers the zlib header and trailer. */
const DEFLATE_MAX_RATIO = 1100;

/**
 * `indexOf(needle, from)` for positions that only move forward, remembering the
 * last answer: the first match at or after `from` is also the first match at or
 * after any later position up to it, and after a miss every later search misses.
 * Each byte is therefore searched once, where a fresh `indexOf` per object
 * rescans to the end of the file for every object that lacks the keyword.
 */
function forwardSearch(text: string, needle: string): (from: number) => number {
  let searchedFrom = -1, found = -1;
  return from => {
    if (searchedFrom >= 0 && searchedFrom <= from && (found < 0 || found >= from)) return found;
    searchedFrom = from;
    found = text.indexOf(needle, from);
    return found;
  };
}

/** An object header (`12 0 obj`). The lookbehind and bounded counts keep a run of digits linear. */
const PDF_OBJ_HEADER = /(?<!\d)(\d{1,10})\s+\d{1,5}\s+obj\b/g;
/** An indirect reference (`12 0 R`) in an array, bounded the same way. */
const PDF_REF = /(?<!\d)(\d{1,10})\s+\d{1,5}\s+R/g;

/**
 * Objects by number, newest definition last-wins, with object streams expanded in
 * file order.
 *
 * Linear in the length of the file: each object's dictionary ends at its stream
 * keyword, its `endobj` or the next object header, whichever comes first, so no
 * two dictionaries overlap; the `endobj` and `endstream` searches only move forward.
 */
function pdfObjects(b: Uint8Array, bin: string, f: Builder, budget: { left: number }): Map<number, PdfObject> {
  const objects = new Map<number, PdfObject>();
  const re = new RegExp(PDF_OBJ_HEADER.source, 'g');
  const endobjAt = forwardSearch(bin, 'endobj'), endstreamAt = forwardSearch(bin, 'endstream');
  let m = re.exec(bin);
  for (let guard = 0; m && guard < OUTPUT_MAX_STRUCTURES; guard++) {
    const num = Number(m[1]), bodyAt = m.index + m[0].length;
    // The next header, read now: it bounds this object, and it is the next object
    // unless this object's stream data runs past that header.
    const next = re.exec(bin);
    const nextAt = next ? next.index : bin.length;
    const endobj = endobjAt(bodyAt);
    // The stream keyword, if any, comes before the first endobj (stream data may
    // itself contain the letters "endobj", which only moves that search later).
    const spanEnd = Math.min(endobj < 0 ? bodyAt + PDF_DICT_MAX : endobj, nextAt);
    const span = bin.slice(bodyAt, spanEnd);
    const kw = /stream(?:\r\n|\r|\n)/.exec(span);
    const streamKw = kw ? bodyAt + kw.index : -1;
    const dictEnd = streamKw >= 0 ? streamKw : spanEnd;
    const dict = bin.slice(bodyAt, Math.min(dictEnd, bodyAt + PDF_DICT_MAX));
    let stream: Uint8Array | undefined;
    m = next;
    if (streamKw >= 0) {
      let s = streamKw + 6;
      if (bin[s] === '\r') s++;
      if (bin[s] === '\n') s++;
      // `(?!\d)` stops a backtrack from reading `/Length 12 0 R` as a direct length of 1.
      const lenRef = /\/Length\s+(\d+)\s+\d+\s+R/.exec(dict), lenDirect = /\/Length\s+(\d+)(?!\d)(?!\s+\d+\s+R)/.exec(dict);
      let len = lenDirect ? Number(lenDirect[1]) : -1;
      if (len < 0 && lenRef) { const r = /^\s*(\d+)/.exec(objects.get(Number(lenRef[1]))?.dict ?? ''); if (r) len = Number(r[1]); }
      if (len < 0 || s + len > b.length) { const e = endstreamAt(s); len = e < 0 ? 0 : e - s; }
      stream = b.subarray(s, s + len);
      // Headers inside the stream data are not objects: resume the scan after the data.
      if (next && next.index < s + len) { re.lastIndex = s + len; m = re.exec(bin); }
    }
    objects.set(num, { dict, stream });
    if (stream && /\/Type\s*\/ObjStm\b/.test(dict)) expandObjectStream(dict, stream, objects, f, budget);
  }
  return objects;
}

/**
 * Inflate zlib data up to `cap` bytes, or return null when it holds more. The
 * input is pushed in small pieces, so the work and the memory stay proportional
 * to what is produced, never to a buffer sized for the worst case.
 */
function inflateCapped(data: Uint8Array, cap: number): Uint8Array | null {
  // Deflate expands at most 1032 to 1, so short data cannot reach the cap: inflate it
  // in one call, which skips the streaming inflater's working buffers. Very short data
  // gets an output buffer of its largest possible size, since without one the inflater
  // starts at 128 KiB, and a file of many tiny streams would allocate that for each.
  const bound = data.length * DEFLATE_MAX_RATIO + 64;
  if (bound < cap) {
    const out = bound <= 131_072 ? unzlibSync(data, { out: new Uint8Array(bound) }) : unzlibSync(data);
    return out.length > cap ? null : out;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  const z = new Unzlib(chunk => { total += chunk.length; if (total <= cap) chunks.push(chunk); });
  // At least one push, so empty data reaches the inflater and fails there as it should.
  let at = 0;
  do {
    const end = Math.min(data.length, at + INFLATE_INPUT_CHUNK);
    z.push(data.subarray(at, end), end === data.length);
    at = end;
  } while (at < data.length && total <= cap);
  if (total > cap) return null;
  if (chunks.length === 1) return chunks[0]!;
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

/** Inflate a FlateDecode stream within the shared budget, or return null and record why. */
function inflate(dict: string, data: Uint8Array, f: Builder, budget: { left: number }): Uint8Array | null {
  if (!/\/Filter\s*(?:\/FlateDecode|\[\s*\/FlateDecode\s*\])/.test(dict)) {
    if (/\/Filter\b/.test(dict)) f.limits.push('pdf-stream-filter-unsupported');
    return /\/Filter\b/.test(dict) ? null : data;
  }
  if (budget.left <= 0) { f.limits.push('pdf-inflate-budget'); return null; }
  const cap = Math.min(budget.left, PDF_STREAM_INFLATE_MAX);
  try {
    const out = inflateCapped(data, cap);
    if (!out) {
      budget.left -= cap;
      f.limits.push(cap < PDF_STREAM_INFLATE_MAX ? 'pdf-inflate-budget' : 'pdf-stream-over-budget');
      return null;
    }
    budget.left -= out.length;
    return out;
  } catch {
    f.limits.push('pdf-stream-unreadable');
    return null;
  }
}

function expandObjectStream(dict: string, data: Uint8Array, objects: Map<number, PdfObject>, f: Builder, budget: { left: number }): void {
  const n = Number(/\/N\s+(\d+)/.exec(dict)?.[1] ?? 0), first = Number(/\/First\s+(\d+)/.exec(dict)?.[1] ?? 0);
  const raw = inflate(dict, data, f, budget);
  if (!raw || !n || n > 100_000) return;
  const text = latin1(raw);
  const header = text.slice(0, first).trim().split(/\s+/).map(Number);
  let previous = -1;
  for (let i = 0; i + 1 < header.length && i / 2 < n; i += 2) {
    const start = first + header[i + 1]!, next = i + 3 < header.length ? first + header[i + 3]! : text.length;
    // Offsets rise through an object stream. One that falls back would let members
    // share text, so the total read could grow past the stream's own length.
    if (!Number.isFinite(start) || start < previous) { f.limits.push('pdf-object-stream-offsets'); return; }
    previous = start;
    if (start < text.length) objects.set(header[i]!, { dict: text.slice(start, Math.min(next, start + PDF_DICT_MAX)) });
  }
}

const ref = (dict: string, key: string): number | null => {
  const m = new RegExp(`/${key}\\s+(\\d+)\\s+\\d+\\s+R`).exec(dict);
  return m ? Number(m[1]) : null;
};

const isPdfSpace = (code: number): boolean => code === 32 || (code >= 9 && code <= 13) || code === 160;

/**
 * The text inside the first `/<key> [ ... ]` array, or undefined. A search for
 * the key and one for the closing bracket: the pattern `/Key\s*\[([^\]]*)\]`
 * rescans to the end of the dictionary from every later occurrence of the key.
 */
function arrayAfter(dict: string, key: string): string | undefined {
  const name = `/${key}`;
  for (let at = dict.indexOf(name); at >= 0; at = dict.indexOf(name, at + name.length)) {
    let p = at + name.length;
    while (p < dict.length && isPdfSpace(dict.charCodeAt(p))) p++;
    if (dict[p] !== '[') continue;
    // No closing bracket after this array means none after any later one either.
    const close = dict.indexOf(']', p + 1);
    return close < 0 ? undefined : dict.slice(p + 1, close);
  }
  return undefined;
}

function boxOf(dict: string, key: string, objects: Map<number, PdfObject>): number[] | null {
  const inline = arrayAfter(dict, key);
  const viaRef = inline === undefined ? (() => {
    const r = ref(dict, key);
    if (r === null) return undefined;
    const target = objects.get(r)?.dict ?? '';
    const open = target.indexOf('['), close = open < 0 ? -1 : target.indexOf(']', open + 1);
    return close < 0 ? undefined : target.slice(open + 1, close);
  })() : inline;
  const nums = viaRef?.trim().split(/\s+/).map(Number);
  return nums && nums.length === 4 && nums.every(Number.isFinite) ? nums : null;
}

const readPdf: Reader = (b, f) => {
  if (b.length > OUTPUT_TEXT_SCAN_MAX_BYTES) { f.limits.push('pdf-over-scan-budget'); return; }
  const bin = latin1(b);
  const encrypted = /\/Encrypt\s+(?:\d+\s+\d+\s+R|<<)/.test(bin);
  f.encrypted = known(encrypted); f.basis.encrypted = 'pdf.trailer.Encrypt';
  const budget = { left: OUTPUT_PDF_INFLATE_BUDGET };
  const objects = pdfObjects(b, bin, f, budget);
  const all = [...objects.values()];
  const catalog = all.filter(o => /\/Type\s*\/Catalog\b/.test(o.dict)).at(-1);
  const rootNum = catalog ? ref(catalog.dict, 'Pages') : null;
  // The page tree, depth first, with MediaBox inherited from Pages nodes.
  const sizes: { w: number; h: number; box: 'TrimBox' | 'MediaBox' }[] = [];
  let complete = rootNum !== null;
  const visit = (num: number, inherited: number[] | null, depth: number, seen: Set<number>): void => {
    const node = objects.get(num);
    if (!node || seen.has(num) || depth > 64 || sizes.length >= 10_000) { complete = false; return; }
    seen.add(num);
    const media = boxOf(node.dict, 'MediaBox', objects) ?? inherited;
    if (/\/Type\s*\/Pages\b/.test(node.dict)) {
      const kids = arrayAfter(node.dict, 'Kids') ?? '';
      for (const k of kids.matchAll(PDF_REF)) visit(Number(k[1]), media, depth + 1, seen);
      return;
    }
    const trim = boxOf(node.dict, 'TrimBox', objects), use = trim ?? media;
    if (!use) { complete = false; return; }
    const rotate = Math.abs(Number(/\/Rotate\s+(-?\d+)/.exec(node.dict)?.[1] ?? 0)) % 180 === 90;
    const w = Math.abs(use[2]! - use[0]!), h = Math.abs(use[3]! - use[1]!);
    sizes.push({ w: rotate ? h : w, h: rotate ? w : h, box: trim ? 'TrimBox' : 'MediaBox' });
  };
  if (rootNum !== null) visit(rootNum, null, 0, new Set());
  const rootCount = rootNum !== null ? Number(/\/Count\s+(\d+)/.exec(objects.get(rootNum)?.dict ?? '')?.[1] ?? Number.NaN) : Number.NaN;
  if (complete && sizes.length) { f.pages = known(sizes.length); f.basis.pages = 'pdf.page-tree'; }
  else if (Number.isFinite(rootCount)) { f.pages = known(rootCount); f.basis.pages = 'pdf.Pages.Count'; }
  else { f.pages = unknown('not-resolved'); f.limits.push('pdf-page-tree-unread'); }
  if (sizes.length) {
    const p = sizes[0]!;
    const uniform = sizes.every(s => Math.abs(s.w - p.w) <= 0.5 && Math.abs(s.h - p.h) <= 0.5);
    f.page = known({ width: round2(p.w), height: round2(p.h), box: p.box, uniform }); f.basis.page = `pdf.page.${p.box}`;
  } else f.page = unknown('not-resolved');

  // Images, fonts and colour evidence.
  let images = 0, rgb = false, cmyk = false, gray = false, contentRead = 0, contentFailed = 0;
  const fonts = { declared: 0, embedded: 0, standard: 0 };
  for (const o of all) {
    const d = o.dict;
    if (/\/Subtype\s*\/Image\b/.test(d)) {
      images++;
      if (/\/ColorSpace\s*\/DeviceRGB/.test(d)) rgb = true;
      else if (/\/ColorSpace\s*\/DeviceCMYK/.test(d)) cmyk = true;
      else if (/\/ColorSpace\s*\/DeviceGray/.test(d)) gray = true;
      continue;
    }
    if (/\/Separation\b|\/DeviceN\b/.test(d)) cmyk = true;
    if (/\/Type\s*\/Font\b/.test(d) && /\/Subtype\s*\/(?:Type1|TrueType|MMType1|CIDFontType0|CIDFontType2)\b/.test(d)) {
      fonts.declared++;
      const desc = ref(d, 'FontDescriptor');
      const descDict = desc === null ? '' : objects.get(desc)?.dict ?? '';
      if (/\/FontFile[23]?\s/.test(descDict)) fonts.embedded++;
      else if (STANDARD_14.test(/\/BaseFont\s*(\/[^\s/<>[\]()]+)/.exec(d)?.[1] ?? '')) fonts.standard++;
    }
    if (o.stream && !/\/Type\s*\/(?:ObjStm|XRef|Metadata|EmbeddedFile|XObject\s*\/Subtype\s*\/Image)\b|\/Length[123]\b|\/Subtype\s*\/(?:XML|Type1C|CIDFontType0C|OpenType)\b|\/N\s+[134]\b|\/FunctionType\b/.test(d)) {
      const content = inflate(d, o.stream, f, budget);
      if (!content) { contentFailed++; continue; }
      contentRead++;
      const ops = latin1(content, 0, Math.min(content.length, 4 * 1024 * 1024));
      if (/(?:^|\s)(?:-?[\d.]+\s+){3}(?:rg|RG)(?=\s|$)/.test(ops)) rgb = true;
      if (/(?:^|\s)(?:-?[\d.]+\s+){4}[kK](?=\s|$)/.test(ops)) cmyk = true;
      if (/(?:^|\s)-?[\d.]+\s+[gG](?=\s|$)/.test(ops)) gray = true;
    }
  }
  f.nature = known(images > 0 ? 'mixed' : 'vector'); f.basis.nature = 'pdf.image-xobjects';
  f.fonts = known(fonts); f.basis.fonts = 'pdf.font-dictionaries';
  if (rgb || cmyk) { f.colour = known(rgb && cmyk ? 'mixed' : cmyk ? 'cmyk' : 'rgb'); f.basis.colour = 'pdf.colour-operators'; }
  else if (gray) { f.colour = known('gray'); f.basis.colour = 'pdf.colour-operators'; }
  else f.colour = unknown(contentFailed > 0 || encrypted ? 'not-resolved' : 'not-computable');
  if (contentFailed > 0 && contentRead === 0 && (rgb || cmyk)) f.limits.push('pdf-content-unread');
  f.icc = known(/\/OutputIntents\b|\/ICCBased\b/.test(bin) || all.some(o => /\/OutputIntents\b|\/ICCBased\b/.test(o.dict))); f.basis.icc = 'pdf.OutputIntents.ICCBased';
  const infoNum = ref(bin.slice(bin.lastIndexOf('trailer') >= 0 ? bin.lastIndexOf('trailer') : 0), 'Info') ?? (() => {
    const xref = all.filter(o => /\/Type\s*\/XRef\b/.test(o.dict)).at(-1);
    return xref ? ref(xref.dict, 'Info') : null;
  })();
  const info = infoNum === null ? '' : objects.get(infoNum)?.dict ?? '';
  const xmp = all.some(o => /\/Type\s*\/Metadata\b|\/Subtype\s*\/XML\b/.test(o.dict));
  f.metadata = known(xmp || /\/(?:Title|Author|Subject|Keywords|Creator|Producer)\s*[(<]/.test(info)); f.basis.metadata = 'pdf.Info.Metadata';
  f.alpha = unknown('needs-render');
};

const READERS: Partial<Record<SniffedFormat, Reader>> = {
  png: readPng, apng: readPng, jpg: readJpeg, webp: readWebp, gif: readGif, tiff: readTiff,
  avif: readHeif, heic: readHeif, mp4: readMp4, webm: readWebm, svg: readSvg, eps: readEps,
  zip: readZip, bmp: readBmp, pdf: readPdf,
};
