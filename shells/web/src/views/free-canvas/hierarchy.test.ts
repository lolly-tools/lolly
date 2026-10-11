// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { hierarchyOps } from './hierarchy.ts';
import { selectOps } from './select.ts';
import { objectsOps } from './objects.ts';
import { modesOps } from './modes.ts';
import { opsOps } from './ops.ts';
import { otherAABBs } from './gestures.ts';
import { moveBoxes, rotateGroup, scaleGroup, type Box } from '../free-canvas-math.ts';
import type { FcCtx } from './context.ts';

const copy = <T>(value: T): T => structuredClone(value);
function fixture(rows: Box[], pages = [{ id: 'page-1', name: 'Page 1' }]) {
  let model: Record<string, unknown> = { boxes: copy(rows), pages: copy(pages), layoutTracks: [] };
  const undo: Record<string, unknown>[] = [],
    writes: Record<string, unknown>[] = [],
    messages: string[] = [];
  let active = pages[0]!.id,
    writable = true;
  const apply = (values: Record<string, unknown>) => {
    undo.push(copy(model));
    writes.push(copy(values));
    model = { ...model, ...values };
  };
  const fc = {
    blockId: 'boxes',
    hasIdField: true,
    nativeW: 1000,
    nativeH: 1000,
    FRAME_DUP_GAP: 56,
    cfg: {
      idField: 'id',
      kindField: 'kind',
      xField: 'x',
      yField: 'y',
      wField: 'w',
      hField: 'h',
      rotationField: 'rot',
      groupField: 'group',
      clipField: 'clip',
      bindStartField: 'bindStart',
      bindEndField: 'bindEnd',
    },
    cv: { textDocumentInput: 'textDocument' },
    frameCfg: {
      frameKind: 'frame',
      frameField: 'frame',
      hiddenField: 'hidden',
      lockedField: 'locked',
    },
    opts: {
      canEdit: () => writable,
      getActivePage: () => active,
      getDesignPages: () => model.pages,
    },
    runtime: {
      getModel: () => Object.entries(model).map(([id, value]) => ({ id, value })),
      setInput: (id: string, value: unknown) => apply({ [id]: value }),
    },
    history: {
      endGesture: () => {},
      commit: async (values: Record<string, unknown>) => apply(values),
    },
    selection: new Set<string>(),
    hierarchyScope: '',
    layout: {
      project: (rows: Box[]) => rows,
      sourceEdit: (_: Box[], rows: Box[]) => rows,
      trackPatch: (rows: Box[]) => ({
        layoutTracks: (model.layoutTracks as Box[]).filter((row) =>
          rows.some((box) => box.id === row.container)
        ),
      }),
      tracks: () => model.layoutTracks,
      dynamicScope: (_: Box[], ids: Set<string>) => ids,
      placementReady: () => true,
      duplicate: () => false,
      failure: (error: unknown) => {
        throw error;
      },
    },
    stage: { flash: (message: string) => messages.push(message) },
    chromeSync: { renderChrome: () => {} },
    document: { clampToWorkArea: (row: Box) => row },
    textEdit: { finishEdit: () => {} },
    gestures: {
      cancelGesture: () => {
        fc.gesture = null;
      },
    },
    storyFlow: {
      reconcile: () => false,
      duplicate: async (
        rows: Box[],
        _copies: Map<string, string>,
        selected: Set<string>,
        patch: Record<string, unknown>
      ) => {
        fc.selection = selected;
        fc.select.commit(rows, patch);
      },
      paste: async (
        _payload: unknown,
        rows: Box[],
        _copies: Map<string, string>,
        selected: Set<string>,
        patch: Record<string, unknown>
      ) => {
        fc.selection = selected;
        fc.select.commit(rows, patch);
      },
    },
  } as unknown as FcCtx;
  fc.select = selectOps(fc);
  fc.hierarchy = hierarchyOps(fc);
  fc.objects = objectsOps(fc);
  fc.modes = modesOps(fc);
  fc.ops = opsOps(fc);
  return {
    fc,
    writes,
    messages,
    model: () => model,
    boxes: () => fc.select.getBoxes(),
    setActive: (id: string) => {
      active = id;
    },
    setWritable: (value: boolean) => {
      writable = value;
    },
    undo: () => {
      model = undo.pop()!;
    },
    setTracks: (value: Box[]) => {
      model.layoutTracks = value;
    },
  };
}
const leaf = (id: string, x: number, extra: Box = {}): Box => ({
  id,
  kind: 'box',
  x,
  y: 10,
  w: 20,
  h: 10,
  rot: 0,
  ...extra,
});
const group = (id: string, extra: Box = {}): Box => ({
  id,
  kind: 'group',
  name: id,
  x: 0,
  y: 10,
  w: 60,
  h: 10,
  rot: 0,
  ...extra,
});
const nested = () => [
  leaf('a', 0, { group: 'inner' }),
  leaf('b', 30, { group: 'inner' }),
  group('inner', { group: 'outer' }),
  leaf('c', 80, { group: 'outer' }),
  group('outer', { w: 100 }),
];

