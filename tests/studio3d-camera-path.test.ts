// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import {
  STUDIO_CAMERA_KEY_LIMIT,
  STUDIO_CAMERA_PRESETS,
  studioAddCameraKey,
  studioCameraApparentSize,
  studioCameraFromKey,
  studioCameraKeyLabel,
  studioCameraPose,
  studioCameraPresetEdit,
  studioCameraPresetRows,
  studioCameraTravels,
  studioRestPose,
} from '../engine/src/studio3d-camera-path.ts';
import { buildStudioScene, studioAnimated } from '../engine/src/studio3d.ts';
import { parseUrlState, serializeUrlState } from '../engine/src/url-mode.ts';
import {
  CAMERA_PRESET_SETS,
  presetFixture,
} from './fixtures/studio3d/recipes/generate-camera-presets.ts';
import { baseHost } from './helpers/host.ts';
import { studioBarHarness } from './helpers/studio3d-bar.ts';

const keys = [
  { at: 0, azimuth: 0, elevation: 10, fov: 30, zoom: 1, panX: 0, panY: 1.6, panZ: 0 },
  { at: 50, azimuth: 90, elevation: 30, fov: 40, zoom: 0.8, panX: 1, panY: 2, panZ: -1 },
  { at: 100, azimuth: 180, elevation: 10, fov: 30, zoom: 1.2, panX: 0, panY: 1.6, panZ: 0 },
];

test('a still camera or fewer than two keys holds the rest pose', () => {
  const scene = buildStudioScene({ version: 1, values: { camera: { azimuth: 33, zoom: 1.4 } } });
  assert.equal(studioCameraTravels(scene), false);
  assert.equal(studioAnimated(scene), false);
  assert.deepEqual(studioCameraPose(scene, 0.5), studioRestPose(scene));
  assert.equal(studioCameraPose(scene, 0.5).azimuth, 33);
  const one = buildStudioScene({
    version: 1,
    values: { cameraMotion: 'keys', cameraKeys: [keys[0]], camera: { azimuth: 33 } },
  });
  assert.equal(studioCameraTravels(one), false);
  assert.equal(studioCameraPose(one, 0.7).azimuth, 33, 'one key is not a move');
});

test('keys sample deterministically, ease per leg, flow through, and close the loop on request', () => {
  const scene = buildStudioScene({
    version: 1,
    values: { cameraMotion: 'keys', cameraKeys: keys, duration: 4 },
  });
  assert.equal(studioCameraTravels(scene), true);
  assert.equal(studioAnimated(scene), true);
  assert.equal(scene.motion.kind, 'still', 'a camera path does not spin the object');
  const at = (t: number, clip?: number) => studioCameraPose(scene, t, clip);
  assert.deepEqual(at(0), { ...at(0), azimuth: 0, elevation: 10, zoom: 1 });
  assert.equal(at(0.5).azimuth, 90);
  assert.deepEqual(at(0.25), at(0.25));
  assert.deepEqual(at(0.5, 8), at(1, 4), 'clip seconds map onto the loop the same way');
  assert.equal(at(0.25).azimuth, 45, 'smooth easing passes the midpoint of a leg at its middle');
  assert.ok(at(0.1).azimuth < 18 && at(0.1).azimuth > 0, 'smooth easing starts slowly');
  assert.equal(at(1).azimuth, 180);
  const linear = buildStudioScene({
    version: 1,
    values: { cameraMotion: 'keys', cameraKeys: keys, cameraEase: 'linear' },
  });
  assert.ok(Math.abs(studioCameraPose(linear, 0.1).azimuth - 18) < 1e-9);
  const flow = buildStudioScene({
    version: 1,
    values: { cameraMotion: 'keys', cameraKeys: keys, cameraEase: 'flow' },
  });
  assert.equal(studioCameraPose(flow, 0.5).azimuth, 90, 'flow passes through every key');
  assert.notEqual(studioCameraPose(flow, 0.25).elevation, studioCameraPose(linear, 0.25).elevation);
  const loop = buildStudioScene({
    version: 1,
    values: { cameraMotion: 'keys', cameraKeys: keys.slice(0, 2).map((k, i) => ({ ...k, at: i * 50 })), cameraLoop: true },
  });
  assert.equal(studioCameraPose(loop, 1).azimuth, 0, 'the loop returns to the first key');
  assert.equal(studioCameraPose(loop, 0.5).azimuth, 90);
  const partial = buildStudioScene({
    version: 1,
    values: {
      cameraMotion: 'keys',
      cameraKeys: [
        { ...keys[0], focusDistance: 4 },
        { ...keys[1], focusDistance: 0 },
      ],
    },
  });
  assert.equal(studioCameraPose(partial, 0.5).focus, 0, 'a leg touching automatic focus stays automatic');
  assert.throws(
    () =>
      buildStudioScene({
        version: 1,
        values: { cameraKeys: Array(STUDIO_CAMERA_KEY_LIMIT + 1).fill(keys[0]) },
      }),
    /up to 12 keys/
  );
});

