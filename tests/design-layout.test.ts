// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDesignLayoutEvaluator,
  designLayoutSourceEdit,
  parseLayoutTrack,
  validateDesignLayout,
} from '../engine/src/design-layout.ts';
import { loadLayoutKernel } from '../packages/node-shell/src/layout-kernel-node.ts';
import { ReferenceCanvasDoc } from '../packages/core/src/canvas-op-v1.ts';
const solve = await loadLayoutKernel();
const box = (id: string, patch: Record<string, unknown> = {}): Record<string, unknown> & { id: string } => ({
  id,
  kind: 'box',
  x: 0,
  y: 0,
  w: 100,
  h: 40,
  rot: 0,
  ...patch,
});
const root = (patch: Record<string, unknown> = {}) =>
  box('root', { w: 400, h: 200, layout: 'flex', ...patch });
const child = (id: string, patch: Record<string, unknown> = {}) =>
  box(id, { layoutOwner: 'root', ...patch });
const near = (actual: unknown, wanted: number) =>
  assert.ok(Math.abs(Number(actual) - wanted) < 0.03, `${actual} != ${wanted}`);
const good = async (rows: ReturnType<typeof box>[], tracks: Record<string, unknown>[] = []) =>
  await createDesignLayoutEvaluator(solve)(rows, tracks);
test('modern flex: padding, gaps, fill limits, reverse direction, hidden and absolute members', async () => {
  const r = await good([
    root({ layoutPadLeft: 10, layoutGapX: 12 }),
    child('a'),
    child('b', { layoutW: 'fill', layoutMaxW: 180 }),
    child('hidden', { hidden: true }),
    child('badge', { layoutAbsolute: true, x: 360, y: 150 }),
  ]);
  assert.deepEqual(r.findings, []);
  near(r.boxes[1]!.x, 10);
  near(r.boxes[2]!.x, 122);
  near(r.boxes[2]!.w, 180);
  near(r.boxes[4]!.x, 360);
  const rev = await good([root({ layoutDirection: 'row-reverse' }), child('a'), child('b')]);
  assert.deepEqual(rev.findings, []);
  near(rev.boxes[1]!.x, 100);
  near(rev.boxes[2]!.x, 0);
});
test('modern flex wraps and hugs without mutating source', async () => {
  const source = [
    root({ w: 230, layoutWrap: true, layoutGapX: 10, layoutGapY: 8, layoutH: 'hug' }),
    child('a'),
    child('b'),
    child('c'),
  ];
  const before = JSON.stringify(source),
    r = await good(source);
  assert.deepEqual(r.findings, []);
  near(r.boxes[3]!.y, 48);
  near(r.boxes[0]!.h, 88);
  assert.equal(JSON.stringify(source), before);
});
test('empty nontext fields on imported containers do not request intrinsic fonts', async () => {
  const result = await good([
    root(),
    child('card', { layout: 'flex', layoutH: 'hug', text: '' }),
    box('leaf', { layoutOwner: 'card', text: '', h: 30 }),
  ]);
  assert.deepEqual(result.findings, []);
  near(result.boxes[1]!.h, 30);
});
test('modern grid: fixed, percentage, fractional tracks and column span', async () => {
  const tracks = ['100px', '25%', '1fr'].map((track, n) => ({
    id: `t${n}`,
    container: 'root',
    axis: 'column',
    order: n,
    track,
  }));
  tracks.push({ id: 'row', container: 'root', axis: 'row', order: 0, track: 'auto' });
  const r = await good(
    [
      root({ layout: 'grid' }),
      child('a', { layoutW: 'fill', layoutColumn: 1, layoutRow: 1 }),
      child('b', { layoutW: 'fill', layoutColumn: 2, layoutRow: 1, layoutColumnSpan: 2 }),
    ],
    tracks
  );
  assert.deepEqual(r.findings, []);
  near(r.boxes[1]!.w, 100);
  near(r.boxes[2]!.x, 100);
  near(r.boxes[2]!.w, 300);
});
test('rotated parent uses its own axes', async () => {
  const r = await good([root({ rot: 90 }), child('a', { rot: 90 }), child('b', { rot: 90 })]);
  assert.deepEqual(r.findings, []);
  near(r.boxes[1]!.x, 230);
  near(r.boxes[1]!.y, -70);
  near(r.boxes[2]!.y, 30);
  near(r.boxes[1]!.rot, 90);
});
test('nested hug/fill and width-dependent text settle through one solver', async () => {
  const measure = async (_r: Record<string, unknown>, width: number) => ({
    width: Math.min(200, width),
    height: width < 150 ? 80 : 40,
  });
  const evalLayout = createDesignLayoutEvaluator(solve, measure);
  const r = await evalLayout([
    root({ layoutDirection: 'column', layoutH: 'hug' }),
    child('card', { layout: 'flex', layoutDirection: 'column', layoutW: 'fill', layoutH: 'hug' }),
    box('label', { layoutOwner: 'card', text: 'Hello', layoutW: 'fill', layoutH: 'hug' }),
    child('footer'),
  ]);
  assert.deepEqual(r.findings, []);
  near(r.boxes[2]!.w, 400);
  near(r.boxes[2]!.h, 40);
  near(r.boxes[3]!.y, 40);
  near(r.boxes[0]!.h, 80);
});
test('source edit retains derived positions and artboard ownership, commits only content intent', async () => {
  const source = [{ ...root(), kind: 'frame' }, child('a'), child('b')];
  const evaluated = (await good(source)).boxes;
  const edited = evaluated.map((r) => (r.id === 'a' ? { ...r, text: 'changed' } : r));
  const next = designLayoutSourceEdit(source, evaluated, edited);
  assert.equal(next[2]!.x, 0);
  assert.equal(next[1]!.frame, undefined);
  assert.equal(next[1]!.text, 'changed');
});
test('ownership cycles created by two valid concurrent edits block after convergence, in either order and after checkpoint', () => {
  const rows = [box('a', { layout: 'flex' }), box('b', { layout: 'flex' })];
  assert.deepEqual(validateDesignLayout([{ ...rows[0], layoutOwner: 'b' }, rows[1]!]), []);
  assert.deepEqual(validateDesignLayout([rows[0]!, { ...rows[1], layoutOwner: 'a' }]), []);
  for (const reverse of [false, true]) {
    const crdt = new ReferenceCanvasDoc();
    for (const [n, row] of rows.entries())
      crdt.apply({
        k: 'add',
        id: row.id,
        row: row as never,
        orderKey: String(n),
        origin: { client: 'seed', clock: 1 },
      });
    const edits = [
      {
        k: 'field',
        id: 'a',
        field: 'layoutOwner',
        value: 'b',
        origin: { client: 'alice', clock: 5 },
      },
      {
        k: 'field',
        id: 'b',
        field: 'layoutOwner',
        value: 'a',
        origin: { client: 'bob', clock: 5 },
      },
    ];
    for (const edit of reverse ? edits.reverse() : edits) crdt.apply(edit as never);
    const restored = new ReferenceCanvasDoc();
    restored.restore(crdt.checkpoint());
    assert.deepEqual(restored.state(), crdt.state());
    assert.ok(
      validateDesignLayout([...crdt.state().boxes.values()]).some(
        (f) => f.code === 'layout.owner-cycle'
      )
    );
  }
});
test('track choices are atomic scalars and invalid values are diagnosed', () => {
  assert.deepEqual(parseLayoutTrack('2fr'), { kind: 'fr', value: 2 });
  assert.throws(() => parseLayoutTrack('{"type":"fr"}'));
  const findings = validateDesignLayout(
    [root({ layout: 'grid' })],
    [{ id: 't', container: 'root', axis: 'column', track: '-3px' }]
  );
  assert.ok(findings.some((f) => f.code === 'layout.track'));
});
test('unrelated content changes reuse solver answers; static documents preserve the exact array', async () => {
  const evaluate = createDesignLayoutEvaluator(solve);
  const rows = [root(), child('a'), box('outside', { x: 700 })];
  await evaluate(rows);
  const r = await evaluate(rows.map((b) => (b.id === 'outside' ? { ...b, text: 'new' } : b)));
  assert.equal(r.solved, 0);
  assert.deepEqual(r.findings, []);
  const staticRows = [box('old')];
  assert.equal((await evaluate(staticRows)).boxes, staticRows);
});

