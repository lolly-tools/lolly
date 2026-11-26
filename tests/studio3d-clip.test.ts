// SPDX-License-Identifier: MPL-2.0
/**
 * Baked animation clips in 3D Studio.
 *
 * A glTF model may carry a clip: a node that moves, a skeleton that bends, a morph target
 * that swells. These tests hold the rules a clip plays by:
 *
 *   - the clip time is a function of the export clock and the recipe alone, so the same
 *     frame is the same pose on every run and a still at time t is the pose at t;
 *   - the clip runs at its own speed and repeats at its own length inside the loop;
 *   - a model that plays a clip is measured once over the whole clip, and its bounds do
 *     not change from frame to frame;
 *   - a recipe that does not ask for a clip builds and loads exactly as it did before;
 *   - two placed copies of one loaded source each hold a pose of their own.
 *
 * Node has no GPU. Everything here is state and arithmetic: the place of a vertex after
 * the clip is posed, read back on the CPU through three's own skinning and morph code.
 * No frame is drawn by this file.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test tests/studio3d-clip.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as THREE from 'three';
import {
  STUDIO_CLIP_BOUND_STEPS,
  buildStudioScene,
  studioAnimated,
  studioClipSampleTimes,
  studioClipSeconds,
  studioWantsClip,
} from '../engine/src/studio3d.ts';
import { studioBox } from '../shells/web/src/lib/studio3d/clip.ts';
import { placeStudioScene } from '../shells/web/src/lib/studio3d/camera.ts';
import {
  instantiateStudioAsset,
  loadStudioSource,
  type StudioAsset,
} from '../shells/web/src/lib/studio3d/source.ts';
import { studioSceneObjects } from '../engine/src/studio3d-arrangement.ts';
import { morphGlb, movingGlb, skinnedGlb, twoClipGlb } from './helpers/studio3d-clip.ts';
import { installStudioDom } from './helpers/studio3d-dom.ts';

const MODEL = { url: '/model.glb', name: 'model.glb' };
const still = (extra: Record<string, unknown> = {}) =>
  buildStudioScene({ version: 1, values: { source: 'model', modelAsset: MODEL, ...extra } });
const playing = (extra: Record<string, unknown> = {}) => still({ playClip: true, ...extra });

async function load(scene: ReturnType<typeof still>, glb: Uint8Array): Promise<StudioAsset> {
  installStudioDom();
  return loadStudioSource(scene, async () => glb, new AbortController().signal);
}

/** Where the triangle's first corner stands in the world, with the copy's pose as it is now. */
function corner(copy: StudioAsset): number[] {
  copy.object.updateMatrixWorld(true);
  const mesh = [...copy.originals.keys()][0]!;
  const point = new THREE.Vector3();
  mesh.getVertexPosition(0, point).applyMatrix4(mesh.matrixWorld);
  return point.toArray().map((n) => Math.round(n * 1e5) / 1e5);
}
const near = (actual: number[], expected: number[], label: string) =>
  assert.deepEqual(
    actual.map((n) => Math.round(n * 1e4) / 1e4),
    expected.map((n) => Math.round(n * 1e4) / 1e4),
    label
  );

// The sliding triangle is 2 wide and travels 4, so the whole clip is 6 wide and the studio
// draws it 3.25 across: every file unit is 3.25 / 6 studio units.
const UNIT = 3.25 / 6;
/** The slide's keyed x at a clip time: 0 at 0 s, 4 at 1 s, 0 at 2 s, straight lines between. */
const keyedX = (seconds: number) => (seconds <= 1 ? 4 * seconds : 4 * (2 - seconds));