test('the live view becomes a key, keys are spaced evenly, and a key restores the view', () => {
  const values = {
    camera: { azimuth: 40, elevation: 20, fov: 35, zoom: 0.9, panX: 0.5, panY: -0.2, panZ: 0 },
    target: { x: 0, y: 1.6, z: 0 },
    focusDistance: 3,
    cameraKeys: [{ at: 0, azimuth: 0, elevation: 10, fov: 30, zoom: 1, panX: 0, panY: 1.6, panZ: 0 }],
  };
  const added = studioAddCameraKey(values);
  assert.equal(added.id, 'cameraKeys');
  const rows = added.value as Record<string, number>[];
  assert.equal(rows.length, 2);
  assert.deepEqual([rows[0]!.at, rows[1]!.at], [0, 100]);
  assert.deepEqual(
    [rows[1]!.azimuth, rows[1]!.zoom, rows[1]!.panX, rows[1]!.panY, rows[1]!.focusDistance],
    [40, 0.9, 0.5, 1.4, 3]
  );
  const three = studioAddCameraKey({ ...values, cameraKeys: rows }).value as Record<string, number>[];
  assert.deepEqual(three.map((r) => r.at), [0, 50, 100]);
  const back = studioCameraFromKey({ ...values, cameraKeys: rows }, 1);
  assert.deepEqual(back[0], {
    id: 'camera',
    value: { azimuth: 40, elevation: 20, fov: 35, zoom: 0.9, panX: 0.5, panY: -0.2, panZ: 0 },
  });
  assert.deepEqual(back[1], { id: 'focusDistance', value: 3 });
  assert.throws(() => studioCameraFromKey(values, 5), /does not exist/);
  assert.throws(
    () => studioAddCameraKey({ cameraKeys: Array(STUDIO_CAMERA_KEY_LIMIT).fill({}) }),
    /up to 12 keys/
  );
});

