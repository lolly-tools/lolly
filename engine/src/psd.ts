// SPDX-License-Identifier: MPL-2.0
/**
 * Photoshop PSD/PSB reader — layered import for the layer-stack tool, Layout
 * Studio and the picker's flatten path. Byte→structure only (engine contract):
 * DOM-free, bounded on every declared length, and defensive against attacker
 * bytes throughout (docs/threat-model.md: a layered file is untrusted input).
 *
 * ─── Coverage (the honest list) ──────────────────────────────────────────────
 * Versions:    1 (PSD) and 2 (PSB — 8-byte section/channel lengths, 4-byte RLE
 *              row-table entries, 300k dimension ceiling). The real device
 *              guard is `maxDecodedBytes`, not the container version.
 * Color modes: RGB (3), Grayscale (1), CMYK (4 — channels un-inverted then
 *              converted through the embedded ICC profile via icc.ts when one
 *              is present and usable, else a naive 1−ink fold with a warning).
 *              Bitmap/Indexed/Lab/Duotone/Multichannel are REFUSED with a
 *              typed error — a wrong-looking import is worse than a named no.
 * Depth:       8 and 16 bits/channel (16 folded to 8 at decode, recorded in
 *              `doc.depth` so shells can label the loss). 1 and 32 refused
 *              (32-bit data actually lives in `Lr32` tagged blocks we do not
 *              walk; pretending otherwise would decode garbage).
 * Channels:    RAW (0) and RLE/PackBits (1) always; ZIP (2) and ZIP-prediction
 *              (3) when `opts.inflate` is injected, else that layer is skipped
 *              with a warning. Prediction undo is per-row: byte delta at 8-bit,
 *              per-sample big-endian delta at 16-bit.
 * Layers:      rect, blend key (raster-layers.ts table), opacity, clipping,
 *              visibility, Pascal + `luni` Unicode names, `lsct` group
 *              structure (groups surface as `isGroup` rows + `groupPath`),
 *              raster layer masks multiplied into alpha (mask rect, default
 *              colour and the disable/invert flags honoured) under
 *              `applyLayerMasks` (default true). Adjustment layers, effects,
 *              text, smart objects: their PIXELS (if any) decode; their
 *              semantics do not exist here.
 * Composite:   the merged image-data section decodes into `doc.composite` — an
 *              instant flattened preview and the fallback when every layer was
 *              skipped. Transparency honoured when the layer count was
 *              negative (the spec's "first alpha is merged transparency").
 * ICC:         image resource 1039 → `doc.icc` raw bytes.
 *
 * ─── Failure policy (matches pdf-map.ts) ─────────────────────────────────────
 * Not-a-PSD / refused class → typed {@link PsdUnsupportedError} (the fuzz
 * harness's "controlled throw"). Damage INSIDE a layer/resource → onWarn +
 * skip that piece, never the document. All loops advance a cursor bounded by
 * the real buffer, never by declared totals; every allocation is preceded by a
 * budget check against `maxDecodedBytes` (default 256 MiB) so a lying header
 * cannot OOM the host — shells on big devices may raise it.
 */

import { parseIccProfile } from './icc.ts';
import { packBitsDecode } from './packbits.ts';
import { type DeepFrame, convertSpace, linearToSrgb } from './pixels.ts';
import {
  type InflateFn,
  type LayeredRasterDoc,
  type RasterLayer,
  psdBlendToCss,
} from './raster-layers.ts';

// ─── bounds (mirrored in docs/parser-inventory.md) ───────────────────────────

const MAX_DIM_PSD = 30_000;            // PSD v1 spec ceiling
const MAX_DIM_PSB = 300_000;           // PSB spec ceiling
const MAX_LAYERS = 1_024;
const MAX_CHANNELS_PER_LAYER = 8;
const MAX_EXTRA_BLOCKS = 256;          // tagged blocks walked per layer
const MAX_RESOURCE_BLOCKS = 1_024;     // image-resource blocks walked
const DEFAULT_DECODE_BUDGET = 256 << 20; // bytes of decoded output, all layers+masks+composite
const MAX_CMYK_CACHE = 1 << 20;        // unique CMYK quads converted via ICC before naive fallback

export interface PsdReadOptions {
  /** zlib inflater for ZIP-compressed channels (16-bit files, mostly). */
  inflate?: InflateFn;
  onWarn?: (code: string, detail?: string) => void;
  /** Multiply raster layer masks into alpha (default true). */
  applyLayerMasks?: boolean;
  /** Decode only the merged composite (cheap flattened preview). */
  compositeOnly?: boolean;
  /** Decoded-output budget in bytes (default 256 MiB). */
  maxDecodedBytes?: number;
}

