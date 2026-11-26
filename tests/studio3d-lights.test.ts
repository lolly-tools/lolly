// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import {
  STUDIO_KEY_CARD_OFFSET,
  STUDIO_LIGHT_TARGET,
  STUDIO_PRESET_LIGHT_POSITIONS,
  studioLightEdit,
  studioOrbitLight,
  studioPlaceableLights,
  studioScaleLightDistance,
} from '../engine/src/studio3d-lights.ts';
import { buildStudioScene } from '../engine/src/studio3d.ts';
import { parseUrlState, serializeUrlState } from '../engine/src/url-mode.ts';
import { baseHost } from './helpers/host.ts';
import { studioBarHarness } from './helpers/studio3d-bar.ts';

const radius = (p: number[]) =>
  Math.hypot(
    p[0]! - STUDIO_LIGHT_TARGET[0],
    p[1]! - STUDIO_LIGHT_TARGET[1],
    p[2]! - STUDIO_LIGHT_TARGET[2]
  );

test('orbiting a light keeps its distance, clamps elevation and stays inside the studio range', () => {
  const start = STUDIO_PRESET_LIGHT_POSITIONS.key;
  const turned = studioOrbitLight(start, 90, 0);
  assert.ok(Math.abs(radius(turned) - radius(start)) < 0.01);
  assert.ok(Math.abs(turned[1] - start[1]) < 0.01, 'azimuth alone keeps the height');
  assert.notDeepEqual(turned, start);
  const back = studioOrbitLight(turned, -90, 0);
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(back[i]! - start[i]!) < 0.01);
  const overhead = studioOrbitLight(start, 0, 500);
  assert.ok(Math.abs(radius(overhead) - radius(start)) < 0.01);
  assert.ok(overhead[1] < STUDIO_LIGHT_TARGET[1] + radius(start), 'never exactly at the pole');
  assert.ok(Math.hypot(overhead[0], overhead[2]) > 0.05, 'keeps a heading');
  const far = studioScaleLightDistance(start, 1000);
  assert.ok(radius(far) <= 30.01 && Math.abs(far[0]) <= 30 && Math.abs(far[1]) <= 30);
  const near = studioScaleLightDistance(start, 0);
  assert.ok(Math.abs(radius(near) - 1) < 0.01, 'a light never reaches the target');
  const nearer = studioScaleLightDistance(start, 1 / 1.1);
  assert.ok(Math.abs(radius(nearer) - radius(start) / 1.1) < 0.01);
});

test('a preset rig saves a moved light as its role position and the card follows the key', () => {
  const values = { studio: 'dramatic' };
  const scene = buildStudioScene({ version: 1, values });
  assert.deepEqual(studioPlaceableLights(scene), [0, 1, 2]);
  const edit = studioLightEdit(values, scene, 0, [1.234567, 5, -2]);
  assert.deepEqual(edit, { id: 'keyPosition', value: { x: 1.235, y: 5, z: -2 } });
  assert.equal(studioLightEdit(values, scene, 2, [0, 40, 0]).id, 'rimPosition');
  assert.deepEqual((studioLightEdit(values, scene, 2, [0, 40, 0]).value as { y: number }).y, 30);
  assert.throws(() => studioLightEdit(values, scene, 3, [0, 1, 0]), /cannot be moved/);
  const moved = buildStudioScene({
    version: 1,
    values: { ...values, keyPosition: { x: 1, y: 5, z: -2 }, fillPosition: { x: 0, y: 2, z: 6 } },
  });
  assert.deepEqual(moved.lights[0]!.position, [1, 5, -2]);
  assert.deepEqual(moved.lights[1]!.position, [0, 2, 6]);
  assert.deepEqual(moved.lights[2]!.position, STUDIO_PRESET_LIGHT_POSITIONS.rim);
  assert.deepEqual(
    moved.lights[3]!.position,
    [1, 5, -2].map((n, i) => n + STUDIO_KEY_CARD_OFFSET[i]!)
  );
  assert.deepEqual(scene.lights[3]!.position, [-4, 4, 3], 'the default card position is unchanged');
  assert.deepEqual(moved.lights.map((l) => l.intensity), scene.lights.map((l) => l.intensity));
});

test('a custom rig edits the row of the moved light and leaves the others intact', () => {
  const values = {
    studio: 'custom',
    lights: [
      { kind: 'directional', x: -3, y: 6, z: 4, intensity: 2 },
      { kind: 'area', x: 4, y: 4, z: 3, intensity: 3 },
      { kind: 'spot', x: 3, y: 5, z: -3, intensity: 4 },
    ],
  };
  const scene = buildStudioScene({ version: 1, values });
  assert.deepEqual(studioPlaceableLights(scene), [0, 1, 2], 'custom area lights are placeable');
  const edit = studioLightEdit(values, scene, 2, [0, 7, 0]);
  assert.equal(edit.id, 'lights');
  const rows = edit.value as Record<string, unknown>[];
  assert.equal(rows[0], values.lights[0]);
  assert.deepEqual({ x: rows[2]!.x, y: rows[2]!.y, z: rows[2]!.z, kind: rows[2]!.kind }, {
    x: 0,
    y: 7,
    z: 0,
    kind: 'spot',
  });
  assert.throws(() => studioLightEdit(values, scene, 5, [0, 1, 0]), /cannot be moved/);
});

test('the real tool carries moved light positions through URL mode', async () => {
  const tool = await loadTool('3d-studio', (p) => readFile(join('community', p), 'utf8'));
  const host = baseHost();
  const runtime = await createRuntime(tool, host, {
    controls: 'expert',
    studio: 'electric',
    keyPosition: { x: 2.5, y: 7, z: 1 },
    rimPosition: { x: -3, y: 2, z: -4 },
  });
  const live = Object.fromEntries(runtime.getModel().map((i) => [i.id, i.value]));
  assert.ok((await studioBarHarness(live)).action('studio-lights'), 'a preset rig offers Move lights');
  const parsed = parseUrlState(serializeUrlState(runtime.getModel()), tool.manifest);
  const reopened = await createRuntime(tool, host, parsed.values);
  const values = Object.fromEntries(reopened.getModel().map((i) => [i.id, i.value]));
  const scene = buildStudioScene({ version: 1, values });
  assert.deepEqual(scene.lights[0]!.position, [2.5, 7, 1]);
  assert.deepEqual(scene.lights[2]!.position, [-3, 2, -4]);
  assert.deepEqual(scene.lights[1]!.position, STUDIO_PRESET_LIGHT_POSITIONS.fill);
  runtime.destroy();
  reopened.destroy();
});