test('a key name is the reader\'s own label, and a named key can be recalled by that name', () => {
  const scene = buildStudioScene({
    version: 1,
    values: {
      cameraMotion: 'keys',
      cameraKeys: [
        { ...keys[0], name: '  Hero  ' },
        { ...keys[1], name: 'W'.repeat(60) },
        keys[2],
      ],
    },
  });
  const path = scene.cameraMotion!.keys;
  assert.equal(path[0]!.name, 'Hero', 'a name is trimmed');
  assert.equal(path[1]!.name!.length, 40, 'a name is capped at 40 characters');
  assert.equal('name' in path[2]!, false, 'an unnamed key carries no name at all');
  // A path saved before naming existed evaluates to exactly the fields it always had.
  const plain = buildStudioScene({ version: 1, values: { cameraMotion: 'keys', cameraKeys: keys } });
  assert.deepEqual(Object.keys(plain.cameraMotion!.keys[0]!).sort(), [
    'at',
    'azimuth',
    'elevation',
    'focus',
    'fov',
    'target',
    'zoom',
  ]);
  assert.deepEqual(studioCameraPose(scene, 0.25), studioCameraPose(plain, 0.25), 'names do not move the camera');

  const values = {
    camera: { azimuth: 40, elevation: 20, fov: 35, zoom: 0.9, panX: 0, panY: 0, panZ: 0 },
    target: { x: 0, y: 1.6, z: 0 },
    cameraKeys: [{ ...keys[0], name: 'Hero' }, keys[1]],
  };
  assert.deepEqual(studioCameraFromKey(values, 'hero'), studioCameraFromKey(values, 0), 'letter case does not matter');
  assert.throws(() => studioCameraFromKey(values, 'Nowhere'), /does not exist/);
  assert.throws(() => studioCameraFromKey(values, '   '), /does not exist/, 'an empty name matches no key');
  assert.equal(studioCameraKeyLabel(values, 0), 'Key 1 of 2: Hero');
  assert.equal(studioCameraKeyLabel(values, 1), 'Key 2 of 2');
});

/**
 * Go to key, the preview's own control, on the real hydrated template: each press asks
 * the shell for the next key's view and says which key that is. The renderer is a stub,
 * because the button only reads values and writes inputs (plan 265 milestone 3, F2).
 */
test('Go to key steps through the saved views and names the one it reached', async () => {
  const values = {
    cameraMotion: 'keys',
    cameraKeys: [{ ...keys[0], name: 'Hero' }, keys[1]],
    camera: {},
    target: { x: 0, y: 1.6, z: 0 },
  };
  // One edit across two inputs is one undo step: the studio hands both to commitMany.
  const bar = await studioBarHarness(values, { commitMany: true });
  const go = bar.action('studio-go-key');
  assert.ok(go, 'the camera path group offers Go to key');
  assert.equal(go.disabled, false);
  const batch = (edits: { id: string; value: unknown }[]) => Object.fromEntries(edits.map((e) => [e.id, e.value]));
  go.onPress!(null as never);
  assert.deepEqual(bar.edits, [batch(studioCameraFromKey(values, 0))]);
  assert.equal(bar.status(), 'Key 1 of 2: Hero: turn Play path off to hold this view.');
  bar.edits.length = 0;
  go.onPress!(null as never);
  assert.deepEqual(bar.edits, [batch(studioCameraFromKey(values, 1))]);
  assert.equal(bar.status(), 'Key 2 of 2: turn Play path off to hold this view.');
  bar.edits.length = 0;
  go.onPress!(null as never);
  assert.deepEqual(bar.edits, [batch(studioCameraFromKey(values, 0))], 'the last key wraps round to the first');
});

test('the real tool carries a camera path through URL mode and reports the clip length', async () => {
  const tool = await loadTool('3d-studio', (p) => readFile(join('community', p), 'utf8'));
  const host = baseHost();
  const runtime = await createRuntime(tool, host, {
    cameraMotion: 'keys',
    cameraKeys: keys.map((key, i) => (i === 1 ? { ...key, name: 'Hero shot' } : key)),
    duration: 6,
  });
  assert.match(runtime.getHydrated(), /data-clip-ms="6000"/);
  const live = Object.fromEntries(runtime.getModel().map((i) => [i.id, i.value]));
  const bar = await studioBarHarness(live);
  assert.equal(bar.action('studio-play')?.pressed, true, 'Play path reads on while the keys play');
  assert.ok(bar.action('studio-go-key'));
  const parsed = parseUrlState(serializeUrlState(runtime.getModel()), tool.manifest);
  const reopened = await createRuntime(tool, host, parsed.values);
  const values = Object.fromEntries(reopened.getModel().map((i) => [i.id, i.value]));
  const scene = buildStudioScene({ version: 1, values });
  assert.equal(scene.cameraMotion?.keys.length, 3);
  assert.equal(scene.cameraMotion?.keys[1]?.name, 'Hero shot', 'a key name travels in the link');
  assert.equal(studioCameraPose(scene, 0.5).azimuth, 90);
  await reopened.setInput('cameraMotion', 'still');
  assert.match(reopened.getHydrated(), /data-clip-ms="0"/);
  await bar.sync(Object.fromEntries(reopened.getModel().map((i) => [i.id, i.value])));
  assert.equal(bar.action('studio-play')?.pressed, false);
  runtime.destroy();
  reopened.destroy();
});

