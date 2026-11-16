// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import {
  STUDIO_ARRANGEMENT_LIMIT,
  studioArrangementPivot,
  studioObjectEdit,
  studioObjectSelect,
  studioOverlaps,
  studioSceneObjects,
  studioObjectId,
} from '../engine/src/studio3d-arrangement.ts';
import { buildStudioScene } from '../engine/src/studio3d.ts';
import { parseUrlState, serializeUrlState } from '../engine/src/url-mode.ts';
import { baseHost } from './helpers/host.ts';
import { studioBarHarness } from './helpers/studio3d-bar.ts';

const arrangement = {
  source: 'arrangement',
  activeObject: 2,
  objects: [
    { name: 'Badge', kind: 'primitive', primitive: 'badge', x: -1.2, rotY: 12, scale: 0.6 },
    { name: 'Duck', kind: 'model', asset: { url: '/duck.glb', name: 'duck.glb' }, x: 1.4 },
    {
      name: 'Part',
      kind: 'model',
      asset: { url: '/part.stl', name: 'part.stl' },
      z: -2,
      grounded: 'false',
      y: 0.8,
      id: 'Hero Part',
      roleA: 'surface',
    },
    { kind: 'primitive', primitive: 'box', visible: 'false' },
  ],
};

test('an arrangement keeps every object, its stable id, pose and slot bindings', () => {
  const scene = buildStudioScene({ version: 1, values: arrangement });
  assert.equal(scene.objects?.length, 4);
  assert.deepEqual(
    scene.objects!.map((object) => object.id),
    ['object-1', 'object-2', 'hero-part', 'object-4']
  );
  assert.deepEqual(
    scene.objects!.map((object) => object.source.kind),
    ['primitive', 'glb', 'stl', 'primitive']
  );
  assert.equal(scene.objects![3]!.name, 'Object 4');
  assert.equal(scene.objects![3]!.visible, false);
  assert.equal(scene.objects![2]!.grounded, false);
  assert.deepEqual(scene.objects![2]!.transform.position, [0, 0.8, -2]);
  assert.deepEqual(scene.objects![2]!.bindings, { a: 'surface', b: '' });
  assert.deepEqual(scene.objects![0]!.transform, {
    rotation: [0, 12, 0],
    position: [-1.2, 0, 0],
    scale: 0.6,
  });
  assert.equal(scene.objects![1]!.transform.scale, 0.6, 'a row without a scale joins at group size');
  assert.equal(scene.activeObject, 1);
  // Single-object readers still see a coherent scene: the first object is mirrored.
  assert.equal(scene.source.kind, 'primitive');
  assert.deepEqual(scene.transform, scene.objects![0]!.transform);
  assert.deepEqual(studioSceneObjects(scene), scene.objects);
  const single = buildStudioScene({ version: 1, values: { source: 'primitive' } });
  assert.equal(single.objects, undefined);
  assert.equal(studioSceneObjects(single).length, 1);
  assert.deepEqual(studioSceneObjects(single)[0]!.source, single.source);
});

test('arrangement limits and errors name the object that needs attention', () => {
  const build = (values: Record<string, unknown>) =>
    buildStudioScene({ version: 1, values: { source: 'arrangement', ...values } });
  assert.throws(() => build({ objects: [] }), /at least one object/);
  assert.throws(
    () => build({ objects: Array(STUDIO_ARRANGEMENT_LIMIT + 1).fill({ kind: 'primitive' }) }),
    /up to 16 objects/
  );
  // A row without its file yet waits rather than breaking the scene; alone, it explains.
  const waiting = build({ objects: [{ name: 'Logo', kind: 'artwork' }, { kind: 'primitive' }] });
  assert.equal(waiting.objects![0]!.pending, true);
  assert.equal(waiting.objects![1]!.pending, undefined);
  assert.equal(waiting.source.kind, 'primitive', 'the mirrored source skips waiting rows');
  assert.throws(
    () => build({ objects: [{ name: 'Logo', kind: 'artwork' }] }),
    /Choose a file for an object, or add a sample shape/
  );
  assert.throws(
    () =>
      build({
        objects: [
          { kind: 'primitive', id: 'same' },
          { kind: 'primitive', id: 'Same' },
        ],
      }),
    /Objects 1 and 2 share the id "same"/
  );
  assert.throws(
    () => build({ objects: [{ kind: 'primitive', visible: false }] }),
    /Show at least one object/
  );
  const bounded = build({
    objects: [{ kind: 'primitive', x: 40, y: -40, scale: 99, rotY: 1000, id: 'A b/C!' }],
  });
  assert.deepEqual(bounded.objects![0]!.transform, {
    rotation: [0, 360, 0],
    position: [6, -6, 0],
    scale: 5,
  });
  assert.equal(bounded.objects![0]!.id, 'a-b-c');
});

