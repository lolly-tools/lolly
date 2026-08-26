// SPDX-License-Identifier: MPL-2.0
/**
 * Spatial Photo (community/spatial-photo) - plans/160 WP-B: the tool itself.
 *
 * Loads the REAL tool from the community pack and drives it through the engine,
 * so every assertion is about what the tool actually folds and ships.
 *
 * What is pinned here:
 *  - every camera preset is a CLOSED loop (path(1) is EXACTLY path(0)) and is
 *    continuous across the seam - which is what makes the frame-clock loop
 *    export loop join cleanly by construction rather than by a tuned fudge;
 *  - every user-settable value is clamped in hooks, because the renderer is fed
 *    straight off a URL (a hostile ?amount=1e9 has to die at the door), and the
 *    per-preset amount ceiling matches the preset list the renderer carries;
 *  - the focus vector normalises into the frame on both axes;
 *  - the canvas-tool lifecycle contract is present: per-paint IIFE, dispose of
 *    the previous instance, preserveDrawingBuffer, the ready signal, the frame
 *    clock ON THE CANVAS (never a window global), data-capture-stream, the
 *    __lollyFrameDriven bail, the DPR cap, and no wall clock in the renderer.
 *
 * Run with: node --test tests/spatial-photo.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { annotateTemplate } from '../engine/src/template.ts';
import { baseHost } from './helpers/host.ts';

// The SOURCE pack, not the gitignored tools/ profile view, so the suite is
// profile-independent: skip only when community/ is not checked out.
const COMMUNITY = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const DIR = join(COMMUNITY, 'spatial-photo');
const fetchFile = (path: string) => readFile(join(COMMUNITY, path), 'utf8');

const PACK_MOUNTED = existsSync(COMMUNITY);
const SKIP = !PACK_MOUNTED && 'community pack not mounted (clone without submodules)';
if (PACK_MOUNTED) {
  assert.ok(existsSync(join(DIR, 'tool.json')),
    'community/spatial-photo/tool.json is missing - pack is mounted, so the tool was renamed or deleted');
}

const tool: any = SKIP ? null : await loadTool('spatial-photo', fetchFile);

const TEMPLATE = PACK_MOUNTED ? readFileSync(join(DIR, 'template.html'), 'utf8') : '';
const LIB = PACK_MOUNTED ? readFileSync(join(DIR, 'lib', 'spatial.js'), 'utf8') : '';
const HOOKS = PACK_MOUNTED ? readFileSync(join(DIR, 'hooks.js'), 'utf8') : '';

/** The banned-construct scans are about CODE. A comment saying "never a wall
 *  clock" is the rule being documented, not broken. */
const code = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

/** A photo the runtime can resolve, so the fold is exercised on the real path. */
const PHOTO = { id: 'demo/photo', url: 'asset:demo/photo' };

/** Render the tool and hand back the parsed `_state` the template embeds. */
async function state(values: Record<string, unknown> = {}): Promise<any> {
  const rt = await createRuntime(tool, baseHost(), { photo: PHOTO, ...values });
  const html = rt.getHydrated() as string;
  const m = html.match(/id="sp-state">([\s\S]*?)<\/script>/);
  assert.ok(m, '_state was not embedded in the template');
  return JSON.parse(m![1]!);
}

/** The renderer's exported surface, evaluated with no DOM and no GL - the
 *  preset table is pure maths and must be assertable without either. */
function lib(): any {
  return new Function('window', `${LIB}\nreturn window.LollySpatial;`)({});
}

/** The hooks' own move table, evaluated exactly as the runtime loads them. */
function moveCeilings(): Record<string, number> {
  return (new Function(`${HOOKS}\nreturn _MOVES;`) as () => Record<string, number>)();
}

/** The hooks as the runtime loads them, with the export hook reachable. */
function hookApi(): { compute: (m: unknown[]) => unknown; beforeExport: (ctx: unknown) => void } {
  const api = (new Function(`${HOOKS}\nreturn { compute: _compute, beforeExport: beforeExport };`) as
    () => { compute: (m: unknown[]) => unknown; beforeExport: (ctx: unknown) => void })();
  return api;
}

