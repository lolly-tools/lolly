// SPDX-License-Identifier: MPL-2.0
/**
 * Darkroom tone controls (plans/289 item 2): Levels with Auto, Curves, Black &
 * White, Color Balance and Dehaze.
 *
 * Run with: node --test tests/darkroom-tone.test.ts
 *
 * Every control is a stage of the colour pipeline, which Darkroom bakes into a
 * LUT. The bake runs headless (it is how the CLI hands over a .cube), so most
 * checks drive the REAL tool through the engine runtime, bake the look, and read
 * the LUT entry for a known input colour. The pieces that need pixels (Auto
 * levels) or are easier to pin exactly (the Black & White weights) are lifted
 * out of the hook source the way the runtime compiles a hook, as
 * tests/grade-drift.test.ts does.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';

const TOOLS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const tool: any = await loadTool('darkroom', (path: string) => readFile(join(TOOLS_DIR, path), 'utf8'));
const value = (rt: any, id: string) => rt.getModel().find((i: any) => i.id === id)?.value;

function makeHost() {
  const delivered: { blob: Blob }[] = [];
  const host: any = baseHost();
  host.tokens = { colors: async () => [] };
  host.export = { file: async (blob: Blob) => { delivered.push({ blob }); } };
  return { host, delivered };
}

// Bake the look for a set of inputs and return an accessor for the 33-cube:
// at(r, g, b) with each channel a grid index 0..32 (value = index / 32).
async function bake(values: Record<string, unknown>) {
  const { host, delivered } = makeHost();
  const rt = await createRuntime(tool, host, {});
  for (const [k, v] of Object.entries(values)) await rt.setInput(k, v as any);
  await rt.setInput('bakeLut', true as any);
  const rows: number[][] = [];
  for (const line of (await delivered[delivered.length - 1]!.blob.text()).split('\n')) {
    const parts = line.trim().split(/\s+/);
    if (parts.length === 3 && parts.every(p => /^-?\d/.test(p))) rows.push(parts.map(Number));
  }
  assert.equal(rows.length, 33 ** 3);
  return { rt, at: (r: number, g: number, b: number) => rows[(b * 33 + g) * 33 + r]! };
}
const near = (got: number, want: number, tol: number, what: string) =>
  assert.ok(Math.abs(got - want) <= tol, `${what}: expected ${want}, got ${got}`);

// Darkroom's own functions, compiled the way the runtime compiles a hook.
const lifted = new Function('host', `${readFileSync(join(TOOLS_DIR, 'darkroom', 'hooks.js'), 'utf8')}
return { paramsFrom, blackWhite, colorBalance, autoLevelsFrom, colorKey, makeColorFn };`)({}) as any;

test('manifest: the tone sections, their gates and their defaults', () => {
  const byId = Object.fromEntries(tool.manifest.inputs.map((i: any) => [i.id, i]));
  assert.equal(byId.dehaze.section, 'Develop');
  for (const [c, v] of [['', 'rgb'], ['Red', 'red'], ['Green', 'green'], ['Blue', 'blue']] as const) {
    for (const f of ['InBlack', 'Gamma', 'InWhite', 'OutBlack', 'OutWhite']) {
      assert.deepEqual(byId[`levels${c}${f}`].showIf, { levelsChannel: v }, `levels${c}${f}`);
    }
  }
  for (const [id, v] of [['curveRgb', 'rgb'], ['curveRed', 'red'], ['curveGreen', 'green'], ['curveBlue', 'blue']] as const) {
    assert.equal(byId[id].type, 'text');
    assert.equal(byId[id].display, 'curve');
    assert.equal(byId[id].default, '');
    assert.deepEqual(byId[id].showIf, { curveChannel: v });
  }
  assert.deepEqual(['bwReds', 'bwYellows', 'bwGreens', 'bwCyans', 'bwBlues', 'bwMagentas'].map(id => byId[id].default), [40, 60, 40, 60, 20, 80]);
  assert.deepEqual(byId.bwTintHue.showIf, { bwMode: true, bwTint: true });
  assert.equal(byId.cbPreserve.default, true);
  assert.equal(byId.levelsAuto.default, false);
  const keys = tool.manifest.inputs.map((i: any) => i.urlKey).filter(Boolean);
  assert.equal(new Set(keys).size, keys.length, 'url keys are unique');
});

test('defaults: every new control at rest leaves the look an identity', async () => {
  const { at } = await bake({});
  assert.deepEqual(at(0, 0, 0), [0, 0, 0]);
  assert.deepEqual(at(32, 32, 32), [1, 1, 1]);
  for (const c of at(16, 16, 16)) near(c, 0.5, 0.005, 'mid-grey');
  for (const c of at(32, 0, 0).slice(1)) near(c, 0, 0.005, 'pure red keeps no green or blue');
});

test('levels: input black and white stretch, gamma bends the midtones, output range lifts and caps', async () => {
  const stretch = await bake({ levelsInBlack: 64, levelsInWhite: 191 });
  for (const c of stretch.at(8, 8, 8)) near(c, 0, 0.01, 'the input black point maps to black');
  for (const c of stretch.at(24, 24, 24)) near(c, 1, 0.01, 'the input white point maps to white');
  for (const c of stretch.at(16, 16, 16)) near(c, 0.5, 0.01, 'the middle stays in the middle');
  const gamma = await bake({ levelsGamma: 2 });
  for (const c of gamma.at(16, 16, 16)) near(c, Math.sqrt(0.5), 0.01, 'gamma 2 lifts 0.5 to its square root');
  const out = await bake({ levelsOutBlack: 51, levelsOutWhite: 204 });
  for (const c of out.at(0, 0, 0)) near(c, 0.2, 0.005, 'output black');
  for (const c of out.at(32, 32, 32)) near(c, 0.8, 0.005, 'output white');
});

test('levels: a channel is applied before the master', async () => {
  const { at } = await bake({ levelsRedInWhite: 128, levelsInBlack: 128 });
  // Red at 0.5 -> red channel stretch -> ~1 -> master: 1 stays 1.
  // Green at 0.5 -> master black point 128 -> ~0.
  const mid = at(16, 16, 16);
  near(mid[0]!, 1, 0.02, 'red');
  near(mid[1]!, 0, 0.02, 'green');
  near(mid[2]!, 0, 0.02, 'blue');
});

test('curves: the RGB curve passes through its point; a channel curve moves only its channel', async () => {
  const rgb = await bake({ curveRgb: '0-0_128-192_255-255' });
  // Grid 16 is 0.5 = level 127.5, a hair below the 128 point.
  for (const c of rgb.at(16, 16, 16)) near(c, 192 / 255, 0.01, 'mid-grey on the curve');
  for (const c of rgb.at(0, 0, 0)) near(c, 0, 0.001, 'black end');
  const red = await bake({ curveRed: '0-0_128-64_255-255' });
  const mid = red.at(16, 16, 16);
  near(mid[0]!, 64 / 255, 0.01, 'red channel pulled down');
  near(mid[1]!, 0.5, 0.005, 'green untouched');
  near(mid[2]!, 0.5, 0.005, 'blue untouched');
});

test('curves: moving the black point right clips everything below it', async () => {
  const { at } = await bake({ curveRgb: '64-0_255-255' });
  for (const c of at(4, 4, 4)) near(c, 0, 0.001, 'below the first point is flat at its output');
  for (const c of at(6, 6, 6)) near(c, 0, 0.005, 'still below 64');
});

test('curves: channel curves run before the RGB curve', async () => {
  const { at } = await bake({ curveRed: '0-0_255-128', curveRgb: '0-0_128-255_255-255' });
  // Red 1.0 -> red curve -> ~0.5 -> RGB curve (128 -> 255) -> ~1.
  near(at(32, 0, 0)[0]!, 1, 0.02, 'red');
});

test('black & white: Photoshop\'s default weights, exactly, and the tint colours the grey', () => {
  const P = lifted.paramsFrom({ bwMode: true });
  assert.deepEqual(lifted.blackWhite(P.bw, 1, 0, 0), [0.4, 0.4, 0.4], 'red at 40%');
  assert.deepEqual(lifted.blackWhite(P.bw, 0, 1, 0), [0.4, 0.4, 0.4], 'green at 40%');
  assert.deepEqual(lifted.blackWhite(P.bw, 0, 0, 1), [0.2, 0.2, 0.2], 'blue at 20%');
  assert.deepEqual(lifted.blackWhite(P.bw, 1, 1, 0), [0.6, 0.6, 0.6], 'yellow at 60%');
  assert.deepEqual(lifted.blackWhite(P.bw, 0, 1, 1), [0.6, 0.6, 0.6], 'cyan at 60%');
  assert.deepEqual(lifted.blackWhite(P.bw, 1, 0, 1), [0.8, 0.8, 0.8], 'magenta at 80%');
  assert.deepEqual(lifted.blackWhite(P.bw, 0.5, 0.5, 0.5), [0.5, 0.5, 0.5], 'a grey is its own grey');
  const tinted = lifted.blackWhite(lifted.paramsFrom({ bwMode: true, bwTint: true, bwTintHue: 35, bwTintSat: 25 }).bw, 0.5, 0.5, 0.5);
  assert.ok(tinted[0] > tinted[1] && tinted[1] > tinted[2], `a warm tint: ${tinted}`);
  near((Math.max(...tinted) + Math.min(...tinted)) / 2, 0.5, 1e-9, 'the tint keeps the grey as its lightness');
});

test('black & white: the switch gates the stage, and the weights reach the bake', async () => {
  const off = await bake({ bwReds: 100 });
  near(off.at(32, 0, 0)[0]!, 1, 0.005, 'weights alone do nothing');
  const on = await bake({ bwMode: true, bwReds: 100 });
  for (const c of on.at(32, 0, 0)) near(c, 1, 0.01, 'red at 100% is white');
});

test('colour balance: a midtone shift towards red, with and without Preserve luminosity', async () => {
  const kept = lifted.colorBalance(lifted.paramsFrom({ cbMidtonesCR: 60 }).cb, 0.5, 0.5, 0.5);
  assert.ok(kept[0] > 0.5, 'red rises');
  near(0.299 * kept[0] + 0.587 * kept[1] + 0.114 * kept[2], 0.5, 1e-6, 'Rec. 601 luma is put back');
  const free = lifted.colorBalance(lifted.paramsFrom({ cbMidtonesCR: 60, cbPreserve: false }).cb, 0.5, 0.5, 0.5);
  assert.ok(free[0] > 0.5);
  near(free[1], 0.5, 1e-9, 'green untouched without Preserve');
  const { at } = await bake({ cbMidtonesCR: 60 });
  assert.ok(at(16, 16, 16)[0]! > at(16, 16, 16)[1]!, 'the bake carries the shift');
  for (const c of at(0, 0, 0)) near(c, 0, 0.02, 'black barely moves: it is not a midtone');
});

test('dehaze: blacks and whites hold, the midtones deepen, a negative amount lifts them', async () => {
  const plus = await bake({ dehaze: 100 });
  for (const c of plus.at(0, 0, 0)) near(c, 0, 0.001, 'black');
  for (const c of plus.at(32, 32, 32)) near(c, 1, 0.001, 'white');
  assert.ok(plus.at(16, 16, 16)[0]! < 0.48, 'mid-grey deepens');
  const minus = await bake({ dehaze: -100 });
  assert.ok(minus.at(16, 16, 16)[0]! > 0.52, 'mid-grey lifts');
  assert.ok(minus.at(0, 0, 0)[0]! > 0.1, 'haze lifts black');
});

test('every tone control changes the colour key, so the cache and the video look refresh', () => {
  const base = lifted.colorKey(lifted.paramsFrom({}), {});
  for (const over of [
    { dehaze: 10 }, { levelsGamma: 1.2 }, { levelsBlueOutWhite: 200 }, { curveGreen: '0-0_128-140_255-255' },
    { bwMode: true }, { cbHighlightsYB: -20 },
  ]) {
    assert.notEqual(lifted.colorKey(lifted.paramsFrom(over), {}), base, JSON.stringify(over));
  }
});

test('auto levels: per channel, the 0.1% clipped extremes of the picture', () => {
  // A 100x10 frame: red runs 40..200, green 0..255, blue a flat 90.
  const w = 100, h = 10, data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    data[i] = Math.round(40 + 160 * x / (w - 1));
    data[i + 1] = Math.round(255 * x / (w - 1));
    data[i + 2] = 90;
    data[i + 3] = 255;
  }
  const canvas = { width: w, height: h, getContext: () => ({ getImageData: () => ({ data }) }) };
  const out = lifted.autoLevelsFrom(canvas, lifted.paramsFrom({}));
  assert.deepEqual(out[0], [40 / 255, 200 / 255], 'red stretches to its own range');
  assert.deepEqual(out[1], [0, 1], 'green already spans the range');
  assert.deepEqual(out[2], [0, 1], 'a flat channel is left alone');
});

test('auto levels: a picture that already spans the range needs no stretch', () => {
  const data = new Uint8ClampedArray(100 * 10 * 4);
  for (let i = 0; i < 1000; i++) {
    const v = Math.round(255 * (i % 100) / 99);
    data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255;
  }
  const canvas = { width: 100, height: 10, getContext: () => ({ getImageData: () => ({ data }) }) };
  assert.equal(lifted.autoLevelsFrom(canvas, lifted.paramsFrom({})), null);
});

test('auto levels: measures the picture after exposure, the stage before Levels', () => {
  // A grey ramp from 64 to 128, 100 pixels wide and 10 tall, so every level
  // holds more pixels than the 0.1% clip and the extremes are exact.
  const data = new Uint8ClampedArray(100 * 10 * 4);
  for (let i = 0; i < 1000; i++) {
    const v = Math.round(64 + 64 * (i % 100) / 99);
    data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255;
  }
  const canvas = { width: 100, height: 10, getContext: () => ({ getImageData: () => ({ data }) }) };
  const plain = lifted.autoLevelsFrom(canvas, lifted.paramsFrom({}));
  const brighter = lifted.autoLevelsFrom(canvas, lifted.paramsFrom({ exposure: 1 }));
  assert.deepEqual(plain[0], [64 / 255, 128 / 255]);
  assert.ok(brighter[0][0] > 64 / 255 && brighter[0][1] > 128 / 255, JSON.stringify(brighter));
});

test('auto levels: the measured stretch is a stage of the look and part of its key', () => {
  const P = lifted.paramsFrom({ levelsAuto: true });
  const before = lifted.colorKey(P, {});
  P.autoLevels = [[0.25, 0.75], [0, 1], [0, 1]];
  assert.notEqual(lifted.colorKey(P, {}), before, 'the cache and video look re-key on a new measurement');
  const fn = lifted.makeColorFn(P, {}, null);
  const [r, g, b] = fn(0.25, 0.5, 0.75);
  assert.ok(Math.abs(r) < 1e-9, 'red at its measured black becomes black');
  assert.ok(Math.abs(g - 0.5) < 1e-9 && Math.abs(b - 0.75) < 1e-9, 'unstretched channels hold');
  assert.ok(Math.abs(fn(0.75, 0, 0)[0] - 1) < 1e-9, 'red at its measured white becomes white');
});

test('auto levels: headless there is no picture, so the switch stays on and the bake is plain', async () => {
  const { host, delivered } = makeHost();
  const rt = await createRuntime(tool, host, {});
  await rt.setInput('levelsAuto', true as any);
  assert.equal(value(rt, 'levelsAuto'), true, 'a mode, not a one-shot action');
  await rt.setInput('bakeLut', true as any);
  assert.equal(delivered.length, 1, 'the bake is still delivered');
  const mid = (await delivered[0]!.blob.text()).split('\n').filter(l => /^\d/.test(l))[(16 * 33 + 16) * 33 + 16]!;
  for (const c of mid.split(' ').map(Number)) assert.ok(Math.abs(c - 0.5) < 0.005, `identity mid-grey (${c})`);
});
