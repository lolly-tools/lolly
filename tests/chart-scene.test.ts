// SPDX-License-Identifier: MPL-2.0
/**
 * Chart's 3-D scene plan: framing, poses, stages, colourway colours, highlight,
 * the saved-session migration, and the vector projection that SVG, PDF and the
 * CLI draw. The plan is pure, so every check runs straight through the hooks.
 *
 * Run with: node --test tests/chart-scene.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import Ajv from 'ajv/dist/2020.js';
import { validateChartSpec } from '../engine/src/index.ts';

const CHART = new URL('../community/chart/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('tool.json', CHART), 'utf8'));
const hooksSource = readFileSync(new URL('hooks.js', CHART), 'utf8');
const adapter = readFileSync(new URL('lib/chart-three.js', CHART), 'utf8');
const chartSchema = JSON.parse(readFileSync(new URL('../schemas/chart-v1.schema.json', import.meta.url), 'utf8'));
const validateShape = new (Ajv as any)({ allErrors: true, strict: false }).compile(chartSchema);

const hooks = new Function('host', `${hooksSource}\nreturn { onInit, onInput, makeProjector };`)(undefined);

function model(values: Record<string, unknown> = {}) {
  return manifest.inputs.map((input: { id: string; default?: unknown }) => ({
    id: input.id,
    value: Object.hasOwn(values, input.id) ? values[input.id] : input.default,
    isDirty: Object.hasOwn(values, input.id),
  }));
}
async function render(values: Record<string, unknown>) {
  const patch = await hooks.onInit({ model: model(values) });
  return { patch, state: JSON.parse(patch._state) };
}

const BARS = 'Team,First wave,Second wave,Final wave\nDesign,42,51,63\nEngineering,58,66,74\nSales,33,47,59\nSupport,27,39,52';
const ONE = 'Region,Revenue\nNorth,42\nSouth,58\nEast,33\nWest,71\nCentral,49';
const SHARE = 'Channel,Share\nSearch,42\nSocial,28\nEmail,18\nDirect,12';
const GRID = 'Hour,Mon,Tue,Wed,Thu\n06:00,4,5,6,5\n09:00,22,28,31,27\n12:00,46,55,61,52\n15:00,38,41,44,47';
const POINTS = 'Reach,Engagement,Retention,Audience\n18,42,31,14\n27,55,46,22\n34,38,62,18\n45,71,58,31\n52,64,79,38';

// Every corner of every mark, through the plan's own camera.
function markExtents(scene: any) {
  const { project } = hooks.makeProjector(scene.camera, scene.W, scene.H);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const take = (p: number[]) => { const q = project(p); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); };
  for (const m of scene.marks) {
    if (m.t === 'box') {
      const c = Math.cos(m.r || 0), s = Math.sin(m.r || 0);
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
        const lx = sx * m.s[0] / 2, lz = sz * m.s[2] / 2;
        take([m.p[0] + lx * c + lz * s, m.p[1] + sy * m.s[1] / 2, m.p[2] - lx * s + lz * c]);
      }
    } else if (m.t === 'sector') {
      for (let i = 0; i <= 8; i++) { const a = m.a0 + (m.a1 - m.a0) * i / 8; for (const y of [m.y0, m.y1]) take([m.off[0] + Math.cos(a) * m.r1, y, m.off[1] + Math.sin(a) * m.r1]); }
    } else if (m.t === 'sphere') take(m.p);
    else if (m.t === 'surface') for (let i = 0; i < m.pts.length; i += 3) take([m.pts[i], m.pts[i + 1], m.pts[i + 2]]);
  }
  return { x0, x1, y0, y1 };
}

test('every 3-D chart type frames its marks inside the artboard and fills it', async () => {
  const cases: [string, Record<string, unknown>][] = [
    ['bars rows', { sceneType: 'bar3d', data: BARS }],
    ['bars single', { sceneType: 'bar3d', data: ONE }],
    ['bars stacked', { sceneType: 'bar3d', sceneLayout: 'stacked', data: BARS }],
    ['bars ring', { sceneType: 'bar3d', sceneLayout: 'ring', data: ONE }],
    ['donut', { sceneType: 'donut3d', data: SHARE }],
    ['donut towers', { sceneType: 'donut3d', sceneLayout: 'towers', data: SHARE }],
    ['scatter', { sceneType: 'scatter3d', data: POINTS }],
    ['surface', { sceneType: 'surface3d', data: GRID }],
  ];
  const sizes: [number, number][] = [[1280, 800], [1080, 1350], [1080, 1080], [1920, 1080]];
  for (const [name, values] of cases) for (const [width, height] of sizes) {
    const { state } = await render({ renderMode: 'scene', heading: 'A title', width, height, ...values });
    const scene = state.scene, e = markExtents(scene);
    const where = `${name} at ${width}×${height}`;
    assert.ok(e.x0 >= -1 && e.x1 <= width + 1 && e.y0 >= -1 && e.y1 <= height + 1, `${where}: marks stay on the artboard`);
    assert.ok(e.y0 >= scene.overlay.top - 2, `${where}: marks stay clear of the title`);
    const fill = Math.max((e.x1 - e.x0) / width, (e.y1 - e.y0) / (scene.overlay.bottom - scene.overlay.top));
    // Scatter points cover only part of their cube, as data does; the cube is framed.
    const floor = name === 'scatter' ? 0.35 : 0.55;
    assert.ok(fill > floor, `${where}: the chart fills the frame (${fill.toFixed(2)})`);
    assert.ok(!/NaN|Infinity/.test(state.scene && JSON.stringify(scene.camera)), `${where}: the camera is finite`);
  }
});

test('the hero pose suits the artboard: a tall frame turns the row into depth', async () => {
  const wide = (await render({ renderMode: 'scene', data: ONE, width: 1920, height: 1080 })).state.scene.camera;
  const tall = (await render({ renderMode: 'scene', data: ONE, width: 1080, height: 1920 })).state.scene.camera;
  assert.equal(wide.pose, 'hero');
  assert.ok(tall.az > wide.az, `a portrait artboard turns further round (${tall.az} > ${wide.az})`);
});

test('poses and lenses set the camera; isometric and top down drop perspective', async () => {
  const low = (await render({ renderMode: 'scene', data: ONE, scenePose: 'low', cameraProjection: 'wide' })).state.scene.camera;
  assert.equal(low.el, 8);
  assert.equal(low.fov, 64);
  const iso = (await render({ renderMode: 'scene', data: ONE, scenePose: 'iso' })).state;
  assert.equal(iso.scene.camera.ortho, true);
  assert.equal(iso.spec.presentation.camera.projection, 'orthographic');
  assert.equal((await render({ renderMode: 'scene', data: ONE, scenePose: 'top' })).state.scene.camera.ortho, true);
  const custom = (await render({ renderMode: 'scene', data: ONE, scenePose: 'custom', cameraAzimuth: -50, cameraElevation: 33 })).state.scene.camera;
  assert.equal(custom.az, -50);
  assert.equal(custom.el, 33);
});

test('a saved chart from before the poses and finishes keeps its angle and roughness', async () => {
  const { patch, state } = await render({ renderMode: 'scene', data: ONE, cameraAzimuth: 70, cameraElevation: 40, sceneRoughness: 0.2 });
  assert.equal(patch.scenePose, 'custom', 'a hand-set angle becomes the Custom pose');
  assert.equal(patch.sceneMaterial, 'custom', 'a hand-set roughness becomes the Custom finish');
  assert.equal(state.scene.camera.az, 70);
  assert.equal(state.scene.finish, 'custom');
  assert.equal(state.scene.roughness, 0.2);
  const chosen = await render({ renderMode: 'scene', data: ONE, cameraAzimuth: 70, scenePose: 'high' });
  assert.equal(chosen.patch.scenePose, undefined, 'a pose chosen since then wins');
  assert.equal(chosen.state.scene.camera.pose, 'high');
});

test('a 3-D chart paints its stage until someone asks for transparency', async () => {
  const scene = await render({ renderMode: 'scene', data: ONE });
  assert.equal(scene.patch.transparentBg, false);
  assert.equal(scene.state.scene.transparent, false);
  assert.notEqual(scene.patch._bgFill, 'none');
  const asked = await render({ renderMode: 'scene', data: ONE, transparentBg: true });
  assert.equal(asked.patch.transparentBg, undefined);
  assert.equal(asked.state.scene.transparent, true);
  assert.equal(asked.patch._bgFill, 'none');
  const back = await hooks.onInput({ id: 'renderMode', model: model({ renderMode: 'vector', transparentBg: false }).map((i: any) => i.id === 'transparentBg' ? { ...i, isDirty: false } : i) });
  assert.equal(back.transparentBg, true, 'leaving 3-D gives the transparency back');
});

test('stage colours come from the colourway, and every mark reads on its stage', async () => {
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a: string, b: string) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const studio = (await render({ renderMode: 'scene', data: BARS, background: '#fffaf2' })).state.scene;
  assert.equal(studio.stage.colours.backdrop, '#fffaf2', 'the studio is the chosen background');
  const night = (await render({ renderMode: 'scene', data: BARS, sceneStage: 'night' })).state.scene;
  assert.equal(night.stage.colours.dark, true);
  assert.ok(lum(night.stage.colours.backdrop) < 0.05, 'night is deep');
  for (const scene of [studio, night]) for (const m of scene.marks) {
    if (m.q) continue;
    assert.ok(contrast(m.c, scene.stage.colours.backdrop) >= 1.5, `${m.c} reads on ${scene.stage.colours.backdrop}`);
  }
  const surface = (await render({ renderMode: 'scene', sceneType: 'surface3d', data: GRID })).state.scene;
  const cols = new Set(surface.marks[0].cols);
  assert.ok(cols.size > 10, 'the surface is coloured by a ramp');
  assert.ok(surface.legend?.ramp, 'and its legend is the ramp');
});

test('highlight quiets every other mark and close-up framing centres on it', async () => {
  const { state } = await render({ renderMode: 'scene', data: ONE, sceneHighlight: 'West', sceneFraming: 'close' });
  const scene = state.scene;
  const west = scene.marks.find((m: any) => m.k === '3:0');
  assert.equal(west.q, 0);
  assert.ok(scene.marks.filter((m: any) => m.k !== '3:0').every((m: any) => m.q === 1 && m.c === scene.stage.colours.quiet));
  const { project } = hooks.makeProjector(scene.camera, scene.W, scene.H);
  const q = project(west.p);
  assert.ok(Math.abs(q[0] - scene.W / 2) < scene.W * 0.12, `the highlight sits near the centre (${q[0].toFixed(0)})`);
  const max = (await render({ renderMode: 'scene', data: ONE, sceneHighlight: 'max' })).state.scene;
  assert.equal(max.marks.filter((m: any) => !m.q).length, 1, '"max" picks out the largest value');
});

test('the vector projection is deterministic, finite and labelled', async () => {
  const values = { renderMode: 'scene', data: BARS, heading: 'Responses by team' };
  const a = await render(values), b = await render(values);
  assert.equal(a.patch._threeFallback, b.patch._threeFallback);
  const svg = a.patch._threeFallback;
  assert.doesNotMatch(svg, /NaN|Infinity|undefined/);
  assert.match(svg, /<polygon/);
  assert.match(svg, />Responses by team</);
  assert.match(svg, />Engineering</);
  assert.match(a.patch._threeOverlay, /data-c3d-labels/);
  const placed = a.state.scene.placed;
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) {
    assert.ok(!(placed[i].x === placed[j].x && placed[i].y === placed[j].y), 'no two labels share a place');
  }
  const ids = svg.match(/id="([^"]+)"/g) || [];
  assert.ok(ids.every((id: string) => id.includes(a.state.scene.uid)), 'gradient ids carry the plan\'s own prefix');
});

test('new types, finishes and moves stay valid chart documents', async () => {
  for (const values of [
    { sceneType: 'donut3d', data: SHARE, sceneMaterial: 'metal' },
    { sceneType: 'bar3d', data: BARS, sceneMaterial: 'glow', motionPreset: 'arc' },
    { sceneType: 'bar3d', data: BARS, sceneMaterial: 'satin', motionPreset: 'stagger' },
  ]) {
    const { state } = await render({ renderMode: 'scene', ...values });
    assert.equal(validateShape(state.spec), true, JSON.stringify(validateShape.errors));
    assert.equal(validateChartSpec(state.spec).ok, true);
    assert.ok(['accurate', 'matte', 'gloss', 'glass'].includes(state.spec.theme.scene.material));
  }
  const arc = (await render({ renderMode: 'scene', data: BARS, motionPreset: 'arc' })).state;
  assert.equal(arc.spec.motion.preset, 'orbit');
  assert.equal(arc.scene.camera.arc, 26);
  const reveal = (await render({ renderMode: 'scene', data: BARS, motionPreset: 'reveal' })).state;
  assert.ok(reveal.scene.poster >= 0.56, 'a still of a reveal shows the bars grown');
});

test('the WebGL adapter draws the plan and gives a still its finished pose', () => {
  assert.match(adapter, /clock\.stillPose = true/);
  assert.match(adapter, /plan\.poster/);
  assert.match(adapter, /NeutralToneMapping/);
  assert.match(adapter, /PMREMGenerator/);
  assert.doesNotMatch(adapter, /innerHTML|eval\(|new Function/);
});

test('controls that never reached a 3-D scene are hidden there', () => {
  const vals: Record<string, unknown> = Object.fromEntries(manifest.inputs.map((i: any) => [i.id, i.default]));
  Object.assign(vals, { renderMode: 'scene', sceneType: 'bar3d', chartType: 'bar' });
  const match = (cond: any): boolean => Array.isArray(cond) ? cond.some(match) : Object.entries(cond).every(([k, v]) => Array.isArray(v) ? v.includes(vals[k]) : vals[k] === v);
  const visible = new Set(manifest.inputs.filter((i: any) => !i.showIf || match(i.showIf)).map((i: any) => i.id));
  for (const id of ['labelLayout', 'labelReserve', 'labelLines', 'yScaleType', 'yZero', 'showAxes', 'tickCount', 'errorColumn', 'axisTitleSize', 'showGrid', 'cameraAzimuth', 'sceneRoughness']) {
    assert.ok(!visible.has(id), `${id} is hidden in a 3-D scene`);
  }
  for (const id of ['sceneLayout', 'sceneHighlight', 'scenePose', 'cameraProjection', 'sceneFraming', 'sceneStage', 'sceneMaterial', 'numberFormat']) {
    assert.ok(visible.has(id), `${id} is offered in a 3-D scene`);
  }
});