test('the clip time is the export clock times the clip length, wrapped at the clip own length', () => {
  const scene = playing({ duration: 5 });
  assert.equal(studioClipSeconds(scene, 0, undefined, 2), 0, 'the first frame is the start of the clip');
  assert.equal(studioClipSeconds(scene, 0.1, undefined, 2), 0.5);
  assert.equal(studioClipSeconds(scene, 0.4, undefined, 2), 0, 'two seconds in, a two second clip starts again');
  assert.equal(studioClipSeconds(scene, 0.5, undefined, 2), 0.5);
  // The loop rule: at the end of a five second loop a two second clip is one second into its third pass.
  assert.equal(studioClipSeconds(scene, 1, undefined, 2), 1);
  // An export gives its own length, and the clip still runs at its own speed.
  assert.equal(studioClipSeconds(scene, 1, 8, 3), 2);
  assert.equal(studioClipSeconds(scene, 0.5, 8, 3), 1);
  // A clip with one pose, a time before the start and a time that is not a number all hold the start.
  assert.equal(studioClipSeconds(scene, 0.7, undefined, 0), 0);
  assert.equal(studioClipSeconds(scene, -1, undefined, 2), 0);
  assert.equal(studioClipSeconds(scene, Number.NaN, undefined, 2), 0);
  // Never the length itself: the pose at the length is the pose at zero.
  for (let frame = 0; frame <= 600; frame++) {
    const seconds = studioClipSeconds(scene, frame / 120, 7.3, 1.7);
    assert.ok(seconds >= 0 && seconds < 1.7, `frame ${frame} gave ${seconds}`);
  }
});

test('the same clock and recipe give the same clip time on every call', () => {
  const scene = playing({ duration: 6.5 });
  const run = () => Array.from({ length: 240 }, (_, i) => studioClipSeconds(scene, i / 240, 6.5, 1.3));
  assert.deepEqual(run(), run());
});

test('the moments a clip is measured at are fixed by its length alone', () => {
  const times = studioClipSampleTimes(2);
  assert.equal(times.length, STUDIO_CLIP_BOUND_STEPS + 1);
  assert.equal(times[0], 0);
  assert.equal(times[times.length - 1], 2);
  assert.deepEqual(studioClipSampleTimes(2), times);
  assert.deepEqual(studioClipSampleTimes(0), [0]);
  assert.deepEqual(studioClipSampleTimes(2, 4), [0, 0.5, 1, 1.5, 2]);
});

test('a recipe made before clips could play builds exactly as it did', () => {
  const old = still();
  assert.equal('clip' in old.source, false, 'no clip is asked for');
  assert.equal(studioWantsClip(old), false);
  assert.deepEqual(still({ playClip: false, clipIndex: 3 }), old, 'off is the same recipe, whatever the clip number');
  assert.deepEqual(still({ clipIndex: 3 }), old, 'a clip number alone asks for nothing');
  // Only a glTF model takes a clip.
  const stl = buildStudioScene({ version: 1, values: { source: 'model', modelAsset: { url: '/a.stl' }, playClip: true } });
  assert.equal('clip' in stl.source, false);
  const shape = buildStudioScene({ version: 1, values: { source: 'primitive', playClip: true } });
  assert.equal('clip' in shape.source, false);
  // Asking is not animating: whether the file holds a clip is known once it has loaded.
  assert.equal(studioAnimated(playing()), false);
  assert.deepEqual(playing({ clipIndex: 2 }).source.clip, { index: 2 });
  assert.equal(studioWantsClip(playing()), true);
});

test('the manifest keeps the old tool input ids, and off is the default', () => {
  const manifest = JSON.parse(readFileSync(new URL('../community/3d-studio/tool.json', import.meta.url), 'utf8')) as {
    inputs: { id: string; type: string; default?: unknown; showIf?: unknown }[];
  };
  const old = JSON.parse(readFileSync(new URL('../community/3d/tool.json', import.meta.url), 'utf8')) as typeof manifest;
  for (const id of ['playClip', 'clipIndex']) {
    const now = manifest.inputs.find((input) => input.id === id);
    assert.ok(now, `3D Studio has ${id}`);
    assert.equal(now.type, old.inputs.find((input) => input.id === id)!.type);
  }
  // A link or a session made before the input existed carries no value, so the default is
  // what an old document gets: off, the pose the file was imported in.
  assert.equal(manifest.inputs.find((input) => input.id === 'playClip')!.default, false);
  const duration = manifest.inputs.find((input) => input.id === 'duration')!;
  assert.ok(JSON.stringify(duration.showIf).includes('playClip'), 'Loop seconds shows while a clip plays');
});

