// SPDX-License-Identifier: MPL-2.0
/**
 * Radiance RGBE (`.hdr` / `.pic`) reader + writer — pure bytes, DOM-free.
 *
 * plans/61-deeprichpixels.md §4.2 / §6 Phase B3, the small half: the OpenEXR writer
 * is the format a compositor wants, and this is the ~100-line one that every
 * renderer, every IBL/environment-map pipeline and every colour tool has read
 * since 1989. Written alongside EXR because a `DeepFrame` is already exactly the
 * thing this format stores (linear light, unbounded), and because a *reader*
 * makes the writer testable against itself and is what a future `.hdr` ingest
 * (Phase C) will call.
 *
 * ─── What RGBE actually carries (read this before calling it "float") ───────
 * Each pixel is four bytes: three 8-bit mantissas and ONE exponent shared by all
 * three channels. So it is not three floats — it is a 3-vector quantised on a
 * per-pixel logarithmic grid whose step size is set by the LARGEST channel:
 *
 *     step f = 2^(e-8), where 2^(e-1) <= max(r,g,b) < 2^e
 *     |error| <= f/2 <= max(r,g,b) / 256
 *
 * That bound is derived, not measured: the encoder stores `floor(v / f)` and the
 * decoder returns `(byte + 0.5) * f`, so the worst case is half a bucket
 * (`f/2 = 2^(e-9)`), and since `max >= 2^(e-1)` that is at most `max/256`. Two
 * consequences that matter:
 *
 *   - Relative to the pixel's brightest channel the error is <= 1/256 = 0.39%
 *     (~8 bits of mantissa), which is why RGBE is fine for radiance maps.
 *   - Relative to a channel much DARKER than its neighbours it is effectively
 *     unbounded: `(1, 0.001, 0)` quantises green onto a 1/128 grid, so it
 *     encodes to byte 0 and decodes to ~0.0039 — four times the true value.
 *     This is the shared exponent, and it is the reason EXR half (a real
 *     per-channel float, ~0.05% everywhere) is the interchange format and this
 *     one is the convenience format.
 *
 * MEASURED round-trip (`tests/radiance.test.ts`, which re-measures these numbers
 * and fails if this paragraph drifts — 200k pseudo-random pixels, each channel
 * independently log-uniform over 1e-6..1e4, compared against the float32 input):
 * max error / max-channel = 0.0039062 = 1/256 exactly: the derived bound is ATTAINED,
 * not merely respected; mean 0.0018849. Per-CHANNEL relative error over those
 * pixels reaches 3.2e7x, because a channel ten decades below its pixel's
 * maximum is not preserved in any useful sense. Over uniform-magnitude pixels
 * (all three channels within one octave, the regime the format is for) the
 * per-channel relative error is <= 1/128 by the same derivation: measured max
 * 0.0069948, mean 0.0016962, and the SIGNED mean is ~0 — the encoder's
 * truncation and the decoder's +0.5 cancel, which is the whole point of that
 * pairing.
 *
 * Decoder-convention warning: ImageMagick, and Ward's later `rgbe.c`, decode
 * `byte * 2^(exp-136)` with NO half-bucket offset, so their values sit half a
 * bucket BELOW ours and are biased low. Ours follows Radiance's own
 * `color.c colr_color`. Round-tripping a file through a mixed pair of
 * implementations therefore costs a full bucket (`max/128`), not half — both
 * behaviours are pinned by the external-oracle tests.
 *
 * ─── Format ─────────────────────────────────────────────────────────────────
 * `#?RADIANCE` magic, `KEY=value` header lines, a blank line, a resolution line
 * (`-Y h +X w`), then scanlines — either flat RGBE quadruples, "old-style" RLE
 * (a `(1,1,1,n)` pixel repeats its predecessor `n << 8k` times), or the
 * "new-style" adaptive RLE this writer emits: a `(2, 2, hi, lo)` marker with
 * `hi<<8|lo == width`, then the four components stored SEPARATELY (R plane, G
 * plane, B plane, E plane), each as a byte stream where `n > 128` means a run of
 * `n-128` copies of the next byte and `n <= 128` means `n` literal bytes.
 * Separating the planes is what makes it compress: an exponent plane is nearly
 * constant across a scanline even when the colours are not.
 *
 * Sources (each cited again at its use site):
 *   - Greg Ward, "Real Pixels", Graphics Gems II (1991) §II.5 — the RGBE
 *     encoding and the frexp/ldexp formulation used verbatim below.
 *   - Radiance `src/common/color.c` — `setcolr`/`colr_color` (the exact
 *     rounding: TRUNCATION on encode, +0.5 half-bucket on decode) and
 *     `fwritecolrs`/`freadcolrs`/`oldreadcolrs` (the RLE, MINRUN = 4, run cap
 *     127, and the new-RLE signature test).
 *   - "The RADIANCE File Formats" (Ward, LBNL) — header keywords FORMAT,
 *     EXPOSURE, GAMMA, PRIMARIES and the resolution-line grammar.
 *     https://floyd.lbl.gov/radiance/refer/filefmts.pdf
 *
 * ─── Seams ──────────────────────────────────────────────────────────────────
 * Like `png.ts` and `tiff.ts`: this module never converts colour or depth. It
 * takes a linear `DeepFrame` and writes its numbers; `lab`/`xyz-d50` frames are
 * REFUSED rather than silently reinterpreted (call `convertSpace` first — the
 * caller is the one who knows which RGB space it wants). Alpha has no
 * representation in RGBE and is DROPPED, not composited: the file holds the
 * un-premultiplied colour exactly as the frame held it.
 *
 * Deliberately NOT in the engine barrel (the `gainmap.ts` / `jpeg-segments.ts`
 * precedent) — consumed by deep-path import from the export seam.
 */

