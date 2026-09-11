// SPDX-License-Identifier: MPL-2.0
/**
 * classify-logo.ts - the pure logo classification heuristics (plan 97 section 7.3).
 *
 * Run with:
 *   node --import ./tests/css-stub.mjs --test "shells/web/src/lib/design-system/classify-logo.test.ts"
 *
 * Fixtures are hand-authored SVGs whose artwork fills the artboard, so the
 * content bounds trim-bounds.ts measures and the viewBox agree - the point of
 * each fixture is the classification, not the bounds maths (which has its own
 * suite next door).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hexToOklch, oklchToHex } from '@lolly/engine';
import { classifyLogoSvg, classifyLogoRasterStats } from './classify-logo.ts';
import type { LogoClassification } from './classify-logo.ts';

/** The four strings must stay identical to LOGO_TREATMENTS in brand-logos.ts. */
const TREATMENTS = ['primary', 'primary-reverse', 'mono', 'mono-reverse'];

/** Every classification is well formed, whatever it decided. */
function assertShape(c: LogoClassification | null): asserts c is LogoClassification {
  assert.ok(c, 'expected a classification');
  assert.ok(c.orientation === 'horizontal' || c.orientation === 'vertical');
  assert.ok(TREATMENTS.includes(c.treatment), `unknown treatment ${c.treatment}`);
  assert.ok(c.confidence >= 0 && c.confidence <= 1, `confidence out of range: ${c.confidence}`);
  assert.ok(c.reasons.length >= 3, 'one reason per judgment at least');
  for (const r of c.reasons) {
    assert.ok(r.length > 0 && r.length <= 60, `reason not chip-sized: ${r}`);
    assert.ok(!r.includes('-'), `em-dash in reason: ${r}`);
    assert.ok(!/'s\b/.test(r), `possessive in reason: ${r}`);
  }
}

const svg = (viewBox: string, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>`;

// A wide two-colour wordmark: red block + blue block filling a 4:1 artboard.
const WIDE_TWO_COLOUR = svg('0 0 400 100',
  '<rect x="0" y="0" width="200" height="100" fill="#d62828"/>'
  + '<rect x="200" y="0" width="200" height="100" fill="#0057b7"/>');

// A stacked one-ink mark: a single green block on a taller-than-wide artboard.
const TALL_ONE_INK = svg('0 0 120 200',
  '<rect x="0" y="0" width="120" height="200" fill="#1b5e20"/>');

// A white mark, drawn for a dark ground.
const WHITE_INK = svg('0 0 300 100',
  '<rect x="0" y="0" width="300" height="100" fill="#ffffff"/>');

// 1.4:1 - inside the band between the two orientation thresholds.
const AMBIGUOUS = svg('0 0 140 100',
  '<rect x="0" y="0" width="140" height="100" fill="#1b5e20"/>');

test('wide two-colour wordmark reads horizontal primary', () => {
  const c = classifyLogoSvg(WIDE_TWO_COLOUR);
  assertShape(c);
  assert.equal(c.orientation, 'horizontal');
  assert.equal(c.treatment, 'primary');
  assert.ok(c.confidence >= 0.8, `expected a confident read, got ${c.confidence}`);
  assert.ok(c.reasons.some(r => r.includes('wide content bounds')), c.reasons.join(' | '));
  assert.ok(c.reasons.includes('2 ink hues'), c.reasons.join(' | '));
  assert.ok(c.reasons.includes('dark ink, reads on light'), c.reasons.join(' | '));
});

test('tall single-ink mark reads vertical mono', () => {
  const c = classifyLogoSvg(TALL_ONE_INK);
  assertShape(c);
  assert.equal(c.orientation, 'vertical');
  assert.equal(c.treatment, 'mono');
  assert.ok(c.confidence >= 0.8, `expected a confident read, got ${c.confidence}`);
  assert.ok(c.reasons.some(r => r.includes('tall content bounds')), c.reasons.join(' | '));
  assert.ok(c.reasons.includes('1 ink hue'), c.reasons.join(' | '));
});

test('white ink reads as a reverse treatment, mono by ink count', () => {
  const c = classifyLogoSvg(WHITE_INK);
  assertShape(c);
  assert.equal(c.orientation, 'horizontal');
  assert.equal(c.treatment, 'mono-reverse');
  assert.ok(c.reasons.includes('neutral inks only'), c.reasons.join(' | '));
  assert.ok(c.reasons.includes('light ink, reads on dark'), c.reasons.join(' | '));
});

test('two light hues read as primary-reverse', () => {
  const c = classifyLogoSvg(svg('0 0 400 100',
    '<rect x="0" y="0" width="200" height="100" fill="#ffd3d3"/>'
    + '<rect x="200" y="0" width="200" height="100" fill="#d3e6ff"/>'));
  assertShape(c);
  assert.equal(c.treatment, 'primary-reverse');
});

test('near-square artwork is judged horizontal but at low confidence', () => {
  const c = classifyLogoSvg(AMBIGUOUS);
  assertShape(c);
  assert.equal(c.orientation, 'horizontal');
  assert.ok(c.confidence < 0.75, `expected an unconfident read, got ${c.confidence}`);
  assert.ok(c.reasons.some(r => r.includes('between wide and square')), c.reasons.join(' | '));
});

test('tints of one hue are one ink, not two', () => {
  const base = hexToOklch('#0057b7');
  assert.ok(base);
  const tint = oklchToHex({ ...base, l: base.l + 0.25 });
  const c = classifyLogoSvg(svg('0 0 400 100',
    `<rect x="0" y="0" width="200" height="100" fill="#0057b7"/>`
    + `<rect x="200" y="0" width="200" height="100" fill="${tint}"/>`));
  assertShape(c);
  assert.equal(c.treatment, 'mono');
  assert.ok(c.reasons.includes('1 ink hue'), c.reasons.join(' | '));
});

test('colours in a style block count as ink', () => {
  const c = classifyLogoSvg(svg('0 0 400 100',
    '<style>.a{fill:#d62828}.b{fill:#0057b7}</style>'
    + '<rect class="a" x="0" y="0" width="200" height="100"/>'
    + '<rect class="b" x="200" y="0" width="200" height="100"/>'));
  assertShape(c);
  assert.equal(c.treatment, 'primary');
});

test('named CSS colours are read as ink', () => {
  const c = classifyLogoSvg(svg('0 0 400 100',
    '<rect x="0" y="0" width="200" height="100" fill="crimson"/>'
    + '<rect x="200" y="0" width="200" height="100" fill="navy"/>'));
  assertShape(c);
  assert.equal(c.treatment, 'primary');
  assert.ok(c.reasons.includes('2 ink hues'), c.reasons.join(' | '));
});

test('no bounds from content falls back to the artboard and says so', () => {
  const c = classifyLogoSvg('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="120"></svg>');
  assertShape(c);
  assert.equal(c.orientation, 'horizontal');
  assert.ok(c.reasons.includes('bounds from artboard, not content'), c.reasons.join(' | '));
  assert.ok(c.reasons.includes('no inks found'), c.reasons.join(' | '));
  assert.ok(c.confidence < 0.75, `guesswork should not read confident, got ${c.confidence}`);
});

test('unparseable input classifies as nothing', () => {
  assert.equal(classifyLogoSvg(''), null);
  assert.equal(classifyLogoSvg('not markup at all'), null);
  assert.equal(classifyLogoSvg('{"kind":"json"}'), null);
  assert.equal(classifyLogoSvg('<html><body><p>hello</p></body></html>'), null);
  assert.equal(classifyLogoSvg(undefined as unknown as string), null);
  assert.equal(classifyLogoSvg(42 as unknown as string), null);
});

// ─── Raster stats ─────────────────────────────────────────────────────────────

test('raster stats: wide two-colour mark on transparency reads horizontal primary', () => {
  const c = classifyLogoRasterStats({
    width: 800, height: 200,
    colors: [{ hex: '#d62828', weight: 60 }, { hex: '#0057b7', weight: 40 }],
    transparentShare: 0.72, lightShare: 0,
  });
  assertShape(c);
  assert.equal(c.orientation, 'horizontal');
  assert.equal(c.treatment, 'primary');
  assert.ok(c.confidence >= 0.8, `got ${c.confidence}`);
});

test('raster stats: light ink on transparency reads mono-reverse', () => {
  const c = classifyLogoRasterStats({
    width: 512, height: 512,
    colors: [{ hex: '#ffffff', weight: 90 }, { hex: '#f2f2f2', weight: 10 }],
    transparentShare: 0.8, lightShare: 1,
  });
  assertShape(c);
  assert.equal(c.orientation, 'vertical');
  assert.equal(c.treatment, 'mono-reverse');
});

test('raster stats: a baked-in background lowers confidence and says why', () => {
  const opaque = classifyLogoRasterStats({
    width: 800, height: 200,
    colors: [{ hex: '#d62828', weight: 60 }, { hex: '#0057b7', weight: 40 }],
    transparentShare: 0, lightShare: 0,
  });
  const cut = classifyLogoRasterStats({
    width: 800, height: 200,
    colors: [{ hex: '#d62828', weight: 60 }, { hex: '#0057b7', weight: 40 }],
    transparentShare: 0.72, lightShare: 0,
  });
  assertShape(opaque);
  assert.ok(opaque.reasons.includes('no transparency, background baked in'), opaque.reasons.join(' | '));
  assert.ok(opaque.confidence < cut.confidence, `${opaque.confidence} should be under ${cut.confidence}`);
});

test('raster stats: empty colour census still classifies, unconfidently', () => {
  const c = classifyLogoRasterStats({
    width: 300, height: 100, colors: [], transparentShare: 1, lightShare: 0,
  });
  assertShape(c);
  assert.equal(c.orientation, 'horizontal');
  assert.ok(c.reasons.includes('no inks found'), c.reasons.join(' | '));
  assert.ok(c.confidence < 0.75, `got ${c.confidence}`);
});

test('raster stats: zero dimensions do not throw or produce a wild confidence', () => {
  const c = classifyLogoRasterStats({
    width: 0, height: 0,
    colors: [{ hex: '#1b5e20', weight: 1 }],
    transparentShare: 0.5, lightShare: 0,
  });
  assertShape(c);
  assert.ok(c.reasons.includes('no content bounds found'), c.reasons.join(' | '));
});

test('raster stats: junk entries in the census are skipped', () => {
  const c = classifyLogoRasterStats({
    width: 800, height: 200,
    colors: [
      { hex: '#d62828', weight: 60 },
      { hex: 'not-a-colour', weight: 30 },
      { hex: '#0057b7', weight: 0 },
      null as unknown as { hex: string; weight: number },
    ],
    transparentShare: 0.7, lightShare: 0,
  });
  assertShape(c);
  assert.equal(c.treatment, 'mono');
  assert.ok(c.reasons.includes('1 ink hue'), c.reasons.join(' | '));
});
