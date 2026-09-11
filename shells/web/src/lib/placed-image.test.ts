// SPDX-License-Identifier: MPL-2.0
/**
 * lib/placed-image.ts - the pure decisions the preflight stage collector makes
 * about each placed <img>. Both were bugs found in the export-preflight modal:
 * a data-URI src rendered as a wall of base64 in a finding, and a vector logo was
 * measured as a low-DPI raster ("will look soft") when it carries through export
 * as vector.
 *
 * Run directly:  node --test shells/web/src/lib/placed-image.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { placedImageLabel, isVectorImageSrc } from './placed-image.ts';

test('placedImageLabel prefers alt, then aria-label', () => {
  assert.equal(placedImageLabel('Company logo', 'ignored', 'https://x/logo.png'), 'Company logo');
  assert.equal(placedImageLabel('', 'Fallback name', 'https://x/logo.png'), 'Fallback name');
  assert.equal(placedImageLabel(null, null, 'https://cdn.example.com/path/hero.jpg?v=3'), 'hero.jpg');
});

test('placedImageLabel never returns the base64 tail of a data: URI', () => {
  // The regression: a data URI's mime type carries a '/', so split('/').pop()
  // returned the whole base64 payload. It must fall through to the generic label.
  const dataUri = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==';
  assert.equal(placedImageLabel(null, null, dataUri), 'An image');
  assert.equal(placedImageLabel(null, null, 'blob:https://app.lolly/9e02-uuid'), 'An image');
  // …but a real alt still wins over the fallback for a data URI.
  assert.equal(placedImageLabel('Geeko', null, dataUri), 'Geeko');
});

test('placedImageLabel honours a custom fallback', () => {
  assert.equal(placedImageLabel(null, null, 'data:image/png;base64,AAAA', 'Untitled'), 'Untitled');
});

test('isVectorImageSrc detects SVG data URIs and .svg URLs', () => {
  assert.equal(isVectorImageSrc('data:image/svg+xml;base64,PHN2Zy8+'), true);
  assert.equal(isVectorImageSrc('data:image/svg+xml,%3Csvg/%3E'), true);
  assert.equal(isVectorImageSrc('/catalog/assets/suse/logo/primary.svg'), true);
  assert.equal(isVectorImageSrc('https://cdn.example.com/mark.SVG?rev=2'), true);
  assert.equal(isVectorImageSrc('https://cdn.example.com/mark.svg#icon'), true);
});

test('isVectorImageSrc treats rasters and unknowable blobs as non-vector', () => {
  assert.equal(isVectorImageSrc('data:image/png;base64,AAAA'), false);
  assert.equal(isVectorImageSrc('https://x/photo.jpg'), false);
  assert.equal(isVectorImageSrc('/assets/svg-icon-set.png'), false, 'a .png with "svg" in the stem is raster');
  // A blob: object URL carries no type - reported non-vector, so the caller still
  // measures it (pre-existing behaviour), never worse than before.
  assert.equal(isVectorImageSrc('blob:https://app.lolly/abc-123'), false);
});
