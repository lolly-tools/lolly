// SPDX-License-Identifier: MPL-2.0
/**
 * Font file inspection and verified subsetting to chosen text, DOM-free.
 *
 * `inspectFont` reads what a TTF, OTF or WOFF file's own tables say: the names,
 * where the outlines live, the weight class and any `wght` axis range, every
 * variation axis and named instance, the characters the cmap maps (as ranges
 * and per Unicode block) and the embedding flags. It shapes nothing and draws
 * nothing, so web, CLI and MCP report the same facts for the same bytes.
 *
 * `subsetFontForText` plans a subset (characters to glyph ids through the cmap),
 * enforces the refusals in font-subset-policy.ts before any work, hands the glyph
 * ids to the shell's subsetter (Skera in a worker on the web, the same WASM in
 * Node) and then checks the OUTPUT bytes: TrueType outlines, every kept character
 * still mapped to its original glyph, each kept glyph's outline present exactly
 * when the source had one, and an unchanged fsType. A result that fails any of
 * those is refused rather than returned.
 *
 * Hostile-input posture follows font-convert.ts: every read is bounds-checked,
 * counts are validated against the table length before a loop, and allocation is
 * capped. The cmap readers visit each code point or group once, however the
 * table's segments overlap. WOFF input is unwrapped by font-convert.ts's bounded
 * `woffToSfnt`.
 */

import type { FontInspectionV1, FontSubsetRequestV1, FontSubsetResultV1, FontsAPI, FontBlockCoverageV1 } from './bridge/host-v1.ts';
import { sfntKind, woffToSfnt } from './font-convert.ts';
import { FONT_SUBSET_REFUSALS, readEmbeddingFlags, readSfntDirectory, sfntOutlines, subsetRefusalFor, type SfntDirectory, type SfntTable } from './font-subset-policy.ts';

const MAX_INSPECT_BYTES = 64 * 1024 * 1024;
const MAX_TEXT_UNITS = 100_000;
const MAX_MISSING_LISTED = 64;
const MAX_NAME_CHARS = 256;

/** A subset the shell runs: glyph ids in, sfnt bytes out. `policy` identifies the subsetter in reports. */
export interface FontSubsetRunner {
  policy: string;
  run(sfnt: Uint8Array, glyphs: number[]): Promise<Uint8Array>;
}

type FontErrorCode = 'outlines' | 'restricted' | 'no-subsetting' | 'bitmap-only' | 'unstated' | 'unreadable' | 'no-characters' | 'too-large' | 'verification';

function fontError(code: FontErrorCode, message: string): Error {
  return Object.assign(new Error(message), { code });
}

// ── table readers ───────────────────────────────────────────────────────────

const u16 = (b: Uint8Array, at: number): number => (b[at]! << 8) | b[at + 1]!;
const i16 = (b: Uint8Array, at: number): number => { const v = u16(b, at); return v & 0x8000 ? v - 0x10000 : v; };
const u32 = (b: Uint8Array, at: number): number => ((b[at]! << 24) | (b[at + 1]! << 16) | (b[at + 2]! << 8) | b[at + 3]!) >>> 0;
const fixed = (b: Uint8Array, at: number): number => (u32(b, at) | 0) / 65536;
const inTable = (t: SfntTable, rel: number, size: number): boolean => rel >= 0 && rel + size <= t.len;

/** Unwrap WOFF and check the container. Throws a coded Error for anything unreadable. */
function sfntOf(bytes: Uint8Array): { sfnt: Uint8Array; container: FontInspectionV1['container']; directory: SfntDirectory } {
  if (bytes.length > MAX_INSPECT_BYTES) throw fontError('too-large', 'This font is larger than 64 MB.');
  const kind = sfntKind(bytes);
  if (kind === 'woff2') throw fontError('unreadable', 'WOFF2 fonts cannot be read yet. Use a TTF, OTF or WOFF file.');
  if (!kind) {
    const collection = bytes.length >= 4 && u32(bytes, 0) === 0x74746366;
    throw fontError('unreadable', collection ? 'Font collections (.ttc) cannot be read here yet. Choose one face as a TTF or OTF file.' : 'This does not look like a font file.');
  }
  const sfnt = kind === 'woff' ? woffToSfnt(bytes) : bytes;
  const directory = readSfntDirectory(sfnt);
  if (!directory) throw fontError('unreadable', 'The font table directory could not be read.');
  return { sfnt, container: kind, directory };
}

