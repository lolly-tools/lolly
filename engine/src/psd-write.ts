// SPDX-License-Identifier: MPL-2.0
/**
 * Photoshop PSD writer — the write-back half of layered import (psd.ts reads).
 * Emits the simplest PSD that Photoshop, GIMP and Krita all open: version 1,
 * 8-bit RGB, per-layer RGBA channels (PackBits-compressed, RAW per channel
 * when RLE would grow the data), Pascal + `luni` layer names, opacity /
 * blend / visibility, and a merged composite section (many readers key their
 * preview — and Photoshop its "compatibility" path — off it).
 *
 * Knowingly dropped relative to a full PSD (documented, deliberate):
 *   - groups: rows with `isGroup` semantics are not emitted (flat layer list;
 *     `lsct` emission is a listed follow-up),
 *   - layer masks (bake them into alpha upstream), clipping flags,
 *   - 16/32-bit depth, CMYK (we emit sRGB),
 *   - blend modes outside the CSS 16 (they arrive already collapsed).
 * Round-trip contract, pinned by tests/psd.test.ts: readPsd(writePsd(doc))
 * reproduces every layer's name/rect/opacity/visibility/blend/pixels exactly.
 *
 * Layer order: `layers[0]` is the BOTTOM layer, matching LayeredRasterDoc —
 * PSD stores records bottom-to-top, so file order equals array order.
 *
 * Pure + DOM-free (engine contract); deterministic bytes for a given doc.
 */

import { packBitsEncode } from './packbits.ts';
import { type CssBlendMode, CSS_TO_PSD_BLEND } from './raster-layers.ts';

export interface PsdWriteLayer {
  name: string;
  /** Document-space bounds; width/height must match pixels. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** RGBA8 un-premultiplied sRGB, length width*height*4. */
  pixels: Uint8Array;
  /** 0..1, default 1. */
  opacity?: number;
  /** Default 'normal'; reverse-mapped through CSS_TO_PSD_BLEND. */
  blend?: CssBlendMode;
  /** Default true. */
  visible?: boolean;
}

export interface PsdWriteDoc {
  width: number;
  height: number;
  /** Bottom-to-top. */
  layers: PsdWriteLayer[];
  /** Flattened RGBA8 at doc size; when omitted, flattened here by plain
   *  src-over (blend modes are NOT simulated — the layers carry them). */
  composite?: Uint8Array;
  /** Embedded as image resource 1039 when present. */
  icc?: Uint8Array;
}

const MAX_DIM = 30_000; // PSD v1 ceiling — a bigger doc needs a PSB writer (not built)

