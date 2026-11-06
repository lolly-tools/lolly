// SPDX-License-Identifier: MPL-2.0
/**
 * Fallback fonts (fallback-fonts.ts, fallback-fonts-node.ts): which characters a design
 * system's fonts cannot draw, which pack fills them, how a fill face splits a run, the
 * sentence an export shows, and the shipped files in community/fallback-fonts. Shaping
 * runs through real HarfBuzz with the shell's own SUSE face and the shipped WOFF2 packs,
 * so this needs no browser.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  choosePacks, fallbackPacksFrom, fillNotice, fillSegments, packClaims, packCovers, packVariations,
  uncoveredClusters, unicodeRangeOf, type FallbackFontPack,
} from '../src/fallback-fonts.ts';
import { diskFallbackPacks, nodeFillChain } from '../src/fallback-fonts-node.ts';
import { parseUnicodeRange } from '../src/font-faces.ts';
import { createNodeTextAPI } from '../src/text.ts';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const ROOT = `${REPO}community/fallback-fonts/`;
const SUSE = 'shells/web/public/fonts/SUSE[wght].ttf';
const index = JSON.parse(readFileSync(`${ROOT}index.json`, 'utf8')) as { assets: Array<Record<string, any>> };
const packs = fallbackPacksFrom(index.assets);
const pack = (label: string, style = 'normal'): FallbackFontPack => packs.find((p) => p.label === label && p.style === style)!;
const set = (s: string): Set<number> => new Set([...s].map((c) => c.codePointAt(0)!));

test('the shipped index lists eleven OFL fonts whose files match their records', () => {
  assert.equal(packs.length, 11);
  assert.deepEqual([...new Set(packs.map((p) => p.label))].sort(), ['Arabic', 'Bengali', 'Cyrillic', 'Devanagari', 'Greek', 'Hebrew', 'Latin', 'Thai']);
  for (const entry of index.assets) {
    assert.equal(entry.tier, 'on-demand', entry.id);
    assert.equal(entry.license, 'OFL-1.1', entry.id);
    const right = entry.rights.works[0].rights[0];
    assert.equal(right.expression, 'OFL-1.1', entry.id);
    assert.match(right.textHash, /^sha256:[0-9a-f]{64}$/, entry.id);
    const format = entry.formats[0];
    const file = `${ROOT}${format.url.replace('/catalog/packs/fallback-fonts/', '')}`;
    const bytes = readFileSync(file);
    assert.equal(bytes.length, format.size, entry.id);
    assert.equal(format.checksum, `sha256-${createHash('sha256').update(bytes).digest('base64')}`, entry.id);
    assert.equal(bytes.subarray(0, 4).toString('latin1'), 'wOF2', entry.id);
    const licence = `${ROOT}${entry.meta.fallbackFont.licenceFile.replace('/catalog/packs/fallback-fonts/', '')}`;
    assert.match(readFileSync(licence, 'utf8'), /SIL OPEN FONT LICENSE Version 1\.1/, entry.id);
    assert.equal(createHash('sha256').update(readFileSync(licence)).digest('hex'), right.textHash.slice(7), entry.id);
  }
});

test('a pack is chosen only for characters of its own scripts, which its file maps', () => {
  for (const p of packs) {
    const covers = parseUnicodeRange(p.covers);
    for (const [lo, hi] of parseUnicodeRange(p.claims)) {
      assert.ok(covers.some(([a, b]) => a <= lo && hi <= b), `${p.id} claims ${lo.toString(16)} it does not map`);
    }
  }
  assert.equal(packClaims(pack('Arabic'), 0x0628), true);
  assert.equal(packClaims(pack('Arabic'), 0x41), false, 'not the Latin letters the Arabic file also maps');
  assert.equal(packClaims(pack('Cyrillic'), 0x20), false, 'not a shared space');
  assert.equal(packCovers(pack('Arabic'), [0x628, 0x41, 0x20]), true);
});

test('unicode ranges fold and read back', () => {
  assert.equal(unicodeRangeOf([0x41, 0x42, 0x43, 0x45, 0x600, 0x601]), 'U+41-43,U+45,U+600-601');
  assert.equal(unicodeRangeOf([]), '');
  assert.deepEqual(parseUnicodeRange(unicodeRangeOf([0x41, 0x42, 0x43, 0x45])), [[0x41, 0x43], [0x45, 0x45]]);
});

test('text the faces cover has no uncovered clusters', () => {
  const latin = set('The best tools disappear, 2024.');
  assert.deepEqual(uncoveredClusters('The best tools disappear, 2024.', [latin]), []);
  assert.deepEqual(uncoveredClusters('', [latin]), []);
  assert.deepEqual(uncoveredClusters('  \n\t', [new Set()]), [], 'spaces and controls need no glyph');
});

test('uncovered clusters carry their script, and a split cluster counts as uncovered', () => {
  const latin = set('Hello 2024 .');
  const found = uncoveredClusters('Hello مرحبا 2024.', [latin]);
  assert.deepEqual([...new Set(found.map((c) => c.script))], ['Arab']);
  assert.equal(found.map((c) => c.text).join(''), 'مرحبا');
  // e + combining acute: each character is mapped, but by two faces, so no one face draws the pair.
  const split = uncoveredClusters('é', [set('e'), set('́')]);
  assert.equal(split.length, 1);
  assert.deepEqual(uncoveredClusters('é', [set('é')]), []);
});

test('the pack made for a script is chosen, italic where one exists, and CJK is left unfilled', () => {
  const brand = set('abcdefghijklmnopqrstuvwxyz 0123456789.,');
  const cyr = choosePacks(uncoveredClusters('Привет', [brand]), packs, false);
  assert.deepEqual(cyr.packs.map((p) => p.id), ['community/fallback-font/noto-sans-cyrillic']);
  const cyrItalic = choosePacks(uncoveredClusters('Привет', [brand]), packs, true);
  assert.deepEqual(cyrItalic.packs.map((p) => p.id), ['community/fallback-font/noto-sans-cyrillic-italic']);
  const arabItalic = choosePacks(uncoveredClusters('مرحبا', [brand]), packs, true);
  assert.deepEqual(arabItalic.packs.map((p) => p.id), ['community/fallback-font/noto-sans-arabic'], 'Arabic has no italic, so the upright file');
  const mixed = choosePacks(uncoveredClusters('Привет مرحبا שלום', [brand]), packs, false);
  assert.deepEqual(mixed.packs.map((p) => p.label), ['Cyrillic', 'Arabic', 'Hebrew'], 'in the order first needed');
  const cjk = choosePacks(uncoveredClusters('漢字 かな 한글', [brand]), packs, false);
  assert.deepEqual(cjk.packs, []);
  assert.equal(cjk.unfilled.map((c) => c.text).join(''), '漢字かな한글');
});

test('a fill face takes only the clusters the faces before it cannot draw', () => {
  const brand = { unicodes: set('Hello 2024.') };
  const arabic = { unicodes: set('مرحبا 2024.Hel'), fill: true };
  assert.deepEqual(fillSegments('Hello مرحبا 2024.', [brand, arabic]), [
    { text: 'Hello ', face: 0 },
    { text: 'مرحبا', face: 1 },
    { text: ' 2024.', face: 0 },
  ], 'digits, Latin and the space stay with the brand even though the fill face maps them');
  // Chrome draws a space between two fallback words in the first font that has one, so
  // the export does too: otherwise the line comes out wider than the page by the
  // difference between the two spaces, once per space.
  assert.deepEqual(fillSegments('مرحبا بالعالم', [brand, arabic]), [
    { text: 'مرحبا', face: 1 }, { text: ' ', face: 0 }, { text: 'بالعالم', face: 1 },
  ]);
  const noSpace = { unicodes: set('Hello') };
  assert.deepEqual(fillSegments('مرحبا بالعالم', [noSpace, arabic]), [{ text: 'مرحبا بالعالم', face: 1 }], 'a brand with no space glyph leaves it to the fill face');
  assert.deepEqual(fillSegments('Hello', [brand, arabic]), [{ text: 'Hello', face: 0 }]);
  assert.deepEqual(fillSegments('漢', [brand, arabic]), [{ text: '漢', face: 0 }], 'nothing maps it: it stays put and shapes as .notdef');
});

test('the notice names each script and the font that drew it, once', () => {
  assert.equal(fillNotice([]), null);
  assert.equal(fillNotice([{ label: 'Arabic', family: 'Noto Sans Arabic' }, { label: 'Arabic', family: 'Noto Sans Arabic' }]),
    "Arabic text is drawn with Noto Sans Arabic, because this design system's fonts do not have those letters.");
  assert.equal(fillNotice([{ label: 'Cyrillic', family: 'Noto Sans' }, { label: 'Arabic', family: 'Noto Sans Arabic' }, { label: 'Latin', family: 'Noto Sans' }]),
    "Cyrillic text is drawn with Noto Sans, Arabic text with Noto Sans Arabic and some Latin letters with Noto Sans, because this design system's fonts do not have those letters.");
  assert.equal(fillNotice([{ label: 'Latin', family: 'Noto Sans' }]),
    "Some Latin letters are drawn with Noto Sans, because this design system's fonts do not have those letters.");
});

test('weight variations clamp to the file axis', () => {
  assert.deepEqual(packVariations(pack('Arabic'), 700), ['wght=700']);
  assert.deepEqual(packVariations(pack('Arabic'), 50), ['wght=100']);
  assert.deepEqual(packVariations(pack('Arabic'), Number.NaN), ['wght=400']);
});

test('the Node shells find every pack on disk', () => {
  assert.equal(diskFallbackPacks().length, 11);
});

test('real shaping: a fill face draws Arabic, and Latin keeps the bytes it had', async () => {
  const api = createNodeTextAPI({ repoRoot: REPO });
  const arabicUrl = pack('Arabic').url;
  assert.ok(existsSync(`${ROOT}noto-sans-arabic.woff2`));
  const fill = [{ fontUrl: arabicUrl, variations: ['wght=400'], fill: true }];

  const latin = 'The best tools disappear, 2024.';
  const plain = await api.toPath({ text: latin, fontUrl: SUSE, fontSize: 40 });
  const withFill = await api.toPath({ text: latin, fontUrl: SUSE, fontSize: 40, fallbackFonts: fill });
  assert.deepEqual(withFill, plain, 'a run the brand covers is untouched by a fill face in the chain');

  const mixed = 'Hello مرحبا 2024.';
  const before = await api.toPath({ text: mixed, fontUrl: SUSE, fontSize: 40 });
  assert.ok((before.notdef ?? 0) > 0, 'SUSE has no Arabic');
  const after = await api.toPath({ text: mixed, fontUrl: SUSE, fontSize: 40, fallbackFonts: fill, direction: 'ltr' });
  assert.equal(after.notdef ?? 0, 0);
  assert.ok(after.d.length > before.d.length / 2);
});

test('nodeFillChain adds the pack only for what the brand lacks, and names it', async () => {
  const api = createNodeTextAPI({ repoRoot: REPO });
  const characters = (url: string) => api.characters!(url);
  const chain = [{ fontUrl: SUSE }];
  assert.equal(await nodeFillChain(characters, chain, [], 'Plain ASCII.', { weight: 400, italic: false }), null);
  assert.equal(await nodeFillChain(characters, chain, [], 'Café déjà vu', { weight: 400, italic: false }), null, 'SUSE covers it');
  const ar = await nodeFillChain(characters, chain, [], 'مرحبا 2024', { weight: 700, italic: false });
  assert.deepEqual(ar?.uses, [{ label: 'Arabic', family: 'Noto Sans Arabic' }]);
  assert.deepEqual(ar?.fallbacks, [{ fontUrl: pack('Arabic').url, variations: ['wght=700'], fill: true }]);
  assert.equal(await nodeFillChain(characters, chain, [], '漢字', { weight: 400, italic: false }), null, 'no pack for CJK yet');
});