import type { DeepFrame, PixelSpace } from './pixels.ts';

// ─── constants from the reference implementation ─────────────────────────────

/** `COLXS` in color.c: the exponent bias. Stored exponent = e + 128. */
const EXP_BIAS = 128;
/** color.c `setcolr`: a max channel at or below this is written as pure black. */
const MIN_LEVEL = 1e-32;
/** color.c `fwritecolrs`: shortest run worth encoding as a run. */
const MIN_RUN = 4;
/** New-style RLE is only legal for these widths (freadcolrs' signature test). */
const RLE_MIN_WIDTH = 8;
const RLE_MAX_WIDTH = 0x7fff;

/** Refuse to parse a header longer than this (hostile input guard). */
const MAX_HEADER_BYTES = 64 * 1024;
/**
 * Refuse to allocate for an image larger than this (hostile input guard).
 * 32 Mpx covers an 8192x4096 environment map, the largest thing anyone
 * routinely ships as `.hdr`, and caps the decode at ~512 MB of Float32.
 */
const MAX_PIXELS = 32 * 1024 * 1024;

// ─── float <-> RGBE ──────────────────────────────────────────────────────────

// frexp's exponent, by reading the IEEE-754 binary64 fields — no log2 rounding
// games. Returns e with x = m * 2^e, m in [0.5, 1). Caller guarantees x > 0
// and finite.
const FREXP_VIEW = new DataView(new ArrayBuffer(8));
function frexpExp(x: number): number {
  FREXP_VIEW.setFloat64(0, x);
  let biased = (FREXP_VIEW.getUint32(0) >>> 20) & 0x7ff;
  if (biased === 0) {
    // Subnormal: scale into the normal range and take the exponent back off.
    FREXP_VIEW.setFloat64(0, x * 2 ** 64);
    biased = ((FREXP_VIEW.getUint32(0) >>> 20) & 0x7ff) - 64;
  }
  return biased - 1022;
}