/**
 * The camera moves (plan 267, lane D). A move is key data: buildStudioScene makes its
 * rows from the live view and puts them in `cameraMotion.keys`, so the path evaluator
 * draws a move exactly as it draws authored keys, and Convert to keys hands the rows
 * over unchanged. These tests pin that equality, the keys each move makes, and the one
 * case a move refuses: a dolly zoom under an orthographic camera.
 */
const PRESET_EASES = ['smooth', 'linear', 'flow'] as const;
/** The fields a pose carries; a converted key also carries the name it was given. */
const POSE_FIELDS = ['at', 'azimuth', 'elevation', 'fov', 'zoom', 'focus'] as const;

function samePose(a: ReturnType<typeof studioCameraPose>, b: typeof a, where: string): void {
  for (const field of POSE_FIELDS)
    assert.ok(Math.abs(a[field] - b[field]) < 1e-9, `${where}: ${field} ${a[field]} vs ${b[field]}`);
  for (let i = 0; i < 3; i++)
    assert.ok(Math.abs(a.target[i]! - b.target[i]!) < 1e-9, `${where}: target ${i}`);
}

test('a camera move draws the same frames as the keys it converts to', () => {
  for (const kind of STUDIO_CAMERA_PRESETS)
    for (const ease of PRESET_EASES)
      for (const loop of [false, true]) {
        const camera = { azimuth: -12, elevation: 22, fov: 34, zoom: 1.1, panX: 0.3 };
        const values = {
          cameraMotion: kind,
          cameraAmount: 1.25,
          cameraEase: ease,
          cameraLoop: loop,
          camera,
          focusDistance: 5,
        };
        const move = buildStudioScene({ version: 1, values });
        assert.equal(move.cameraMotion?.kind, kind, 'the recipe keeps the move by name');
        assert.equal(studioCameraTravels(move), true);
        assert.equal(studioAnimated(move), true);
        const edit = studioCameraPresetEdit(move);
        assert.deepEqual(
          edit.map((e) => e.id),
          ['cameraKeys', 'cameraMotion'],
          'one edit writes the rows and one switches to keys, so one undo takes it back'
        );
        assert.equal(edit[1]!.value, 'keys');
        const converted = buildStudioScene({
          version: 1,
          values: { ...values, cameraMotion: 'keys', cameraKeys: edit[0]!.value },
        });
        for (let i = 0; i <= 31; i++) {
          const phase = i / 31;
          samePose(
            studioCameraPose(move, phase),
            studioCameraPose(converted, phase),
            `${kind} ${ease} loop ${loop} at ${phase}`
          );
        }
      }
});