test('object edits and selection change one row and leave the saved arrangement intact', () => {
  const saved = structuredClone(arrangement);
  const moved = studioObjectEdit(arrangement, 1, { x: 2.03456, z: -9, scale: NaN, rotY: 45 });
  assert.equal(moved.id, 'objects');
  const rows = moved.value as Record<string, unknown>[];
  assert.equal(rows[0], arrangement.objects[0]);
  assert.deepEqual(
    { x: rows[1]!.x, z: rows[1]!.z, rotY: rows[1]!.rotY, scale: rows[1]!.scale },
    { x: 2.035, z: -6, rotY: 45, scale: undefined }
  );
  assert.deepEqual(arrangement, saved);
  assert.throws(() => studioObjectEdit(arrangement, 9, { x: 0 }), /not in the arrangement/);
  assert.deepEqual(studioObjectSelect(arrangement, 2), { id: 'activeObject', value: 3 });
  assert.deepEqual(studioObjectSelect(arrangement, 99), { id: 'activeObject', value: 4 });
  assert.deepEqual(studioObjectSelect(arrangement, -5), { id: 'activeObject', value: 1 });
});

test('overlap guidance ignores touching objects and reports shared volume; the pivot is the footprint centre', () => {
  const box = (id: string, x: number, size = 1) => ({
    id,
    name: id,
    min: [x - size / 2, 0, -size / 2] as [number, number, number],
    max: [x + size / 2, size, size / 2] as [number, number, number],
  });
  assert.deepEqual(studioOverlaps([box('A', 0), box('B', 1)]), []);
  assert.deepEqual(studioOverlaps([box('A', 0), box('B', 0.995)]), []);
  const notes = studioOverlaps([box('A', 0), box('B', 0.5), box('C', 4)]);
  assert.equal(notes.length, 1);
  assert.match(notes[0]!, /^A and B overlap by about 50%/);
  assert.deepEqual(studioArrangementPivot([box('A', -3), box('B', 5, 2)]), [1.25, 0, 0]);
  assert.deepEqual(studioArrangementPivot([]), [0, 0, 0]);
});

