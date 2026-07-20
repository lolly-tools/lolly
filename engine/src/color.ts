// SPDX-License-Identifier: MPL-2.0
/**
 * Colour profiles for exports — platform-agnostic, no DOM, no network.
 *
 * The sibling of units.js: where units.js is the single source of truth for
 * turning a typed dimension into what each format needs, this is the single
 * source of truth for the *colour* side — the ICC profile bytes a raster file
 * should carry, the RGB→CMYK conversion, and the press condition a CMYK PDF
 * declares. Each shell's export bridge embeds these into the format's native
 * slot (PNG iCCP chunk, JPEG APP2 segment, PDF OutputIntent).
 *
 * Why generate the sRGB profile in code rather than ship a binary: the engine
 * stays dependency- and asset-free, and the profile is small and fully
 * specified. The browser canvas (and thus dom-to-image / toBlob) renders in
 * sRGB, so tagging output as sRGB is *honest* — it records the colour space the
 * pixels were actually produced in, which is exactly what colour-managed apps
 * (print shops, Photoshop, browsers) need to reproduce them faithfully.
 */

/** An XYZ colour value (ICC XYZNumber), in PCS D50 space. */
type Xyz = readonly [number, number, number];

// ─── numeric encoders (ICC is big-endian) ────────────────────────────────────

// s15Fixed16Number — signed 16.16 fixed point, the ICC XYZ/encoding type.
const s15f16 = (v: number): number => Math.round(v * 65536);
const align4 = (n: number): number => (n + 3) & ~3;

// sRGB electro-optical transfer function: encoded [0,1] → linear light [0,1].
function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function writeSig(buf: Uint8Array, offset: number, sig: string): void {
  for (let i = 0; i < 4; i++) buf[offset + i] = sig.charCodeAt(i);
}

// ─── ICC tag element types (v2) ───────────────────────────────────────────────

// XYZType: 'XYZ ' + reserved + one XYZNumber (3× s15Fixed16).
function xyzType([x, y, z]: Xyz): Uint8Array {
  const b = new Uint8Array(20);
  const dv = new DataView(b.buffer);
  writeSig(b, 0, 'XYZ ');
  dv.setInt32(8, s15f16(x));
  dv.setInt32(12, s15f16(y));
  dv.setInt32(16, s15f16(z));
  return b;
}

// curveType: 'curv' + reserved + count + count×uint16 samples (a sampled LUT).
function curveType(samples: readonly number[]): Uint8Array {
  const n = samples.length;
  const b = new Uint8Array(12 + n * 2);
  const dv = new DataView(b.buffer);
  writeSig(b, 0, 'curv');
  dv.setUint32(8, n);
  for (const [i, s] of samples.entries()) dv.setUint16(12 + i * 2, s);
  return b;
}

// textDescriptionType (v2 'desc'): ASCII block + empty Unicode + empty ScriptCode.
function descType(ascii: string): Uint8Array {
  const a = new TextEncoder().encode(ascii);
  const count = a.length + 1;                 // includes the NUL terminator
  const b = new Uint8Array(8 + 4 + count + 4 + 4 + 2 + 1 + 67);
  const dv = new DataView(b.buffer);
  writeSig(b, 0, 'desc');
  dv.setUint32(8, count);
  b.set(a, 12);                               // trailing fields stay zero
  return b;
}

// textType (v2 'cprt'): 'text' + reserved + NUL-terminated ASCII.
function textType(ascii: string): Uint8Array {
  const a = new TextEncoder().encode(ascii);
  const b = new Uint8Array(8 + a.length + 1);
  writeSig(b, 0, 'text');
  b.set(a, 8);
  return b;
}

// ─── ICC tag element types (v4 — for the HDR profile) ─────────────────────────

// multiLocalizedUnicodeType ('mluc'): the v4 replacement for 'desc'/'text'. One
// 'enUS' record, UTF-16BE. (BMP only — profile strings are ASCII descriptions.)
function mlucType(str: string): Uint8Array {
  const HEADER = 16;      // sig(4) + reserved(4) + record count(4) + record size(4)
  const RECORD = 12;      // language(2) + country(2) + length(4) + offset(4)
  const bytes = str.length * 2;
  const b = new Uint8Array(HEADER + RECORD + bytes);
  const dv = new DataView(b.buffer);
  writeSig(b, 0, 'mluc');
  dv.setUint32(8, 1);                 // one record
  dv.setUint32(12, RECORD);
  dv.setUint16(16, 0x656e);           // language 'en'
  dv.setUint16(18, 0x5553);           // country  'US'
  dv.setUint32(20, bytes);            // string length in bytes
  dv.setUint32(24, HEADER + RECORD);  // string offset from tag start
  for (let i = 0; i < str.length; i++) dv.setUint16(HEADER + RECORD + i * 2, str.charCodeAt(i));
  return b;
}

