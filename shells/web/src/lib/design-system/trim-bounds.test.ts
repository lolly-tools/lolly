// SPDX-License-Identifier: MPL-2.0
/**
 * Run with: node --import ./tests/css-stub.mjs --test "shells/web/src/lib/design-system/trim-bounds.test.ts"
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { svgContentBounds, trimSvgToContent, rasterAlphaBounds, rasterContentBounds } from './trim-bounds.ts';

test('svgContentBounds unions a rect and a path, ignoring the wider artboard', () => {
  const svg = `<svg viewBox="0 0 200 200" width="200" height="200">
    <rect x="50" y="60" width="40" height="30" />
    <path d="M100 100 L140 100 L140 140 Z" />
  </svg>`;
  assert.deepEqual(svgContentBounds(svg), { x: 50, y: 60, width: 90, height: 80 });
});

test('svgContentBounds folds nested translate + scale group transforms', () => {
  const svg = `<svg viewBox="0 0 100 100">
    <g transform="translate(10,10)">
      <g transform="scale(2)">
        <rect x="1" y="1" width="2" height="3" />
      </g>
    </g>
  </svg>`;
  assert.deepEqual(svgContentBounds(svg), { x: 12, y: 12, width: 4, height: 6 });
});

test('svgContentBounds ignores defs-only content', () => {
  const svg = `<svg viewBox="0 0 50 50"><defs><rect x="0" y="0" width="10" height="10"/></defs></svg>`;
  assert.equal(svgContentBounds(svg), null);
});

test('svgContentBounds ignores display:none and visibility:hidden elements', () => {
  const svg = `<svg viewBox="0 0 50 50">
    <rect x="0" y="0" width="10" height="10" style="display:none"/>
    <circle cx="30" cy="30" r="2" visibility="hidden"/>
    <rect x="20" y="20" width="5" height="5"/>
  </svg>`;
  assert.deepEqual(svgContentBounds(svg), { x: 20, y: 20, width: 5, height: 5 });
});

test('svgContentBounds returns null when nothing is measurable', () => {
  assert.equal(svgContentBounds('<svg viewBox="0 0 10 10"></svg>'), null);
});

test('trimSvgToContent rewrites the viewBox to tight bounds and strips width/height', () => {
  const svg = `<svg viewBox="0 0 200 200" width="200" height="200">
    <rect x="50" y="60" width="40" height="30" />
    <path d="M100 100 L140 100 L140 140 Z" />
  </svg>`;
  const trimmed = trimSvgToContent(svg);
  assert.ok(trimmed);
  assert.deepEqual(trimmed.box, { x: 50, y: 60, width: 90, height: 80 });
  assert.match(trimmed.svg, /viewBox="50 60 90 80"/);
  const rootTag = /<svg\b[^>]*>/i.exec(trimmed.svg)![0];
  assert.doesNotMatch(rootTag, /\swidth\s*=/);
  assert.doesNotMatch(rootTag, /\sheight\s*=/);
});

test('trimSvgToContent applies padding symmetrically', () => {
  const svg = `<svg viewBox="0 0 200 200">
    <rect x="50" y="60" width="40" height="30" />
    <path d="M100 100 L140 100 L140 140 Z" />
  </svg>`;
  const trimmed = trimSvgToContent(svg, { pad: 5 });
  assert.ok(trimmed);
  assert.deepEqual(trimmed.box, { x: 45, y: 55, width: 100, height: 90 });
});

test('trimSvgToContent injects a viewBox on a root with none, from width/height only', () => {
  const svg = `<svg width="100" height="100"><rect x="10" y="10" width="20" height="20"/></svg>`;
  const trimmed = trimSvgToContent(svg);
  assert.ok(trimmed);
  assert.deepEqual(trimmed.box, { x: 10, y: 10, width: 20, height: 20 });
  assert.match(trimmed.svg, /viewBox="10 10 20 20"/);
});

test('trimSvgToContent returns null when nothing is measurable', () => {
  assert.equal(trimSvgToContent('<svg viewBox="0 0 10 10"></svg>'), null);
});

test('trimSvgToContent returns null when the viewBox is already tight', () => {
  const svg = `<svg viewBox="0 0 40 30"><rect x="0" y="0" width="40" height="30"/></svg>`;
  assert.deepEqual(svgContentBounds(svg), { x: 0, y: 0, width: 40, height: 30 });
  assert.equal(trimSvgToContent(svg), null);
});

test('trimSvgToContent returns null within the 0.5-unit tolerance', () => {
  const svg = `<svg viewBox="0.2 -0.3 39.8 30.3"><rect x="0" y="0" width="40" height="30"/></svg>`;
  assert.equal(trimSvgToContent(svg), null);
});

function makeRgba(width: number, height: number, on: Array<[number, number, number]>): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  for (const [x, y, a] of on) {
    const i = (y * width + x) * 4;
    data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = a;
  }
  return data;
}

test('rasterAlphaBounds finds a centered opaque blob', () => {
  const on: Array<[number, number, number]> = [];
  for (let y = 4; y <= 5; y++) for (let x = 4; x <= 5; x++) on.push([x, y, 255]);
  const data = makeRgba(10, 10, on);
  assert.deepEqual(rasterAlphaBounds(data, 10, 10), { x: 4, y: 4, width: 2, height: 2 });
});

test('rasterAlphaBounds finds a single edge-touching pixel', () => {
  const data = makeRgba(5, 5, [[0, 4, 255]]);
  assert.deepEqual(rasterAlphaBounds(data, 5, 5), { x: 0, y: 4, width: 1, height: 1 });
});

test('rasterAlphaBounds returns null for a fully transparent image', () => {
  const data = new Uint8Array(4 * 4 * 4);
  assert.equal(rasterAlphaBounds(data, 4, 4), null);
});

test('rasterAlphaBounds respects alphaMin', () => {
  const data = makeRgba(4, 4, [[2, 2, 10]]);
  assert.deepEqual(rasterAlphaBounds(data, 4, 4), { x: 2, y: 2, width: 1, height: 1 });
  assert.equal(rasterAlphaBounds(data, 4, 4, { alphaMin: 20 }), null);
});

// ── rasterContentBounds: flat white/black margins count as margin too ─────────

/** Opaque frame filled with `bg`, with `ink` pixels painted at the given spots. */
function makeFlat(width: number, height: number, bg: [number, number, number], ink: Array<[number, number, [number, number, number]]>): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = bg[0]; data[i * 4 + 1] = bg[1]; data[i * 4 + 2] = bg[2]; data[i * 4 + 3] = 255;
  }
  for (const [x, y, [r, g, b]] of ink) {
    const i = (y * width + x) * 4;
    data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
  }
  return data;
}

