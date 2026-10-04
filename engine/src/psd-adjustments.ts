// SPDX-License-Identifier: MPL-2.0
/**
 * Photoshop adjustment layers as values (plans/289 M3, item 5): Levels, Curves,
 * Hue/Saturation, Brightness/Contrast, Exposure, Invert, Color Balance and Black &
 * White, read from their tagged blocks. Layouts follow Adobe's Photoshop File
 * Formats Specification, as Composa's PsdAdjustments.cs (MIT) reads them.
 *
 * This module only reads. What a reader does with the values is its own business:
 * Darkroom's "Open as layers" route turns a top-of-stack adjustment into its grade
 * (shells/web/src/views/psd-grade.ts), and the Design import still lists the layer
 * as not applied. Every read is bounded by the block it is given and returns null
 * rather than guessing when a block is short or a version is unknown.
 */

import { descBool, descChild, descNumber, readVersionedDescriptor } from './psd-descriptor.ts';

/** One Levels record: input black and white, output black and white, gamma. Levels 0..255. */
export interface PsdLevels { inBlack: number; inWhite: number; outBlack: number; outWhite: number; gamma: number }

/** Hue (degrees), saturation and lightness (-100..100) as Hue/Saturation stores them. */
export interface PsdHsl { hue: number; saturation: number; lightness: number }

export type PsdAdjustmentValue =
  /** `channels`: composite, red, green, blue; null where the file has no record. */
  | { kind: 'levels'; channels: Array<PsdLevels | null> }
  /** `channels`: composite, red, green, blue; each a list of [input, output] points, 0..255. */
  | { kind: 'curves'; channels: Array<Array<[number, number]> | null> }
  /** `ranges`: reds, yellows, greens, cyans, blues, magentas. */
  | { kind: 'hue-saturation'; colorize: boolean; colorized: PsdHsl; master: PsdHsl; ranges: PsdHsl[] }
  /** Brightness -150..150 and contrast -50..100; `legacy` when Photoshop's old (pre-CS3) formula is on. */
  | { kind: 'brightness-contrast'; brightness: number; contrast: number; legacy: boolean }
  | { kind: 'exposure'; exposure: number; offset: number; gamma: number }
  | { kind: 'invert' }
  /** Each triple: cyan-red, magenta-green, yellow-blue, -100..100. */
  | { kind: 'color-balance'; shadows: [number, number, number]; midtones: [number, number, number]; highlights: [number, number, number]; preserveLuminosity: boolean }
  /** Weights in percent (-200..300); the tint colour as #rrggbb when tinting. */
  | { kind: 'black-white'; reds: number; yellows: number; greens: number; cyans: number; blues: number; magentas: number; tint: string | null };

/** The adjustment keys this module reads, in the order a layer is tried. */
export const READABLE_ADJUSTMENT_KEYS = ['levl', 'curv', 'hue2', 'hue ', 'brit', 'expA', 'nvrt', 'blnc', 'blwh'] as const;

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

class Reader {
  private readonly dv: DataView;
  readonly b: Uint8Array;
  p = 0;
  constructor(b: Uint8Array) { this.b = b; this.dv = new DataView(b.buffer, b.byteOffset, b.byteLength); }
  left(): number { return this.b.length - this.p; }
  u8(): number { const v = this.dv.getUint8(this.p); this.p += 1; return v; }
  u16(): number { const v = this.dv.getUint16(this.p); this.p += 2; return v; }
  i16(): number { const v = this.dv.getInt16(this.p); this.p += 2; return v; }
  u32(): number { const v = this.dv.getUint32(this.p); this.p += 4; return v; }
  f32(): number { const v = this.dv.getFloat32(this.p); this.p += 4; return v; }
}

/** Version, then records of input black, input white, output black, output white and gamma x 100; the first four are composite, red, green, blue. */
function levels(b: Uint8Array): PsdAdjustmentValue | null {
  if (b.length < 2 + 4 * 10) return null;
  const r = new Reader(b);
  r.u16();
  const channels: Array<PsdLevels | null> = [];
  for (let ch = 0; ch < 4; ch++) {
    const inBlack = r.u16(), inWhite = r.u16(), outBlack = r.u16(), outWhite = r.u16(), gamma = r.u16() / 100;
    channels.push({
      inBlack: clamp(inBlack, 0, 255), inWhite: clamp(inWhite, 0, 255),
      outBlack: clamp(outBlack, 0, 255), outWhite: clamp(outWhite, 0, 255),
      gamma: clamp(gamma > 0 ? gamma : 1, 0.1, 9.99),
    });
  }
  return { kind: 'levels', channels };
}

/** A padding byte, version 1 or 4, a bitmask of the channels present, then each channel's points as output, input pairs. */
function curves(b: Uint8Array): PsdAdjustmentValue | null {
  if (b.length < 7) return null;
  const r = new Reader(b);
  r.u8();
  const version = r.u16();
  if (version !== 1 && version !== 4) return null;
  const present = r.u32();
  const channels: Array<Array<[number, number]> | null> = [null, null, null, null];
  for (let ch = 0; ch < 32; ch++) {
    if (!(present & (2 ** ch))) continue;
    if (r.left() < 2) return null;
    const count = r.u16();
    if (count > 19 || r.left() < count * 4) return null;
    const points: Array<[number, number]> = [];
    for (let i = 0; i < count; i++) {
      const output = r.u16(), input = r.u16();
      points.push([clamp(input, 0, 255), clamp(output, 0, 255)]);
    }
    if (ch < 4 && points.length >= 2) channels[ch] = points.sort((a, c) => a[0] - c[0]);
  }
  return { kind: 'curves', channels };
}

