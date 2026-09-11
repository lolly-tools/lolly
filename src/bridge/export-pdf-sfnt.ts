// SPDX-License-Identifier: MPL-2.0
/**
 * DOM-free TrueType (sfnt) reading and glyph subsetting for the PDF writer in
 * export-pdf-doc.ts.
 *
 * The PDF path embeds two kinds of face: the brand's per-weight SUSE statics and
 * a user font the font registry has already decompressed to sfnt bytes. Both are
 * glyf-flavoured TrueType, which is the only flavour this reader accepts - a
 * CFF/OTF file returns null and the caller falls back to a base-14 font, matching
 * what the previous library did with the same input.
 *
 * Everything here is plain byte work on a Uint8Array: no DOM, no font library.
 * What the writer needs from a face is small - unit scale, per-glyph advances, a
 * unicode-to-glyph lookup for encoding, descriptor metrics, and a pruned copy of
 * the file carrying only the glyphs a document actually drew.
 */

/** One table's position in the file. */
interface TableRec { off: number; len: number }

export interface SfntFont {
  bytes: Uint8Array;
  tables: Map<string, TableRec>;
  unitsPerEm: number;
  numGlyphs: number;
  postScriptName: string;
  /** [xMin, yMin, xMax, yMax] in font units. */
  bbox: [number, number, number, number];
  ascent: number;
  descent: number;
  capHeight: number;
  italicAngle: number;
  /** True when the OS/2 or head bits report an italic/oblique design. */
  italic: boolean;
  /** Advance width in font units. */
  advance(gid: number): number;
  /** Glyph id for a unicode code point, 0 when the face has no glyph for it. */
  gidFor(cp: number): number;
}

const tag = (b: Uint8Array, off: number): string =>
  String.fromCharCode(b[off]!, b[off + 1]!, b[off + 2]!, b[off + 3]!);

/**
 * Read an sfnt table directory and the metrics the writer needs. Returns null for
 * anything that is not a glyf-flavoured TrueType file (CFF/OTF, a collection, a
 * truncated buffer), so a caller can fall back rather than embed something a
 * reader cannot use.
 */
export function parseSfnt(bytes: Uint8Array): SfntFont | null {
  if (bytes.length < 12) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = dv.getUint32(0);
  // 0x00010000 and 'true' are TrueType; 'OTTO' is CFF and 'ttcf' a collection.
  if (version !== 0x00010000 && tag(bytes, 0) !== 'true') return null;
  const numTables = dv.getUint16(4);
  if (12 + numTables * 16 > bytes.length) return null;
  const tables = new Map<string, TableRec>();
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    const off = dv.getUint32(rec + 8);
    const len = dv.getUint32(rec + 12);
    if (off + len > bytes.length) continue;
    tables.set(tag(bytes, rec), { off, len });
  }
  const head = tables.get('head');
  const hhea = tables.get('hhea');
  const maxp = tables.get('maxp');
  const hmtx = tables.get('hmtx');
  if (!head || !hhea || !maxp || !hmtx || !tables.has('glyf') || !tables.has('loca')) return null;

  const unitsPerEm = dv.getUint16(head.off + 18) || 1000;
  const bbox: [number, number, number, number] = [
    dv.getInt16(head.off + 36), dv.getInt16(head.off + 38),
    dv.getInt16(head.off + 40), dv.getInt16(head.off + 42),
  ];
  const macStyle = dv.getUint16(head.off + 44);
  const numGlyphs = dv.getUint16(maxp.off + 4);
  const numHMetrics = dv.getUint16(hhea.off + 34);
  let ascent = dv.getInt16(hhea.off + 4);
  let descent = dv.getInt16(hhea.off + 6);

  const os2 = tables.get('OS/2');
  let capHeight = 0;
  let italic = (macStyle & 2) !== 0;
  if (os2 && os2.len >= 78) {
    const v = dv.getUint16(os2.off);
    if ((dv.getUint16(os2.off + 62) & 1) !== 0) italic = true;
    // sTypoAscender/Descender are the portable pair; hhea values can be zero on
    // faces that put their metrics only in OS/2.
    const typoAsc = dv.getInt16(os2.off + 68);
    const typoDesc = dv.getInt16(os2.off + 70);
    if (!ascent && typoAsc) ascent = typoAsc;
    if (!descent && typoDesc) descent = typoDesc;
    if (v >= 2 && os2.len >= 90) capHeight = dv.getInt16(os2.off + 88);
  }
  if (!capHeight) capHeight = Math.round(unitsPerEm * 0.7);

  const post = tables.get('post');
  const italicAngle = post && post.len >= 12 ? dv.getInt32(post.off + 4) / 65536 : 0;

  const advance = (gid: number): number => {
    if (numHMetrics === 0) return 0;
    const i = Math.min(Math.max(gid, 0), numHMetrics - 1);
    const at = hmtx.off + i * 4;
    return at + 2 <= bytes.length ? dv.getUint16(at) : 0;
  };

  const lookup = cmapLookup(dv, tables.get('cmap'));
  const cache = new Map<number, number>();
  const gidFor = (cp: number): number => {
    const hit = cache.get(cp);
    if (hit !== undefined) return hit;
    const gid = lookup(cp);
    cache.set(cp, gid);
    return gid;
  };

  return {
    bytes, tables, unitsPerEm, numGlyphs, bbox, ascent, descent, capHeight, italicAngle, italic,
    postScriptName: readPostScriptName(dv, bytes, tables.get('name')) || 'LollyEmbedded',
    advance, gidFor,
  };
}

