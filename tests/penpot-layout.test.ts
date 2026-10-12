// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { buildPenpotEntries, boxesToPenpotDoc, seededPenpotUuid, PENPOT_ROOT_ID } from '../engine/src/penpot-file.ts';
import { finalizeBoxes, penpotShapeToNode } from '../engine/src/design-map.ts';
import { exportPenpotLayout, importPenpotLayouts, penpotChildrenPaintOrder } from '../engine/src/penpot-layout.ts';
import { createDesignLayoutEvaluator } from '../engine/src/design-layout.ts';
import { loadLayoutKernel } from '../packages/node-shell/src/layout-kernel-node.ts';

type Row = Record<string, unknown>;
const solver = await loadLayoutKernel();
const layer = (id: string, patch: Row = {}): Row => ({ id, name: id, kind: 'box', x: 0, y: 0, w: 80, h: 40, rot: 0, bg: '#eeeeee', ...patch });
const near = (actual: unknown, expected: number) => assert.ok(Math.abs(Number(actual) - expected) < .04, `${actual} != ${expected}`);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Exercises the real archive writer, ZIP encoding, native JSON records and read adapter. */
async function archive(rows: Row[], tracks: Row[] = []) {
  const evaluated = await createDesignLayoutEvaluator(solver)(rows, tracks);
  assert.deepEqual(evaluated.findings, []);
  const doc = boxesToPenpotDoc(evaluated.boxes, { name: 'Layouts', canvas: { w: 600, h: 400 }, layoutTracks: tracks });
  const build = buildPenpotEntries(doc, { uuid: seededPenpotUuid(305), now: () => '2026-10-11T12:00:00.000Z' });
  const zipped = zipSync(Object.fromEntries(Object.entries(build.entries).map(([path, value]) => [path, typeof value === 'string' ? strToU8(value) : value])));
  const entries = unzipSync(zipped), shapes: Record<string, Row> = {};
  for (const [path, bytes] of Object.entries(entries)) {
    if (/\/pages\/[^/]+\/[^/]+\.json$/.test(path)) {
      const shape = JSON.parse(strFromU8(bytes));
      shapes[shape.id] = shape;
    }
  }
  const boxes: Row[] = [], sourceIds: string[] = [], visited = new Set<string>();
  const walk = (id: string) => {
    assert.ok(!visited.has(id), 'native archive hierarchy has no duplicate memberships'); visited.add(id);
    const shape = shapes[id]!;
    for (const child of penpotChildrenPaintOrder(shape, shapes)) {
      const native = shapes[child]!;
      assert.equal(native.parentId, id);
      const node = penpotShapeToNode(native), finalized = finalizeBoxes(node ? [node] : []);
      assert.equal(finalized.length, 1);
      boxes.push({ ...finalized[0], id: `read:${child}`, name: native.name }); sourceIds.push(child);
      walk(child);
    }
  };
  walk(PENPOT_ROOT_ID);
  const imported = importPenpotLayouts(boxes, sourceIds, shapes);
  assert.deepEqual(imported.findings, []);
  return { evaluated: evaluated.boxes, imported, shapes, zipped };
}