test('a model whose recipe does not ask for a clip loads at its import pose and says a clip is there', async () => {
  const asset = await load(still(), movingGlb());
  try {
    assert.equal(asset.clip, undefined);
    assert.deepEqual(asset.info.clips, [{ name: 'Slide', seconds: 2 }]);
    assert.equal(asset.info.playing, undefined);
    assert.ok(asset.info.warnings.some((note) => /holds one animation clip/.test(note)));
    const copy = instantiateStudioAsset(asset);
    assert.equal(copy.pose, undefined, 'nothing poses a copy that holds its pose');
    // Sized by the triangle alone, as before clips could play: 2 wide, shown 3.25 across.
    near(corner(copy), [-1.625, -0.8125, 0], 'the import pose');
    assert.equal(copy.object.userData.studioClipBounds, undefined);
    copy.dispose();
  } finally {
    asset.dispose();
  }
});

test('a moving node stands at its keyed place at every clip time', async () => {
  const asset = await load(playing(), movingGlb());
  const copy = instantiateStudioAsset(asset);
  try {
    assert.equal(asset.info.playing, 0);
    assert.ok(asset.info.warnings.some((note) => /playing "Slide"/.test(note)));
    // The whole clip runs from x 0 to x 6 in the file, so its middle, x 3, is the studio's centre.
    for (const seconds of [0, 0.25, 0.5, 1, 1.5, 1.75]) {
      copy.pose!(seconds);
      near(corner(copy), [(keyedX(seconds) - 3) * UNIT, -0.5 * UNIT, 0], `at ${seconds} s`);
    }
  } finally {
    copy.dispose();
    asset.dispose();
  }
});

test('a pose depends on its time alone, not on the pose before', async () => {
  const asset = await load(playing(), movingGlb());
  const copy = instantiateStudioAsset(asset);
  try {
    copy.pose!(0.7);
    const first = corner(copy);
    copy.pose!(1.9);
    copy.pose!(0.1);
    copy.pose!(0.7);
    assert.deepEqual(corner(copy), first, 'out of order');
    copy.pose!(0.7);
    assert.deepEqual(corner(copy), first, 'twice running');
    // A second copy, made later and posed once, agrees with the first to the last digit.
    const other = instantiateStudioAsset(asset);
    other.pose!(0.7);
    assert.deepEqual(corner(other), first);
    other.dispose();
  } finally {
    copy.dispose();
    asset.dispose();
  }
});

test('the frames of a loop obey the loop rule from the first to the last', async () => {
  const scene = playing({ duration: 5 });
  const asset = await load(scene, movingGlb());
  const copy = instantiateStudioAsset(asset);
  const at = (time: number, clipSeconds?: number) => {
    copy.pose!(studioClipSeconds(scene, time, clipSeconds, asset.clip!.seconds));
    return corner(copy);
  };
  try {
    near(at(0), [-3 * UNIT, -0.5 * UNIT, 0], 'time 0 is the start of the clip');
    // Five seconds of a two second clip: two whole passes and one second, which is the far end of the slide.
    near(at(1), [(4 - 3) * UNIT, -0.5 * UNIT, 0], 'time 1 of a five second loop');
    // A loop the clip divides evenly ends where it began.
    near(at(1, 4), at(0), 'a four second export of a two second clip closes');
    // A frame sequence drawn twice is the same sequence.
    const frames = () => Array.from({ length: 30 }, (_, i) => at(i / 30));
    assert.deepEqual(frames(), frames());
  } finally {
    copy.dispose();
    asset.dispose();
  }
});

