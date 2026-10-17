// SPDX-License-Identifier: MPL-2.0
/**
 * Layout participation for hidden and timed members, the rule documented in
 * docs/design-tool-contract.md. Visibility over time is checked through the authored
 * timing fields and the renderer's timeline, presenter and build attributes, never by
 * looking for a DOM node.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createDesignLayoutEvaluator,
  designLayoutSourceEdit,
  type LayoutEvaluation,
  type LayoutRequest,
} from '../engine/src/design-layout.ts';
import { loadLayoutKernel } from '../packages/node-shell/src/layout-kernel-node.ts';
import { createNodeLayout } from '../packages/node-shell/src/layout-host-node.ts';

type Row = Record<string, unknown>;
const solve = await loadLayoutKernel();
const box = (id: string, patch: Row = {}): Row => ({
  id,
  kind: 'box',
  x: 0,
  y: 0,
  w: 100,
  h: 40,
  rot: 0,
  ...patch,
});
const member = (id: string, patch: Row = {}) => box(id, { layoutOwner: 'root', ...patch });
const near = (actual: unknown, wanted: number) =>
  assert.ok(Math.abs(Number(actual) - wanted) < 0.03, `${actual} != ${wanted}`);
const geometry = (rows: readonly Row[]) => rows.map((r) => [r.id, r.x, r.y, r.w, r.h, r.rot]);
const evaluate = (rows: Row[], tracks: Row[] = []) => createDesignLayoutEvaluator(solve)(rows, tracks);

/** A flex row of three members; `b` takes the patch. */
const flexRow = (b: Row) => [
  box('root', { w: 400, h: 200, layout: 'flex', layoutGapX: 10 }),
  member('a'),
  member('b', { x: 333, y: 77, ...b }),
  member('c'),
];

// Every timing field Design writes. Each changes when or how a member is painted; none
// changes where the member is laid out.
const TIMED: Array<[string, Row]> = [
  ['not started yet', { start: 5, dur: 2 }],
  ['sequence lane', { lane: 'seq', start: 0, dur: 3 }],
  ['reversible cut', { lane: 'seq', start: 0, dur: 3, ignored: true }],
  ['enter transition', { start: 1, enter: 'fade', enterMs: 600, enterEase: 'smooth' }],
  ['exit transition', { start: 0, dur: 2, exit: 'slide-left', exitMs: 400 }],
  ['presenter enter and exit', { enter: 'rise', exit: 'drop' }],
  ['build step', { build: 2 }],
  ['keyframes', { kf: 't0_o0*t1_o100' }],
];

test('timed members keep their flex slot at every start, enter, exit and build state', async () => {
  const control = await evaluate(flexRow({}));
  assert.deepEqual(control.findings, []);
  assert.deepEqual(
    control.boxes.slice(1).map((r) => r.x),
    [0, 110, 220]
  );
  for (const [name, timing] of TIMED) {
    const timed = await evaluate(flexRow(timing));
    assert.deepEqual(timed.findings, [], name);
    assert.deepEqual(geometry(timed.boxes), geometry(control.boxes), name);
    assert.equal(timed.boxes[2]!.hidden, undefined, name);
    const hidden = await evaluate(flexRow({ ...timing, hidden: true }));
    assert.deepEqual(hidden.findings, [], name);
    assert.equal(hidden.boxes[3]!.x, 110, `${name}: a hidden member releases its slot`);
    assert.deepEqual(
      [hidden.boxes[2]!.x, hidden.boxes[2]!.y],
      [333, 77],
      `${name}: the solver does not place a hidden member`
    );
  }
});

test('timing edits reuse the evaluated layout and never reach the solver', async () => {
  const requests: LayoutRequest[] = [];
  const cached = createDesignLayoutEvaluator((request) => {
    requests.push(request);
    return solve(request);
  });
  const control = await cached(flexRow({}));
  const calls = requests.length;
  assert.ok(calls > 0);
  for (const [name, timing] of TIMED) {
    const timed = await cached(flexRow(timing));
    assert.equal(timed.solved, 0, name);
    assert.equal(timed.passes, 0, name);
    assert.deepEqual(geometry(timed.boxes), geometry(control.boxes), name);
  }
  assert.equal(requests.length, calls);
  const hidden = await cached(flexRow({ build: 2, hidden: true }));
  assert.ok(hidden.solved > 0);
  assert.equal(hidden.boxes[3]!.x, 110);
  // Visibility reaches the solver as two flags per item and nothing else.
  for (const request of requests)
    for (const item of request.items)
      assert.deepEqual(Object.keys(item).sort(), [
        'absolute',
        'align',
        'bounds',
        'cell',
        'hidden',
        'justify',
        'margin',
        'max',
        'min',
        'sizing',
      ]);
});