test('native flex round trip retains nested ownership, flow order, paint order and resize behavior', async () => {
  // Array painting order differs from flow order. Native z-index retains that difference.
  const rows = [layer('root', { kind: 'frame', w: 400, h: 220, layout: 'flex', layoutGapX: 12, layoutPadLeft: 10 }),
    layer('second', { layoutOwner: 'root', layoutOrder: 1, layoutW: 'fill', layoutMinW: 30, layoutMaxW: 240 }),
    layer('first', { layoutOwner: 'root', layoutOrder: 0 }),
    layer('card', { layoutOwner: 'root', layoutOrder: 2, layout: 'flex', layoutDirection: 'column', layoutH: 'hug', w: 40 }),
    layer('label', { layoutOwner: 'card', w: 40, h: 20 })];
  const { imported, shapes } = await archive(rows);
  assert.deepEqual(imported.boxes.map(row => row.name), rows.map(row => row.name));
  const root = imported.boxes.find(row => row.name === 'root')!, first = imported.boxes.find(row => row.name === 'first')!;
  const second = imported.boxes.find(row => row.name === 'second')!, card = imported.boxes.find(row => row.name === 'card')!;
  assert.equal(first.layoutOwner, root.id); assert.equal(first.frame, '');
  assert.equal(second.layoutOrder, 1); assert.equal(first.layoutOrder, 0);
  assert.equal(card.layoutOwner, root.id); assert.equal(card.layout, 'flex');
  const nativeRoot = Object.values(shapes).find(shape => shape.name === 'root')!;
  assert.equal(nativeRoot.layoutFlexDir, 'row');
  assert.deepEqual((nativeRoot.shapes as string[]).map(id => shapes[id]!.name), ['card', 'second', 'first']);
  const changed = imported.boxes.map(row => row.id === root.id ? { ...row, w: 520 } : row);
  const resized = await createDesignLayoutEvaluator(solver)(changed, imported.tracks);
  assert.deepEqual(resized.findings, []); near(resized.boxes.find(row => row.id === second.id)!.w, 240);
  const reordered = await createDesignLayoutEvaluator(solver)(changed.map(row => row.id === first.id ? { ...row, layoutOrder: 3 } : row), imported.tracks);
  assert.deepEqual(reordered.findings, []);
  assert.ok(Number(reordered.boxes.find(row => row.id === first.id)!.x) > Number(reordered.boxes.find(row => row.id === second.id)!.x));
});

test('native grid round trip retains typed tracks, auto cells, named spans and editable fractional sizing', async () => {
  const rows = [layer('root', { kind: 'frame', w: 500, h: 220, layout: 'grid', layoutGapX: 10 }),
    layer('a', { layoutOwner: 'root', layoutOrder: 0, layoutW: 'fill' }),
    layer('b', { layoutOwner: 'root', layoutOrder: 1, layoutW: 'fill' }),
    layer('named', { layoutOwner: 'root', layoutOrder: 2, layoutW: 'fill', layoutRow: 2, layoutColumn: 1, layoutColumnSpan: 2, layoutArea: 'footer', layoutSelf: 'end' }),
    layer('hidden', { layoutOwner: 'root', hidden: true }),
    layer('badge', { layoutOwner: 'root', layoutAbsolute: true, layoutX: 450, layoutY: 170, x: 450, y: 170, w: 20, h: 20 })];
  const tracks = [{ id: 'col1', container: 'root', axis: 'column', order: 0, track: '120px' },
    { id: 'col2', container: 'root', axis: 'column', order: 1, track: '1fr' },
    { id: 'row1', container: 'root', axis: 'row', order: 0, track: 'auto' },
    { id: 'row2', container: 'root', axis: 'row', order: 1, track: 'auto' }];
  const { imported, shapes } = await archive(rows, tracks);
  assert.deepEqual(imported.tracks.map(track => track.track), ['120px', '1fr', 'auto', 'auto']);
  const root = imported.boxes.find(row => row.name === 'root')!, auto = imported.boxes.find(row => row.name === 'b')!;
  assert.equal(auto.layoutRow, 0); assert.equal(auto.layoutColumn, 0);
  const named = imported.boxes.find(row => row.name === 'named')!;
  assert.equal(named.layoutArea, 'footer'); assert.equal(named.layoutColumnSpan, 2); assert.equal(named.layoutSelf, 'end');
  assert.equal(imported.boxes.find(row => row.name === 'hidden')!.hidden, true);
  const nativeRoot = Object.values(shapes).find(shape => shape.name === 'root')!;
  const cells = nativeRoot.layoutGridCells as Record<string, Row>;
  assert.equal(Object.keys(cells).length, 3);
  for (const [id, cell] of Object.entries(cells)) {
    assert.match(id, UUID); assert.equal(cell.id, id);
    assert.ok(Number.isInteger(cell.row) && Number(cell.row) >= 1);
    assert.ok(Number.isInteger(cell.column) && Number(cell.column) >= 1);
    assert.equal((cell.shapes as string[]).length, 1);
    for (const child of cell.shapes as string[]) assert.equal(shapes[child]!.parentId, nativeRoot.id);
  }
  const resized = await createDesignLayoutEvaluator(solver)(imported.boxes.map(row => row.id === root.id ? { ...row, w: 620 } : row), imported.tracks);
  assert.deepEqual(resized.findings, []);
  near(resized.boxes.find(row => row.id === auto.id)!.w, 490);
  const widenedTrack = imported.tracks.map(track => track.axis === 'column' && track.order === 0 ? { ...track, track: '200px' } : track);
  const edited = await createDesignLayoutEvaluator(solver)(imported.boxes, widenedTrack);
  assert.deepEqual(edited.findings, []); near(edited.boxes.find(row => row.id === auto.id)!.x, 210);
});