/**
 * One linear RGB triple -> four RGBE bytes, written at `out[o..o+3]`.
 *
 * This is color.c `setcolr` transcribed, including its exact arithmetic:
 *
 *     d = frexp(max, &e) * 256.0 / max      // == 2^(8-e), exactly
 *     clr[i] = (v > 0) ? (int)(v * d) : 0   // C truncation, NOT rounding
 *     clr[EXP] = e + COLXS
 *
 * Truncation is not a detail to "improve": the decoder's `+0.5` (see
 * {@link rgbeToFloat}) is the matching half of it, and rounding here would bias
 * every decoded value up by half a bucket. Policies for values the format
 * cannot express, all inherited from the reference except where noted:
 *   - max <= 1e-32 (incl. all-zero and all-negative pixels) -> the all-zero
 *     RGBE `0,0,0,0`, which decodes to exact 0. Denormals vanish.
 *   - negative channels -> 0 (reference behaviour; RGBE is unsigned).
 *   - NaN -> 0. Radiance has no NaN; propagating one as a giant exponent would
 *     be worse than dropping it. (Ours, documented.)
 *   - max >= 2^127 (incl. +Infinity) -> clamped to the largest representable
 *     RGBE value rather than wrapping the exponent byte. (Ours, documented.)
 */
export function floatToRgbe(r: number, g: number, b: number, out: Uint8Array, o: number): void {
  const rr = Number.isNaN(r) ? 0 : r;
  const gg = Number.isNaN(g) ? 0 : g;
  const bb = Number.isNaN(b) ? 0 : b;
  let max = rr > gg ? rr : gg;
  if (bb > max) max = bb;

  if (!(max > MIN_LEVEL)) {
    out[o] = 0; out[o + 1] = 0; out[o + 2] = 0; out[o + 3] = 0;
    return;
  }
  if (max === Infinity) {
    out[o] = rr > 0 ? 255 : 0;
    out[o + 1] = gg > 0 ? 255 : 0;
    out[o + 2] = bb > 0 ? 255 : 0;
    out[o + 3] = 255;
    return;
  }

  const e = frexpExp(max);
  if (e > 127) {
    // Exponent byte would overflow: clamp to the top of the representable range.
    const d = 2 ** (8 - 127);
    out[o] = rr > 0 ? Math.min(255, Math.floor(rr * d)) : 0;
    out[o + 1] = gg > 0 ? Math.min(255, Math.floor(gg * d)) : 0;
    out[o + 2] = bb > 0 ? Math.min(255, Math.floor(bb * d)) : 0;
    out[o + 3] = 255;
    return;
  }
  // Underflow cannot happen: max > 1e-32 => e >= -105 => e + 128 >= 23.
  const d = 2 ** (8 - e); // == frexp(max) * 256 / max, exactly (both powers of 2)
  out[o] = rr > 0 ? Math.min(255, Math.floor(rr * d)) : 0;
  out[o + 1] = gg > 0 ? Math.min(255, Math.floor(gg * d)) : 0;
  out[o + 2] = bb > 0 ? Math.min(255, Math.floor(bb * d)) : 0;
  out[o + 3] = e + EXP_BIAS;
}

/**
 * Four RGBE bytes -> linear RGB, written at `out[oi..oi+2]`.
 *
 * color.c `colr_color`: `f = ldexp(1, exp - (COLXS+8))`, `v = (byte + 0.5) * f`.
 * The half-bucket recentring is what makes the encoder's truncation unbiased —
 * dropping it doubles the worst-case error and skews every value low (asserted
 * as a negative control in the tests).
 */
export function rgbeToFloat(rgbe: Uint8Array, o: number, out: Float32Array, oi: number): void {
  const exp = rgbe[o + 3]!;
  if (exp === 0) {
    out[oi] = 0; out[oi + 1] = 0; out[oi + 2] = 0;
    return;
  }
  const f = 2 ** (exp - (EXP_BIAS + 8));
  out[oi] = (rgbe[o]! + 0.5) * f;
  out[oi + 1] = (rgbe[o + 1]! + 0.5) * f;
  out[oi + 2] = (rgbe[o + 2]! + 0.5) * f;
}

