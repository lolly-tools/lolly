// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import type { InputModelItem, InputValue } from '../../../../engine/src/inputs.ts';
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { prepareCanvasValue, needsCanvasAssetTransfer } from './canvas-asset-projection.ts';
import { encodeCanvasAsset } from '@lolly-tools/core/canvas-asset-v1';
import { ReferenceCanvasDoc } from '@lolly-tools/core/canvas-op-v1';
import { attachCollabPlumbing } from './collab-plumbing.ts';
import type { CanvasAssetsCapability } from './canvas-assets.ts';
import { canvasRecoveryValues } from './canvas-recovery.ts';

const image: AssetRef = { id: 'user/team/file', source: 'user', type: 'raster', format: 'png', pin: { version: 'hash', format: 'png' }, url: 'blob:local' };
const item = (rows: unknown[]): InputModelItem => ({ id: 'boxes', type: 'blocks', control: 'blocks', isDirty: false,
  canvas: { idField: 'id' }, fields: [{ id: 'id', type: 'text' }, { id: 'x', type: 'number' }, { id: 'image', type: 'asset' }], value: rows as InputValue });
const capability = (prepare: CanvasAssetsCapability['prepare']): CanvasAssetsCapability => ({ prepare, resolve: async () => image,
  status: { subscribe: () => () => {} }, failed: () => {}, close: () => {} });

test('upload completion merges only the edited image and respects concurrent movement and deletion', async () => {
  const before = item([{ id: 'a', x: 10 }, { id: 'b', x: 20 }]);
  let finish!: (ref: AssetRef) => void;
  const assets = capability(() => new Promise(resolve => { finish = resolve; }));
  const proposed = [{ id: 'a', x: 10, image: { id: 'user/upload/private', source: 'user' } }, { id: 'b', x: 20 }];
  let current = item([{ id: 'a', x: 95 }, { id: 'b', x: 20 }, { id: 'peer', x: 50 }]);
  assert.equal(needsCanvasAssetTransfer(before, proposed as InputValue), true);
  const pending = prepareCanvasValue(before, proposed as InputValue, assets, () => current);
  finish(image);
  const rows = await pending as unknown as Record<string, unknown>[];
  assert.equal(rows[0]!.x, 95); assert.equal(rows[0]!.image, image); assert.equal(rows[2]!.id, 'peer');
  const deleted = prepareCanvasValue(before, proposed as InputValue, assets, () => current);
  current = item([{ id: 'b', x: 20 }]); finish(image);
  assert.deepEqual(await deleted, [{ id: 'b', x: 20 }]);
});

test('a slow peer asset download cannot roll back a local geometry write', async () => {
  const doc = new ReferenceCanvasDoc('local');
  doc.apply({ k: 'add', col: 'boxes', id: 'a', row: { x: 10 }, orderKey: 'a', origin: { client: 'remote', clock: 0 } });
  let model = [item([{ id: 'a', x: 10 }])], finish!: (ref: AssetRef) => void;
  const assets = capability(async ref => ref as AssetRef);
  assets.resolve = () => new Promise(resolve => { finish = resolve; });
  const runtime = { getModel: () => model, setInput: async (_id: string, value: InputValue) => { model = [item(value as unknown as unknown[])]; },
    applyPatch: async (values: Record<string, unknown>) => { model = [item(values.boxes as unknown[])]; } };
  const plumbing = attachCollabPlumbing(runtime, { adapter: doc, assets, raf: fn => fn() })!;
  plumbing.applyRemotePatch([{ k: 'field', col: 'boxes', id: 'a', field: 'image', value: encodeCanvasAsset(image)!, origin: { client: 'remote', clock: 1 } }]);
  await new Promise(resolve => setImmediate(resolve));
  await runtime.setInput('boxes', [{ id: 'a', x: 80 }] as InputValue);
  finish(image); await new Promise(resolve => setImmediate(resolve));
  const row = (model[0]!.value as unknown as Record<string, unknown>[])[0]!;
  assert.equal(row.x, 80); assert.equal((row.image as AssetRef).url, 'blob:local');
  plumbing.detach();
});

test('a later image choice wins over an older upload that finishes last', async () => {
  const doc = new ReferenceCanvasDoc('local');
  doc.apply({ k: 'add', col: 'boxes', id: 'a', row: { x: 10 }, orderKey: 'a', origin: { client: 'remote', clock: 0 } });
  let model = [item([{ id: 'a', x: 10 }])];
  const finish: ((ref: AssetRef) => void)[] = [];
  const assets = capability(() => new Promise(resolve => { finish.push(resolve); }));
  const runtime = { getModel: () => model, setInput: async (_id: string, value: InputValue) => { model = [item(value as unknown as unknown[])]; }, applyPatch: async () => {} };
  const plumbing = attachCollabPlumbing(runtime, { adapter: doc, assets })!;
  const first = runtime.setInput('boxes', [{ id: 'a', x: 10, image: { id: 'user/upload/first' } }] as InputValue);
  const second = runtime.setInput('boxes', [{ id: 'a', x: 10, image: { id: 'user/upload/second' } }] as InputValue);
  const chosen = { ...image, id: 'user/team/second' };
  finish[1]!(chosen); await second; finish[0]!(image); await first;
  assert.equal(((model[0]!.value as unknown as Record<string, unknown>[])[0]!.image as AssetRef).id, chosen.id);
  plumbing.detach();
});

test('a rejected image edit is archived with a reopenable project reference', () => {
  const values = canvasRecoveryValues([item([{ id: 'a', x: 10 }])], [{ k: 'add', col: 'boxes', id: 'a',
    row: { x: 20, image: encodeCanvasAsset(image)! }, orderKey: 'a', origin: { client: 'local', clock: 1 } }]);
  assert.equal(((values.boxes as Record<string, unknown>[])[0]!.image as AssetRef).id, image.id);
  assert.equal(((values.boxes as Record<string, unknown>[])[0]!.image as AssetRef).url, '');
});
