// SPDX-License-Identifier: MPL-2.0
/**
 * GIMP XCF reader — the second layered-bitmap import format beside psd.ts,
 * decoding into the same {@link LayeredRasterDoc}. Byte→structure only
 * (engine contract): DOM-free, every pointer validated, every declared length
 * clamped, every allocation budgeted. Structure and enum values are pinned
 * against GIMP's own devel-docs/xcf.txt (gimp-2-10 branch).
 *
 * ─── Coverage (the honest list) ──────────────────────────────────────────────
 * Versions:   'file' (v0) and v001…v011 fully; v012+ (GIMP 3 era) is ATTEMPTED
 *             with the v011 layout — pointers stay 8-byte and properties are
 *             length-prefixed by design, so unknown ones skip — with a
 *             'version.newer' warning; a signature we cannot even parse a
 *             version from is refused.
 * Pointers:   4-byte below v011, 8-byte at v011+ (the >4GB switch).
 * Precision:  8-bit and 16-bit integer non-linear ("gamma") — enum 150/250 at
 *             v7+ (v5/6 dev builds used the same numbers), plus implicit 8-bit
 *             for v0–v3. Linear and float precisions are REFUSED with a typed
 *             error: linearised or float samples folded naively would be a
 *             wrong-looking import (a linear→sRGB pass via pixels.ts is the
 *             documented follow-up).
 * Base types: RGB, Grayscale, Indexed (via PROP_COLORMAP). All layer pixel
 *             types normalise to RGBA8; 16-bit samples (big-endian) fold to 8.
 * Tiles:      64×64, compression none (0) / RLE (1, GIMP's own scheme — NOT
 *             PackBits) / zlib (2, via the injected {@link InflateFn}; absent
 *             inflate skips those layers with a warning). Tile byte length =
 *             gap to the next tile pointer (clamped; last tile capped at the
 *             worst-case RLE expansion).
 * Layers:     offsets, opacity (float opacity preferred), visibility, mode
 *             (raster-layers.ts table), groups (PROP_GROUP_ITEM +
 *             PROP_ITEM_PATH → isGroup/groupPath), layer masks multiplied into
 *             alpha when PROP_APPLY_MASK says active (default true option).
 * Composite:  XCF stores none — `doc.composite` is always undefined (the
 *             documented asymmetry with PSD; shells flatten with the table).
 *
 * ─── Failure policy (matches psd.ts / pdf-map.ts) ────────────────────────────
 * Not-an-XCF / refused class → typed {@link XcfUnsupportedError}. Damage
 * inside a layer/tile → onWarn + degrade (bad tile = transparent tile, bad
 * layer = geometry-only row). Budget (`maxDecodedBytes`, default 256 MiB) is
 * reserved BEFORE each allocation. Layer list order in the file is
 * TOP-to-bottom; the returned doc is bottom-to-top like psd.ts.
 */

import {
  type InflateFn,
  type LayeredRasterDoc,
  type RasterLayer,
  xcfModeToCss,
} from './raster-layers.ts';

// ─── bounds (mirrored in docs/parser-inventory.md) ───────────────────────────

const MAX_DIM = 300_000;
const MAX_LAYERS = 1_024;
const MAX_PROPS = 512;               // properties walked per property list
const MAX_NAME = 4_096;              // bytes of a layer/channel name honoured
const DEFAULT_DECODE_BUDGET = 256 << 20;
const TILE = 64;

export interface XcfReadOptions {
  /** zlib inflater — required for v011+ zlib tiles; absent → those layers warn+skip. */
  inflate?: InflateFn;
  onWarn?: (code: string, detail?: string) => void;
  /** Multiply layer masks into alpha (default true). */
  applyLayerMasks?: boolean;
  /** Decoded-output budget in bytes (default 256 MiB). */
  maxDecodedBytes?: number;
}

export class XcfUnsupportedError extends Error {
  readonly code: 'not-xcf' | 'version' | 'precision' | 'bounds';
  constructor(code: XcfUnsupportedError['code'], message: string) {
    super(message);
    this.name = 'XcfUnsupportedError';
    this.code = code;
  }
}