// ─── header ──────────────────────────────────────────────────────────────────

/**
 * CIE xy chromaticities written to the PRIMARIES header, per pixel space:
 * `xr yr xg yg xb yb xw yw`. Radiance's own default primaries (0.640 0.330
 * 0.290 0.600 0.150 0.060 with an equal-energy white) are NOT sRGB — the green
 * and the white point both differ — so a file without PRIMARIES is genuinely
 * ambiguous and we always write it.
 *
 * Sources: ITU-R BT.709-6 Table 1 (sRGB/Rec.709 primaries, D65 white),
 * SMPTE EG 432-1 / Display P3 (DCI-P3 primaries with a D65 white),
 * ITU-R BT.2020-2 Table 1.
 */
const PRIMARIES: Partial<Record<PixelSpace, readonly number[]>> = {
  'srgb-linear': [0.64, 0.33, 0.3, 0.6, 0.15, 0.06, 0.3127, 0.329],
  'display-p3-linear': [0.68, 0.32, 0.265, 0.69, 0.15, 0.06, 0.3127, 0.329],
  'rec2020-linear': [0.708, 0.292, 0.17, 0.797, 0.131, 0.046, 0.3127, 0.329],
};

/** The only FORMAT this module reads or writes. (`32-bit_rle_xyze` is the CIE-XYZ sibling.) */
export const RADIANCE_FORMAT = '32-bit_rle_rgbe';

/** A parsed Radiance header. */
export interface RadianceHeader {
  /** The FORMAT= value verbatim (`32-bit_rle_rgbe` for anything this module decodes). */
  format: string;
  width: number;
  height: number;
  /**
   * Product of every EXPOSURE line (they are cumulative, per the file-format
   * doc). Stored samples have already been multiplied by this, so original
   * radiance = stored / exposure — which is what {@link readRadiance} returns.
   */
  exposure: number;
  /** GAMMA= if present. Never applied to samples by this module. */
  gamma: number | null;
  /** PRIMARIES= as 8 numbers (`xr yr xg yg xb yb xw yw`), or null. */
  primaries: number[] | null;
  /** SOFTWARE= if present. */
  software: string | null;
  /** Comment lines (those with no `=`), magic excluded, in file order. */
  comments: string[];
  /** True for a `-Y` first coordinate: rows run top-to-bottom (the only orientation written). */
  topDown: boolean;
  /** Byte offset of the first scanline. */
  dataOffset: number;
}

/**
 * Parse the `#?RADIANCE` header and the resolution line.
 *
 * Never throws: any malformation (bad magic, unterminated header, missing or
 * non-`-Y ... +X ...` resolution line, absurd dimensions) returns null — the
 * convention every other defensive engine reader uses (`png-unfilter.ts`
 * `unfilterPng`, `pdf-svg.ts`, `der-read.ts`).
 */