/** Best record per name id: Windows English, then any Windows, then Unicode, then Mac Roman. */
function readNames(b: Uint8Array, t: SfntTable | undefined): (id: number) => string {
  const best = new Map<number, { score: number; text: string }>();
  if (t && inTable(t, 0, 6)) {
    const count = u16(b, t.off + 2);
    const strings = t.off + u16(b, t.off + 4);
    if (inTable(t, 6, count * 12)) {
      for (let i = 0; i < count; i++) {
        const at = t.off + 6 + i * 12;
        const platform = u16(b, at), encoding = u16(b, at + 2), language = u16(b, at + 4), id = u16(b, at + 6);
        const length = u16(b, at + 8), start = strings + u16(b, at + 10);
        if (start + length > t.off + t.len) continue;
        const score = platform === 3 && language === 0x409 ? 4 : platform === 3 ? 3 : platform === 0 ? 2 : platform === 1 && encoding === 0 && language === 0 ? 1 : 0;
        if (!score || (best.get(id)?.score ?? 0) >= score) continue;
        const raw = b.subarray(start, start + length);
        let text = '';
        if (platform === 1) for (const byte of raw) text += byte < 0x80 ? String.fromCharCode(byte) : '�';
        else for (let k = 0; k + 1 < raw.length; k += 2) text += String.fromCharCode((raw[k]! << 8) | raw[k + 1]!);
        // Control characters never reach a report or a template.
        text = [...text].filter((char) => char >= ' ' && char !== '\u007f').join('').trim().slice(0, MAX_NAME_CHARS);
        if (text) best.set(id, { score, text });
      }
    }
  }
  return (id) => best.get(id)?.text ?? '';
}

function readAxes(b: Uint8Array, t: SfntTable | undefined, name: (id: number) => string): Pick<FontInspectionV1, 'axes' | 'instances'> {
  if (!t || !inTable(t, 0, 16) || u16(b, t.off) !== 1) return { axes: [], instances: [] };
  const offset = u16(b, t.off + 4), axisCount = u16(b, t.off + 8), axisSize = u16(b, t.off + 10);
  const instanceCount = u16(b, t.off + 12), instanceSize = u16(b, t.off + 14);
  if (axisCount > 64 || axisSize < 20 || instanceCount > 1024 || instanceSize < 4 + axisCount * 4) return { axes: [], instances: [] };
  if (!inTable(t, offset, axisCount * axisSize + instanceCount * instanceSize)) return { axes: [], instances: [] };
  const axes: FontInspectionV1['axes'] = [];
  for (let i = 0; i < axisCount; i++) {
    const at = t.off + offset + i * axisSize;
    const tag = String.fromCharCode(b[at]!, b[at + 1]!, b[at + 2]!, b[at + 3]!);
    axes.push({ tag, name: name(u16(b, at + 18)) || tag, min: fixed(b, at + 4), default: fixed(b, at + 8), max: fixed(b, at + 12), hidden: (u16(b, at + 16) & 1) === 1 });
  }
  const instances: FontInspectionV1['instances'] = [];
  for (let i = 0; i < instanceCount; i++) {
    const at = t.off + offset + axisCount * axisSize + i * instanceSize;
    const label = name(u16(b, at));
    if (!label) continue;
    const coordinates: Record<string, number> = {};
    axes.forEach((axis, k) => { coordinates[axis.tag] = fixed(b, at + 4 + k * 4); });
    instances.push({ name: label, axes: coordinates });
  }
  return { axes, instances };
}

/** A cmap reading: mapped code point ranges and a lookup. Glyph 0 and ids past numGlyphs count as unmapped. */
interface Cmap { ranges: Array<[number, number]>; gid(cp: number): number }

const EMPTY_CMAP: Cmap = { ranges: [], gid: () => 0 };

