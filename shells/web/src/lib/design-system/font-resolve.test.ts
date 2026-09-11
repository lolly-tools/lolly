// SPDX-License-Identifier: MPL-2.0
/**
 * font-resolve.ts - the pure family-name resolver (plan 97 section 7.2, gap 3).
 *
 * Run with:
 *   node --import ./tests/css-stub.mjs --test "shells/web/src/lib/design-system/font-resolve.test.ts"
 *
 * The fixture table is spellings that actually occur: PostScript names lifted
 * out of PDFs (subset prefixes, "MT"/"PSMT" markers, hyphenated styles), the
 * camelCase family names build tools bake into files, and CSS stack entries.
 * Where a parse is imperfect the fixture records the imperfect answer rather
 * than a wished-for one, and the Google matching tests show it still resolves.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseFaceName, googleMatch, describeFaceSource, variableWeightRange } from './font-resolve.ts';
import { POPULAR_FAMILIES } from '../google-fonts.ts';

interface Case {
  raw: string;
  family: string;
  weight: number;
  italic: boolean;
  condensed?: boolean;
  why?: string;
}

const CASES: Case[] = [
  // ── Straight PostScript names out of a PDF ─────────────────────────────────
  { raw: 'Inter-SemiBold', family: 'Inter', weight: 600, italic: false },
  { raw: 'ABCDEF+Inter-Regular', family: 'Inter', weight: 400, italic: false, why: 'PDF subset prefix' },
  { raw: 'HelveticaNeue-Bold', family: 'Helvetica Neue', weight: 700, italic: false },
  { raw: 'RobotoCondensed-LightItalic', family: 'Roboto Condensed', weight: 300, italic: true, condensed: true },
  { raw: 'ArialMT', family: 'Arial', weight: 400, italic: false, why: 'Monotype marker is not a family word' },
  { raw: 'Arial-BoldItalicMT', family: 'Arial', weight: 700, italic: true },
  { raw: 'TimesNewRomanPSMT', family: 'Times New Roman', weight: 400, italic: false },
  { raw: 'TimesNewRomanPS-BoldMT', family: 'Times New Roman', weight: 700, italic: false },
  { raw: 'Times-Roman', family: 'Times Roman', weight: 400, italic: false,
    why: 'Roman stays a family word so Times New Roman survives; upright is the default anyway' },
  { raw: 'SFProText-Regular', family: 'SF Pro Text', weight: 400, italic: false },
  { raw: 'PlayfairDisplay-Black', family: 'Playfair Display', weight: 900, italic: false },

  // ── Weight words across the ladder ─────────────────────────────────────────
  { raw: 'Lato-Hairline', family: 'Lato', weight: 100, italic: false },
  { raw: 'Montserrat-ExtraLightItalic', family: 'Montserrat', weight: 200, italic: true },
  { raw: 'FiraSans-UltraLight', family: 'Fira Sans', weight: 200, italic: false },
  { raw: 'Oswald-DemiBold', family: 'Oswald', weight: 600, italic: false },
  { raw: 'Barlow-Semi', family: 'Barlow', weight: 600, italic: false, why: 'bare Semi reads 600' },
  { raw: 'Rubik-Heavy', family: 'Rubik', weight: 900, italic: false },
  { raw: 'Cabin-SemiLight', family: 'Cabin', weight: 350, italic: false, why: 'no rung on the ladder for it' },

  // ── Other spellings of the same idea ───────────────────────────────────────
  { raw: 'Open_Sans_ExtraBold', family: 'Open Sans', weight: 800, italic: false },
  { raw: 'inter-semibold', family: 'Inter', weight: 600, italic: false, why: 'lowercase input, human spelling out' },
  { raw: 'Helvetica Neue Bold Oblique', family: 'Helvetica Neue', weight: 700, italic: true },
  { raw: 'SourceSansPro-It', family: 'Source Sans Pro', weight: 400, italic: true },
  { raw: '  "Space Grotesk"  ', family: 'Space Grotesk', weight: 400, italic: false, why: 'CSS stack entry' },
  { raw: 'NotoSans-Bold.ttf', family: 'Noto Sans', weight: 700, italic: false, why: 'dropped file name' },
  { raw: 'Roboto700', family: 'Roboto', weight: 700, italic: false, why: 'numeric weight' },
  { raw: 'MuseoSlab-500', family: 'Museo Slab', weight: 500, italic: false },
  { raw: 'Exo2-Bold', family: 'Exo 2', weight: 700, italic: false, why: 'a family digit is not a weight' },
  { raw: 'IBMPlexSans-Var', family: 'IBM Plex Sans', weight: 400, italic: false, why: 'variable-build suffix' },
  { raw: 'Inter Variable', family: 'Inter', weight: 400, italic: false },
  { raw: 'AvenirNext-Condensed', family: 'Avenir Next Condensed', weight: 400, italic: false, condensed: true },
  { raw: 'HelveticaNeue-CondBold', family: 'Helvetica Neue Condensed', weight: 700, italic: false, condensed: true },
  { raw: 'ArchivoNarrow-Medium', family: 'Archivo Narrow', weight: 500, italic: false, condensed: true },

  // ── Imperfect but honest ───────────────────────────────────────────────────
  { raw: 'JetBrainsMono-Medium', family: 'Jet Brains Mono', weight: 500, italic: false,
    why: 'camelCase cannot know JetBrains is one word; googleMatch still resolves it' },
  { raw: 'Archivo-Black', family: 'Archivo', weight: 900, italic: false,
    why: 'Archivo Black is a family whose name ends in a weight word' },
  { raw: 'Bold', family: 'Bold', weight: 700, italic: false,
    why: 'nothing but style words keeps the word as the family' },
];

test('parseFaceName reads the face names sources actually produce', () => {
  for (const c of CASES) {
    const got = parseFaceName(c.raw);
    const label = `${c.raw}${c.why ? ` (${c.why})` : ''}`;
    assert.equal(got.family, c.family, `family for ${label}`);
    assert.equal(got.weight, c.weight, `weight for ${label}`);
    assert.equal(got.italic, c.italic, `italic for ${label}`);
    assert.equal(got.condensed, c.condensed, `condensed for ${label}`);
  }
});

test('parseFaceName never invents a family out of nothing', () => {
  for (const empty of ['', '   ', '""']) {
    const got = parseFaceName(empty);
    assert.equal(got.family, '', `empty in, empty out for ${JSON.stringify(empty)}`);
    assert.equal(got.weight, 400, 'CSS default weight');
    assert.equal(got.italic, false);
  }
});

test('parseFaceName omits condensed rather than reporting false', () => {
  assert.equal(Object.hasOwn(parseFaceName('Inter-Bold'), 'condensed'), false);
  assert.equal(parseFaceName('RobotoCondensed').condensed, true);
});

test('parseFaceName is not fooled by prototype keys in the name', () => {
  // The tables are plain objects and a face name is untrusted text from a
  // document, so "constructor" must be a family word like any other.
  for (const raw of ['constructor', 'toString', 'valueOf', '__proto__']) {
    const got = parseFaceName(raw);
    assert.equal(typeof got.weight, 'number', `weight stayed a number for ${raw}`);
    assert.equal(got.weight, 400, `no weight claimed for ${raw}`);
    assert.equal(typeof got.family, 'string');
  }
});

// ── Google matching ──────────────────────────────────────────────────────────

test('googleMatch folds case, spacing and punctuation', () => {
  assert.equal(googleMatch('Inter'), 'Inter');
  assert.equal(googleMatch('inter'), 'Inter');
  assert.equal(googleMatch('  INTER '), 'Inter');
  assert.equal(googleMatch('Roboto Condensed'), 'Roboto Condensed');
  assert.equal(googleMatch('RobotoCondensed'), 'Roboto Condensed');
  assert.equal(googleMatch('roboto+condensed'), 'Roboto Condensed');
  assert.equal(googleMatch('roboto-condensed'), 'Roboto Condensed');
});

test('googleMatch returns the catalogue spelling, ready for the fetch ladder', () => {
  const hit = googleMatch('jetbrains mono');
  assert.equal(hit, 'JetBrains Mono');
  assert.ok(POPULAR_FAMILIES.includes(hit as string), 'the answer is a real catalogue entry');
});

test('a mis-spaced parse still resolves, because matching ignores spacing', () => {
  const parsed = parseFaceName('JetBrainsMono-Medium');
  assert.equal(parsed.family, 'Jet Brains Mono');
  assert.equal(googleMatch(parsed.family), 'JetBrains Mono');
});

test('the whole face name is worth trying before the parsed family', () => {
  // "Archivo Black" is a family; parsing reads its last word as a weight. The
  // documented two step order recovers it.
  const raw = 'Archivo Black';
  assert.equal(googleMatch(raw), 'Archivo Black');
  assert.equal(parseFaceName(raw).family, 'Archivo');
  assert.equal(googleMatch(parseFaceName(raw).family), 'Archivo');
});

test('googleMatch resolves renames and build-tool spellings', () => {
  assert.equal(googleMatch('Source Sans Pro'), 'Source Sans 3');
  assert.equal(googleMatch('SourceSerifPro'), 'Source Serif 4');
  assert.equal(googleMatch('Muli'), 'Mulish');
  assert.equal(googleMatch('InterVariable'), 'Inter');
  assert.equal(googleMatch(parseFaceName('SourceSansPro-It').family), 'Source Sans 3');
});

test('an alias only resolves when the catalogue really has the target', () => {
  assert.equal(googleMatch('Source Sans Pro', ['Inter', 'Lato']), null);
  assert.equal(googleMatch('Source Sans Pro', ['Source Sans 3']), 'Source Sans 3');
});

test('a metric lookalike is never claimed to be the font', () => {
  // Every one of these has a widely used metric-compatible substitute. A
  // substitute is a substitute; saying "matched" would put a design system into
  // the wrong letterforms and call it right.
  const lookalikes = [
    'Helvetica', 'HelveticaNeue', 'Helvetica Neue', 'Arial', 'Arial Narrow',
    'Times New Roman', 'Times', 'Courier New', 'Calibri', 'Cambria', 'Georgia',
    'Segoe UI', 'Futura', 'Gill Sans', 'Avenir', 'Frutiger', 'Myriad Pro',
  ];
  for (const name of lookalikes) {
    assert.equal(googleMatch(name), null, `${name} must not resolve to a lookalike`);
    assert.equal(googleMatch(parseFaceName(`${name}-Bold`).family), null,
      `${name} must not resolve after parsing either`);
  }
});

test('a catalogue that genuinely carries the name wins over the lookalike table', () => {
  // The refusal is "Google has no Helvetica", not "Helvetica may never match".
  assert.equal(googleMatch('Helvetica', ['Helvetica', 'Inter']), 'Helvetica');
});

test('googleMatch says null for anything it does not have', () => {
  assert.equal(googleMatch(''), null);
  assert.equal(googleMatch('   '), null);
  assert.equal(googleMatch('Totally Made Up Face'), null);
  assert.equal(googleMatch('constructor'), null);
  assert.equal(googleMatch('toString'), null);
  assert.equal(googleMatch('__proto__'), null);
});

test('googleMatch honours a caller supplied catalogue', () => {
  const catalog = ['House Grotesk', 'House Serif'] as const;
  assert.equal(googleMatch('housegrotesk', catalog), 'House Grotesk');
  assert.equal(googleMatch('Inter', catalog), null, 'the default list is not consulted as well');
});

// ── Source honesty chips ─────────────────────────────────────────────────────

test('subset is shouted about, because reuse silently loses glyphs', () => {
  assert.deepEqual(describeFaceSource({ subset: true, embedding: 'restricted' }).chips,
    ['SUBSET', 'restricted']);
  assert.deepEqual(describeFaceSource({ subset: true }).chips, ['SUBSET', 'unknown']);
});

test('a full font gets no chip claiming it is full', () => {
  assert.deepEqual(describeFaceSource({ subset: false, embedding: 'installable' }).chips, ['installable']);
  assert.deepEqual(describeFaceSource({ embedding: 'installable' }).chips, ['installable']);
});

test('every fsType permission passes through verbatim', () => {
  for (const permission of ['installable', 'restricted', 'preview-print', 'editable', 'unknown']) {
    assert.deepEqual(describeFaceSource({ embedding: permission }).chips, [permission]);
  }
});

test('unknown stays unknown, and is never dressed up', () => {
  assert.deepEqual(describeFaceSource({}).chips, ['unknown']);
  assert.deepEqual(describeFaceSource({ embedding: '' }).chips, ['unknown']);
  assert.deepEqual(describeFaceSource({ embedding: 'unknown' }).chips, ['unknown']);
  // A word we do not recognise is a word we cannot vouch for.
  assert.deepEqual(describeFaceSource({ embedding: 'totally-fine' }).chips, ['unknown']);
  assert.deepEqual(describeFaceSource({ embedding: 'constructor' }).chips, ['unknown']);
});

test('the embedding chip is case folded, not case sensitive', () => {
  assert.deepEqual(describeFaceSource({ embedding: 'INSTALLABLE' }).chips, ['installable']);
  assert.deepEqual(describeFaceSource({ embedding: ' Preview-Print ' }).chips, ['preview-print']);
});

test('chips are exactly one embedding statement, never two and never none', () => {
  const metas = [
    {}, { subset: true }, { subset: false },
    { embedding: 'editable' }, { subset: true, embedding: 'nonsense' },
  ];
  const permissions = new Set(['installable', 'restricted', 'preview-print', 'editable', 'unknown']);
  for (const meta of metas) {
    const { chips } = describeFaceSource(meta);
    const stated = chips.filter((c) => permissions.has(c));
    assert.equal(stated.length, 1, `one embedding chip for ${JSON.stringify(meta)}`);
    assert.equal(new Set(chips).size, chips.length, 'no repeated chip');
  }
});

// ── The weight axis a NAME cannot state ──────────────────────────────────────
// The fixture is the platform's own Outfit[wght].ttf, so the reader runs against
// a real fvar table rather than a shape we invented - and against the exact file
// an upload of the shipped face would carry.

const OUTFIT_TTF = fileURLToPath(new URL('../../../public/fonts/Outfit[wght].ttf', import.meta.url));

function outfit(): ArrayBuffer {
  const b = readFileSync(OUTFIT_TTF);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}

/** A copy with one table's 4-byte tag rewritten - the cheapest way to hide a
 *  table from a reader that finds it by tag. */