test('each camera move is made from the live view, and the amount says how far it goes', () => {
  const live = { azimuth: 25, elevation: 14, fov: 29, zoom: 1 };
  const keysOf = (values: Record<string, unknown>) =>
    buildStudioScene({ version: 1, values }).cameraMotion!.keys;
  // Orbit sweep: a little each way about the live azimuth, and back where it started.
  for (const [amount, angle] of [
    [0.25, 5],
    [1, 20],
    [2, 40],
  ] as const) {
    const keys = keysOf({ cameraMotion: 'sweep', cameraAmount: amount });
    assert.deepEqual(
      keys.map((k) => k.azimuth),
      [live.azimuth - angle, live.azimuth + angle, live.azimuth - angle],
      `sweep at amount ${amount}`
    );
    assert.deepEqual(
      keys.map((k) => k.at),
      [0, 0.5, 1]
    );
  }
  // An amount outside the range is held to it, as the input is.
  assert.equal(keysOf({ cameraMotion: 'sweep', cameraAmount: 9 })[1]!.azimuth, live.azimuth + 40);
  // Push in: closer over the loop, and with the loop off the close view holds.
  const push = keysOf({ cameraMotion: 'pushin' });
  assert.deepEqual(
    push.map((k) => k.zoom),
    [0.85, 1.15]
  );
  const pushScene = buildStudioScene({ version: 1, values: { cameraMotion: 'pushin' } });
  assert.equal(studioCameraPose(pushScene, 2).zoom, 1.15, 'an open move holds its last view');
  // Reveal turn: in from the side and down to the live view, one shot.
  const reveal = keysOf({ cameraMotion: 'reveal', cameraAmount: 0.5 });
  assert.deepEqual(
    reveal.map((k) => [k.azimuth, k.elevation, k.zoom]),
    [
      [live.azimuth - 45, 30, 0.8],
      [live.azimuth, live.elevation, 1],
    ]
  );
  // Crane: down onto the live view while the zoom rises, held inside the key range.
  assert.deepEqual(
    keysOf({ cameraMotion: 'crane' }).map((k) => [k.elevation, k.zoom]),
    [
      [live.elevation + 25, 0.85],
      [live.elevation, 1],
    ]
  );
  assert.equal(
    keysOf({ cameraMotion: 'crane', camera: { elevation: 70 } })[0]!.elevation,
    80,
    'the elevation range holds a crane that would start above it'
  );
  // Authored keys are left alone while a move is chosen, and come back with them.
  const both = buildStudioScene({
    version: 1,
    values: { cameraMotion: 'sweep', cameraKeys: keys },
  });
  assert.equal(both.cameraMotion!.keys.length, 3);
  assert.deepEqual(both.cameraMotion!.keys[0]!.target, [0, 1.6, 0]);
  assert.equal(
    buildStudioScene({ version: 1, values: { cameraMotion: 'keys', cameraKeys: keys } })
      .cameraMotion!.keys[1]!.azimuth,
    90,
    'switching back to keys draws the authored path again'
  );
});

test('a dolly zoom holds the subject size, and does nothing under an orthographic camera', () => {
  const values = { cameraMotion: 'dolly', camera: { fov: 34, zoom: 1.1 } };
  const scene = buildStudioScene({ version: 1, values });
  const live = studioCameraApparentSize(scene.camera);
  assert.deepEqual(
    scene.cameraMotion!.keys.map((k) => k.fov),
    [60, 42, 24],
    'the lens goes wide and then long, through a key that keeps the framing on the way'
  );
  for (const phase of [0, 0.25, 0.5, 0.75, 1]) {
    const pose = studioCameraPose(scene, phase);
    const size = studioCameraApparentSize(pose);
    assert.ok(
      Math.abs(size - live) <= live * 0.02,
      `at ${phase} the subject measures ${size} where the live view measures ${live}`
    );
  }
  // An orthographic camera ignores the field of view, so the move makes no keys at all
  // and the camera holds the live view; the recipe still records what was chosen.
  const flat = buildStudioScene({
    version: 1,
    values: { ...values, projection: 'orthographic' },
  });
  assert.equal(flat.cameraMotion!.kind, 'dolly');
  assert.deepEqual(flat.cameraMotion!.keys, []);
  assert.equal(studioCameraTravels(flat), false);
  assert.equal(studioAnimated(flat), false);
  assert.deepEqual(studioCameraPose(flat, 0.4), studioRestPose(flat));
  assert.throws(() => studioCameraPresetEdit(flat), /makes no keys/);
  // Where the zoom range cannot go far enough the framing moves, and the shell says so.
  const tight = buildStudioScene({ version: 1, values: { cameraMotion: 'dolly', camera: { zoom: 2 } } });
  assert.equal(tight.cameraMotion!.keys[0]!.zoom, 3, 'the zoom range holds the wide end');
  assert.ok(
    studioCameraApparentSize(tight.cameraMotion!.keys[0]!) >
      studioCameraApparentSize(tight.camera) * 1.02
  );
});