/** Serialise `doc` as a PSD v1 byte stream. Throws TypeError on an incoherent doc. */
export function writePsd(doc: PsdWriteDoc): Uint8Array {
  const { width, height } = doc;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > MAX_DIM || height > MAX_DIM) {
    throw new TypeError(`writePsd: dimensions ${width}x${height} outside 1..${MAX_DIM}`);
  }
  for (const l of doc.layers) {
    if (!Number.isInteger(l.width) || !Number.isInteger(l.height) || l.width < 0 || l.height < 0) {
      throw new TypeError(`writePsd: layer "${l.name}" has non-integer bounds`);
    }
    if (l.pixels.length !== l.width * l.height * 4) {
      throw new TypeError(`writePsd: layer "${l.name}" pixels length ${l.pixels.length} != ${l.width}x${l.height}x4`);
    }
  }
  if (doc.composite && doc.composite.length !== width * height * 4) {
    throw new TypeError('writePsd: composite length does not match document size');
  }

  const chunks: Uint8Array[] = [];
  const push = (u: Uint8Array): void => { chunks.push(u); };

  // ── Header ────────────────────────────────────────────────────────────────
  const header = new Uint8Array(26);
  const hv = new DataView(header.buffer);
  header.set([0x38, 0x42, 0x50, 0x53]); // '8BPS'
  hv.setUint16(4, 1);        // version 1
  hv.setUint16(12, 3);       // channels in the merged image (RGB)
  hv.setUint32(14, height);
  hv.setUint32(18, width);
  hv.setUint16(22, 8);       // depth
  hv.setUint16(24, 3);       // RGB
  push(header);

  // ── Color mode data (empty) ───────────────────────────────────────────────
  push(u32(0));

  // ── Image resources: ICC 1039 or empty ────────────────────────────────────
  if (doc.icc && doc.icc.length) {
    const size = doc.icc.length;
    const padded = size + (size % 2);
    const block = new Uint8Array(4 + 2 + 2 + 4 + padded); // '8BIM' id name(2) size data
    const bv = new DataView(block.buffer);
    block.set([0x38, 0x42, 0x49, 0x4d]); // '8BIM'
    bv.setUint16(4, 1039);
    // empty pascal name: length byte 0 + 1 pad byte = bytes 6..7 already zero
    bv.setUint32(8, size);
    block.set(doc.icc, 12);
    push(u32(block.length));
    push(block);
  } else {
    push(u32(0));
  }

  // ── Layer info ────────────────────────────────────────────────────────────
  const layerParts: Uint8Array[] = [];
  const dataParts: Uint8Array[] = [];
  // Channel order per layer: alpha first (Photoshop's own habit), then RGB.
  const CH_IDS = [-1, 0, 1, 2] as const;
  for (const l of doc.layers) {
    const encoded = CH_IDS.map((id) => encodeChannel(l, id));
    // Record
    const nameBytes = pascalName(l.name);
    const luni = luniBlock(l.name);
    const extraLen = 4 + 4 + nameBytes.length + luni.length; // mask(0) + ranges(0) + name + luni
    const rec = new Uint8Array(16 + 2 + CH_IDS.length * 6 + 4 + 4 + 1 + 1 + 1 + 1 + 4 + extraLen);
    const rv = new DataView(rec.buffer);
    let p = 0;
    rv.setInt32(p, l.y); p += 4;
    rv.setInt32(p + 0, l.x); p += 4;
    rv.setInt32(p, l.y + l.height); p += 4;
    rv.setInt32(p, l.x + l.width); p += 4;
    rv.setUint16(p, CH_IDS.length); p += 2;
    for (let i = 0; i < CH_IDS.length; i++) {
      rv.setInt16(p, CH_IDS[i]!); p += 2;
      rv.setUint32(p, encoded[i]!.length); p += 4;
    }
    rec.set([0x38, 0x42, 0x49, 0x4d], p); p += 4; // '8BIM'
    const key = CSS_TO_PSD_BLEND[l.blend ?? 'normal'] ?? 'norm';
    for (let i = 0; i < 4; i++) rec[p + i] = key.charCodeAt(i);
    p += 4;
    rec[p++] = Math.max(0, Math.min(255, Math.round((l.opacity ?? 1) * 255)));
    rec[p++] = 0; // clipping: base
    rec[p++] = (l.visible ?? true) ? 0 : 0x02; // flags: bit 1 = hidden
    rec[p++] = 0; // filler
    rv.setUint32(p, extraLen); p += 4;
    rv.setUint32(p, 0); p += 4; // mask data: none
    rv.setUint32(p, 0); p += 4; // blending ranges: none
    rec.set(nameBytes, p); p += nameBytes.length;
    rec.set(luni, p); p += luni.length;
    layerParts.push(rec);
    for (const e of encoded) dataParts.push(e);
  }
  const layerCount = doc.layers.length;
  const layerBody = concat([i16(layerCount), ...layerParts, ...dataParts]);
  const layerInfoLen = layerBody.length + (layerBody.length % 2);
  // Layer & mask info = layer info (len + body + pad) + global layer mask info (0)
  const lmiLen = 4 + layerInfoLen + 4;
  push(u32(lmiLen));
  push(u32(layerInfoLen));
  push(layerBody);
  if (layerBody.length % 2) push(new Uint8Array(1));
  push(u32(0)); // global layer mask info: empty

  // ── Merged composite (RLE, planar RGB) ────────────────────────────────────
  const flat = doc.composite ?? flatten(doc);
  const compParts: Uint8Array[] = [];
  const rowTable = new Uint8Array(3 * height * 2);
  const tv = new DataView(rowTable.buffer);
  const row = new Uint8Array(width);
  let ti = 0;
  for (let ch = 0; ch < 3; ch++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) row[x] = flat[(y * width + x) * 4 + ch]!;
      const packed = packBitsEncode(row);
      tv.setUint16(ti, packed.length); ti += 2;
      compParts.push(packed);
    }
  }
  push(u16(1)); // RLE
  push(rowTable);
  for (const part of compParts) push(part);

  return concat(chunks);
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function u16(x: number): Uint8Array { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, x); return b; }
function i16(x: number): Uint8Array { const b = new Uint8Array(2); new DataView(b.buffer).setInt16(0, x); return b; }
function u32(x: number): Uint8Array { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, x); return b; }

