// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { layoutOps } from './layout.ts';
import {
  dynamicScope,
  flowOrder,
  gridCellAt,
  gridCellPolygon,
  relativePlacement,
} from './shared.ts';
import { selectOps } from './select.ts';
import { opsOps } from './ops.ts';
import { modesOps } from './modes.ts';
import { beginGesture } from './gestures.ts';
import type { FcCtx } from './context.ts';
import type { Box } from '../free-canvas-math.ts';
import type { GridProjection } from './shared.ts';
import type { LayoutClipboard } from './shared.ts';
import type { GestureInit } from './shared.ts';

const copy = <T>(value: T): T => structuredClone(value);
const safeJson = (value: unknown): string =>
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
function fixture(
  initial: Box[],
  initialTracks: Box[] = [],
  evaluated: Box[] = initial,
  initialGrids: GridProjection[] = []
) {
  let model: Record<string, unknown> = { boxes: copy(initial), layoutTracks: copy(initialTracks) };
  const extras: Record<string, string> = {
    layoutBoxesJson: safeJson(evaluated),
    layoutSourceJson: safeJson(model.boxes),
    layoutGridsJson: safeJson(initialGrids),
  };
  const undo: Record<string, unknown>[] = [],
    redo: Record<string, unknown>[] = [],
    writes: Array<{ values: Record<string, unknown>; label: string }> = [];
  const dirty: string[] = [],
    errors: string[] = [];
  const apply = (values: Record<string, unknown>, label: string) => {
    undo.push(copy(model));
    redo.length = 0;
    writes.push({ values: copy(values), label });
    model = { ...model, ...values };
  };
  const fc = {
    blockId: 'boxes',
    cfg: {
      idField: 'id',
      kindField: 'kind',
      xField: 'x',
      yField: 'y',
      wField: 'w',
      hField: 'h',
      rotationField: 'rot',
    },
    hasIdField: true,
    frameCfg: { frameKind: 'frame', frameField: 'frame', orderField: 'order' },
    cv: {},
    selection: new Set<string>(),
    runtime: {
      getModel: () => Object.entries(model).map(([id, value]) => ({ id, value })),
      getHydratedText: (text: string) => extras[text.slice(3, -3)] || '',
      setInput: (id: string, value: unknown) => apply({ [id]: value }, 'Edit box'),
    },
    history: {
      commit: async (values: Record<string, unknown>, label: string) => {
        apply(values, label);
      },
      undo: () => {
        const previous = undo.pop();
        if (previous) {
          redo.push(copy(model));
          model = previous;
        }
      },
      redo: () => {
        const next = redo.pop();
        if (next) {
          undo.push(copy(model));
          model = next;
        }
      },
    },
    onDirty: (id: string) => dirty.push(id),
    opts: { canEdit: () => true },
    FRAME_DUP_GAP: 56,
    disposed: false,
    stage: {
      flash: () => {},
      metrics: () => ({ scale: 1 }),
      nativeToStage: (x: number, y: number) => ({ x, y }),
      clientToNative: (x: number, y: number) => ({ x, y }),
    },
    document: { clampToWorkArea: (row: Box) => row },
    objects: { freshGroupId: () => 'group' },
    chromeSync: { renderChrome: () => {} },
    storyFlow: {
      reconcile: () => false,
      paste: async (
        _payload: LayoutClipboard,
        boxes: Box[],
        _copies: Map<string, string>,
        selected: Set<string>,
        patch: Record<string, unknown>
      ) => {
        fc.selection = selected;
        fc.select.commit(boxes, patch, 'Paste layout');
      },
    },
  } as unknown as FcCtx;
  fc.layout = layoutOps(fc);
  fc.layout.failure = (error) =>
    errors.push(error instanceof Error ? error.message : String(error));
  fc.select = selectOps(fc);
  fc.ops = opsOps(fc);
  fc.modes = modesOps(fc);
  return {
    fc,
    writes,
    dirty,
    errors,
    extras,
    boxes: () => model.boxes as Box[],
    tracks: () => model.layoutTracks as Box[],
    setReceipt: (shown: Box[], grid: GridProjection[] = initialGrids) => {
      extras.layoutSourceJson = safeJson(model.boxes);
      extras.layoutBoxesJson = safeJson(shown);
      extras.layoutGridsJson = safeJson(grid);
    },
  };
}
const root: Box = {
  id: 'root',
  kind: 'box',
  x: 10,
  y: 20,
  w: 300,
  h: 100,
  rot: 0,
  layout: 'flex',
  layoutDirection: 'row',
};
const a: Box = {
  id: 'a',
  kind: 'box',
  x: 77,
  y: 88,
  w: 40,
  h: 30,
  rot: 0,
  layoutOwner: 'root',
  frame: '',
  layoutOrder: 0,
  layoutW: 'fill',
  layoutH: 'fixed',
};
const b: Box = {
  id: 'b',
  kind: 'box',
  x: 99,
  y: 100,
  w: 40,
  h: 30,
  rot: 0,
  layoutOwner: 'root',
  frame: '',
  layoutOrder: 1,
};
const shown = [root, { ...a, x: 10, y: 20, w: 60 }, { ...b, x: 70, y: 20 }];
const track = { id: 'track', container: 'root', axis: 'column', order: 0, track: '1fr' };

