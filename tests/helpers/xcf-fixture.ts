// SPDX-License-Identifier: MPL-2.0
/**
 * Minimal XCF byte builder - the fixture source for tests/xcf.test.ts and the
 * seed corpus for the `xcf` fuzz target (there is deliberately no engine XCF
 * writer; see engine/src/psd-write.ts's header for the conversion story).
 *
 * Emits the subset engine/src/xcf.ts reads: v001-style 4-byte pointers or
 * v011-style 8-byte pointers, image props (compression, precision via the
 * header field), RGBA/RGB/Gray/GrayA layers with offsets/opacity/mode/
 * visibility/groups/item-paths, optional layer mask, and tiles in all three
 * compressions (none / GIMP-RLE / zlib via the engine's own zlibCompress).
 * Structure per GIMP devel-docs/xcf.txt (gimp-2-10).
 */

import { zlibCompress } from '../../engine/src/deflate.ts';

export interface XcfFixtureLayer {
  name: string;
  width: number;
  height: number;
  /** RGBA8 w*h*4 - the builder derives the stored planes from this. */
  pixels: Uint8Array;
  x?: number;
  y?: number;
  opacity255?: number;
  floatOpacity?: number;
  mode?: number;
  visible?: boolean;
  isGroup?: boolean;
  itemPath?: number[];
  /** XCF layer type: 0 RGB, 1 RGBA (default), 2 Gray, 3 GrayA. */
  layerType?: number;
  /** Bytes per sample (2 = 16-bit; sample hi==lo==v so folding returns v). */
  sampleBytes?: 1 | 2;
  /** w*h gray mask plane. */
  mask?: Uint8Array;
  applyMask?: boolean;
  /** Point every tile pointer outside the file (damage fixture). */
  poisonTilePtr?: boolean;
}

export interface XcfFixtureOpts {
  version: number;
  width: number;
  height: number;
  /** 0 RGB (default), 1 Gray, 2 Indexed. */
  baseType?: number;
  /** Header precision (v4+ only): default 150 (u8 non-linear). */
  precision?: number;
  /** 0 none, 1 RLE (default), 2 zlib. */
  compression?: 0 | 1 | 2;
  layers: XcfFixtureLayer[];
}

const TILE = 64;

// Property ids.
const PROP_END = 0;
const PROP_OPACITY = 6;
const PROP_MODE = 7;
const PROP_VISIBLE = 8;
const PROP_APPLY_MASK = 11;
const PROP_OFFSETS = 15;
const PROP_COMPRESSION = 17;
const PROP_GROUP_ITEM = 29;
const PROP_ITEM_PATH = 30;
const PROP_FLOAT_OPACITY = 33;

class W {
  private buf: number[] = [];
  private patches: Array<{ at: number; wide: boolean; get: () => number }> = [];
  get length(): number { return this.buf.length; }
  u8(x: number): void { this.buf.push(x & 0xff); }
  u16(x: number): void { this.u8(x >> 8); this.u8(x); }
  u32(x: number): void { this.u8(x >>> 24); this.u8(x >>> 16); this.u8(x >>> 8); this.u8(x); }
  i32(x: number): void { this.u32(x >>> 0); }
  f32(x: number): void {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setFloat32(0, x);
    for (const byte of b) this.u8(byte);
  }
  bytes(b: Uint8Array | number[]): void { for (const x of b) this.u8(x); }
  ascii(s: string): void { for (let i = 0; i < s.length; i++) this.u8(s.charCodeAt(i)); }
  /** XCF string: u32 length INCLUDING the NUL, utf-8 bytes, NUL. */
  str(s: string): void {
    const utf8 = new TextEncoder().encode(s);
    this.u32(utf8.length + 1);
    this.bytes(utf8);
    this.u8(0);
  }
  /** Reserve a pointer slot, resolved at finalize. */
  ptr(wide: boolean, get: () => number): void {
    this.patches.push({ at: this.buf.length, wide, get });
    for (let i = 0; i < (wide ? 8 : 4); i++) this.u8(0);
  }
  finalize(): Uint8Array {
    const out = Uint8Array.from(this.buf);
    const v = new DataView(out.buffer);
    for (const { at, wide, get } of this.patches) {
      const val = get();
      if (wide) { v.setUint32(at, Math.floor(val / 0x1_0000_0000)); v.setUint32(at + 4, val >>> 0); }
      else v.setUint32(at, val);
    }
    return out;
  }
}