export function parseRadianceHeader(bytes: Uint8Array): RadianceHeader | null {
  if (!(bytes instanceof Uint8Array) || bytes.length < 12) return null;
  // Magic: "#?RADIANCE" (some writers emit "#?RGBE"); the line ends at \n.
  let p = 0;
  const limit = Math.min(bytes.length, MAX_HEADER_BYTES);
  const readLine = (): string | null => {
    if (p >= limit) return null;
    let end = p;
    while (end < limit && bytes[end] !== 10) end++;
    if (end >= limit) return null; // unterminated within the guard
    // Byte-by-byte rather than String.fromCharCode(...subarray): a 64 KB line
    // spread as arguments is at V8's argument-count limit, and a hostile file
    // controls that length.
    let s = '';
    for (let i = p; i < end; i++) s += String.fromCharCode(bytes[i]!);
    p = end + 1;
    return s;
  };

  const magic = readLine();
  if (magic === null || !(magic.startsWith('#?RADIANCE') || magic.startsWith('#?RGBE'))) return null;

  let format = '';
  let exposure = 1;
  let gamma: number | null = null;
  let primaries: number[] | null = null;
  let software: string | null = null;
  const comments: string[] = [];

  for (;;) {
    const line = readLine();
    if (line === null) return null;
    if (line === '') break; // blank line terminates the header
    if (line.startsWith('#')) { comments.push(line.slice(1).trim()); continue; }
    const eq = line.indexOf('=');
    if (eq < 0) { comments.push(line.trim()); continue; }
    const key = line.slice(0, eq).trim().toUpperCase();
    const value = line.slice(eq + 1).trim();
    if (key === 'FORMAT') format = value;
    else if (key === 'EXPOSURE') {
      const v = Number(value);
      // Cumulative, per the file-format doc. Ignore junk rather than poisoning.
      if (Number.isFinite(v) && v !== 0) exposure *= v;
    } else if (key === 'GAMMA') {
      const v = Number(value);
      if (Number.isFinite(v)) gamma = v;
    } else if (key === 'PRIMARIES') {
      const nums = value.split(/\s+/).map(Number);
      if (nums.length === 8 && nums.every((n) => Number.isFinite(n))) primaries = nums;
    } else if (key === 'SOFTWARE') software = value;
  }

  const res = readLine();
  if (res === null) return null;
  // Grammar: <sign><Y> <rows> <sign><X> <cols>. Only the Y-major forms are
  // decodable here; an X-major file (columns stored first) is refused rather
  // than mis-decoded.
  const m = /^\s*([-+])Y\s+(\d+)\s+([-+])X\s+(\d+)\s*$/.exec(res);
  if (!m) return null;
  const height = Number(m[2]);
  const width = Number(m[4]);
  if (!(width > 0) || !(height > 0)) return null;
  if (width > 0xffff || height > 0xffff || width * height > MAX_PIXELS) return null;
  // +X means left-to-right (the universal case); -X would mirror each row.
  if (m[3] !== '+') return null;
  // -Y means top-down, the universal case. A +Y (bottom-up) file is legal
  // Radiance, but this reader returns rows in FILE order, so accepting one would
  // hand back a vertically flipped image -- a silent mis-decode. Refuse it the
  // same way -X is refused, rather than lie about the picture.
  if (m[1] !== '-') return null;

  return {
    format, width, height, exposure, gamma, primaries, software, comments,
    topDown: m[1] === '-',
    dataOffset: p,
  };
}

// ─── writer ──────────────────────────────────────────────────────────────────

/** Options for {@link packRadiance}. */
export interface PackRadianceOptions {
  /**
   * EXPOSURE header value. Per the format doc the stored samples have ALREADY
   * been multiplied by it, so this writer multiplies (and {@link readRadiance}
   * divides). Default 1 (still written, so the file is self-describing).
   */
  exposure?: number;
  /** GAMMA header value. Metadata only — samples are never gamma-encoded. */
  gamma?: number;
  /**
   * PRIMARIES: `'auto'` (default) derives them from `frame.space`; an explicit
   * 8-number array is written verbatim; `null` omits the line.
   */
  primaries?: 'auto' | readonly number[] | null;
  /** SOFTWARE header value. An explicit value always wins over the default attribution. */
  software?: string;
  /** Write the default `SOFTWARE=Lolly` source attribution when no explicit `software`
   *  is given (default true). The shell sets it false for a metadata-stripped export. */
  attribution?: boolean;
  /** Extra `#` comment lines, after the magic. */
  comments?: readonly string[];
  /**
   * New-style adaptive RLE (default true). `false` writes flat scanlines —
   * identical pixels, larger file. RLE is skipped automatically for widths
   * outside 8..32767, where the format forbids it.
   */
  rle?: boolean;
}

// Header text must not survive with control characters or non-ASCII in it: a
// stray \n would forge a header line, and the header region is one byte per
// character. Anything outside printable ASCII becomes a space.
function sanitize(s: string): string {
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    out += c >= 0x20 && c <= 0x7e ? ch : ' ';
  }
  return out.trim();
}