/** A PSD this reader refuses AS A CLASS (vs per-layer damage, which warns). */
export class PsdUnsupportedError extends Error {
  readonly code: 'not-psd' | 'color-mode' | 'depth' | 'bounds';
  constructor(code: PsdUnsupportedError['code'], message: string) {
    super(message);
    this.name = 'PsdUnsupportedError';
    this.code = code;
  }
}

/** Cheap header check: '8BPS' + version 1|2. Prefix-only, never throws. */
export function isPsd(bytes: Uint8Array): boolean {
  if (bytes.length < 6) return false;
  if (bytes[0] !== 0x38 || bytes[1] !== 0x42 || bytes[2] !== 0x50 || bytes[3] !== 0x53) return false; // '8BPS'
  const version = (bytes[4]! << 8) | bytes[5]!;
  return version === 1 || version === 2;
}

// ─── cursor ──────────────────────────────────────────────────────────────────

/** Bounded big-endian cursor; every read is clamped to the real buffer. */
class Cur {
  readonly b: Uint8Array;
  readonly v: DataView;
  p = 0;
  constructor(bytes: Uint8Array) {
    this.b = bytes;
    this.v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  get left(): number { return this.b.length - this.p; }
  need(n: number): boolean { return n >= 0 && this.p + n <= this.b.length; }
  u8(): number { return this.b[this.p++]!; }
  u16(): number { const x = this.v.getUint16(this.p); this.p += 2; return x; }
  i16(): number { const x = this.v.getInt16(this.p); this.p += 2; return x; }
  u32(): number { const x = this.v.getUint32(this.p); this.p += 4; return x; }
  i32(): number { const x = this.v.getInt32(this.p); this.p += 4; return x; }
  /** 64-bit length as a JS number; anything above 2^53 is damage anyway. */
  u64(): number { const hi = this.v.getUint32(this.p); const lo = this.v.getUint32(this.p + 4); this.p += 8; return hi * 0x1_0000_0000 + lo; }
  ascii(n: number): string {
    let s = '';
    for (let i = 0; i < n; i++) s += String.fromCharCode(this.b[this.p + i]!);
    this.p += n;
    return s;
  }
}

// ─── the reader ──────────────────────────────────────────────────────────────

interface ChannelRef { id: number; length: number }

interface LayerRec {
  top: number; left: number; bottom: number; right: number;
  channels: ChannelRef[];
  blendKey: string;
  opacity: number;      // 0..255
  clipping: boolean;
  hidden: boolean;
  name: string;
  // 'lsct' section divider: 0 none, 1/2 group start (open/closed), 3 bounding divider.
  section: number;
  mask: null | {
    top: number; left: number; bottom: number; right: number;
    defaultColor: number; disabled: boolean; inverted: boolean;
  };
  /** Absolute offset/length of this layer's channel image data. */
  dataAt: number;
}

export function readPsd(bytes: Uint8Array, opts: PsdReadOptions = {}): LayeredRasterDoc {
  const warnings: string[] = [];
  const warn = (code: string, detail?: string): void => {
    warnings.push(code);
    opts.onWarn?.(code, detail);
  };
  const budgetMax = opts.maxDecodedBytes ?? DEFAULT_DECODE_BUDGET;
  let budgetUsed = 0;
  /** Reserve `n` decoded bytes; false (with one warning) once exhausted. */
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

  if (!isPsd(bytes)) throw new PsdUnsupportedError('not-psd', 'not a PSD/PSB file (missing 8BPS signature)');
  const c = new Cur(bytes);
  if (!c.need(26)) throw new PsdUnsupportedError('not-psd', 'truncated header');
  c.p = 4;
  const psb = c.u16() === 2;
  c.p += 6; // reserved
  const headerChannels = c.u16();
  const height = c.u32();
  const width = c.u32();
  const depth = c.u16();
  const mode = c.u16();

  const maxDim = psb ? MAX_DIM_PSB : MAX_DIM_PSD;
  if (!(width >= 1 && height >= 1 && width <= maxDim && height <= maxDim)) {
    throw new PsdUnsupportedError('bounds', `dimensions ${width}x${height} outside 1..${maxDim}`);
  }
  if (headerChannels < 1 || headerChannels > 56) throw new PsdUnsupportedError('bounds', `channel count ${headerChannels}`);
  if (depth !== 8 && depth !== 16) {
    throw new PsdUnsupportedError('depth', `${depth} bits/channel (only 8 and 16 are supported)`);
  }
  const colorMode: 'rgb' | 'gray' | 'cmyk' =
    mode === 3 ? 'rgb' : mode === 1 ? 'gray' : mode === 4 ? 'cmyk'
      : ((): never => { throw new PsdUnsupportedError('color-mode', `PSD color mode ${mode} (RGB, grayscale and CMYK are supported)`); })();

  const sectionLen = (): number => (psb ? c.u64() : c.u32());

  // Color mode data — length-skipped (indexed/duotone payloads, refused above).
  if (!c.need(4)) throw new PsdUnsupportedError('not-psd', 'truncated at color mode data');
  const cmLen = c.u32();
  c.p = Math.min(c.p + cmLen, bytes.length);

  // ── Image resources: walk for ICC (1039); everything else length-skipped. ──
  let icc: Uint8Array | undefined;
  if (!c.need(4)) throw new PsdUnsupportedError('not-psd', 'truncated at image resources');
  const resLen = c.u32();
  const resEnd = Math.min(c.p + resLen, bytes.length);
  for (let nRes = 0; c.p + 12 <= resEnd && nRes < MAX_RESOURCE_BLOCKS; nRes++) {
    const sig = c.ascii(4);
    if (sig !== '8BIM') { warn('resource.bad', `signature ${JSON.stringify(sig)}`); break; }
    const id = c.u16();
    const nameLen = c.u8();
    c.p += nameLen + ((nameLen + 1) % 2 === 1 ? 1 : 0); // pascal name padded to even (incl. length byte)
    if (c.p + 4 > resEnd) break;
    const size = c.u32();
    const dataEnd = c.p + size;
    if (dataEnd > resEnd) { warn('resource.bad', `resource ${id} overruns section`); break; }
    if (id === 1039 && size > 0) icc = bytes.slice(c.p, dataEnd);
    c.p = dataEnd + (size % 2); // padded to even
  }
  c.p = resEnd;

  // ── Layer & mask info ──────────────────────────────────────────────────────
  if (!c.need(psb ? 8 : 4)) throw new PsdUnsupportedError('not-psd', 'truncated at layer & mask info');
  const lmiLen = sectionLen();
  const lmiEnd = Math.min(c.p + lmiLen, bytes.length);
  const afterLmi = lmiEnd;

  const records: LayerRec[] = [];
  let mergedHasAlpha = false;
  if (!opts.compositeOnly && lmiLen > 0 && c.p + (psb ? 8 : 4) <= lmiEnd) {
    const liLen = sectionLen();
    const liEnd = Math.min(c.p + liLen, lmiEnd);
    if (liLen > 0 && c.p + 2 <= liEnd) {
      const rawCount = c.i16();
      mergedHasAlpha = rawCount < 0;
      const count = Math.abs(rawCount);
      if (count > MAX_LAYERS) throw new PsdUnsupportedError('bounds', `${count} layers (cap ${MAX_LAYERS})`);
      for (let i = 0; i < count; i++) {
        const rec = readLayerRecord(c, liEnd, psb, warn);
        if (!rec) { warn('layer.bad', `record ${i} unreadable — remaining layers dropped`); break; }
        records.push(rec);
      }
      // Channel image data follows the records, in record order.
      for (const rec of records) {
        rec.dataAt = c.p;
        for (const ch of rec.channels) c.p = Math.min(c.p + ch.length, liEnd);
      }
    }
  }
  c.p = afterLmi;

  // ── Merged composite (image data section, always at the end) ──────────────
  let composite: LayeredRasterDoc['composite'];
  if (c.need(2)) {
    composite = readComposite(c, width, height, depth, headerChannels, colorMode, mergedHasAlpha, icc, reserve, warn, opts.inflate);
  } else {
    warn('composite.bad', 'missing image data section');
  }

  // ── Decode layers (records are stored bottom-to-top in the file) ──────────
  const layers: RasterLayer[] = [];
  if (!opts.compositeOnly && records.length) {
    // Group structure: in TOP-DOWN order a group-start ('lsct' 1|2) precedes its
    // children and a bounding divider (3) closes them. File order is bottom-up,
    // so walk the records REVERSED with a group stack, then reverse the result
    // back and remap the stack's positions to final bottom-up indices.
    const topDown = [...records].reverse();
    const out: Array<RasterLayer | null> = [];
    const stack: number[] = []; // indices into `out` of open groups
    for (const rec of topDown) {
      if (rec.section === 3) { stack.pop(); out.push(null); continue; } // divider row: dropped
      const blend = psdBlendToCss(rec.blendKey);
      if (!blend.known) warn('blend.unknown', rec.blendKey);
      const isGroup = rec.section === 1 || rec.section === 2;
      const layer: RasterLayer = {
        name: rec.name,
        x: rec.left,
        y: rec.top,
        width: Math.max(0, rec.right - rec.left),
        height: Math.max(0, rec.bottom - rec.top),
        pixels: EMPTY,
        opacity: rec.opacity / 255,
        blend: blend.css,
        blendRaw: `psd:${rec.blendKey}`,
        blendLossy: blend.lossy,
        visible: !rec.hidden,
        clipped: rec.clipping,
        isGroup,
        groupPath: [...stack],
      };
      if (!isGroup) {
        const px = decodeLayerPixels(c, rec, depth, colorMode, psb, icc, reserve, warn, opts);
        if (px) layer.pixels = px;
      }
      out.push(layer);
      if (isGroup) stack.push(out.length - 1);
    }
    // Reverse to bottom-up, drop divider slots, remap groupPath indices.
    const remap = new Map<number, number>();
    let final = 0;
    for (let i = out.length - 1; i >= 0; i--) if (out[i]) remap.set(i, final++);
    for (let i = out.length - 1; i >= 0; i--) {
      const l = out[i];
      if (!l) continue;
      l.groupPath = l.groupPath
        .map((g) => remap.get(g))
        .filter((g): g is number => g !== undefined);
      layers.push(l);
    }
  }

  return {
    format: 'psd',
    width,
    height,
    depth: depth as 8 | 16,
    colorMode,
    layers,
    ...(composite ? { composite } : {}),
    ...(icc ? { icc } : {}),
    warnings,
  };
}

const EMPTY = new Uint8Array(0);

// ─── layer record ────────────────────────────────────────────────────────────

function readLayerRecord(c: Cur, end: number, psb: boolean, warn: (c: string, d?: string) => void): LayerRec | null {
  if (c.p + 18 > end) return null;
  const top = c.i32();
  const left = c.i32();
  const bottom = c.i32();
  const right = c.i32();
  const nCh = c.u16();
  if (nCh > MAX_CHANNELS_PER_LAYER || c.p + nCh * (psb ? 10 : 6) > end) return null;
  const channels: ChannelRef[] = [];
  for (let i = 0; i < nCh; i++) {
    const id = c.i16();
    const length = psb ? c.u64() : c.u32();
    if (!Number.isSafeInteger(length)) return null; // a lying 64-bit length
    channels.push({ id, length });
  }
  if (c.p + 16 > end) return null;
  if (c.ascii(4) !== '8BIM') return null;
  const blendKey = c.ascii(4);
  const opacity = c.u8();
  const clipping = c.u8() !== 0;
  const flags = c.u8();
  c.u8(); // filler
  const extraLen = c.u32();
  const extraEnd = Math.min(c.p + extraLen, end);

  // Mask/adjustment data.
  let mask: LayerRec['mask'] = null;
  if (c.p + 4 <= extraEnd) {
    const maskLen = c.u32();
    const maskEnd = Math.min(c.p + maskLen, extraEnd);
    if (maskLen >= 20 && c.p + 18 <= maskEnd) {
      const mTop = c.i32();
      const mLeft = c.i32();
      const mBottom = c.i32();
      const mRight = c.i32();
      const defaultColor = c.u8();
      const mFlags = c.u8();
      mask = {
        top: mTop, left: mLeft, bottom: mBottom, right: mRight,
        defaultColor,
        disabled: (mFlags & 0x02) !== 0,
        inverted: (mFlags & 0x04) !== 0,
      };
    }
    c.p = maskEnd;
  }
  // Blending ranges — skipped.
  if (c.p + 4 <= extraEnd) {
    const brLen = c.u32();
    c.p = Math.min(c.p + brLen, extraEnd);
  }
  // Pascal name, padded to a multiple of 4 (including the length byte).
  let name = '';
  if (c.p < extraEnd) {
    const nameLen = c.u8();
    const avail = Math.min(nameLen, extraEnd - c.p);
    name = c.ascii(avail);
    const padded = Math.ceil((nameLen + 1) / 4) * 4 - 1 - nameLen;
    c.p = Math.min(c.p + padded, extraEnd);
  }
  // Tagged extra blocks: 'luni' (Unicode name), 'lsct' (section divider).
  let section = 0;
  for (let n = 0; c.p + 12 <= extraEnd && n < MAX_EXTRA_BLOCKS; n++) {
    const sig = c.ascii(4);
    if (sig !== '8BIM' && sig !== '8B64') break;
    const key = c.ascii(4);
    // In PSB a handful of keys carry 8-byte lengths; neither luni nor lsct does.
    const big = psb && (key === 'LMsk' || key === 'Lr16' || key === 'Lr32' || key === 'Layr'
      || key === 'Mt16' || key === 'Mt32' || key === 'Mtrn' || key === 'Alph'
      || key === 'FMsk' || key === 'lnk2' || key === 'FEid' || key === 'FXid' || key === 'PxSD');
    if (c.p + (big ? 8 : 4) > extraEnd) break;
    const len = big ? c.u64() : c.u32();
    const blockEnd = Math.min(c.p + len, extraEnd);
    if (key === 'luni' && c.p + 4 <= blockEnd) {
      const count = c.u32();
      const take = Math.min(count, (blockEnd - c.p) >> 1);
      let s = '';
      for (let i = 0; i < take; i++) s += String.fromCharCode(c.v.getUint16(c.p + i * 2));
      if (s) name = s;
    } else if (key === 'lsct' && c.p + 4 <= blockEnd) {
      section = c.u32();
      if (section < 0 || section > 3) { warn('layer.bad', `lsct type ${section}`); section = 0; }
    }
    c.p = blockEnd + (len % 2); // blocks are even-padded
    if (c.p > extraEnd) { c.p = extraEnd; break; }
  }
  c.p = extraEnd;
  return { top, left, bottom, right, channels, blendKey, opacity, clipping, hidden: (flags & 0x02) !== 0, name, section, mask, dataAt: 0 };
}

// ─── channel decoding ────────────────────────────────────────────────────────

/**
 * Decode one channel's plane to 8-bit samples (`rows*cols` bytes), from the
 * channel data at [at, at+chLen) whose first u16 is the compression method.
 * Returns null (after a warning) on damage.
 */
function decodePlane(
  bytes: Uint8Array,
  at: number,
  chLen: number,
  rows: number,
  cols: number,
  depth: number,
  psb: boolean,
  inflate: InflateFn | undefined,
  reserve: (n: number) => boolean,
  warn: (c: string, d?: string) => void,
): Uint8Array | null {
  if (rows <= 0 || cols <= 0) return new Uint8Array(0);
  const end = Math.min(at + chLen, bytes.length);
  if (at + 2 > end) { warn('channel.bad', 'truncated channel header'); return null; }
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const comp = v.getUint16(at);
  let p = at + 2;
  const bytesPerSample = depth === 16 ? 2 : 1;
  const rowBytes = cols * bytesPerSample;
  if (!reserve(rows * cols + (depth === 16 ? rows * rowBytes : 0))) return null;
  const raw = new Uint8Array(rows * rowBytes); // sample bytes before depth fold

  if (comp === 0) { // RAW
    if (p + rows * rowBytes > end) { warn('channel.bad', 'raw channel truncated'); return null; }
    raw.set(bytes.subarray(p, p + rows * rowBytes));
  } else if (comp === 1) { // RLE (PackBits per row)
    const entry = psb ? 4 : 2;
    if (p + rows * entry > end) { warn('channel.bad', 'RLE row table truncated'); return null; }
    const lens: number[] = new Array(rows);
    for (let y = 0; y < rows; y++) { lens[y] = psb ? v.getUint32(p) : v.getUint16(p); p += entry; }
    for (let y = 0; y < rows; y++) {
      const rl = lens[y]!;
      if (p + rl > end) { warn('channel.bad', `RLE row ${y} truncated`); return null; }
      if (packBitsDecode(bytes, p, p + rl, raw, y * rowBytes, rowBytes) < 0) {
        warn('channel.bad', `RLE row ${y} malformed`);
        return null;
      }
      p += rl;
    }
  } else if (comp === 2 || comp === 3) { // ZIP / ZIP with prediction
    if (!inflate) { warn('channel.zip.skipped', 'no inflate injected'); return null; }
    let inflated: Uint8Array;
    try {
      inflated = inflate(bytes.subarray(p, end), raw.length);
    } catch {
      warn('channel.bad', 'zip channel failed to inflate');
      return null;
    }
    if (inflated.length < raw.length) { warn('channel.bad', 'zip channel short'); return null; }
    raw.set(inflated.subarray(0, raw.length));
    if (comp === 3) undoPrediction(raw, rows, cols, depth);
  } else {
    warn('channel.bad', `unknown compression ${comp}`);
    return null;
  }

  if (depth === 8) return raw;
  // Fold 16-bit big-endian samples to 8.
  const out = new Uint8Array(rows * cols);
  for (let i = 0, s = 0; i < out.length; i++, s += 2) {
    out[i] = Math.round(((raw[s]! << 8) | raw[s + 1]!) * 255 / 65535);
  }
  return out;
}

/** Undo ZIP-prediction: horizontal delta per row (bytes at 8-bit, BE u16 samples at 16-bit). */
function undoPrediction(raw: Uint8Array, rows: number, cols: number, depth: number): void {
  if (depth === 8) {
    for (let y = 0; y < rows; y++) {
      const at = y * cols;
      for (let x = 1; x < cols; x++) raw[at + x] = (raw[at + x]! + raw[at + x - 1]!) & 0xff;
    }
  } else {
    const rowBytes = cols * 2;
    for (let y = 0; y < rows; y++) {
      const at = y * rowBytes;
      let prev = (raw[at]! << 8) | raw[at + 1]!;
      for (let x = 1; x < cols; x++) {
        const o = at + x * 2;
        const cur = (prev + (((raw[o]! << 8) | raw[o + 1]!))) & 0xffff;
        raw[o] = cur >> 8;
        raw[o + 1] = cur & 0xff;
        prev = cur;
      }
    }
  }
}

// ─── layer pixel assembly ────────────────────────────────────────────────────

function decodeLayerPixels(
  c: Cur,
  rec: LayerRec,
  depth: number,
  colorMode: 'rgb' | 'gray' | 'cmyk',
  psb: boolean,
  icc: Uint8Array | undefined,
  reserve: (n: number) => boolean,
  warn: (code: string, d?: string) => void,
  opts: PsdReadOptions,
): Uint8Array | null {
  const w = Math.max(0, rec.right - rec.left);
  const h = Math.max(0, rec.bottom - rec.top);
  if (w === 0 || h === 0) return null;

  // Locate each channel's data (sequential from rec.dataAt, in channel order).
  const planes = new Map<number, Uint8Array>();
  let at = rec.dataAt;
  for (const ch of rec.channels) {
    const isMask = ch.id === -2 || ch.id === -3;
    const rows = isMask && rec.mask ? Math.max(0, rec.mask.bottom - rec.mask.top) : h;
    const cols = isMask && rec.mask ? Math.max(0, rec.mask.right - rec.mask.left) : w;
    if (ch.id >= -1 || (isMask && rec.mask && opts.applyLayerMasks !== false)) {
      const plane = decodePlane(c.b, at, ch.length, rows, cols, depth, psb, opts.inflate, reserve, warn);
      if (plane) planes.set(ch.id, plane);
      else if (ch.id >= 0) { warn('layer.skipped', rec.name); return null; } // a colour channel failed → skip layer
    }
    at += ch.length;
  }

  if (!reserve(w * h * 4)) { warn('layer.skipped', `${rec.name} (budget)`); return null; }
  const out = new Uint8Array(w * h * 4);
  const n = w * h;
  const alpha = planes.get(-1);

  if (colorMode === 'gray') {
    const g = planes.get(0);
    if (!g) { warn('layer.skipped', rec.name); return null; }
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      out[o] = out[o + 1] = out[o + 2] = g[i]!;
      out[o + 3] = alpha ? alpha[i]! : 255;
    }
  } else if (colorMode === 'rgb') {
    const r = planes.get(0);
    const g = planes.get(1);
    const b = planes.get(2);
    if (!r || !g || !b) { warn('layer.skipped', rec.name); return null; }
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      out[o] = r[i]!;
      out[o + 1] = g[i]!;
      out[o + 2] = b[i]!;
      out[o + 3] = alpha ? alpha[i]! : 255;
    }
  } else { // cmyk
    const cyan = planes.get(0);
    const mag = planes.get(1);
    const yel = planes.get(2);
    const key = planes.get(3);
    if (!cyan || !mag || !yel || !key) { warn('layer.skipped', rec.name); return null; }
    cmykPlanesToRgba(cyan, mag, yel, key, alpha ?? null, n, out, icc, warn);
  }

  // Multiply the raster mask into alpha.
  if (rec.mask && opts.applyLayerMasks !== false && !rec.mask.disabled) {
    const mPlane = planes.get(-2) ?? planes.get(-3);
    if (mPlane) applyMask(out, w, h, rec, mPlane);
  }
  return out;
}