test('grouping preserves nested membership and ungroup peels exactly one level in one undo', () => {
  const f = fixture([
    leaf('a', 0, { group: 'inner' }),
    leaf('b', 30, { group: 'inner' }),
    group('inner'),
    leaf('c', 80),
  ]);
  f.fc.selection = new Set(['inner', 'c']);
  f.fc.objects.groupSelection();
  const outer = [...f.fc.selection][0]!;
  assert.equal(f.boxes().find((row) => row.id === 'a')!.group, 'inner');
  assert.equal(f.boxes().find((row) => row.id === 'inner')!.group, outer);
  assert.equal(f.boxes().find((row) => row.id === outer)!.kind, 'group');
  assert.equal(f.writes.length, 1);
  f.fc.objects.ungroupSelection();
  assert.equal(f.boxes().find((row) => row.id === 'a')!.group, 'inner');
  assert.equal(f.boxes().find((row) => row.id === 'inner')!.group, '');
  assert.deepEqual([...f.fc.selection].sort(), ['c', 'inner']);
  assert.equal(f.writes.length, 2);
  f.undo();
  assert.ok(f.boxes().some((row) => row.id === outer));
});

test('selection enters nested groups one level at a time and Alt addresses the leaf', () => {
  const f = fixture(nested()),
    rows = f.boxes(),
    at = rows.findIndex((row) => row.id === 'a');
  assert.deepEqual(f.fc.select.selectionForHit(rows, at, false), ['outer']);
  assert.deepEqual(f.fc.select.selectionForHit(rows, at, true), ['a']);
  assert.equal(f.fc.hierarchy.drillIn(rows, 'a'), true);
  assert.deepEqual([...f.fc.selection], ['inner']);
  assert.equal(f.fc.hierarchy.drillIn(rows, 'a'), true);
  assert.deepEqual([...f.fc.selection], ['a']);
  assert.equal(f.fc.hierarchy.drillIn(rows, 'a'), false);
  assert.equal(f.fc.hierarchy.leaveScope(), true);
  assert.deepEqual([...f.fc.selection], ['inner']);
});

test('named group entry selects the first nested group before leaf siblings', () => {
  const f = fixture(nested());
  f.fc.hierarchy.enterGroup('outer');
  assert.equal(f.fc.hierarchyScope, 'outer');
  assert.deepEqual([...f.fc.selection], ['inner']);
  f.fc.hierarchy.enterGroup('inner');
  assert.deepEqual([...f.fc.selection], ['a']);
});

test('descendant transform indices are cached per revision and transforms preserve the other page', () => {
  const f = fixture(
    [...nested(), leaf('other', 600, { pageId: 'page-2' })],
    [
      { id: 'page-1', name: 'One' },
      { id: 'page-2', name: 'Two' },
    ]
  );
  f.fc.selection = new Set(['outer']);
  const rows = f.boxes(),
    indices = f.fc.hierarchy.transformIndices(rows);
  assert.strictEqual(f.fc.hierarchy.transformIndices(rows), indices);
  assert.equal(indices.length, 5);
  f.fc.select.commit(moveBoxes(rows, indices, 12, 8, f.fc.cfg));
  assert.equal(f.boxes().find((row) => row.id === 'a')!.x, 12);
  assert.equal(f.boxes().find((row) => row.id === 'other')!.x, 600);
  assert.equal(f.writes.length, 1);
  f.undo();
  assert.equal(f.boxes().find((row) => row.id === 'a')!.x, 0);
  const scaled = scaleGroup(f.boxes(), indices, { x: 0, y: 0 }, 2, f.fc.cfg);
  f.fc.select.commit(rotateGroup(scaled, indices, { x: 0, y: 0 }, 90, f.fc.cfg));
  assert.equal(f.boxes().find((row) => row.id === 'a')!.rot, 90);
  assert.equal(f.boxes().find((row) => row.id === 'a')!.w, 40);
  assert.ok(
    f.boxes().every((row) => Number.isFinite(Number(row.x)) && Number.isFinite(Number(row.y)))
  );
});

test('anonymous legacy tags migrate once without moving geometry', () => {
  const f = fixture([leaf('a', 0, { group: 'old' }), leaf('b', 30, { group: 'old' })]);
  const rows = f.boxes();
  assert.strictEqual(f.boxes(), rows);
  assert.equal(rows.find((row) => row.id === 'old')!.kind, 'group');
  assert.deepEqual(f.fc.select.selectionForHit(rows, 0, false), ['old']);
  assert.equal(f.writes.length, 0);
});

