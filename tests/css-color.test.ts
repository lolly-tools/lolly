// SPDX-License-Identifier: MPL-2.0
/**
 * engine/src/css-color.ts - the CSS Color 4 colour value.
 *
 * Three things are pinned here:
 *
 *   1. PARSING every form the spec defines, including the non-legacy ones whose
 *      absence silently dropped paint from SVG/PDF/EMF export (see
 *      plans/60-color-spaces.md §4). The reference hexes come from the spec's own
 *      equivalence examples where it gives them, otherwise from converting a
 *      known sRGB colour into the space and back.
 *   2. CONVERSION being lossless: every one of the 14 spaces round-trips a set
 *      of sRGB colours byte-exactly. That is a strong check on the primary
 *      matrices and transfer functions together - a wrong constant anywhere
 *      shows up as drift.
 *   3. GAMUT MAPPING invariants: in-gamut input untouched, out-of-gamut input
 *      landing inside [0,1] while staying perceptually near the request.
 *
 * Run directly:  node --test tests/css-color.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseColor, parseColorToSrgb8, convertColor, gamutMapSrgb,
  colorToSrgb, colorToHexString, formatColor, isNamedColor,
  MISSING_C0, MISSING_C1, MISSING_C2, MISSING_ALPHA,
} from '../engine/src/css-color.ts';
import type { ColorSpaceTag } from '../engine/src/css-color.ts';

const hexOf = (css: string): string | null => {
  const c = parseColor(css);
  return c ? colorToHexString(c) : null;
};

// ── Parsing: the legacy forms (which always worked) ──────────────────────────

test('hex in every length, including alpha', () => {
  assert.equal(hexOf('#f0a'), '#ff00aa');
  assert.equal(hexOf('#F0A'), '#ff00aa');
  assert.equal(hexOf('#ff00aa'), '#ff00aa');
  assert.equal(hexOf('#ff00aa80'), '#ff00aa80');
  assert.equal(hexOf('#f0a8'), '#ff00aa88');
  assert.equal(hexOf('#12345'), null);   // not a valid length
  assert.equal(hexOf('#gggggg'), null);
});

test('legacy comma syntax: rgb / rgba / hsl / hsla', () => {
  assert.equal(hexOf('rgb(255, 0, 170)'), '#ff00aa');
  assert.equal(hexOf('rgba(255, 0, 170, 0.5)'), '#ff00aa80');
  assert.equal(hexOf('hsl(0, 100%, 50%)'), '#ff0000');
  assert.equal(hexOf('hsla(0, 100%, 50%, 0.5)'), '#ff000080');
});

test('named colours, and only real ones', () => {
  assert.equal(hexOf('rebeccapurple'), '#663399');
  assert.equal(hexOf('RED'), '#ff0000');
  assert.equal(hexOf('darkslategrey'), '#2f4f4f');
  assert.equal(hexOf('notacolor'), null);
  assert.ok(isNamedColor('Chartreuse'));
  assert.ok(!isNamedColor('chartreux'));
  // Prototype keys must not read as colours (the enum-whitelist trap).
  assert.ok(!isNamedColor('constructor'));
  assert.equal(hexOf('constructor'), null);
});

// ── Parsing: the modern forms (the ones that used to drop paint) ─────────────

test('modern space-separated syntax with slash alpha', () => {
  assert.equal(hexOf('rgb(255 0 170)'), '#ff00aa');
  assert.equal(hexOf('rgb(255 0 170 / 50%)'), '#ff00aa80');
  assert.equal(hexOf('rgb(100% 0% 66.67%)'), '#ff00aa');
  assert.equal(hexOf('hsl(322 100% 50%)'), '#ff00a1');
  assert.equal(hexOf('hsl(322deg 100% 50% / 0.5)'), '#ff00a180');
  // Mixing comma and space separators is invalid CSS and must not parse.
  assert.equal(hexOf('rgb(1 2, 3)'), null);
});

test('hwb()', () => {
  assert.equal(hexOf('hwb(0 0% 0%)'), '#ff0000');
  assert.equal(hexOf('hwb(0 100% 0%)'), '#ffffff');
  assert.equal(hexOf('hwb(0 0% 100%)'), '#000000');
  // w + b >= 100% collapses to the grey at their ratio.
  assert.equal(hexOf('hwb(120 50% 50%)'), '#808080');
});

test('lab() and lch() — CSS Color 4 sRGB-red equivalents', () => {
  assert.equal(hexOf('lab(54.29% 80.8 69.89)'), '#ff0000');
  assert.equal(hexOf('lch(54.29% 106.84 40.86)'), '#ff0000');
  assert.equal(hexOf('lab(100% 0 0)'), '#ffffff');
  assert.equal(hexOf('lab(0% 0 0)'), '#000000');
});

test('oklab() and oklch(), percent and bare lightness', () => {
  assert.equal(hexOf('oklab(0.628 0.225 0.126)'), '#ff0000');
  assert.equal(hexOf('oklab(62.8% 0.225 0.126)'), '#ff0000');
  // The two lightness spellings mean the same thing (100% = 1).
  assert.equal(hexOf('oklch(70% 0.1 200)'), hexOf('oklch(0.7 0.1 200)'));
  // Chroma as a percentage is of 0.4 (§7.3).
  assert.equal(hexOf('oklch(70% 25% 200)'), hexOf('oklch(70% 0.1 200)'));
});

test('color() with every predefined space we accept', () => {
  assert.equal(hexOf('color(srgb 1 0 0.666667)'), '#ff00aa');
  assert.equal(hexOf('color(srgb-linear 1 0 0)'), '#ff0000');
  assert.equal(hexOf('color(display-p3 0 0 0)'), '#000000');
  assert.equal(hexOf('color(xyz 0 0 0)'), '#000000');
  for (const space of ['display-p3', 'a98-rgb', 'prophoto-rgb', 'rec2020', 'xyz-d50', 'xyz-d65']) {
    assert.ok(parseColor(`color(${space} 0.5 0.4 0.3)`), `${space} parses`);
  }
  // An unknown / deliberately unsupported space is NOT silently flattened.
  assert.equal(parseColor('color(aces2065-1 1 1 1)'), null);
  assert.equal(parseColor('color(bogus 1 1 1)'), null);
});

test('hue accepts every CSS angle unit', () => {
  const red = hexOf('hsl(0 100% 50%)');
  assert.equal(hexOf('hsl(360deg 100% 50%)'), red);
  assert.equal(hexOf('hsl(1turn 100% 50%)'), red);
  assert.equal(hexOf('hsl(400grad 100% 50%)'), red);
  assert.equal(hexOf('hsl(6.283185rad 100% 50%)'), red);
  // Out-of-range hues wrap rather than failing.
  assert.equal(hexOf('hsl(-360 100% 50%)'), red);
});

// ── Keywords and non-colours ────────────────────────────────────────────────

test('transparent parses as zero-alpha black; parseColorToSrgb8 reports nothing to paint', () => {
  const t = parseColor('transparent');
  assert.ok(t);
  assert.equal(t.alpha, 0);
  assert.equal(parseColorToSrgb8('transparent'), null);
  assert.equal(parseColorToSrgb8('rgba(1,2,3,0)'), null);
});

test('currentColor and non-paint keywords return null, never black', () => {
  for (const v of ['currentColor', 'currentcolor', 'inherit', 'initial', 'unset', 'none']) {
    assert.equal(parseColor(v), null, `${v} is not a colour value`);
  }
});

test('color-mix() and relative syntax are not our job (a browser resolves them first)', () => {
  assert.equal(parseColor('color-mix(in oklab, red, blue)'), null);
  assert.equal(parseColor('rgb(from red r g b)'), null);
});

test('malformed input returns null and never throws', () => {
  for (const v of ['', '   ', 'rgb(', 'rgb()', 'rgb(1)', 'rgb(1 2)', 'rgb(1 2 3 4 5)',
    'oklch(1 2)', 'lab(1 2 3 / 4 / 5)', 'color(srgb 1 0)', 'color(srgb)',
    'rgb(nested(1) 2 3)', 'red;background:url(//evil)', 'expression(alert(1))',
    null, undefined]) {
    assert.equal(parseColor(v as string), null, `${JSON.stringify(v)} is not a colour`);
  }
});

// ── Missing components ──────────────────────────────────────────────────────

test('`none` components are tracked, behave as zero, and serialise back as none', () => {
  const c = parseColor('oklch(none 0.1 none / none)');
  assert.ok(c);
  assert.equal(c.missing, MISSING_C0 | MISSING_C2 | MISSING_ALPHA);
  assert.deepEqual(c.components, [0, 0.1, 0]);
  // No `none%` - a missing component carries no unit.
  assert.equal(formatColor(c), 'oklch(none 0.1 none / none)');
  const rgb = parseColor('rgb(none 128 none)');
  assert.ok(rgb);
  assert.equal(rgb.missing, MISSING_C0 | MISSING_C2);
  assert.equal(colorToHexString(rgb), '#008000');
});

// ── Conversion ──────────────────────────────────────────────────────────────

const ALL_SPACES: ColorSpaceTag[] = [
  'srgb', 'srgb-linear', 'display-p3', 'a98-rgb', 'prophoto-rgb', 'rec2020',
  'hsl', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'xyz-d50', 'xyz-d65',
];

test('every space round-trips sRGB byte-exactly', () => {
  for (const hex of ['#ff0000', '#00ff00', '#0000ff', '#30ba78', '#123456',
    '#ffffff', '#000000', '#7f7f7f', '#fedcba']) {
    const base = parseColor(hex)!;
    for (const space of ALL_SPACES) {
      const back = colorToHexString(convertColor(convertColor(base, space), 'srgb'));
      assert.equal(back, hex, `${hex} via ${space}`);
    }
  }
});

test('a same-space convert is the identity', () => {
  const c = parseColor('oklch(70% 0.1 200)')!;
  assert.equal(convertColor(c, 'oklch'), c);
});

test('P3 red converts to the published out-of-gamut sRGB coordinates', () => {
  // colorjs.io / the CSS Color 4 sample code both give [1.0931, -0.2267, -0.1501].
  const raw = convertColor(parseColor('color(display-p3 1 0 0)')!, 'srgb').components;
  assert.ok(Math.abs(raw[0] - 1.0931) < 5e-4, `r ${raw[0]}`);
  assert.ok(Math.abs(raw[1] - -0.2267) < 5e-4, `g ${raw[1]}`);
  assert.ok(Math.abs(raw[2] - -0.1501) < 5e-4, `b ${raw[2]}`);
});

test('wide-gamut values keep their real coordinates rather than being clamped on parse', () => {
  const c = parseColor('color(display-p3 1 0 0)')!;
  assert.equal(c.space, 'display-p3');
  assert.deepEqual(c.components, [1, 0, 0]);
  // …and serialise back in their own space, so an SVG paint can carry them.
  assert.equal(formatColor(c), 'color(display-p3 1 0 0)');
});

test('formatColor round-trips through parseColor', () => {
  for (const css of ['#f0a', '#ff00aa80', 'oklch(70% 0.1 200)', 'lab(54.29% 80.8 69.89)',
    'lch(54.29% 106.84 40.86)', 'oklab(0.628 0.225 0.126)', 'hsl(322 100% 50% / 0.25)',
    'hwb(120 20% 30%)', 'color(display-p3 1 0 0)', 'color(rec2020 0.5 0.4 0.3)',
    'color(prophoto-rgb 0.5 0.2 0.1)', 'color(xyz-d50 0.4 0.2 0.6)']) {
    const c = parseColor(css)!;
    const again = parseColor(formatColor(c));
    assert.ok(again, `${css} → ${formatColor(c)} re-parses`);
    assert.equal(colorToHexString(again), colorToHexString(c), css);
  }
});

// ── Gamut mapping ───────────────────────────────────────────────────────────

test('an in-gamut colour is returned untouched', () => {
  const rgb: [number, number, number] = [0.2, 0.4, 0.9];
  assert.deepEqual(gamutMapSrgb(rgb), rgb);
});

test('out-of-gamut colour lands inside sRGB, near the request, hue preserved', () => {
  for (const css of ['color(display-p3 1 0 0)', 'color(display-p3 0 1 0)',
    'color(rec2020 1 1 0)', 'oklch(0.9 0.4 140)', 'color(prophoto-rgb 1 0 1)']) {
    const mapped = colorToSrgb(parseColor(css)!);
    for (const v of mapped) {
      assert.ok(v >= 0 && v <= 1, `${css} → ${JSON.stringify(mapped)} is in range`);
    }
    // Same hue family: the mapped colour must be closer to the request than the
    // achromatic axis is (chroma reduction, not a desaturating collapse).
    const wanted = convertColor(parseColor(css)!, 'oklch').components;
    const got = convertColor(
      { space: 'srgb', components: mapped, alpha: 1, missing: 0 }, 'oklch',
    ).components;
    assert.ok(Math.abs(((got[2] - wanted[2] + 540) % 360) - 180) < 12,
      `${css} keeps its hue (wanted ${wanted[2]}, got ${got[2]})`);
    assert.ok(got[1] > 0.05, `${css} keeps real chroma (got ${got[1]})`);
  }
});

test('extreme lightness short-circuits to white / black', () => {
  assert.deepEqual(gamutMapSrgb([2, 2, 2]), [1, 1, 1]);
  assert.deepEqual(gamutMapSrgb([-1, -1, -1]), [0, 0, 0]);
});

// ── The walkers' entry point ────────────────────────────────────────────────

test('parseColorToSrgb8 gives bytes + alpha, and null for nothing-to-paint', () => {
  assert.deepEqual(parseColorToSrgb8('#ff00aa'), [255, 0, 170, 1]);
  assert.deepEqual(parseColorToSrgb8('rgb(255 0 170 / 50%)'), [255, 0, 170, 0.5]);
  // An 8-digit hex's alpha byte survives as a byte-exact fraction.
  assert.deepEqual(parseColorToSrgb8('#ff00aa80'), [255, 0, 170, 128 / 255]);
  assert.equal(parseColorToSrgb8('transparent'), null);
  assert.equal(parseColorToSrgb8('garbage'), null);
});
