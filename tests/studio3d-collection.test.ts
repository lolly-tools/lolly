// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { buildStudioScene, studioAnimated, studioLightMotion } from '../engine/src/studio3d.ts';
import {
  STUDIO_SHEET_PIXELS,
  studioActiveValues,
  studioCameraEdit,
  studioFocusEdit,
  studioCollectionRows,
  studioCollectionSize,
  studioSheetSize,
  studioSubjectEdit,
  studioSubjectIds,
} from '../engine/src/studio3d-collection.ts';
import { parseUrlState, serializeUrlState } from '../engine/src/url-mode.ts';
import { baseHost } from './helpers/host.ts';
import { studioBarHarness } from './helpers/studio3d-bar.ts';

const collection = {
  source: 'collection',
  activeSubject: 2,
  studio: 'warm',
  camera: { azimuth: 20, elevation: 14, fov: 29, zoom: 1.1 },
  subjects: [
    { name: '../Same name', kind: 'artwork', asset: 'user/a.svg', roleA: 'body', roleB: 'accent' },
    {
      name: '../Same name',
      kind: 'model',
      asset: 'user/b.glb',
      ownFraming: true,
      azimuth: 60,
      zoom: 0.9,
    },
  ],
};
test('collection edits inherit shared values and preserve explicit framing and role bindings', () => {
  const focus = studioFocusEdit(collection, 8);
  const focused = studioCollectionRows({ ...collection, subjects: focus.value });
  assert.equal(focused[1]!.values.focusDistance, 8);
  assert.equal(focused[0]!.values.focusDistance, undefined);
  const saved = structuredClone(collection);
  const rows = studioCollectionRows(collection);
  assert.deepEqual(
    rows.map((r) => r.filename),
    ['01-same-name.png', '02-same-name.png']
  );
  assert.equal(rows[0]!.values.artwork, 'user/a.svg');
  assert.equal(rows[1]!.values.modelAsset, 'user/b.glb');
  assert.equal(rows[0]!.values.materialSlotA, 'body');
  assert.deepEqual(studioActiveValues(collection), rows[1]!.values);
  const changed = studioCollectionRows({
    ...collection,
    studio: 'electric',
    camera: { ...collection.camera, azimuth: 10 },
  });
  assert.equal((changed[0]!.values.camera as any).azimuth, 10);
  assert.equal((changed[1]!.values.camera as any).azimuth, 60);
  assert.equal(changed[1]!.values.studio, 'electric');
  const edit = studioCameraEdit(collection, { azimuth: 45, elevation: 20, zoom: 1, fov: 30 });
  assert.equal(edit.id, 'subjects');
  assert.equal((edit.value as any[])[0], collection.subjects[0]);
  assert.equal((edit.value as any[])[1].azimuth, 45);
  assert.deepEqual(collection, saved);
  assert.throws(() => studioCollectionRows({ subjects: [] }), /at least one/);
  assert.throws(() => studioCollectionRows({ subjects: Array(25).fill({}) }), /24/);
  assert.throws(
    () => studioCollectionSize({ collectionSize: { width: 4096, height: 4096 } }),
    /12 million/
  );
});

test('the real tool resolves nested assets and preserves a collection through URL mode', async () => {
  const tool = await loadTool('3d-studio', (p) => readFile(join('community', p), 'utf8'));
  const host = baseHost({
    assets: { get: async (id: string) => ({ id, url: `/assets/${id}`, name: id }) },
  });
  const runtime = await createRuntime(tool, host, collection);
  const parsed = parseUrlState(
    serializeUrlState(runtime.getModel(), { keepUserIds: true }),
    tool.manifest
  );
  const reopened = await createRuntime(tool, host, parsed.values);
  const values = (rt: typeof runtime) =>
    Object.fromEntries(rt.getModel().map((i) => [i.id, i.value]));
  const before = studioCollectionRows(values(runtime));
  const after = studioCollectionRows(values(reopened));
  assert.equal((values(reopened).subjects as any[])[1].ownFraming, true);
  assert.deepEqual(
    after.map((row) => row.filename),
    before.map((row) => row.filename)
  );
  assert.deepEqual(
    after.map((row) => buildStudioScene({ version: 1, values: row.values })),
    before.map((row) => buildStudioScene({ version: 1, values: row.values }))
  );
  assert.equal(buildStudioScene({ version: 1, values: values(reopened) }).source.kind, 'glb');
  // The collection controls are the shell's (lib/studio3d/toolbar.ts), from the same values.
  const bar = await studioBarHarness(values(reopened), { reviewCollection: true });
  assert.ok(bar.action('studio-review'), 'a collection offers Review collection');
  assert.ok(bar.action('studio-shared-camera'), 'an item with its own framing offers Use shared framing');
  await reopened.setInput('lightMotion', 'orbit');
  await reopened.setInput('duration', 6);
  assert.match(reopened.getHydrated(), /data-clip-ms="6000"/);
  runtime.destroy();
  reopened.destroy();
});