test('the real tool resolves object assets and carries an arrangement through URL mode', async () => {
  const tool = await loadTool('3d-studio', (p) => readFile(join('community', p), 'utf8'));
  const host = baseHost({
    assets: { get: async (id: string) => ({ id, url: `/assets/${id}`, name: id }) },
  });
  // Saved rows carry asset ids; the hook resolves them to urls before the marker is written.
  const runtime = await createRuntime(tool, host, {
    ...arrangement,
    objects: arrangement.objects.map((row, i) =>
      i === 1
        ? { ...row, asset: 'user/upload/duck.glb' }
        : i === 2
          ? { ...row, asset: 'user/upload/part.stl' }
          : row
    ),
  });
  const marker = /data-lolly-studio="([^"]+)"/.exec(runtime.getHydrated())![1]!;
  const resolved = JSON.parse(
    marker.replace(/&quot;/g, '"').replace(/&#x3D;/g, '=').replace(/&amp;/g, '&')
  ) as { values: Record<string, unknown> };
  const scene = buildStudioScene({ version: 1, values: resolved.values });
  assert.equal(scene.objects![1]!.source.url, '/assets/user/upload/duck.glb');
  assert.equal(scene.objects![1]!.source.id, 'user/upload/duck.glb');
  assert.equal(scene.objects![2]!.source.kind, 'stl');
  // The controls are the shell's (lib/studio3d/toolbar.ts), drawn from the same values.
  const bar = await studioBarHarness(resolved.values, { addObjects: true, reviewCollection: true });
  assert.ok(bar.action('studio-tilt'), 'an arrangement offers Tilt');
  assert.equal(bar.action('studio-move'), undefined, 'objects move on the canvas, with no mode');
  assert.equal(bar.action('studio-fit')?.label, 'Frame all');
  assert.equal(bar.action('studio-review'), undefined, 'Review collection is for a collection');
  assert.match(bar.visible().join(' '), /studio-object-label/);
  const parsed = parseUrlState(
    serializeUrlState(runtime.getModel(), { keepUserIds: true }),
    tool.manifest
  );
  const reopened = await createRuntime(tool, host, parsed.values);
  const values = (rt: typeof runtime) =>
    Object.fromEntries(rt.getModel().map((i) => [i.id, i.value]));
  const before = buildStudioScene({ version: 1, values: resolved.values });
  const after = buildStudioScene({
    version: 1,
    values: JSON.parse(
      /data-lolly-studio="([^"]+)"/
        .exec(reopened.getHydrated())![1]!
        .replace(/&quot;/g, '"')
        .replace(/&#x3D;/g, '=')
        .replace(/&amp;/g, '&')
    ).values,
  });
  assert.deepEqual(after.objects, before.objects);
  assert.equal(after.activeObject, 1);
  assert.equal((values(reopened).objects as Record<string, unknown>[])[2]!.grounded, false);
  runtime.destroy();
  reopened.destroy();
});

