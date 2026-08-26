// SPDX-License-Identifier: MPL-2.0
/**
 * Mesh Gradient - the five-mode split (blend / subdivide / mesh / warp / flow).
 *
 * Run with: node --test tests/mesh-gradient-modes.test.ts
 *
 * Drives the SHIPPED community/mesh-gradient/hooks.js exactly the way the
 * engine's in-realm executor does (`new Function('host', source)`), plus the
 * shared mesh-core region (canonical: community/_shared/mesh.js) directly.
 * Covers:
 *
 *   - determinism: the SAME model rendered through two independent hooks
 *     loads produces BYTE-IDENTICAL svgContent (subdivide builds real
 *     geometry, so this is the honest memo/no-randomness gate), and hooks.js
 *     itself never calls Math.random (shuffling lives in the template and
 *     writes concrete values back through inputs).
 *   - the subdivide path cap: worst-case grid x detail stays at or under
 *     MAX_QUADS paths (the dom-to-image node-count cliff guard).
 *   - mesh-core round-trips: serialize(parse(x)) is x, handle overrides
 *     survive, corner evaluation of a Coons patch falls on the corners.
 *   - meshData lifecycle: a stale string (old rows/cols) is ignored AND
 *     cleared via the returned patch; a valid string wins over defaults.
 *   - per-mode markup: each raster mode emits its canvas root; blend keeps
 *     its dots; flow's config attribute carries the seed.
 *   - beforeExport: flow/warp video exports get the one-loop duration,
 *     bounded by the fps frame budget and the GIF cap.
 *   - manifest contracts: the mode select carries per-option formats that are
 *     subsets of render.formats, and the mode-gated showIf wiring holds.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOOKS_PATH = join(ROOT, 'community', 'mesh-gradient', 'hooks.js');
const TOOL_JSON_PATH = join(ROOT, 'community', 'mesh-gradient', 'tool.json');
const SHARED_MESH_PATH = join(ROOT, 'community', '_shared', 'mesh.js');

const hooksSource = await readFile(HOOKS_PATH, 'utf8');
const manifest = JSON.parse(await readFile(TOOL_JSON_PATH, 'utf8'));

interface MeshPatch {
  svgContent: string;
  meshJson: string;
  dotsJson: string;
  meshData?: string;
}

/** An export job as the engine hands it to beforeExport; opts is mutated in place. */
interface ExportJob {
  format: string;
  opts: { fps?: number; duration?: number; wait?: number };
  node: null;
}

interface Hooks {
  onInit: ((ctx: unknown) => Promise<MeshPatch>) | null;
  onInput: ((ctx: unknown) => MeshPatch) | null;
  beforeExport: ((ctx: unknown) => void) | null;
  afterExport: ((ctx: unknown) => void) | null;
}

/** Mirror of the engine's getHookFactory wrapper (engine/src/runtime.ts). */
function loadHooks(): Hooks {
  const factory = new Function(
    'host',
    `${hooksSource}; return {` +
    `onInit: typeof onInit !== 'undefined' ? onInit : null,` +
    `onInput: typeof onInput !== 'undefined' ? onInput : null,` +
    `beforeExport: typeof beforeExport !== 'undefined' ? beforeExport : null,` +
    `afterExport: typeof afterExport !== 'undefined' ? afterExport : null};`,
  );
  return factory({ log: () => {} }) as Hooks;
}

/** The shared mesh-core region, evaluated standalone. */
interface MeshCore {
  mgmDefaultMesh: (rows: number, cols: number, colors: string[]) => { rows: number; cols: number; nodes: Array<{ x: number; y: number; color: string; h?: Record<string, [number, number]> }> };
  mgmSerializeMesh: (mesh: unknown) => string;
  mgmParseMesh: (str: string) => ReturnType<MeshCore['mgmDefaultMesh']> | null;
  mgmMeshPatches: (mesh: unknown, curvature: number) => Array<{ top: number[][]; bottom: number[][]; left: number[][]; right: number[][]; colors: number[][] }>;
  mgmCoonsPoint: (patch: unknown, u: number, v: number) => [number, number];
}