/**
 * Encode a `DeepFrame` as a Radiance RGBE file.
 *
 * Throws (programmer error, not input error) on a `lab`/`xyz-d50` frame: RGBE
 * stores RGB, and silently reinterpreting Lab channels as RGB is exactly the
 * kind of lie this plan exists to stop. Convert first.
 */
export function packRadiance(frame: DeepFrame, opts: PackRadianceOptions = {}): Uint8Array {
  const { width, height, data, space } = frame;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(`packRadiance: invalid dimensions ${width}x${height}`);
  }
  if (data.length !== width * height * 4) {
    throw new Error(`packRadiance: buffer length ${data.length} != ${width}x${height}x4`);
  }
  // Keep the writer inside what readRadiance (and the format's own scanline
  // fields) can express, so we never emit a file we cannot read back.
  if (width > 0xffff || height > 0xffff || width * height > MAX_PIXELS) {
    throw new Error(`packRadiance: ${width}x${height} exceeds the Radiance limits (65535 per axis, ${MAX_PIXELS} pixels)`);
  }
  if (space === 'lab' || space === 'xyz-d50') {
    throw new Error(`packRadiance: ${space} frames must be converted to an RGB space first`);
  }

  const exposure = opts.exposure ?? 1;
  if (!Number.isFinite(exposure) || exposure === 0) {
    throw new Error(`packRadiance: exposure must be a non-zero finite number (got ${exposure})`);
  }

  // ── header ──
  const lines: string[] = ['#?RADIANCE'];
  for (const c of opts.comments ?? []) lines.push(`#${sanitize(c)}`);
  // SOFTWARE= is Radiance's own generator field — default it to Lolly so every .hdr
  // names its source. An explicit opts.software always wins; a metadata-stripped export
  // (opts.attribution === false) drops the default.
  const sw = opts.software ?? (opts.attribution === false ? undefined : 'Lolly lolly.tools');
  if (sw !== undefined) lines.push(`SOFTWARE=${sanitize(sw)}`);
  lines.push(`FORMAT=${RADIANCE_FORMAT}`);
  lines.push(`EXPOSURE=${exposure}`);
  if (opts.gamma !== undefined) lines.push(`GAMMA=${opts.gamma}`);
  const prim = opts.primaries === undefined || opts.primaries === 'auto'
    ? PRIMARIES[space] ?? null
    : opts.primaries;
  // A wrong-length or non-finite array would emit a malformed PRIMARIES line that
  // every reader then misinterprets; refuse like the EXR chromaticities option.
  if (prim && (prim.length !== 8 || !prim.every(n => Number.isFinite(n)))) {
    throw new Error('packRadiance: primaries must be 8 finite numbers (rx ry gx gy bx by wx wy)');
  }
  if (prim) lines.push(`PRIMARIES=${prim.join(' ')}`);
  lines.push(''); // blank line closes the header
  lines.push(`-Y ${height} +X ${width}`); // top-down rows, left-to-right columns
  const headerText = `${lines.join('\n')}\n`;
  const header = new Uint8Array(headerText.length);
  for (let i = 0; i < headerText.length; i++) header[i] = headerText.charCodeAt(i) & 0xff;

  // ── pixels -> RGBE ──
  const rgbe = new Uint8Array(width * height * 4);
  for (let i = 0, o = 0; i < data.length; i += 4, o += 4) {
    floatToRgbe(data[i]! * exposure, data[i + 1]! * exposure, data[i + 2]! * exposure, rgbe, o);
  }

  const useRle = (opts.rle ?? true) && width >= RLE_MIN_WIDTH && width <= RLE_MAX_WIDTH;
  const body = useRle ? encodeRle(rgbe, width, height) : rgbe;

  const out = new Uint8Array(header.length + body.length);
  out.set(header, 0);
  out.set(body, header.length);
  return out;
}