// s15Fixed16ArrayType ('sf32'): the chromaticAdaptationTag ('chad') matrix.
function sf32Type(values: readonly number[]): Uint8Array {
  const b = new Uint8Array(8 + values.length * 4);
  const dv = new DataView(b.buffer);
  writeSig(b, 0, 'sf32');
  values.forEach((v, i) => dv.setInt32(8 + i * 4, s15f16(v)));
  return b;
}

// cicpType ('cicp', ICC.1:2022): the coding-independent code points that signal
// the HDR encoding. Colour-management layers that understand it use it verbatim
// and ignore the matrix/TRC shaper tags below (those remain a legacy fallback).
function cicpType(primaries: number, transfer: number, matrix: number, fullRange: number): Uint8Array {
  const b = new Uint8Array(12);
  writeSig(b, 0, 'cicp');            // bytes 4–7 reserved (0)
  b[8] = primaries;
  b[9] = transfer;
  b[10] = matrix;
  b[11] = fullRange;
  return b;
}

// ─── sRGB profile geometry ────────────────────────────────────────────────────
//
// The PCS is D50 (ICC requirement), so the colorants are the sRGB primaries
// Bradford-adapted from their native D65 white to D50, and the media white point
// is D50 itself. These are the standard published D50-adapted sRGB values.
const D50: Xyz = [0.9642, 1.0, 0.8249];
const PRIMARIES: Record<'r' | 'g' | 'b', Xyz> = {
  r: [0.43607, 0.22249, 0.01392],
  g: [0.38515, 0.71687, 0.09708],
  b: [0.14307, 0.06061, 0.71410],
};
const TRC_SAMPLES = 1024;

/**
 * Assemble an ICC profile: 128-byte header → tag table → tag data (4-byte
 * aligned). Shared by the sRGB (v2) and Rec.2100-PQ (v4) builders. Tags with the
 * same Uint8Array identity are stored once and referenced N times (the spec
 * allows it — e.g. one TRC blob for rTRC/gTRC/bTRC). Every profile here is a
 * display (`mntr`) RGB→XYZ profile with the required D50 PCS illuminant; header
 * fields left zero (CMM, platform, flags, rendering intent=perceptual) are valid
 * defaults. `versionBE` is the big-endian version word (e.g. 0x02100000 = v2.1).
 */
function buildIcc(versionBE: number, tags: ReadonlyArray<readonly [sig: string, data: Uint8Array]>): Uint8Array {
  const tagTableSize = 4 + tags.length * 12;
  let offset = align4(128 + tagTableSize);
  const placed = new Map<Uint8Array, { offset: number; size: number }>();
  const blobs: Array<{ offset: number; data: Uint8Array }> = [];
  const entries = tags.map(([sig, data]) => {
    let p = placed.get(data);
    if (!p) {
      p = { offset, size: data.length };
      placed.set(data, p);
      blobs.push({ offset, data });
      offset = align4(offset + data.length);
    }
    return { sig, offset: p.offset, size: p.size };
  });

  const total = offset;
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);

  dv.setUint32(0, total);            // profile size
  dv.setUint32(8, versionBE);        // version
  writeSig(out, 12, 'mntr');         // device class: display
  writeSig(out, 16, 'RGB ');         // data colour space
  writeSig(out, 20, 'XYZ ');         // PCS
  dv.setUint16(24, 2024);            // creation date (fixed — no clock in engine)
  dv.setUint16(26, 1);
  dv.setUint16(28, 1);
  writeSig(out, 36, 'acsp');         // profile file signature (required)
  dv.setInt32(68, s15f16(D50[0]));   // PCS illuminant (must be D50)
  dv.setInt32(72, s15f16(D50[1]));
  dv.setInt32(76, s15f16(D50[2]));

  dv.setUint32(128, tags.length);    // tag table
  let to = 132;
  for (const e of entries) {
    writeSig(out, to, e.sig);
    dv.setUint32(to + 4, e.offset);
    dv.setUint32(to + 8, e.size);
    to += 12;
  }

  for (const { offset: o, data } of blobs) out.set(data, o); // tag data
  return out;
}

