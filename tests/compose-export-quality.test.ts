// SPDX-License-Identifier: MPL-2.0
/**
 * A composed still that is being PLACED in a document renders at export quality
 * (plan 265 milestone 2, E6, closing Q5(a)).
 *
 * Run with:
 *   node --import ./tests/css-stub.mjs --test tests/compose-export-quality.test.ts
 *
 * A child rendered as a thumbnail takes preview samples and is capped at 800 px, which
 * is right for a card in the asset picker and wrong for the picture a Design image box
 * keeps. The web compose bridge decides from `_stack`: the runtime sets it while
 * resolving an asset inside a parent render, and nothing in the picker does. The
 * quality is part of the cache key, so the same child at both qualities is two entries.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { composeQuality } from '../shells/web/src/bridge/compose.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = (rel: string): string => readFileSync(resolve(root, rel), 'utf8');

test('a render inside another tool takes export quality; a picker card stays a preview', () => {
  assert.equal(composeQuality({ _stack: ['design'] }), false, 'placed inside a parent render');
  assert.equal(composeQuality({ _stack: ['design', '3d-studio'] }), false, 'and deeper in');
  assert.equal(composeQuality({}), true, 'the picker, which passes no stack');
  assert.equal(composeQuality({ _stack: [] }), true, 'an empty stack is no stack');
});

test('a caller that states the quality wins either way', () => {
  assert.equal(composeQuality({ thumbnail: true, _stack: ['design'] }), true);
  assert.equal(composeQuality({ thumbnail: false }), false);
});

test('the quality reaches the renderer and the cache key', () => {
  const compose = source('shells/web/src/bridge/compose.ts');
  assert.match(compose, /watermark: false, embedMeta: false, thumbnail, settleMs/, 'render() forwards it to renderRowToBlob');
  // The theme choices follow the quality in the key (plans/319 A6; compose-theme.test.ts).
  assert.match(compose, /cacheKey\(toolId, inputs, format, width, height, unit, dpi, thumbnail, tokenSelection\)/, 'and it is part of the cache key');
  assert.match(compose, /thumbnail \? 'preview' : 'export'/, 'the key says which one');
  assert.match(compose, /_stack: opts\._stack \?\? \[\], thumbnail,/, 'renderUrl passes its answer down');
});

test('the embed hydrator asks for export quality, because an embed is in the output', () => {
  assert.match(source('shells/web/src/bridge/embed.ts'), /thumbnail: false,/, 'resolveLollyToolUrl composes at export quality');
});