/** Version, colorize flag, a pad byte, the colorize and master triples, then (version 2) six ranges of four limits and a triple. */
function hueSaturation(b: Uint8Array): PsdAdjustmentValue | null {
  if (b.length < 4 + 12) return null;
  const r = new Reader(b);
  const version = r.u16();
  const colorize = r.u8() !== 0;
  r.u8();
  const triple = (): PsdHsl => ({ hue: clamp(r.i16(), -180, 360), saturation: clamp(r.i16(), -100, 100), lightness: clamp(r.i16(), -100, 100) });
  const colorized = triple();
  const master = triple();
  const ranges: PsdHsl[] = [];
  if (version >= 2) {
    for (let i = 0; i < 6 && r.left() >= 14; i++) {
      r.p += 8; // the range's four hue limits; the bands a reader maps them onto have their own
      ranges.push(triple());
    }
  }
  while (ranges.length < 6) ranges.push({ hue: 0, saturation: 0, lightness: 0 });
  return { kind: 'hue-saturation', colorize, colorized, master, ranges };
}

/**
 * Since CS3 the values live in `CgEd` (a versioned descriptor: `Brgh`, `Cntr`,
 * `useLegacy`); `brit` keeps the old pair and is all a pre-CS3 file has.
 */
function brightnessContrast(brit: Uint8Array | undefined, cgEd: Uint8Array | undefined): PsdAdjustmentValue | null {
  const desc = cgEd ? readVersionedDescriptor(cgEd)?.value ?? null : null;
  const brightness = descNumber(desc, 'Brgh'), contrast = descNumber(desc, 'Cntr');
  if (brightness != null && contrast != null) {
    return { kind: 'brightness-contrast', brightness: clamp(brightness, -150, 150), contrast: clamp(contrast, -50, 100), legacy: descBool(desc, 'useLegacy') ?? false };
  }
  if (!brit || brit.length < 4) return null;
  const r = new Reader(brit);
  return { kind: 'brightness-contrast', brightness: clamp(r.i16(), -150, 150), contrast: clamp(r.i16(), -50, 100), legacy: true };
}

function exposure(b: Uint8Array): PsdAdjustmentValue | null {
  if (b.length < 14) return null;
  const r = new Reader(b);
  r.u16();
  const ev = r.f32(), offset = r.f32(), gamma = r.f32();
  if (!Number.isFinite(ev) || !Number.isFinite(offset) || !Number.isFinite(gamma)) return null;
  return { kind: 'exposure', exposure: clamp(ev, -20, 20), offset: clamp(offset, -0.5, 0.5), gamma: clamp(gamma > 0 ? gamma : 1, 0.01, 9.99) };
}

function colorBalance(b: Uint8Array): PsdAdjustmentValue | null {
  if (b.length < 19) return null;
  const r = new Reader(b);
  const triple = (): [number, number, number] => [clamp(r.i16(), -100, 100), clamp(r.i16(), -100, 100), clamp(r.i16(), -100, 100)];
  const shadows = triple(), midtones = triple(), highlights = triple();
  return { kind: 'color-balance', shadows, midtones, highlights, preserveLuminosity: r.u8() !== 0 };
}

/** A versioned descriptor: six weights under Photoshop's colour keys, `useTint` and `tintColor`. */
function blackWhite(b: Uint8Array): PsdAdjustmentValue | null {
  const desc = readVersionedDescriptor(b)?.value ?? null;
  if (!desc) return null;
  const w = (key: string, fallback: number): number => clamp(descNumber(desc, key) ?? fallback, -200, 300);
  const tintOn = descBool(desc, 'useTint') ?? false;
  const color = descChild(desc, 'tintColor');
  const rd = descNumber(color, 'Rd  '), gn = descNumber(color, 'Grn '), bl = descNumber(color, 'Bl  ');
  const hex = (v: number) => Math.round(clamp(v > 1 ? v : v * 255, 0, 255)).toString(16).padStart(2, '0');
  const tint = tintOn && rd != null && gn != null && bl != null ? `#${hex(rd)}${hex(gn)}${hex(bl)}` : null;
  return {
    kind: 'black-white',
    reds: w('Rd  ', 40), yellows: w('Yllw', 60), greens: w('Grn ', 40), cyans: w('Cyn ', 60), blues: w('Bl  ', 20), magentas: w('Mgnt', 80),
    tint,
  };
}

/**
 * The adjustment a layer's tagged blocks describe, when it is one of the eight this
 * module reads; null for any other layer, an unread kind or a block that does not
 * read. `get` returns the block for a key, as psd-layer-semantics.ts holds them.
 */
export function readPsdAdjustment(get: (key: string) => Uint8Array | undefined): PsdAdjustmentValue | null {
  try {
    const lv = get('levl'); if (lv) return levels(lv);
    const cv = get('curv'); if (cv) return curves(cv);
    const hs = get('hue2') ?? get('hue '); if (hs) return hueSaturation(hs);
    const bc = get('brit'); if (bc) return brightnessContrast(bc, get('CgEd'));
    const ex = get('expA'); if (ex) return exposure(ex);
    if (get('nvrt')) return { kind: 'invert' };
    const cb = get('blnc'); if (cb) return colorBalance(cb);
    const bw = get('blwh'); if (bw) return blackWhite(bw);
  } catch {
    // A DataView read past the end of a short block: the block does not read.
  }
  return null;
}
