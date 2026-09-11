// SPDX-License-Identifier: MPL-2.0
/**
 * native-wire - the native lanes' byte codec (collab/native-wire.ts): every lane/kind
 * round-trips to the same RtcInboundMessage shape the WebRTC transport produces, presence
 * goes through the shipped parser, and malformed bytes decode to null (never throw).
 *
 * Run directly:  node --test shells/web/src/collab/native-wire.test.ts
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { encodeOps, encodePresence, encodeBeam, decodeFrame } from './native-wire.ts';

test('ops op round-trips verbatim (validated downstream in the handle)', () => {
  const op = { t: 'param', id: 'title', v: 'hello', clock: 3 };
  const msg = decodeFrame('ops', encodeOps({ kind: 'op', op }));
  assert.deepEqual(msg, { lane: 'ops', kind: 'op', op });
});

test('ops hello round-trips its known fields only', () => {
  const bytes = encodeOps({ kind: 'hello', clientId: 'c1', opVersion: '1.1.0', seed: 'q=1' });
  assert.deepEqual(decodeFrame('ops', bytes), {
    lane: 'ops', kind: 'hello', clientId: 'c1', opVersion: '1.1.0', seed: 'q=1',
  });
  // A hello with no fields is valid (the ordinary "seed comes on connect" case).
  assert.deepEqual(decodeFrame('ops', encodeOps({ kind: 'hello' })), { lane: 'ops', kind: 'hello' });
});

test('a hello never carries a field a peer bolted on', () => {
  // Hand-craft an ops frame with an extra key; decode must drop it.
  const rogue = new TextEncoder().encode(JSON.stringify({ kind: 'hello', clientId: 'c1', evil: 'x' }));
  const msg = decodeFrame('ops', rogue) as Record<string, unknown>;
  assert.equal(msg.clientId, 'c1');
  assert.equal('evil' in msg, false);
});

test('presence round-trips through the shipped parser', () => {
  const frame = { from: 'c1', seq: 5, state: { userId: 'U', name: 'Andy', color: '#fff' }, away: false };
  assert.deepEqual(decodeFrame('presence', encodePresence(frame)), {
    lane: 'presence', kind: 'presence', frame,
  });
});

test('an invalid presence frame decodes to null (not throw)', () => {
  // Missing `from` - parsePresenceFrame rejects it.
  const bad = new TextEncoder().encode(JSON.stringify({ seq: 1, state: null }));
  assert.equal(decodeFrame('presence', bad), null);
});

test('beam json round-trips', () => {
  const json = { pack: 'berlin', items: 3 };
  assert.deepEqual(decodeFrame('beam', encodeBeam({ json })), { lane: 'beam', kind: 'json', json });
});

test('beam binary round-trips byte-exact', () => {
  const bytes = new Uint8Array([0, 255, 64, 1, 2, 3]);
  const msg = decodeFrame('beam', encodeBeam({ bytes }));
  assert.equal((msg as { kind: string }).kind, 'binary');
  assert.deepEqual([...(msg as { bytes: Uint8Array }).bytes], [...bytes]);
});

test('malformed lane bytes decode to null, never throw', () => {
  assert.equal(decodeFrame('ops', new TextEncoder().encode('not json')), null);
  assert.equal(decodeFrame('ops', new TextEncoder().encode(JSON.stringify({ kind: 'nope' }))), null);
  assert.equal(decodeFrame('beam', new Uint8Array(0)), null); // no tag byte
  assert.equal(decodeFrame('beam', new Uint8Array([0x7a, 1, 2])), null); // unknown tag
  assert.equal(decodeFrame('beam', new Uint8Array([0x6a, 0x21])), null); // json tag, bad json
});