test('native reverse flow, simple padding/margins and relative rotation use current schema semantics', async () => {
  const shapes: Record<string, Row> = {
    root: { id: 'root', type: 'frame', parentId: PENPOT_ROOT_ID, layout: 'flex', layoutFlexDir: 'column-reverse', shapes: ['b', 'a'],
      layoutPaddingType: 'simple', layoutPadding: { p1: 7, p2: 9, p3: 100, p4: 200 } },
    a: { id: 'a', parentId: 'root', layoutItemMarginType: 'simple', layoutItemMargin: { m1: 3, m2: 5, m3: 100, m4: 200 } },
    b: { id: 'b', parentId: 'root', layoutItemAbsolute: true },
  };
  const imported = importPenpotLayouts([layer('r', { rot: 90 }), layer('a', { rot: 110 }), layer('b', { rot: 90, x: 20, y: 100 })], ['root', 'a', 'b'], shapes);
  assert.deepEqual(imported.findings, []);
  assert.equal(imported.boxes[0]!.layoutPadBottom, 7); assert.equal(imported.boxes[0]!.layoutPadLeft, 9);
  assert.equal(imported.boxes[1]!.layoutMarginBottom, 3); assert.equal(imported.boxes[1]!.layoutMarginLeft, 5);
  assert.equal(imported.boxes[1]!.layoutAngle, 20); assert.equal(imported.boxes[1]!.layoutOrder, 0);
  near(imported.boxes[2]!.layoutX, 100); near(imported.boxes[2]!.layoutY, -20);
});

test('unrepresentable native membership and cells produce explicit import diagnostics', () => {
  const base: Record<string, Row> = { root: { id: 'root', type: 'frame', parentId: PENPOT_ROOT_ID, layout: 'grid', shapes: ['group'],
    layoutGridColumns: [{ type: 'flex', value: 1 }], layoutGridRows: [{ type: 'auto' }],
    layoutGridCells: { empty: { row: 1, column: 1, rowSpan: 1, columnSpan: 1, position: 'area', areaName: 'empty', shapes: [] } } },
    group: { id: 'group', type: 'group', parentId: 'root', shapes: ['child'] }, child: { id: 'child', type: 'rect', parentId: 'group' } };
  const imported = importPenpotLayouts([layer('r'), layer('g'), layer('c')], ['root', 'group', 'child'], base);
  assert.ok(imported.findings.some(finding => finding.code === 'penpot.layout.empty-cell'));
  assert.ok(imported.findings.some(finding => finding.code === 'penpot.layout.group'));
  assert.equal(importPenpotLayouts([layer('r')], ['root', 'extra'], base).findings[0]!.code, 'penpot.layout.identity');
  const missing = importPenpotLayouts([layer('g')], ['group'], base);
  assert.ok(missing.findings.some(finding => finding.code === 'penpot.layout.owner'));
  // A retained baked group has one source identity and no separately painted descendants.
  const flat = importPenpotLayouts([layer('r'), layer('g', { kind: 'image' })], ['root', 'group'], { ...base, root: { ...base.root, layoutGridCells: {} } });
  assert.deepEqual(flat.findings, []);
});

