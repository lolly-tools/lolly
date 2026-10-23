// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { createHistory } from '../views/tool-history.ts';
import { commitToolTransaction, transactionHistoryValues } from '../views/tool-transaction.ts';
import { trackCollabUndo, noteRemoteForUndo } from './collab-undo.ts';
import type { InputValue } from '../../../../engine/src/inputs.ts';
function fixture(refuse = false) {
  let values: Record<string, InputValue> = { boxes: [{ id: 'box', text: 'Old' }], textDocument: '' };
  return { getModel: () => Object.entries(values).map(([id, value]) => ({ id, value })), async applyPatch(patch: Record<string, unknown>) { if (!refuse) values = { ...values, ...patch } as typeof values; } };
}
test('a text source and its frame migrate and undo as one ordinary history entry', async () => {
  const runtime = fixture(), history = createHistory(), before = runtime.getModel();
  const patch = { boxes: [{ id: 'box', text: '', textStory: 'story' }], textDocument: 'new source' };
  await commitToolTransaction(runtime, history, patch, 'Upgrade text');
  assert.deepEqual(history.sizes(), { undo: 1, redo: 0 });
  const entry = history.undo()!;
  assert.deepEqual(entry.fields, ['boxes', 'textDocument']);
  await runtime.applyPatch(transactionHistoryValues(runtime, entry, false)!);
  assert.deepEqual(runtime.getModel(), before);
  await runtime.applyPatch(transactionHistoryValues(runtime, history.redo()!, true)!);
  assert.deepEqual(Object.fromEntries(runtime.getModel().map(item => [item.id, item.value])), patch);
});
test('typing coalesces within its group, formatting stays separate, and refused commands record nothing', async () => {
  const runtime = fixture(), history = createHistory();
  await commitToolTransaction(runtime, history, { textDocument: 'a' }, 'Text', 'story');
  await commitToolTransaction(runtime, history, { textDocument: 'ab' }, 'Text', 'story');
  assert.equal(history.sizes().undo, 1);
  await commitToolTransaction(runtime, history, { textDocument: 'bold ab' }, 'Bold');
  assert.equal(history.sizes().undo, 2);
  const refused = createHistory();
  await commitToolTransaction(fixture(true), refused, { textDocument: 'no' }, 'Text');
  assert.equal(refused.canUndo(), false);
});
test('a remote write prevents partial undo of a cross-input invariant', async () => {
  const runtime = fixture(), history = createHistory(), untrack = trackCollabUndo(runtime);
  try {
    await commitToolTransaction(runtime, history, { boxes: [{ id: 'box', text: '', textStory: 'story' }], textDocument: 'new source' }, 'Upgrade text');
    noteRemoteForUndo(runtime, [{ k: 'param', key: 'textDocument', value: 'peer source', v: 1, actor: 'peer', clock: 1 } as never]);
    await runtime.applyPatch({ textDocument: 'peer source' });
    assert.equal(transactionHistoryValues(runtime, history.undo()!, false), null);
    assert.equal(runtime.getModel().find(item => item.id === 'textDocument')!.value, 'peer source');
  } finally { untrack(); }
});
test('a command keeps the values it changed by reference, not as copies', async () => {
  const runtime = fixture(), history = createHistory();
  const oldBoxes = runtime.getModel().find(item => item.id === 'boxes')!.value;
  const patch = { boxes: [{ id: 'box', text: 'New' }], textDocument: 'source' };
  await commitToolTransaction(runtime, history, patch, 'Rewrite');
  const entry = history.undo()!;
  assert.equal((entry.before as Record<string, InputValue>).boxes, oldBoxes, 'before is the value the model held');
  assert.equal((entry.after as Record<string, InputValue>).boxes, patch.boxes, 'after is the value the model holds');
  const restore = transactionHistoryValues(runtime, entry, false)!;
  assert.equal(restore.boxes, oldBoxes, 'and undo hands the same value back');
});