const MAGIC = 'gimp xcf ';

/** Cheap header check: the 9-byte magic + a parseable version token. */
export function isXcf(bytes: Uint8Array): boolean {
  return parseVersion(bytes) !== null;
}

/** → XCF numeric version (0 for 'file'), or null when not an XCF at all. */
function parseVersion(bytes: Uint8Array): number | null {
  if (bytes.length < 14) return null;
  for (let i = 0; i < MAGIC.length; i++) if (bytes[i] !== MAGIC.charCodeAt(i)) return null;
  const tok = String.fromCharCode(bytes[9]!, bytes[10]!, bytes[11]!, bytes[12]!);
  if (bytes[13] !== 0) return null;
  if (tok === 'file') return 0;
  const m = /^v(\d{3})$/.exec(tok);
  return m ? Number(m[1]) : null;
}

// Property ids (devel-docs/xcf.txt).
const PROP_END = 0;
const PROP_COLORMAP = 1;
const PROP_OPACITY = 6;
const PROP_MODE = 7;
const PROP_VISIBLE = 8;
const PROP_APPLY_MASK = 11;
const PROP_OFFSETS = 15;
const PROP_COMPRESSION = 17;
const PROP_GROUP_ITEM = 29;
const PROP_ITEM_PATH = 30;
const PROP_FLOAT_OPACITY = 33;