test('projection receipts follow source identity and reject stale or malformed geometry', () => {
  const f = fixture([root, a, b], [], shown);
  const first = f.fc.select.getBoxes();
  assert.equal(first[1]!.x, 10);
  assert.equal(f.fc.select.getBoxes(), first);
  f.fc.select.commit(first.map((row) => (row.id === 'a' ? { ...row, fill: '#fff' } : row)));
  assert.equal(
    f.fc.select.getBoxes(),
    f.boxes(),
    'pending source edits do not reuse old evaluated receipts'
  );
  f.setReceipt(shown.map((row) => (row.id === 'a' ? { ...row, fill: '#fff' } : row)));
  assert.notEqual(f.fc.select.getBoxes(), f.boxes());
  f.extras.layoutBoxesJson = '[{"id":"wrong"}]';
  assert.equal(f.fc.select.getBoxes(), f.boxes());
  f.extras.layoutBoxesJson = '{bad';
  assert.equal(f.fc.select.getBoxes(), f.boxes());
});

test('pending layout receipts reject pose-dependent edits without writing authored positions', () => {
  const loose: Box = { id: 'loose', x: 400, y: 20, w: 20, h: 20 };
  const cases: Array<[string, string, Partial<Box>]> = [
    ['move', 'a', { x: 500 }],
    ['resize', 'a', { w: 100 }],
    ['rotate', 'a', { rot: 20 }],
    ['disable', 'root', { layout: 'none' }],
    ['detach', 'a', { layoutOwner: '' }],
    ['attach', 'loose', { layoutOwner: 'root' }],
    ['absolute', 'a', { layoutAbsolute: true }],
    ['container move', 'root', { x: 100 }],
  ];
  for (const [operation, id, patch] of cases) {
    const f = fixture([root, a, b, loose], [], [...shown, loose]);
    f.fc.select.commit(
      f.fc.select.getBoxes().map((row) => (row.id === 'root' ? { ...row, layoutGapX: 5 } : row))
    );
    const pending = copy(f.boxes());
    f.fc.select.commit(
      f.fc.select.getBoxes().map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
    assert.deepEqual(f.boxes(), pending, operation);
    assert.equal(f.writes.length, 1, operation);
    assert.match(f.errors[0]!, /finish rendering/, operation);
  }
});

test('pending content and intent edits remain available and fresh placement resumes after evaluation', () => {
  const f = fixture([root, a, b], [], shown);
  f.fc.select.commit(
    f.fc.select.getBoxes().map((row) => (row.id === 'root' ? { ...row, layoutGapX: 5 } : row))
  );
  f.fc.select.commit(
    f.fc.select
      .getBoxes()
      .map((row) => (row.id === 'a' ? { ...row, text: 'Pending content', layoutOrder: 2 } : row))
  );
  assert.equal(f.writes.length, 2);
  assert.deepEqual([f.boxes()[1]!.w, f.boxes()[1]!.layoutW, f.boxes()[1]!.x], [a.w, 'fill', a.x]);
  assert.equal(f.errors.length, 0);
  assert.equal(f.fc.layout.gestureReady('move'), false);
  assert.equal(f.fc.layout.gestureReady('marquee'), true);
  beginGesture(f.fc, {} as PointerEvent, { type: 'move' } as GestureInit);
  assert.equal(f.fc.gesture, undefined, 'no placement preview starts from raw source positions');
  f.setReceipt([root, { ...f.boxes()[1], x: 80, y: 20, w: 90 }, { ...b, x: 10, y: 20 }]);
  assert.equal(f.fc.layout.gestureReady('move'), true);
  f.fc.select.commit(
    f.fc.select.getBoxes().map((row) => (row.id === 'root' ? { ...row, layout: 'none' } : row))
  );
  assert.equal(f.writes.length, 3);
  assert.deepEqual([f.boxes()[1]!.x, f.boxes()[1]!.w], [80, 90]);
});

test('malformed receipts block placement while invalid ownership can still be repaired', () => {
  const f = fixture([root, a], [], [root, shown[1]!]);
  f.extras.layoutBoxesJson = '{bad';
  f.fc.select.commit(
    f.fc.select.getBoxes().map((row) => (row.id === 'root' ? { ...row, layout: 'none' } : row))
  );
  assert.equal(f.writes.length, 0);
  const child: Box = { ...a, layoutOwner: 'missing' },
    recovery = fixture([root, child]);
  recovery.extras.layoutSourceJson = 'stale';
  recovery.fc.select.commit(
    recovery.fc.select.getBoxes().map((row) => (row.id === 'a' ? { ...row, layoutOwner: '' } : row))
  );
  assert.equal(recovery.errors.length, 0);
  assert.equal(recovery.writes.length, 1);
  assert.equal(recovery.boxes()[1]!.layoutOwner, '');
});

test('content-only commits restore authored dimensions and ownership without altering siblings', () => {
  const f = fixture([root, a, b], [], shown),
    original = copy(f.boxes());
  const projected = f.fc.select.getBoxes();
  f.fc.select.commit(projected.map((row) => (row.id === 'a' ? { ...row, text: 'Updated' } : row)));
  assert.equal(f.writes.length, 1);
  assert.deepEqual(f.boxes()[2], original[2]);
  assert.deepEqual({ ...f.boxes()[1], text: undefined }, { ...original[1], text: undefined });
  assert.equal(projected[1]!.x, 10, 'editing source does not mutate the cached projection');
});

test('moving a flex item stores order and preserves its authored pose', () => {
  const f = fixture([root, a, b], [], shown);
  f.fc.select.commit(
    f.fc.select.getBoxes().map((row) => (row.id === 'a' ? { ...row, x: 150 } : row))
  );
  assert.deepEqual(
    f
      .boxes()
      .slice(1)
      .map((row) => [row.id, row.layoutOrder]),
    [
      ['a', 1],
      ['b', 0],
    ]
  );
  assert.deepEqual([f.boxes()[1]!.x, f.boxes()[1]!.y], [a.x, a.y]);
  f.fc.history!.undo();
  assert.deepEqual(f.boxes(), [root, a, b]);
  f.fc.history!.redo();
  assert.equal(f.boxes()[1]!.layoutOrder, 1);
});

test('reverse flow insertion uses visual direction while keeping a stable authored order', () => {
  const parent = { ...root, layoutDirection: 'row-reverse' },
    rows = [parent, { ...a, x: 100 }, { ...b, x: 20 }];
  const order = flowOrder(rows, parent, new Set(['b']), { ...b, x: 180 });
  assert.deepEqual(
    [...order],
    [
      ['b', 0],
      ['a', 1],
    ]
  );
});

test('resizing a flow child fixes only the dimension the gesture changed', () => {
  const child: Box = { ...a, layoutW: 'fill', layoutH: 'hug' },
    f = fixture([root, child, b], [], [root, { ...shown[1], layoutH: 'hug' }, shown[2]!]);
  f.fc.select.commit(
    f.fc.select.getBoxes().map((row) => (row.id === 'a' ? { ...row, w: 80 } : row))
  );
  assert.deepEqual(
    [f.boxes()[1]!.w, f.boxes()[1]!.layoutW, f.boxes()[1]!.layoutH, f.boxes()[1]!.x],
    [80, 'fixed', 'hug', child.x]
  );
});

test('container movement and static-frame rehome leave nested source placements untouched', () => {
  const absolute = { ...b, layoutAbsolute: true, layoutX: 70, layoutY: 4, layoutAngle: 0 },
    f = fixture(
      [root, a, absolute],
      [],
      [root, shown[1]!, { ...shown[2], ...absolute, x: 80, y: 24 }]
    );
  const before = f.fc.select.getBoxes();
  f.fc.select.commit(
    before.map((row) => ({ ...row, x: Number(row.x) + 50, y: Number(row.y) + 30 }))
  );
  assert.deepEqual(f.boxes()[1], a);
  assert.deepEqual(f.boxes()[2], absolute);
  assert.deepEqual([f.boxes()[0]!.x, f.boxes()[0]!.y], [60, 50]);
});

test('absolute offsets and relative rotation use the rotated NW corner', () => {
  const parent: Box = { id: 'p', x: 0, y: 0, w: 100, h: 100, rot: 90 };
  const child: Box = { id: 'c', x: 60, y: 10, w: 20, h: 10, rot: 90 };
  const local = relativePlacement(child, parent);
  assert.ok(Math.abs(local.layoutX - 5) < 1e-9);
  assert.ok(Math.abs(local.layoutY - 25) < 1e-9);
  assert.equal(local.layoutAngle, 0);
  const f = fixture(
    [root, { ...a, layoutAbsolute: true, layoutX: 0, layoutY: 0, layoutAngle: 0 }],
    [],
    [root, { ...shown[1], layoutAbsolute: true, layoutX: 0, layoutY: 0, layoutAngle: 0 }]
  );
  f.fc.select.commit(
    f.fc.select.getBoxes().map((row) => (row.id === 'a' ? { ...row, x: 30, y: 40 } : row))
  );
  assert.deepEqual(
    [f.boxes()[1]!.x, f.boxes()[1]!.y, f.boxes()[1]!.layoutX, f.boxes()[1]!.layoutY],
    [77, 88, 20, 20]
  );
});

const gridRoot: Box = { ...root, layout: 'grid' };
const grid: GridProjection = {
  id: 'root',
  columns: [
    [10, 20, 110, 20, 100],
    [120, 20, 220, 20, 100],
  ],
  rows: [
    [10, 20, 10, 60, 40],
    [10, 70, 10, 110, 40],
  ],
};
test('grid drops use solver track anchors, preserve spans and clear a former named area', () => {
  const child = { ...a, layoutRowSpan: 2, layoutColumnSpan: 1, layoutArea: 'hero' },
    f = fixture([gridRoot, child], [track], [gridRoot, { ...child, x: 10, y: 20 }], [grid]);
  f.fc.select.commit(
    f.fc.select.getBoxes().map((row) => (row.id === 'a' ? { ...row, x: 150, y: 72 } : row))
  );
  assert.deepEqual(
    [
      f.boxes()[1]!.layoutRow,
      f.boxes()[1]!.layoutColumn,
      f.boxes()[1]!.layoutRowSpan,
      f.boxes()[1]!.layoutArea,
    ],
    [2, 2, 2, '']
  );
  assert.equal(f.boxes()[1]!.x, a.x);
  assert.deepEqual(gridCellAt(gridRoot, grid, 116, 68), { layoutColumn: 2, layoutRow: 2 });
  assert.deepEqual(gridCellPolygon(gridRoot, grid, 2, 2), [
    { x: 120, y: 70 },
    { x: 220, y: 70 },
    { x: 220, y: 110 },
    { x: 120, y: 110 },
  ]);
});

test('rotated grid cell polygons and picking share the parent axes', () => {
  const parent: Box = { ...gridRoot, x: 0, y: 0, w: 100, h: 100, rot: 90 };
  const rotated: GridProjection = {
    id: 'root',
    columns: [
      [100, 0, 100, 40, 40],
      [100, 50, 100, 100, 50],
    ],
    rows: [
      [100, 0, 60, 0, 40],
      [50, 0, 0, 0, 50],
    ],
  };
  assert.deepEqual(gridCellAt(parent, rotated, 25, 70), { layoutColumn: 2, layoutRow: 2 });
  const points = gridCellPolygon(parent, rotated, 2, 2);
  [
    [50, 50],
    [50, 100],
    [0, 100],
    [0, 50],
  ].forEach(([x, y], i) => {
    assert.ok(Math.abs(points[i]!.x - x!) < 1e-9);
    assert.ok(Math.abs(points[i]!.y - y!) < 1e-9);
  });
});

test('disabling a grid materializes children and removes its tracks in one undoable transaction', () => {
  const f = fixture([gridRoot, a, b], [track], [gridRoot, shown[1]!, shown[2]!]);
  f.fc.select.commit(
    f.fc.select.getBoxes().map((row) => (row.id === 'root' ? { ...row, layout: 'none' } : row))
  );
  assert.equal(f.writes.length, 1);
  assert.deepEqual(Object.keys(f.writes[0]!.values).sort(), ['boxes', 'layoutTracks']);
  assert.deepEqual(f.tracks(), []);
  assert.equal(f.boxes()[1]!.layoutOwner, '');
  assert.equal(f.boxes()[1]!.x, 10);
  assert.equal(f.boxes()[1]!.w, 60);
  f.fc.history!.undo();
  assert.deepEqual(f.boxes(), [gridRoot, a, b]);
  assert.deepEqual(f.tracks(), [track]);
  f.fc.history!.redo();
  assert.equal(f.boxes()[1]!.layoutOwner, '');
  assert.deepEqual(f.tracks(), []);
});

test('enabling a static artboard gives existing members one source owner', () => {
  const page: Box = { id: 'page', kind: 'frame', x: 0, y: 0, w: 500, h: 300, order: 0 },
    child: Box = { ...a, layoutOwner: '', frame: 'page' };
  const f = fixture([page, child]);
  f.fc.select.commit(
    f.fc.select.getBoxes().map((row) => (row.id === 'page' ? { ...row, layout: 'flex' } : row))
  );
  assert.equal(f.boxes()[1]!.layoutOwner, 'page');
  assert.equal(f.boxes()[1]!.frame, '');
  assert.equal(f.boxes()[1]!.layoutOrder, 0);
  assert.equal(f.errors.length, 0);
});

test('dynamic deletion removes nested scopes and tracks while static artboard deletion rehomes them', () => {
  const page1: Box = { id: 'page1', kind: 'frame', x: 0, y: 0, w: 300, h: 300, order: 0 };
  const page2: Box = { id: 'page2', kind: 'frame', x: 400, y: 0, w: 300, h: 300, order: 1 };
  const layout = { ...gridRoot, frame: 'page2', x: 420 },
    child = { ...a, layoutOwner: 'root' },
    loose = { id: 'loose', x: 750, y: 30, w: 20, h: 20 };
  const projected = [page1, page2, layout, { ...child, x: 420, y: 20, frame: 'page2' }, loose];
  const f = fixture([page1, page2, layout, child, loose], [track], projected);
  f.fc.selection = new Set(['page2']);
  f.fc.ops.deleteSelection();
  assert.deepEqual(
    f.boxes().map((row) => row.id),
    ['page1', 'root', 'a', 'loose']
  );
  assert.equal(f.boxes()[1]!.frame, 'page1');
  assert.equal(f.boxes()[1]!.x, 20);
  assert.deepEqual(f.boxes()[2], child);
  assert.deepEqual(f.tracks(), [track]);
  f.fc.history!.undo();
  f.fc.selection = new Set(['root']);
  f.fc.ops.deleteSelection();
  assert.deepEqual(
    f.boxes().map((row) => row.id),
    ['page1', 'page2', 'loose']
  );
  assert.deepEqual(f.tracks(), []);
  assert.deepEqual(Object.keys(f.writes.at(-1)!.values).sort(), ['boxes', 'layoutTracks']);
});

test('deep duplicate remaps owners and typed tracks in one history entry', () => {
  const nested = { ...gridRoot, id: 'nested', layoutOwner: 'root', frame: '' },
    child = { ...a, layoutOwner: 'nested' },
    nestedTrack = { ...track, container: 'nested' };
  const f = fixture([root, nested, child], [nestedTrack]);
  f.fc.selection = new Set(['root']);
  f.fc.ops.duplicateSelection();
  assert.equal(f.errors.length, 0);
  assert.equal(f.writes.length, 1);
  assert.equal(f.boxes().length, 6);
  assert.equal(f.tracks().length, 2);
  const clones = f.boxes().slice(3),
    rootCopy = clones[0]!,
    nestedCopy = clones[1]!,
    childCopy = clones[2]!;
  assert.notEqual(rootCopy.id, root.id);
  assert.equal(nestedCopy.layoutOwner, rootCopy.id);
  assert.equal(childCopy.layoutOwner, nestedCopy.id);
  assert.equal(childCopy.frame, '');
  assert.equal(f.tracks()[1]!.container, nestedCopy.id);
  assert.notEqual(f.tracks()[1]!.id, nestedTrack.id);
  f.fc.history!.undo();
  assert.equal(f.boxes().length, 3);
  assert.equal(f.tracks().length, 1);
  f.fc.history!.redo();
  assert.equal(f.boxes().length, 6);
  assert.equal(f.tracks().length, 2);
});

test('copy detaches a lone flow child and paste remaps a full nested layout and tracks', async () => {
  const f = fixture([gridRoot, a, b], [track], [gridRoot, shown[1]!, shown[2]!]);
  const single = f.fc.modes.copyRows(f.fc.select.getBoxes(), [1]);
  assert.equal(single[0]!.layoutOwner, '');
  assert.equal(single[0]!.x, 10);
  assert.equal(single[0]!.w, 60);
  const copied = f.fc.modes.copyRows(f.fc.select.getBoxes(), [0]);
  const payload: LayoutClipboard = {
    version: 2,
    boxes: copied,
    textDocument: '',
    layoutTracks: [track],
  };
  f.fc.modes.pasteObjects(payload);
  await Promise.resolve();
  assert.equal(f.writes.length, 1);
  assert.equal(f.errors.length, 0);
  assert.equal(f.boxes().length, 6);
  const parent = f.boxes()[3]!,
    children = f.boxes().slice(4);
  assert.ok(children.every((row) => row.layoutOwner === parent.id && row.frame === ''));
  assert.equal(f.tracks()[1]!.container, parent.id);
  f.fc.history!.undo();
  assert.equal(f.boxes().length, 3);
  assert.equal(f.tracks().length, 1);
});

test('drop attaches, captures relative placement, and Alt detach materializes the shown pose', () => {
  const loose = { id: 'loose', x: 400, y: 200, w: 30, h: 20, rot: 0 },
    f = fixture([root, a, loose], [], [root, shown[1]!, loose]);
  const before = f.fc.select.getBoxes(),
    moved = before.map((row) => (row.id === 'loose' ? { ...row, x: 50, y: 40 } : row));
  f.fc.select.commit(f.fc.layout.drop(before, moved, [2], false));
  assert.equal(f.boxes()[2]!.layoutOwner, 'root');
  assert.equal(f.boxes()[2]!.frame, '');
  assert.deepEqual([f.boxes()[2]!.layoutX, f.boxes()[2]!.layoutY], [40, 20]);
  const projected = [root, shown[1]!, { ...f.boxes()[2], x: 130, y: 20 }];
  f.setReceipt(projected);
  f.fc.select.commit(
    f.fc.layout.drop(
      f.fc.select.getBoxes(),
      projected.map((row) => (row.id === 'loose' ? { ...row, x: 160, y: 70 } : row)),
      [2],
      true
    )
  );
  assert.equal(f.boxes()[2]!.layoutOwner, '');
  assert.deepEqual([f.boxes()[2]!.x, f.boxes()[2]!.y], [160, 70]);
});

test('ownership cycles are refused without writes or source mutation', () => {
  const nested = { ...root, id: 'nested', layoutOwner: 'root', frame: '' },
    f = fixture([root, nested]);
  const original = copy(f.boxes());
  f.fc.select.commit(
    f.fc.select
      .getBoxes()
      .map((row) => (row.id === 'root' ? { ...row, layoutOwner: 'nested' } : row))
  );
  assert.deepEqual(f.boxes(), original);
  assert.equal(f.writes.length, 0);
  assert.match(f.errors[0]!, /cycle/);
});

test('overlay uses solver cells and spacing controls commit once or cancel without writing', () => {
  const dom = new JSDOM(
    '<!doctype html><body><div id="overlay"><div id="chrome"></div></div></body>'
  );
  const f = fixture([gridRoot, a], [track], [gridRoot, shown[1]!], [grid]);
  f.fc.overlay = dom.window.document.querySelector<HTMLDivElement>('#overlay')!;
  f.fc.chrome = dom.window.document.querySelector<HTMLDivElement>('#chrome')!;
  f.fc.selection = new Set(['root']);
  f.fc.layout.paint();
  assert.equal(f.fc.overlay.querySelectorAll('polygon').length, 4);
  assert.equal(f.writes.length, 0);
  const handle = f.fc.overlay.querySelector<HTMLButtonElement>(
    '[data-layout-spacing="layoutGapX"]'
  )!;
  handle.dispatchEvent(
    new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
  );
  assert.equal(f.writes.length, 1);
  assert.equal(f.boxes()[0]!.layoutGapX, 1);
  const pointer = (type: string, x: number) => {
    const e = new dom.window.MouseEvent(type, { clientX: x, clientY: 0, button: 0, bubbles: true });
    Object.defineProperty(e, 'pointerId', { value: 7 });
    handle.dispatchEvent(e);
  };
  pointer('pointerdown', 0);
  pointer('pointermove', 10);
  pointer('pointermove', 20);
  pointer('pointercancel', 20);
  assert.equal(f.writes.length, 1);
  pointer('pointerdown', 0);
  pointer('pointermove', 10);
  pointer('pointermove', 20);
  pointer('pointerup', 20);
  assert.equal(f.writes.length, 2);
  assert.equal(f.boxes()[0]!.layoutGapX, 20);
  dom.window.close();
});

test('dynamic scope cannot swallow children of a static artboard', () => {
  const page = { id: 'page', kind: 'frame', x: 0, y: 0, w: 400, h: 400 },
    nested = { ...root, frame: 'page' },
    child = { ...a, frame: 'page' };
  assert.deepEqual([...dynamicScope([page, nested, child], new Set(['page']))], ['page']);
  assert.deepEqual([...dynamicScope([page, nested, child], new Set(['root']))], ['root', 'a']);
});

test('keyboard movement reorders a flex selection and changes grid cells without persisting pixel nudges', () => {
  const f = fixture([root, a, b], [], shown),
    before = f.fc.select.getBoxes();
  const pixelNudge = before.map((row) => (row.id === 'a' ? { ...row, x: Number(row.x) + 1 } : row));
  f.fc.select.commit(f.fc.layout.nudge(before, pixelNudge, [1], 1, 0, 1));
  assert.equal(f.boxes()[1]!.layoutOrder, 1);
  assert.equal(f.boxes()[2]!.layoutOrder, 0);
  assert.equal(f.boxes()[1]!.x, a.x);
  f.fc.history!.undo();
  assert.deepEqual(f.boxes(), [root, a, b]);
  const gridItem = { ...a, layoutRow: 1, layoutColumn: 1 },
    g = fixture([gridRoot, gridItem], [track], [gridRoot, { ...gridItem, x: 10, y: 20 }], [grid]);
  const rendered = g.fc.select.getBoxes();
  g.fc.select.commit(
    g.fc.layout.nudge(
      rendered,
      rendered.map((row) => (row.id === 'a' ? { ...row, x: Number(row.x) + 1 } : row)),
      [1],
      1,
      0,
      1
    )
  );
  assert.deepEqual(
    [g.boxes()[1]!.layoutRow, g.boxes()[1]!.layoutColumn, g.boxes()[1]!.x],
    [1, 2, a.x]
  );
});

test('static keyboard nudging preserves the established geometry path', () => {
  const rows = [{ id: 'old', x: 10, y: 10, w: 20, h: 20 }],
    f = fixture(rows),
    next = [{ ...rows[0], x: 11 }];
  assert.equal(f.fc.layout.nudge(rows, next, [0], 1, 0, 1), next);
});

test('keyboard grid placement uses the solver start cell for auto-placed spanning children', () => {
  const child: Box = { ...a, layoutColumnSpan: 2, layoutArea: 'hero' };
  const rendered = { ...child, x: 10, y: 20, w: 220 },
    placed: GridProjection = {
      ...grid,
      cells: [{ id: 'a', row: 1, column: 1, rowSpan: 1, columnSpan: 2 }],
    },
    f = fixture([gridRoot, child], [track], [gridRoot, rendered], [placed]),
    before = f.fc.select.getBoxes();
  assert.equal(
    gridCellAt(gridRoot, grid, 120, 35).layoutColumn,
    2,
    'the child centre lies beyond its starting column'
  );
  f.fc.select.commit(
    f.fc.layout.nudge(
      before,
      before.map((row) => (row.id === 'a' ? { ...row, x: Number(row.x) + 1 } : row)),
      [1],
      1,
      0,
      1
    )
  );
  assert.deepEqual(
    [
      f.boxes()[1]!.layoutRow,
      f.boxes()[1]!.layoutColumn,
      f.boxes()[1]!.layoutColumnSpan,
      f.boxes()[1]!.layoutArea,
      f.boxes()[1]!.x,
    ],
    [1, 2, 2, '', child.x]
  );
  f.fc.history!.undo();
  assert.deepEqual(f.boxes(), [gridRoot, child]);
  f.fc.history!.redo();
  assert.equal(f.boxes()[1]!.layoutColumn, 2);
});
