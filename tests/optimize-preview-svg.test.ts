/**
 * Unit tests for the pure preview-SVG optimisation helpers.
 * Run with: node --test tests/optimize-preview-svg.test.ts
 *
 * These cover the string half (comment strip + embedded-raster find/replace); the
 * pixel downscaling lives in scripts/build-previews.ts behind a real browser canvas
 * and is exercised by `npm run previews`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  stripSvgComments, listEmbeddedRasters, substituteDataUris, MIN_RASTER_URI_CHARS,
} from '../scripts/optimize-preview-svg.ts';

test('stripSvgComments removes comments but keeps graphics', () => {
  const svg = '<svg><!-- a template note --><rect/><!--\n multiline\n --><path d="M0 0"/></svg>';
  const out = stripSvgComments(svg);
  assert.equal(out.includes('<!--'), false);
  assert.equal(out.includes('template note'), false);
  assert.ok(out.includes('<rect/>'));
  assert.ok(out.includes('<path d="M0 0"/>'));
});

test('stripSvgComments is a no-op when there are no comments', () => {
  const svg = '<svg><rect/></svg>';
  assert.equal(stripSvgComments(svg), svg);
});

test('listEmbeddedRasters finds large image data-URIs via href and xlink:href, deduped', () => {
  const big = 'data:image/jpeg;base64,' + 'A'.repeat(MIN_RASTER_URI_CHARS);
  const svg =
    `<svg xmlns:xlink="#">` +
    `<image href="${big}"/>` +
    `<image xlink:href="${big}"/>` +      // same URI, second ref → deduped
    `</svg>`;
  const found = listEmbeddedRasters(svg);
  assert.deepEqual(found, [big]);
});

test('listEmbeddedRasters ignores small inlined marks and non-data hrefs', () => {
  const small = 'data:image/png;base64,' + 'A'.repeat(100);
  const svg = `<svg><image href="${small}"/><image href="/catalog/assets/logo.svg"/></svg>`;
  assert.deepEqual(listEmbeddedRasters(svg), []);
});

test('listEmbeddedRasters never matches embedded vector SVGs (must stay resolution-independent)', () => {
  const vec = 'data:image/svg+xml;base64,' + 'A'.repeat(MIN_RASTER_URI_CHARS * 2); // huge, but vector
  assert.deepEqual(listEmbeddedRasters(`<svg><image href="${vec}"/></svg>`), []);
});

test('substituteDataUris replaces every occurrence when the replacement is smaller', () => {
  const oldU = 'data:image/jpeg;base64,' + 'A'.repeat(1000);
  const newU = 'data:image/jpeg;base64,' + 'B'.repeat(10);
  const svg = `<svg><image href="${oldU}"/><image href="${oldU}"/></svg>`;
  const out = substituteDataUris(svg, { [oldU]: newU });
  assert.equal(out.includes(oldU), false);
  assert.equal(out.split(newU).length - 1, 2); // both refs swapped
});

test('substituteDataUris keeps the original when the replacement is not smaller', () => {
  const oldU = 'data:image/png;base64,' + 'A'.repeat(100);
  const bigger = 'data:image/png;base64,' + 'B'.repeat(200);
  const svg = `<svg><image href="${oldU}"/></svg>`;
  assert.equal(substituteDataUris(svg, { [oldU]: bigger }), svg);
});
