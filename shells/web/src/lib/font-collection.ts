// SPDX-License-Identifier: MPL-2.0
/**
 * TrueType and OpenType collections (TTC/OTC) keep several faces in one file,
 * usually sharing outline tables. A browser's FontFace loads only the first
 * face, so the viewer copies the chosen face out as a standalone sfnt.
 *
 * Faces can share one table directory or one name table, so any per-face cost
 * is multiplied by the face count. Every directory is checked before anything
 * reads it, and labels come from a bounded name-table read, not a full parse.
 */

export const COLLECTION_FACE_LIMIT = 256;
const TABLE_LIMIT = 128;
const NAME_RECORD_LIMIT = 512;
const LABEL_BYTES = 240;
const DAMAGED = 'This font collection is damaged.';
const FACE_DAMAGED = 'This face is damaged.';
const CFF = 0x4f54544f;

/** A face whose directory cannot be read has no extension: it is listed but cannot be chosen. */
export interface CollectionFace { index: number; label: string; extension: 'ttf' | 'otf' | null }

export function isFontCollection(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x74 && bytes[1] === 0x74 && bytes[2] === 0x63 && bytes[3] === 0x66;
}

function view(bytes: Uint8Array): DataView { return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); }
function tagAt(bytes: Uint8Array, at: number): string { return String.fromCharCode(bytes[at]!, bytes[at + 1]!, bytes[at + 2]!, bytes[at + 3]!); }

/** Where each face's table directory starts, read from a collection header checked against the file length. */
export function collectionFaceOffsets(bytes: Uint8Array): number[] {
  if (!isFontCollection(bytes) || bytes.length < 12) throw new Error(DAMAGED);
  const data = view(bytes), count = data.getUint32(8);
  if (!count) throw new Error('This font collection has no faces.');
  if (count > COLLECTION_FACE_LIMIT) throw new Error('This font collection has too many faces to preview.');
  if (12 + count * 4 > bytes.length) throw new Error(DAMAGED);
  return Array.from({ length: count }, (_, i) => data.getUint32(12 + i * 4));
}

interface FaceDirectory { start: number; version: number; count: number }

/** A face's table directory, or null unless it has a TrueType or CFF version and 1 to 128 table records inside the file. */
function faceDirectory(bytes: Uint8Array, start: number): FaceDirectory | null {
  if (start < 12 || start + 12 > bytes.length) return null;
  const data = view(bytes), version = data.getUint32(start), count = data.getUint16(start + 4);
  // 0x00010000 and 'true' are TrueType outlines, 'OTTO' is CFF.
  if (version !== 0x00010000 && version !== 0x74727565 && version !== CFF) return null;
  if (!count || count > TABLE_LIMIT || start + 12 + count * 16 > bytes.length) return null;
  return { start, version, count };
}

/**
 * A face's name: full name, then family and subfamily, then PostScript name.
 * At most 512 records are scanned and only the chosen strings are decoded,
 * each capped at 240 bytes. Windows Unicode records win over Mac Roman ones,
 * and US English wins within each.
 */
function faceLabel(bytes: Uint8Array, directory: FaceDirectory): string {
  const data = view(bytes);
  let table = -1, end = 0;
  for (let i = 0; i < directory.count && table < 0; i++) {
    const record = directory.start + 12 + i * 16;
    if (tagAt(bytes, record) === 'name') { table = data.getUint32(record + 8); end = table + data.getUint32(record + 12); }
  }
  if (table < 0 || table + 6 > end || end > bytes.length) return '';
  const storage = table + data.getUint16(table + 4);
  const records = Math.min(data.getUint16(table + 2), NAME_RECORD_LIMIT, Math.floor((end - table - 6) / 12));
  const best = new Map<number, { rank: number; at: number; length: number; unicode: boolean }>();
  for (let i = 0; i < records; i++) {
    const record = table + 6 + i * 12, platform = data.getUint16(record), encoding = data.getUint16(record + 2), id = data.getUint16(record + 6);
    if (id !== 1 && id !== 2 && id !== 4 && id !== 6) continue;
    const unicode = platform === 3 && (encoding === 1 || encoding === 10);
    if (!unicode && !(platform === 1 && encoding === 0)) continue;
    const rank = (unicode ? 0 : 2) + (data.getUint16(record + 4) === (unicode ? 0x409 : 0) ? 0 : 1);
    if ((best.get(id)?.rank ?? 4) > rank) best.set(id, { rank, at: storage + data.getUint16(record + 10), length: data.getUint16(record + 8), unicode });
  }
  const read = (id: number): string => {
    const record = best.get(id);
    if (!record || record.at >= end) return '';
    const length = Math.min(record.length, LABEL_BYTES, end - record.at), text = bytes.subarray(record.at, record.at + (record.unicode ? length & ~1 : length));
    return (record.unicode ? new TextDecoder('utf-16be').decode(text) : String.fromCharCode(...text)).replace(/\p{Cc}/gu, '').trim();
  };
  return read(4) || [read(1), read(2)].filter(Boolean).join(' ') || read(6);
}

/** One entry per face, labelled from its own name table where that can be read. A collection with no readable face is refused. */
export function collectionFaces(bytes: Uint8Array): CollectionFace[] {
  const faces = collectionFaceOffsets(bytes).map((start, index): CollectionFace => {
    const directory = faceDirectory(bytes, start);
    if (!directory) return { index, label: '', extension: null };
    return { index, label: faceLabel(bytes, directory).slice(0, 120).trim(), extension: directory.version === CFF ? 'otf' : 'ttf' };
  });
  if (!faces.some(face => face.extension)) throw new Error(DAMAGED);
  return faces;
}

/**
 * Copy one face into a standalone sfnt: its own table directory, its tables
 * 4-byte aligned, and head.checkSumAdjustment recomputed for the new file.
 * DSIG is left out because a signature covers the collection, not the copy.
 */
export function extractCollectionFace(bytes: Uint8Array, index: number, maxBytes = 32 * 1024 * 1024): Uint8Array {
  const start = collectionFaceOffsets(bytes)[index];
  if (start === undefined) throw new Error('This face is not in the collection.');
  const directory = faceDirectory(bytes, start);
  if (!directory) throw new Error(FACE_DAMAGED);
  const { version, count } = directory, data = view(bytes);
  const tables: Array<{ tag: string; checksum: number; offset: number; length: number }> = [], seen = new Set<string>();
  for (let i = 0; i < count; i++) {
    const record = start + 12 + i * 16;
    const tag = tagAt(bytes, record);
    const checksum = data.getUint32(record + 4), offset = data.getUint32(record + 8), length = data.getUint32(record + 12);
    if (seen.has(tag) || offset + length > bytes.length) throw new Error(FACE_DAMAGED);
    seen.add(tag);
    if (tag !== 'DSIG') tables.push({ tag, checksum, offset, length });
  }
  if (!tables.length) throw new Error(FACE_DAMAGED);
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