export function readXcf(bytes: Uint8Array, opts: XcfReadOptions = {}): LayeredRasterDoc {
  const warnings: string[] = [];
  const warn = (code: string, detail?: string): void => {
    warnings.push(code);
    opts.onWarn?.(code, detail);
  };
  const budgetMax = opts.maxDecodedBytes ?? DEFAULT_DECODE_BUDGET;
  let budgetUsed = 0;
  let budgetWarned = false;
  const reserve = (n: number): boolean => {
    if (!Number.isSafeInteger(n) || n < 0) return false;
    if (budgetUsed + n > budgetMax) {
      if (!budgetWarned) { budgetWarned = true; warn('decode.budget.exhausted', `${budgetMax} bytes`); }
      return false;
    }
    budgetUsed += n;
    return true;
  };

  const version = parseVersion(bytes);
  if (version === null) throw new XcfUnsupportedError('not-xcf', 'not an XCF file (missing gimp xcf magic)');
  if (version > 11) warn('version.newer', `v${String(version).padStart(3, '0')} parsed with the v011 layout`);
  const wide = version >= 11; // 8-byte pointers
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u32 = (p: number): number => v.getUint32(p);
  const ptrAt = (p: number): number => (wide ? v.getUint32(p) * 0x1_0000_0000 + v.getUint32(p + 4) : v.getUint32(p));
  const PTR = wide ? 8 : 4;
  const okPtr = (ptr: number): boolean => Number.isSafeInteger(ptr) && ptr > 14 && ptr < bytes.length;

  if (bytes.length < 14 + 12) throw new XcfUnsupportedError('not-xcf', 'truncated header');
  let p = 14;
  const width = u32(p);
  const height = u32(p + 4);
  const baseType = u32(p + 8); // 0 RGB, 1 Gray, 2 Indexed
  p += 12;
  if (!(width >= 1 && height >= 1 && width <= MAX_DIM && height <= MAX_DIM)) {
    throw new XcfUnsupportedError('bounds', `dimensions ${width}x${height} outside 1..${MAX_DIM}`);
  }
  if (baseType > 2) throw new XcfUnsupportedError('not-xcf', `unknown base type ${baseType}`);

  // Precision (v4+). 8-bit implicit before that.
  let sampleBytes = 1;
  if (version >= 4) {
    if (p + 4 > bytes.length) throw new XcfUnsupportedError('not-xcf', 'truncated at precision');
    const precision = u32(p);
    p += 4;
    // v4 dev builds wrote 0 for 8-bit; v5+ use the GimpPrecision enum:
    // 150 = u8 non-linear ("gamma"), 250 = u16 non-linear. Linear (100/200/…)
    // and float (500+) are refused rather than mis-folded.
    if (precision === 0 || precision === 150) sampleBytes = 1;
    else if (precision === 250) sampleBytes = 2;
    else throw new XcfUnsupportedError('precision', `precision ${precision} (8/16-bit non-linear integer supported)`);
  }

  // ── Image property list: compression + colormap. ──────────────────────────
  let compression = 1; // GIMP's default is RLE
  let colormap: Uint8Array | null = null;
  p = readProps(bytes, v, p, MAX_PROPS, (id, at, len) => {
    if (id === PROP_COMPRESSION && len >= 1) compression = bytes[at]!;
    else if (id === PROP_COLORMAP && len >= 4) {
      const n = u32(at);
      if (n > 0 && n <= 256 && at + 4 + n * 3 <= bytes.length) colormap = bytes.slice(at + 4, at + 4 + n * 3);
    }
  });
  if (p < 0) throw new XcfUnsupportedError('not-xcf', 'unreadable image property list');
  if (compression > 2) {
    warn('compression.unknown', String(compression));
    compression = 1;
  }

  // ── Layer pointer list (top-to-bottom), zero-terminated. ──────────────────
  const layerPtrs: number[] = [];
  while (p + PTR <= bytes.length) {
    const ptr = ptrAt(p);
    p += PTR;
    if (ptr === 0) break;
    if (!okPtr(ptr)) { warn('layer.bad', 'pointer outside file'); break; }
    if (layerPtrs.length >= MAX_LAYERS) throw new XcfUnsupportedError('bounds', `more than ${MAX_LAYERS} layers`);
    layerPtrs.push(ptr);
  }

  // ── Decode each layer (file order: TOP first). ────────────────────────────
  interface XLayer { layer: RasterLayer; itemPath: number[] | null }
  const topDown: XLayer[] = [];
  for (const ptr of layerPtrs) {
    const l = readLayer(bytes, v, ptr, {
      wide, PTR, ptrAt, okPtr, u32, sampleBytes, baseType, colormap, compression,
      inflate: opts.inflate, applyMasks: opts.applyLayerMasks !== false, reserve, warn,
    });
    if (l) topDown.push(l);
  }

  // ── Group structure via item paths. ───────────────────────────────────────
  // A group layer's item path is the tree address; a member's path has the
  // group's path as a proper prefix. Resolve groupPath (top-down indices
  // first, then remap after the bottom-up reversal).
  const pathKey = (path: number[]): string => path.join('/');
  const groupByPath = new Map<string, number>();
  topDown.forEach((x, i) => {
    if (x.layer.isGroup && x.itemPath) groupByPath.set(pathKey(x.itemPath), i);
  });
  topDown.forEach((x) => {
    if (!x.itemPath || x.itemPath.length <= 1) return;
    const path: number[] = [];
    for (let k = 1; k < x.itemPath.length; k++) {
      const g = groupByPath.get(pathKey(x.itemPath.slice(0, k)));
      if (g !== undefined) path.push(g);
    }
    x.layer.groupPath = path;
  });
  // Reverse to bottom-to-top and remap groupPath indices.
  const n = topDown.length;
  const layers: RasterLayer[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const l = topDown[i]!.layer;
    l.groupPath = l.groupPath.map((g) => n - 1 - g);
    layers.push(l);
  }

  return {
    format: 'xcf',
    width,
    height,
    depth: sampleBytes === 2 ? 16 : 8,
    colorMode: baseType === 1 ? 'gray' : 'rgb',
    layers,
    warnings,
  };
}

// ─── property list walker ────────────────────────────────────────────────────

/**
 * Walk one property list from `p`; `visit` sees (id, payloadOffset, length)
 * for every property. Returns the offset just past PROP_END, or -1 on damage.
 */