test('a hidden grid member releases its cell; a timed member keeps it', async () => {
  const tracks = [0, 1, 2].map((n) => ({
    id: `column-${n}`,
    container: 'root',
    axis: 'column',
    order: n,
    track: '100px',
  }));
  const grid = (b: Row) => [
    box('root', { w: 300, h: 100, layout: 'grid' }),
    member('a'),
    member('b', b),
    member('c'),
  ];
  const cells = (r: LayoutEvaluation) => r.grids[0]!.cells!.map((c) => [c.id, c.row, c.column]);
  for (const [name, timing] of TIMED) {
    const timed = await evaluate(grid(timing), tracks);
    assert.deepEqual(timed.findings, [], name);
    assert.deepEqual(cells(timed), [['a', 1, 1], ['b', 1, 2], ['c', 1, 3]], name);
    near(timed.boxes[3]!.x, 200);
  }
  const hidden = await evaluate(grid({ build: 1, hidden: true }), tracks);
  assert.deepEqual(cells(hidden), [['a', 1, 1], ['c', 1, 2]]);
  near(hidden.boxes[3]!.x, 100);
  // An explicit cell is not reserved while its member is hidden.
  const placed = await evaluate(grid({ layoutRow: 1, layoutColumn: 1, hidden: true }), tracks);
  assert.deepEqual(cells(placed), [['a', 1, 1], ['c', 1, 2]]);
});

test('a hidden container keeps its stored geometry and takes its members out of flow', async () => {
  const doc = (card: Row) => [
    box('root', { w: 600, h: 200, layout: 'flex', layoutGapX: 10 }),
    member('a'),
    member('card', {
      layout: 'flex',
      layoutW: 'hug',
      layoutH: 'hug',
      layoutPadLeft: 5,
      x: 400,
      y: 100,
      w: 77,
      h: 33,
      ...card,
    }),
    box('inner', { layoutOwner: 'card', x: 9, y: 9, w: 50, h: 20 }),
    member('c'),
  ];
  const shown = await evaluate(doc({}));
  assert.deepEqual(shown.findings, []);
  near(shown.boxes[2]!.w, 55);
  near(shown.boxes[2]!.h, 20);
  near(shown.boxes[4]!.x, 175);
  for (const [name, timing] of TIMED) {
    const timed = await evaluate(doc(timing));
    assert.deepEqual(timed.findings, [], name);
    assert.deepEqual(geometry(timed.boxes), geometry(shown.boxes), name);
    assert.equal(timed.boxes[3]!.hidden, undefined, `${name}: timing is not inherited`);
  }
  const source = doc({ hidden: true }),
    before = structuredClone(source);
  const hidden = await evaluate(source);
  assert.deepEqual(hidden.findings, []);
  assert.deepEqual(geometry(hidden.boxes.slice(2, 4)), geometry(source.slice(2, 4)));
  assert.equal(hidden.boxes[3]!.hidden, true);
  assert.equal(hidden.boxes[4]!.x, 110);
  assert.deepEqual(source, before);
  assert.deepEqual(designLayoutSourceEdit(source, hidden.boxes, hidden.boxes), source);
});

test('a hidden member stays attached to an owner that moves', async () => {
  const result = await evaluate([
    box('root', { w: 600, h: 200, layout: 'flex', layoutPadLeft: 50, layoutPadTop: 15 }),
    member('card', { layout: 'flex', w: 200, h: 100 }),
    box('ghost', { layoutOwner: 'card', x: 20, y: 30, hidden: true }),
  ]);
  assert.deepEqual(result.findings, []);
  near(result.boxes[1]!.x, 50);
  near(result.boxes[1]!.y, 15);
  near(result.boxes[2]!.x, 70);
  near(result.boxes[2]!.y, 45);
});