function applyMask(out: Uint8Array, w: number, h: number, rec: LayerRec, mPlane: Uint8Array): void {
  const mask = rec.mask!;
  const mw = Math.max(0, mask.right - mask.left);
  const mh = Math.max(0, mask.bottom - mask.top);
  if (mPlane.length < mw * mh) return;
  for (let y = 0; y < h; y++) {
    const docY = rec.top + y;
    const my = docY - mask.top;
    for (let x = 0; x < w; x++) {
      const docX = rec.left + x;
      const mx = docX - mask.left;
      let mv = mask.defaultColor;
      if (mx >= 0 && mx < mw && my >= 0 && my < mh) mv = mPlane[my * mw + mx]!;
      if (mask.inverted) mv = 255 - mv;
      const o = (y * w + x) * 4 + 3;
      out[o] = Math.round(out[o]! * mv / 255);
    }
  }
}

// ─── CMYK → sRGB ─────────────────────────────────────────────────────────────

/**
 * Convert CMYK planes (PSD-inverted: 255 = no ink) to sRGB. With a parseable
 * embedded profile the unique quads run through profile.toLab → one Lab
 * DeepFrame → convertSpace('srgb-linear') → linearToSrgb (batched, cached);
 * without one, the naive 1−ink fold with a warning.
 */
