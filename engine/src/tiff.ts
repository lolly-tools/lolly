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
 * Depth: 8-bit unsigned (the default, byte-identical to the original encoder),
 * 16-bit unsigned, or 32-bit IEEE float (`depth: 'float32'` — the deep/VFX
 * interchange depth, plans/61-deeprichpixels.md §6 Phase A). Deep samples are
 * written little-endian to match the file's "II" byte order. Non-8-bit files
 * carry the SampleFormat tag (339, TIFF 6.0 Section 19 "Data Sample Format"):
 * 1 = unsigned integer for 16-bit, 3 = IEEE floating point for float32. 8-bit
 * output omits it — SampleFormat defaults to 1 per TIFF 6.0, and omitting keeps
 * the 8-bit bytes identical to the pre-depth encoder.
 *
 * A sample count beyond what the photometric implies (e.g. 4 samples with RGB)
 * carries ExtraSamples (338) declaring each extra sample as unassociated alpha —
 * TIFF 6.0 requires the tag in that case (p.31, p.77).
 *
 * SEAM: this writer never converts between depths. The caller hands it samples
 * already at the requested depth (Uint8/Uint16/Float32Array); depth conversion
 * and colour math are pixels.ts's job (deeprichpixels.md §5.1).
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
const ASCII = 2, SHORT = 3, LONG = 4, RATIONAL = 5, UNDEFINED = 7;
const TYPE_SIZE: Record<number, number> = { 2: 1, 3: 2, 4: 4, 5: 8, 7: 1 };

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
  /** ICC profile bytes → InterColorProfile tag (34675). Carries the colour space
   *  the samples are in — e.g. a Rec.2100-PQ profile (its cicp tag) makes an HDR TIFF. */
  icc?: Uint8Array;
  /** Bits per sample: 8 (default, Uint8Array/Uint8ClampedArray in), 16
   *  (Uint16Array in, SampleFormat 1), or 'float32' (Float32Array in,
   *  SampleFormat 3 — IEEE float, TIFF 6.0 §19). The buffer must already be at
   *  this depth; packTiff never converts (that's pixels.ts's seam). */
  depth?: 8 | 16 | 'float32';
}

/**
 * Assemble a baseline TIFF from packed samples.
 *
 * @param pixels  width*height*samplesPerPixel samples, row-major, no padding
 *   (RGBRGB… for RGB; one sample/pixel for gray). The element type must match
 *   `opts.depth`: Uint8Array/Uint8ClampedArray for 8 (default), Uint16Array
 *   for 16, Float32Array for 'float32'. No depth conversion happens here.
 * @param opts
 * @returns the complete TIFF file bytes.
 */