/** Pick a unicode cmap subtable and return a code-point lookup for it. */
function cmapLookup(dv: DataView, cmap: TableRec | undefined): (cp: number) => number {
  if (!cmap) return () => 0;
  const n = dv.getUint16(cmap.off + 2);
  let best = -1;
  let bestScore = -1;
  for (let i = 0; i < n; i++) {
    const rec = cmap.off + 4 + i * 8;
    const plat = dv.getUint16(rec);
    const enc = dv.getUint16(rec + 2);
    const sub = cmap.off + dv.getUint32(rec + 4);
    // Windows full-repertoire first, then Windows BMP, then a unicode table.
    const score = plat === 3 && enc === 10 ? 4 : plat === 3 && enc === 1 ? 3 : plat === 0 ? 2 : plat === 3 && enc === 0 ? 1 : 0;
    if (score > bestScore) { bestScore = score; best = sub; }
  }
  if (best < 0) return () => 0;
  const sub = best;
  const format = dv.getUint16(sub);

  if (format === 4) {
    const segX2 = dv.getUint16(sub + 6);
    const ends = sub + 14;
    const starts = ends + segX2 + 2;
    const deltas = starts + segX2;
    const ranges = deltas + segX2;
    return (cp: number): number => {
      if (cp > 0xffff) return 0;
      for (let s = 0; s < segX2; s += 2) {
        if (cp > dv.getUint16(ends + s)) continue;
        const start = dv.getUint16(starts + s);
        if (cp < start) return 0;
        const ro = dv.getUint16(ranges + s);
        if (ro === 0) return (cp + dv.getInt16(deltas + s)) & 0xffff;
        const at = ranges + s + ro + (cp - start) * 2;
        if (at + 2 > dv.byteLength) return 0;
        const g = dv.getUint16(at);
        return g === 0 ? 0 : (g + dv.getInt16(deltas + s)) & 0xffff;
      }
      return 0;
    };
  }
  if (format === 12) {
    const groups = dv.getUint32(sub + 12);
    return (cp: number): number => {
      let lo = 0;
      let hi = groups - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const at = sub + 16 + mid * 12;
        const s = dv.getUint32(at);
        const e = dv.getUint32(at + 4);
        if (cp < s) hi = mid - 1;
        else if (cp > e) lo = mid + 1;
        else return dv.getUint32(at + 8) + (cp - s);
      }
      return 0;
    };
  }
  if (format === 6) {
    const first = dv.getUint16(sub + 6);
    const count = dv.getUint16(sub + 8);
    return (cp: number): number => (cp >= first && cp < first + count ? dv.getUint16(sub + 10 + (cp - first) * 2) : 0);
  }
  if (format === 0) {
    return (cp: number): number => (cp < 256 ? dv.getUint8(sub + 6 + cp) : 0);
  }
  return () => 0;
}