function cmykPlanesToRgba(
  cy: Uint8Array, ma: Uint8Array, ye: Uint8Array, ke: Uint8Array,
  alpha: Uint8Array | null,
  n: number,
  out: Uint8Array,
  icc: Uint8Array | undefined,
  warn: (code: string, d?: string) => void,
): void {
  const profile = icc ? parseIccProfile(icc) : null;
  const lut = profile && profile.dataColourSpace === 'CMYK' ? buildCmykLut(profile, cy, ma, ye, ke, n, warn) : null;
  if (!lut && icc) warn('cmyk.no-profile', 'embedded profile unusable — naive conversion');
  if (!lut && !icc) warn('cmyk.no-profile', 'no embedded profile — naive conversion');
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const key = (((cy[i]! << 8) | ma[i]!) * 65536) + ((ye[i]! << 8) | ke[i]!);
    const hit = lut?.get(key);
    if (hit !== undefined) {
      out[o] = (hit >> 16) & 0xff;
      out[o + 1] = (hit >> 8) & 0xff;
      out[o + 2] = hit & 0xff;
    } else {
      // Naive: ink = 1 − v/255 (PSD stores CMYK inverted); rgb = (1−ink)(1−k).
      const kf = ke[i]! / 255;
      out[o] = Math.round((cy[i]! / 255) * kf * 255);
      out[o + 1] = Math.round((ma[i]! / 255) * kf * 255);
      out[o + 2] = Math.round((ye[i]! / 255) * kf * 255);
    }
    out[o + 3] = alpha ? alpha[i]! : 255;
  }
}