test('animated lights use saved clip timing and close their loop without moving the object', () => {
  for (const kind of ['orbit', 'breathe']) {
    const scene = buildStudioScene({
      version: 1,
      values: { motion: 'still', lightMotion: kind, lightMotionAmount: 0.6, duration: 8 },
    });
    assert.equal(studioAnimated(scene), true);
    assert.deepEqual(studioLightMotion(scene, 0), { angle: 0, strength: 1 });
    assert.deepEqual(studioLightMotion(scene, 1), studioLightMotion(scene, 0));
    assert.deepEqual(studioLightMotion(scene, 0.5, 4), studioLightMotion(scene, 0.25, 8));
    assert.notDeepEqual(studioLightMotion(scene, 0.25), studioLightMotion(scene, 0));
    assert.equal(scene.motion.kind, 'still');
  }
});

/** Twelve unlike icons under one studio: the corrections that bring them to one size. */
const corrected = {
  source: 'collection',
  activeSubject: 1,
  studio: 'dramatic',
  colorA: '#30ba78',
  colorB: '#0c322c',
  camera: { azimuth: 20, elevation: 14, fov: 29, zoom: 1.1 },
  transform: { scale: 1 },
  position: { x: 0, y: 0.1, z: 0 },
  subjects: [
    { name: 'Bolt in a ring', kind: 'artwork', asset: { url: '/icons/bolt-ring.svg' } },
    { name: 'Padlock', kind: 'artwork', asset: { url: '/icons/padlock.svg' }, scale: 1.3, offsetY: 0.4 },
    { name: 'Cloud', kind: 'artwork', asset: { url: '/icons/cloud.svg' }, scale: 0.8, offsetX: -0.15 },
    {
      name: 'Words',
      kind: 'text',
      text: 'Lolly',
      font: 'display',
      ownFraming: true,
      azimuth: 0,
      zoom: 0.9,
    },
  ],
};

test('per-item corrections and framing survive a change of studio, colours and finishes', () => {
  const rows = studioCollectionRows(corrected);
  // A row at the defaults writes no transform or position of its own, so a collection
  // saved before corrections existed renders exactly as it did.
  assert.deepEqual(rows[0]!.values.transform, { scale: 1 });
  assert.deepEqual(rows[0]!.values.position, { x: 0, y: 0.1, z: 0 });
  assert.equal((rows[1]!.values.transform as { scale: number }).scale, 1.3);
  assert.deepEqual(rows[1]!.values.position, { x: 0, y: 0.5, z: 0 });
  assert.equal((rows[2]!.values.transform as { scale: number }).scale, 0.8);
  assert.deepEqual(rows[2]!.values.position, { x: -0.15, y: 0.1, z: 0 });
  const edited = studioCollectionRows({
    ...corrected,
    studio: 'electric',
    colorA: '#ff8800',
    colorB: '#101820',
    finishA: 'chrome',
    finishB: 'matte',
    surfaceFinishes: true,
    bevelFinishA: 'metal',
  });
  for (const [index, row] of edited.entries()) {
    assert.deepEqual(row.values.transform, rows[index]!.values.transform);
    assert.deepEqual(row.values.position, rows[index]!.values.position);
    assert.equal(row.ownFraming, rows[index]!.ownFraming);
    assert.deepEqual(row.values.camera, rows[index]!.values.camera);
    assert.equal(row.values.colorA, '#ff8800');
    assert.equal(row.values.finishA, 'chrome');
  }
  // An item's own framing still wins over the shared camera after the studio changed.
  assert.equal((edited[3]!.values.camera as { azimuth: number }).azimuth, 0);
  assert.equal((edited[0]!.values.camera as { azimuth: number }).azimuth, 20);
  // Corrections are bounded where they are read, not where they are stored.
  const bounded = studioCollectionRows({
    ...corrected,
    subjects: [{ ...corrected.subjects[0], scale: 9, offsetX: -40 }],
  });
  assert.equal((bounded[0]!.values.transform as { scale: number }).scale, 2);
  assert.equal((bounded[0]!.values.position as { x: number }).x, -5);
});

