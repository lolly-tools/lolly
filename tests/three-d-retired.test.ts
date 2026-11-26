// SPDX-License-Identifier: MPL-2.0
//
// 3D is retired into 3D Studio. Its id is a permanent contract, so the tool still loads
// and draws for an old link or a saved session, with its own template, until the person
// presses "Open in 3D Studio". Its manifest points at 3D Studio, which holds what 3D was
// for: a model in a lit scene, a camera that moves, and the model's own baked animation.
//
// Run with:
//   node --import ./tests/css-stub.mjs --test tests/three-d-retired.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { buildStudioScene } from '../engine/src/studio3d.ts';
import { parseUrlState } from '../engine/src/url-mode.ts';
import { successorHref, THREE_D_SAMPLE_HEIGHT } from '../shells/web/src/lib/tool-successors.ts';
import { baseHost } from './helpers/host.ts';

const COMMUNITY = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const SKIP = !existsSync(join(COMMUNITY, '3d', 'tool.json')) && 'community pack not mounted';
const load = (id: string) => loadTool(id, (p) => readFile(join(COMMUNITY, p), 'utf8'));

interface Manifest {
  deprecated?: boolean; replacedBy?: string; listed?: boolean; featured?: unknown;
  render: { formats: string[] };
  inputs: Array<{ id: string; type: string; default?: unknown; fields?: Array<{ id: string; default?: unknown }> }>;
}

/** The values a 3D document holds when nothing was changed: every input at its default. */
function defaults(manifest: Manifest): Record<string, unknown> {
  return Object.fromEntries(
    manifest.inputs.map((input) => [
      input.id,
      input.type === 'vector' ? Object.fromEntries(input.fields!.map((field) => [field.id, field.default])) : input.default,
    ])
  );
}

test('3D is retired into 3D Studio and no longer offered', { skip: SKIP }, async () => {
  const manifest = (await load('3d')).manifest as unknown as Manifest;
  assert.equal(manifest.deprecated, true);
  assert.equal(manifest.replacedBy, '3d-studio');
  assert.equal(manifest.listed, false);
  assert.equal(manifest.featured, undefined, 'an unlisted tool holds no featured tile');
});

test('an old 3D link still opens and draws with the 3D tool own template', { skip: SKIP }, async () => {
  const tool = await load('3d');
  const { values } = parseUrlState('model=cat&scene=plain&cameraMove=arc&playClip=false&clipIndex=2', tool.manifest as never);
  const runtime = await createRuntime(tool as never, baseHost(), values as never);
  const html = runtime.getHydrated();
  assert.match(html, /id="lolly3d-canvas"/, 'the older tool draws on its own canvas');
  assert.doesNotMatch(html, /data-lolly-studio/, 'and not through 3D Studio');
  const state = JSON.parse(/id="lolly3d-state">([\s\S]*?)<\/script>/.exec(html)![1]!) as Record<string, unknown>;
  assert.equal(state.modelUrl, '/tools/3d/assets/cat.glb');
  assert.deepEqual([state.scene, state.cameraMove, state.playClip, state.clipIndex], ['plain', 'arc', false, 2]);
});

test('3D Studio covers what 3D exported and every input 3D had a place to go', { skip: SKIP }, async () => {
  const old = (await load('3d')).manifest as unknown as Manifest;
  const studio = (await load('3d-studio')).manifest as unknown as Manifest;
  for (const format of old.render.formats) assert.ok(studio.render.formats.includes(format), `3D Studio exports ${format}`);
  for (const id of ['playClip', 'clipIndex', 'duration', 'exposure', 'camera', 'background'])
    assert.ok(studio.inputs.some((input) => input.id === id), `3D Studio has ${id}`);
});

test('the address a default 3D document opens at is one 3D Studio reads back whole', { skip: SKIP }, async () => {
  const old = (await load('3d')).manifest as unknown as Manifest;
  const studio = await load('3d-studio');
  const href = successorHref('3d', '3d-studio', { ...defaults(old), background: '#eef1f4', bgColor2: '#30ba78', tint: '#30ba78' });
  assert.ok(href.startsWith('#/tool/3d-studio?'));
  const { values } = parseUrlState(href.split('?')[1]!, studio.manifest as never);
  const read = values as Record<string, unknown>;
  // No carried value was dropped or left as text the studio cannot read.
  assert.equal(typeof read.camera, 'object');
  assert.equal(typeof read.target, 'object');
  assert.equal(read.playClip, true, 'a 3D document played its clip unless told otherwise');
  const scene = buildStudioScene({ version: 1, values: { ...read, modelAsset: { id: 'lolly/3d/duck', url: '/duck.glb' } } });
  assert.equal(scene.source.kind, 'glb');
  assert.deepEqual(scene.source.clip, { index: 0 });
  assert.equal(scene.stage.output, 'object-shadow', '3D drew on transparency with a contact shadow by default');
  assert.equal(scene.cameraMotion?.kind, 'orbit');
  assert.equal(scene.cameraMotion?.ease, 'linear');
  assert.equal(scene.cameraMotion?.loop, true);
  assert.deepEqual(scene.transform, { rotation: [0, 0, 0], position: [0, 0, 0], scale: 1 });
  // 3D stood 0.8 * size / tan(fov / 2) / zoom from the model: 1.486 model widths at its
  // defaults, which is 4.83 studio units for a model 3.25 across.
  assert.ok(Math.abs(11.3 / scene.camera.zoom - (0.8 * 3.25) / Math.tan((45 * Math.PI) / 360) / 1.3) < 0.01);
  assert.deepEqual([scene.camera.azimuth, scene.camera.elevation, scene.camera.fov], [35, 12, 45]);
});

test('the sample models stand as tall as the mapping says, so the camera aims at their middle', { skip: SKIP }, () => {
  for (const [name, ratio] of Object.entries(THREE_D_SAMPLE_HEIGHT)) {
    const bytes = new Uint8Array(readFileSync(join(COMMUNITY, '3d', 'assets', `${name}.glb`)));
    // The texture needs an image decoder Node does not have; the size is in the manifest.
    const length = new DataView(bytes.buffer).getUint32(12, true);
    const manifest = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + length))) as {
      nodes: { rotation?: number[] }[];
      accessors: { type: string; min?: number[]; max?: number[] }[];
    };
    const box = manifest.accessors.find((accessor) => accessor.type === 'VEC3' && accessor.min && accessor.max)!;
    // Both samples carry one node turned a quarter turn about x, so the file's z is the world's up.
    const [qx, qy, qz, qw] = manifest.nodes[0]!.rotation!;
    assert.ok(Math.abs(qx! - Math.SQRT1_2) < 1e-6 && Math.abs(qw! - Math.SQRT1_2) < 1e-6 && qy === 0 && qz === 0);
    const size = [0, 1, 2].map((axis) => box.max![axis]! - box.min![axis]!);
    const tall = size[2]! / Math.max(...size);
    assert.ok(Math.abs(tall - ratio) < 0.0005, `${name}: ${tall.toFixed(4)} measured, ${ratio} in the mapping`);
  }
});