test('scoped board imports do not report unrelated grids elsewhere in the file', () => {
  const shapes: Record<string, Row> = { a: { id: 'a', type: 'frame', parentId: PENPOT_ROOT_ID, layout: 'flex', shapes: ['child'] },
    child: { id: 'child', parentId: 'a' }, other: { id: 'other', layout: 'grid', layoutGridCells: { c: { shapes: ['elsewhere'] } } } };
  const imported = importPenpotLayouts([layer('a'), layer('child')], ['a', 'child'], shapes);
  assert.deepEqual(imported.findings, []);
});

test('static imports keep the original rows and static exports add no layout attributes', () => {
  const rows = [layer('old')];
  assert.equal(importPenpotLayouts(rows, ['old'], { old: { type: 'rect' } }).boxes, rows);
  const doc = boxesToPenpotDoc(rows, { name: 'Static', canvas: { w: 200, h: 100 } });
  const build = buildPenpotEntries(doc, { uuid: seededPenpotUuid(17), now: () => '2026-10-11T12:00:00.000Z' });
  for (const [path, value] of Object.entries(build.entries)) if (/\/pages\/[^/]+\/[^/]+\.json$/.test(path)) {
    const shape = JSON.parse(typeof value === 'string' ? value : strFromU8(value));
    assert.equal(Object.keys(shape).some(key => key.startsWith('layout')), false);
  }
});

const browserOrigin =
  process.env.LOLLY_LAYOUT_TEST_URL ??
  process.env.LOLLY_IMPORT_TEST_URL ??
  process.env.LOLLY_EXPORT_TEST_URL;
test('browser Penpot parser and artboard import keep dynamic owners and track identities across pages', {
  skip: browserOrigin ? false : 'Set LOLLY_IMPORT_TEST_URL or LOLLY_EXPORT_TEST_URL to a local Vite shell.', timeout: 90_000,
}, async () => {
  const rows = [layer('grid', { kind: 'frame', w: 400, h: 200, layout: 'grid' }), layer('item', { layoutOwner: 'grid', layoutW: 'fill' }),
    layer('flex', { kind: 'frame', x: 500, w: 300, h: 200, layout: 'flex' }), layer('flexitem', { layoutOwner: 'flex' })];
  const tracks = [{ id: 'column', container: 'grid', axis: 'column', order: 0, track: '1fr' }, { id: 'row', container: 'grid', axis: 'row', order: 0, track: 'auto' }];
  const { zipped } = await archive(rows, tracks);
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(browserOrigin!);
    const result = await page.evaluate(async bytes => {
      const parserPath = '/src/views/design-import.ts', bridgePath = '/src/bridge/index.ts', menuPath = '/src/views/free-canvas/menus.ts', opsPath = '/src/views/free-canvas/ops.ts';
      const [{ parseDesignFile, parseDesignArtboards }, { createBridge }, { importAsArtboards }, { dupRefFields }] = await Promise.all([
        import(parserPath), import(bridgePath), import(menuPath), import(opsPath),
      ]);
      const host = await createBridge(), file = new File([new Uint8Array(bytes)], 'layouts.penpot');
      const single = await parseDesignFile(file, { host, interactive: false });
      const artboards = await parseDesignArtboards(file, { host, interactive: false });
      let committed: Record<string, unknown>[] = [], trackRows: Record<string, unknown>[] = [], serial = 0;
      const cfg = { idField: 'id', kindField: 'kind', xField: 'x', yField: 'y', wField: 'w', hField: 'h', rotationField: 'rot', fillField: 'bg' };
      const fc = { frameCfg: { frameField: 'frame', frameKind: 'frame', orderField: 'order' }, cfg, cv: {}, host, addKinds: [{ id: 'frame', seed: { kind: 'frame' } }],
        ops: { dupRefFields: () => dupRefFields(fc) },
        nameField: 'name', disposed: false, select: { freshId: () => `added:${++serial}`,
          commit: (boxes: Record<string, unknown>[], extra: { layoutTracks: Record<string, unknown>[] }) => { committed = boxes; trackRows = extra.layoutTracks; } } };
      await importAsArtboards(fc, file, () => {});
      const evaluated = await host.layout.evaluate({ boxes: committed, tracks: trackRows });
      return { single, artboards, committed, trackRows, findings: evaluated.findings };
    }, [...zipped]);
    assert.equal(result.single.layoutTracks.length, 2);
    assert.equal(result.artboards.frames.length, 2);
    assert.equal(result.artboards.frames[0].layoutTracks.length, 2);
    assert.equal(result.artboards.frames[1].layoutTracks.length, 0);
    assert.deepEqual(result.findings, []);
    const byId = new Map(result.committed.map(row => [row.id, row]));
    for (const row of result.committed) if (row.layoutOwner) {
      assert.equal(row.frame, ''); assert.ok(byId.has(row.layoutOwner));
    }
    assert.equal(new Set(result.trackRows.map(track => track.id)).size, 2);
    for (const track of result.trackRows) assert.equal(byId.get(track.container)?.layout, 'grid');
  } finally { await browser.close(); }
});

