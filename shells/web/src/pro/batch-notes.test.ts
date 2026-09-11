// SPDX-License-Identifier: MPL-2.0
/**
 * The per-row DIAGNOSTIC CHANNEL, against the real `planBatch`/`runBatch`.
 * Run directly:  node --test shells/web/src/pro/batch-notes.test.ts
 *
 * What is under test is not the payload - its element type is Phase 1's and this
 * module declares none. It is the CHANNEL and the row IDENTITY: a note handed in
 * against row k comes back out against row k, and the mapping survives planBatch's
 * compaction. The fixtures use plain strings and objects precisely to demonstrate
 * that nothing in the path inspects an element.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planBatch, runBatch, notesFromFindings, type BatchRow, type BatchProgress } from './batch.ts';

const row = (toolId: string, uid: string): BatchRow => ({ toolId, values: {}, uid });

/** A host stub: runBatch only reaches `log` here, since every render throws. */
const HOST = { log: () => {} } as unknown as Parameters<typeof runBatch>[1];

test('planBatch findings flatten to a dense array parallel to the renderable rows', () => {
  const notes = notesFromFindings([{ rowIndex: 2, items: ['c'] }, { rowIndex: 0, items: ['a'] }], 4);
  assert.equal(notes.length, 4);
  assert.deepEqual([...notes], [['a'], undefined, ['c'], undefined]);
});

test('a skipped row’s findings never enter the runner channel', () => {
  // rowIndex -1 is planBatch's marker for "dropped, so it has no queue position".
  const notes = notesFromFindings([{ rowIndex: -1, items: ['skipped'] }, { rowIndex: 9, items: ['oob'] }], 2);
  assert.deepEqual([...notes], [undefined, undefined]);
});

test('planBatch keys findings by QUEUE position while reporting the source position', async () => {
  const rows = [row('a', 'u1'), row('render-only', 'u2'), row('c', 'u3')];
  const plan = await planBatch<string>(rows, {
    getTool: async (id) => ({ manifest: { id } }),
    isExportable: (m: any) => m.id !== 'render-only',
    check: (r, rowIndex, ctx) => [`${r.uid}@q${rowIndex}@s${ctx.srcIndex}`],
  });
  assert.deepEqual(plan.renderable.map(r => r.uid), ['u1', 'u3']);
  assert.deepEqual(plan.srcIndex, [0, 2]);
  assert.deepEqual(plan.skipped.map(s => s.srcIndex), [1]);
  // The third row's queue position is 1 but its source position is 2 - the exact gap
  // that makes an index captured before planBatch point at the wrong row afterwards.
  assert.deepEqual(plan.findings, [
    { rowIndex: 0, uid: 'u1', items: ['u1@q0@s0'] },
    { rowIndex: -1, uid: 'u2', items: ['u2@q-1@s1'] },
    { rowIndex: 1, uid: 'u3', items: ['u3@q1@s2'] },
  ]);

  // …and the dense channel built from it lines up with `renderable`, not with `rows`.
  const notes = notesFromFindings(plan.findings, plan.renderable.length);
  assert.deepEqual([...notes], [['u1@q0@s0'], ['u3@q1@s2']]);
});

test('runBatch re-emits each row’s notes on its result and its progress event', async () => {
  const rows = [row('a', 'u1'), row('b', 'u2')];
  const notes = [['first'], ['second']];
  const seen: BatchProgress<string>[] = [];
  // Every render throws here (no catalog, no DOM) - which is the error arm, and the
  // arm that matters most: a row that produced no file is exactly the one a report
  // has to name correctly.
  const { results } = await runBatch<string>(rows, HOST, {
    notes,
    onProgress: (p) => seen.push(p),
  });
  assert.equal(results.length, 2);
  assert.deepEqual(results.map(r => r.notes), [['first'], ['second']]);
  const errors = seen.filter(p => p.status === 'error');
  assert.deepEqual(errors.map(p => (p as { notes?: readonly string[] }).notes), [['first'], ['second']]);
  assert.deepEqual(errors.map(p => p.index), [0, 1]);
});

test('the payload is opaque - runBatch never inspects an element', async () => {
  const marker = Symbol('finding');
  const payload = [{ id: 'print.no-bleed', [marker]: true }];
  const { results } = await runBatch<{ id: string }>([row('a', 'u1')], HOST, { notes: [payload] });
  // Identity, not equality: the array is handed through by reference, untouched.
  assert.equal(results[0]!.notes, payload);
  assert.equal((results[0]!.notes![0] as Record<symbol, unknown>)[marker], true);
});

test('a notes array of the wrong length is dropped, never mis-attributed', async () => {
  const warned: string[] = [];
  const host = { log: (_l: string, m: string) => warned.push(m) } as unknown as Parameters<typeof runBatch>[1];
  const { results } = await runBatch<string>([row('a', 'u1'), row('b', 'u2')], host, { notes: [['only-one']] });
  assert.deepEqual(results.map(r => r.notes), [undefined, undefined]);
  assert.equal(warned.length, 1);
  assert.match(warned[0]!, /notes\/rows length mismatch/);
});

test('an empty notes entry is absent, not an empty array', async () => {
  const { results } = await runBatch<string>([row('a', 'u1')], HOST, { notes: [[]] });
  assert.equal(results[0]!.notes, undefined);
});