/** ICC-convert the unique CMYK quads of this plane set (capped at MAX_CMYK_CACHE). */
function buildCmykLut(
  profile: NonNullable<ReturnType<typeof parseIccProfile>>,
  cy: Uint8Array, ma: Uint8Array, ye: Uint8Array, ke: Uint8Array,
  n: number,
  warn: (code: string, d?: string) => void,
): Map<number, number> | null {
  const unique = new Map<number, number>(); // packed quad → slot
  for (let i = 0; i < n; i++) {
    const key = (((cy[i]! << 8) | ma[i]!) * 65536) + ((ye[i]! << 8) | ke[i]!);
    if (!unique.has(key)) {
      if (unique.size >= MAX_CMYK_CACHE) { warn('cmyk.cache.full', 'remaining pixels use naive conversion'); break; }
      unique.set(key, unique.size);
    }
  }
  const count = unique.size;
  if (!count) return null;
  // One Lab "frame" of the unique quads, converted in a single batch.
  const lab = new Float32Array(count * 4);
  let ok = 0;
  for (const [key, slot] of unique) {
    const kk = key % 65536;
    const hi = (key - kk) / 65536;
    // PSD stores CMYK inverted: device ink fraction = 1 − stored/255.
    const dev = [1 - ((hi >> 8) & 0xff) / 255, 1 - (hi & 0xff) / 255, 1 - ((kk >> 8) & 0xff) / 255, 1 - (kk & 0xff) / 255];
    const l = profile.toLab('relative', dev) ?? profile.toLab('perceptual', dev);
    const o = slot * 4;
    if (l) {
      lab[o] = l[0];
      lab[o + 1] = l[1];
      lab[o + 2] = l[2];
      lab[o + 3] = 1;
      ok++;
    } else {
      lab[o + 3] = -1; // sentinel: unusable
    }
  }
  if (!ok) return null;
  let rgbFrame: DeepFrame;
  try {
    rgbFrame = convertSpace({ width: count, height: 1, data: lab, space: 'lab' }, 'srgb-linear');
  } catch {
    return null;
  }
  const lut = new Map<number, number>();
  for (const [key, slot] of unique) {
    const o = slot * 4;
    if (lab[o + 3] === -1) continue;
    const r = Math.round(Math.min(1, Math.max(0, linearToSrgb(rgbFrame.data[o]!))) * 255);
    const g = Math.round(Math.min(1, Math.max(0, linearToSrgb(rgbFrame.data[o + 1]!))) * 255);
    const b = Math.round(Math.min(1, Math.max(0, linearToSrgb(rgbFrame.data[o + 2]!))) * 255);
    lut.set(key, (r << 16) | (g << 8) | b);
  }
  return lut;
}