function readCmap(b: Uint8Array, t: SfntTable | undefined, numGlyphs: number): Cmap {
  if (!t || !inTable(t, 0, 4)) return EMPTY_CMAP;
  const count = u16(b, t.off + 2);
  if (!inTable(t, 4, count * 8)) return EMPTY_CMAP;
  let best = -1, bestScore = 0;
  for (let i = 0; i < count; i++) {
    const at = t.off + 4 + i * 8;
    const platform = u16(b, at), encoding = u16(b, at + 2), rel = u32(b, at + 4);
    if (!inTable(t, rel, 4)) continue;
    const format = u16(b, t.off + rel);
    const unicode = platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10));
    const score = format === 12 && unicode ? 4 : format === 4 && unicode ? 3 : format === 4 && platform === 3 && encoding === 0 ? 1 : 0;
    if (score > bestScore) { bestScore = score; best = rel; }
  }
  if (best < 0) return EMPTY_CMAP;
  return u16(b, t.off + best) === 12 ? readCmap12(b, t, best, numGlyphs) : readCmap4(b, t, best, numGlyphs);
}

function mergeRanges(ranges: Array<[number, number]>): Array<[number, number]> {
  ranges.sort((x, y) => x[0] - y[0]);
  const out: Array<[number, number]> = [];
  for (const [first, last] of ranges) {
    const tail = out[out.length - 1];
    if (tail && first <= tail[1] + 1) tail[1] = Math.max(tail[1], last);
    else out.push([first, last]);
  }
  return out;
}

function readCmap4(b: Uint8Array, t: SfntTable, rel: number, numGlyphs: number): Cmap {
  if (!inTable(t, rel, 14)) return EMPTY_CMAP;
  const declared = u16(b, t.off + rel + 6) >> 1;
  const ends = t.off + rel + 14, starts = ends + declared * 2 + 2, deltas = starts + declared * 2, offsets = deltas + declared * 2;
  if (!declared || offsets + declared * 2 > t.off + t.len) return EMPTY_CMAP;
  const tableEnd = t.off + t.len;
  // The spec requires strictly ascending end codes, and the binary search in gid()
  // depends on that, so reading stops at the first segment that breaks the order.
  let segCount = 1;
  while (segCount < declared && u16(b, ends + segCount * 2) > u16(b, ends + (segCount - 1) * 2)) segCount++;
  const lookupIn = (seg: number, cp: number): number => {
    const start = u16(b, starts + seg * 2), delta = u16(b, deltas + seg * 2), rangeOffset = u16(b, offsets + seg * 2);
    let gid: number;
    if (!rangeOffset) gid = (cp + delta) & 0xffff;
    else {
      const at = offsets + seg * 2 + rangeOffset + (cp - start) * 2;
      if (at + 2 > tableEnd) return 0;
      const raw = u16(b, at);
      gid = raw ? (raw + delta) & 0xffff : 0;
    }
    return gid < numGlyphs ? gid : 0;
  };
  // A segment owns only the code points above the previous end code, the same
  // rule gid() applies, so overlapping segments cannot repeat work: the scan
  // visits each code point at most once (65,535 lookups and 32,768 ranges).
  const ranges: Array<[number, number]> = [];
  let floor = 0;
  for (let seg = 0; seg < segCount; seg++) {
    const start = Math.max(u16(b, starts + seg * 2), floor), end = u16(b, ends + seg * 2);
    floor = end + 1;
    if (start > end) continue;
    let open = -1;
    for (let cp = start; cp <= end; cp++) {
      if (cp === 0xffff) break;
      if (lookupIn(seg, cp)) { if (open < 0) open = cp; }
      else if (open >= 0) { ranges.push([open, cp - 1]); open = -1; }
    }
    if (open >= 0) ranges.push([open, Math.min(end, 0xfffe)]);
  }
  return {
    ranges: mergeRanges(ranges),
    gid(cp) {
      if (cp > 0xfffe) return 0;
      let lo = 0, hi = segCount - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (u16(b, ends + mid * 2) < cp) lo = mid + 1; else hi = mid - 1;
      }
      if (lo >= segCount || u16(b, starts + lo * 2) > cp) return 0;
      return lookupIn(lo, cp);
    },
  };
}

