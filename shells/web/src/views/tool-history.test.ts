// SPDX-License-Identifier: MPL-2.0
/**
 * The tool view's undo/redo model (views/tool-history.ts).
 *
 * views/tool.ts is 3,369 lines with no test (maintainability-2026-07-29.md item
 * 2). The two most consequential tests in this file are regression pins for bugs
 * this code has ALREADY shipped, both recorded in tool.ts's own comments:
 * recording keyed off a `blob:` URL instead of raw bytes (which silently killed
 * all undo in Design), and coalescing keyed off the top entry instead of
 * the last record (which let a post-undo edit eat a state).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createHistory, sameValue, carriesBytes, cloneValue, describeRowChange,
  HISTORY_LIMIT, COALESCE_MS,
} from './tool-history.ts';
import type { InputValue } from '../../../../engine/src/inputs.js';
import { buildInputModel, updateInput, tokenRestoreRefsOf } from '../../../../engine/src/inputs.ts';
import { historyTokenLinks } from './tool-history.ts';

test('undo and redo retain the previous token for each custom value', () => {
  let model = buildInputModel({ inputs: [{ id: 'gap', type: 'number', default: 10 }] }, { initial: { gap: 17, __tokenLinks: { gap: '{old}' } } });
  const history = createHistory();
  const before = model[0]!.value, beforeLinks = historyTokenLinks(model, ['gap']);
  model = updateInput(model, 'gap', { ref: '{new}', value: 33 });
  history.record({ id: 'gap', label: 'Gap', before, after: model[0]!.value, tokenLinks: { before: beforeLinks, after: historyTokenLinks(model, ['gap']) } }, 0);
  const entry = history.undo()!;
  model = updateInput(model, entry.id, entry.before, { restoreTokenRefs: entry.tokenLinks!.before });
  assert.equal(model[0]!.value, 17);
  assert.deepEqual(tokenRestoreRefsOf(model), { gap: '{old}' });
  const redo = history.redo()!;
  model = updateInput(model, redo.id, redo.after, { restoreTokenRefs: redo.tokenLinks!.after });
  assert.deepEqual(model[0]!.value, { ref: '{new}', value: 33 });
  assert.deepEqual(tokenRestoreRefsOf(model), {});
});

test('coalesced local edits retain the original restore target and latest restore state', () => {
  const history = createHistory();
  history.record({ id: 'gap', label: 'Gap', before: 10, after: 11, tokenLinks: { before: { gap: '{old}' }, after: { gap: '{new}' } } }, 0);
  history.record({ id: 'gap', label: 'Gap', before: 11, after: 12, tokenLinks: { before: { gap: '{new}' }, after: { gap: null } } }, 1);
  assert.deepEqual(history.sizes(), { undo: 1, redo: 0 });
  assert.deepEqual(history.undo()!.tokenLinks, { before: { gap: '{old}' }, after: { gap: null } });
});

const edit = (id: string, before: unknown, after: unknown, label = id) =>
  ({ id, label, before: before as InputValue, after: after as InputValue });

test('linking, making custom and the next numeric edit are separate keyboard undo steps', () => {
  const history = createHistory();
  history.record(edit('gap', 16, { ref: '{rhythm.gap}', value: 24 }), 0);
  history.record(edit('gap', { ref: '{rhythm.gap}', value: 24 }, 24), 1);
  history.record(edit('gap', 24, 25), 2);
  assert.equal(history.sizes().undo, 3);
});

// ── sameValue ────────────────────────────────────────────────────────────────

test('sameValue compares structurally, not by reference', () => {
  assert.equal(sameValue({ a: 1 } as InputValue, { a: 1 } as InputValue), true);
  assert.equal(sameValue([1, 2] as unknown as InputValue, [1, 2] as unknown as InputValue), true);
  assert.equal(sameValue({ a: 1 } as InputValue, { a: 2 } as InputValue), false);
});

test('sameValue treats an unserialisable value as CHANGED, not equal', () => {
  // Erring this way records a redundant step; erring the other way silently
  // swallows a real edit, which is the worse failure for an undo stack.
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  assert.equal(sameValue(cyclic as InputValue, cyclic as InputValue), true, 'identity still short-circuits');
  const other: Record<string, unknown> = {};
  other.self = other;
  assert.equal(sameValue(cyclic as InputValue, other as InputValue), false);
});

// ── carriesBytes: the Design regression ───────────────────────────────

test('carriesBytes finds raw bytes at the top level and nested', () => {
  assert.equal(carriesBytes({ bytes: new Uint8Array([1]) } as unknown as InputValue), true);
  assert.equal(carriesBytes({ bytes: new ArrayBuffer(2) } as unknown as InputValue), true);
  assert.equal(carriesBytes({ a: { b: { bytes: new Uint8Array([1]) } } } as unknown as InputValue), true);
  assert.equal(carriesBytes([{ bytes: new Uint8Array([1]) }] as unknown as InputValue), true);
});

test('an asset ref with a blob: URL and NO bytes is recordable', () => {
  // THE REGRESSION. The old test looked at the URL scheme, so once any Layout
  // Studio box image resolved through the asset-blob cache every subsequent edit
  // was treated as byte-carrying and undo silently stopped working entirely.
  const ref = { source: 'library', id: 'suse/logo/primary', url: 'blob:http://x/abc' };
  assert.equal(carriesBytes(ref as unknown as InputValue), false);
  const h = createHistory();
  assert.equal(h.record(edit('logo', null, ref), 0), 'pushed', 'an asset pick must be undoable');
});

test('a data: URL without bytes is likewise recordable', () => {
  const ref = { source: 'remote', id: 'x', url: 'data:image/png;base64,AAAA' };
  assert.equal(carriesBytes(ref as unknown as InputValue), false);
});

test('carriesBytes is false for primitives and empty objects', () => {
  for (const v of [null, undefined, 0, '', 'blob:x', true, {}, []]) {
    assert.equal(carriesBytes(v as InputValue), false, String(v));
  }
});

test('a file input carrying bytes is NOT recorded at all', () => {
  const h = createHistory();
  const file = { __file: true, name: 'a.png', bytes: new Uint8Array([1, 2, 3]) };
  assert.equal(h.record(edit('upload', null, file), 0), 'ignored');
  assert.equal(h.canUndo(), false);
  // …and neither is an edit REPLACING a byte-carrying value.
  assert.equal(h.record(edit('upload', file, null), 0), 'ignored');
  assert.equal(h.canUndo(), false);
});

// ── record ───────────────────────────────────────────────────────────────────

test('an edit that changes nothing is ignored', () => {
  const h = createHistory();
  assert.equal(h.record(edit('t', 'same', 'same'), 0), 'ignored');
  assert.equal(h.canUndo(), false);
});

test('successive edits to the SAME input within the window coalesce into one step', () => {
  // Typing "abc" is one undo, not three.
  const h = createHistory();
  assert.equal(h.record(edit('t', '', 'a'), 1000), 'pushed');
  assert.equal(h.record(edit('t', 'a', 'ab'), 1100), 'coalesced');
  assert.equal(h.record(edit('t', 'ab', 'abc'), 1200), 'coalesced');
  assert.deepEqual(h.sizes(), { undo: 1, redo: 0 });
  const e = h.undo();
  assert.equal(e?.before, '', 'the gesture keeps its ORIGINAL before');
  assert.equal(e?.after, 'abc', 'and its LATEST after');
});

test('an edit past the coalesce window starts a new step', () => {
  const h = createHistory();
  h.record(edit('t', '', 'a'), 1000);
  assert.equal(h.record(edit('t', 'a', 'ab'), 1000 + COALESCE_MS), 'pushed');
  assert.equal(h.sizes().undo, 2);
});

test('an edit to a DIFFERENT input never coalesces, however fast', () => {
  const h = createHistory();
  h.record(edit('a', '', '1'), 1000);
  assert.equal(h.record(edit('b', '', '2'), 1001), 'pushed');
  assert.equal(h.sizes().undo, 2);
});

test('the stack is capped, dropping the OLDEST entry', () => {
  const h = createHistory({ limit: 3, coalesceMs: 0 });
  for (let i = 0; i < 5; i++) h.record(edit(`i${i}`, i, i + 1), i * 1000);
  assert.equal(h.sizes().undo, 3);
  // The three newest survive; undo returns them newest-first.
  assert.equal(h.undo()?.id, 'i4');
  assert.equal(h.undo()?.id, 'i3');
  assert.equal(h.undo()?.id, 'i2');
  assert.equal(h.undo(), null, 'i0 and i1 were dropped');
});

test('the default limit and window are the documented ones', () => {
  assert.equal(HISTORY_LIMIT, 100);
  assert.equal(COALESCE_MS, 500);
});

test('recorded values are CLONED, so later mutation cannot corrupt history', () => {
  const h = createHistory();
  const before = { n: 1 };
  const after = { n: 2 };
  h.record(edit('obj', before, after), 0);
  after.n = 99;
  before.n = 98;
  const e = h.undo();
  assert.deepEqual(e?.before, { n: 1 });
  assert.deepEqual(e?.after, { n: 2 });
});

// ── undo / redo ──────────────────────────────────────────────────────────────

test('undo and redo move an entry between the stacks', () => {
  const h = createHistory({ coalesceMs: 0 });
  h.record(edit('t', 'one', 'two'), 0);
  assert.deepEqual(h.sizes(), { undo: 1, redo: 0 });

  const undone = h.undo();
  assert.equal(undone?.before, 'one');
  assert.deepEqual(h.sizes(), { undo: 0, redo: 1 });
  assert.equal(h.canUndo(), false);
  assert.equal(h.canRedo(), true);

  const redone = h.redo();
  assert.equal(redone?.after, 'two');
  assert.deepEqual(h.sizes(), { undo: 1, redo: 0 });
});

test('undo and redo on an empty stack return null rather than throwing', () => {
  const h = createHistory();
  assert.equal(h.undo(), null);
  assert.equal(h.redo(), null);
});

test('a fresh edit breaks the redo chain', () => {
  const h = createHistory({ coalesceMs: 0 });
  h.record(edit('t', 'a', 'b'), 0);
  h.undo();
  assert.equal(h.canRedo(), true);
  h.record(edit('t', 'a', 'c'), 1000);
  assert.equal(h.canRedo(), false, 'redoing after a divergent edit would restore a state that never existed');
});

test('an edit straight after an undo does NOT merge into the entry undo left behind', () => {
  // THE SECOND REGRESSION. undo leaves an old entry on top still carrying its
  // original timestamp. Coalescing keyed off that entry rather than off the last
  // record would extend it - losing a state. endGesture() is what prevents it,
  // and the view calls it around every history application.
  const h = createHistory();
  h.record(edit('t', '', 'a'), 1000);
  h.record(edit('t', 'a', 'ab'), 1100);   // coalesced: one entry
  assert.equal(h.sizes().undo, 1);

  h.undo();
  h.endGesture();                          // what applyHistory does in tool.ts
  h.redo();

  // A quick follow-up edit must be its OWN step, not an extension of the old one.
  assert.equal(h.record(edit('t', 'ab', 'abc'), 1150), 'pushed');
  assert.equal(h.sizes().undo, 2);
});

test('without endGesture the stale-merge bug is reproducible - the guard is doing work', () => {
  // Proves the test above is not vacuous: same sequence, no endGesture, and the
  // follow-up edit coalesces into the resurrected entry instead of pushing.
  const h = createHistory();
  h.record(edit('t', '', 'a'), 1000);
  h.undo();
  h.redo();
  assert.equal(h.record(edit('t', 'a', 'ab'), 1100), 'coalesced');
  assert.equal(h.sizes().undo, 1);
});

test('a full undo-all then redo-all round-trip restores the original order', () => {
  const h = createHistory({ coalesceMs: 0 });
  const ids = ['a', 'b', 'c'];
  ids.forEach((id, i) => h.record(edit(id, i, i + 1), i * 1000));
  const undone: string[] = [];
  for (let e = h.undo(); e; e = h.undo()) undone.push(e.id);
  assert.deepEqual(undone, ['c', 'b', 'a']);
  const redone: string[] = [];
  for (let e = h.redo(); e; e = h.redo()) redone.push(e.id);
  assert.deepEqual(redone, ['a', 'b', 'c']);
  assert.deepEqual(h.sizes(), { undo: 3, redo: 0 });
});

test('cloneValue falls back to the original when a value cannot be cloned', () => {
  const fn = { f: () => 1 };
  assert.equal(cloneValue(fn as unknown as InputValue), fn);
});


// ── describeRowChange (plans/179 A16) ────────────────────────────────────────
//
// "Undid Boxes" named the input that was written, never what the user had done.

const CANVAS = { xField: 'x', yField: 'y', wField: 'w', hField: 'h', rotationField: 'rot' };
const ROW = (over: Record<string, unknown> = {}) =>
  ({ id: 'a', x: 0, y: 0, w: 10, h: 10, rot: 0, bg: '#fff', ...over });

test('describeRowChange names the arrival and the departure of rows', () => {
  const one = [ROW()] as unknown as InputValue;
  const two = [ROW(), ROW({ id: 'b' })] as unknown as InputValue;
  assert.deepEqual(describeRowChange(one, two, CANVAS), { kind: 'add' });
  assert.deepEqual(describeRowChange(two, one, CANVAS), { kind: 'delete' });
});

test('describeRowChange names a geometry gesture by the gesture, not by its fields', () => {
  const at = (o: Record<string, unknown>) => [ROW(o)] as unknown as InputValue;
  assert.deepEqual(describeRowChange(at({}), at({ x: 5, y: 7 }), CANVAS), { kind: 'move' });
  assert.deepEqual(describeRowChange(at({}), at({ x: 5, w: 40, h: 20 }), CANVAS), { kind: 'resize' });
  assert.deepEqual(describeRowChange(at({}), at({ rot: 15 }), CANVAS), { kind: 'rotate' });
  // A tool that declares no geometry fields cannot be told a move from a rename.
  assert.deepEqual(describeRowChange(at({}), at({ x: 5, y: 7 }), {}), null);
});

test('describeRowChange names a single field, so the toast can use its LABEL', () => {
  const a = [ROW()] as unknown as InputValue;
  const b = [ROW({ bg: '#ffa3e9' })] as unknown as InputValue;
  assert.deepEqual(describeRowChange(a, b, CANVAS), { kind: 'field', field: 'bg' });
});

test('describeRowChange refuses to name what it cannot: a rewrite, a no-op, a scalar', () => {
  const a = [ROW()] as unknown as InputValue;
  // Same length, nothing different - the caller keeps the input label.
  assert.equal(describeRowChange(a, [ROW()] as unknown as InputValue, CANVAS), null);
  // Two unrelated fields at once is a gesture with no one name.
  assert.equal(describeRowChange(a, [ROW({ bg: '#000', text: 'hi' })] as unknown as InputValue, CANVAS), null);
  // More rows changed than a gesture plausibly touches.
  const many = (n: number, o: Record<string, unknown> = {}) =>
    Array.from({ length: n }, (_, i) => ROW({ id: 'r' + i, ...o })) as unknown as InputValue;
  assert.equal(describeRowChange(many(70), many(70, { bg: '#000' }), { ...CANVAS, maxRows: 64 }), null);
  // Not a blocks input at all.
  assert.equal(describeRowChange('a' as unknown as InputValue, 'b' as unknown as InputValue, CANVAS), null);
});

// ── what one gesture is (plans/268 SI-13) ────────────────────────────────────────

test('a held pointer is ONE step however long it takes, and the next edit is a new one', () => {
  const h = createHistory();
  h.beginHold();
  assert.equal(h.record({ id: 'size', label: 'Size', before: 10, after: 11 }, 0), 'pushed');
  // A pause far longer than the window, in the middle of the same drag.
  assert.equal(h.record({ id: 'size', label: 'Size', before: 11, after: 30 }, 5_000), 'coalesced');
  h.endHold();
  assert.deepEqual(h.sizes(), { undo: 1, redo: 0 });
  // Straight away, well inside the window: a different gesture, so a different step.
  assert.equal(h.record({ id: 'size', label: 'Size', before: 30, after: 31 }, 5_010), 'pushed');
  const back = h.undo()!;
  assert.deepEqual([back.before, back.after], [30, 31]);
  assert.deepEqual([h.undo()!.before, h.sizes().undo], [10, 0]);
});

test('a drag begun inside the window of the last edit does not merge into that edit', () => {
  const h = createHistory();
  h.record({ id: 'boxes', label: 'Colour', before: [{ c: 1 }], after: [{ c: 2 }] }, 0);
  h.beginHold();
  assert.equal(h.record({ id: 'boxes', label: 'Move', before: [{ c: 2 }], after: [{ c: 2, x: 5 }] }, 100), 'pushed');
  h.endHold();
  assert.equal(h.sizes().undo, 2);
});

test('rows arriving or leaving are never merged, in either direction', () => {
  const h = createHistory();
  const one = [{ id: 'a' }];
  const two = [{ id: 'a' }, { id: 'b' }];
  const three = [...two, { id: 'c' }];
  // Two pastes 50ms apart are two steps: Cmd+Z takes back one paste, not both.
  assert.equal(h.record({ id: 'boxes', label: 'Add', before: one, after: two }, 0), 'pushed');
  assert.equal(h.record({ id: 'boxes', label: 'Add', before: two, after: three }, 50), 'pushed');
  // And a move made straight after a paste does not melt into the paste.
  const moved = three.map((b, i) => (i === 2 ? { ...b, x: 9 } : b));
  assert.equal(h.record({ id: 'boxes', label: 'Move', before: three, after: moved }, 80), 'pushed');
  assert.equal(h.sizes().undo, 3);
  // Even with the pointer held: a delete during a drag is still its own decision.
  h.beginHold();
  h.record({ id: 'boxes', label: 'Move', before: moved, after: moved.map((b) => ({ ...b, y: 1 })) }, 100);
  assert.equal(h.record({ id: 'boxes', label: 'Delete', before: moved.map((b) => ({ ...b, y: 1 })), after: [] }, 110), 'pushed');
  h.endHold();
});

test('with no pointer down the window still makes one step of fast typing and key repeat', () => {
  const h = createHistory();
  h.record({ id: 'title', label: 'Title', before: 'a', after: 'ab' }, 0);
  assert.equal(h.record({ id: 'title', label: 'Title', before: 'ab', after: 'abc' }, 200), 'coalesced');
  assert.equal(h.record({ id: 'title', label: 'Title', before: 'abc', after: 'abcd' }, 2_000), 'pushed');
});
