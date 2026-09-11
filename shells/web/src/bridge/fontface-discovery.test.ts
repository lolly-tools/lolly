// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the pure core of @font-face discovery - the url() extraction that
 * turns a CSS `src` list into a fetchable font URL. The document.styleSheets walk
 * (discoverFontFaces) is DOM-side and exercised in the browser (vector export of a
 * brand @font-face family); it returns [] with no document, which is asserted here.
 *
 * Run directly:  node --test shells/web/src/bridge/fontface-discovery.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firstFontSrcUrl, discoverFontFaces } from './fontface-discovery.ts';

test('firstFontSrcUrl: takes the first url(), skipping local()', () => {
  assert.equal(
    firstFontSrcUrl(`local("Inter"), url("/fonts/inter.woff2") format("woff2")`),
    '/fonts/inter.woff2',
  );
});

test('firstFontSrcUrl: unquoted and single-quoted url()', () => {
  assert.equal(firstFontSrcUrl('url(/f/a.ttf)'), '/f/a.ttf');
  assert.equal(firstFontSrcUrl(`url('https://x/y.woff2')`), 'https://x/y.woff2');
});

test('firstFontSrcUrl: data: URI (embedded brand face)', () => {
  assert.equal(
    firstFontSrcUrl(`url(data:font/woff2;base64,AAAA) format("woff2")`),
    'data:font/woff2;base64,AAAA',
  );
});

test('firstFontSrcUrl: null / local-only → null', () => {
  assert.equal(firstFontSrcUrl(null), null);
  assert.equal(firstFontSrcUrl(''), null);
  assert.equal(firstFontSrcUrl('local("Inter")'), null);
});

test('discoverFontFaces: no document (Node) → [] (never throws)', () => {
  assert.deepEqual(discoverFontFaces(), []);
});