test('native group item sizing preserves fill, intrinsic auto, limits and descendant ownership', () => {
  const shapes: Record<string,Row>={root:{id:'root',type:'frame',parentId:PENPOT_ROOT_ID,layout:'flex',shapes:['group'],selrect:{x:0,y:0,width:400,height:200}},
    group:{id:'group',type:'group',parentId:'root',shapes:['leaf'],layoutItemHSizing:'fill',layoutItemVSizing:'auto',layoutItemMinW:180,layoutItemMaxW:240},
    leaf:{id:'leaf',type:'rect',parentId:'group'}};
  const result=importPenpotLayouts([layer('r',{kind:'frame',w:400,h:200}),layer('g',{kind:'group'}),layer('l')],['root','group','leaf'],shapes,{preserveHierarchy:true});
  assert.deepEqual(result.findings,[]); const g=result.boxes[1]!,leaf=result.boxes[2]!;
  assert.equal(g.layoutOwner,'r'); assert.equal(g.layoutW,'fill'); assert.equal(g.layoutH,'hug'); assert.equal(g.layoutMinW,180); assert.equal(g.layoutMaxW,240);
  assert.equal(leaf.group,'g'); assert.equal(leaf.layoutOwner,'');
});

test('native standalone and nested group intrinsic sizing retain editable item attributes without a layout container', () => {
  const shapes: Record<string,Row>={group:{id:'group',type:'group',parentId:PENPOT_ROOT_ID,shapes:['nested'],layoutItemHSizing:'auto',layoutItemVSizing:'fix',layoutItemMaxW:80},
    nested:{id:'nested',type:'group',parentId:'group',shapes:['leaf'],layoutItemHSizing:'auto',layoutItemVSizing:'auto'},leaf:{id:'leaf',type:'rect',parentId:'nested'}};
  const result=importPenpotLayouts([layer('g',{kind:'group'}),layer('n',{kind:'group'}),layer('l')],['group','nested','leaf'],shapes,{preserveHierarchy:true});
  assert.deepEqual(result.findings,[]); assert.equal(result.boxes[0]!.layoutW,'hug'); assert.equal(result.boxes[0]!.layoutH,'fixed'); assert.equal(result.boxes[0]!.layoutMaxW,80);
  assert.equal(result.boxes[1]!.layoutW,'hug'); assert.equal(result.boxes[1]!.layoutH,'hug'); assert.equal(result.boxes[1]!.group,'g');
});

test('native group sizing export writes item sizing and limits without creating a second layout owner', () => {
  const props=exportPenpotLayout(layer('g',{kind:'group',layoutW:'hug',layoutH:'fixed',layoutMinW:30,layoutMaxW:80}),[],[]);
  assert.equal(props.layoutItemHSizing,'auto'); assert.equal(props.layoutItemVSizing,'fix'); assert.equal(props.layoutItemMinW,30); assert.equal(props.layoutItemMaxW,80);
  assert.equal(props.layout,undefined); assert.equal(props.layoutGridCells,undefined);
});