function renameTable(src: ArrayBuffer, from: string, to: string): ArrayBuffer {
  const out = src.slice(0);
  const v = new DataView(out);
  const numTables = v.getUint16(4, false);
  for (let i = 0, off = 12; i < numTables && off + 16 <= out.byteLength; i++, off += 16) {
    const tag = String.fromCharCode(v.getUint8(off), v.getUint8(off + 1), v.getUint8(off + 2), v.getUint8(off + 3));
    if (tag !== from) continue;
    for (let c = 0; c < 4; c++) v.setUint8(off + c, to.charCodeAt(c));
    return out;
  }
  throw new Error(`fixture has no ${from} table - renameTable would silently do nothing`);
}

test('variableWeightRange reads the whole wght axis off a real variable font', () => {
  // Outfit's OS/2.usWeightClass says 100 (its default instance is Thin) while the
  // file carries 100 to 900. Reading only OS/2 is what pins an upload to Thin.
  assert.equal(variableWeightRange(outfit()), '100 900');
});

test('a static face has no axis, and says so rather than guessing one', () => {
  assert.equal(variableWeightRange(renameTable(outfit(), 'fvar', 'zzzz')), null);
  assert.equal(variableWeightRange(new ArrayBuffer(0)), null);
  assert.equal(variableWeightRange(new ArrayBuffer(8)), null, 'shorter than a table directory');
  // A WOFF/WOFF2 wrapper hides the table directory exactly as it hides OS/2.
  const woff2 = new Uint8Array([0x77, 0x4f, 0x46, 0x32, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(variableWeightRange(woff2.buffer as ArrayBuffer), null);
});

test('a truncated or nonsensical fvar reports nothing, never a half-read number', () => {
  const src = outfit();
  const v = new DataView(src);
  const numTables = v.getUint16(4, false);
  let fvarAt = 0;
  for (let i = 0, off = 12; i < numTables; i++, off += 16) {
    const tag = String.fromCharCode(v.getUint8(off), v.getUint8(off + 1), v.getUint8(off + 2), v.getUint8(off + 3));
    if (tag === 'fvar') { fvarAt = off; break; }
  }
  assert.ok(fvarAt, 'guard: the fixture really has an fvar table');

  // Point the table past the end of the file.
  const dangling = src.slice(0);
  new DataView(dangling).setUint32(fvarAt + 8, src.byteLength + 1024, false);
  assert.equal(variableWeightRange(dangling), null);

  // An axis record smaller than the spec's 20 bytes cannot be walked.
  const fvarOffset = v.getUint32(fvarAt + 8, false);
  const shortAxis = src.slice(0);
  new DataView(shortAxis).setUint16(fvarOffset + 10, 8, false); // axisSize
  assert.equal(variableWeightRange(shortAxis), null);

  // A range CSS cannot express is not a range we hand to a font-weight
  // descriptor: 0 is below CSS's own floor.
  const axesAt = fvarOffset + v.getUint16(fvarOffset + 4, false);
  const zeroFloor = src.slice(0);
  new DataView(zeroFloor).setInt32(axesAt + 4, 0, false); // wght min, Fixed 16.16
  assert.equal(variableWeightRange(zeroFloor), null);
});

// ── Network honesty ──────────────────────────────────────────────────────────

test('nothing in this module touches the network', () => {
  // Google Fonts is the one allowed egress in the app and it is gated behind the
  // Type room's consent. A name resolver runs before any of that, so it must be
  // able to run with fetch removed entirely.
  const realFetch = globalThis.fetch;
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: () => { throw new Error('font-resolve must not fetch'); },
  });
  try {
    const parsed = parseFaceName('ABCDEF+SourceSansPro-BoldItalic');
    assert.equal(parsed.family, 'Source Sans Pro');
    assert.equal(googleMatch(parsed.family), 'Source Sans 3');
    assert.deepEqual(describeFaceSource({ subset: true, embedding: 'editable' }).chips, ['SUBSET', 'editable']);
  } finally {
    Object.defineProperty(globalThis, 'fetch', { configurable: true, value: realFetch });
  }
});