function readProps(
  bytes: Uint8Array,
  v: DataView,
  p: number,
  maxProps: number,
  visit: (id: number, at: number, len: number) => void,
): number {
  for (let i = 0; i < maxProps; i++) {
    if (p + 8 > bytes.length) return -1;
    const id = v.getUint32(p);
    const len = v.getUint32(p + 4);
    p += 8;
    if (id === PROP_END) return p;
    const end = p + len;
    if (len > bytes.length - p) return -1; // declared payload overruns the file
    visit(id, p, len);
    p = end;
  }
  return -1; // list refused to end
}

// ─── layer decode ────────────────────────────────────────────────────────────

interface Ctx {
  wide: boolean;
  PTR: number;
  ptrAt: (p: number) => number;
  okPtr: (ptr: number) => boolean;
  u32: (p: number) => number;
  sampleBytes: number;
  baseType: number;
  colormap: Uint8Array | null;
  compression: number;
  inflate: InflateFn | undefined;
  applyMasks: boolean;
  reserve: (n: number) => boolean;
  warn: (code: string, detail?: string) => void;
}

function readLayer(
  bytes: Uint8Array,
  v: DataView,
  at: number,
  ctx: Ctx,
): { layer: RasterLayer; itemPath: number[] | null } | null {
  const { u32, warn } = ctx;
  if (at + 12 > bytes.length) { warn('layer.bad', 'truncated layer header'); return null; }
  const w = u32(at);
  const h = u32(at + 4);
  const type = u32(at + 8); // 0 RGB 1 RGBA 2 Gray 3 GrayA 4 Indexed 5 IndexedA
  if (type > 5) { warn('layer.bad', `unknown layer type ${type}`); return null; }
  if (w > MAX_DIM || h > MAX_DIM) { warn('layer.bad', `layer ${w}x${h} oversized`); return null; }
  let p = at + 12;
  // Name: u32 length INCLUDING the terminating NUL, then bytes (UTF-8).
  if (p + 4 > bytes.length) { warn('layer.bad', 'truncated at name'); return null; }
  const nameLen = u32(p);
  p += 4;
  let name = '';
  if (nameLen > 0) {
    const take = Math.min(nameLen - 1, MAX_NAME, bytes.length - p);
    if (take > 0) {
      try {
        name = new TextDecoder().decode(bytes.subarray(p, p + take));
      } catch {
        name = '';
      }
    }
    if (nameLen > bytes.length - p) { warn('layer.bad', 'name overruns file'); return null; }
    p += nameLen;
  }

  // Layer properties.
  let opacity = 1;
  let visible = true;
  let mode = 0;
  let offX = 0;
  let offY = 0;
  let isGroup = false;
  let applyMask = false;
  let itemPath: number[] | null = null;
  p = readProps(bytes, v, p, MAX_PROPS, (id, propAt, len) => {
    if (id === PROP_OPACITY && len >= 4) opacity = Math.min(255, u32(propAt)) / 255;
    else if (id === PROP_FLOAT_OPACITY && len >= 4) {
      const f = v.getFloat32(propAt);
      if (Number.isFinite(f)) opacity = Math.min(1, Math.max(0, f));
    } else if (id === PROP_VISIBLE && len >= 4) visible = u32(propAt) !== 0;
    else if (id === PROP_MODE && len >= 4) mode = u32(propAt);
    else if (id === PROP_OFFSETS && len >= 8) { offX = v.getInt32(propAt); offY = v.getInt32(propAt + 4); }
    else if (id === PROP_GROUP_ITEM) isGroup = true;
    else if (id === PROP_APPLY_MASK && len >= 4) applyMask = u32(propAt) !== 0;
    else if (id === PROP_ITEM_PATH && len >= 4) {
      const count = Math.min(len >> 2, 64);
      const path: number[] = [];
      for (let i = 0; i < count; i++) path.push(u32(propAt + i * 4));
      itemPath = path;
    }
  });
  if (p < 0) { warn('layer.bad', `"${name}" unreadable property list`); return null; }

  const blend = xcfModeToCss(mode);
  if (!blend.known) warn('blend.unknown', `xcf mode ${mode}`);
  const layer: RasterLayer = {
    name,
    x: offX,
    y: offY,
    width: w,
    height: h,
    pixels: new Uint8Array(0),
    opacity,
    blend: blend.css,
    blendRaw: `xcf:${mode}`,
    blendLossy: blend.lossy,
    visible,
    clipped: false,
    isGroup,
    groupPath: [],
  };

  // Hierarchy + mask pointers follow the property list.
  if (!isGroup && p + ctx.PTR * 2 <= bytes.length) {
    const hierPtr = ctx.ptrAt(p);
    const maskPtr = ctx.ptrAt(p + ctx.PTR);
    if (ctx.okPtr(hierPtr)) {
      const px = readHierarchy(bytes, v, hierPtr, w, h, type, ctx);
      if (px) {
        layer.pixels = px;
        if (ctx.applyMasks && applyMask && ctx.okPtr(maskPtr)) {
          applyLayerMask(bytes, v, maskPtr, px, w, h, ctx);
        }
      }
    } else if (hierPtr !== 0) {
      warn('layer.bad', `"${name}" hierarchy pointer invalid`);
    }
  }
  return { layer, itemPath };
}

