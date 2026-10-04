// SPDX-License-Identifier: MPL-2.0
/**
 * views/design-live.ts against the tool view's real history (tool-history.ts) and
 * transaction commit (tool-transaction.ts): an agent apply is one step, the step is
 * labelled, and the agent's undo takes back that step and nothing else.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHistory } from './tool-history.ts';
import { commitToolTransaction, transactionHistoryValues } from './tool-transaction.ts';
import { designLiveEditor } from './design-live.ts';
import { createLiveSession } from '../lib/live-agent.ts';

function setup() {
  const model = [
    { id: 'boxes', value: [{ id: 'a', type: 'rect', x: 0, y: 0, w: 10, h: 10 }] as unknown },
    { id: 'background', value: '#ffffff' as unknown },
  ];
  const runtime = {
    getModel: () => model as Array<{ id: string; value: any }>,
    async applyPatch(values: Record<string, unknown>) {
      for (const [id, value] of Object.entries(values)) model.find((m) => m.id === id)!.value = structuredClone(value);
    },
  };
  const history = createHistory();
  const undo = () => {
    const entry = history.undo();
    if (!entry) return;
    const values = transactionHistoryValues(runtime, entry, false);
    if (values) void runtime.applyPatch(values);
  };
  const editor = designLiveEditor({
    toolId: 'design', engine: '1.244.0', surface: 'web', runtime, blockId: 'boxes',
    fields: [{ id: 'kind', default: 'shape' }, { id: 'fill', default: '#000000' }],
    selection: () => [], size: () => ({ width: 800, height: 600 }),
    history: { commit: (values, label) => commitToolTransaction(runtime, history, values, label), top: () => history.peekUndo(), undo },
    readOnly: () => false,
    label: (note) => `AI agent: ${note}`,
    exportSvg: async () => new Blob(['<svg/>']),
  });
  return { model, runtime, history, editor };
}

const req = (id: number, method: string, params?: unknown) => JSON.stringify({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) });

test('an agent apply is one labelled history step on the boxes input', async () => {
  const { model, history, editor } = setup();
  const session = createLiveSession(editor);
  await session.handle(req(1, 'hello', { protocol: 'live-v1' }));
  const reply = JSON.parse(await session.handle(req(2, 'document.apply', {
    label: 'Two shapes',
    layerOperations: [
      { op: 'add', afterId: 'a', layer: { id: 'b', type: 'rect', x: 20, y: 0, w: 10, h: 10 } },
      { op: 'add', afterId: 'b', layer: { id: 'c', type: 'ellipse', x: 40, y: 0, w: 10, h: 10 } },
    ],
  })));
  assert.equal(reply.result.changed, true);
  assert.deepEqual((model[0]!.value as Array<{ id: string }>).map((r) => r.id), ['a', 'b', 'c']);
  assert.equal(history.sizes().undo, 1, 'two operations, one step');
  assert.equal(history.peekUndo()!.label, 'AI agent: Two shapes');
  assert.equal((model[0]!.value as Array<{ kind?: string }>)[1]!.kind, 'shape', 'a new layer takes the manifest defaults');
});

test('the agent undoes its own step; a person edit on top blocks that', async () => {
  const { model, runtime, history, editor } = setup();
  const session = createLiveSession(editor);
  await session.handle(req(1, 'hello', { protocol: 'live-v1' }));
  await session.handle(req(2, 'document.apply', { layerPatches: [{ id: 'a', set: { x: 50 } }] }));
  // The person changes the background through the same history.
  await commitToolTransaction(runtime, history, { background: '#000000' }, 'Background');
  const refused = JSON.parse(await session.handle(req(3, 'history.undo')));
  assert.ok(refused.error, 'the newest step is the person\'s');
  assert.equal(model[1]!.value, '#000000');
  history.undo(); // the person takes back their own step
  const undone = JSON.parse(await session.handle(req(4, 'history.undo')));
  assert.equal(undone.result.undone, true);
  assert.equal((model[0]!.value as Array<{ x: number }>)[0]!.x, 0);
});

test('look reads the export blob as text', async () => {
  const { editor } = setup();
  assert.deepEqual(await editor.look(), { svg: '<svg/>', width: 800, height: 600 });
});

test('a touched row that breaks the Design manifest is refused whole; an old odd row does not block edits', async () => {
  const { readFileSync } = await import('node:fs');
  const { validateDocument } = await import('../../../../engine/src/document-api.ts');
  const manifest = JSON.parse(readFileSync(new URL('../../../../community/design/tool.json', import.meta.url), 'utf8'));
  const model = [{ id: 'boxes', value: [{ id: 'a', kind: 'box', x: 0, y: 0, w: 10, h: 10 }, { id: 'old', kind: 'not-a-kind', x: 0, y: 0, w: 1, h: 1 }] as unknown }];
  const runtime = { getModel: () => model as Array<{ id: string; value: any }>, async applyPatch(v: Record<string, unknown>) { model[0]!.value = structuredClone(v.boxes); } };
  const history = createHistory();
  const editor = designLiveEditor({
    toolId: 'design', engine: 'test', surface: 'web', runtime, blockId: 'boxes', fields: [],
    selection: () => [], size: () => ({ width: 100, height: 100 }),
    history: { commit: (values, label) => commitToolTransaction(runtime, history, values, label), top: () => history.peekUndo(), undo: () => history.undo() },
    readOnly: () => false, label: (n) => n, exportSvg: async () => new Blob(['<svg/>']),
    validateInputs: (value) => validateDocument({ kind: 'inputs', manifest, value }),
  });
  const session = createLiveSession(editor);
  await session.handle(req(1, 'hello', { protocol: 'live-v1' }));
  const bad = JSON.parse(await session.handle(req(2, 'document.apply', {
    layerOperations: [{ op: 'add', layer: { id: 'b', kind: 'shape', x: 0, y: 0, w: 5, h: 5 } }],
  })));
  assert.ok(bad.error, 'kind "shape" is not a Design kind');
  assert.match(bad.error.message, /layer "b" kind/);
  assert.match(bad.error.message, /Nothing was changed/);
  assert.equal(history.sizes().undo, 0);
  const good = JSON.parse(await session.handle(req(3, 'document.apply', { layerPatches: [{ id: 'a', set: { x: 4 } }] })));
  assert.equal(good.result.changed, true, 'the old odd row is not part of this edit');
});
