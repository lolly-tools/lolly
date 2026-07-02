// SPDX-License-Identifier: MPL-2.0
// Undo/redo as an explicit controller (finding 7: history used to be bolted on
// by monkey-patching runtime.setInput and stuffing a setInputNoHistory escape
// hatch onto the runtime object). These tests pin the exact semantics of the
// original wrap: coalescing, byte-carrier skip, redo invalidation, the limit,
// and gesture continuity across undo/redo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInputHistory } from './input-history.ts';
import type { HistoryRuntime } from './input-history.ts';
import type { InputModelItem, InputValue } from '@lolly/engine';

function makeRuntime(initial: Record<string, InputValue>): HistoryRuntime & { model: InputModelItem[] } {
  const model: InputModelItem[] = Object.entries(initial).map(([id, value]) => ({
    id, type: 'text', value, isDirty: false, control: 'text-input',
  }));
  return {
    model,
    getModel: () => model,
    setInput: (id: string, value: InputValue) => {
      const item = model.find(i => i.id === id);
      if (item) item.value = value;
      return Promise.resolve();
    },
  };
}

function makeHistory(initial: Record<string, InputValue>, opts: { limit?: number; coalesceMs?: number } = {}) {
  const runtime = makeRuntime(initial);
  let now = 0;
  const history = createInputHistory(runtime, { ...opts, now: () => now });
  return { runtime, history, tick: (ms: number) => { now += ms; } };
}

test('set() applies the value and records one undo step', async () => {
  const { runtime, history } = makeHistory({ title: 'a' });
  await history.set('title', 'b');
  assert.equal(runtime.model[0]?.value, 'b');
  assert.equal(history.canUndo, true);
  assert.equal(history.canRedo, false);
});

test('undo restores the previous value; redo reapplies it', async () => {
  const { runtime, history, tick } = makeHistory({ title: 'a' });
  await history.set('title', 'b');
  tick(1000);
  await history.set('title', 'c');
  const u1 = history.undo();
  assert.equal(u1?.id, 'title');
  assert.equal(runtime.model[0]?.value, 'b');
  const u2 = history.undo();
  assert.ok(u2);
  assert.equal(runtime.model[0]?.value, 'a');
  assert.equal(history.canUndo, false);
  const r = history.redo();
  assert.ok(r);
  assert.equal(runtime.model[0]?.value, 'b');
});

test('undo/redo on empty stacks return null and change nothing', () => {
  const { history } = makeHistory({ title: 'a' });
  assert.equal(history.undo(), null);
  assert.equal(history.redo(), null);
});

test('rapid same-input edits coalesce into one step (one gesture, one undo)', async () => {
  const { runtime, history, tick } = makeHistory({ size: 10 });
  await history.set('size', 11);
  tick(100);
  await history.set('size', 12);
  tick(100);
  await history.set('size', 13);
  history.undo();
  assert.equal(runtime.model[0]?.value, 10); // the whole drag reverts at once
  assert.equal(history.canUndo, false);
});

test('edits beyond the coalesce window are separate steps', async () => {
  const { runtime, history, tick } = makeHistory({ size: 10 });
  await history.set('size', 11);
  tick(600);
  await history.set('size', 12);
  history.undo();
  assert.equal(runtime.model[0]?.value, 11);
  history.undo();
  assert.equal(runtime.model[0]?.value, 10);
});

test('edits to different inputs never coalesce', async () => {
  const { history } = makeHistory({ a: 1, b: 2 });
  await history.set('a', 10);
  await history.set('b', 20);
  history.undo();
  history.undo();
  assert.equal(history.canUndo, false);
  assert.equal(history.canRedo, true);
});

test('a fresh edit clears the redo chain', async () => {
  const { history, tick } = makeHistory({ title: 'a' });
  await history.set('title', 'b');
  history.undo();
  assert.equal(history.canRedo, true);
  tick(1000);
  await history.set('title', 'c');
  assert.equal(history.canRedo, false);
});

test('an edit right after undo starts a NEW step (no false coalesce)', async () => {
  const { runtime, history } = makeHistory({ size: 10 });
  await history.set('size', 11);
  history.undo();            // back to 10; entry {10→11} moved to redo
  await history.set('size', 12); // within coalesceMs of the first edit
  history.undo();
  assert.equal(runtime.model[0]?.value, 10); // NOT 11 — post-undo edit was its own step
});

test('setting an unchanged value records nothing', async () => {
  const { history } = makeHistory({ title: 'a' });
  await history.set('title', 'a');
  assert.equal(history.canUndo, false);
});

test('byte-carrying values (file bytes, blob: urls) are never recorded', async () => {
  const { runtime, history } = makeHistory({ photo: null, logo: null });
  await history.set('photo', { bytes: new Uint8Array([1, 2, 3]), name: 'x.png' });
  await history.set('logo', { url: 'blob:abc', name: 'l.svg' });
  assert.equal(history.canUndo, false);
  assert.deepEqual(runtime.model[0]?.value, { bytes: new Uint8Array([1, 2, 3]), name: 'x.png' }); // still applied
});

test('setSilent applies without recording', async () => {
  const { runtime, history } = makeHistory({ width: 100 });
  await history.setSilent('width', 200);
  assert.equal(runtime.model[0]?.value, 200);
  assert.equal(history.canUndo, false);
});

test('the history limit evicts the oldest step', async () => {
  const { runtime, history, tick } = makeHistory({ n: 0 }, { limit: 3 });
  for (let i = 1; i <= 5; i++) { tick(1000); await history.set('n', i); }
  let steps = 0;
  while (history.undo()) steps += 1;
  assert.equal(steps, 3);
  assert.equal(runtime.model[0]?.value, 2); // steps 3→4→5 reverted; 0→1→2 evicted
});

test('undo/redo return the step label for the toast', async () => {
  const { runtime, history } = makeHistory({ title: 'a' });
  const item = runtime.model[0];
  assert.ok(item);
  item.label = 'Title';
  await history.set('title', 'b');
  assert.equal(history.undo()?.label, 'Title');
  assert.equal(history.redo()?.label, 'Title');
});

test('onChange fires when stacks change', async () => {
  const { history, tick } = makeHistory({ title: 'a' });
  let calls = 0;
  history.onChange(() => { calls += 1; });
  await history.set('title', 'b');
  assert.ok(calls >= 1);
  const before = calls;
  history.undo();
  assert.ok(calls > before);
});