test('rasterContentBounds trims flat white margins around dark ink', () => {
  const ink: Array<[number, number, [number, number, number]]> = [];
  for (let y = 3; y <= 6; y++) for (let x = 2; x <= 7; x++) ink.push([x, y, [20, 20, 20]]);
  const data = makeFlat(10, 10, [255, 255, 255], ink);
  assert.deepEqual(rasterContentBounds(data, 10, 10), { x: 2, y: 3, width: 6, height: 4 });
});

test('rasterContentBounds trims flat black margins around light ink', () => {
  const data = makeFlat(8, 8, [0, 0, 0], [[3, 3, [240, 240, 240]], [5, 4, [200, 60, 60]]]);
  assert.deepEqual(rasterContentBounds(data, 8, 8), { x: 3, y: 3, width: 3, height: 2 });
});

test('rasterContentBounds tolerates JPEG-ish noise in a white margin', () => {
  const ink: Array<[number, number, [number, number, number]]> = [[4, 4, [10, 10, 10]]];
  // Noisy near-white margin pixels (within the flat-background distance) stay margin.
  ink.push([0, 2, [251, 253, 250]], [7, 6, [248, 252, 253]]);
  const data = makeFlat(9, 9, [254, 254, 254], ink);
  assert.deepEqual(rasterContentBounds(data, 9, 9), { x: 4, y: 4, width: 1, height: 1 });
});

test('rasterContentBounds leaves a flat brand-colour card alone (alpha scan only)', () => {
  // Red background is not white/black, so the whole opaque frame is content.
  const data = makeFlat(6, 6, [200, 30, 30], [[2, 2, [255, 255, 255]]]);
  assert.deepEqual(rasterContentBounds(data, 6, 6), { x: 0, y: 0, width: 6, height: 6 });
});

test('rasterContentBounds falls back to the alpha scan when a corner is transparent', () => {
  const on: Array<[number, number, number]> = [[3, 3, 255]];
  const data = makeRgba(8, 8, on);
  // Paint white onto the opaque pixel so a (wrong) bg pass would erase it.
  const i = (3 * 8 + 3) * 4;
  data[i] = 255; data[i + 1] = 255; data[i + 2] = 255;
  assert.deepEqual(rasterContentBounds(data, 8, 8), { x: 3, y: 3, width: 1, height: 1 });
});

test('rasterContentBounds returns null for an entirely flat white frame', () => {
  const data = makeFlat(5, 5, [255, 255, 255], []);
  assert.equal(rasterContentBounds(data, 5, 5), null);
});
