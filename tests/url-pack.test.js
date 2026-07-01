// SPDX-License-Identifier: MPL-2.0
// Contract tests for packed URL state (engine/src/url-pack.js).
//
// The invariant that matters: decode(encode(x)) === x for ANY query string, so a
// packed link is a lossless carrier of the exact readable query — including the
// compact block encoding (`~`/`,` delimiters, %-escaped values) that the sync
// parser later depends on. Packing is threshold-gated by the caller, so these also
// pin the "packing loses on tiny inputs" reality that makes the gate necessary.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  packQuery, unpackToken, expandQuery, hasPackedState, isPackAvailable, PACK_PARAM,
} from '../engine/src/url-pack.js';
import { parseUrlState } from '../engine/src/url-mode.js';

// A representative large Layout-Studio-style query: compact tilde/comma blocks with
// %-encoded text values and hex colours. This is exactly the shape url-mode.js emits.
const BOXES = Array.from({ length: 24 }, (_, i) =>
  [`b${i}`, ['box', 'text', 'image'][i % 3], 90 + i * 37, 120 + i * 29, 320, 200,
    (i % 7) * 15 - 45, ['rect', 'rounded', 'pill', 'ellipse'][i % 4], 16,
    ['30BA78', '2453ff', '0c322c'][i % 3], 100, '', 'cover', 'normal',
    i % 3 === 1 ? encodeURIComponent(`Headline, number ${i}`) : '',
    '0c322c', 48, 'center', 'middle', '700', '', ''].join(','),
).join('~');
const BIG_QUERY = `background=ffffff&boxes=${BOXES}&format=png&w=1080&h=1080`;

test('packQuery/unpackToken round-trips a large query byte-for-byte', async () => {
  const token = await packQuery(BIG_QUERY);
  assert.ok(token, 'codec should be available in the test runtime');
  assert.equal(token[0], '1', 'tag byte marks the deflate-raw codec');
  assert.match(token, /^[A-Za-z0-9_-]+$/, 'token is URL-safe (no % escaping needed)');
  assert.ok(token.length < BIG_QUERY.length, 'large query gets meaningfully smaller');
  assert.equal(await unpackToken(token), BIG_QUERY);
});

test('round-trip preserves compact block delimiters and %-encoded values exactly', async () => {
  // Decode the packed form, then parse it — the boxes must come back intact, proving
  // the pack layer is transparent to the compact-block encoding the parser relies on.
  const token = await packQuery(BIG_QUERY);
  const decoded = await unpackToken(token);
  assert.equal(decoded, BIG_QUERY);
  const manifest = {
    inputs: [
      { id: 'background', type: 'color' },
      { id: 'boxes', type: 'blocks', fields: [
        { id: 'id', type: 'text' }, { id: 'kind', type: 'text' },
        { id: 'x', type: 'number' }, { id: 'y', type: 'number' },
      ] },
    ],
  };
  const state = parseUrlState(decoded, manifest);
  assert.equal(state.values.boxes.length, 24);
  assert.equal(state.values.boxes[0].id, 'b0');
  assert.equal(state.format, 'png');
});

test('expandQuery with only a z param returns the decoded query verbatim', async () => {
  const token = await packQuery(BIG_QUERY);
  const expanded = await expandQuery(`${PACK_PARAM}=${token}`);
  assert.equal(expanded, BIG_QUERY);
});

test('expandQuery overlays sibling flag params AFTER the packed base (they win)', async () => {
  // A packed base carrying format=png, plus a readable override + a bare flag.
  const token = await packQuery('color=30BA78&format=png');
  const expanded = await expandQuery(`${PACK_PARAM}=${token}&format=svg&export`);
  const sp = new URLSearchParams(expanded);
  assert.equal(sp.getAll('format').at(-1), 'svg', 'later duplicate overrides (parseUrlState is last-wins)');
  assert.ok(sp.has('export'), 'bare on-visit flag survives outside the pack');
  assert.equal(sp.get('color'), '30BA78', 'base state from the pack is present');
});

test('expandQuery is a no-op on an ordinary (unpacked) query', async () => {
  const q = 'color=30BA78&theme=dark';
  assert.equal(await expandQuery(q), q);
  assert.equal(await expandQuery(''), '');
});

test('unpackToken rejects an unknown codec tag and garbage', async () => {
  const token = await packQuery('a=1');
  assert.equal(await unpackToken('9' + token.slice(1)), null, 'unknown tag → null');
  assert.equal(await unpackToken('1@@@not-base64@@@'), null, 'garbage payload → null');
  assert.equal(await unpackToken(''), null);
  assert.equal(await unpackToken('1'), null, 'tag with no payload → null');
});

test('expandQuery leaves an undecodable z in place (loads at defaults, no throw)', async () => {
  const q = `${PACK_PARAM}=1@@@corrupt@@@`;
  assert.equal(await expandQuery(q), q); // reserved → parser ignores it
});

test('hasPackedState / isPackAvailable', async () => {
  assert.equal(isPackAvailable(), true, 'CompressionStream present in the test runtime');
  const token = await packQuery('a=1');
  assert.equal(hasPackedState(`${PACK_PARAM}=${token}`), true);
  assert.equal(hasPackedState('a=1&b=2'), false);
  assert.equal(hasPackedState(''), false);
});

test('unpackToken refuses a decompression bomb (output over the size cap)', async () => {
  // Pack a payload larger than the 256 KB inflate cap; the token is tiny (deflate
  // crushes the repetition), but unpacking must abort rather than allocate it.
  const bomb = 'a'.repeat(400 * 1024);
  const token = await packQuery(bomb);
  assert.ok(token && token.length < 2048, 'bomb packs to a small token');
  assert.equal(await unpackToken(token), null, 'over-cap inflation is rejected');
});

test('packing is NOT unconditionally smaller (why the caller must gate on length)', async () => {
  const small = 'url=https%3A%2F%2Fsuse.com&color=0c322c';
  const token = await packQuery(small);
  const packedLen = `${PACK_PARAM}=${token}`.length;
  assert.ok(packedLen > small.length, 'a tiny query gets LONGER when packed — gate on length');
});
