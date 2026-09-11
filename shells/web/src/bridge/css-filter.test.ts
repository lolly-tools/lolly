// SPDX-License-Identifier: MPL-2.0
/**
 * CSS `filter` → SVG primitive translation (bridge/css-filter.ts).
 *
 * The spec defines each CSS shorthand filter AS an SVG filter, so these assertions
 * are against the spec's own matrices and transfer functions rather than against
 * anything measured by eye. Getting one wrong is not a subtle shift - a bad
 * `contrast` intercept inverts mid-tones - but it is invisible in a screenshot diff,
 * which is why the numbers are pinned here instead.
 *
 * The other half of the contract is the null return: a chain containing anything we
 * do not understand must be refused WHOLE, so the caller can raster it. Emitting the
 * recognisable half would be a confidently wrong picture.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCssFilter, isDropShadowOnly } from './css-filter.ts';

const only = (v: string) => {
  const p = parseCssFilter(v);
  assert.ok(p, `expected ${v} to parse`);
  assert.equal(p.length, 1, `expected one primitive from ${v}`);
  return p[0]!;
};

test('none and empty produce no primitives', () => {
  assert.deepEqual(parseCssFilter('none'), []);
  assert.deepEqual(parseCssFilter(''), []);
});

test('blur maps 1:1 - CSS blur(N) is stdDeviation N', () => {
  // Deliberately different from backdrop-filter and box-shadow, which are N/2. The
  // three conventions are the easiest thing in this area to get wrong.
  assert.deepEqual(only('blur(6px)'), { kind: 'blur', stdDeviation: 6 });
  assert.deepEqual(only('blur(0px)'), { kind: 'blur', stdDeviation: 0 });
});

test('grayscale(1) is the luminance matrix', () => {
  const p = only('grayscale(1)') as { kind: 'colorMatrix'; values: number[] };
  assert.equal(p.kind, 'colorMatrix');
  // Every row becomes the luminance coefficients: full grey.
  assert.deepEqual(p.values.slice(0, 3).map(n => Math.round(n * 10000) / 10000), [0.2126, 0.7152, 0.0722]);
  assert.deepEqual(p.values.slice(5, 8).map(n => Math.round(n * 10000) / 10000), [0.2126, 0.7152, 0.0722]);
});

test('grayscale(0) and saturate(1) are the identity', () => {
  for (const v of ['grayscale(0)', 'saturate(1)', 'saturate(100%)']) {
    const p = only(v) as { values: number[] };
    const id = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
    assert.deepEqual(p.values.map(n => Math.round(n * 10000) / 10000), id, v);
  }
});

test('percentages and unitless amounts are the same thing', () => {
  assert.deepEqual(only('grayscale(50%)'), only('grayscale(0.5)'));
  assert.deepEqual(only('brightness(150%)'), only('brightness(1.5)'));
});

test('an omitted amount uses the CSS default, not zero', () => {
  // filter: grayscale() means grayscale(1) - defaulting to 0 would silently no-op.
  assert.deepEqual(only('grayscale()'), only('grayscale(1)'));
  assert.deepEqual(only('invert()'), only('invert(1)'));
});

test('contrast is slope c with intercept -(0.5c)+0.5, so mid-grey stays put', () => {
  const p = only('contrast(2)') as { slope: number; intercept: number };
  assert.equal(p.slope, 2);
  assert.equal(p.intercept, -0.5);
  // The property that matters: 0.5 maps to 0.5 at any contrast.
  for (const c of [0.5, 1, 2, 4]) {
    const q = only(`contrast(${c})`) as { slope: number; intercept: number };
    assert.equal(Math.round((0.5 * q.slope + q.intercept) * 10000) / 10000, 0.5, `contrast(${c})`);
  }
});

test('brightness is a pure slope', () => {
  assert.deepEqual(only('brightness(1.5)'), { kind: 'componentTransfer', mode: 'linear', slope: 1.5, intercept: 0 });
});

test('opacity touches only the alpha channel', () => {
  assert.deepEqual(only('opacity(0.4)'), { kind: 'componentTransfer', mode: 'alpha', amount: 0.4 });
});

test('hue-rotate accepts deg, rad and turn', () => {
  assert.deepEqual(only('hue-rotate(90deg)'), { kind: 'hueRotate', deg: 90 });
  assert.equal(Math.round((only('hue-rotate(1turn)') as { deg: number }).deg), 360);
  assert.equal(Math.round((only('hue-rotate(3.14159rad)') as { deg: number }).deg), 180);
});

test('a chain keeps its order - filters are not commutative', () => {
  const p = parseCssFilter('grayscale(1) blur(2px) brightness(1.2)');
  assert.ok(p);
  assert.deepEqual(p.map(x => x.kind), ['colorMatrix', 'blur', 'componentTransfer']);
});

test('drop-shadow is skipped, because the walker draws it as geometry', () => {
  assert.deepEqual(parseCssFilter('drop-shadow(0 2px 4px black)'), []);
  const p = parseCssFilter('blur(2px) drop-shadow(0 2px 4px black)');
  assert.deepEqual(p?.map(x => x.kind), ['blur']);
  assert.equal(isDropShadowOnly('drop-shadow(0 2px 4px black)'), true);
  assert.equal(isDropShadowOnly('drop-shadow(0 1px 1px red) drop-shadow(0 2px 2px blue)'), true);
  assert.equal(isDropShadowOnly('blur(2px) drop-shadow(0 2px 4px black)'), false);
  assert.equal(isDropShadowOnly('none'), false);
});

test('an unknown function refuses the WHOLE chain', () => {
  // Half a chain is a confidently wrong picture; null sends it to the raster hatch.
  assert.equal(parseCssFilter('blur(2px) frobnicate(3)'), null);
  assert.equal(parseCssFilter('url(#myfilter)'), null);
  assert.equal(parseCssFilter('blur(2px) url(#myfilter)'), null);
});

test('a clamped amount never produces a negative or non-finite value', () => {
  for (const v of ['blur(-5px)', 'saturate(-1)', 'brightness(-2)', 'grayscale(500%)',
                   'invert(-1)', 'opacity(9)', 'blur(abc)', 'contrast(abc)']) {
    const p = parseCssFilter(v);
    assert.ok(p, v);
    const nums = JSON.stringify(p).match(/-?\d+(\.\d+)?/g) ?? [];
    assert.ok(nums.every(n => Number.isFinite(Number.parseFloat(n))), `${v} → ${JSON.stringify(p)}`);
    if (p[0] && p[0].kind === 'blur') assert.ok(p[0].stdDeviation >= 0, `${v} produced a negative blur`);
  }
});