test('two copies of one loaded source do not share clip time', async () => {
  const asset = await load(playing(), movingGlb());
  const a = instantiateStudioAsset(asset);
  const b = instantiateStudioAsset(asset);
  try {
    a.pose!(0.5);
    const held = corner(a);
    b.pose!(1);
    assert.deepEqual(corner(a), held, 'posing one copy leaves the other where it was');
    assert.notDeepEqual(corner(b), held);
    // The loaded source itself, which a cache keeps and hands to the next box, never moves.
    const source = (): number[] => {
      asset.object.updateMatrixWorld(true);
      const mesh = [...asset.originals.keys()][0]!;
      return mesh.getWorldPosition(new THREE.Vector3()).toArray();
    };
    const before = source();
    a.pose!(1.5);
    b.pose!(0.2);
    assert.deepEqual(source(), before);
    // A copy made after the others were posed starts at the start of the clip.
    const late = instantiateStudioAsset(asset);
    near(corner(late), [-3 * UNIT, -0.5 * UNIT, 0], 'a new copy starts at zero');
    late.dispose();
  } finally {
    a.dispose();
    b.dispose();
    asset.dispose();
  }
});

test('the bounds of a playing model are the whole clip, at every frame', async () => {
  const scene = playing();
  const asset = await load(scene, movingGlb());
  const copy = instantiateStudioAsset(asset);
  try {
    copy.object.updateMatrixWorld(true);
    const whole = studioBox(copy.object);
    near(whole.min.toArray(), [-1.625, -0.5 * UNIT, 0], 'left edge of the slide');
    near(whole.max.toArray(), [1.625, 0.5 * UNIT, 0], 'right edge of the slide');
    for (const seconds of [0, 0.4, 1, 1.6]) {
      copy.pose!(seconds);
      copy.object.updateMatrixWorld(true);
      const now = studioBox(copy.object);
      assert.deepEqual([now.min.toArray(), now.max.toArray()], [whole.min.toArray(), whole.max.toArray()], `at ${seconds} s`);
    }
    // So the floor contact does not move with the clip: the placed height is the same at every frame.
    const root = new THREE.Group();
    root.add(copy.object);
    const placed = [{ object: copy.object, spec: studioSceneObjects(scene)[0]! }];
    const heights = [0, 0.4, 1, 1.6].map((seconds) => {
      copy.pose!(seconds);
      placeStudioScene(root, placed, scene);
      return copy.object.position.y;
    });
    assert.equal(new Set(heights).size, 1, `placed heights ${heights.join(', ')}`);
    // An object that plays no clip is measured the way three measures any object.
    const plain = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 3));
    plain.position.set(4, 0, 0);
    plain.updateMatrixWorld(true);
    assert.deepEqual(studioBox(plain), new THREE.Box3().setFromObject(plain));
  } finally {
    copy.dispose();
    asset.dispose();
  }
});

test('a rise clip chosen by number is the one that plays, and the number wraps', async () => {
  const rise = await load(playing({ clipIndex: 1 }), twoClipGlb());
  const wrapped = await load(playing({ clipIndex: 3 }), twoClipGlb());
  try {
    assert.equal(rise.info.playing, 1);
    assert.equal(rise.clip!.seconds, 1);
    assert.equal(wrapped.info.playing, 1, 'clip 3 of two clips is clip 1, as the older tool counted');
    const copy = instantiateStudioAsset(rise);
    // The rise lifts the node 2 over a second: the whole clip is 2 wide and 3 tall, drawn 3.25 tall.
    const unit = 3.25 / 3;
    copy.pose!(0);
    near(corner(copy), [-1 * unit, -1.5 * unit, 0], 'the start');
    copy.pose!(0.5);
    near(corner(copy), [-1 * unit, -0.5 * unit, 0], 'half way up');
    copy.dispose();
  } finally {
    rise.dispose();
    wrapped.dispose();
  }
});

