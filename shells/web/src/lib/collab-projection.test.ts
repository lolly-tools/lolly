// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { ReferenceCanvasDoc } from '@lolly-tools/core/canvas-op-v1';
import { attachCollabPlumbing } from './collab-plumbing.ts';

test('hidden-tab backlog folds into the document and paints one current projection', async () => {
  const doc = new ReferenceCanvasDoc('local');
  doc.apply({ k: 'add', col: 'rows', id: 'a', row: { x: 0 }, orderKey: 'a', origin: { client: 'remote', clock: 0 } });
  const model = [{ id: 'rows', type: 'blocks', canvas: { idField: 'id' }, fields: [{ id: 'id' }, { id: 'x', type: 'number' }], value: [{ id: 'a', x: 0, localOnly: { asset: 'kept' } }] }];
  let patches = 0; const frames: (() => void)[] = [];
  const runtime = { getModel: () => model as never, setInput: async () => {}, applyPatch: async (v: Record<string, unknown>) => { patches++; model[0]!.value = v.rows as typeof model[0]['value']; } };
  const plumbing = attachCollabPlumbing(runtime, { adapter: doc, raf: fn => frames.push(fn) })!;
  for (let clock = 1; clock <= 1200; clock++) plumbing.applyRemotePatch([{ k: 'geom', id: 'a', col: 'rows', fields: { x: clock }, origin: { client: 'remote', clock } }]);
  assert.equal(frames.length, 1); assert.equal(patches, 0);
  frames[0]!(); await Promise.resolve();
  assert.equal(patches, 1); assert.equal(model[0]!.value[0]!.x, 1200);
  assert.deepEqual(model[0]!.value[0]!.localOnly, { asset: 'kept' });
  plumbing.detach();
});

test('a losing remote removal cannot erase the converged live row in the runtime', async () => {
  const doc = new ReferenceCanvasDoc('local');
  doc.apply({ k: 'add', col: 'rows', id: 'a', row: { x: 1 }, orderKey: 'a', origin: { client: 'local', clock: 10 } });
  const model = [{ id: 'rows', type: 'blocks', canvas: { idField: 'id' }, fields: [{ id: 'id' }], value: [{ id: 'a', x: 1 }] }];
  const runtime = { getModel: () => model as never, setInput: async () => {}, applyPatch: async (v: Record<string, unknown>) => { model[0]!.value = v.rows as typeof model[0]['value']; } };
  const plumbing = attachCollabPlumbing(runtime, { adapter: doc, raf: fn => fn() })!;
  plumbing.applyRemotePatch([{ k: 'remove', col: 'rows', id: 'a', origin: { client: 'remote', clock: 2 } }]);
  await Promise.resolve();
  assert.deepEqual(model[0]!.value, [{ id: 'a', x: 1 }]); plumbing.detach();
});

test('authoritative snapshots replace default rows, discard older queued deltas and advance local clocks', async () => {
  const doc = new ReferenceCanvasDoc('local');
  doc.apply({ k: 'add', col: 'rows', id: 'shared', row: { x: 20 }, orderKey: 'a', origin: { client: 'server', clock: 500 } });
  const model = [
    { id: 'rows', type: 'blocks', canvas: { idField: 'id' }, fields: [{ id: 'id' }, { id: 'x', type: 'number' }], value: [
      { id: 'default', x: 0 }, { id: 'shared', x: 0, obsolete: 'old scalar', localOnly: { asset: 'kept' } }, { x: 90 },
    ] },
    { id: 'title', type: 'text', value: 'before' },
  ];
  const emitted: number[] = [], frames: (() => void)[] = [];
  const runtime = { getModel: () => model as never, setInput: async (id: string, value: unknown) => { model.find(item => item.id === id)!.value = value as never; },
    applyPatch: async (values: Record<string, unknown>) => { for (const item of model) if (Object.hasOwn(values, item.id)) item.value = values[item.id] as never; } };
  const plumbing = attachCollabPlumbing(runtime, { adapter: doc, raf: fn => frames.push(fn), onOps: ops => emitted.push(...ops.map(op => op.origin.clock)) })!;
  plumbing.applyRemotePatch([{ k: 'geom', col: 'rows', id: 'discarded', fields: { x: 999 }, origin: { client: 'old', clock: 600 } }]);
  plumbing.applySnapshot({ ops: [], clock: 1000 });
  frames.shift()!(); await Promise.resolve();
  assert.deepEqual(model[0]!.value, [{ id: 'shared', x: 20, localOnly: { asset: 'kept' } }]);
  assert.equal(doc.state().collections?.get('rows')?.boxes.has('discarded'), false);
  assert.deepEqual(emitted, [], 'projection must not echo as a local write');
  await runtime.setInput('title', 'after');
  assert.ok(emitted[0]! > 1000, 'first local scalar edit follows the recovered room clock');
  const empty = doc.checkpoint(); empty.collections = [['rows', []]]; doc.restore(empty);
  plumbing.applySnapshot({ ops: [], clock: 1000 });
  frames.shift()!(); await Promise.resolve();
  assert.deepEqual(model[0]!.value, [], 'an empty server collection clears the mounted rows');
  plumbing.detach();
});