function readCmap12(b: Uint8Array, t: SfntTable, rel: number, numGlyphs: number): Cmap {
  if (!inTable(t, rel, 16)) return EMPTY_CMAP;
  const count = u32(b, t.off + rel + 12);
  if (!inTable(t, rel + 16, count * 12)) return EMPTY_CMAP;
  // Groups must ascend without overlapping (the spec's rule, and gid()'s binary
  // search), so reading stops at the first group that does not. Each kept group
  // then covers code points no other group does: at most 1,114,112 groups, held
  // as plain numbers, however many the table declares.
  const firsts: number[] = [], lasts: number[] = [], glyphs: number[] = [];
  let floor = 0;
  for (let i = 0; i < count; i++) {
    const at = t.off + rel + 16 + i * 12;
    let first = u32(b, at), last = Math.min(u32(b, at + 4), 0x10ffff);
    let glyph = u32(b, at + 8);
    if (first < floor) break;
    if (first > last) continue;
    floor = last + 1;
    if (glyph >= numGlyphs) continue;
    // Keep only the part of the group whose glyph ids exist; glyph 0 is .notdef.
    last = Math.min(last, first + (numGlyphs - 1 - glyph));
    if (glyph === 0) { first++; glyph = 1; }
    if (first <= last) { firsts.push(first); lasts.push(last); glyphs.push(glyph); }
  }
  const ranges: Array<[number, number]> = [];
  firsts.forEach((first, k) => {
    const tail = ranges[ranges.length - 1];
    if (tail && first === tail[1] + 1) tail[1] = lasts[k]!;
    else ranges.push([first, lasts[k]!]);
  });
  return {
    ranges,
    gid(cp) {
      let lo = 0, hi = firsts.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (cp < firsts[mid]!) hi = mid - 1;
        else if (cp > lasts[mid]!) lo = mid + 1;
        else return glyphs[mid]! + (cp - firsts[mid]!);
      }
      return 0;
    },
  };
}

/** Byte length of each glyph's outline from `loca`, or null when it cannot be read. */
function glyphLengths(b: Uint8Array, directory: SfntDirectory, numGlyphs: number): ((gid: number) => number) | null {
  const head = directory.tables.get('head'), loca = directory.tables.get('loca');
  if (!head || !loca || !inTable(head, 50, 2)) return null;
  const long = i16(b, head.off + 50) === 1;
  const size = long ? 4 : 2;
  if (!inTable(loca, 0, (numGlyphs + 1) * size)) return null;
  const at = (gid: number) => long ? u32(b, loca.off + gid * 4) : u16(b, loca.off + gid * 2) * 2;
  return (gid) => gid + 1 <= numGlyphs ? Math.max(0, at(gid + 1) - at(gid)) : 0;
}

// ── Unicode blocks ──────────────────────────────────────────────────────────