function concat(parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

/** Pascal name (ASCII fold), padded to a multiple of 4 including the length byte. */
function pascalName(name: string): Uint8Array {
  const ascii = [...name].map((ch) => {
    const code = ch.codePointAt(0)!;
    return code >= 0x20 && code < 0x7f ? code : 0x3f; // '?' for non-ASCII (luni carries the truth)
  }).slice(0, 255);
  const total = Math.ceil((ascii.length + 1) / 4) * 4;
  const out = new Uint8Array(total);
  out[0] = ascii.length;
  out.set(ascii, 1);
  return out;
}

/** `luni` tagged block: '8BIM' 'luni' len (u32 count + UTF-16BE), even-padded. */
function luniBlock(name: string): Uint8Array {
  const units: number[] = [];
  for (let i = 0; i < name.length; i++) units.push(name.charCodeAt(i));
  const dataLen = 4 + units.length * 2;
  const padded = dataLen + (dataLen % 2);
  const out = new Uint8Array(12 + padded);
  const v = new DataView(out.buffer);
  out.set([0x38, 0x42, 0x49, 0x4d]); // '8BIM'
  out.set([0x6c, 0x75, 0x6e, 0x69], 4); // 'luni'
  v.setUint32(8, dataLen);
  v.setUint32(12, units.length);
  for (let i = 0; i < units.length; i++) v.setUint16(16 + i * 2, units[i]!);
  return out;
}

/**
 * Encode one channel of a layer: u16 compression + payload. RLE (PackBits per
 * row + row table) unless RAW is smaller.
 */
function encodeChannel(l: PsdWriteLayer, id: number): Uint8Array {
  const { width: w, height: h, pixels } = l;
  if (w === 0 || h === 0) return u16(0); // empty channel: RAW with no data
  const offset = id === -1 ? 3 : id; // -1 alpha → byte 3; 0/1/2 → r/g/b
  const row = new Uint8Array(w);
  const packedRows: Uint8Array[] = new Array(h);
  const table = new Uint8Array(h * 2);
  const tv = new DataView(table.buffer);
  let rleTotal = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) row[x] = pixels[(y * w + x) * 4 + offset]!;
    const packed = packBitsEncode(row);
    packedRows[y] = packed;
    tv.setUint16(y * 2, packed.length);
    rleTotal += packed.length;
  }
  if (2 + table.length + rleTotal < 2 + w * h) {
    return concat([u16(1), table, ...packedRows]);
  }
  // RAW wins (noise-like data): plane copy.
  const plane = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) plane[y * w + x] = pixels[(y * w + x) * 4 + offset]!;
  }
  return concat([u16(0), plane]);
}

/** Plain src-over flatten (normal blend only) onto opaque white. */
function flatten(doc: PsdWriteDoc): Uint8Array {
  const { width, height } = doc;
  const out = new Uint8Array(width * height * 4);
  for (let i = 0; i < out.length; i += 4) { out[i] = out[i + 1] = out[i + 2] = 255; out[i + 3] = 255; }
  for (const l of doc.layers) {
    if (l.visible === false || l.width === 0 || l.height === 0) continue;
    const op = l.opacity ?? 1;
    for (let y = 0; y < l.height; y++) {
      const dy = l.y + y;
      if (dy < 0 || dy >= height) continue;
      for (let x = 0; x < l.width; x++) {
        const dx = l.x + x;
        if (dx < 0 || dx >= width) continue;
        const s = (y * l.width + x) * 4;
        const a = (l.pixels[s + 3]! / 255) * op;
        if (a <= 0) continue;
        const d = (dy * width + dx) * 4;
        out[d] = Math.round(l.pixels[s]! * a + out[d]! * (1 - a));
        out[d + 1] = Math.round(l.pixels[s + 1]! * a + out[d + 1]! * (1 - a));
        out[d + 2] = Math.round(l.pixels[s + 2]! * a + out[d + 2]! * (1 - a));
        out[d + 3] = 255;
      }
    }
  }
  return out;
}