/** Bytes per pixel for an XCF layer type at the file's sample width. */
function bppFor(type: number, sampleBytes: number): number {
  const channels = type === 0 ? 3 : type === 1 ? 4 : type === 2 ? 1 : type === 3 ? 2 : type === 4 ? 1 : 2;
  // Indexed layers always store 1 byte per index regardless of precision.
  if (type >= 4) return channels;
  return channels * sampleBytes;
}

/** Decode a hierarchy's level-0 tiles into an RGBA8 buffer. Null on refusal. */
function readHierarchy(
  bytes: Uint8Array,
  v: DataView,
  at: number,
  w: number,
  h: number,
  type: number,
  ctx: Ctx,
): Uint8Array | null {
  const { u32, warn } = ctx;
  if (at + 12 + ctx.PTR > bytes.length) { warn('layer.bad', 'truncated hierarchy'); return null; }
  const hw = u32(at);
  const hh = u32(at + 4);
  const bpp = u32(at + 8);
  const expectBpp = bppFor(type, ctx.sampleBytes);
  if (hw !== w || hh !== h) { warn('layer.bad', `hierarchy ${hw}x${hh} != layer ${w}x${h}`); return null; }
  if (bpp !== expectBpp) { warn('layer.bad', `bpp ${bpp} != expected ${expectBpp}`); return null; }
  const levelPtr = ctx.ptrAt(at + 12);
  if (!ctx.okPtr(levelPtr)) { warn('layer.bad', 'level pointer invalid'); return null; }

  if (!ctx.reserve(w * h * bpp + w * h * 4)) { warn('layer.skipped', 'budget'); return null; }
  const raw = new Uint8Array(w * h * bpp);
  if (!readLevel(bytes, v, levelPtr, w, h, bpp, raw, ctx)) return null;
  return rawToRgba(raw, w, h, type, ctx);
}

