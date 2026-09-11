// SPDX-License-Identifier: MPL-2.0
/**
 * Font-registry unit tests - the pure resolution logic that decides WHICH face
 * outlines a run: family-stack parsing, unicode-range coverage, and face/axis
 * selection. The IndexedDB + woff2-decompression halves are exercised
 * end-to-end in the browser (see the export verification), not here.
 *
 * Run directly:  node --test shells/web/src/bridge/font-registry.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFontFamilies, parseUnicodeRange, rangesCover, coverageCount, pickFaces , isFontContentType, genericFontRole } from './font-registry.ts';

// ── genericFontRole ──────────────────────────────────────────────────────────
// Owner rule (2026-08-24): tool text renders in the active brand's faces. When
// a stack's named families all fail to resolve, its CSS generics stand in for
// the brand's own stack for that role (read from --font-brand / --font-mono)
// instead of keeping the <text> fallback a PDF viewer would substitute.

test('generics map to a brand type role; named families and serif decline', () => {
  assert.equal(genericFontRole('monospace'), 'mono');
  assert.equal(genericFontRole('ui-monospace'), 'mono');
  assert.equal(genericFontRole('UI-Monospace'), 'mono');
  assert.equal(genericFontRole('sans-serif'), 'sans');
  assert.equal(genericFontRole('system-ui'), 'sans');
  assert.equal(genericFontRole('ui-sans-serif'), 'sans');
  assert.equal(genericFontRole('serif'), null, 'no brand serif role exists, so serif keeps the <text> fallback');
  assert.equal(genericFontRole('Menlo'), null, 'a named platform face is not a generic');
  assert.equal(genericFontRole('Inter'), null);
});

// ── parseFontFamilies ────────────────────────────────────────────────────────

test('splits a computed font-family stack, unquoted, in cascade order', () => {
  assert.deepEqual(
    parseFontFamilies("'Space Grotesk', Outfit, ui-sans-serif, system-ui"),
    ['Space Grotesk', 'Outfit', 'ui-sans-serif', 'system-ui'],
  );
  assert.deepEqual(parseFontFamilies('"SUSE Mono", ui-monospace'), ['SUSE Mono', 'ui-monospace']);
  assert.deepEqual(parseFontFamilies('Inter'), ['Inter']);
  assert.deepEqual(parseFontFamilies(undefined), []);
  assert.deepEqual(parseFontFamilies('  '), []);
});

test('a comma inside a quoted family name does not split it', () => {
  assert.deepEqual(parseFontFamilies(`"Ye Olde, Face", serif`), ['Ye Olde, Face', 'serif']);
});

// ── parseUnicodeRange / rangesCover ──────────────────────────────────────────

test('parses the three unicode-range forms: range, single, wildcard', () => {
  assert.deepEqual(parseUnicodeRange('U+0-7F'), [[0x0, 0x7f]]);
  assert.deepEqual(parseUnicodeRange('U+2212'), [[0x2212, 0x2212]]);
  assert.deepEqual(parseUnicodeRange('U+4??'), [[0x400, 0x4ff]]);
  assert.deepEqual(parseUnicodeRange('U+0-FF, U+131, U+152-153'), [[0, 0xff], [0x131, 0x131], [0x152, 0x153]]);
  assert.deepEqual(parseUnicodeRange(''), []);
  assert.deepEqual(parseUnicodeRange(undefined), []);
});

test('coverage: latin subset covers ASCII, not latin-ext; whitespace ignored', () => {
  const latin = parseUnicodeRange('U+0000-00FF');
  assert.equal(rangesCover(latin, 'Hello World'), true);
  assert.equal(rangesCover(latin, 'Ærø'), true);          // U+00C6/U+00F8 are in latin
  assert.equal(rangesCover(latin, 'Ĳsselmeer'), false);   // U+0132 is latin-ext
  assert.equal(rangesCover(latin, 'привет'), false);      // cyrillic
});

test('an empty range list means an unsubsetted face - covers everything', () => {
  assert.equal(rangesCover([], 'anything 漢字 ✓'), true);
});

test('astral codepoints are read whole (surrogate pairs), not per unit', () => {
  const bmp = parseUnicodeRange('U+0000-FFFF');
  assert.equal(rangesCover(bmp, '😀'), false); // U+1F600 sits above the BMP
});

test('coverageCount ranks faces by how much of the run they can draw', () => {
  const latin = parseUnicodeRange('U+0000-00FF');
  const ext   = parseUnicodeRange('U+0100-024F');
  assert.equal(coverageCount(latin, 'Łódź'), 2);   // ó, d
  assert.equal(coverageCount(ext,   'Łódź'), 2);   // Ł, ź
  assert.equal(coverageCount(latin, 'Hello World'), 10);  // the space doesn't count
  assert.equal(coverageCount(ext,   'Hello World'), 0);
  assert.equal(coverageCount([],    'Łódź'), 4);   // unsubsetted face draws it all
});

// ── pickFaces ────────────────────────────────────────────────────────────────

type Face = Parameters<typeof pickFaces>[0][number];
const face = (o: Partial<Face>): Face => ({
  assetId: 'a', staticUrl: '', weight: '400', style: 'normal', unicodeRange: '', ...o,
} as Face);

const LATIN = 'U+0000-00FF';
const EXT   = 'U+0100-024F';

test('a variable face carries the run weight as a wght axis', () => {
  const chain = pickFaces([face({ weight: '100 900' })], { fontFamily: 'X', fontWeight: '700' }, 'Hi');
  assert.equal(chain.length, 1);
  assert.deepEqual(chain[0]!.variations, ['wght=700']);
});

test('the wght axis is clamped to the face range', () => {
  const f = [face({ weight: '300 600' })];
  assert.deepEqual(pickFaces(f, { fontFamily: 'X', fontWeight: '900' }, 'Hi')[0]!.variations, ['wght=600']);
  assert.deepEqual(pickFaces(f, { fontFamily: 'X', fontWeight: '100' }, 'Hi')[0]!.variations, ['wght=300']);
});

test('static faces: the nearest weight wins and the other weights are dropped', () => {
  const faces = [face({ assetId: 'r', weight: '400' }), face({ assetId: 'b', weight: '700' })];
  const bold = pickFaces(faces, { fontFamily: 'X', fontWeight: '600' }, 'Hi');
  assert.deepEqual(bold.map(c => c.face.assetId), ['b']);   // never falls back into regular
  assert.equal(bold[0]!.variations, undefined);
  assert.deepEqual(pickFaces(faces, { fontFamily: 'X', fontWeight: '500' }, 'Hi').map(c => c.face.assetId), ['r']);
  assert.deepEqual(pickFaces(faces, { fontFamily: 'X' }, 'Hi').map(c => c.face.assetId), ['r']); // default 400
});

test('a static family keeps BOTH subsets of the chosen weight in the chain', () => {
  const faces = [
    face({ assetId: 'r-latin', weight: '400', unicodeRange: LATIN }),
    face({ assetId: 'r-ext',   weight: '400', unicodeRange: EXT }),
    face({ assetId: 'b-latin', weight: '700', unicodeRange: LATIN }),
    face({ assetId: 'b-ext',   weight: '700', unicodeRange: EXT }),
  ];
  assert.deepEqual(
    pickFaces(faces, { fontFamily: 'X', fontWeight: '700' }, 'Łódź').map(c => c.face.assetId).sort(),
    ['b-ext', 'b-latin'],
  );
});

test('the chain leads with the face covering most of the run', () => {
  const faces = [
    face({ assetId: 'latin', weight: '100 900', unicodeRange: LATIN }),
    face({ assetId: 'ext',   weight: '100 900', unicodeRange: EXT }),
  ];
  // Pure ASCII: the ext subset draws nothing, so it never enters the chain.
  assert.deepEqual(pickFaces(faces, { fontFamily: 'X' }, 'Hello').map(c => c.face.assetId), ['latin']);
  // Mostly ext: ext leads, latin follows for the ASCII tail.
  assert.deepEqual(pickFaces(faces, { fontFamily: 'X' }, 'ĲĲĲa').map(c => c.face.assetId), ['ext', 'latin']);
  // A mixed run keeps both - the disjoint subsets each carry half of "Łódź".
  assert.equal(pickFaces(faces, { fontFamily: 'X' }, 'Łódź').length, 2);
});

test('every face in the chain carries its own axis settings', () => {
  const faces = [
    face({ assetId: 'latin', weight: '100 900', unicodeRange: LATIN }),
    face({ assetId: 'ext',   weight: '100 900', unicodeRange: EXT }),
  ];
  for (const c of pickFaces(faces, { fontFamily: 'X', fontWeight: '600' }, 'Łódź')) {
    assert.deepEqual(c.variations, ['wght=600']);
  }
});

test('italic runs never borrow an upright face (they would un-slant silently)', () => {
  const faces = [face({ weight: '100 900', style: 'normal' })];
  assert.deepEqual(pickFaces(faces, { fontFamily: 'X', fontStyle: 'italic' }, 'Hi'), []);
  assert.deepEqual(pickFaces(faces, { fontFamily: 'X', fontStyle: 'oblique' }, 'Hi'), []);
  assert.equal(pickFaces(faces, { fontFamily: 'X', fontStyle: 'normal' }, 'Hi').length, 1);
});

test('an italic face serves an italic run', () => {
  const faces = [face({ assetId: 'i', weight: '400', style: 'italic' })];
  assert.equal(pickFaces(faces, { fontFamily: 'X', fontStyle: 'italic' }, 'Hi')[0]!.face.assetId, 'i');
});

test('a run no face can draw yields an empty chain (caller keeps <text>)', () => {
  const faces = [face({ weight: '100 900', unicodeRange: LATIN })];
  assert.deepEqual(pickFaces(faces, { fontFamily: 'X' }, '漢字'), []);
});

// ── isFontContentType - the SPA-fallback trap ────────────────────────────────
// A dev/dist server answers a MISSING /catalog font with 200 text/html (SPA
// fallback), so "resp.ok" alone would mint an HTML page as a font. This pure
// predicate is what keeps that out of the registry.
test('isFontContentType rejects HTML/SPA-fallback responses and accepts font types', () => {
  assert.equal(isFontContentType('text/html; charset=utf-8'), false);
  assert.equal(isFontContentType('text/plain'), false);
  assert.equal(isFontContentType('application/xhtml+xml'), false);
  assert.equal(isFontContentType(''), false);
  assert.equal(isFontContentType('font/ttf'), true);
  assert.equal(isFontContentType('font/woff2'), true);
  assert.equal(isFontContentType('application/octet-stream'), true);
});