test('a morph target moves the surface with the clip', async () => {
  const asset = await load(playing(), morphGlb());
  const copy = instantiateStudioAsset(asset);
  try {
    // The target lifts every vertex 3; the whole clip is 2 wide and 4 tall, drawn 3.25 tall.
    const unit = 3.25 / 4;
    for (const [seconds, weight] of [[0, 0], [0.5, 0.5], [1, 1], [1.5, 0.5]] as const) {
      copy.pose!(seconds);
      near(corner(copy), [-1 * unit, (3 * weight - 2) * unit, 0], `weight ${weight} at ${seconds} s`);
    }
    const mesh = [...copy.originals.keys()][0]!;
    assert.equal(mesh.frustumCulled, false, 'a surface that moves is not culled by its first pose');
  } finally {
    copy.dispose();
    asset.dispose();
  }
});

test('a skinned model follows its bone through the clip, and its own placement', async () => {
  const asset = await load(playing(), skinnedGlb());
  const copy = instantiateStudioAsset(asset);
  try {
    for (const seconds of [0, 0.5, 1, 1.5]) {
      copy.pose!(seconds);
      near(corner(copy), [(keyedX(seconds) - 3) * UNIT, -0.5 * UNIT, 0], `at ${seconds} s`);
    }
    // A skinned mesh is drawn where its bones are, so a copy needs bones of its own to
    // go where the copy is put.
    copy.pose!(0);
    copy.object.position.set(10, 0, 0);
    near(corner(copy), [10 - 3 * UNIT, -0.5 * UNIT, 0], 'moved ten to the right');
  } finally {
    copy.dispose();
    asset.dispose();
  }
});

test('a skinned model that holds its pose also follows its own placement', async () => {
  const asset = await load(still(), skinnedGlb());
  const copy = instantiateStudioAsset(asset);
  try {
    near(corner(copy), [-1.625, -0.8125, 0], 'centred as it was imported');
    copy.object.position.set(10, 0, 0);
    near(corner(copy), [8.375, -0.8125, 0], 'moved ten to the right');
  } finally {
    copy.dispose();
    asset.dispose();
  }
});

test('choosing a model turns its animation on, and opening an old document does not', async () => {
  const source = readFileSync(new URL('../community/3d-studio/hooks.js', import.meta.url), 'utf8');
  type Input = { id: string; value: unknown };
  type Patch = Record<string, unknown>;
  const host = { assets: { get: async (id: string) => ({ id, url: `blob:${id}`, name: id, type: 'model' }) } };
  const hooks = new Function('host', `${source}\nreturn { onInit, onInput };`)(host) as {
    onInit(ctx: { model: Input[] }): Promise<Patch>;
    onInput(ctx: { model: Input[]; id: string }): Promise<Patch>;
  };
  const model = (values: Record<string, unknown>): Input[] =>
    Object.entries({ source: 'model', modelAsset: 'lolly/3d/duck', playClip: false, ...values }).map(([id, value]) => ({ id, value }));
  const chosen = await hooks.onInput({ model: model({}), id: 'modelAsset' });
  assert.equal(chosen.playClip, true, 'a model chosen now plays');
  assert.equal(JSON.parse(String(chosen._studioState)).values.playClip, true, 'and the recipe it hands on says so');
  // A link or a session opens through onInit, which leaves the value as it was saved: absent, so off.
  const opened = await hooks.onInit({ model: model({}) });
  assert.equal('playClip' in opened, false);
  assert.equal(JSON.parse(String(opened._studioState)).values.playClip, false);
  // Any other edit leaves the choice alone, so turning the animation off stays off.
  for (const id of ['playClip', 'clipIndex', 'duration', 'camera', 'source']) {
    const edited = await hooks.onInput({ model: model({}), id });
    assert.equal('playClip' in edited, false, id);
  }
  // Clearing the model, or choosing artwork, turns nothing on.
  assert.equal('playClip' in (await hooks.onInput({ model: model({ modelAsset: '' }), id: 'modelAsset' })), false);
  assert.equal('playClip' in (await hooks.onInput({ model: model({ source: 'artwork' }), id: 'modelAsset' })), false);
});