/** Assemble one level's 64×64 tiles into `raw` (bpp-interleaved). */
function readLevel(
  bytes: Uint8Array,
  v: DataView,
  at: number,
  w: number,
  h: number,
  bpp: number,
  raw: Uint8Array,
  ctx: Ctx,
): boolean {
  const { u32, warn } = ctx;
  if (at + 8 > bytes.length) { warn('layer.bad', 'truncated level'); return false; }
  const lw = u32(at);
  const lh = u32(at + 4);
  if (lw !== w || lh !== h) { warn('layer.bad', 'level size mismatch'); return false; }
  const tilesX = Math.ceil(w / TILE);
  const tilesY = Math.ceil(h / TILE);
  const nTiles = tilesX * tilesY;
  let p = at + 8;
  const ptrs: number[] = new Array(nTiles);
  for (let i = 0; i < nTiles; i++) {
    if (p + ctx.PTR > bytes.length) { warn('layer.bad', 'tile table truncated'); return false; }
    const ptr = ctx.ptrAt(p);
    p += ctx.PTR;
    if (!ctx.okPtr(ptr)) { warn('tile.bad', `tile ${i} pointer invalid`); ptrs[i] = 0; continue; }
    ptrs[i] = ptr;
  }
  // Worst-case single-tile byte length: RLE can expand ~1.5×; leave margin.
  const tileCap = TILE * TILE * bpp * 2 + 256;
  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const i = ty * tilesX + tx;
      const ptr = ptrs[i]!;
      if (!ptr) continue; // damaged pointer → transparent tile
      const tw = Math.min(TILE, w - tx * TILE);
      const th = Math.min(TILE, h - ty * TILE);
      const next = i + 1 < nTiles && ptrs[i + 1]! > ptr ? ptrs[i + 1]! : Math.min(ptr + tileCap, bytes.length);
      const tile = decodeTile(bytes, ptr, next, tw, th, bpp, ctx);
      if (!tile) { warn('tile.bad', `tile ${i}`); continue; }
      // Blit into the layer buffer.
      for (let y = 0; y < th; y++) {
        const src = y * tw * bpp;
        const dst = ((ty * TILE + y) * w + tx * TILE) * bpp;
        raw.set(tile.subarray(src, src + tw * bpp), dst);
      }
    }
  }
  return true;
}

/** Decode one tile's data (none / GIMP-RLE / zlib) to tw*th*bpp interleaved bytes. */
function decodeTile(
  bytes: Uint8Array,
  at: number,
  end: number,
  tw: number,
  th: number,
  bpp: number,
  ctx: Ctx,
): Uint8Array | null {
  const out = new Uint8Array(tw * th * bpp);
  if (ctx.compression === 0) {
    if (at + out.length > end || at + out.length > bytes.length) return null;
    out.set(bytes.subarray(at, at + out.length));
    return out;
  }
  if (ctx.compression === 2) {
    if (!ctx.inflate) { ctx.warn('tile.zlib.skipped', 'no inflate injected'); return null; }
    try {
      const inflated = ctx.inflate(bytes.subarray(at, Math.min(end, bytes.length)), out.length);
      if (inflated.length < out.length) return null;
      out.set(inflated.subarray(0, out.length));
      return out;
    } catch {
      return null;
    }
  }
  // GIMP RLE: bpp independent byte-plane streams, each encoding tw*th bytes;
  // plane j holds byte j of every pixel. Opcodes (devel-docs/xcf.txt):
  //   0..126   short run: n+1 copies of the next byte
  //   127      long run: 2-byte length then 1 value byte
  //   128      long literal: 2-byte length then that many bytes
  //   129..255 short literal: 256-n bytes
  let p = at;
  const n = tw * th;
  for (let plane = 0; plane < bpp; plane++) {
    let written = 0;
    while (written < n) {
      if (p >= end || p >= bytes.length) return null;
      const op = bytes[p++]!;
      if (op < 127) {
        const len = op + 1;
        if (p >= bytes.length || written + len > n) return null;
        const val = bytes[p++]!;
        for (let i = 0; i < len; i++) out[(written + i) * bpp + plane] = val;
        written += len;
      } else if (op === 127) {
        if (p + 3 > bytes.length) return null;
        const len = (bytes[p]! << 8) | bytes[p + 1]!;
        const val = bytes[p + 2]!;
        p += 3;
        if (len === 0 || written + len > n) return null;
        for (let i = 0; i < len; i++) out[(written + i) * bpp + plane] = val;
        written += len;
      } else if (op === 128) {
        if (p + 2 > bytes.length) return null;
        const len = (bytes[p]! << 8) | bytes[p + 1]!;
        p += 2;
        if (len === 0 || p + len > bytes.length || written + len > n) return null;
        for (let i = 0; i < len; i++) out[(written + i) * bpp + plane] = bytes[p + i]!;
        p += len;
        written += len;
      } else {
        const len = 256 - op;
        if (p + len > bytes.length || written + len > n) return null;
        for (let i = 0; i < len; i++) out[(written + i) * bpp + plane] = bytes[p + i]!;
        p += len;
        written += len;
      }
    }
  }
  return out;
}

