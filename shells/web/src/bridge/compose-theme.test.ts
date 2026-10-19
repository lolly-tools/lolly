// SPDX-License-Identifier: MPL-2.0
/**
 * The compose bridge and theme choices (plans/319 A6): the render cache key and the
 * canonical embed id a pasted tool link is stored under. The rendering itself is
 * checked in a real browser by tests/theme-choices-offscreen.browser.test.ts.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/bridge/compose-theme.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cacheKey, composeEmbedId } from './compose.ts';
import { parseEmbedUrl, parseUrlState } from '@lolly/engine';

const DARK = { '': 'dark' };
const PERSIMMON = { '': 'light', colourway: 'persimmon' };

test('the theme choices are part of the render cache key, and absent choices keep the old key', () => {
  const base = cacheKey('qr-code', { url: 'x' }, 'svg', 100, 100, 'px', undefined, false);
  assert.equal(base, 'qr-code|{"url":"x"}|svg|100pxx100@|export', 'a child with no choices keys exactly as before');
  const dark = cacheKey('qr-code', { url: 'x' }, 'svg', 100, 100, 'px', undefined, false, DARK);
  const persimmon = cacheKey('qr-code', { url: 'x' }, 'svg', 100, 100, 'px', undefined, false, PERSIMMON);
  assert.notEqual(dark, base);
  assert.notEqual(dark, persimmon, 'a theme switch is never answered from the cache');
  assert.equal(
    cacheKey('qr-code', {}, 'svg', 1, 1, 'px', undefined, true, { colourway: 'a', '': 'dark' }),
    cacheKey('qr-code', {}, 'svg', 1, 1, 'px', undefined, true, { '': 'dark', colourway: 'a' }),
    'the same choices in any key order are one entry',
  );
});

test('a link\'s own `_themes` stays in its canonical id and reads back', () => {
  const id = composeEmbedId({ toolId: 'qr-code', format: 'svg', query: 'url=x&_themes=%7B%22%22%3A%22dark%22%7D&format=png', tokenSelection: DARK, width: 200 });
  assert.ok(id);
  const parsed = parseEmbedUrl(id!);
  assert.ok(parsed, 'the id parses back as an embed');
  assert.deepEqual(parseUrlState(parsed!.query, { id: 'qr-code', inputs: [{ id: 'url', type: 'text' }] } as never).tokenSelection, DARK);
  assert.doesNotMatch(id!, /format=/, 'export-control params still drop out');
});

test('a link without choices keeps the id it always had', () => {
  assert.equal(composeEmbedId({ toolId: 'qr-code', format: 'svg', query: 'url=x', width: 200 }), 'https://lolly.tools/tool/qr-code.svg?url=x&w=200');
  assert.equal(composeEmbedId({ toolId: 'qr-code', format: 'svg', query: 'url=x', tokenSelection: {}, width: 200 }), 'https://lolly.tools/tool/qr-code.svg?url=x&w=200', 'an empty map is no choice');
});