test('unsafe legacy groups preserve their records and report migration refusal once per revision', () => {
  const f = fixture([
    group('f1', { kind: 'frame', pageId: 'page-1' }),
    group('f2', { kind: 'frame', pageId: 'page-2' }),
    leaf('a', 0, { frame: 'f1', group: 'old' }),
    leaf('b', 30, { frame: 'f2', group: 'old' }),
  ], [{ id: 'page-1', name: 'One' }, { id: 'page-2', name: 'Two' }]);
  const rows = f.boxes();
  assert.equal(rows.some(row => row.id === 'old'), false);
  assert.strictEqual(f.boxes(), rows);
  assert.equal(f.messages.length, 1);
  assert.match(f.messages[0]!, /original membership and clipping are preserved/i);
  assert.equal(f.writes.length, 0);
});

test('hidden and locked ancestors gate acquisition and active page bounds snap targets', () => {
  const f = fixture(
    [
      leaf('a', 0, { group: 'g' }),
      group('g', { hidden: true }),
      leaf('b', 50, { pageId: 'page-2' }),
      leaf('c', 100),
    ],
    [
      { id: 'page-1', name: 'One' },
      { id: 'page-2', name: 'Two' },
    ]
  );
  const rows = f.boxes(),
    skip = f.fc.select.seqHiddenSkip(rows)!;
  assert.equal(skip(0), true);
  assert.equal(skip(2), true);
  assert.equal(skip(3), false);
  assert.equal(otherAABBs(f.fc, rows, new Set()).length, 1);
  f.fc.select.commit(
    rows.map((row) => (row.id === 'g' ? { ...row, hidden: false, locked: true } : row))
  );
  assert.equal(f.fc.select.seqHiddenSkip(f.boxes())!(0), true);
});

test('duplicate and clipboard copies rekey nested groups and internal clipping bindings', async () => {
  const f = fixture(
    nested().map((row) => (row.id === 'a' ? { ...row, clip: 'b', bindEnd: 'c' } : row))
  );
  f.fc.selection = new Set(['outer']);
  f.fc.ops.duplicateSelection();
  await Promise.resolve();
  const copiedGroup = [...f.fc.selection][0]!,
    copied = f.boxes().filter((row) => !['a', 'b', 'c', 'inner', 'outer'].includes(String(row.id)));
  assert.equal(copied.length, 5);
  assert.equal(copied.find((row) => row.id === copiedGroup)!.kind, 'group');
  const a = copied.find((row) => row.kind === 'box' && row.x === 24)!;
  assert.ok(copied.some((row) => row.id === a.group));
  assert.ok(copied.some((row) => row.id === a.clip));
  assert.ok(copied.some((row) => row.id === a.bindEnd));
  const rows = f.boxes(),
    payload = f.fc.modes.copyRows(rows, f.fc.select.selIndices(rows));
  f.fc.modes.pasteObjects(payload);
  await Promise.resolve();
  assert.equal(f.fc.selection.size, 1);
  assert.equal(f.boxes().length, 15);
  assert.equal(f.boxes().find((row) => f.fc.selection.has(String(row.id)))!.kind, 'group');
});

test('deleting a group deletes its complete subtree and undo restores the same identities', () => {
  const f = fixture([...nested(), leaf('outside', 400)]);
  f.fc.selection = new Set(['outer']);
  f.fc.ops.deleteSelection();
  assert.deepEqual(
    f.boxes().map((row) => row.id),
    ['outside']
  );
  assert.equal(f.writes.length, 1);
  f.undo();
  assert.deepEqual(
    f.boxes().map((row) => row.id),
    ['a', 'b', 'inner', 'c', 'outer', 'outside']
  );
});

test('page duplication and removal preserve geometry and layout track ownership atomically', async () => {
  const f = fixture(
    [group('g', { layout: 'flex' }), leaf('a', 0, { group: 'g', kf: 't0_x0*t1000_x40' })],
    [{ id: 'page-1', name: 'One' }]
  );
  f.setTracks([{ id: 'track', container: 'g', axis: 'column', value: '1fr' }]);
  const page = await f.fc.hierarchy.duplicatePage('page-1');
  assert.ok(page);
  assert.equal(f.writes.length, 1);
  assert.equal((f.model().pages as Box[]).length, 2);
  assert.equal((f.model().layoutTracks as Box[]).length, 2);
  const copied = f.boxes().filter((row) => row.pageId === page);
  assert.equal(copied.length, 2);
  assert.equal(copied.find((row) => row.kind === 'box')!.x, 0);
  assert.equal(copied.find((row) => row.kind === 'box')!.kf, 't0_x0*t1000_x40');
  f.fc.hierarchy.removePage(page);
  assert.equal(f.boxes().length, 2);
  assert.equal((f.model().layoutTracks as Box[]).length, 1);
  assert.equal(f.writes.length, 2);
  f.undo();
  assert.equal((f.model().pages as Box[]).length, 2);
  assert.equal(f.boxes().length, 4);
});

