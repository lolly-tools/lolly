// SPDX-License-Identifier: MPL-2.0
/**
 * The raster backdrop for a one-artboard export (plan 291 M3b, export-bg). A transparent
 * request clears the canvas root's own background, and leaves a page root's fill alone,
 * because a `[data-pdf-page]` artboard's `bg` is the slide's content. The pixels are
 * pinned end to end by tests/design-frame-export-bg.browser.test.ts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { EXPORT_PAGE_ATTR, exportRootIsPage, rasterBackdrop } from './export-backdrop.ts';

const el = (attrs: string[]): { hasAttribute(name: string): boolean } => ({ hasAttribute: (name) => attrs.includes(name) });

test('a page root is recognised by the per-page export marker', () => {
  assert.equal(EXPORT_PAGE_ATTR, 'data-pdf-page');
  assert.equal(exportRootIsPage(el(['data-pdf-page', 'data-frame-id'])), true);
  assert.equal(exportRootIsPage(el(['data-export-root'])), false);
  assert.equal(exportRootIsPage(null), false);
  assert.equal(exportRootIsPage(undefined), false);
  assert.equal(exportRootIsPage({}), false);
});

test('a transparent request keeps a page root\'s own fill and adds no colour behind the page', () => {
  assert.deepEqual(rasterBackdrop('transparent', true), { clearRoot: false });
});

test('a transparent request still clears a canvas root, as before', () => {
  assert.deepEqual(rasterBackdrop('transparent', false), { clearRoot: true });
});

test('a colour request fills behind either root and never clears it', () => {
  assert.deepEqual(rasterBackdrop('#ffffff', true), { bgcolor: '#ffffff', clearRoot: false });
  assert.deepEqual(rasterBackdrop('#102030', false), { bgcolor: '#102030', clearRoot: false });
});

test('no request leaves the root alone', () => {
  assert.deepEqual(rasterBackdrop(undefined, true), { clearRoot: false });
  assert.deepEqual(rasterBackdrop(null, false), { clearRoot: false });
});