/** Common Unicode blocks (Blocks.txt names). Characters outside them count under "Other". */
const BLOCKS: ReadonlyArray<readonly [number, number, string]> = `
0000 007F Basic Latin|0080 00FF Latin-1 Supplement|0100 017F Latin Extended-A|0180 024F Latin Extended-B|0250 02AF IPA Extensions
02B0 02FF Spacing Modifier Letters|0300 036F Combining Diacritical Marks|0370 03FF Greek and Coptic|0400 04FF Cyrillic|0500 052F Cyrillic Supplement
0530 058F Armenian|0590 05FF Hebrew|0600 06FF Arabic|0700 074F Syriac|0750 077F Arabic Supplement|0780 07BF Thaana|07C0 07FF NKo|0800 083F Samaritan
08A0 08FF Arabic Extended-A|0900 097F Devanagari|0980 09FF Bengali|0A00 0A7F Gurmukhi|0A80 0AFF Gujarati|0B00 0B7F Oriya|0B80 0BFF Tamil
0C00 0C7F Telugu|0C80 0CFF Kannada|0D00 0D7F Malayalam|0D80 0DFF Sinhala|0E00 0E7F Thai|0E80 0EFF Lao|0F00 0FFF Tibetan|1000 109F Myanmar
10A0 10FF Georgian|1100 11FF Hangul Jamo|1200 137F Ethiopic|13A0 13FF Cherokee|1400 167F Unified Canadian Aboriginal Syllabics|1680 169F Ogham
16A0 16FF Runic|1780 17FF Khmer|1800 18AF Mongolian|1AB0 1AFF Combining Diacritical Marks Extended|1C80 1C8F Cyrillic Extended-C|1CD0 1CFF Vedic Extensions
1D00 1D7F Phonetic Extensions|1D80 1DBF Phonetic Extensions Supplement|1DC0 1DFF Combining Diacritical Marks Supplement|1E00 1EFF Latin Extended Additional
1F00 1FFF Greek Extended|2000 206F General Punctuation|2070 209F Superscripts and Subscripts|20A0 20CF Currency Symbols
20D0 20FF Combining Diacritical Marks for Symbols|2100 214F Letterlike Symbols|2150 218F Number Forms|2190 21FF Arrows|2200 22FF Mathematical Operators
2300 23FF Miscellaneous Technical|2400 243F Control Pictures|2440 245F Optical Character Recognition|2460 24FF Enclosed Alphanumerics|2500 257F Box Drawing
2580 259F Block Elements|25A0 25FF Geometric Shapes|2600 26FF Miscellaneous Symbols|2700 27BF Dingbats|27C0 27EF Miscellaneous Mathematical Symbols-A
27F0 27FF Supplemental Arrows-A|2800 28FF Braille Patterns|2900 297F Supplemental Arrows-B|2980 29FF Miscellaneous Mathematical Symbols-B
2A00 2AFF Supplemental Mathematical Operators|2B00 2BFF Miscellaneous Symbols and Arrows|2C00 2C5F Glagolitic|2C60 2C7F Latin Extended-C|2C80 2CFF Coptic
2D00 2D2F Georgian Supplement|2D30 2D7F Tifinagh|2DE0 2DFF Cyrillic Extended-A|2E00 2E7F Supplemental Punctuation|2E80 2EFF CJK Radicals Supplement
2F00 2FDF Kangxi Radicals|3000 303F CJK Symbols and Punctuation|3040 309F Hiragana|30A0 30FF Katakana|3100 312F Bopomofo|3130 318F Hangul Compatibility Jamo
31F0 31FF Katakana Phonetic Extensions|3200 32FF Enclosed CJK Letters and Months|3300 33FF CJK Compatibility|3400 4DBF CJK Unified Ideographs Extension A
4DC0 4DFF Yijing Hexagram Symbols|4E00 9FFF CJK Unified Ideographs|A000 A48F Yi Syllables|A640 A69F Cyrillic Extended-B|A700 A71F Modifier Tone Letters
A720 A7FF Latin Extended-D|A8E0 A8FF Devanagari Extended|A960 A97F Hangul Jamo Extended-A|AB30 AB6F Latin Extended-E|AC00 D7AF Hangul Syllables
D7B0 D7FF Hangul Jamo Extended-B|E000 F8FF Private Use Area|F900 FAFF CJK Compatibility Ideographs|FB00 FB4F Alphabetic Presentation Forms
FB50 FDFF Arabic Presentation Forms-A|FE00 FE0F Variation Selectors|FE10 FE1F Vertical Forms|FE20 FE2F Combining Half Marks|FE30 FE4F CJK Compatibility Forms
FE50 FE6F Small Form Variants|FE70 FEFF Arabic Presentation Forms-B|FF00 FFEF Halfwidth and Fullwidth Forms|FFF0 FFFF Specials
1D400 1D7FF Mathematical Alphanumeric Symbols|1F000 1F02F Mahjong Tiles|1F0A0 1F0FF Playing Cards|1F100 1F1FF Enclosed Alphanumeric Supplement
1F200 1F2FF Enclosed Ideographic Supplement|1F300 1F5FF Miscellaneous Symbols and Pictographs|1F600 1F64F Emoticons|1F680 1F6FF Transport and Map Symbols
1F700 1F77F Alchemical Symbols|1F780 1F7FF Geometric Shapes Extended|1F800 1F8FF Supplemental Arrows-C|1F900 1F9FF Supplemental Symbols and Pictographs
1FA70 1FAFF Symbols and Pictographs Extended-A|20000 2A6DF CJK Unified Ideographs Extension B|F0000 FFFFF Supplementary Private Use Area-A`
  .split(/[|\n]/).filter(Boolean).map((row) => {
    const [first, last, ...name] = row.trim().split(' ');
    return [parseInt(first!, 16), parseInt(last!, 16), name.join(' ')] as const;
  });

