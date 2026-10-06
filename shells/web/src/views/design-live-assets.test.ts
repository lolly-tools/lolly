// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { LoadedTool } from '../../../../engine/src/loader.ts';
import { createRuntime } from '../../../../engine/src/runtime.ts';
import { prepareLiveAssets } from './design-live-assets.ts';
import { designLiveEditor } from './design-live.ts';
import { createLiveSession } from '../lib/live-agent.ts';
import { createHistory } from './tool-history.ts';
import { commitToolTransaction, transactionHistoryValues } from './tool-transaction.ts';
import { trackCollabUndo } from '../lib/collab-undo.ts';

const picture = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==';
const fields = [{ id: 'image', type: 'asset', assetType: 'image' }];
const assets: Pick<HostV1['assets'], 'get'> = { get: async id => ({ id, source: 'remote', type: 'image', url: id }) };

async function setup() {
  const host = { version: '1', profile: { get: async () => ({}) }, log: () => {}, assets } as unknown as HostV1;
  const tool = { manifest: { id: 'live-pictures', name: 'Pictures', version: '1.0.0', engineVersion: '^1.0.0', status: 'official', render: { width: 100, height: 100, formats: ['svg'] }, inputs: [{ id: 'boxes', type: 'blocks', fields, default: [] }] }, template: '{{#each boxes}}<img src="{{image.url}}">{{/each}}' } as unknown as LoadedTool;
  const runtime = await createRuntime(tool, host, {});
  const history = createHistory();
  const untrack = trackCollabUndo(runtime);
  const editor = designLiveEditor({
    toolId: 'design', engine: 'test', surface: 'web', runtime, blockId: 'boxes', fields, assets,
    selection: () => [], size: () => ({ width: 100, height: 100 }), readOnly: () => false, label: note => note,
    history: { commit: (values, label) => commitToolTransaction(runtime, history, values, label), top: () => history.peekUndo(), undo: () => { const entry = history.undo(); if (entry) { const values = transactionHistoryValues(runtime, entry, false); if (values) void runtime.applyPatch(values); } } },
    exportSvg: async () => new Blob([runtime.getHydrated()]),
  });
  const session = createLiveSession(editor);
  let id = 0;
  const call = async (method: string, params?: object) => JSON.parse(await session.handle(JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params })));
  await call('hello', { protocol: 'live-v1', client: 'Studio assistant' });
  return { runtime, history, call, close: () => { session.close(); untrack(); runtime.destroy(); } };
}

test('live image references reach the render and undo as one history entry with collaboration fences', async () => {
  const s = await setup();
  try {
    const reply = await s.call('document.apply', { layerOperations: [{ op: 'add', layer: { id: 'picture', kind: 'image', image: picture, x: 0, y: 0, w: 20, h: 20 } }] });
    assert.equal(reply.result.changed, true);
    assert.match(s.runtime.getHydrated(), /<img src="data:image\/png;base64,/);
    assert.equal(s.history.sizes().undo, 1);
    const undone = await s.call('history.undo');
    assert.equal(undone.result.undone, true);
    await s.runtime.whenSettled();
    assert.equal(s.runtime.getHydrated(), '');
  } finally { s.close(); }
});

test('asset preparation preserves untouched references and resolves new catalog references', async () => {
  const before = [{ id: 'old', image: 'unavailable', text: 'Before' }];
  const calls: string[] = [];
  const prepared = await prepareLiveAssets([{ ...before[0], text: 'After' }, { id: 'new', image: 'library/logo' }], before, fields, { get: async id => { calls.push(id); return { id, source: 'library', type: 'image', url: 'blob:logo' }; } });
  assert.deepEqual(calls, ['library/logo']);
  assert.deepEqual(prepared, [{ id: 'old', image: 'unavailable', text: 'After' }, { id: 'new', image: { id: 'library/logo', source: 'library', type: 'image', url: 'blob:logo' } }]);
});

test('an unavailable image refuses the complete live edit without history', async () => {
  const s = await setup();
  const get = assets.get;
  assets.get = async () => { throw new Error('Image unavailable'); };
  try {
    const reply = await s.call('document.apply', { layerOperations: [{ op: 'add', layer: { id: 'picture', kind: 'image', image: 'missing', x: 0, y: 0, w: 20, h: 20 } }] });
    assert.match(reply.error.message, /Image unavailable/);
    assert.equal(s.history.sizes().undo, 0);
    assert.equal(s.runtime.getHydrated(), '');
  } finally { assets.get = get; s.close(); }
});