test('dropped files become placed, named objects whose kind follows the file', async () => {
  const tool = await loadTool('3d-studio', (p) => readFile(join('community', p), 'utf8'));
  const host = baseHost({
    assets: {
      get: async (id: string) => ({
        id,
        url: `/assets/${id}`,
        type: id.endsWith('.glb') || id.endsWith('.stl') ? 'model' : 'vector',
        format: id.split('.').pop(),
        meta: { name: id.replace(/^.*\//, '').replace(/^[0-9a-f-]{36}-/, '') },
      }),
    },
  });
  const runtime = await createRuntime(tool, host, {
    source: 'arrangement',
    objects: [
      { kind: 'artwork', asset: 'user/upload/3f2b1c9e-9d3c-4c1e-9f1a-1b2c3d4e5f60-Lock icon.svg' },
      { kind: 'artwork', asset: 'user/upload/duck.glb' },
      { name: 'Kept', kind: 'primitive', primitive: 'box', x: 4, z: -1 },
    ],
  });
  const rows = runtime.getModel().find((i) => i.id === 'objects')!.value as Record<string, unknown>[];
  assert.deepEqual(
    rows.map((row) => [row.name, row.kind, row.x, row.z]),
    [
      ['Lock icon', 'artwork', 0, 0],
      ['duck', 'model', 2.3, 0],
      ['Kept', 'primitive', 4, -1],
    ]
  );
  const scene = buildStudioScene({
    version: 1,
    values: JSON.parse(
      /data-lolly-studio="([^"]+)"/
        .exec(runtime.getHydrated())![1]!
        .replace(/&quot;/g, '"')
        .replace(/&#x3D;/g, '=')
        .replace(/&amp;/g, '&')
    ).values,
  });
  assert.deepEqual(
    scene.objects!.map((object) => object.source.kind),
    ['svg', 'glb', 'primitive']
  );
  assert.ok((await studioBarHarness({ source: 'arrangement', objects: rows })).action('studio-object-label'));
  runtime.destroy();
});

test('the object actions stand by the selection only where an object can be selected', async () => {
  const rows = [{ kind: 'primitive', primitive: 'box' }, { kind: 'primitive', primitive: 'sphere', x: 2 }];
  const group = async (values: Record<string, unknown>, extra: Parameters<typeof studioBarHarness>[1]) =>
    (await studioBarHarness(values, extra)).groups().find((g) => g.id === 'studio-object')!;
  assert.equal((await group({ source: 'arrangement', activeObject: 1, objects: rows }, { layer: true })).float, true);
  // With no handle layer (multi-edit, a Design scene box) nothing places the group, so it stays in the bar.
  assert.equal((await group({ source: 'arrangement', activeObject: 1, objects: rows }, {})).float, false);
  // A collection has no selection either, and Tilt must stay in reach.
  const collection = await studioBarHarness({ source: 'collection', subjects: [{ kind: 'primitive', primitive: 'box' }, { kind: 'primitive', primitive: 'sphere' }] }, { layer: true });
  assert.equal(collection.groups().find((g) => g.id === 'studio-object')!.float, false);
  assert.ok(collection.action('studio-tilt'));
});

test('a copy and a removal never leave two objects with one id', async () => {
  const unique = (rows: Record<string, unknown>[]): string[] => {
    const taken = new Set<string>();
    return rows.map((row, index) => studioObjectId(row, index, taken));
  };
  // A row with no authored id takes its id from its place. Here someone typed the id
  // the third place would give into a two-row arrangement.
  const copyClash = await studioBarHarness(
    { source: 'arrangement', activeObject: 1, objects: [{ kind: 'primitive', primitive: 'box' }, { id: 'object-3', kind: 'primitive', primitive: 'sphere', x: 2 }] },
    { layer: true, commitMany: true, selected: true }
  );
  copyClash.action('studio-duplicate')!.onPress!(null as never);
  const copied = (copyClash.edits.at(-1) as Record<string, unknown>).objects as Record<string, unknown>[];
  assert.equal(copied[2]!.id, 'object-4', 'the copy takes the next free id');
  assert.deepEqual(unique(copied), ['object-1', 'object-3', 'object-4']);

  // With no clash the copy still takes no authored id.
  const plain = await studioBarHarness(
    { source: 'arrangement', activeObject: 1, objects: [{ kind: 'primitive', primitive: 'box' }, { kind: 'primitive', primitive: 'sphere', x: 2 }] },
    { layer: true, commitMany: true, selected: true }
  );
  plain.action('studio-duplicate')!.onPress!(null as never);
  assert.equal(((plain.edits.at(-1) as Record<string, unknown>).objects as Record<string, unknown>[])[2]!.id, undefined);

  // Removing the first row moves the third into the second place, whose id another row holds.
  const removeClash = await studioBarHarness(
    { source: 'arrangement', activeObject: 1, objects: [{ kind: 'primitive', primitive: 'box' }, { id: 'object-2', kind: 'primitive', primitive: 'sphere', x: 2 }, { kind: 'primitive', primitive: 'badge', x: -2 }] },
    { layer: true, commitMany: true, selected: true }
  );
  removeClash.action('studio-remove')!.onPress!(null as never);
  const left = (removeClash.edits.at(-1) as Record<string, unknown>).objects as Record<string, unknown>[];
  assert.deepEqual(left.map((row) => row.id), ['object-2', 'object-3'], 'the rows left keep the ids they had');
  assert.deepEqual(unique(left), ['object-2', 'object-3']);
});

test('the selected object offers Duplicate, Remove, Rest on the stage and Tilt, each one step', async () => {
  const rows = [
    { name: 'Badge', kind: 'primitive', primitive: 'badge', x: -1.2, rotY: 12, scale: 0.55 },
    { name: 'Sphere', kind: 'primitive', primitive: 'sphere', x: 1.05, y: 0.4, z: -0.2, scale: 0.4 },
    { id: 'kept', kind: 'primitive', primitive: 'box', x: 0.15, z: -1.7, grounded: false },
  ];
  const values = { source: 'arrangement', activeObject: 2, objects: rows };
  // Without a handle layer (multi-edit, a Design scene box) there are no object actions.
  const plain = await studioBarHarness(values);
  assert.deepEqual(['studio-duplicate', 'studio-remove', 'studio-rest'].map((id) => plain.action(id)), [undefined, undefined, undefined]);
  assert.ok(plain.action('studio-tilt'), 'Tilt stays, as the turn mode it replaces did');
  // With one, they wait for a selection.
  const idle = await studioBarHarness(values, { layer: true, commitMany: true });
  assert.equal(idle.action('studio-duplicate')?.disabled, true);
  assert.match(idle.status(), /Click an object or press Enter to select it/);
  const bar = await studioBarHarness(values, { layer: true, commitMany: true, selected: true });
  assert.match(bar.status(), /Drag the ring to turn/);
  for (const id of ['studio-duplicate', 'studio-remove', 'studio-rest']) assert.equal(bar.action(id)?.disabled, false, id);

  bar.action('studio-duplicate')!.onPress!(null as never);
  const copy = bar.edits.at(-1) as Record<string, unknown>;
  assert.deepEqual(Object.keys(copy).sort(), ['activeObject', 'objects'], 'a copy and its selection are one step');
  const copied = copy.objects as Record<string, unknown>[];
  assert.equal(copied.length, 4);
  assert.equal(copy.activeObject, 4, 'the copy is selected');
  assert.equal(copied[3]!.name, 'Sphere copy');
  assert.equal(copied[3]!.id, undefined, 'the copy takes no authored id');
  assert.notEqual(copied[3]!.x, rows[1]!.x, 'the copy stands to one side');

  bar.action('studio-rest')!.onPress!(null as never);
  const rested = bar.edits.at(-1) as { id: string; value: Record<string, unknown>[] };
  assert.equal(rested.id, 'objects');
  assert.equal(rested.value[1]!.y, 0);
  assert.equal(rested.value[1]!.grounded, true);

  bar.action('studio-remove')!.onPress!(null as never);
  const removed = bar.edits.at(-1) as Record<string, unknown>;
  assert.deepEqual((removed.objects as Record<string, unknown>[]).map((row) => row.name ?? row.id), ['Badge', 'kept']);
  assert.equal(removed.activeObject, 1, 'the object before the one removed is selected');

  // The last object an arrangement can show cannot be removed, and one at rest cannot rest again.
  const lone = await studioBarHarness(
    { source: 'arrangement', activeObject: 1, objects: [{ kind: 'primitive', primitive: 'box' }, { kind: 'primitive', primitive: 'sphere', visible: false }] },
    { layer: true, selected: true }
  );
  assert.equal(lone.action('studio-remove')?.disabled, true);
  assert.equal(lone.action('studio-rest')?.disabled, true);
  // The name opens the list of objects; choosing one selects that object. The harness keeps no
  // saved values, so it is loaded again with the values the presses above started from.
  await bar.sync(values);
  const list = bar.action('studio-object-label')!;
  assert.match(list.label, /2 of 3: Sphere/);
  const items = list.menu!();
  assert.deepEqual(items.map((item) => [item.label, !!item.checked]), [['Badge', false], ['Sphere', true], ['Object 3', false]]);
  items[0]!.onPress();
  assert.deepEqual(bar.edits.at(-1), { id: 'activeObject', value: 1 });
});

test('a lone subject rests on the stage through its own position input', async () => {
  const bar = await studioBarHarness(
    { source: 'primitive', primitive: 'sphere', position: { x: 0.5, y: 0.6, z: -0.25 } },
    { layer: true, selected: true }
  );
  assert.equal(bar.action('studio-duplicate'), undefined, 'a lone subject has no copy to make');
  assert.equal(bar.action('studio-remove'), undefined);
  bar.action('studio-rest')!.onPress!(null as never);
  assert.deepEqual(bar.edits.at(-1), { id: 'position', value: { x: 0.5, y: 0, z: -0.25 } });
});