/**
 * New-style adaptive RLE over an RGBE buffer.
 *
 * Faithful port of color.c `fwritecolrs`: per scanline, a `2,2,hi,lo` marker,
 * then each of the four components run-length encoded independently. Run
 * lengths are 4..127 (`MIN_RUN`, and the 127 cap keeps `128+cnt` a byte);
 * literal blocks are 1..128. The "short run in between" branch is the
 * reference's own — when a 2- or 3-long run sits immediately before a real run,
 * emitting it as a run beats spending a literal block header on it.
 */
function encodeRle(rgbe: Uint8Array, width: number, height: number): Uint8Array {
  // Worst case per component plane: a literal block header every 128 bytes.
  const worst = height * (4 + 4 * (width + Math.ceil(width / 128) + 2));
  const out = new Uint8Array(worst);
  let n = 0;

  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    out[n++] = 2;
    out[n++] = 2;
    out[n++] = (width >> 8) & 0xff;
    out[n++] = width & 0xff;
    for (let c = 0; c < 4; c++) {
      const at = (x: number): number => rgbe[row + x * 4 + c]!;
      let j = 0;
      while (j < width) {
        // Scan forward for the start of a run worth encoding.
        let beg = j;
        let cnt = 1;
        for (beg = j; beg < width; beg += cnt) {
          for (cnt = 1; cnt < 127 && beg + cnt < width && at(beg + cnt) === at(beg); cnt++);
          if (cnt >= MIN_RUN) break;
        }
        if (beg - j > 1 && beg - j < MIN_RUN) {
          // A 2- or 3-long run immediately before `beg`? Cheaper as a run.
          let c2 = j + 1;
          while (at(c2) === at(j)) {
            c2++;
            if (c2 === beg) {
              out[n++] = 128 + (beg - j);
              out[n++] = at(j);
              j = beg;
              break;
            }
          }
        }
        while (j < beg) {
          let k = beg - j;
          if (k > 128) k = 128;
          out[n++] = k;
          for (let m = 0; m < k; m++) out[n++] = at(j + m);
          j += k;
        }
        if (cnt >= MIN_RUN) {
          out[n++] = 128 + cnt;
          out[n++] = at(beg);
          j += cnt;
        }
      }
    }
  }
  // Cannot trip (the bound above is the format's own worst case), but a
  // Uint8Array silently DROPS out-of-range writes, so an undersized buffer
  // would corrupt output instead of failing. Fail loudly instead.
  if (n > out.length) throw new Error(`packRadiance: RLE buffer overrun (${n} > ${out.length})`);
  return out.subarray(0, n);
}

// ─── reader ──────────────────────────────────────────────────────────────────

/**
 * Decode a Radiance RGBE file into a linear `DeepFrame` (alpha = 1).
 *
 * Handles all three scanline encodings (flat, old-style RLE, new-style adaptive
 * RLE). Stored samples are divided by the accumulated EXPOSURE, so the result
 * is scene radiance in the file's own units — the exact inverse of what
 * {@link packRadiance} does with the same option.
 *
 * `space` is taken from PRIMARIES when they match a known space within 1e-3,
 * and otherwise defaults to `srgb-linear` — which is an ASSUMPTION, not a
 * measurement: a Radiance file with no PRIMARIES line is formally in Radiance's
 * own primaries (Rec.709-ish red/blue, a different green, equal-energy white),
 * and no amount of decoding can recover what the writer meant. Callers who care
 * should read {@link parseRadianceHeader}'s `primaries` themselves.
 *
 * Never throws. Any malformation — bad magic, truncated data, a run that would
 * overrun its scanline, an unsupported FORMAT — returns null, matching
 * `unfilterPng`'s contract.
 */
