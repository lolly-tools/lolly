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
  createHistory, sameValue, carriesBytes, cloneValue, describeRowChange, freezeValue,
  FREEZE_HISTORY_VALUES, HISTORY_LIMIT, COALESCE_MS,
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

test('a recorded value is frozen in a test build, so a later write fails loudly instead of corrupting history', () => {
  assert.equal(FREEZE_HISTORY_VALUES, true, 'node tests are a test build');
  const h = createHistory();
  const before = { n: 1 };
  const after = { n: 2, rows: [{ x: 1 }] };
  h.record(edit('obj', before, after), 0);
  assert.throws(() => { after.n = 99; }, TypeError);
  assert.throws(() => { before.n = 98; }, TypeError);
  assert.throws(() => { after.rows[0]!.x = 5; }, TypeError, 'all the way down');
  assert.throws(() => { after.rows.push({ x: 2 }); }, TypeError);
  const e = h.undo();
  assert.deepEqual(e?.before, { n: 1 });
  assert.deepEqual(e?.after, { n: 2, rows: [{ x: 1 }] });
});

test('freezeValue freezes arrays and plain objects, and leaves bytes and instances alone', () => {
  const bytes = new Uint8Array([1, 2]);
  const when = new Date(0);
  const value = freezeValue({ rows: [{ a: 1 }], bytes, when, none: null });
  assert.ok(Object.isFrozen(value) && Object.isFrozen(value.rows) && Object.isFrozen(value.rows[0]));
  assert.equal(Object.isFrozen(bytes), false, 'freezing a typed array with elements would throw');
  assert.equal(Object.isFrozen(when), false, 'an instance is not model data');
  bytes[0] = 9;
  assert.equal(bytes[0], 9);
  // An object already frozen is taken as frozen all the way down: a commit that replaced
  // one row walks that row only.
  const kept = Object.freeze({ a: 1 });
  const next = freezeValue([kept, { b: 2 }]);
  assert.ok(Object.isFrozen(next[1]));
  assert.equal(freezeValue(5), 5);
  assert.equal(freezeValue(null), null);
});

test('history keeps values by reference: consecutive steps share the rows they did not change', () => {
  const h = createHistory({ coalesceMs: 0 });
  const v0 = [{ id: 'a', x: 0 }, { id: 'b', x: 0 }];
  const v1 = v0.map((r) => (r.id === 'a' ? { ...r, x: 1 } : r));
  const v2 = v1.map((r) => (r.id === 'b' ? { ...r, x: 2 } : r));
  h.record(edit('boxes', v0, v1), 0);
  h.record(edit('boxes', v1, v2), 1000);
  const second = h.undo()!, first = h.undo()!;
  assert.equal(second.before, v1, 'no copy: the very array the model held');
  assert.equal(second.after, v2);
  assert.equal(first.before, v0);
  assert.equal(first.after, second.before, 'step k after IS step k+1 before');
  assert.equal(v2[0], v1[0], 'and the untouched row is one object across both steps');
});

test('a hundred nudges of a 2,000-row document keep about 2,100 rows, not two hundred copies', () => {
  const h = createHistory({ coalesceMs: 0 });
  let doc = Array.from({ length: 2000 }, (_, i) => ({ id: `r${i}`, x: i, y: 0 }));
  for (let step = 0; step < 100; step++) {
    const i = (step * 37) % doc.length;
    const next = doc.map((row, k) => (k === i ? { ...row, y: row.y + 1 } : row));
    h.record(edit('boxes', doc, next), step * 1000);
    doc = next;
  }
  const rows = new Set<object>();
  for (let e = h.undo(); e; e = h.undo()) {
    for (const r of e.before as unknown as object[]) rows.add(r);
    for (const r of e.after as unknown as object[]) rows.add(r);
  }
  // 2,000 original rows plus one new row per nudge. Copies would be 100 steps x 2
  // values x 2,000 rows.
  assert.ok(rows.size <= 2100, `history holds ${rows.size} distinct rows`);
});

test('a coalesced gesture keeps its first before and its latest after, both by reference', () => {
  const h = createHistory();
  const v0 = [{ id: 'a', x: 0 }];
  const v1 = [{ id: 'a', x: 1 }];
  const v2 = [{ id: 'a', x: 2 }];
  h.beginHold();
  h.record(edit('boxes', v0, v1), 0);
  h.record(edit('boxes', v1, v2), 5000);
  h.endHold();
  const e = h.undo()!;
  assert.equal(e.before, v0);
  assert.equal(e.after, v2);
});

test('sameValue compares row by row: a row that is the same object is never serialised', () => {
  let serialised = 0;
  const row = (id: string, x: number) => ({ id, x, toJSON() { serialised++; return { id, x }; } });
  const rows = Array.from({ length: 50 }, (_, i) => row(`r${i}`, i));
  const moved = rows.map((r, i) => (i === 7 ? row('r7', 99) : r));
  serialised = 0;
  assert.equal(sameValue(rows as unknown as InputValue, moved as unknown as InputValue), false);
  assert.equal(serialised, 2, 'only the changed row, on each side');
  serialised = 0;
  assert.equal(sameValue(rows as unknown as InputValue, [...rows] as unknown as InputValue), true, 'a new array of the same rows');
  assert.equal(serialised, 0);
  const copied = rows.map((r) => row(r.id, r.x));
  assert.equal(sameValue(rows as unknown as InputValue, copied as unknown as InputValue), true, 'equal copies are still equal');
  // A command's `{ input: value }` map: the input it did not change costs nothing.
  serialised = 0;
  const text = 'x'.repeat(10);
  assert.equal(sameValue({ boxes: rows, text } as unknown as InputValue, { boxes: rows, text: `${text}!` } as unknown as InputValue), false);
  assert.equal(serialised, 0, 'the unchanged boxes were compared by identity');
});

test('sameValue answers exactly as comparing JSON would', () => {
  const cases: unknown[] = [
    [], [1, 2], [2, 1], [undefined], [null], [[1]], [[1], [2]], { a: 1, b: 2 }, { b: 2, a: 1 }, { a: 1, b: undefined },
    { a: 1 }, { a: [1, { c: 2 }] }, { a: [1, { c: 3 }] }, { a: () => 1 }, {}, 'x', 1, true, null,
    { toJSON: () => 'x' }, [{ id: 'a' }, { id: 'b' }], [{ id: 'a' }, { id: 'c' }], { boxes: [{ id: 'a' }], n: 1 },
    { boxes: [{ id: 'a' }], n: 2 }, { n: 1, boxes: [{ id: 'a' }] },
  ];
  for (const a of cases) {
    for (const b of cases) {
      assert.equal(sameValue(a as InputValue, b as InputValue), JSON.stringify(a) === JSON.stringify(b), `${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
    }
  }
});

test('only a file input is walked for bytes: other inputs cannot hold them', () => {
  const bytes = { bytes: new Uint8Array([1]) };
  const h = createHistory({ coalesceMs: 0 });
  assert.equal(h.record({ ...edit('upload', null, bytes), inputType: 'file' }, 0), 'ignored', 'a file input carrying bytes is not recorded');
  assert.equal(h.record(edit('legacy', null, bytes), 1000), 'ignored', 'nor is an entry that does not say what it is');
  const rows = [{ id: 'a', image: { source: 'library', id: 'lolly/logo/primary' } }];
  assert.equal(h.record({ ...edit('boxes', [], rows), inputType: 'blocks' }, 2000), 'pushed', 'a blocks input is recorded without the walk');
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