let _srgbCache: Uint8Array | null = null;

/**
 * Build a valid sRGB IEC61966-2.1 ICC v2 display profile as bytes. Deterministic
 * and memoised. The three TRC tags share one curve blob to stay compact.
 */
export function srgbIccProfile(): Uint8Array {
  if (_srgbCache) return _srgbCache;

  const trc: number[] = new Array(TRC_SAMPLES);
  for (let i = 0; i < TRC_SAMPLES; i++) {
    const lin = srgbToLinear(i / (TRC_SAMPLES - 1));
    trc[i] = Math.max(0, Math.min(65535, Math.round(lin * 65535)));
  }
  const trcData = curveType(trc); // shared by rTRC/gTRC/bTRC

  _srgbCache = buildIcc(0x02100000, [
    ['desc', descType('sRGB IEC61966-2.1')],
    ['wtpt', xyzType(D50)],
    ['rXYZ', xyzType(PRIMARIES.r)],
    ['gXYZ', xyzType(PRIMARIES.g)],
    ['bXYZ', xyzType(PRIMARIES.b)],
    ['rTRC', trcData],
    ['gTRC', trcData],
    ['bTRC', trcData],
    ['cprt', textType('Public Domain — sRGB profile generated by Lolly')],
  ]);
  return _srgbCache;
}

// ─── Rec.2100 PQ (HDR) profile geometry ───────────────────────────────────────
//
// BT.2020 primaries, Bradford-adapted from their native D65 white to the PCS D50
// (the same standard, published values the reference HDR JPEGs carry). The 'chad'
// tag records that D65→D50 adaptation; the media white point stays D50.
const BT2020_D50: Record<'r' | 'g' | 'b', Xyz> = {
  r: [0.673459, 0.279033, -0.001938],
  g: [0.165661, 0.675338, 0.029996],
  b: [0.125100, 0.045631, 0.797177],
};
// Bradford chromatic adaptation D65 → D50 (Lindbloom's published matrix).
const CHAD_D65_TO_D50: readonly number[] = [
  1.0478112, 0.0228866, -0.0501270,
  0.0295424, 0.9904844, -0.0170491,
  -0.0092345, 0.0150436, 0.7521316,
];

// SMPTE ST 2084 (PQ) EOTF: code value [0,1] → linear display light [0,1] where
// 1.0 = 10 000 nits. Only consulted by colour engines that DON'T read the cicp
// tag (a best-effort legacy fallback); PQ has no ICC parametric form, so it's
// sampled into a curveType. cicp-aware engines ignore this entirely.
function pqEotfNorm(code: number): number {
  if (code <= 0) return 0;
  const m1 = 2610 / 16384, m2 = (2523 / 4096) * 128;
  const c1 = 3424 / 4096, c2 = (2413 / 4096) * 32, c3 = (2392 / 4096) * 32;
  const p = code ** (1 / m2);
  const num = Math.max(p - c1, 0);
  const den = c2 - c3 * p;
  return (num / den) ** (1 / m1);
}

let _pqCache: Uint8Array | null = null;

/**
 * Build a Rec.2100-PQ (BT.2020 primaries + SMPTE ST 2084 transfer) ICC v4 display
 * profile as bytes. Its `cicp` tag (primaries 9, transfer 16, matrix 0,
 * full-range 1) is the HDR signal colour-managed apps key off; the matrix/TRC
 * shaper tags are a legacy fallback. Embedding this in a JPEG/PNG whose pixels
 * are PQ-encoded (see hdr.ts#hdrBoostToPQ) is what makes it render as HDR.
 * Deterministic and memoised.
 */
export function pqBt2020IccProfile(): Uint8Array {
  if (_pqCache) return _pqCache;

  const trc: number[] = new Array(TRC_SAMPLES);
  for (let i = 0; i < TRC_SAMPLES; i++) {
    trc[i] = Math.max(0, Math.min(65535, Math.round(pqEotfNorm(i / (TRC_SAMPLES - 1)) * 65535)));
  }
  const trcData = curveType(trc);

  _pqCache = buildIcc(0x04400000, [ // ICC v4.4 (first version with the cicp tag)
    ['desc', mlucType('Rec.2100 PQ')],
    ['cprt', mlucType('Public Domain — Rec.2100 PQ profile generated by Lolly')],
    ['wtpt', xyzType(D50)],
    ['chad', sf32Type(CHAD_D65_TO_D50)],
    ['rXYZ', xyzType(BT2020_D50.r)],
    ['gXYZ', xyzType(BT2020_D50.g)],
    ['bXYZ', xyzType(BT2020_D50.b)],
    ['rTRC', trcData],
    ['gTRC', trcData],
    ['bTRC', trcData],
    ['cicp', cicpType(9, 16, 0, 1)],
  ]);
  return _pqCache;
}