// ─── merged composite ────────────────────────────────────────────────────────

function readComposite(
  c: Cur,
  width: number,
  height: number,
  depth: number,
  headerChannels: number,
  colorMode: 'rgb' | 'gray' | 'cmyk',
  mergedHasAlpha: boolean,
  icc: Uint8Array | undefined,
  reserve: (n: number) => boolean,
  warn: (code: string, d?: string) => void,
  inflate?: InflateFn,
): LayeredRasterDoc['composite'] {
  const comp = c.u16();
  const bytesPerSample = depth === 16 ? 2 : 1;
  const rowBytes = width * bytesPerSample;
  const colorChannels = colorMode === 'rgb' ? 3 : colorMode === 'gray' ? 1 : 4;
  const nCh = Math.min(headerChannels, colorChannels + 1); // colour + at most one alpha
  if (!reserve(nCh * height * width + (depth === 16 ? nCh * height * rowBytes : 0))) return undefined;

  const planes: Uint8Array[] = [];
  const v = c.v;
  let p = c.p;
  const end = c.b.length;
  // NOTE: the composite RLE row table covers headerChannels*height rows even
  // when we only assemble the first nCh planes — walk it all to stay in sync.
  if (comp === 0) {
    for (let ch = 0; ch < nCh; ch++) {
      const at = p + ch * height * rowBytes;
      if (at + height * rowBytes > end) { warn('composite.bad', 'raw composite truncated'); return undefined; }
      planes.push(foldPlane(c.b, at, height, width, depth));
    }
  } else if (comp === 1) {
    const psb = compositeIsPsb(c);
    const entry = psb ? 4 : 2;
    const tableLen = headerChannels * height * entry;
    if (p + tableLen > end) { warn('composite.bad', 'composite RLE table truncated'); return undefined; }
    const lens: number[] = new Array(headerChannels * height);
    for (let i = 0; i < lens.length; i++) { lens[i] = psb ? v.getUint32(p) : v.getUint16(p); p += entry; }
    let rowAt = p;
    for (let ch = 0; ch < headerChannels; ch++) {
      const raw = ch < nCh ? new Uint8Array(height * rowBytes) : null;
      for (let y = 0; y < height; y++) {
        const rl = lens[ch * height + y]!;
        if (rowAt + rl > end) { warn('composite.bad', `composite row ${ch}:${y} truncated`); return undefined; }
        if (raw && packBitsDecode(c.b, rowAt, rowAt + rl, raw, y * rowBytes, rowBytes) < 0) {
          warn('composite.bad', `composite row ${ch}:${y} malformed`);
          return undefined;
        }
        rowAt += rl;
      }
      if (raw) planes.push(depth === 16 ? fold16(raw, height * width) : raw);
    }
  } else if (comp === 2 || comp === 3) {
    // ZIP composites are vanishingly rare; honest skip when uninflatable.
    if (!inflate) { warn('composite.bad', `compression ${comp} needs inflate`); return undefined; }
    warn('composite.bad', `compression ${comp} unsupported for the merged image`);
    return undefined;
  } else {
    warn('composite.bad', `unknown compression ${comp}`);
    return undefined;
  }

  const n = width * height;
  const out = new Uint8Array(n * 4);
  const alpha = mergedHasAlpha && planes.length > colorChannels ? planes[colorChannels]! : null;
  if (colorMode === 'gray') {
    const g = planes[0];
    if (!g) return undefined;
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      out[o] = out[o + 1] = out[o + 2] = g[i]!;
      out[o + 3] = alpha ? alpha[i]! : 255;
    }
  } else if (colorMode === 'rgb') {
    if (planes.length < 3) return undefined;
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      out[o] = planes[0]![i]!;
      out[o + 1] = planes[1]![i]!;
      out[o + 2] = planes[2]![i]!;
      out[o + 3] = alpha ? alpha[i]! : 255;
    }
  } else {
    if (planes.length < 4) return undefined;
    cmykPlanesToRgba(planes[0]!, planes[1]!, planes[2]!, planes[3]!, alpha, n, out, icc, warn);
  }
  return { width, height, pixels: out };
}

/** Extract + depth-fold one raw planar channel. */
function foldPlane(bytes: Uint8Array, at: number, rows: number, cols: number, depth: number): Uint8Array {
  if (depth === 8) return bytes.slice(at, at + rows * cols);
  return fold16(bytes.subarray(at, at + rows * cols * 2), rows * cols);
}

function fold16(raw: Uint8Array, samples: number): Uint8Array {
  const out = new Uint8Array(samples);
  for (let i = 0, s = 0; i < samples; i++, s += 2) {
    out[i] = Math.round(((raw[s]! << 8) | raw[s + 1]!) * 255 / 65535);
  }
  return out;
}

// The composite section's RLE row-table entry width follows the FILE's version.
// The cursor knows it via the header we already parsed; stash-free re-read:
function compositeIsPsb(c: Cur): boolean {
  return c.b.length >= 6 && ((c.b[4]! << 8) | c.b[5]!) === 2;
}
