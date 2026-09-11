// SPDX-License-Identifier: MPL-2.0
/**
 * The export walkers' colour entry points, against the forms a browser actually
 * hands them.
 *
 * This is a regression suite for a silent-data-loss bug: all three walkers used
 * to parse computed colour with a legacy `rgba?(int,int,int)` regex, on the
 * assumption (written in the code) that getComputedStyle always returns
 * rgb()/rgba(). CSS Color 4 makes that false - only rgb()/rgba()/hsl() are
 * legacy; lab(), lch(), oklab(), oklch(), hwb() and color() serialise in their
 * own space. So a computed `color-mix(in oklab, …)` (deck-builder tables, slides
 * slots, rebrand-deck panels) or a raw `oklch()` brand token
 * (shells/web/src/brand-vars.ts injects them as tool CSS custom properties)
 * parsed to null - and null means "skip the fill" or "fall back to black" in the
 * walkers, so those paints vanished or turned black in SVG/PDF/EMF export.
 *
 * The cases below are the shapes browsers emit for those inputs. Every one of
 * them returned null before engine/src/css-color.ts. See plans/60-color-spaces.md section 4.
 *
 * Run directly:  node --test shells/web/src/bridge/export-color.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBoxShadow, parseTextShadow } from '@lolly/engine';
import { parseCssColor, parseCssColorFull } from './export-css.ts';
import { parseSvgColor, gradStopToRgb } from './export-pdf-vector.ts';
import { parseColor as parseEmfColor } from './svg-ir.ts';

// The computed forms that used to drop paint, with the sRGB bytes they mean.
//
// Every string here is VERBATIM `getComputedStyle` output from Chrome 149
// (captured with playwright against the CSS the deck tools and brand-vars.ts
// actually produce), not a hand-written guess at the serialisation. Note that
// Chrome writes lab()/lch() lightness as a BARE number, not a percentage.
const MODERN: Array<[css: string, rgb: [number, number, number]]> = [
  ['oklch(0.7 0.1 200)', [64, 177, 183]],          // `color: oklch(…)` - a raw brand token
  ['oklab(0 0 0 / 0.1)', [0, 0, 0]],               // color-mix(in oklab, currentColor 10%, transparent)
  ['oklab(0.539974 0.0962086 -0.0928316)', [140, 83, 162]], // a color-mix'd gradient stop
  ['color(srgb 0.5 0 0.5)', [128, 0, 128]],        // color-mix(in srgb, red 50%, blue)
  ['color(srgb 1 0 0)', [255, 0, 0]],
  ['color(srgb-linear 1 0 0)', [255, 0, 0]],
  ['lab(54.29 80.8 69.89)', [255, 0, 0]],          // bare L, as Chrome writes it
  ['lch(54.29 106.84 40.86)', [255, 0, 0]],
  ['oklab(0.628 0.225 0.126)', [255, 0, 0]],
  // Percent-lightness spellings arrive from stylesheet text rather than computed
  // values (the SVG walker reads attributes too), so both must parse.
  ['lab(54.29% 80.8 69.89)', [255, 0, 0]],
  ['oklch(62.8% 0.2577 29.23)', [255, 0, 0]],
  ['hwb(0 0% 0%)', [255, 0, 0]],
  ['rgb(255 0 0)', [255, 0, 0]],                   // modern syntax, legacy space
  ['rgb(255 0 0 / 50%)', [255, 0, 0]],
];

test('the SVG/PDF walkers: modern colour notations resolve instead of dropping out', () => {
  for (const [css, rgb] of MODERN) {
    assert.deepEqual(parseCssColor(css), rgb, css);
  }
});

test('the SVG/PDF walkers: alpha survives the modern notations', () => {
  assert.deepEqual(parseCssColorFull('rgb(255 0 0 / 50%)'), [255, 0, 0, 0.5]);
  assert.deepEqual(parseCssColorFull('oklab(0.628 0.225 0.126 / 0.25)'), [255, 0, 0, 0.25]);
  assert.deepEqual(parseCssColorFull('color(srgb 1 0 0 / 0.1)'), [255, 0, 0, 0.1]);
  // A fully transparent colour is still "nothing to paint" - the walkers' `if
  // (rgb)` guards depend on it.
  assert.equal(parseCssColorFull('color(srgb 1 0 0 / 0)'), null);
  assert.equal(parseCssColorFull('transparent'), null);
});

test('the PDF vector walker resolves modern notations and named colours', () => {
  for (const [css, rgb] of MODERN) {
    assert.deepEqual(parseSvgColor(css), rgb, css);
  }
  // The 148-name table moved into the engine; nothing regressed with it.
  assert.deepEqual(parseSvgColor('navy'), [0, 0, 128]);
  assert.deepEqual(parseSvgColor('rebeccapurple'), [102, 51, 153]);
  assert.deepEqual(parseSvgColor('#f0a'), [255, 0, 170]);
  assert.equal(parseSvgColor('none'), null);
  assert.equal(parseSvgColor('transparent'), null);
  assert.equal(parseSvgColor(null), null);
});

test('the EMF walker resolves modern notations, and still flattens currentColor to black', () => {
  for (const [css, rgb] of MODERN) {
    assert.deepEqual(parseEmfColor(css), rgb, css);
  }
  assert.deepEqual(parseEmfColor('currentColor'), [0, 0, 0]);
  assert.deepEqual(parseEmfColor('steelblue'), [70, 130, 180]);
  assert.equal(parseEmfColor('none'), null);
  assert.equal(parseEmfColor(''), null);
  assert.equal(parseEmfColor(undefined), null);
});

test('a wide-gamut paint is gamut-mapped, not clipped or dropped', () => {
  // P3 red is outside sRGB. The walkers must still get a colour - and one that
  // is still red, rather than a channel-clipped or blacked-out one.
  const rgb = parseCssColor('color(display-p3 1 0 0)');
  assert.ok(rgb, 'P3 red resolves');
  assert.equal(rgb[0], 255);
  assert.ok(rgb[1] < 60 && rgb[2] < 60, `still red: ${JSON.stringify(rgb)}`);
  assert.deepEqual(parseSvgColor('color(display-p3 1 0 0)'), rgb);
  assert.deepEqual(parseEmfColor('color(display-p3 1 0 0)'), rgb);
});

test('a modern colour inside a shadow shorthand is read as the colour, not as offsets', () => {
  // The failure this pins was worse than a lost colour: an unrecognised
  // `oklch(0.7 0.1 200)` stayed in the string, so 0.7/0.1/200 were consumed as
  // x/y/blur - a 200px blur on a 2px shadow. The value is Chrome 149's verbatim
  // computed box-shadow for `box-shadow: oklch(0.7 0.1 200) 0px 2px 4px`.
  const [shadow] = parseBoxShadow('oklch(0.7 0.1 200) 0px 2px 4px 0px');
  assert.ok(shadow);
  assert.equal(shadow.color, 'oklch(0.7 0.1 200)');
  assert.deepEqual([shadow.x, shadow.y, shadow.blur, shadow.spread], [0, 2, 4, 0]);

  const [text] = parseTextShadow('color(srgb 0 0 0 / 0.4) 1px 1px 3px');
  assert.ok(text);
  assert.equal(text.color, 'color(srgb 0 0 0 / 0.4)');
  assert.deepEqual([text.x, text.y, text.blur], [1, 1, 3]);

  // inset is still stripped before the colour search, and a named colour still wins.
  const [inset] = parseBoxShadow('inset navy 0px 2px 4px');
  assert.ok(inset);
  assert.equal(inset.color, 'navy');
  assert.equal(inset.inset, true);
});

test('a modern colour survives a PDF gradient stop', () => {
  // Chrome computes a color-mix'd gradient stop into the mix space, so this is
  // what the walker reads out of `background-image`.
  assert.deepEqual(gradStopToRgb('oklab(0.539974 0.0962086 -0.0928316)', 0, 2), [140, 83, 162]);
  assert.deepEqual(gradStopToRgb('oklab(0.628 0.225 0.126)', 0, 2), [255, 0, 0]);
  assert.deepEqual(gradStopToRgb('color(srgb 1 0 0) 20%', 0, 2), [255, 0, 0]);
  assert.deepEqual(gradStopToRgb('#ff0000', 0, 2), [255, 0, 0]);
  assert.deepEqual(gradStopToRgb('navy', 0, 2), [0, 0, 128]);
});

test('unreadable input is still null everywhere - null must never mean black', () => {
  for (const css of ['', 'garbage', 'rgb(', 'color(bogus 1 1 1)', 'color-mix(in oklab, red, blue)']) {
    assert.equal(parseCssColor(css), null, `export-css: ${css}`);
    assert.equal(parseSvgColor(css), null, `pdf: ${css}`);
    assert.equal(parseEmfColor(css), null, `emf: ${css}`);
  }
});