/** GIMP tile RLE for one byte plane (short/long runs and literals). */
function rleEncodePlane(plane: Uint8Array): number[] {
  const out: number[] = [];
  let i = 0;
  const n = plane.length;
  while (i < n) {
    let runEnd = i + 1;
    while (runEnd < n && plane[runEnd] === plane[i] && runEnd - i < 0xffff) runEnd++;
    const runLen = runEnd - i;
    if (runLen >= 3) {
      if (runLen <= 127) out.push(runLen - 1, plane[i]!);           // short run: op 0..126 = n+1 copies
      else out.push(127, runLen >> 8, runLen & 0xff, plane[i]!);    // long run
      i = runEnd;
    } else {
      let j = i + 1;
      while (j < n && j - i < 0xffff) {
        if (j + 2 < n && plane[j] === plane[j + 1] && plane[j] === plane[j + 2]) break;
        j++;
      }
      const litLen = j - i;
      if (litLen <= 127) out.push(256 - litLen);                    // short literal: 129..255
      else out.push(128, litLen >> 8, litLen & 0xff);               // long literal
      for (let k = i; k < j; k++) out.push(plane[k]!);
      i = j;
    }
  }
  return out;
}

/** Channel count for a layer type. */
function channelsFor(type: number): number {
  return type === 0 ? 3 : type === 1 ? 4 : type === 2 ? 1 : 2;
}

/** Extract one tile's interleaved sample bytes from RGBA8 input. */
function tileBytes(
  l: { width: number; pixels: Uint8Array },
  type: number,
  sb: number,
  tx: number,
  ty: number,
  tw: number,
  th: number,
): Uint8Array {
  const channels = channelsFor(type);
  const bpp = channels * sb;
  const out = new Uint8Array(tw * th * bpp);
  // Channel source per layer type: RGB(A) reads rgba, Gray(A) reads r (+a).
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const src = ((ty * TILE + y) * l.width + tx * TILE + x) * 4;
      const dst = (y * tw + x) * bpp;
      for (let ch = 0; ch < channels; ch++) {
        const srcCh = type <= 1 ? ch : (ch === 0 ? 0 : 3); // gray from R, alpha from A
        const val = l.pixels[src + srcCh]!;
        if (sb === 2) { out[dst + ch * 2] = val; out[dst + ch * 2 + 1] = val; } // hi==lo → folds back exactly
        else out[dst + ch] = val;
      }
    }
  }
  return out;
}

function encodeTile(data: Uint8Array, bpp: number, compression: number): Uint8Array {
  if (compression === 0) return data;
  if (compression === 2) return zlibCompress(data);
  // RLE: per byte-plane streams.
  const n = data.length / bpp;
  const out: number[] = [];
  const plane = new Uint8Array(n);
  for (let p = 0; p < bpp; p++) {
    for (let i = 0; i < n; i++) plane[i] = data[i * bpp + p]!;
    out.push(...rleEncodePlane(plane));
  }
  return Uint8Array.from(out);
}

/**
 * Write a hierarchy (+ level + tiles) for a plane source; returns a thunk-based
 * layout: hierarchy is written immediately, tiles appended after the caller's
 * other pointers resolve - here we simply write everything sequentially, which
 * the reader accepts (pointers are absolute).
 */
function writeHierarchy(
  w: W,
  wide: boolean,
  width: number,
  height: number,
  bpp: number,
  tiles: Uint8Array[],
  poison: boolean,
): number {
  const hierAt = w.length;
  w.u32(width);
  w.u32(height);
  w.u32(bpp);
  const levelAtBox = { at: 0 };
  w.ptr(wide, () => levelAtBox.at);
  w.ptr(wide, () => 0); // level list terminator
  levelAtBox.at = w.length;
  w.u32(width);
  w.u32(height);
  const tileAts: Array<{ at: number }> = tiles.map(() => ({ at: 0 }));
  const fileEndBox = { at: 0 };
  for (const box of tileAts) w.ptr(wide, () => (poison ? fileEndBox.at + 4096 : box.at));
  w.ptr(wide, () => 0); // tile list terminator
  for (let i = 0; i < tiles.length; i++) {
    tileAts[i]!.at = w.length;
    w.bytes(tiles[i]!);
  }
  // Poison target resolves to past-EOF once the file is complete.
  fileEndBox.at = w.length;
  return hierAt;
}

