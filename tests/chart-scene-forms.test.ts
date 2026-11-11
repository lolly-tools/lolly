// SPDX-License-Identifier: MPL-2.0
/**
 * Chart's newer 3-D forms: the nine scene types beyond bars, donut, scatter and
 * surface; the view a hand adjusts on the canvas; and the directed cinematic
 * forms (tour, countdown, reveal, gate tunnel, terrain flight), whose camera
 * moves between beats the plan solves. The plan is pure, so every check runs
 * straight through the hooks.
 *
 * Run with: node --test tests/chart-scene-forms.test.ts
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import Ajv from 'ajv/dist/2020.js';
import { validateChartSpec } from '../engine/src/index.ts';

const CHART = new URL('../community/chart/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('tool.json', CHART), 'utf8'));
const hooksSource = readFileSync(new URL('hooks.js', CHART), 'utf8');
const adapter = readFileSync(new URL('lib/chart-three.js', CHART), 'utf8');
const template = readFileSync(new URL('template.html', CHART), 'utf8');
const chartSchema = JSON.parse(readFileSync(new URL('../schemas/chart-v1.schema.json', import.meta.url), 'utf8'));
const validateShape = new (Ajv as any)({ allErrors: true, strict: false }).compile(chartSchema);

const hooks = new Function('host', `${hooksSource}\nreturn { onInit, onInput, makeProjector, SCENE_TYPES, CINEMATIC_TYPES };`)(undefined);

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
const ONE = 'Region,Revenue\nNorth,42\nSouth,58\nEast,33\nWest,71\nCentral,49\nIslands,18\nCapital,88';
const GRID = 'Hour,Mon,Tue,Wed,Thu\n06:00,4,5,6,5\n09:00,22,28,31,27\n12:00,46,55,61,52\n15:00,38,41,44,47';
const STAGES = 'Stage,People\nVisited,12000\nSigned up,5400\nTried,2900\nPaid,1100\nRenewed,800';
const CHANGES = 'Step,Change\nStart,120\nNew,45\nUpsell,22\nChurn,-38\nRefunds,-12\nPrice,18';
const LONG = `Month,Visits\n${Array.from({ length: 36 }, (_, i) => `M${i + 1},${Math.round(40 + 30 * Math.sin(i / 3) + i)}`).join('\n')}`;

const SCENES: [string, string][] = [
  ['area3d', BARS], ['tiles3d', GRID], ['city3d', ONE], ['rose3d', ONE], ['funnel3d', STAGES],
  ['bubbles3d', ONE], ['blocks3d', BARS], ['spiral3d', LONG], ['waterfall3d', CHANGES],
];
const DIRECTED: [string, string][] = [
  ['tour3d', ONE], ['countdown3d', ONE], ['reveal3d', ONE], ['tunnel3d', ONE], ['terrain3d', GRID],
];

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
    else if (m.t === 'mesh') for (const f of m.f) for (const v of f.v) take(v);
  }
  return { x0, x1, y0, y1 };
}

test('every new scene type is offered, frames its marks on the artboard and fills it', async () => {
  const offered = new Set(manifest.inputs.find((i: any) => i.id === 'sceneType').options.map((o: any) => o.value));
  assert.deepEqual([...offered].sort(), [...hooks.SCENE_TYPES].sort(), 'the menu and the planner list the same scene types');
  const sizes: [number, number][] = [[1280, 800], [1080, 1350], [1920, 1080]];
  for (const [type, data] of SCENES) for (const [width, height] of sizes) {
    const { state } = await render({ renderMode: 'scene', sceneType: type, data, heading: 'A title', width, height });
    const scene = state.scene, e = markExtents(scene), where = `${type} at ${width}×${height}`;
    assert.ok(scene.marks.length > 0, `${where}: draws marks`);
    assert.ok(e.x0 >= -1 && e.x1 <= width + 1 && e.y0 >= -1 && e.y1 <= height + 1, `${where}: marks stay on the artboard`);
    assert.ok(e.y0 >= scene.overlay.top - 2, `${where}: marks stay clear of the title`);
    const fill = Math.max((e.x1 - e.x0) / width, (e.y1 - e.y0) / (scene.overlay.bottom - scene.overlay.top));
    assert.ok(fill > 0.5, `${where}: the chart fills the frame (${fill.toFixed(2)})`);
    assert.ok(!/NaN|Infinity/.test(JSON.stringify(scene.camera)) && !/NaN|null,null/.test(JSON.stringify(scene.marks)), `${where}: the plan is finite`);
    assert.equal(validateShape(state.spec), true, `${where}: ${JSON.stringify(validateShape.errors)}`);
    assert.equal(validateChartSpec(state.spec).ok, true, `${where}: a valid chart document`);
  }
});

test('each scene type reads the table the way its name says', async () => {
  const plan = async (type: string, data: string, extra: Record<string, unknown> = {}) => (await render({ renderMode: 'scene', sceneType: type, data, ...extra })).state.scene;
  assert.equal((await plan('area3d', BARS)).marks.filter((m: any) => m.t === 'mesh').length, 3, 'walls: one solid per series');
  assert.equal((await plan('tiles3d', GRID)).marks.length, 16, 'tiles: one per category and series');
  for (const type of ['city3d', 'rose3d', 'bubbles3d', 'spiral3d']) assert.equal((await plan(type, ONE)).marks.length, 7, `${type}: one mark per category`);
  assert.equal((await plan('funnel3d', STAGES)).marks.length, 5, 'funnel: one ring per stage');
  // A funnel opens at the top and a pyramid stands on its widest stage.
  const top = (s: any) => s.marks.reduce((best: any, m: any) => (Math.max(...m.f.flatMap((f: any) => f.v.map((v: number[]) => v[1]))) > Math.max(...best.f.flatMap((f: any) => f.v.map((v: number[]) => v[1]))) ? m : best));
  assert.equal(top(await plan('funnel3d', STAGES)).k, '0', 'the first stage is the top of a funnel');
  assert.equal(top(await plan('funnel3d', STAGES, { sceneLayout: 'pyramid' })).k, '4', 'and the top of a pyramid is the last stage');
  // Unit blocks: the cubes add up to the table, and the legend says what one counts.
  const blocks = await plan('blocks3d', BARS);
  assert.match(blocks.legend.items.at(-1).label, /^Each block is \d+/);
  assert.equal(blocks.legend.items.at(-1).colour, null);
  // Waterfall: each step starts where the last ended, and a total closes the walk.
  const fall = await plan('waterfall3d', CHANGES);
  assert.equal(fall.marks.length, 7);
  const tops = fall.marks.map((m: any) => [m.p[1] - m.s[1] / 2, m.p[1] + m.s[1] / 2]);
  const total = fall.marks.at(-1);
  assert.ok(Math.abs(tops[0][0] - tops.at(-1)[0]) < 1e-3, 'the total stands on the same baseline as the start');
  assert.notEqual(fall.marks[3].c, fall.marks[1].c, 'a fall is not coloured as a rise');
  assert.notEqual(total.c, fall.marks[1].c, 'the total has a colour of its own');
});

test('mesh solids are well formed and the vector projection draws them the same every time', async () => {
  for (const [type, data] of [['area3d', BARS], ['funnel3d', STAGES], ['tunnel3d', ONE]] as [string, string][]) {
    const mode = type === 'tunnel3d' ? { renderMode: 'cinematic', cinematicType: type } : { renderMode: 'scene', sceneType: type };
    const { patch, state } = await render({ ...mode, data });
    const meshes = state.scene.marks.filter((m: any) => m.t === 'mesh');
    assert.ok(meshes.length > 0, `${type}: draws solids`);
    for (const m of meshes) for (const f of m.f) {
      assert.ok(f.v.length >= 3, `${type}: a face has at least three corners`);
      assert.ok(Math.abs(Math.hypot(...f.n) - 1) < 1e-3, `${type}: a face normal is a unit vector`);
      if (f.vn) assert.equal(f.vn.length, f.v.length, `${type}: one corner normal per corner`);
    }
    const again = await render({ ...mode, data });
    assert.equal(patch._threeFallback, again.patch._threeFallback, `${type}: the vector projection is deterministic`);
    assert.ok((patch._threeFallback.match(/<polygon /g) || []).length > meshes.length, `${type}: the vector projection draws the faces`);
    assert.doesNotMatch(patch._threeFallback, /NaN|Infinity/);
  }
});

test('a view adjusted on the canvas moves the camera, never the layout, and a new camera clears it', async () => {
  const base = (await render({ renderMode: 'scene', data: BARS })).state.scene;
  const view = { az: 64, el: 16, zoom: 1.5, x: 0.1, y: -0.05 };
  const turned = (await render({ renderMode: 'scene', data: BARS, sceneView: view })).state.scene;
  assert.equal(JSON.stringify(turned.marks), JSON.stringify(base.marks), 'the marks stay where they were');
  assert.deepEqual(turned.camera.view, base.camera.view, 'the view is measured from the same chosen camera');
  assert.equal(turned.camera.az, base.camera.az + 64);
  assert.equal(turned.camera.el, base.camera.el + 16);
  assert.ok(Math.abs(turned.camera.dist - base.camera.dist / 1.5) < 1e-3, 'zoom brings the camera closer');
  assert.ok(Math.abs(turned.camera.shift[0] - base.camera.shift[0] - 0.1) < 1e-3 && Math.abs(turned.camera.shift[1] - base.camera.shift[1] + 0.05) < 1e-3, 'pan moves the frame');
  const plain = (await render({ renderMode: 'scene', data: BARS, sceneView: { az: 0, el: 0, zoom: 1, x: 0, y: 0 } })).state.scene;
  assert.deepEqual(plain.camera, base.camera, 'a plain view leaves the chosen camera alone');
  const height = (await render({ renderMode: 'scene', data: BARS, sceneView: { az: 0, el: 90, zoom: 1, x: 0, y: 0 } })).state.scene;
  assert.equal(height.camera.el, 85, 'the camera never goes past straight down');
  const ortho = (await render({ renderMode: 'scene', data: BARS, scenePose: 'iso', sceneView: { az: 0, el: 0, zoom: 2, x: 0, y: 0 } })).state.scene;
  assert.ok(Math.abs(ortho.camera.half - ortho.camera.view.half / 2) < 1e-3, 'zoom narrows a flat lens');
  const repose = await hooks.onInput({ id: 'scenePose', model: model({ renderMode: 'scene', data: BARS, scenePose: 'low', sceneView: view }) });
  assert.deepEqual(repose.sceneView, { az: 0, el: 0, zoom: 1, x: 0, y: 0 }, 'choosing a camera starts it clean');
  const keep = await hooks.onInput({ id: 'sceneView', model: model({ renderMode: 'scene', data: BARS, sceneView: view }) });
  assert.equal(keep.sceneView, undefined, 'a turned view is kept');
  const field = manifest.inputs.find((i: any) => i.id === 'sceneView');
  assert.equal(field.type, 'vector');
  assert.deepEqual(field.fields.map((f: any) => f.id), ['az', 'el', 'zoom', 'x', 'y']);
});

test('the canvas takes a hand only in the editor, and saves one view when it lets go', () => {
  assert.match(template, /__lollySetInput/);
  assert.match(template, /closest\('#tool-canvas, #tool-content'\)/, 'only the live editor canvas is handled');
  assert.match(adapter, /commit\('sceneView', viewValue\(\)\)/, 'a gesture saves the view once it ends');
  assert.match(adapter, /if \(e\.ctrlKey \|\| e\.metaKey\) return;/, 'a pinch or Ctrl-scroll stays the page zoom');
  assert.match(adapter, /plan\.kind !== 'flight' && !shotCam/, 'a cinematic camera is not handled');
  assert.match(adapter, /hint\.setAttribute\('data-export-hide', ''\)/, 'the gesture hint never reaches an export');
  assert.doesNotMatch(adapter, /innerHTML|eval\(|new Function/);
});

test('every directed form is offered and plans beats in order, ending on the still', async () => {
  const offered = new Set(manifest.inputs.find((i: any) => i.id === 'cinematicType').options.map((o: any) => o.value));
  assert.deepEqual([...offered].sort(), [...hooks.CINEMATIC_TYPES].sort(), 'the menu and the planner list the same forms');
  for (const [type, data] of DIRECTED) {
    const { state } = await render({ renderMode: 'cinematic', cinematicType: type, data, heading: 'A title' });
    const scene = state.scene, beats = scene.shots.beats;
    assert.ok(beats.length >= 2, `${type}: more than one shot`);
    let last = -1;
    for (const b of beats) {
      assert.ok(b.t0 >= last - 1e-9 && b.t1 >= b.t0 && b.t1 <= 1 + 1e-9, `${type}: beats run forward in time`);
      assert.ok([b.az, b.el, b.dist, b.fov, ...b.look, ...b.shift].every(Number.isFinite), `${type}: every pose is finite`);
      last = b.t1;
    }
    const end = beats.at(-1);
    assert.deepEqual([end.az, end.el, end.dist, end.look], [scene.camera.az, scene.camera.el, scene.camera.dist, scene.camera.target], `${type}: the closing shot is the still`);
    assert.equal(scene.poster, 0.9999, `${type}: a still shows the closing shot`);
    assert.equal(validateShape(state.spec), true, `${type}: ${JSON.stringify(validateShape.errors)}`);
    assert.equal(validateChartSpec(state.spec).ok, true, `${type}: a valid chart document`);
    assert.equal(state.report.rendererId, 'three-directed-shots');
  }
});

test('the tour, countdown and reveal stop where they say they do', async () => {
  const tour = (await render({ renderMode: 'cinematic', cinematicType: 'tour3d', data: `${ONE}\nHarbour,51` })).state.scene.shots.beats;
  assert.deepEqual(tour.filter((b: any) => b.cap).map((b: any) => b.cap.sub).sort(), ['Highest', 'Latest', 'Lowest']);
  const once = (await render({ renderMode: 'cinematic', cinematicType: 'tour3d', data: ONE })).state.scene.shots.beats;
  assert.deepEqual(once.filter((b: any) => b.cap).map((b: any) => b.cap.sub).sort(), ['Highest', 'Lowest'], 'a value that is both highest and latest is visited once');
  assert.ok(tour.filter((b: any) => b.cap).every((b: any) => b.focus.length === 1), 'each stop spotlights one mark');
  const picked = (await render({ renderMode: 'cinematic', cinematicType: 'tour3d', data: ONE, sceneHighlight: 'East,West' })).state.scene.shots.beats;
  assert.deepEqual(picked.filter((b: any) => b.cap).map((b: any) => b.cap.title), ['East', 'West'], 'Highlight chooses the stops');
  const count = (await render({ renderMode: 'cinematic', cinematicType: 'countdown3d', data: ONE })).state.scene;
  const ranks = count.shots.beats.filter((b: any) => b.cap).map((b: any) => b.cap.title);
  assert.equal(ranks[0], '#7  Islands');
  assert.equal(ranks.at(-1), '#1  Capital');
  const rises = count.marks.map((m: any) => m.g);
  assert.deepEqual(rises, [...rises].sort((a: number, b: number) => a - b), 'the bars rise smallest first');
  assert.equal(count.shots.grows, true);
  const reveal = (await render({ renderMode: 'cinematic', cinematicType: 'reveal3d', data: ONE, sceneHighlight: 'West' })).state.scene.shots.beats;
  assert.equal(reveal[0].cap.title, 'West');
  assert.ok(reveal[0].dist < reveal.at(-1).dist / 2, 'the reveal opens close and pulls back');
});

test('the gate tunnel flies its axis and the terrain flight stays above the land', async () => {
  const tunnel = (await render({ renderMode: 'cinematic', cinematicType: 'tunnel3d', data: ONE })).state.scene;
  const gates = tunnel.shots.beats.filter((b: any) => b.cap);
  assert.equal(gates.length, 7, 'a stop at every gate');
  assert.equal(new Set(gates.map((b: any) => b.look[1])).size, 1, 'every gate on one axis');
  assert.ok(gates.every((b: any, i: number) => i === 0 || b.look[2] < gates[i - 1].look[2]), 'the camera flies one way through them');
  const terrain = (await render({ renderMode: 'cinematic', cinematicType: 'terrain3d', data: GRID })).state.scene;
  const ground = Math.max(...terrain.marks[0].pts.filter((_: number, i: number) => i % 3 === 1));
  for (const b of terrain.shots.beats.slice(0, -1)) {
    const eyeY = b.look[1] + Math.sin(b.el * Math.PI / 180) * b.dist;
    assert.ok(eyeY > ground, `the camera clears the highest ground (${eyeY.toFixed(2)} > ${ground.toFixed(2)})`);
  }
  assert.deepEqual(terrain.shots.beats.filter((b: any) => b.cap).map((b: any) => b.cap.sub), ['The peak', 'The low point']);
});

test('the new starting templates open as the forms they name', async () => {
  const dir = new URL('templates/', CHART);
  const forms = new Set([...SCENES, ...DIRECTED].map(([t]) => t));
  const seen = new Set<string>();
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const t = JSON.parse(readFileSync(new URL(file, dir), 'utf8'));
    const form = t.values.sceneType || t.values.cinematicType;
    if (!forms.has(form) || (t.values.renderMode === 'scene' ? !t.values.sceneType : !t.values.cinematicType)) continue;
    seen.add(form);
    const { state } = await render(t.values);
    assert.ok(state.scene && state.scene.marks.length > 0, `${t.id}: draws its chart`);
    assert.equal(state.report.findings.filter((f: any) => f.severity !== 'info').length, 0, `${t.id}: no findings`);
  }
  assert.deepEqual([...seen].sort(), [...forms].sort(), 'a starting template for every new form');
});