/** Count mapped characters per block, in block order, with the remainder as "Other". */
export function coverageByBlock(ranges: ReadonlyArray<readonly [number, number]>): FontBlockCoverageV1[] {
  const counts = new Array<number>(BLOCKS.length).fill(0);
  let other = 0, otherFirst = Infinity, otherLast = -1;
  const addOther = (first: number, last: number) => {
    other += last - first + 1; otherFirst = Math.min(otherFirst, first); otherLast = Math.max(otherLast, last);
  };
  // Ranges arrive ascending, so the block search resumes where the last range
  // left it and the whole count stays linear (it restarts if they do not ascend).
  let from = 0, previous = -1;
  for (const [first, last] of ranges) {
    if (first < previous) from = 0;
    previous = first;
    while (from < BLOCKS.length && BLOCKS[from]![1] < first) from++;
    let cp = first;
    for (let i = from; i < BLOCKS.length && cp <= last; i++) {
      const [blockFirst, blockLast] = BLOCKS[i]!;
      if (blockLast < cp) continue;
      if (blockFirst > last) break;
      if (blockFirst > cp) { addOther(cp, blockFirst - 1); cp = blockFirst; }
      const end = Math.min(last, blockLast);
      counts[i]! += end - cp + 1;
      cp = end + 1;
    }
    if (cp <= last) addOther(cp, last);
  }
  const blocks: FontBlockCoverageV1[] = [];
  counts.forEach((characters, i) => { if (characters) blocks.push({ name: BLOCKS[i]![2], first: BLOCKS[i]![0], last: BLOCKS[i]![1], characters }); });
  if (other) blocks.push({ name: 'Other', first: otherFirst, last: otherLast, characters: other });
  return blocks;
}

// ── inspection ──────────────────────────────────────────────────────────────

interface Parsed { sfnt: Uint8Array; directory: SfntDirectory; inspection: FontInspectionV1; cmap: Cmap }

function parse(bytes: Uint8Array): Parsed {
  const { sfnt, container, directory } = sfntOf(bytes);
  const t = directory.tables;
  const head = t.get('head'), maxp = t.get('maxp'), os2 = t.get('OS/2');
  if (!head || !inTable(head, 0, 54) || !maxp || !inTable(maxp, 0, 6)) throw fontError('unreadable', 'The font is missing its head or maxp table.');
  const glyphs = u16(sfnt, maxp.off + 4);
  const name = readNames(sfnt, t.get('name'));
  const { axes, instances } = readAxes(sfnt, t.get('fvar'), name);
  const cmap = readCmap(sfnt, t.get('cmap'), glyphs);
  const weightClass = os2 && inTable(os2, 0, 8) ? u16(sfnt, os2.off + 4) : 400;
  const wght = axes.find((axis) => axis.tag === 'wght');
  const outlines = sfntOutlines(directory);
  const embedding = readEmbeddingFlags(sfnt, directory);
  const characters = cmap.ranges.reduce((sum, [first, last]) => sum + last - first + 1, 0);
  const italic = (os2 && inTable(os2, 0, 64) ? (u16(sfnt, os2.off + 62) & 1) === 1 : false) || (u16(sfnt, head.off + 44) & 2) === 2;
  const inspection: FontInspectionV1 = {
    container,
    outlines,
    family: name(16) || name(1),
    style: name(17) || name(2),
    fullName: name(4),
    version: name(5),
    postScriptName: name(6),
    glyphs,
    unitsPerEm: u16(sfnt, head.off + 18),
    weight: { value: weightClass, min: wght ? wght.min : weightClass, max: wght ? wght.max : weightClass },
    width: os2 && inTable(os2, 0, 8) ? u16(sfnt, os2.off + 6) : 5,
    italic,
    axes,
    instances,
    coverage: { characters, ranges: cmap.ranges, blocks: coverageByBlock(cmap.ranges) },
    embedding,
    subsetRefusal: subsetRefusalFor(outlines, embedding),
  };
  return { sfnt, directory, inspection, cmap };
}

/** What a TTF, OTF or WOFF file's own tables say. Throws a coded Error for anything unreadable. */
export function inspectFont(bytes: Uint8Array): FontInspectionV1 {
  return parse(bytes).inspection;
}

