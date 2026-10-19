// SPDX-License-Identifier: MPL-2.0
/**
 * Crafted fonts for the cmap reader's work and allocation bounds: the fixture
 * source for tests/font-inspect.test.ts and seeds for the `font-inspect` fuzz
 * target. Each is a minimal TrueType sfnt (cmap, head and maxp, no outlines)
 * that engine/src/font-inspect.ts reads like any other face.
 */

/** Wrap one cmap subtable (Windows Unicode, BMP for format 4 or full for 12) in a minimal sfnt. */
export function fontWithCmap(subtable: Uint8Array, numGlyphs: number): Uint8Array {
  const format = (subtable[0]! << 8) | subtable[1]!;
  const cmap = new Uint8Array(12 + subtable.length);
  const cmapView = new DataView(cmap.buffer);
  cmapView.setUint16(2, 1);
  cmapView.setUint16(4, 3);
  cmapView.setUint16(6, format === 12 ? 10 : 1);
  cmapView.setUint32(8, 12);
  cmap.set(subtable, 12);
  const head = new Uint8Array(54);
  new DataView(head.buffer).setUint16(18, 1000);
  const maxp = new Uint8Array(6);
  new DataView(maxp.buffer).setUint32(0, 0x5000);
  new DataView(maxp.buffer).setUint16(4, numGlyphs);
  const tables: Array<[string, Uint8Array]> = [['cmap', cmap], ['head', head], ['maxp', maxp]];
  const out = new Uint8Array(12 + tables.length * 16 + tables.reduce((n, [, data]) => n + data.length, 0));
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x00010000);
  view.setUint16(4, tables.length);
  let off = 12 + tables.length * 16;
  tables.forEach(([tag, data], i) => {
    out.set([...tag].map((c) => c.charCodeAt(0)), 12 + i * 16);
    view.setUint32(12 + i * 16 + 8, off);
    view.setUint32(12 + i * 16 + 12, data.length);
    out.set(data, off);
    off += data.length;
  });
  return out;
}

/**
 * A cmap format 4 whose `segments` segments all start at U+0000 and end at
 * ascending code points up to U+FFFE, every one pointing at the same glyph array
 * of `glyphArray` entries, in which odd indexes hold glyph 1 and even ones hold
 * nothing (`sharedEnd` gives every segment the end U+FFFE instead, which breaks
 * the ascending order). A reader that walks each segment's whole range does
 * about `segments` x 65,535 lookups and gathers up to half as many ranges; one
 * that visits each code point once does 65,535. Either way the font maps the odd
 * code points below `glyphArray` to glyph 1 (numGlyphs is 2).
 */
export function overlappingCmap4Font(segments: number, opts: { glyphArray?: number; sharedEnd?: boolean } = {}): Uint8Array {
  const glyphArray = opts.glyphArray ?? 0xffff;
  const segCount = segments + 1; // plus the 0xFFFF terminator
  const ends = 14, starts = ends + segCount * 2 + 2, deltas = starts + segCount * 2, offsets = deltas + segCount * 2;
  const array = offsets + segCount * 2;
  const sub = new Uint8Array(array + glyphArray * 2);
  const view = new DataView(sub.buffer);
  view.setUint16(0, 4);
  view.setUint16(2, Math.min(sub.length, 0xffff));
  view.setUint16(6, segCount * 2);
  for (let seg = 0; seg < segments; seg++) {
    view.setUint16(ends + seg * 2, opts.sharedEnd ? 0xfffe : 0xfffe - (segments - 1 - seg));
    view.setUint16(starts + seg * 2, 0);
    view.setUint16(offsets + seg * 2, array - (offsets + seg * 2));
  }
  view.setUint16(ends + segments * 2, 0xffff);
  view.setUint16(starts + segments * 2, 0xffff);
  view.setUint16(deltas + segments * 2, 1);
  for (let k = 1; k < glyphArray; k += 2) view.setUint16(array + k * 2, 1);
  return fontWithCmap(sub, 2);
}

/** A cmap format 12 holding `groups` as given ([first, last, firstGlyph]), in that order. */
export function cmap12Font(groups: ReadonlyArray<readonly [number, number, number]>, numGlyphs: number): Uint8Array {
  const sub = new Uint8Array(16 + groups.length * 12);
  const view = new DataView(sub.buffer);
  view.setUint16(0, 12);
  view.setUint32(4, sub.length);
  view.setUint32(12, groups.length);
  groups.forEach(([first, last, glyph], i) => {
    view.setUint32(16 + i * 12, first);
    view.setUint32(20 + i * 12, last);
    view.setUint32(24 + i * 12, glyph);
  });
  return fontWithCmap(sub, numGlyphs);
}