test('intrinsic image dimensions and inherited visibility remain disposable', async () => {
  const source = [
    root({ hidden: true }),
    child('image', {
      kind: 'image',
      layoutW: 'fill',
      layoutH: 'hug',
      image: { width: 800, height: 400 },
    }),
  ];
  const hidden = await good(source);
  assert.deepEqual(hidden.findings, []);
  assert.equal(hidden.boxes[1]!.hidden, true);
  assert.equal(source[1]!.hidden, undefined);
  const visible = await good(source.map((r) => (r.id === 'root' ? { ...r, hidden: false } : r)));
  assert.deepEqual(visible.findings, []);
  near(visible.boxes[1]!.h, 200);
  const restored = designLayoutSourceEdit(source, hidden.boxes, hidden.boxes);
  assert.equal(restored[1]!.hidden, undefined);
});
test('whole projection cache keeps content updates and invalidates resource revisions', async () => {
  let calls = 0;
  const evaluate = createDesignLayoutEvaluator((r) => {
    calls++;
    return solve(r);
  });
  const source = [root(), child('a'), child('b'), box('outside')];
  await evaluate(source, [], 1);
  const first = calls;
  const updated = await evaluate(
    source.map((b) => (b.id === 'outside' ? { ...b, x: 123, text: 'new' } : b)),
    [],
    1
  );
  assert.equal(calls, first);
  assert.equal(updated.boxes[3]!.x, 123);
  assert.equal(updated.boxes[3]!.text, 'new');
  const refreshed = await evaluate(source, [], 2);
  assert.ok(refreshed.passes > 0);
});