/** A numeric constant read off the renderer source. The renderer does not export
 *  these (they are shader-side tuning), and the overscan budget below has to be
 *  computed from the SHIPPING values or it pins nothing. */
function libConst(name: string): number {
  const m = new RegExp(`var ${name} = ([\\d.]+);`).exec(LIB);
  assert.ok(m, `lib/spatial.js no longer declares ${name}`);
  return Number(m![1]);
}

test('folds the whole model into one parseable _state extra', { skip: SKIP }, async () => {
  const s = await state();
  assert.equal(s.move, 'dolly-in');
  assert.equal(s.width, 1280);
  assert.equal(s.height, 720);
  assert.equal(s.photoUrl, 'asset:demo/photo');
  assert.match(s.fog, /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  assert.equal(s.focus.length, 2);
  assert.equal(typeof s.duration, 'number');
});

test('the embedded JSON carries no raw < (it sits inside a <script> tag)', { skip: SKIP }, async () => {
  const rt = await createRuntime(tool, baseHost(), { photo: PHOTO, fog: '#123456' });
  const html = rt.getHydrated() as string;
  const raw = html.match(/id="sp-state">([\s\S]*?)<\/script>/)![1]!;
  assert.ok(!raw.includes('<'), 'a raw < inside the JSON would end the script element early');
});

test('every user-settable value is clamped in hooks', { skip: SKIP }, async () => {
  const hostile = await state({
    amount: 1e9, duration: -50, dof: 1e9, fogAmount: -3, depthContrast: 1e9,
    move: '__proto__', fog: 'url(javascript:alert(1))',
  });
  assert.equal(hostile.move, 'dolly-in', 'an unknown move falls back rather than reaching the renderer');
  assert.equal(hostile.amount, 1, "dolly-in's ceiling");
  assert.equal(hostile.duration, 2, 'duration clamps to its declared floor');
  assert.equal(hostile.dof, 1);
  assert.equal(hostile.fogAmount, 0);
  assert.equal(hostile.depthContrast, 3);
  assert.equal(hostile.fog, '#30ba78', 'a non-hex colour falls back');

  const junk = await state({ amount: 'x', duration: null, dof: 'NaN', depthContrast: {} });
  assert.equal(junk.amount, 0.6);
  assert.equal(junk.duration, 6);
  assert.equal(junk.dof, 0.35);
  assert.equal(junk.depthContrast, 1);
});

test('an unknown move never reaches the state as a prototype key', { skip: SKIP }, async () => {
  for (const bad of ['constructor', 'toString', 'hasOwnProperty']) {
    assert.equal((await state({ move: bad })).move, 'dolly-in', `${bad} must not pass the enum guard`);
  }
});

test('amount is capped per preset - the amplitude edge-stretch survives', { skip: SKIP }, async () => {
  const ceilings = moveCeilings();
  for (const [move, ceiling] of Object.entries(ceilings)) {
    const s = await state({ move, amount: 1 });
    assert.equal(s.amount, ceiling, `${move} must cap at ${ceiling}, not offer the setting where the smear reads as a tear`);
    assert.ok(ceiling > 0 && ceiling <= 1, `${move}: a ceiling outside (0,1] is not a fraction of the slider`);
  }
});

test('the hooks ceiling table and the renderer preset table name the same moves', { skip: SKIP }, () => {
  const names = lib().PRESETS.map((p: any) => p.name).sort();
  assert.deepEqual(Object.keys(moveCeilings()).sort(), names,
    'a move in one table and not the other is a preset that cannot be selected, or one that clamps to nothing');
});

test('every preset is a CLOSED loop', { skip: SKIP }, () => {
  for (const p of lib().PRESETS) {
    const a = p.path(0), b = p.path(1);
    assert.deepEqual(b, a, `${p.name}: path(1) must be EXACTLY path(0) or the loop export jumps at the seam`);
    // Closed is not enough - a path that leaps just before the seam and returns
    // to it is closed and still unwatchable.
    const near = p.path(1 - 1e-4);
    for (const k of Object.keys(a)) {
      assert.ok(Math.abs(near[k] - a[k]) < 1e-3, `${p.name}: ${k} is discontinuous approaching the seam`);
    }
    // And a second loop is the first loop: the phase is wrapped, not accumulated.
    assert.deepEqual(p.path(2.25), p.path(0.25), `${p.name}: phase must wrap, never accumulate`);
  }
});

test('every preset actually moves the camera, at a sane amplitude', { skip: SKIP }, () => {
  for (const p of lib().PRESETS) {
    let travel = 0;
    for (let i = 0; i <= 64; i++) {
      const q = p.path(i / 64);
      for (const k of ['camX', 'camY', 'camZ']) travel = Math.max(travel, Math.abs(q[k]));
      assert.ok(Math.abs(q.tilt) <= 15, `${p.name}: ${q.tilt}° of tilt is a different tool`);
      assert.ok(q.fov >= 0 && q.fov <= 1, `${p.name}: the field-of-view delta is a multiplier, not degrees`);
    }
    assert.ok(travel > 0.05, `${p.name}: a move that does not move is a still`);
    assert.ok(travel < 1, `${p.name}: past a full base distance the camera is through the picture`);
    assert.ok(p.heroT >= 0 && p.heroT < 1, `${p.name}: the poster phase must be inside the loop`);
  }
});

test('vertigo is the only preset that touches the field of view', { skip: SKIP }, () => {
  for (const p of lib().PRESETS) {
    const peak = Math.max(...Array.from({ length: 33 }, (_, i) => p.path(i / 32).fov));
    if (p.name === 'vertigo') assert.ok(peak > 0.1, 'a dolly-zoom without a zoom is a dolly');
    else assert.equal(peak, 0, `${p.name}: only the dolly-zoom changes the lens`);
  }
});

test('the focus point normalises into the frame', { skip: SKIP }, async () => {
  assert.deepEqual((await state({ focus: { x: 5, y: -5 } })).focus, [1, 0]);
  assert.deepEqual((await state({ focus: { x: 'x', y: null } })).focus, [0.5, 0.5]);
  assert.deepEqual((await state({ focus: { x: 0.25, y: 0.75 } })).focus, [0.25, 0.75]);
  assert.deepEqual((await state({ focus: 'nonsense' })).focus, [0.5, 0.5]);
});

test('the same inputs fold to the same state twice', { skip: SKIP }, async () => {
  assert.deepEqual(await state({ move: 'vertigo', amount: 0.4 }), await state({ move: 'vertigo', amount: 0.4 }));
});

test('the manifest declares the export shape WP-B needs', { skip: SKIP }, () => {
  const m = JSON.parse(readFileSync(join(DIR, 'tool.json'), 'utf8'));
  assert.equal(m.status, 'experimental', 'experimental forces the disclosed export watermark');
  for (const f of ['png', 'gif', 'webm']) assert.ok(m.render.formats.includes(f), `missing format ${f}`);
  assert.notEqual(m.render.c2pa, false,
    'the agreed provenance posture is disclose-in-actions, so the credential stays on');
  assert.ok(!m.inputs.some((i: any) => i.id === 'width' || i.id === 'height'),
    'width/height are RESERVED url params and must never be declared as inputs');
  const moves = m.inputs.find((i: any) => i.id === 'move').options.map((o: any) => o.value).sort();
  assert.deepEqual(moves, Object.keys(moveCeilings()).sort(), 'the picker and the clamp table must offer the same moves');
});

test('the canvas-tool lifecycle contract is wired', { skip: SKIP }, () => {
  assert.match(TEMPLATE, /^\(function \(\) \{/m, 'the script body must be a per-paint IIFE');
  assert.ok(!/^\s*(let|const) /m.test(TEMPLATE.split('<script>')[1] ?? ''),
    'top-level let/const would throw on the second paint of the same document');
  assert.match(TEMPLATE, /__lollySpatialEpoch/, 'a stale async callback from a prior paint must be droppable');
  assert.match(TEMPLATE, /window\.__lollySpatial\.dispose/, 'the previous instance must be disposed - GL contexts cap around 16');
  assert.match(TEMPLATE, /window\.__toolHasReadySignal = true/, 'without the ready signal the export captures a blank frame');
  assert.match(TEMPLATE, /new CustomEvent\('tool:ready'\)/);
  assert.match(TEMPLATE, /data-capture-stream/, 'the real-time recording path opts in on the canvas');
  assert.match(TEMPLATE, /canvas\.__lollyFrameRender = /, 'the frame clock lives on the canvas');
  assert.ok(!/window\.__lollyFrameRender/.test(TEMPLATE),
    'a window-global frame clock leaks across SPA tool navigation and drives an unrelated tool');
  assert.match(TEMPLATE, /vector-input\[data-input-id="focus"\]/,
    'the canvas focus pick writes the sidebar input, never a parallel state');
});

test('the renderer holds the load-bearing GL contract', { skip: SKIP }, () => {
  assert.match(LIB, /preserveDrawingBuffer: true/,
    'without preserveDrawingBuffer every raster and video export is silently blank');
  assert.match(LIB, /canvas\.__lollyFrameDriven/, 'the live loop must bail while the exporter drives frames');
  assert.match(LIB, /resumeOwed/, 'the live clock owes one swallowed delta after a driven export');
  assert.match(LIB, /Math\.min\(2, global\.devicePixelRatio/, 'device pixel ratio is capped at 2');
  assert.match(LIB, /WEBGL_lose_context/, 'dispose must release the context, not wait for collection');
  assert.match(LIB, /global\.document && global\.document\.hidden/, 'the loop must idle in a hidden tab');
  assert.ok(!/webgpu/i.test(code(LIB)), 'WebGPU canvases export blank - the render path is WebGL2 only');
  assert.ok(!/\bimport\b|\brequire\(/.test(code(LIB)), 'a tool is data: it never imports the engine or a shell');
});

test('the grid coarsens on a dense display, and never inverts', { skip: SKIP }, () => {
  const { gridSize } = lib();
  assert.ok(gridSize(2) < gridSize(1), 'a high device pixel ratio must buy a coarser grid, not a finer one');
  assert.ok(gridSize(1) <= 256 && gridSize(2) >= 64, 'the grid stays inside the plans/160 ~256 envelope');
});

test('the overscan ring covers every preset at its own amount ceiling', { skip: SKIP }, () => {
  // The mesh reaches past the frame so a moving camera finds stretched edge
  // pixels there. Anywhere it falls short, the clear colour - the fog colour at
  // full saturation - bands the frame edge mid-move. `dolly-out` is the case the
  // original 0.14 ring missed: pulling BACK widens the view, which the far-plane
  // and lateral-travel budget never accounted for.
  const OVERSCAN = libConst('OVERSCAN'), RELIEF = libConst('RELIEF'), BASE_FOV = libConst('BASE_FOV');
  const rad = (d: number): number => d * Math.PI / 180;
  const baseDist = 1 / Math.tan(rad(BASE_FOV) / 2);
  const aspect = 1280 / 720;
  const meshY = 1 + 2 * OVERSCAN, meshX = aspect * meshY;
  const ceilings = moveCeilings();

  for (const p of lib().PRESETS) {
    const amt = ceilings[p.name]!;
    for (let i = 0; i <= 200; i++) {
      const pose = p.path(i / 200);
      const tanH = Math.tan(rad(BASE_FOV * (1 + amt * pose.fov)) / 2);
      const dist = baseDist * (1 + amt * pose.camZ);
      // The far-displaced surface sits RELIEF/2 further from the camera again,
      // so it is what the widening view runs out of mesh on first.
      const half = (dist + RELIEF / 2) * tanH;
      const look = Math.abs(Math.tan(rad(amt * pose.tilt)) * dist);
      const needY = half + Math.abs(amt * pose.camY) + look;
      const needX = aspect * half + Math.abs(amt * pose.camX);
      assert.ok(needY <= meshY,
        `${p.name} at amount ${amt}: needs ${needY.toFixed(3)} of vertical mesh, has ${meshY} - the fog colour bands the frame`);
      assert.ok(needX <= meshX,
        `${p.name} at amount ${amt}: needs ${needX.toFixed(3)} of horizontal mesh, has ${meshX.toFixed(3)}`);
    }
  }
});

test('a canvas click sets the focus point and does not also open the move picker', { skip: SKIP }, () => {
  // annotateTemplate bakes data-canvas-input onto a tag from the FIRST input id
  // its attributes mention - which on the wrapper is `move`, a select, and the
  // shell opens a select in place. The tool declares its own mapping instead.
  const ids = JSON.parse(readFileSync(join(DIR, 'tool.json'), 'utf8')).inputs.map((i: any) => i.id);
  const annotated = annotateTemplate(TEMPLATE, ids);
  assert.ok(!/data-canvas-input="(move|fog|photo)"/.test(annotated),
    'an inline-edit control mapped onto the canvas pops its editor over the picture on every focus click');
  assert.match(annotated, /data-canvas-input="focus"/,
    'the click target must map to the focus vector, which has no inline editor');
});

test('the depth request is deduped while it is still in flight', { skip: SKIP }, () => {
  // The first pass is a model download plus multi-second inference, and every
  // slider drag repaints. Caching only the RESULT would queue one heavy job per
  // drag for a picture that never changed.
  assert.match(TEMPLATE, /CACHE\.p = depth\.forImage\(/, 'the in-flight promise must be parked, not just the map');
  assert.match(TEMPLATE, /CACHE\.url !== cfg\.photoUrl \|\| !CACHE\.p/, 'a second paint must reuse the outstanding request');
  assert.match(TEMPLATE, /CACHE\.p = null; CACHE\.url = ''/, 'a failure must clear the key so asking again retries');
});

test('an animated export takes the loop length the user set, not the manifest default', { skip: SKIP }, () => {
  const { compute, beforeExport } = hookApi();
  compute([{ id: 'duration', value: 11 }]);
  const opts: any = { duration: 6 };
  beforeExport({ format: 'webm', opts });
  assert.equal(opts.duration, 11, 'a 12-second loop exported at the manifest 6s is cut mid-move');

  const typed: any = { duration: 3, durationUserSet: true };
  beforeExport({ format: 'mp4', opts: typed });
  assert.equal(typed.duration, 3, 'a duration the user typed is a deliberate instruction and wins');

  const still: any = { duration: 6 };
  beforeExport({ format: 'png', opts: still });
  assert.equal(still.duration, 6, 'a still has no length to sync');

  compute([{ id: 'duration', value: 1e9 }]);
  const hostile: any = { duration: 6 };
  beforeExport({ format: 'gif', opts: hostile });
  assert.equal(hostile.duration, 12, 'the export length rides the CLAMPED duration, not the raw url value');
});

test('the manifest slider never offers travel the hooks silently throw away', { skip: SKIP }, () => {
  const m = JSON.parse(readFileSync(join(DIR, 'tool.json'), 'utf8'));
  const amount = m.inputs.find((i: any) => i.id === 'amount');
  const ceilings = moveCeilings();
  const declared: Record<string, number> = {};
  for (const r of amount.rangeWhen ?? []) declared[r.when.move] = r.max;
  for (const [move, ceiling] of Object.entries(ceilings)) {
    const shown = declared[move] ?? amount.max;
    assert.equal(shown, ceiling, `${move}: the slider travels to ${shown} but hooks clamp at ${ceiling} - dead travel`);
  }
});

test('nothing in the renderer or the fold reads a wall clock or an unseeded random', { skip: SKIP }, () => {
  for (const [name, raw] of [['lib/spatial.js', LIB], ['hooks.js', HOOKS]] as const) {
    const src = code(raw);
    assert.ok(!/Math\.random/.test(src), `${name}: a random camera is not a reproducible link`);
    assert.ok(!/Date\.now|new Date\s*\(\s*\)/.test(src), `${name}: a wall clock would break deterministic replay`);
    assert.ok(!/performance\.now/.test(src), `${name}: the only clock is the rAF timestamp, live preview only`);
  }
});
