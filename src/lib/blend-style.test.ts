// SPDX-License-Identifier: MPL-2.0
/*
 * The shared blend vocabulary - lib/blend-style.ts.
 *
 * Run directly:  node --test shells/web/src/lib/blend-style.test.ts
 *
 * Two surfaces offer this choice (the canvas gradient panel and Colour Lab's blend
 * ramp), and the point of a three-word vocabulary is that it means the same thing in
 * both. So the drift guard below reads the *other* surface's source and checks it is
 * still spelling the buttons from here rather than from its own inline list.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { BLEND_STYLES, HUE_ROUTES, isPolarSpace, cssInterpolation } from './blend-style.ts';
import { parseGradientSpec, formatGradientSpec, DEFAULT_GRADIENT_SPACE } from '@lolly/engine';

test('every style names a space the gradient spec can round-trip', () => {
  for (const b of BLEND_STYLES) {
    // A spec is the wire form these end up in, so a style whose space the grammar
    // cannot write is a style that silently degrades on the way to a URL.
    const spec = parseGradientSpec(`lin.${b.space}_90_30ba78-0_efefef-100`);
    assert.ok(spec, `${b.space} parses in a spec`);
    assert.equal(spec!.space, b.space);
    // The spec's own default space is omitted from the wire form (that is the point
    // of having one), so only a non-default space is named on the way back out.
    const wire = formatGradientSpec(spec!);
    assert.match(
      wire,
      b.space === DEFAULT_GRADIENT_SPACE ? /^lin_/ : new RegExp(`^lin\\.${b.space}_`),
      `writes back: ${wire}`);
    assert.equal(parseGradientSpec(wire)!.space, b.space, 'and re-reads as the same space');
  }
});

test('the labels are the ones the canvas panel settled on', () => {
  assert.deepEqual(BLEND_STYLES.map(b => b.label), ['Smooth', 'Vivid', 'sRGB']);
  assert.deepEqual(BLEND_STYLES.map(b => b.space), ['oklab', 'oklch', 'srgb']);
  assert.deepEqual(HUE_ROUTES.map(r => r.label), ['Short', 'Long way']);
  // Every option carries a reason, since they are rendered as title text.
  for (const b of BLEND_STYLES) assert.ok(b.why.length > 20, `${b.label} says why`);
});

test('only the polar spaces admit a hue route', () => {
  for (const s of ['oklch', 'lch', 'hsl'] as const) assert.equal(isPolarSpace(s), true, s);
  for (const s of ['oklab', 'lab', 'srgb', 'srgb-linear', 'xyz-d65'] as const) {
    assert.equal(isPolarSpace(s), false, s);
  }
});

test('the CSS fragment omits the default route and never states one CSS would reject', () => {
  // `shorter` is CSS's default - writing it is noise.
  assert.equal(cssInterpolation('oklch'), 'in oklch');
  assert.equal(cssInterpolation('oklch', 'shorter'), 'in oklch');
  assert.equal(cssInterpolation('oklch', 'longer'), 'in oklch longer hue');
  assert.equal(cssInterpolation('lch', 'increasing'), 'in lch increasing hue');
  // A hue route on a rectangular space makes the whole gradient invalid, so it is
  // dropped rather than passed through.
  assert.equal(cssInterpolation('oklab', 'longer'), 'in oklab');
  assert.equal(cssInterpolation('srgb', 'longer'), 'in srgb');
});

test('the canvas gradient panel still spells its buttons from here', () => {
  // free-canvas is an orchestrator plus feature modules under views/free-canvas/ (2026-09-09 split)
  const fcDir = new URL('../views/free-canvas/', import.meta.url);
  const src = [readFileSync(new URL('../views/free-canvas.ts', import.meta.url), 'utf8'), ...readdirSync(fcDir).filter((n) => n.endsWith('.ts')).sort().map((n) => readFileSync(new URL(n, fcDir), 'utf8'))].join('\n');
  assert.match(src, /from '(?:\.\.\/)+lib\/blend-style\.ts'/, 'imports the vocabulary');
  assert.match(src, /BLEND_STYLES\.map/, 'renders the space buttons from it');
  assert.match(src, /HUE_ROUTES\.map/, 'and the hue route buttons');
  // The inline list this replaced, in either surface, is the drift this guards.
  assert.doesNotMatch(src, /\['oklab', t\('Smooth'\)\]/, 'no inline copy of the labels');
});
