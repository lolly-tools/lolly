// SPDX-License-Identifier: MPL-2.0
/**
 * anim-detect contract tests - the decision table that decides whether a picked
 * asset gets the Play (live playback) affordance.
 *
 * Run with: node --test shells/web/src/lib/anim-detect.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { svgMarkupAnimated, precheckAnimatedRef, svgLoopMs } from './anim-detect.ts';

// ── svgMarkupAnimated ────────────────────────────────────────────────────────

test('static SVG markup is not animated', () => {
  assert.equal(svgMarkupAnimated('<svg xmlns="http://www.w3.org/2000/svg"><rect width="4" height="4" fill="#f00"/></svg>'), false);
  assert.equal(svgMarkupAnimated(''), false);
});

test('CSS @keyframes marks an SVG animated (the lolly-spin shape)', () => {
  const markup = '<svg><style>@keyframes spin { to { transform: rotate(360deg) } } .s { animation: spin 9s linear infinite }</style><g class="s"/></svg>';
  assert.equal(svgMarkupAnimated(markup), true);
});

test('an animation declaration in a style attribute counts', () => {
  assert.equal(svgMarkupAnimated('<svg><g style="animation: drift 3s infinite"/></svg>'), true);
  assert.equal(svgMarkupAnimated('<svg><g style="animation-name: drift"/></svg>'), true);
});

test('SMIL elements count; lookalike element names do not', () => {
  assert.equal(svgMarkupAnimated('<svg><rect><animate attributeName="x" dur="1s"/></rect></svg>'), true);
  assert.equal(svgMarkupAnimated('<svg><animateTransform attributeName="transform" dur="2s"/></svg>'), true);
  assert.equal(svgMarkupAnimated('<svg><set attributeName="fill" to="#000"/></svg>'), true);
  // "animateX"/"settings" must not match as <animate>/<set>.
  assert.equal(svgMarkupAnimated('<svg><animateXcustom/><settings/></svg>'), false);
});

test('a plain mention of the word animation in text content does not count', () => {
  assert.equal(svgMarkupAnimated('<svg><text>no animation here</text></svg>'), false);
});

// ── precheckAnimatedRef ──────────────────────────────────────────────────────

test('null / url-less / still refs are not playable', () => {
  assert.equal(precheckAnimatedRef(null), null);
  assert.equal(precheckAnimatedRef({ type: 'raster', format: 'png' }), null);
  assert.equal(precheckAnimatedRef({ type: 'raster', format: 'jpg', url: 'blob:x' }), null);
});

test('video refs are playable by type or by container format', () => {
  assert.deepEqual(precheckAnimatedRef({ type: 'video', format: 'mp4', url: 'blob:v' }), { kind: 'video', url: 'blob:v' });
  assert.deepEqual(precheckAnimatedRef({ type: 'raster', format: 'webm', url: 'blob:v2' }), { kind: 'video', url: 'blob:v2' });
});

test('meta.animated rasters are playable only where ImageDecoder exists', () => {
  const ref = { type: 'raster', format: 'gif', url: 'blob:g', meta: { animated: true } };
  assert.deepEqual(precheckAnimatedRef(ref, { canDecodeRaster: true }), { kind: 'raster', url: 'blob:g' });
  // No decoder → the asset stays a still, exactly as before this feature.
  assert.equal(precheckAnimatedRef(ref, { canDecodeRaster: false }), null);
  assert.equal(precheckAnimatedRef(ref), null);
});

test('SVG / vector refs defer to a markup sniff', () => {
  assert.equal(precheckAnimatedRef({ type: 'vector', format: 'svg', url: 'blob:s' }), 'svg-check');
  assert.equal(precheckAnimatedRef({ type: 'raster', format: 'svg', url: 'blob:s2' }), 'svg-check');
});

test('lottie refs are not classified playable (deliberately deferred)', () => {
  assert.equal(precheckAnimatedRef({ type: 'lottie', format: 'json', url: 'blob:l' }), null);
});

// ── svgLoopMs ────────────────────────────────────────────────────────────────

test('svgLoopMs: one forever-repeating SMIL track is the loop', () => {
  const m = '<svg><g><animateTransform attributeName="transform" type="rotate" dur="8s" repeatCount="indefinite" values="0 1 1;4 1 1;0 1 1"/></g></svg>';
  assert.equal(svgLoopMs(m), 8000);
});

test('svgLoopMs: several tracks loop together at their least common multiple', () => {
  const m = '<svg><animateTransform dur="2s" repeatCount="indefinite"/><animateTransform dur="3000ms" repeatCount="indefinite"/></svg>';
  assert.equal(svgLoopMs(m), 6000);
  // A track that plays once has no loop to join, so it does not stretch the answer.
  assert.equal(svgLoopMs('<svg><animateTransform dur="2s" repeatCount="indefinite"/><animateTransform dur="7s"/></svg>'), 2000);
});

test('svgLoopMs: clock values, repeatDur and CSS infinite shorthands count', () => {
  assert.equal(svgLoopMs('<svg><animateTransform dur="00:00:05" repeatDur="indefinite"/></svg>'), 5000);
  assert.equal(svgLoopMs('<svg><animateTransform dur="1.5" repeatCount="indefinite"/></svg>'), 1500);
  assert.equal(svgLoopMs('<svg><style>.a { animation: spin 4s linear infinite } .b { animation: pulse 500ms infinite, fade 2s }</style></svg>'), 4000);
});

test('svgLoopMs: nothing that repeats forever means no loop', () => {
  assert.equal(svgLoopMs(''), 0);
  assert.equal(svgLoopMs('<svg><rect width="1" height="1"/></svg>'), 0);
  assert.equal(svgLoopMs('<svg><animateTransform dur="3s" repeatCount="2"/></svg>'), 0);
});

test('svgLoopMs: parts that never realign report the longest part, not an absurd length', () => {
  const m = '<svg><animateTransform dur="9.97s" repeatCount="indefinite"/><animateTransform dur="7.03s" repeatCount="indefinite"/></svg>';
  assert.equal(svgLoopMs(m), 9970);
});
