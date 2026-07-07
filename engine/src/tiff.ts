// SPDX-License-Identifier: MPL-2.0
/**
 * Baseline TIFF encoder (uncompressed, single strip, little-endian).
 *
 * Pure byte assembly — no DOM, no browser APIs — so it belongs in the engine
 * alongside the other hand-rolled format emitters (emf.js, eps.js, apng.js) and
 * is unit-testable at the repo root. It's generic over the sample layout so the
 * same code emits RGB (PhotometricInterpretation 2, 3 samples/pixel) or grayscale
 * (Photometric 1, 1 sample) — the plain `tiff` export uses RGB.
 *
 * The shell's DeviceCMYK TIFF path keeps its OWN bespoke encoder
 * (shells/web/src/bridge/export.js → encodeCmykTiff): it's entangled with print
 * geometry, colour-bar marks and the InkSet tag, so it isn't routed through here.
 * This is the general-purpose baseline that a future refactor could unify onto.
 *
 * Layout mirrors encodeCmykTiff: 8-byte header → IFD (entries sorted by tag, a
 * TIFF requirement) → out-of-line values (≤4-byte values inlined) → one strip.
 */

import type { ExportMeta } from './bridge/host-v1.ts';

// TIFF field types
const ASCII = 2, SHORT = 3, LONG = 4, RATIONAL = 5;
const TYPE_SIZE: Record<number, number> = { 2: 1, 3: 2, 4: 4, 5: 8 };

/** One IFD entry, either an inline scalar (`n`) or an out-of-line blob (`data`). */
interface Entry {
  tag: number;
  type: number;
  count: number;
  n?: number;
  data?: Uint8Array;
  offset?: number;
}

/** Options for {@link packTiff}. */
export interface PackTiffOptions {
  width: number;
  height: number;
  /** 3 → RGB, 1 → grayscale. */
  samplesPerPixel?: number;
  /** Override PhotometricInterpretation (defaults: 3 → 2 (RGB), 1 → 1 (BlackIsZero)). */
  photometric?: number;
  /** Written to X/YResolution (ResolutionUnit = inch). */
  dpi?: number;
  /** Provenance: { software, author }. */
  meta?: Partial<ExportMeta>;
  /** ImageDescription (falls back to meta.description). */
  description?: string;
}

/**
 * Assemble a baseline TIFF from packed 8-bit samples.
 *
 * @param pixels  width*height*samplesPerPixel bytes, row-major, 8 bits/sample,
 *   no padding (RGBRGB… for RGB; one byte/pixel for gray).
 * @param opts
 * @returns the complete TIFF file bytes.
 */
export function packTiff(pixels: Uint8Array | Uint8ClampedArray, opts: PackTiffOptions = { width: 0, height: 0 }): Uint8Array {
  const W = opts.width | 0;
  const H = opts.height | 0;
  const spp = opts.samplesPerPixel ?? 3;
  if (W <= 0 || H <= 0) throw new Error('packTiff: width and height must be positive.');
  if (spp < 1 || spp > 4) throw new Error(`packTiff: unsupported samplesPerPixel ${spp}.`);
  const expected = W * H * spp;
  if (pixels.length !== expected) {
    throw new Error(`packTiff: pixel buffer is ${pixels.length} bytes, expected ${expected} (${W}×${H}×${spp}).`);
  }
  const photometric = opts.photometric ?? (spp === 1 ? 1 : 2);
  const meta = opts.meta || {};
  const description = opts.description ?? meta.description;

  const enc = new TextEncoder();
  const entries: Entry[] = [];
  const num = (tag: number, type: number, n: number): number => entries.push({ tag, type, count: 1, n });
  const asciiTag = (tag: number, s: string | undefined): void => {
    if (!s) return;
    const a = enc.encode(String(s));
    const d = new Uint8Array(a.length + 1);            // NUL-terminated (TIFF ASCII)
    d.set(a, 0);
    entries.push({ tag, type: ASCII, count: d.length, data: d });
  };

  // BitsPerSample: one SHORT per sample, all 8. count===1 (gray) inlines; RGB is
  // out-of-line (6 bytes > 4). Built as a data blob either way — the layout loop
  // inlines it automatically when ≤4 bytes.
  const bps = new Uint8Array(spp * 2);
  { const dv = new DataView(bps.buffer); for (let i = 0; i < spp; i++) dv.setUint16(i * 2, 8, true); }
  const rational = (n2: number, den: number): Uint8Array => {
    const d = new Uint8Array(8);
    const dv = new DataView(d.buffer);
    dv.setUint32(0, n2, true); dv.setUint32(4, den, true);
    return d;
  };
  const res = Math.max(1, Math.round(opts.dpi || 72));

  num(256, LONG, W);                                   // ImageWidth
  num(257, LONG, H);                                   // ImageLength
  entries.push({ tag: 258, type: SHORT, count: spp, data: bps }); // BitsPerSample
  num(259, SHORT, 1);                                  // Compression: none
  num(262, SHORT, photometric);                        // PhotometricInterpretation
  asciiTag(270, description);                          // ImageDescription
  num(273, LONG, 0);                                   // StripOffsets — patched after layout
  num(277, SHORT, spp);                                // SamplesPerPixel
  num(278, LONG, H);                                   // RowsPerStrip (single strip)
  num(279, LONG, expected);                            // StripByteCounts
  entries.push({ tag: 282, type: RATIONAL, count: 1, data: rational(res, 1) }); // XResolution
  entries.push({ tag: 283, type: RATIONAL, count: 1, data: rational(res, 1) }); // YResolution
  num(296, SHORT, 2);                                  // ResolutionUnit: inch
  asciiTag(305, meta.software);                        // Software
  asciiTag(315, meta.author);                          // Artist

  entries.sort((a, b) => a.tag - b.tag);

  const N = entries.length;
  const ifdStart = 8;
  let ext = ifdStart + 2 + N * 12 + 4;                 // out-of-line region start
  for (const e of entries) {
    const bytes = e.data ? e.data.length : e.count * TYPE_SIZE[e.type]!;
    if (bytes > 4) { e.offset = ext; ext += bytes + (bytes & 1); } // keep word alignment
  }
  const stripOffset = ext + (ext & 1);
  entries.find(e => e.tag === 273)!.n = stripOffset;   // patch StripOffsets

  const out = new Uint8Array(stripOffset + expected);
  const dv = new DataView(out.buffer);
  out[0] = 0x49; out[1] = 0x49;                        // "II" little-endian
  dv.setUint16(2, 42, true);
  dv.setUint32(4, ifdStart, true);
  dv.setUint16(ifdStart, N, true);
  let o = ifdStart + 2;
  for (const e of entries) {
    dv.setUint16(o, e.tag, true);
    dv.setUint16(o + 2, e.type, true);
    dv.setUint32(o + 4, e.count, true);
    const bytes = e.data ? e.data.length : e.count * TYPE_SIZE[e.type]!;
    if (bytes > 4) { dv.setUint32(o + 8, e.offset!, true); out.set(e.data!, e.offset!); }
    else if (e.data) out.set(e.data, o + 8);           // small inline value
    else if (e.type === SHORT) dv.setUint16(o + 8, e.n!, true);
    else dv.setUint32(o + 8, e.n!, true);
    o += 12;
  }
  dv.setUint32(o, 0, true);                            // next IFD: none
  out.set(pixels, stripOffset);
  return out;
}