/** The distinct characters `text` asks for, minus control characters and line breaks. */
function requestedCodePoints(text: string): number[] {
  if (text.length > MAX_TEXT_UNITS) throw fontError('too-large', 'Choose at most 100,000 characters to keep.');
  const seen = new Set<number>();
  for (const char of text) {
    const cp = char.codePointAt(0)!;
    if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) continue;
    seen.add(cp);
  }
  return [...seen].sort((a, b) => a - b);
}

/** Map text to this font's glyph ids. `missing` lists characters the cmap does not map. */
export function glyphsForText(bytes: Uint8Array, text: string): { glyphs: number[]; kept: number[]; missing: number[] } {
  const { cmap } = parse(bytes);
  const kept: number[] = [], missing: number[] = [], glyphs = new Set<number>();
  for (const cp of requestedCodePoints(text)) {
    const gid = cmap.gid(cp);
    if (gid) { kept.push(cp); glyphs.add(gid); } else missing.push(cp);
  }
  return { glyphs: [...glyphs].sort((a, b) => a - b), kept, missing };
}

/**
 * Subset a font to the characters in `request.text`, refusing first when the
 * outlines are unsupported or the font's fsType forbids it, and verifying the
 * output after. A WOFF source comes back as a plain sfnt.
 */
export async function subsetFontForText(bytes: Uint8Array, request: FontSubsetRequestV1, runner: FontSubsetRunner): Promise<FontSubsetResultV1> {
  const source = parse(bytes);
  const refusal = source.inspection.subsetRefusal;
  if (refusal) throw fontError(refusal, FONT_SUBSET_REFUSALS[refusal]);
  const requested = requestedCodePoints(typeof request?.text === 'string' ? request.text : '');
  const kept: Array<[number, number]> = [], missing: number[] = [];
  for (const cp of requested) {
    const gid = source.cmap.gid(cp);
    if (gid) kept.push([cp, gid]); else missing.push(cp);
  }
  if (!kept.length) throw fontError('no-characters', requested.length ? 'None of those characters are in this font.' : 'Type the characters to keep first.');
  const glyphs = [...new Set(kept.map(([, gid]) => gid))].sort((a, b) => a - b);
  const output = await runner.run(source.sfnt.slice(), glyphs);

  // Verify the bytes that will be delivered, not the plan.
  const verified = (() => { try { return parse(output); } catch { return null; } })();
  const fail = (why: string) => fontError('verification', `The subset failed its check (${why}), so it was not saved.`);
  if (!verified) throw fail('the output is not a readable font');
  if (verified.inspection.outlines !== 'truetype') throw fail('the outlines changed format');
  if (verified.inspection.embedding.fsType !== source.inspection.embedding.fsType) throw fail('the embedding flags changed');
  const before = glyphLengths(source.sfnt, source.directory, source.inspection.glyphs);
  const after = glyphLengths(verified.sfnt, verified.directory, verified.inspection.glyphs);
  if (!before || !after) throw fail('the glyph index could not be read');
  for (const [cp, gid] of kept) {
    if (verified.cmap.gid(cp) !== gid) throw fail(`U+${cp.toString(16).toUpperCase().padStart(4, '0')} no longer maps to its glyph`);
    if ((before(gid) > 0) !== (after(gid) > 0)) throw fail(`the outline for U+${cp.toString(16).toUpperCase().padStart(4, '0')} changed`);
  }
  return {
    bytes: verified.sfnt,
    report: {
      characters: requested.length,
      kept: kept.length,
      missing: missing.slice(0, MAX_MISSING_LISTED).map((cp) => String.fromCodePoint(cp)),
      inputBytes: bytes.length,
      outputBytes: verified.sfnt.length,
      policy: runner.policy,
      fsType: verified.inspection.embedding.fsType,
    },
  };
}

/** The `host.fonts` surface over a shell's subsetter. Every shell attaches this verbatim. */
export function createFontsAPI(runner: FontSubsetRunner): FontsAPI {
  return {
    inspect: async (bytes) => inspectFont(bytes),
    subset: (bytes, request) => subsetFontForText(bytes, request, runner),
  };
}