/** nameID 6 (PostScript name) from the name table, ASCII only. */
function readPostScriptName(dv: DataView, bytes: Uint8Array, name: TableRec | undefined): string {
  if (!name || name.len < 6) return '';
  const count = dv.getUint16(name.off + 2);
  const storage = name.off + dv.getUint16(name.off + 4);
  for (let i = 0; i < count; i++) {
    const rec = name.off + 6 + i * 12;
    if (dv.getUint16(rec + 6) !== 6) continue;
    const len = dv.getUint16(rec + 8);
    const off = storage + dv.getUint16(rec + 10);
    if (off + len > bytes.length) continue;
    const plat = dv.getUint16(rec);
    let s = '';
    // Platform 3 stores UTF-16BE; platform 1 is single-byte Mac Roman.
    if (plat === 3) for (let j = 0; j + 1 < len; j += 2) s += String.fromCharCode(dv.getUint16(off + j));
    else for (let j = 0; j < len; j++) s += String.fromCharCode(bytes[off + j]!);
    const clean = s.replace(/[^\x21-\x7e]|[()<>[\]{}/%#]/g, '');
    if (clean) return clean;
  }
  return '';
}

/** Glyph data offsets from loca, as [start, end] into the glyf table. */
function locaRange(font: SfntFont, gid: number): [number, number] | null {
  const loca = font.tables.get('loca');
  const head = font.tables.get('head');
  if (!loca || !head) return null;
  const dv = new DataView(font.bytes.buffer, font.bytes.byteOffset, font.bytes.byteLength);
  const long = dv.getInt16(head.off + 50) === 1;
  const at = loca.off + (long ? gid * 4 : gid * 2);
  const next = at + (long ? 4 : 2);
  if (next + (long ? 4 : 2) > font.bytes.length) return null;
  const s = long ? dv.getUint32(at) : dv.getUint16(at) * 2;
  const e = long ? dv.getUint32(next) : dv.getUint16(next) * 2;
  return e > s ? [s, e] : [s, s];
}

/** Component glyph ids referenced by a composite glyph. */
function componentsOf(font: SfntFont, gid: number): number[] {
  const glyf = font.tables.get('glyf');
  const range = locaRange(font, gid);
  if (!glyf || !range || range[1] <= range[0]) return [];
  const dv = new DataView(font.bytes.buffer, font.bytes.byteOffset, font.bytes.byteLength);
  const base = glyf.off + range[0];
  if (dv.getInt16(base) >= 0) return [];       // a simple glyph has no components
  const out: number[] = [];
  let p = base + 10;
  for (;;) {
    if (p + 4 > glyf.off + range[1]) break;
    const flags = dv.getUint16(p);
    out.push(dv.getUint16(p + 2));
    p += 4;
    p += (flags & 0x0001) ? 4 : 2;             // ARG_1_AND_2_ARE_WORDS
    if (flags & 0x0008) p += 2;                // WE_HAVE_A_SCALE
    else if (flags & 0x0040) p += 4;           // X_AND_Y_SCALE
    else if (flags & 0x0080) p += 8;           // TWO_BY_TWO
    if (!(flags & 0x0020)) break;              // MORE_COMPONENTS
  }
  return out;
}

const KEEP_TABLES = ['cvt ', 'fpgm', 'glyf', 'head', 'hhea', 'hmtx', 'loca', 'maxp', 'prep'];

/**
 * A copy of the face carrying only the glyphs in `gids` (plus glyph 0 and every
 * component a composite glyph pulls in). Glyph ids are NOT renumbered - unused
 * entries become zero-length - so the writer keeps addressing glyphs by their
 * original id and no CID remapping is needed. Layout, variation and name tables
 * are dropped: a PDF reader draws from glyf/loca/hmtx alone.
 */
export function subsetSfnt(font: SfntFont, gids: Set<number>): Uint8Array {
  const glyf = font.tables.get('glyf');
  if (!glyf) return font.bytes;
  const keep = new Set<number>([0]);
  const queue = [...gids];
  while (queue.length) {
    const g = queue.pop()!;
    if (g < 0 || g >= font.numGlyphs || keep.has(g)) continue;
    keep.add(g);
    for (const c of componentsOf(font, g)) queue.push(c);
  }

  // New glyf + long-format loca, in glyph order.
  const parts: Uint8Array[] = [];
  const offsets = new Uint32Array(font.numGlyphs + 1);
  let total = 0;
  for (let g = 0; g < font.numGlyphs; g++) {
    offsets[g] = total;
    if (!keep.has(g)) continue;
    const range = locaRange(font, g);
    if (!range || range[1] <= range[0]) continue;
    const data = font.bytes.subarray(glyf.off + range[0], glyf.off + range[1]);
    const pad = (4 - (data.length & 3)) & 3;
    parts.push(data);
    if (pad) parts.push(new Uint8Array(pad));
    total += data.length + pad;
  }
  offsets[font.numGlyphs] = total;
  const newGlyf = new Uint8Array(total);
  let at = 0;
  for (const p of parts) { newGlyf.set(p, at); at += p.length; }
  const newLoca = new Uint8Array((font.numGlyphs + 1) * 4);
  const locaDv = new DataView(newLoca.buffer);
  for (let i = 0; i <= font.numGlyphs; i++) locaDv.setUint32(i * 4, offsets[i]!);

  const out = new Map<string, Uint8Array>();
  for (const name of KEEP_TABLES) {
    const rec = font.tables.get(name);
    if (!rec) continue;
    out.set(name, font.bytes.slice(rec.off, rec.off + rec.len));
  }
  out.set('glyf', newGlyf);
  out.set('loca', newLoca);
  const head = out.get('head');
  if (head && head.length >= 54) {
    const dv = new DataView(head.buffer, head.byteOffset, head.byteLength);
    dv.setUint32(8, 0);        // checkSumAdjustment, recomputed below
    dv.setInt16(50, 1);        // indexToLocFormat: long offsets
  }
  return buildSfnt(out);
}

/** Assemble a table map into a well-formed sfnt, checksums included. */
function buildSfnt(tables: Map<string, Uint8Array>): Uint8Array {
  const names = [...tables.keys()].sort();
  const n = names.length;
  const entrySelector = Math.floor(Math.log2(n));
  const searchRange = 2 ** entrySelector * 16;
  const headerLen = 12 + n * 16;
  let total = headerLen;
  const padded = new Map<string, Uint8Array>();
  for (const name of names) {
    const data = tables.get(name)!;
    const pad = (4 - (data.length & 3)) & 3;
    const buf = pad ? new Uint8Array(data.length + pad) : data;
    if (pad) buf.set(data, 0);
    padded.set(name, buf);
    total += buf.length;
  }
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x00010000);
  dv.setUint16(4, n);
  dv.setUint16(6, searchRange);
  dv.setUint16(8, entrySelector);
  dv.setUint16(10, n * 16 - searchRange);
  let off = headerLen;
  let i = 0;
  for (const name of names) {
    const buf = padded.get(name)!;
    const rec = 12 + i * 16;
    for (let c = 0; c < 4; c++) out[rec + c] = name.charCodeAt(c);
    dv.setUint32(rec + 4, sum32(buf));
    dv.setUint32(rec + 8, off);
    dv.setUint32(rec + 12, tables.get(name)!.length);
    out.set(buf, off);
    off += buf.length;
    i++;
  }
  // head.checkSumAdjustment, from the whole assembled file.
  const headIndex = names.indexOf('head');
  if (headIndex >= 0) {
    const headOff = dv.getUint32(12 + headIndex * 16 + 8);
    dv.setUint32(headOff + 8, (0xb1b0afba - sum32(out)) >>> 0);
  }
  return out;
}

/** The sfnt checksum: unsigned 32-bit sum of the data read as big-endian words. */
function sum32(data: Uint8Array): number {
  let s = 0;
  const whole = data.length & ~3;
  for (let i = 0; i < whole; i += 4) {
    s = (s + ((data[i]! << 24) | (data[i + 1]! << 16) | (data[i + 2]! << 8) | data[i + 3]!)) >>> 0;
  }
  if (whole < data.length) {
    let tail = 0;
    for (let i = 0; i < 4; i++) tail = (tail << 8) | (data[whole + i] ?? 0);
    s = (s + tail) >>> 0;
  }
  return s;
}