/** A named ICC profile the export bridges can embed. */
export interface ColorProfile {
  id: string;
  name: string;
  space: string;
  bytes: () => Uint8Array;
}

/**
 * Named ICC profile registry. Today only sRGB — the colour space the render
 * canvas actually produces. Wide-gamut profiles (Display P3) would require the
 * shell to render in that space first, so they're intentionally absent until
 * that exists, rather than mislabelling sRGB pixels.
 */
export const COLOR_PROFILES = {
  srgb: { id: 'srgb', name: 'sRGB IEC61966-2.1', space: 'RGB', bytes: srgbIccProfile },
} satisfies Record<string, ColorProfile>;

const isProfileName = (n: string): n is keyof typeof COLOR_PROFILES =>
  Object.hasOwn(COLOR_PROFILES, n);

/**
 * ICC profile bytes for a named profile, or null for 'none'/unknown. Anything
 * truthy that isn't a known wide-gamut profile resolves to sRGB — the safe,
 * honest default for canvas-rendered output.
 */
export function iccProfileBytes(name: string | null | undefined = 'srgb'): Uint8Array | null {
  if (!name || name === 'none') return null;
  const p = isProfileName(name) ? COLOR_PROFILES[name] : COLOR_PROFILES.srgb;
  return p.bytes();
}

// ─── RGB → CMYK ───────────────────────────────────────────────────────────────

/** Device-CMYK ink values, each 0–1, in [c, m, y, k] order. */
export type Cmyk = [number, number, number, number];

/**
 * Naïve (GCR-free) RGB→CMYK. Inputs and outputs are 0–1. This is device CMYK,
 * not a profile-accurate separation; the CMYK PDF's OutputIntent declares the
 * press condition the values are meant to be read under (see CMYK_CONDITIONS).
 * Brand swatches with measured ink values bypass this via a palette lookup in
 * the shell, so this only governs incidental colours.
 */
export function rgbToCmyk(r: number, g: number, b: number): Cmyk {
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return [0, 0, 0, 1];
  const d = 1 - k;
  return [(1 - r - k) / d, (1 - g - k) / d, (1 - b - k) / d, k];
}

// ─── CMYK output intents (press conditions) ───────────────────────────────────

/** A registered press condition a CMYK PDF declares in its OutputIntent. */
export interface CmykCondition {
  identifier: string;
  info: string;
  registry: string;
}

/**
 * Standard registered press conditions a CMYK PDF can declare in its
 * OutputIntent. Identifiers are the ICC characterization-data registry reference
 * names, so the intent is valid without embedding a (large) destination profile.
 * Keys are the values accepted by the `colorProfile` export option for pdf-cmyk.
 */
export const CMYK_CONDITIONS = {
  fogra39: { identifier: 'FOGRA39', info: 'Coated FOGRA39 (ISO 12647-2:2004)', registry: 'http://www.color.org' },
  fogra51: { identifier: 'FOGRA51', info: 'PSO Coated v3 (FOGRA51)', registry: 'http://www.color.org' },
  swop:    { identifier: 'CGATS TR 001', info: 'U.S. Web Coated (SWOP) v2', registry: 'http://www.color.org' },
  gracol:  { identifier: 'CGATS TR 006', info: 'GRACoL 2006 Coated', registry: 'http://www.color.org' },
} satisfies Record<string, CmykCondition>;

/** The default press condition for CMYK PDF output intents. */
export const DEFAULT_CMYK_CONDITION = 'fogra39';

const isCmykConditionName = (n: string): n is keyof typeof CMYK_CONDITIONS =>
  Object.hasOwn(CMYK_CONDITIONS, n);

/**
 * Resolve a press-condition descriptor by name, falling back to the default for
 * unknown / generic ('srgb'/empty) values so the CMYK path always has an intent.
 */
export function cmykCondition(name: string = DEFAULT_CMYK_CONDITION): CmykCondition {
  return isCmykConditionName(name) ? CMYK_CONDITIONS[name] : CMYK_CONDITIONS[DEFAULT_CMYK_CONDITION];
}
