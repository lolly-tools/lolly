// SPDX-License-Identifier: MPL-2.0
// Contract tests for packed URL state (engine/src/url-pack.ts).
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
} from '../engine/src/url-pack.ts';
import { parseUrlState } from '../engine/src/url-mode.ts';
import type { InputManifest } from '../engine/src/inputs.ts';

// A representative large Layout-Studio-style query: compact tilde/comma blocks with
// %-encoded text values and hex colours. This is exactly the shape url-mode.ts emits.
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
  assert.ok(token);
  const decoded = await unpackToken(token);
  assert.ok(decoded);
  assert.equal(decoded, BIG_QUERY);
  const manifest: InputManifest = {
    inputs: [
      { id: 'background', type: 'color' },
      { id: 'boxes', type: 'blocks', fields: [
        { id: 'id', type: 'text' }, { id: 'kind', type: 'text' },
        { id: 'x', type: 'number' }, { id: 'y', type: 'number' },
      ] },
    ],
  };
  const state = parseUrlState(decoded, manifest);
  // Values are a heterogeneous record — read via typed entries.
  const values = new Map<string, unknown>(Object.entries(state.values));
  const boxes = values.get('boxes');
  assert.ok(Array.isArray(boxes));
  assert.equal(boxes.length, 24);
  const first: unknown = boxes[0];
  assert.ok(first !== null && typeof first === 'object' && 'id' in first);
  assert.equal(first.id, 'b0');
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
  assert.ok(token);
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

test('packQuery refuses input over the size cap (encode/decode limits stay symmetric)', async () => {
  // A large-but-compressible query would pack to a tiny token, but its inflated output
  // exceeds unpackToken's cap — so packQuery must NOT mint it, or the app would produce
  // a link it cannot reopen (silent, unrecoverable state loss). The caller then falls
  // back to the readable URL, which round-trips unpacked.
  const huge = 'a=' + 'x'.repeat(400 * 1024);
  assert.equal(await packQuery(huge), null, 'over-cap input → null, not an unopenable token');
  // A just-under-cap query still packs and round-trips.
  const ok = 'a=' + 'x'.repeat(200 * 1024);
  const token = await packQuery(ok);
  assert.ok(token, 'under-cap input still packs');
  assert.equal(await unpackToken(token), ok);
});

test('unpackToken refuses a decompression bomb minted out-of-band', async () => {
  // A hostile link can carry a bomb token even though our own packQuery would refuse
  // to make one; mint it directly (zlib, Node) and confirm the decode cap still holds.
  const zlib = await import('node:zlib');
  const raw = zlib.deflateRawSync(Buffer.from('a'.repeat(400 * 1024)));
  const token = '1' + raw.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  assert.ok(token.length < 2048, 'bomb token is small');
  assert.equal(await unpackToken(token), null, 'over-cap inflation is aborted → null');
});

test('packing is NOT unconditionally smaller (why the caller must gate on length)', async () => {
  const small = 'url=https%3A%2F%2Fsuse.com&color=0c322c';
  const token = await packQuery(small);
  const packedLen = `${PACK_PARAM}=${token}`.length;
  assert.ok(packedLen > small.length, 'a tiny query gets LONGER when packed — gate on length');
});