test('Hug sizing counts timed members and leaves hidden ones out', async () => {
  const measured: string[] = [];
  const measure = async (row: Row) => {
    measured.push(String(row.id));
    return { width: 80, height: 20 };
  };
  const doc = (b: Row) => [
    box('root', { w: 50, h: 50, layout: 'flex', layoutGapX: 10, layoutW: 'hug', layoutH: 'hug' }),
    member('a'),
    member('b', {
      kind: 'text',
      text: 'Shown on the second click',
      layoutW: 'hug',
      layoutH: 'hug',
      ...b,
    }),
  ];
  for (const [name, timing] of TIMED) {
    measured.length = 0;
    const timed = await createDesignLayoutEvaluator(solve, measure)(doc(timing));
    assert.deepEqual(timed.findings, [], name);
    assert.ok(measured.includes('b'), `${name}: a timed member is measured`);
    near(timed.boxes[0]!.w, 190);
    near(timed.boxes[2]!.w, 80);
  }
  measured.length = 0;
  const hidden = await createDesignLayoutEvaluator(solve, measure)(doc({ build: 2, hidden: true }));
  assert.deepEqual(hidden.findings, []);
  assert.deepEqual(measured, []);
  near(hidden.boxes[0]!.w, 100);
  const group = (leaf: Row) => [
    box('group', { kind: 'group', layoutW: 'hug', layoutH: 'hug' }),
    box('left', { group: 'group', w: 40, h: 20 }),
    box('right', { group: 'group', x: 60, w: 40, h: 20, ...leaf }),
  ];
  for (const [, timing] of TIMED) near((await evaluate(group(timing))).boxes[0]!.w, 100);
  near((await evaluate(group({ exit: 'fade', hidden: true }))).boxes[0]!.w, 40);
});

const layoutHost = await createNodeLayout();
const rendererSource = await readFile(new URL('../community/design/hooks.js', import.meta.url), 'utf8');
const renderer = new Function('host', `${rendererSource};return {compute:compute};`)({
  layout: layoutHost,
}) as { compute: (model: unknown[]) => Promise<Record<string, unknown>> };
type Painted = { id: string; boxStyle: string; timeAttrs: string; buildAttr: string };
const slide = async (b: Row) => {
  const out = await renderer.compute([
    {
      id: 'boxes',
      value: [
        box('slide', {
          kind: 'frame',
          w: 400,
          h: 200,
          layout: 'flex',
          layoutGapX: 10,
          layoutPadLeft: 20,
          layoutPadTop: 20,
        }),
        box('a', { layoutOwner: 'slide' }),
        box('b', { layoutOwner: 'slide', x: 300, y: 150, ...b }),
        box('c', { layoutOwner: 'slide' }),
      ],
    },
    { id: 'layoutTracks', value: [] },
  ]);
  const [page] = out.frameGroups as Array<{ children: Painted[] }>;
  return new Map(page!.children.map((child) => [String(child.id), child]));
};
const place = (child: Painted | undefined) =>
  /left:(-?[\d.]+)px;top:(-?[\d.]+)px;$/.exec(child?.boxStyle || '')?.slice(1).map(Number);

test('the renderer paints timeline, presenter and build state on a member whose slot stays reserved', async () => {
  const control = await slide({});
  assert.deepEqual(
    ['a', 'b', 'c'].map((id) => place(control.get(id))),
    [
      [20, 20],
      [130, 20],
      [240, 20],
    ]
  );
  const cases: Array<[Row, 'timeAttrs' | 'buildAttr', RegExp]> = [
    [
      { start: 1, dur: 2, enter: 'fade', exit: 'fade' },
      'timeAttrs',
      /data-t-start="1000".*data-t-enter="fade".*data-t-exit="fade"/,
    ],
    [{ enter: 'rise', exit: 'drop' }, 'timeAttrs', /data-pr-enter="rise".*data-pr-exit="drop"/],
    [{ build: 2 }, 'buildAttr', /data-build="2"/],
  ];
  for (const [timing, attr, pattern] of cases) {
    const painted = await slide(timing);
    assert.match(painted.get('b')![attr], pattern);
    for (const id of ['a', 'b', 'c'])
      assert.deepEqual(place(painted.get(id)), place(control.get(id)), `${id}: ${attr}`);
  }
  const hidden = await slide({ build: 2, hidden: true });
  assert.equal(hidden.has('b'), false);
  assert.deepEqual(place(hidden.get('c')), place(control.get('b')));
});