/** Normalise a decoded (interleaved) tile buffer to RGBA8. */
function rawToRgba(raw: Uint8Array, w: number, h: number, type: number, ctx: Ctx): Uint8Array {
  const n = w * h;
  const out = new Uint8Array(n * 4);
  const sb = type >= 4 ? 1 : ctx.sampleBytes;
  const channels = type === 0 ? 3 : type === 1 ? 4 : type === 2 ? 1 : type === 3 ? 2 : type === 4 ? 1 : 2;
  const bpp = channels * sb;
  const sample = (i: number, ch: number): number => {
    const o = i * bpp + ch * sb;
    return sb === 2 ? Math.round(((raw[o]! << 8) | raw[o + 1]!) * 255 / 65535) : raw[o]!;
  };
  if (type === 0 || type === 1) {
    const hasA = type === 1;
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      out[o] = sample(i, 0);
      out[o + 1] = sample(i, 1);
      out[o + 2] = sample(i, 2);
      out[o + 3] = hasA ? sample(i, 3) : 255;
    }
  } else if (type === 2 || type === 3) {
    const hasA = type === 3;
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      const g = sample(i, 0);
      out[o] = out[o + 1] = out[o + 2] = g;
      out[o + 3] = hasA ? sample(i, 1) : 255;
    }
  } else {
    const map = ctx.colormap;
    const hasA = type === 5;
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      const idx = raw[i * bpp]!;
      if (map && idx * 3 + 2 < map.length) {
        out[o] = map[idx * 3]!;
        out[o + 1] = map[idx * 3 + 1]!;
        out[o + 2] = map[idx * 3 + 2]!;
      } else {
        out[o] = out[o + 1] = out[o + 2] = idx;
      }
      out[o + 3] = hasA ? raw[i * bpp + 1]! : 255;
    }
  }
  return out;
}

/** Decode a layer-mask channel and multiply it into the RGBA buffer's alpha. */
function applyLayerMask(
  bytes: Uint8Array,
  v: DataView,
  at: number,
  rgba: Uint8Array,
  w: number,
  h: number,
  ctx: Ctx,
): void {
  const { u32, warn } = ctx;
  // Channel structure: u32 width, u32 height, name, props, hierarchy pointer.
  if (at + 8 > bytes.length) { warn('mask.bad', 'truncated mask channel'); return; }
  const mw = u32(at);
  const mh = u32(at + 4);
  if (mw !== w || mh !== h) { warn('mask.bad', `mask ${mw}x${mh} != layer ${w}x${h}`); return; }
  let p = at + 8;
  if (p + 4 > bytes.length) { warn('mask.bad', 'truncated mask name'); return; }
  const nameLen = u32(p);
  p += 4;
  if (nameLen > bytes.length - p) { warn('mask.bad', 'mask name overruns'); return; }
  p += nameLen;
  p = readProps(bytes, v, p, MAX_PROPS, () => { /* mask props: nothing needed */ });
  if (p < 0 || p + ctx.PTR > bytes.length) { warn('mask.bad', 'unreadable mask properties'); return; }
  const hierPtr = ctx.ptrAt(p);
  if (!ctx.okPtr(hierPtr)) { warn('mask.bad', 'mask hierarchy pointer invalid'); return; }
  // Mask hierarchy: grayscale (1 channel at the file's sample width).
  const px = readHierarchy(bytes, v, hierPtr, w, h, 2 /* Gray */, ctx);
  if (!px) { warn('mask.bad', 'mask tiles undecodable'); return; }
  for (let i = 0; i < w * h; i++) {
    const o = i * 4 + 3;
    rgba[o] = Math.round(rgba[o]! * px[i * 4]! / 255);
  }
}