test('page changes cancel draft interactions and read-only group commands write nothing', () => {
  const f = fixture(nested());
  f.fc.selection = new Set(['inner', 'c']);
  f.setWritable(false);
  f.fc.objects.groupSelection();
  f.fc.selection = new Set(['outer']);
  f.fc.objects.ungroupSelection();
  f.fc.ops.duplicateSelection();
  f.fc.ops.deleteSelection();
  assert.equal(f.writes.length, 0);
  f.fc.hierarchyScope = 'inner';
  f.fc.hierarchy.pageChanged();
  assert.equal(f.fc.hierarchyScope, '');
  assert.equal(f.fc.selection.size, 0);
});

test('precision and arrange group edits carry unchanged children while preserving proportions', () => {
  const f = fixture(nested());
  const initial = f.boxes();
  f.fc.select.commit(initial.map((row) => (row.id === 'outer' ? { ...row, x: 50, y: 30 } : row)));
  assert.equal(f.boxes().find((row) => row.id === 'a')!.x, 50);
  assert.equal(f.boxes().find((row) => row.id === 'a')!.y, 30);
  f.fc.select.commit(f.boxes().map((row) => (row.id === 'outer' ? { ...row, w: 200 } : row)));
  assert.equal(f.boxes().find((row) => row.id === 'a')!.w, 40);
  assert.equal(f.boxes().find((row) => row.id === 'outer')!.h, 20);
  f.fc.select.commit(f.boxes().map((row) => (row.id === 'outer' ? { ...row, rot: 90 } : row)));
  assert.equal(f.boxes().find((row) => row.id === 'a')!.rot, 90);
  assert.equal(f.writes.length, 3);
});

test('deleting nested content clears remaining clipping and endpoint bindings atomically', () => {
  const f = fixture([...nested(), leaf('outside', 400, { clip: 'a', bindStart: 'c' })]);
  f.fc.selection = new Set(['outer']);
  f.fc.ops.deleteSelection();
  assert.equal(f.boxes()[0]!.clip, '');
  assert.equal(f.boxes()[0]!.bindStart, '');
  assert.equal(f.writes.length, 1);
  f.undo();
  assert.equal(f.boxes().find((row) => row.id === 'outside')!.clip, 'a');
});

test('new layers inherit the active page without changing existing page assignments', () => {
  const f = fixture(
    [leaf('one', 0)],
    [
      { id: 'page-1', name: 'One' },
      { id: 'page-2', name: 'Two' },
    ]
  );
  f.setActive('page-2');
  f.fc.select.commit([...f.boxes(), leaf('new', 0)]);
  assert.equal(f.boxes().find((row) => row.id === 'new')!.pageId, 'page-2');
  assert.equal(f.fc.hierarchy.selectable(f.boxes(), 'one'), false);
});


test('frame adoption and new layer drops respect overlapping artboards on different pages', () => {
  const f = fixture([
    { id: 'f1', kind: 'frame', x: 0, y: 0, w: 100, h: 100, pageId: 'page-1' },
    { id: 'f2', kind: 'frame', x: 0, y: 0, w: 100, h: 100, pageId: 'page-2' },
    group('g', { frame: 'f1' }), leaf('a', 10, { group: 'g' }), leaf('b', 10, { frame: 'f2' }),
  ], [{ id: 'page-1', name: 'One' }, { id: 'page-2', name: 'Two' }]);
  const rows = f.boxes(), adopted = f.fc.select.assignFrames(rows, new Set(rows.map((_, i) => i)), true);
  assert.equal(adopted.find(row => row.id === 'g')!.frame, 'f1');
  assert.equal(adopted.find(row => row.id === 'a')!.group, 'g');
  assert.equal(adopted.find(row => row.id === 'a')!.frame, undefined);
  assert.equal(adopted.find(row => row.id === 'b')!.frame, 'f2');
  f.setActive('page-2');
  const next = [...rows, leaf('new', 10)];
  const dropped = f.fc.select.assignFrames(next, new Set([next.length - 1]));
  assert.equal(dropped.at(-1)!.frame, 'f2');
  f.fc.select.commit(dropped); assert.equal(f.boxes().at(-1)!.pageId, 'page-2');
});
