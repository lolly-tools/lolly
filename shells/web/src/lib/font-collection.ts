// SPDX-License-Identifier: MPL-2.0
/**
 * TrueType and OpenType collections (TTC/OTC) keep several faces in one file,
 * usually sharing outline tables. A browser's FontFace loads only the first
 * face, so the viewer copies the chosen face out as a standalone sfnt.
 */
import fontkit from '@pdf-lib/fontkit';

export const COLLECTION_FACE_LIMIT = 256;
const TABLE_LIMIT = 128;
const DAMAGED = 'This font collection is damaged.';

export interface CollectionFace { index: number; label: string; extension: 'ttf' | 'otf' }

export function isFontCollection(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x74 && bytes[1] === 0x74 && bytes[2] === 0x63 && bytes[3] === 0x66;
}

function view(bytes: Uint8Array): DataView { return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); }

/** Where each face's table directory starts, checked against the file length. */
export function collectionFaceOffsets(bytes: Uint8Array): number[] {
  if (!isFontCollection(bytes) || bytes.length < 12) throw new Error(DAMAGED);
  const data = view(bytes), count = data.getUint32(8);
  if (!count) throw new Error('This font collection has no faces.');
  if (count > COLLECTION_FACE_LIMIT) throw new Error('This font collection has too many faces to preview.');
  if (12 + count * 4 > bytes.length) throw new Error(DAMAGED);
  const offsets: number[] = [];
  for (let i = 0; i < count; i++) {
    const offset = data.getUint32(12 + i * 4);
    if (offset < 12 || offset + 12 > bytes.length) throw new Error(DAMAGED);
    offsets.push(offset);
  }
  return offsets;
}

function faceVersion(bytes: Uint8Array, offset: number): number {
  const version = view(bytes).getUint32(offset);
  // 0x00010000 and 'true' are TrueType outlines, 'OTTO' is CFF.
  if (version !== 0x00010000 && version !== 0x74727565 && version !== 0x4f54544f) throw new Error(DAMAGED);
  return version;
}

interface NamedFace { fullName?: string; familyName?: string; subfamilyName?: string; postscriptName?: string }

/** One entry per face, labelled from its own name table where that can be read. */
export function collectionFaces(bytes: Uint8Array): CollectionFace[] {
  const offsets = collectionFaceOffsets(bytes);
  let fonts: NamedFace[] = [];
  try { const list: unknown = Reflect.get(fontkit.create(bytes), 'fonts'); if (Array.isArray(list)) fonts = list; } catch { /* labels fall back to numbers */ }
  return offsets.map((offset, index) => {
    let label = '';
    try {
      const font = fonts[index];
      label = font?.fullName || [font?.familyName, font?.subfamilyName].filter(Boolean).join(' ') || font?.postscriptName || '';
    } catch { /* an unreadable name table leaves the number */ }
    return { index, label: label.trim().slice(0, 120), extension: faceVersion(bytes, offset) === 0x4f54544f ? 'otf' : 'ttf' };
  });
}

/**
 * Copy one face into a standalone sfnt: its own table directory, its tables
 * 4-byte aligned, and head.checkSumAdjustment recomputed for the new file.
 * DSIG is left out because a signature covers the collection, not the copy.
 */
export function extractCollectionFace(bytes: Uint8Array, index: number, maxBytes = 32 * 1024 * 1024): Uint8Array {
  const start = collectionFaceOffsets(bytes)[index];
  if (start === undefined) throw new Error('This face is not in the collection.');
  const version = faceVersion(bytes, start), data = view(bytes), count = data.getUint16(start + 4);
  if (!count || count > TABLE_LIMIT || start + 12 + count * 16 > bytes.length) throw new Error(DAMAGED);
  const tables: Array<{ tag: string; checksum: number; offset: number; length: number }> = [], seen = new Set<string>();
  for (let i = 0; i < count; i++) {
    const record = start + 12 + i * 16;
    const tag = String.fromCharCode(...bytes.subarray(record, record + 4));
    const checksum = data.getUint32(record + 4), offset = data.getUint32(record + 8), length = data.getUint32(record + 12);
    if (seen.has(tag) || offset + length > bytes.length) throw new Error(DAMAGED);
    seen.add(tag);
    if (tag !== 'DSIG') tables.push({ tag, checksum, offset, length });
  }
  if (!tables.length) throw new Error(DAMAGED);
  // Directory records are sorted by tag; for these 4-byte Latin-1 tags string order is that order.
  tables.sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0));
  const aligned = (n: number) => (n + 3) & ~3;
  const header = 12 + tables.length * 16;
  const size = tables.reduce((total, table) => total + aligned(table.length), header);
  if (size > maxBytes) throw new Error('The expanded font is too large for an inline preview.');
  const out = new Uint8Array(size), target = view(out);
  const selector = Math.floor(Math.log2(tables.length)), range = 16 * 2 ** selector;
  target.setUint32(0, version); target.setUint16(4, tables.length); target.setUint16(6, range); target.setUint16(8, selector); target.setUint16(10, tables.length * 16 - range);
  let cursor = header, head = -1;
  tables.forEach((table, i) => {
    const record = 12 + i * 16;
    for (let c = 0; c < 4; c++) out[record + c] = table.tag.charCodeAt(c);
    target.setUint32(record + 4, table.checksum); target.setUint32(record + 8, cursor); target.setUint32(record + 12, table.length);
    out.set(bytes.subarray(table.offset, table.offset + table.length), cursor);
    if (table.tag === 'head' && table.length >= 12) head = cursor;
    cursor += aligned(table.length);
  });
  if (head >= 0) {
    target.setUint32(head + 8, 0);
    let sum = 0;
    for (let i = 0; i < size; i += 4) sum = (sum + target.getUint32(i)) >>> 0;
    target.setUint32(head + 8, (0xb1b0afba - sum) >>> 0);
  }
  return out;
}