export function readRadiance(bytes: Uint8Array): DeepFrame | null {
  const head = parseRadianceHeader(bytes);
  if (!head) return null;
  if (head.format !== '' && head.format !== RADIANCE_FORMAT) return null;

  const { width, height, dataOffset } = head;
  const total = width * height;

  // Allocation guard. The floor is only 4 bytes per scanline, because
  // old-style RLE lets one 4-byte repeat marker stand for a whole row and it is
  // legal at any width — a tighter per-row bound would reject valid files.
  // MAX_PIXELS is therefore the real backstop (see its comment): a tiny file
  // CAN legitimately ask for a large buffer, and the cap is what bounds it.
  if (bytes.length - dataOffset < 4 * height) return null;

  const rgbe = new Uint8Array(total * 4);
  let p = dataOffset;
  let px = 0; // running pixel index, so old-style runs can cross scanlines

  for (let y = 0; y < height; y++) {
    if (p + 4 > bytes.length) return null;
    const rowStart = px;
    const isNewRle = bytes[p] === 2 && bytes[p + 1] === 2 && ((bytes[p + 2]! << 8) | bytes[p + 3]!) === width
      && width >= RLE_MIN_WIDTH && width <= RLE_MAX_WIDTH;

    if (isNewRle) {
      p += 4;
      for (let c = 0; c < 4; c++) {
        let x = 0;
        while (x < width) {
          if (p >= bytes.length) return null;
          const code = bytes[p++]!;
          if (code === 0) return null; // zero-length block: invalid
          if (code > 128) {
            const run = code - 128;
            if (p >= bytes.length || x + run > width) return null;
            const v = bytes[p++]!;
            for (let k = 0; k < run; k++) rgbe[(rowStart + x++) * 4 + c] = v;
          } else {
            if (p + code > bytes.length || x + code > width) return null;
            for (let k = 0; k < code; k++) rgbe[(rowStart + x++) * 4 + c] = bytes[p++]!;
          }
        }
      }
      px = rowStart + width;
    } else {
      // Flat / old-style RLE. A (1,1,1,n) pixel repeats its PREDECESSOR n<<shift
      // times (color.c oldreadcolrs); consecutive markers shift by 8 so runs
      // longer than 255 are expressible.
      let shift = 0;
      let x = 0;
      while (x < width) {
        if (p + 4 > bytes.length) return null;
        const r = bytes[p]!, g = bytes[p + 1]!, b = bytes[p + 2]!, e = bytes[p + 3]!;
        p += 4;
        if (r === 1 && g === 1 && b === 1) {
          if (px === 0) return null; // nothing to repeat
          const run = e << shift;
          if (x + run > width) return null;
          const prev = (px - 1) * 4;
          for (let k = 0; k < run; k++) {
            const o = px * 4;
            rgbe[o] = rgbe[prev]!;
            rgbe[o + 1] = rgbe[prev + 1]!;
            rgbe[o + 2] = rgbe[prev + 2]!;
            rgbe[o + 3] = rgbe[prev + 3]!;
            px++; x++;
          }
          shift += 8;
        } else {
          const o = px * 4;
          rgbe[o] = r; rgbe[o + 1] = g; rgbe[o + 2] = b; rgbe[o + 3] = e;
          px++; x++;
          shift = 0;
        }
      }
    }
  }

  const data = new Float32Array(total * 4);
  const inv = 1 / head.exposure;
  for (let i = 0, o = 0; i < total; i++, o += 4) {
    rgbeToFloat(rgbe, o, data, o);
    if (inv !== 1) {
      data[o] = data[o]! * inv;
      data[o + 1] = data[o + 1]! * inv;
      data[o + 2] = data[o + 2]! * inv;
    }
    data[o + 3] = 1;
  }

  return { width, height, data, space: spaceFromPrimaries(head.primaries) };
}

/** Match a PRIMARIES line back to a known pixel space (1e-3 per component). */
function spaceFromPrimaries(prim: number[] | null): PixelSpace {
  if (prim) {
    for (const [space, ref] of Object.entries(PRIMARIES) as [PixelSpace, readonly number[]][]) {
      if (ref.every((v, i) => Math.abs(v - prim[i]!) <= 1e-3)) return space;
    }
  }
  return 'srgb-linear';
}