export function packTiff(pixels: Uint8Array | Uint8ClampedArray | Uint16Array | Float32Array, opts: PackTiffOptions = { width: 0, height: 0 }): Uint8Array {
  const W = opts.width | 0;
  const H = opts.height | 0;
  const spp = opts.samplesPerPixel ?? 3;
  const depth = opts.depth ?? 8;
  if (W <= 0 || H <= 0) throw new Error('packTiff: width and height must be positive.');
  if (spp < 1 || spp > 4) throw new Error(`packTiff: unsupported samplesPerPixel ${spp}.`);
  if (depth !== 8 && depth !== 16 && depth !== 'float32') {
    throw new Error(`packTiff: unsupported depth ${String(depth)} (8, 16 or 'float32').`);
  }
  // The buffer must already be at the declared depth — packTiff writes, never converts.
  if (depth === 8 && !(pixels instanceof Uint8Array || pixels instanceof Uint8ClampedArray)) {
    throw new Error('packTiff: depth 8 requires a Uint8Array or Uint8ClampedArray.');
  }
  if (depth === 16 && !(pixels instanceof Uint16Array)) {
    throw new Error('packTiff: depth 16 requires a Uint16Array.');
  }
  if (depth === 'float32' && !(pixels instanceof Float32Array)) {
    throw new Error("packTiff: depth 'float32' requires a Float32Array.");
  }
  const bits = depth === 'float32' ? 32 : depth;
  const bytesPerSample = bits >> 3;
  const expected = W * H * spp;                         // sample count (elements, not bytes)
  if (pixels.length !== expected) {
    throw new Error(`packTiff: pixel buffer is ${pixels.length} samples, expected ${expected} (${W}×${H}×${spp}).`);
  }
  const stripBytes = expected * bytesPerSample;
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

  // BitsPerSample: one SHORT per sample (8, 16 or 32). count===1 (gray) inlines;
  // RGB is out-of-line (6 bytes > 4). Built as a data blob either way — the
  // layout loop inlines it automatically when ≤4 bytes.
  const bps = new Uint8Array(spp * 2);
  { const dv = new DataView(bps.buffer); for (let i = 0; i < spp; i++) dv.setUint16(i * 2, bits, true); }
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
  num(279, LONG, stripBytes);                          // StripByteCounts
  entries.push({ tag: 282, type: RATIONAL, count: 1, data: rational(res, 1) }); // XResolution
  entries.push({ tag: 283, type: RATIONAL, count: 1, data: rational(res, 1) }); // YResolution
  num(296, SHORT, 2);                                  // ResolutionUnit: inch
  asciiTag(305, meta.software);                        // Software
  asciiTag(315, meta.author);                          // Artist
  if (depth !== 8) {
    // SampleFormat (339, TIFF 6.0 Section 19): 1 = unsigned integer, 3 = IEEE
    // float. One SHORT per sample. Omitted for 8-bit — the spec default is 1,
    // and omission keeps 8-bit output byte-identical to the original encoder.
    const sampleFormat = depth === 'float32' ? 3 : 1;
    const sf = new Uint8Array(spp * 2);
    { const dv = new DataView(sf.buffer); for (let i = 0; i < spp; i++) dv.setUint16(i * 2, sampleFormat, true); }
    entries.push({ tag: 339, type: SHORT, count: spp, data: sf });
  }
  // ExtraSamples (338, TIFF 6.0 p.31 "ExtraSamples" / p.77 field list): REQUIRED
  // whenever SamplesPerPixel exceeds the component count the PhotometricInterpretation
  // implies (3 for RGB, 4 for Separated/CMYK, 1 otherwise) — without it a reader has
  // no idea what the trailing sample means. One SHORT per extra sample, value 2 =
  // "unassociated alpha data", which matches the engine's un-premultiplied (straight)
  // alpha convention. spp <= the photometric's component count emits nothing, so all
  // existing RGB/gray output stays byte-identical.
  const baseComponents = photometric === 5 ? 4 : photometric === 2 ? 3 : 1;
  const extraSamples = spp - baseComponents;
  if (extraSamples > 0) {
    const es = new Uint8Array(extraSamples * 2);
    { const dv = new DataView(es.buffer); for (let i = 0; i < extraSamples; i++) dv.setUint16(i * 2, 2, true); }
    entries.push({ tag: 338, type: SHORT, count: extraSamples, data: es });
  }
  if (opts.icc?.length) {                              // InterColorProfile (ICC)
    entries.push({ tag: 34675, type: UNDEFINED, count: opts.icc.length, data: opts.icc as Uint8Array });
  }

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

  const out = new Uint8Array(stripOffset + stripBytes);
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
  // Strip data: samples written in the file's byte order ("II" → little-endian).
  if (depth === 8) {
    out.set(pixels as Uint8Array | Uint8ClampedArray, stripOffset);
  } else if (depth === 16) {
    for (let i = 0; i < expected; i++) dv.setUint16(stripOffset + i * 2, (pixels as Uint16Array)[i]!, true);
  } else {
    for (let i = 0; i < expected; i++) dv.setFloat32(stripOffset + i * 4, (pixels as Float32Array)[i]!, true);
  }
  return out;
}