async function loadMeshCore(): Promise<MeshCore> {
  const src = await readFile(SHARED_MESH_PATH, 'utf8');
  const begin = src.indexOf('=== lolly:shared mesh-core');
  const end = src.indexOf('=== /lolly:shared mesh-core');
  assert.ok(begin >= 0 && end > begin, 'mesh-core region present in community/_shared/mesh.js');
  const body = src.slice(src.indexOf('\n', begin) + 1, src.lastIndexOf('\n', end));
  return new Function(
    `${body}; return { mgmDefaultMesh, mgmSerializeMesh, mgmParseMesh, mgmMeshPatches, mgmCoonsPoint };`,
  )() as MeshCore;
}

function model(values: Record<string, unknown>): Array<{ id: string; value: unknown }> {
  const base: Record<string, unknown> = {
    mode: 'blend', count: 4,
    color1: '#ff9a8b', color2: '#f2a65a', color3: '#22d3ee', color4: '#0b1021',
    pos1: { x: 14, y: 20 }, pos2: { x: 85, y: 18 }, pos3: { x: 80, y: 82 }, pos4: { x: 18, y: 78 },
    spread: 75, blur: 0, grain: 0, grainBlend: 'soft-light', blend: 'normal',
    animate: false, speed: 12, distance: 100,
    rows: 3, cols: 3, curvature: 55, detail: 3, meshData: '',
    flowSpeed: 20, waveScale: 120, waveAmp: 60, angle: 25, seed: 7,
    ...values,
  };
  return Object.entries(base).map(([id, value]) => ({ id, value }));
}

function countPaths(svg: string): number {
  return (svg.match(/<path /g) ?? []).length;
}

