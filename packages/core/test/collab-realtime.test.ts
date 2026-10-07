// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import { ReferenceCanvasDoc, type ParamBinding } from '../src/canvas-op-v1.ts';
import { readPresenceFrame, sanitizePresenceState } from '../src/collab-presence-v1.ts';
test('checkpoint round-trip retains independent field origins, order and tombstones', () => {
  const doc = new ReferenceCanvasDoc('a');
  doc.apply({ k: 'add', id: 'box', row: { fill: 'red' }, orderKey: 'a', origin: { client: 'a', clock: 1 } });
  doc.apply({ k: 'field', id: 'box', field: 'fill', value: 'blue', origin: { client: 'b', clock: 5 } });
  doc.apply({ k: 'remove', id: 'box', origin: { client: 'a', clock: 8 } });
  const recovered = new ReferenceCanvasDoc('c'); recovered.restore(JSON.parse(JSON.stringify(doc.checkpoint())));
  recovered.apply({ k: 'add', id: 'box', row: { fill: 'green' }, orderKey: 'b', origin: { client: 'c', clock: 4 } });
  assert.deepEqual(recovered.state().order, []);
  assert.equal(recovered.checkpoint().boxes[0]![1].fields[0]![1].value, 'blue');
});
test('presence envelopes stamp identity, retain sequence and away, and never invent a cursor', () => {
  const bound = { from: 'connection', epoch: 'connection', seq: 8, userId: 'user', name: 'Ada' };
  const result = readPresenceFrame({ v: 1, from: 'spoof', epoch: 'spoof', seq: 7, away: true,
    state: { cursor: { x: 0.7, y: 0.3 }, surface: { id: 'a', space: 'unit' } } }, bound)!;
  assert.equal(result.from, bound.from); assert.equal(result.epoch, bound.epoch);
  assert.equal(result.seq, 7); assert.equal(result.away, true);
  assert.deepEqual(result.state?.cursor, { x: 0.7, y: 0.3 });
  assert.equal(readPresenceFrame({ seq: 8, state: {} }, bound)?.state?.cursor, undefined);
  assert.equal(readPresenceFrame({ seq: 9, state: null }, bound)?.state, null);
  assert.equal(readPresenceFrame({ v: 99, seq: 7, state: {} }, bound), null);
});
test('presence keeps presenting only when it is exactly true', () => {
  const bound = { from: 'connection', epoch: 'connection', seq: 1, userId: 'user', name: 'Ada' };
  assert.equal(readPresenceFrame({ seq: 2, state: { presenting: true } }, bound)?.state?.presenting, true);
  assert.equal(sanitizePresenceState({ presenting: true }).presenting, true);
  for (const presenting of ['yes', 'true', 1, false, null, {}, [true]]) {
    const state = sanitizePresenceState({ presenting });
    assert.equal(Object.hasOwn(state, 'presenting'), false, `presenting ${JSON.stringify(presenting)} is dropped`);
  }
  assert.equal(Object.hasOwn(sanitizePresenceState({}), 'presenting'), false, 'absent stays absent');
});
test('both canvas-op schema copies accept presenting: true on presence and nothing else for it', () => {
  const base = { userId: 'u1', name: 'Ann', color: '#f00', cursor: { x: 0, y: 0 }, selection: [] };
  for (const copy of ['../../../schemas/canvas-op.schema.json', '../schema/canvas-op.schema.json']) {
    const schema = JSON.parse(readFileSync(new URL(copy, import.meta.url), 'utf8')) as { $defs: { presence: { description: string } } };
    assert.match(schema.$defs.presence.description, /v1\.2 adds presenting/);
    const ajv = new Ajv({ allErrors: true, strict: false });
    ajv.addSchema(schema);
    const validate = ajv.getSchema('https://lolly.tools/schemas/canvas-op.schema.json#presence');
    assert.ok(validate, `${copy}: presence $anchor not resolvable`);
    assert.equal(validate(base), true, `${copy}: a presence without presenting stays valid`);
    assert.equal(validate({ ...base, presenting: true }), true, `${copy}: presenting true is valid`);
    for (const presenting of [false, 'yes', 1]) assert.equal(validate({ ...base, presenting }), false, `${copy}: presenting ${JSON.stringify(presenting)} is refused`);
    assert.equal(validate({ ...base, presenting: true, unknown: 1 }), false, `${copy}: the presence branch stays closed`);
  }
});

test('transaction forks isolate both writers, collections, tombstones, bindings and restore', () => {
  const doc = new ReferenceCanvasDoc('local');
  const origin = { client: 'a', clock: 1 };
  const value = { bind: { provider: 'source', query: 'original' } };
  doc.apply({ k: 'param', key: 'data', value, origin });
  for (const col of [undefined, 'blocks']) doc.apply({ k: 'add', id: 'a', col, row: { x: 1, fill: 'red' }, orderKey: 'a', origin });
  const base = doc.checkpoint(), staged = doc.fork();
  origin.clock = 999; value.bind.query = 'mutated';
  const exposed = staged.state().params.get('data') as ParamBinding;
  (exposed.bind as { query: string }).query = 'also-mutated';
  assert.deepEqual(doc.checkpoint(), base, 'operations and snapshots do not expose shared registers');
  assert.deepEqual(staged.checkpoint(), base);
  staged.apply({ k: 'geom', id: 'a', fields: { x: 10 }, origin: { client: 's', clock: 2 } });
  staged.apply({ k: 'remove', id: 'a', col: 'blocks', origin: { client: 's', clock: 3 } });
  staged.apply({ k: 'param', key: 'data', value: 'staged', origin: { client: 's', clock: 3 } });
  assert.deepEqual(doc.checkpoint(), base, 'discarding a failed transaction leaves the base intact');
  const stagedState = staged.checkpoint();
  doc.apply({ k: 'field', id: 'a', field: 'fill', value: 'blue', origin: { client: 'a', clock: 4 } });
  doc.apply({ k: 'order', id: 'a', col: 'blocks', orderKey: 'z', origin: { client: 'a', clock: 4 } });
  doc.apply({ k: 'add', id: 'new', col: 'new-collection', row: {}, orderKey: 'a', origin: { client: 'a', clock: 4 } });
  assert.deepEqual(staged.checkpoint(), stagedState, 'the original may also change after a fork');
  doc.restore(base);
  assert.deepEqual(staged.checkpoint(), stagedState, 'restoring the original does not clear its fork');
  const child = staged.fork(); staged.restore(base);
  assert.deepEqual(child.checkpoint(), stagedState, 'forks can themselves fork');
});