test('the rows a camera move hands over are named and carry the view whole', () => {
  const scene = buildStudioScene({
    version: 1,
    values: {
      cameraMotion: 'reveal',
      camera: { azimuth: 40, elevation: 10, fov: 35, zoom: 0.9, panX: 0.5 },
      focusDistance: 7,
    },
  });
  const rows = studioCameraPresetRows(scene);
  assert.deepEqual(
    rows.map((r) => r.name),
    ['Reveal 1', 'Reveal 2']
  );
  assert.deepEqual(
    rows.map((r) => r.at),
    [0, 100],
    'a row holds the moment as a percentage, the way the sidebar shows it'
  );
  assert.deepEqual(rows[1], {
    at: 100,
    azimuth: 40,
    elevation: 10,
    fov: 35,
    zoom: 0.9,
    panX: 0.5,
    panY: 1.6,
    panZ: 0,
    focusDistance: 7,
    name: 'Reveal 2',
  });
  assert.throws(
    () => studioCameraPresetRows(buildStudioScene({ version: 1, values: {} })),
    /No camera move is chosen/
  );
});

test('the pinned camera moves evaluate as they were pinned', () => {
  for (const { kind, values } of CAMERA_PRESET_SETS) {
    const pinned = JSON.parse(
      readFileSync(join('tests/fixtures/studio3d/recipes', `05-camera-${kind}.json`), 'utf8')
    );
    assert.deepEqual(
      { source: pinned.source, ...presetFixture(values) },
      pinned,
      `05-camera-${kind}.json: rerun node tests/fixtures/studio3d/recipes/generate-camera-presets.ts to re-pin a deliberate change`
    );
  }
});

/**
 * Convert to keys on the real hydrated template, with a stub renderer: the button hands
 * the move's rows to the sidebar and switches to keys in one commit, and it is only
 * there while a move is chosen (plan 267, D3).
 */
test('Convert to keys hands the move over as editable rows', async () => {
  const values: Record<string, unknown> = { cameraMotion: 'sweep', camera: {}, target: {} };
  // Without commitMany (a multi-edit cell) each input is written on its own, in order.
  const bar = await studioBarHarness(values);
  const convert = bar.action('studio-convert-keys');
  assert.ok(convert, 'a chosen move offers the conversion');
  convert.onPress!(null as never);
  assert.deepEqual(bar.edits, studioCameraPresetEdit(bar.entry.recipe as never));
  const [rows, motion] = bar.edits as { id: string; value: unknown }[];
  assert.equal((rows!.value as unknown[]).length, 3);
  assert.equal(motion!.value, 'keys');
  assert.equal(bar.status(), 'Converted to 3 keys, which you can edit under Motion.');

  // A dolly the zoom range cannot follow says so, rather than looking like a mistake.
  await bar.sync({ cameraMotion: 'dolly', camera: { zoom: 2 }, target: {} });
  bar.edits.length = 0;
  bar.action('studio-convert-keys')!.onPress!(null as never);
  assert.equal(bar.status(), 'Converted to 3 keys; the zoom range limited the move, so the subject changes size.');

  // Authored keys are already editable, and an orthographic dolly has nothing to give.
  for (const held of [
    { cameraMotion: 'keys', cameraKeys: keys, target: {} },
    { cameraMotion: 'still', target: {} },
    { cameraMotion: 'dolly', projection: 'orthographic', target: {} },
  ]) {
    await bar.sync(held);
    assert.equal(bar.action('studio-convert-keys'), undefined, `${held.cameraMotion} hides Convert to keys`);
  }
});