export function buildXcf(opts: XcfFixtureOpts): Uint8Array {
  const { version, width, height, layers } = opts;
  const compression = opts.compression ?? 1;
  const wide = version >= 11;
  const w = new W();

  // Header.
  w.ascii('gimp xcf ');
  w.ascii(version === 0 ? 'file' : `v${String(version).padStart(3, '0')}`);
  w.u8(0);
  w.u32(width);
  w.u32(height);
  w.u32(opts.baseType ?? 0);
  if (version >= 4) w.u32(opts.precision ?? 150);

  // Image properties.
  w.u32(PROP_COMPRESSION); w.u32(1); w.u8(compression);
  w.u32(PROP_END); w.u32(0);

  // Layer pointer list (+ terminator), channel list terminator.
  const layerBoxes = layers.map(() => ({ at: 0 }));
  for (const box of layerBoxes) w.ptr(wide, () => box.at);
  w.ptr(wide, () => 0);
  w.ptr(wide, () => 0); // no image channels

  // Layers.
  layers.forEach((l, li) => {
    const type = l.layerType ?? 1;
    const sb = l.sampleBytes ?? 1;
    const bpp = channelsFor(type) * sb;
    layerBoxes[li]!.at = w.length;
    w.u32(l.width);
    w.u32(l.height);
    w.u32(type);
    w.str(l.name);
    // Properties.
    if (l.opacity255 !== undefined) { w.u32(PROP_OPACITY); w.u32(4); w.u32(l.opacity255); }
    if (l.floatOpacity !== undefined) { w.u32(PROP_FLOAT_OPACITY); w.u32(4); w.f32(l.floatOpacity); }
    w.u32(PROP_VISIBLE); w.u32(4); w.u32(l.visible === false ? 0 : 1);
    if (l.mode !== undefined) { w.u32(PROP_MODE); w.u32(4); w.u32(l.mode); }
    if (l.x !== undefined || l.y !== undefined) { w.u32(PROP_OFFSETS); w.u32(8); w.i32(l.x ?? 0); w.i32(l.y ?? 0); }
    if (l.isGroup) { w.u32(PROP_GROUP_ITEM); w.u32(0); }
    if (l.itemPath) { w.u32(PROP_ITEM_PATH); w.u32(l.itemPath.length * 4); for (const seg of l.itemPath) w.u32(seg); }
    if (l.applyMask) { w.u32(PROP_APPLY_MASK); w.u32(4); w.u32(1); }
    w.u32(PROP_END); w.u32(0);
    // Hierarchy + mask pointers.
    const hierBox = { at: 0 };
    const maskBox = { at: 0 };
    w.ptr(wide, () => hierBox.at);
    w.ptr(wide, () => maskBox.at);

    if (!l.isGroup) {
      // Tiles.
      const tilesX = Math.ceil(l.width / TILE);
      const tilesY = Math.ceil(l.height / TILE);
      const tiles: Uint8Array[] = [];
      for (let ty = 0; ty < tilesY; ty++) {
        for (let tx = 0; tx < tilesX; tx++) {
          const tw = Math.min(TILE, l.width - tx * TILE);
          const th = Math.min(TILE, l.height - ty * TILE);
          tiles.push(encodeTile(tileBytes(l, type, sb, tx, ty, tw, th), bpp, compression));
        }
      }
      hierBox.at = writeHierarchy(w, wide, l.width, l.height, bpp, tiles, l.poisonTilePtr === true);

      if (l.mask) {
        maskBox.at = w.length;
        w.u32(l.width);
        w.u32(l.height);
        w.str('mask');
        w.u32(PROP_END); w.u32(0);
        const mHierBox = { at: 0 };
        w.ptr(wide, () => mHierBox.at);
        // Mask tiles: gray plane at 1 byte/sample.
        const mTiles: Uint8Array[] = [];
        for (let ty = 0; ty < tilesY; ty++) {
          for (let tx = 0; tx < tilesX; tx++) {
            const tw = Math.min(TILE, l.width - tx * TILE);
            const th = Math.min(TILE, l.height - ty * TILE);
            const data = new Uint8Array(tw * th);
            for (let y = 0; y < th; y++) {
              for (let x = 0; x < tw; x++) {
                data[y * tw + x] = l.mask[(ty * TILE + y) * l.width + tx * TILE + x]!;
              }
            }
            mTiles.push(encodeTile(data, 1, compression));
          }
        }
        mHierBox.at = writeHierarchy(w, wide, l.width, l.height, 1, mTiles, false);
      }
    }
  });

  return w.finalize();
}
