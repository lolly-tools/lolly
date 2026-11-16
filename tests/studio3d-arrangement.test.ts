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
  assert.ok(bar.action('studio-move'), 'an arrangement offers Move objects');
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
  assert.ok((await studioBarHarness({ source: 'arrangement', objects: rows })).action('studio-move'));
  runtime.destroy();
});