test('hooks.js never calls Math.random - shuffles are template-side, writing concrete values', () => {
  assert.ok(!/Math\.random\s*\(/.test(hooksSource), 'no Math.random() call in hooks.js');
});

test('subdivide renders byte-identical across independent hook loads', () => {
  const m = model({ mode: 'subdivide', curvature: 70, detail: 2 });
  const a = loadHooks().onInput!({ model: m });
  const b = loadHooks().onInput!({ model: m });
  assert.ok(a.svgContent.includes('mg-sub'), 'subdivide svg root present');
  assert.ok(countPaths(a.svgContent) > 0, 'subdivide emits quads');
  assert.equal(a.svgContent, b.svgContent);
  assert.equal(a.meshJson, b.meshJson);
});

test('subdivide path count stays at or under the 4096-quad cap at worst-case settings', () => {
  const out = loadHooks().onInput!({ model: model({ mode: 'subdivide', rows: 5, cols: 5, detail: 4, count: 6 }) });
  const paths = countPaths(out.svgContent);
  assert.ok(paths > 0 && paths <= 4096, `quad count ${paths} within cap`);
});

test('subdivide detail scales quad count by 4x per step', () => {
  const hooks = loadHooks();
  const d1 = countPaths(hooks.onInput!({ model: model({ mode: 'subdivide', detail: 1 }) }).svgContent);
  const d2 = countPaths(hooks.onInput!({ model: model({ mode: 'subdivide', detail: 2 }) }).svgContent);
  assert.equal(d1, 2 * 2 * 4, 'detail 1 = 4 quads per patch across a 3x3 grid');
  assert.equal(d2, d1 * 4);
});

test('mesh-core: serialize/parse round-trip preserves nodes and handle overrides', async () => {
  const core = await loadMeshCore();
  const mesh = core.mgmDefaultMesh(3, 4, ['#ff0000', '#00ff00', '#0000ff']);
  mesh.nodes[5]!.x = 43.2;
  mesh.nodes[5]!.y = 61.7;
  mesh.nodes[5]!.h = { E: [12.5, -8], N: [-3, 4.5] };
  const str = core.mgmSerializeMesh(mesh);
  const back = core.mgmParseMesh(str);
  assert.ok(back, 'parse succeeds');
  assert.equal(back.rows, 3);
  assert.equal(back.cols, 4);
  assert.equal(back.nodes.length, 12);
  assert.equal(back.nodes[5]!.x, 43.2);
  assert.equal(back.nodes[5]!.y, 61.7);
  assert.deepEqual(back.nodes[5]!.h, { E: [12.5, -8], N: [-3, 4.5] });
  assert.equal(back.nodes[0]!.color, '#ff0000');
  // Round-trip is a fixed point: serialising the parse gives the same string.
  assert.equal(core.mgmSerializeMesh(back), str);
});

test('mesh-core: malformed and mismatched strings parse to null', async () => {
  const core = await loadMeshCore();
  assert.equal(core.mgmParseMesh(''), null);
  assert.equal(core.mgmParseMesh('not a mesh'), null);
  assert.equal(core.mgmParseMesh('3.3:0,0,zzzzzz'), null, 'bad hex rejected');
  const mesh = core.mgmDefaultMesh(2, 2, ['#111111']);
  const two = core.mgmSerializeMesh(mesh).replace(/^2\.2:/, '3.3:');
  assert.equal(core.mgmParseMesh(two), null, 'node-count mismatch rejected');
});

test('mesh-core: Coons patch evaluation hits the corners exactly', async () => {
  const core = await loadMeshCore();
  const mesh = core.mgmDefaultMesh(2, 2, ['#ff0000', '#00ff00']);
  const patch = core.mgmMeshPatches(mesh, 55)[0]!;
  const near = (a: [number, number], b: number[]) => {
    assert.ok(Math.abs(a[0] - b[0]!) < 1e-9 && Math.abs(a[1] - b[1]!) < 1e-9, `${a} ~ ${b}`);
  };
  near(core.mgmCoonsPoint(patch, 0, 0), patch.top[0]!);
  near(core.mgmCoonsPoint(patch, 1, 0), patch.top[3]!);
  near(core.mgmCoonsPoint(patch, 0, 1), patch.bottom[0]!);
  near(core.mgmCoonsPoint(patch, 1, 1), patch.bottom[3]!);
});

test('a stale meshData (older rows/cols) is ignored and cleared via the patch', async () => {
  const core = await loadMeshCore();
  const stale = core.mgmSerializeMesh(core.mgmDefaultMesh(2, 2, ['#123456']));
  const out = loadHooks().onInput!({ model: model({ mode: 'mesh', rows: 3, cols: 3, meshData: stale }) });
  assert.equal(out.meshData, '', 'self-heal patch clears the stale input');
  const meshJson = JSON.parse(out.meshJson) as { nodes: Array<{ color: string }> };
  assert.equal(meshJson.nodes.length, 9, 'defaults for the CURRENT grid');
  assert.ok(!meshJson.nodes.some(n => n.color === '#123456'), 'stale colours gone');
});

test('a valid meshData wins over the swatch defaults', async () => {
  const core = await loadMeshCore();
  const mesh = core.mgmDefaultMesh(3, 3, ['#0000ff']);
  mesh.nodes[4]!.color = '#abc123';
  mesh.nodes[4]!.x = 47;
  const out = loadHooks().onInput!({ model: model({ mode: 'mesh', rows: 3, cols: 3, meshData: core.mgmSerializeMesh(mesh) }) });
  assert.equal(out.meshData, undefined, 'no self-heal patch for a valid string');
  const meshJson = JSON.parse(out.meshJson) as { nodes: Array<{ x: number; color: string }> };
  assert.equal(meshJson.nodes[4]!.color, '#abc123');
  assert.equal(meshJson.nodes[4]!.x, 47);
});

test('each mode emits its own root markup', () => {
  const hooks = loadHooks();
  const blend = hooks.onInput!({ model: model({}) });
  assert.ok(blend.svgContent.includes('radialGradient'), 'blend keeps radial gradients');
  assert.equal(JSON.parse(blend.dotsJson).length, 4, 'blend dots follow count');

  const mesh = hooks.onInput!({ model: model({ mode: 'mesh' }) });
  assert.ok(mesh.svgContent.includes('mg-mesh-canvas'));
  assert.equal(mesh.dotsJson, '[]');

  const warp = hooks.onInput!({ model: model({ mode: 'warp' }) });
  assert.ok(warp.svgContent.includes('mg-warp-canvas'));
  assert.ok(warp.svgContent.includes('data-warp'));
  assert.equal(JSON.parse(warp.dotsJson).length, 4, 'warp reuses the dots overlay');

  const flow = hooks.onInput!({ model: model({ mode: 'flow', seed: 42 }) });
  assert.ok(flow.svgContent.includes('mg-flow-canvas'));
  assert.ok(flow.svgContent.includes('"seed":42'), 'flow config carries the seed');
  assert.ok(flow.svgContent.includes('linear-gradient('), 'CSS fallback backdrop present');
});

test('an unknown mode value falls back to blend', () => {
  const out = loadHooks().onInput!({ model: model({ mode: '<script>' }) });
  assert.ok(out.svgContent.includes('radialGradient'));
});

test('beforeExport sets one-loop durations for flow and animated warp, with caps', () => {
  const hooks = loadHooks();
  hooks.onInput!({ model: model({ mode: 'flow', flowSpeed: 20 }) });
  const webm: ExportJob = { format: 'webm', opts: { fps: 24 }, node: null };
  hooks.beforeExport!(webm);
  assert.equal(webm.opts.duration, 20);
  assert.equal(webm.opts.wait, 0);

  const gif: ExportJob = { format: 'gif', opts: { fps: 24 }, node: null };
  hooks.beforeExport!(gif);
  assert.equal(gif.opts.duration, 16, 'GIF capped at 16s');

  const png: ExportJob = { format: 'png', opts: {}, node: null };
  hooks.beforeExport!(png);
  assert.equal(png.opts.duration, undefined, 'still formats untouched');

  hooks.onInput!({ model: model({ mode: 'warp', animate: true, speed: 14 }) });
  const warpWebm: ExportJob = { format: 'webm', opts: { fps: 24 }, node: null };
  hooks.beforeExport!(warpWebm);
  assert.equal(warpWebm.opts.duration, 14, 'warp uses the drift speed');

  hooks.onInput!({ model: model({ mode: 'warp', animate: false }) });
  const still: ExportJob = { format: 'webm', opts: { fps: 24 }, node: null };
  hooks.beforeExport!(still);
  assert.equal(still.opts.duration, undefined, 'static warp leaves the clip length alone');
});

test('manifest: mode select carries per-option formats, all subsets of render.formats', () => {
  const modeInput = manifest.inputs.find((i: { id: string }) => i.id === 'mode');
  assert.ok(modeInput, 'mode select present');
  assert.equal(modeInput.options.length, 5);
  const union = new Set<string>(manifest.render.formats);
  for (const opt of modeInput.options) {
    assert.ok(Array.isArray(opt.formats) && opt.formats.length, `${opt.value} declares formats`);
    assert.ok(typeof opt.badge === 'string' && opt.badge, `${opt.value} carries a badge`);
    for (const f of opt.formats) assert.ok(union.has(f), `${opt.value} format ${f} ⊆ render.formats`);
  }
  const by = Object.fromEntries(modeInput.options.map((o: { value: string; formats: string[] }) => [o.value, o.formats]));
  assert.ok(by.blend.includes('svg') && by.subdivide.includes('svg'), 'vector modes export svg');
  assert.ok(!by.mesh.includes('svg') && !by.warp.includes('svg') && !by.flow.includes('svg'), 'raster modes do not offer svg');
  assert.ok(by.flow.includes('webm') && by.warp.includes('webm'), 'animatable modes offer video');
  assert.ok(!by.mesh.includes('webm') && !by.subdivide.includes('webm'), 'static modes do not offer video');
});

test('manifest: mode-gated showIf wiring holds', () => {
  const byId = new Map(manifest.inputs.map((i: { id: string }) => [i.id, i]));
  const gate = (id: string) => (byId.get(id) as { showIf?: Record<string, unknown> }).showIf ?? {};
  for (let n = 1; n <= 6; n++) {
    assert.deepEqual((gate(`pos${n}`) as { mode: string[] }).mode, ['blend', 'warp'], `pos${n} gated to blend+warp`);
  }
  for (const id of ['rows', 'cols', 'curvature', 'meshData']) {
    assert.deepEqual((gate(id) as { mode: string[] }).mode, ['subdivide', 'mesh'], `${id} gated to the mesh modes`);
  }
  assert.equal((gate('detail') as { mode: string }).mode, 'subdivide');
  for (const id of ['flowSpeed', 'waveScale', 'waveAmp', 'angle', 'seed']) {
    assert.equal((gate(id) as { mode: string }).mode, 'flow', `${id} gated to flow`);
  }
  for (const id of ['blur', 'grain', 'grainBlend']) {
    assert.deepEqual((gate(id) as { mode: string[] }).mode, ['blend', 'subdivide'], `${id} gated to the filterable modes`);
  }
  assert.ok(!(byId.get('count') as { showIf?: unknown }).showIf, 'count (the colour swatches) stays global');
});