test('collection items carry stable ids and overrides follow the id, not the position', () => {
  assert.deepEqual(studioSubjectIds(corrected), [
    'object-1',
    'object-2',
    'object-3',
    'object-4',
  ]);
  assert.deepEqual(
    studioCollectionRows(corrected).map((row) => [row.id, row.filename]),
    [
      ['object-1', '01-bolt-in-a-ring.png'],
      ['object-2', '02-padlock.png'],
      ['object-3', '03-cloud.png'],
      ['object-4', '04-words.png'],
    ]
  );
  const named = {
    ...corrected,
    subjects: corrected.subjects.map((item, i) => ({ ...item, id: `icon-${i + 1}` })),
  };
  assert.deepEqual(studioSubjectIds(named), ['icon-1', 'icon-2', 'icon-3', 'icon-4']);
  // The same edit, addressed by id, reaches the same item after the rows are reordered.
  const override = { ownFraming: true, elevation: 40 };
  const straight = studioSubjectEdit(named, 'icon-3', override).value as Record<string, unknown>[];
  const shuffled = {
    ...named,
    subjects: [named.subjects[3]!, named.subjects[2]!, named.subjects[0]!, named.subjects[1]!],
  };
  const moved = studioSubjectEdit(shuffled, 'icon-3', override).value as Record<string, unknown>[];
  assert.deepEqual(moved[1], straight[2]);
  assert.equal(moved[1]!.elevation, 40);
  assert.throws(() => studioSubjectEdit(named, 'icon-9', override), /no item/i);
  assert.throws(
    () =>
      studioCollectionRows({
        ...corrected,
        subjects: [{ id: 'same' }, { id: 'same' }],
      }),
    /Items 1 and 2 share the id "same"/
  );
  // A camera gesture on the previewed item is one of those id-addressed edits.
  const gesture = studioCameraEdit(
    { ...named, activeSubject: 3 },
    { azimuth: 45, elevation: 20, zoom: 1, fov: 30 }
  ).value as Record<string, unknown>[];
  assert.equal(gesture[2]!.azimuth, 45);
  assert.equal(gesture[2]!.id, 'icon-3');
  assert.equal(gesture[0], named.subjects[0]);
});

test('a Words item sets the shared typesetting, and its own font when it names one', () => {
  const rows = studioCollectionRows(corrected);
  const words = buildStudioScene({ version: 1, values: rows[3]!.values });
  assert.equal(words.source.kind, 'text');
  assert.equal(words.source.text?.text, 'Lolly');
  assert.equal(words.source.text?.font, 'display');
  const shared = studioCollectionRows({
    ...corrected,
    wordFont: 'mono',
    subjects: [{ name: 'Words', kind: 'text', text: 'Lolly', font: 'inherit' }],
  });
  assert.equal(
    buildStudioScene({ version: 1, values: shared[0]!.values }).source.text?.font,
    'mono'
  );
  assert.throws(
    () =>
      buildStudioScene({
        version: 1,
        values: studioCollectionRows({
          ...corrected,
          subjects: [{ name: 'Words', kind: 'text', text: '' }],
        })[0]!.values,
      }),
    /Type the words/
  );
});

test('the contact sheet asks for the saved size, reduced to the sheet cap', () => {
  assert.deepEqual(studioSheetSize({ width: 1024, height: 1024 }), { width: 512, height: 512 });
  assert.deepEqual(studioSheetSize({ width: 1920, height: 1080 }), { width: 512, height: 288 });
  assert.deepEqual(studioSheetSize({ width: 400, height: 300 }), { width: 400, height: 300 });
  assert.equal(STUDIO_SHEET_PIXELS, 512);
});
