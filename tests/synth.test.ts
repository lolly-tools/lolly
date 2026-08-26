// SPDX-License-Identifier: MPL-2.0
/**
 * Synth (community/synth) - WP-A (the harness and the `ink` scene) and WP-B
 * (audio reactivity).
 *
 * Loads the REAL tool from the community pack and drives it through the engine,
 * so every assertion is about what the tool actually folds and ships.
 *
 * What is pinned here:
 *  - the whole input model folds into ONE `_state` extra, still parseable JSON
 *    after the `<` escaping that makes it safe inside a <script> tag;
 *  - every user-settable value is clamped in hooks, because the sim is fed
 *    straight off a URL (a hostile ?intensity=1e9 has to die at the door);
 *  - the emitter table is a pure function of the seed - same seed, same piece;
 *  - the canvas-tool lifecycle contract is present: per-paint IIFE, dispose of
 *    the previous instance, preserveDrawingBuffer, the ready signal, the frame
 *    clock ON THE CANVAS (never a window global), NO data-capture-stream (it
 *    bypasses that clock), the __lollyFrameDriven bail, release on detach, and no
 *    wall-clock or device probe in the sim source;
 *  - WP-B: the clip is analysed ONCE and cached by asset id, the Signals mapping
 *    is pure and reproducible frame for frame, a null bpm idles the beat phase
 *    rather than inventing a tempo, and the export takes its length from the
 *    clip it is carrying as a soundtrack.
 *
 * What is deliberately NOT pinned: pixels. The sim runs on the GPU, and
 * cross-device float divergence means "deterministic" is stable on one
 * device/driver, not bit-identical across GPUs (the butterchurn posture). These
 * tests therefore assert structure and same-input reproducibility of the CPU-side
 * signals; a rendered frame is compared only against ANOTHER frame from the same
 * context, and only in a browser probe, never here as a golden image.
 *
 * Run with: node --test tests/synth.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';

// The SOURCE pack, not the gitignored tools/ profile view, so the suite is
// profile-independent: skip only when community/ is not checked out.
const COMMUNITY = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const DIR = join(COMMUNITY, 'synth');
const fetchFile = (path: string) => readFile(join(COMMUNITY, path), 'utf8');

const PACK_MOUNTED = existsSync(COMMUNITY);
const SKIP = !PACK_MOUNTED && 'community pack not mounted (clone without submodules)';
if (PACK_MOUNTED) {
  assert.ok(existsSync(join(DIR, 'tool.json')),
    'community/synth/tool.json is missing - pack is mounted, so the tool was renamed or deleted');
}

const tool: any = SKIP ? null : await loadTool('synth', fetchFile);

const TEMPLATE = PACK_MOUNTED ? readFileSync(join(DIR, 'template.html'), 'utf8') : '';
const LIB = PACK_MOUNTED ? readFileSync(join(DIR, 'lib', 'synth.js'), 'utf8') : '';
const HOOKS = PACK_MOUNTED ? readFileSync(join(DIR, 'hooks.js'), 'utf8') : '';

/** The banned-construct scans are about CODE. A comment saying "never
 *  Math.random" is the rule being documented, not broken. */
const code = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

/** Render the tool and hand back the parsed `_state` the template embeds. */
async function state(values: Record<string, any> = {}): Promise<any> {
  const rt = await createRuntime(tool, baseHost(), values);
  const html = rt.getHydrated() as string;
  const m = html.match(/id="synth-state">([\s\S]*?)<\/script>/);
  assert.ok(m, '_state was not embedded in the template');
  return JSON.parse(String(m![1]));
}

/** The hooks' own helpers, evaluated exactly as the runtime loads them. Each
 *  call is a FRESH module instance, so the analysis cache never leaks between
 *  tests. */
function hookHelpers(): any {
  const f = new Function(
    `${HOOKS}\nreturn { emitters: _emitters, rnd: _mulberry32, compute: _compute, beforeExport: beforeExport, plan: _plan };`,
  ) as () => any;
  return f();
}

/** The lib's pure surface, loaded without a GL context (there is none in Node). */
const lib: any = PACK_MOUNTED ? new Function('window', `${LIB}\nreturn window.LollySynth;`)({}) : null;

/**
 * A synthetic AudioAnalysis matching the host.audio contract exactly.
 * Every track is a different repeating ramp, so a mapping that reads the wrong
 * section of the payload produces visibly wrong numbers rather than plausible
 * ones.
 */
function fakeAnalysis(opts: { count?: number; fps?: number; bands?: number; bpm?: number | null } = {}): any {
  const fps = opts.fps ?? 24;
  const bands = opts.bands ?? 32;
  const count = opts.count ?? 120;
  const bpm = opts.bpm === undefined ? 120 : opts.bpm;
  const ramp = (period: number) => Float32Array.from({ length: count }, (_, i) => (i % period) / period);
  const secs = count / fps;
  return {
    duration: secs, sampleRate: 48000, channels: 1, start: 0, window: secs, fps,
    peaks: new Float32Array(8),
    frames: {
      count, bands, samples: 0,
      t: Float32Array.from({ length: count }, (_, i) => i / fps),
      rms: ramp(10), peak: ramp(4), bass: ramp(7), mid: ramp(5), treb: ramp(3),
      centroid: ramp(9), flux: ramp(13),
      magnitude: Float32Array.from({ length: count * bands }, (_, k) => ((k * 37) % 251) / 251),
      wave: new Uint8Array(0), waveL: new Uint8Array(0), waveR: new Uint8Array(0),
    },
    bpm,
    beats: bpm === null
      ? new Float32Array(0)
      : Float32Array.from({ length: Math.floor(secs * (bpm / 60)) }, (_, i) => (i * 60) / bpm),
  };
}

/** A host whose audio API answers with one fixed analysis, and records the calls. */
function audioHost(analysis: any = fakeAnalysis()): { host: any; calls: any[] } {
  const calls: any[] = [];
  const host = baseHost({
    audio: {
      isAvailable: () => true,
      analyse: async (src: unknown, o: any) => { calls.push({ src, opts: o }); return { ...analysis, fps: o.fps, frames: { ...analysis.frames, bands: o.bands } }; },
    },
  });
  return { host, calls };
}

const CLIP = { id: 'user/audio/clip', url: 'asset:user/audio/clip' };

/** Render with a picked clip and hand back the parsed `_state`. */
async function audioState(host: any, values: Record<string, any> = {}): Promise<any> {
  const rt = await createRuntime(tool, host, { audio: CLIP, ...values });
  const html = rt.getHydrated() as string;
  const m = html.match(/id="synth-state">([\s\S]*?)<\/script>/);
  assert.ok(m, '_state was not embedded in the template');
  return JSON.parse(String(m![1]));
}

/** Every Signals record the deterministic path reads over `frames` sim frames. */
function sweep(track: any, frames: number): unknown[] {
  const out: unknown[] = [];
  for (let f = 0; f < frames; f++) {
    const s = lib.signalsAt(track, f / lib.SIM_HZ);
    out.push({ ...s, spectrum: Array.from(s.spectrum as Float32Array) });
  }
  return out;
}

test('folds the whole model into one parseable _state extra', { skip: SKIP }, async () => {
  const s = await state();
  assert.equal(s.scene, 'ink');
  assert.equal(s.width, 1280);
  assert.equal(s.height, 720);
  assert.equal(s.colors.length, 3);
  for (const c of s.colors) assert.match(c, /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, `not a colour: ${c}`);
  assert.equal(s.emitters.length, 7);
  assert.equal(typeof s.live, 'boolean');
});

test('the embedded JSON carries no raw < (it sits inside a <script> tag)', { skip: SKIP }, async () => {
  const rt = await createRuntime(tool, baseHost(), { color1: '#123456' });
  const html = rt.getHydrated() as string;
  const raw = String(html.match(/id="synth-state">([\s\S]*?)<\/script>/)![1]);
  assert.ok(!raw.includes('<'), 'a raw < inside the JSON would end the script element early');
});

test('every user-settable value is clamped in hooks', { skip: SKIP }, async () => {
  const hostile = await state({
    intensity: 1e9, speed: -50, seed: 1e12,
    scene: '__proto__', color1: 'url(javascript:alert(1))', color2: '', color3: '#abc',
  });
  assert.equal(hostile.intensity, 2, 'intensity clamps to its declared max');
  assert.equal(hostile.speed, 0.05, 'speed clamps to a positive floor');
  assert.equal(hostile.seed, 999999, 'seed clamps to its declared range');
  assert.equal(hostile.scene, 'ink', 'an unknown scene falls back rather than reaching the shader');
  assert.equal(hostile.colors[0], '#30ba78', 'a non-hex colour falls back');
  assert.equal(hostile.colors[2], '#abc', 'a short hex is accepted');

  const junk = await state({ intensity: 'x', speed: null, seed: 'NaN' });
  assert.equal(junk.intensity, 1.35);
  assert.equal(junk.speed, 1);
  assert.equal(junk.seed, 7);

  const low = await state({ intensity: -1, speed: 1e9, seed: -5 });
  assert.equal(low.intensity, 0);
  assert.equal(low.speed, 4);
  assert.equal(low.seed, 0);
});

test('an unknown scene never reaches the state as a prototype key', { skip: SKIP }, async () => {
  for (const bad of ['constructor', 'toString', 'hasOwnProperty']) {
    assert.equal((await state({ scene: bad })).scene, 'ink', `${bad} must not pass the enum guard`);
  }
});

test('the emitter table is a pure function of the seed', { skip: SKIP }, () => {
  const { emitters, rnd } = hookHelpers();
  assert.deepEqual(emitters(1234, 5), emitters(1234, 5), 'same seed, same emitters');
  assert.notDeepEqual(emitters(1234, 5), emitters(1235, 5), 'a different seed is a different piece');

  // Two independent generators from one seed agree - the PRNG carries no shared
  // state, so a second render in the same session cannot drift from the first.
  const a = rnd(99), b = rnd(99);
  for (let i = 0; i < 16; i++) assert.equal(a(), b());

  for (const e of emitters(7, 5)) {
    assert.ok(e.x > 0 && e.x < 1 && e.y > 0 && e.y < 1, 'emitters sit inside the field');
    assert.equal(e.turns, Math.round(e.turns), 'orbits per loop must be whole, or the loop has a seam');
    assert.ok(e.turns >= 1, 'an emitter that never orbits injects a static blob');
    assert.ok(e.tone >= 0 && e.tone <= 1, 'tone indexes the OKLab ramp');
  }
});

test('the same seed folds to the same state twice', { skip: SKIP }, async () => {
  assert.deepEqual(await state({ seed: 4242 }), await state({ seed: 4242 }));
});

test('the manifest declares the export shape WP-A needs, and no capability it does not use', { skip: SKIP }, () => {
  const m = JSON.parse(readFileSync(join(DIR, 'tool.json'), 'utf8'));
  assert.equal(m.status, 'experimental', 'experimental forces the disclosed export watermark');
  // A capability is a hard GATE, not a stub: a shell that cannot fulfil one refuses
  // the whole tool (the CLI exits 3), so declaring `camera` for the camera scene
  // would take ink, swarm and field away from every shell without a camera. The
  // schema says so of onFrame in as many words - "Pure progressive enhancement ...
  // it must NOT be declared as a required 'camera' capability" - and the camera
  // scene is written to that rule: it reads host.media when there is one and says
  // so on the canvas when there is not.
  assert.ok(!m.capabilities, 'the camera scene is progressive enhancement, so no capability may be declared');
  const schema = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'schemas', 'tool.schema.json'), 'utf8'));
  assert.match(schema.properties.hooks.properties.onFrame.description, /must NOT be declared as a required 'camera' capability/,
    'this test rests on that schema rule - if it moved, re-read it before changing the manifest');
  // The mic and screen APIs are the ones that DO need declaring, and nothing here
  // touches them. host.media is reached only through the runtime's onFrame hook.
  for (const src of [LIB, HOOKS, TEMPLATE]) {
    assert.ok(!/host\.recorder|getUserMedia|getDisplayMedia|navigator\.mediaDevices/.test(code(src)),
      'a mic, screen or direct-device call needs its capability declared alongside it');
  }
  for (const f of ['png', 'gif', 'webm']) assert.ok(m.render.formats.includes(f), `missing format ${f}`);
  assert.ok(!m.inputs.some((i: any) => i.id === 'width' || i.id === 'height'),
    'width/height are RESERVED url params and must never be declared as inputs');
});

test('the canvas-tool lifecycle contract is wired', { skip: SKIP }, () => {
  assert.match(TEMPLATE, /^\(function \(\) \{/m, 'the script body must be a per-paint IIFE');
  assert.ok(!/^\s*(let|const) /m.test(TEMPLATE.split('<script>')[1] ?? ''),
    'top-level let/const would throw on the second paint of the same document');
  assert.match(TEMPLATE, /__lollySynthEpoch/, 'a stale async callback from a prior paint must be droppable');
  assert.match(TEMPLATE, /window\.__lollySynth\.dispose/, 'the previous instance must be disposed - GL contexts cap around 16');
  assert.match(TEMPLATE, /window\.__toolHasReadySignal = true/, 'without the ready signal the export captures a blank frame');
  assert.match(TEMPLATE, /new CustomEvent\('tool:ready'\)/);
  // data-capture-stream would opt video into the real-time MediaRecorder path,
  // which returns before the frame source is built and so never calls the frame
  // clock: the picture would be recorded at whatever phase the live loop had
  // reached while the muxed soundtrack started at 0:00.
  assert.ok(!/<canvas[^>]*data-capture-stream/.test(TEMPLATE),
    'real-time stream capture bypasses the frame clock, so the picture drifts against the bed');
  assert.match(TEMPLATE, /canvas\.__lollyFrameRender = /, 'the frame clock lives on the canvas');
  assert.ok(!/window\.__lollyFrameRender/.test(TEMPLATE),
    'a window-global frame clock leaks across SPA tool navigation and drives an unrelated tool');
});

test('the sim library holds the load-bearing GL contract', { skip: SKIP }, () => {
  assert.match(LIB, /preserveDrawingBuffer: true/,
    'without preserveDrawingBuffer every raster and video export is silently blank');
  assert.match(LIB, /canvas\.__lollyFrameDriven/, 'the live loop must bail while the exporter drives frames');
  assert.match(LIB, /resumeOwed/, 'the live clock owes one swallowed delta after a driven export');
  assert.match(LIB, /WEBGL_lose_context/, 'dispose must release the context, not wait for collection');
  // The tool view's teardown has no hook for a disposer a template registered, so
  // the loop has to notice its own canvas going away or it solves forever.
  assert.match(LIB, /if \(!canvas\.isConnected\) \{ disposeAll\(\); return; \}/,
    'the live loop must release the GL context when its canvas is detached');
  assert.ok(!/webgpu/i.test(code(LIB)), 'WebGPU canvases export blank - WP-A is WebGL2 only');
});

test('the internal field is a pure function of the output size, and never outgrows it', { skip: SKIP }, () => {
  for (const [w, h] of [[1280, 720], [720, 1280], [512, 512], [64, 48]] as [number, number][]) {
    const s = lib.fieldSizes(w, h);
    for (const box of [s.sim, s.dye]) {
      assert.ok(box[0] >= 32 && box[1] >= 32, `${w}x${h}: a degenerate field renders nothing`);
      assert.ok(box[0] <= Math.max(w, 32) && box[1] <= Math.max(h, 32),
        `${w}x${h}: simulating more cells than pixels is pure waste`);
    }
    assert.ok(s.dye[0] >= s.sim[0], 'dye carries the detail, velocity does not');
  }
  // A different grid is a different simulation, so the grid may not depend on the
  // device: keying it on devicePixelRatio > 1.5 made every Retina Mac render a
  // materially different piece from the same URL.
  assert.deepEqual(lib.fieldSizes(1280, 720, 2), lib.fieldSizes(1280, 720, 1));
  assert.ok(!/devicePixelRatio/.test(code(LIB)), 'the sim must not read a device probe');
});

test('clip time spans the WHOLE clip, however long, however the loop is capped', { skip: SKIP }, () => {
  // 180 s of audio: the frame count clamps at 3600, so mapping by frame index
  // (f / SIM_HZ) would stop at 60 s and drop the last two minutes of the track.
  const frames = 3600, secs = 180;
  assert.equal(lib.clipTime(0, frames, secs), 0, 'the loop opens on the clip');
  assert.ok(Math.abs(lib.clipTime(frames - 1, frames, secs) - (secs - secs / frames)) < 1e-9,
    'the last frame of the loop is the last of the clip');
  assert.ok(Math.abs(lib.clipTime(frames / 2, frames, secs) - secs / 2) < 1e-9, 'halfway is halfway');
  assert.ok(lib.clipTime(-150, frames, secs) < 0, 'warm-up frames sit before the clip and clamp in signalsAt');
  // No loop declared yet (live preview): sim rate, which is where a wrap belongs.
  assert.equal(lib.clipTime(120, 0, 0), 2);
});

test('the state carries the fallback loop length gif/apng render against', { skip: SKIP }, async () => {
  const m = JSON.parse(readFileSync(join(DIR, 'tool.json'), 'utf8'));
  const s = await state();
  // Only the video path passes clipSec to the frame clock; the animated stills
  // call with the phase alone, and a fixed guess in the lib played the loop in
  // slow motion (a 6 s GIF showing 2 s of sim).
  assert.equal(s.durationSec, m.render.video.duration,
    'the manifest default has to reach the lib - a lib cannot read a manifest');
  assert.ok(/loopSecs \|\| \(track && track\.dur > 0 \? track\.dur : defaultSecs\)/.test(LIB),
    'the fallback is the last declared length, then the clip, then the manifest default');
});

/* ── WP-B: audio reactivity ───────────────────────────────────────────────── */

test('a picked clip is analysed once and packed into the state', { skip: SKIP }, async () => {
  const { host, calls } = audioHost();
  const s = await audioState(host);
  assert.equal(calls.length, 1, 'the clip is analysed once, not once per input');
  assert.equal(calls[0].opts.bands, 32, 'the spectrum contract is 32 bins');
  assert.ok(calls[0].opts.fps > 0 && calls[0].opts.fps <= 24);
  assert.equal(s.audio.count, 120);
  assert.equal(s.audio.bands, 32);
  assert.equal(s.audio.bpm, 120);
  assert.ok(s.audio.beats.length > 0);
  assert.ok(s.audio.data.length > 0);
  assert.ok(!s.audio.data.includes('<'), 'the payload sits inside a <script> tag');
});

test('the clip is decoded once, not once per input change', { skip: SKIP }, async () => {
  const { host, calls } = audioHost();
  const rt = await createRuntime(tool, host, { audio: CLIP });
  assert.equal(calls.length, 1);
  await rt.setInput('intensity', 1.5);
  await rt.setInput('speed', 2);
  assert.equal(calls.length, 1, 'the analysis is cached by asset id - a slider drag re-folds, it does not re-decode');

  // Two folds racing the same cold decode share the one in-flight analysis.
  const hooks = hookHelpers();
  let settle: (a: unknown) => void = () => {};
  let started = 0;
  const slow = baseHost({
    audio: {
      isAvailable: () => true,
      analyse: () => { started++; return new Promise((res) => { settle = res; }); },
    },
  });
  const model = [{ id: 'audio', value: CLIP }];
  const both = Promise.all([hooks.compute(model, slow), hooks.compute(model, slow)]);
  await Promise.resolve();  // the analyse call is one microtask deep
  assert.equal(started, 1, 'a second fold joins the decode already running');
  settle(fakeAnalysis());
  for (const out of await both) assert.ok(JSON.parse((out as any)._state).audio, 'both folds see the track');
});

test('the packed track has a real ceiling, at every clip length', { skip: SKIP }, () => {
  const { plan } = hookHelpers();
  // The payload is embedded in _state and un-base64'd on every paint, so its size
  // is a hard budget. A rate floor alone is not a ceiling: it leaves the frame
  // count growing linearly with length again.
  for (const sec of [0.5, 5, 60, 75, 300, 450, 1800, 3600, 36000]) {
    const p = plan(sec);
    assert.ok(p.fps >= 1 && p.fps <= 24, `${sec}s: fps ${p.fps} is outside the analyse contract`);
    assert.ok(p.window <= sec + 1e-9, `${sec}s: cannot analyse more than there is`);
    assert.ok(p.fps * p.window <= 1800 + 1e-6, `${sec}s packs ${p.fps * p.window} frames`);
  }
  const blind = plan(0);   // length not known yet - the pass that finds it out
  assert.ok(blind.fps * blind.window <= 1800 + 1e-6, 'the first pass is bounded too');
});

test('a long clip is re-analysed once, at a rate that fits, and never a third time', { skip: SKIP }, async () => {
  const hooks = hookHelpers();
  const calls: any[] = [];
  const host = baseHost({
    audio: {
      isAvailable: () => true,
      analyse: async (_src: unknown, o: any) => {
        calls.push(o);
        const win = Math.min(o.window, 600);           // a 10-minute mix
        const a = fakeAnalysis({ count: Math.round(o.fps * win), fps: o.fps });
        a.duration = 600; a.window = win;
        return a;
      },
    },
  });
  const s = JSON.parse((await hooks.compute([{ id: 'audio', value: CLIP }], host))._state);
  assert.equal(calls.length, 2, 'a bounded first pass finds the length, the second reads the clip');
  assert.ok(calls[0].fps * calls[0].window <= 1800, 'the blind pass cannot decode an hour at 24fps');
  assert.equal(calls[1].window, 600, 'the second pass covers the whole clip');
  assert.ok(calls[1].fps * calls[1].window <= 1800, 'at a rate that fits the ceiling');
  assert.ok(s.audio.count <= 1800, `packed ${s.audio.count} frames`);
});

test('no clip leaves the scene un-reactive rather than failing', { skip: SKIP }, async () => {
  const { host, calls } = audioHost();
  const s = await audioState(host, { audio: null });
  assert.equal(calls.length, 0, 'nothing to analyse, nothing decoded');
  assert.ok(!s.audio, 'no track in the state');
  assert.deepEqual(lib.unpackAudio(undefined), null);
  const idle = lib.signalsAt(null, 3);
  for (const k of ['rms', 'bass', 'mid', 'treble', 'onset', 'beatPhase']) {
    assert.equal(idle[k], 0, `${k} idles with no audio`);
  }
  assert.equal(idle.spectrum.length, 32);
});

test('the signals mapping is pure and reads the payload it was handed', { skip: SKIP }, async () => {
  const analysis = fakeAnalysis();
  const s = await audioState(audioHost(analysis).host);
  const track = lib.unpackAudio(s.audio);
  assert.ok(track, 'the packed payload must decode');

  // Byte quantisation is the only thing between the analysis and the record.
  const q = (v: number) => Math.round(v * 255) / 255;
  for (const i of [0, 1, 37, 119]) {
    const sig = lib.signalsAt(track, i / track.fps);
    assert.equal(sig.rms, q(analysis.frames.rms[i]), `rms at frame ${i}`);
    assert.equal(sig.bass, q(analysis.frames.bass[i]), `bass at frame ${i}`);
    assert.equal(sig.mid, q(analysis.frames.mid[i]), `mid at frame ${i}`);
    assert.equal(sig.treble, q(analysis.frames.treb[i]), `treble at frame ${i}`);
    assert.equal(sig.onset, q(analysis.frames.flux[i]), `onset at frame ${i}`);
    assert.equal(sig.spectrum.length, 32);
  }

  // Pure: same track, same time, same numbers.
  assert.deepEqual(lib.signalsAt(track, 1.5), lib.signalsAt(track, 1.5));

  // Both ends clamp: warm-up frames before the clip read its first frame, and a
  // picture longer than its soundtrack holds the last one.
  assert.deepEqual(lib.signalsAt(track, -99), lib.signalsAt(track, 0));
  assert.deepEqual(lib.signalsAt(track, 1e6), lib.signalsAt(track, (track.count - 1) / track.fps));
});

test('the same analysis and the same seed replay identical per-frame signals', { skip: SKIP }, async () => {
  const a = await audioState(audioHost().host, { seed: 4242 });
  const b = await audioState(audioHost().host, { seed: 4242 });
  assert.deepEqual(a, b, 'the whole fold, audio payload included, is reproducible');
  assert.deepEqual(sweep(lib.unpackAudio(a.audio), 300), sweep(lib.unpackAudio(b.audio), 300),
    'every sim frame of the deterministic path reads the same signals twice');
});

test('bpm null means no rhythm - the beat phase idles and 120 is never invented', { skip: SKIP }, async () => {
  const s = await audioState(audioHost(fakeAnalysis({ bpm: null })).host);
  assert.equal(s.audio.bpm, null, 'null is a real answer and is carried through');
  assert.deepEqual(s.audio.beats, []);
  const track = lib.unpackAudio(s.audio);
  assert.equal(track.bpm, null);
  for (let f = 0; f < 300; f++) {
    assert.equal(lib.signalsAt(track, f / lib.SIM_HZ).beatPhase, 0, `frame ${f} must not pulse`);
  }
  for (const [name, raw] of [['lib/synth.js', LIB], ['hooks.js', HOOKS]] as const) {
    assert.ok(!/bpm[^\n]*\b120\b|\b120\b[^\n]*bpm/.test(code(raw)),
      `${name}: a default tempo would put every accent in the wrong place`);
  }
});

test('a tempo drives a phase that rises from each beat to the next', { skip: SKIP }, async () => {
  const s = await audioState(audioHost().host);
  const track = lib.unpackAudio(s.audio);
  const beat = track.beats[2];
  const period = track.beats[3] - beat;
  assert.equal(lib.signalsAt(track, beat).beatPhase, 0, 'the phase restarts on the beat');
  assert.ok(Math.abs(lib.signalsAt(track, beat + period / 2).beatPhase - 0.5) < 1e-6, 'halfway is half a phase');
  assert.ok(lib.signalsAt(track, beat + period * 0.99).beatPhase > 0.98);
  // Outside the detected beats there is nothing to be in phase with.
  assert.equal(lib.signalsAt(track, track.beats[track.beats.length - 1] + 1).beatPhase, 0);
});

test('a payload that disagrees with its own header is refused, not animated around', { skip: SKIP }, () => {
  assert.equal(lib.unpackAudio(null), null);
  assert.equal(lib.unpackAudio({ count: 10, bands: 32, fps: 24, data: '' }), null);
  assert.equal(lib.unpackAudio({ count: 999, bands: 32, fps: 24, data: 'AAAA' }), null, 'a truncated payload');
  assert.equal(lib.unpackAudio({ count: 0, bands: 32, fps: 24, data: 'AAAA' }), null);
  // A bpm that is not a positive finite number is no bpm at all.
  for (const bpm of [0, -30, 'fast', undefined, NaN]) {
    const t = lib.unpackAudio({ count: 1, bands: 1, fps: 24, bpm, data: 'AAAAAAAA' });
    assert.equal(t.bpm, null, `bpm ${String(bpm)} must not become a beat grid`);
  }
});

test('the export runs the length of the clip, unless the user said otherwise', { skip: SKIP }, async () => {
  const hooks = hookHelpers();
  const { host } = audioHost(fakeAnalysis({ count: 240, fps: 24 })); // a 10s clip
  const model = [{ id: 'audio', value: CLIP }, { id: 'seed', value: 7 }];
  await hooks.compute(model, host);

  const vid: any = { format: 'webm', opts: {} };
  hooks.beforeExport(vid);
  assert.equal(vid.opts.duration, 10, 'the picture and its soundtrack end together');

  const chosen: any = { format: 'mp4', opts: { duration: 3, durationUserSet: true } };
  hooks.beforeExport(chosen);
  assert.equal(chosen.opts.duration, 3, 'a duration the user typed is an instruction');

  const still: any = { format: 'png', opts: {} };
  hooks.beforeExport(still);
  assert.ok(!('duration' in still.opts), 'a still has no duration to set');

  // No clip: the manifest's own default stands, because the forcing is periodic
  // at any length.
  const fresh = hookHelpers();
  await fresh.compute([{ id: 'seed', value: 7 }], baseHost());
  const none: any = { format: 'gif', opts: {} };
  fresh.beforeExport(none);
  assert.ok(!('duration' in none.opts));
});

test('the manifest carries the audio slot the export bed is read from', { skip: SKIP }, () => {
  const m = JSON.parse(readFileSync(join(DIR, 'tool.json'), 'utf8'));
  const audio = m.inputs.find((i: any) => i.id === 'audio');
  assert.ok(audio, 'the audio input is missing');
  assert.equal(audio.type, 'asset');
  assert.equal(audio.assetType, 'audio',
    'the shell finds a tool\'s export soundtrack by type asset + assetType audio');
  assert.equal(m.hooks.beforeExport, true, 'the clip length reaches the export through beforeExport');
});

/* ── WP-C: the swarm ──────────────────────────────────────────────────────── */

const GROWTH = join(COMMUNITY, 'growth', 'hooks.js');

/** A host that outlines any text as a stand-in "O" - the outer contour plus its
 *  counter, the two subpaths a real host.text.toPath returns for that glyph. */
function textHost(d = 'M0,0L200,0L200,200L0,200ZM60,60L60,140L140,140L140,60Z'): any {
  return baseHost({
    tokens: { resolve: async () => 'Stub Sans' },
    text: {
      fontUrl: async () => ({ url: 'font:stub' }),
      toPath: async () => ({ d, advanceWidth: 200, bbox: { x1: 0, y1: 0, x2: 200, y2: 200 }, notdef: 0 }),
    },
  });
}

/** The parsed `_state` for a swarm render. */
async function swarmState(host: any, values: Record<string, any> = {}): Promise<any> {
  const rt = await createRuntime(tool, host, { scene: 'swarm', ...values });
  const html = rt.getHydrated() as string;
  const m = html.match(/id="synth-state">([\s\S]*?)<\/script>/);
  assert.ok(m, '_state was not embedded in the template');
  return JSON.parse(String(m![1]));
}

/**
 * A recording stand-in for a WebGL2 context. Every ALL_CAPS read is a distinct
 * enum, every other read is a call recorder - which is the whole context surface
 * the lib touches, without a GPU. It cannot say whether a shader compiles (that
 * is the browser tier's job); it CAN say exactly which GL objects were created
 * and which were released, which is what a leaked context is made of.
 */
function fakeGl(): { gl: any; calls: { m: string; a: any[] }[]; made: any[] } {
  const calls: { m: string; a: any[] }[] = [];
  const consts: Record<string, number> = {};
  const fns: Record<string, any> = {};
  const made: any[] = [];
  let next = 1;
  const gl: any = new Proxy({}, {
    get(_t, prop: string | symbol) {
      if (typeof prop !== 'string') return undefined;
      if (/^[A-Z][A-Z0-9_]*$/.test(prop)) {
        if (!(prop in consts)) consts[prop] = next++;
        return consts[prop];
      }
      if (!fns[prop]) {
        fns[prop] = (...a: any[]) => {
          calls.push({ m: prop, a });
          if (prop === 'getExtension') return { loseContext: () => calls.push({ m: 'loseContext', a: [] }) };
          if (prop === 'getShaderParameter') return true;
          if (prop === 'getProgramParameter') return a[1] === consts.ACTIVE_UNIFORMS ? 0 : true;
          if (prop.startsWith('create')) { const o = { kind: prop, id: made.length }; made.push(o); return o; }
          return null;
        };
      }
      return fns[prop];
    },
  });
  return { gl, calls, made };
}

function fakeCanvas(gl: any): any {
  return {
    width: 0, height: 0, isConnected: true,
    getContext: () => gl,
    addEventListener() {}, removeEventListener() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
  };
}

/** A second lib instance whose realm has a rAF, so create() can arm its loop. */
function glLib(): any {
  return new Function('window', `${LIB}\nreturn window.LollySynth;`)({
    requestAnimationFrame: () => 1, cancelAnimationFrame: () => {},
  });
}

function mount(cfg: any): { inst: any; calls: { m: string; a: any[] }[]; made: any[] } {
  const { gl, calls, made } = fakeGl();
  return { inst: glLib().create(fakeCanvas(gl), cfg), calls, made };
}

test('the swarm is a real scene option and folds a sampled target set', { skip: SKIP }, async () => {
  const m = JSON.parse(readFileSync(join(DIR, 'tool.json'), 'utf8'));
  const scene = m.inputs.find((i: any) => i.id === 'scene');
  // The whole list is pinned by the WP-D test below; this one owns the swarm.
  assert.ok(scene.options.some((o: any) => o.value === 'swarm'));
  assert.equal((await state({ scene: 'ink' })).scene, 'ink', 'the ink scene is untouched');

  const s = await swarmState(textHost(), { text: 'O' });
  assert.equal(s.scene, 'swarm');
  assert.equal(s.targets.count, 2048, 'the point budget is fixed, not a function of the source');
  assert.ok(!s.targets.data.includes('<'), 'the payload sits inside a <script> tag');
  const t = lib.unpackTargets(s.targets);
  assert.equal(t.count, 2048);
  assert.equal(t.uv.length, 4096);
  for (let i = 0; i < t.uv.length; i++) assert.ok(t.uv[i] >= 0 && t.uv[i] <= 1, `target ${i} left the frame`);
  // The traced "O" is square, so a 16:9 frame must not stretch it: the fit is
  // computed in units of the shorter side and only then divided into uv x.
  let minX = 1, maxX = 0, minY = 1, maxY = 0;
  for (let i = 0; i < t.uv.length; i += 2) {
    minX = Math.min(minX, t.uv[i]); maxX = Math.max(maxX, t.uv[i]);
    minY = Math.min(minY, t.uv[i + 1]); maxY = Math.max(maxY, t.uv[i + 1]);
  }
  assert.ok(Math.abs((maxX - minX) * (1280 / 720) - (maxY - minY)) < 0.01, 'the outline was stretched by the frame');

  // The logo path is the other source. No document in Node, so it cannot
  // rasterise - and the fallback is a ring, never a blank canvas.
  const withLogo = await swarmState(textHost(), { text: 'O', logo: { id: 'brand/logo', url: 'asset:brand/logo' } });
  assert.equal(withLogo.targets.count, 2048);
  assert.notDeepEqual(withLogo.targets.data, s.targets.data, 'a picked logo takes over from the headline');
});

test('target sampling is deterministic - same source, same points', { skip: SKIP }, async () => {
  // A FRESH module each time, so the answer is re-derived rather than read back
  // out of the sampling cache.
  const a = await swarmState(textHost(), { text: 'ABC', seed: 11 });
  const b = await swarmState(textHost(), { text: 'ABC', seed: 11 });
  assert.deepEqual(a, b, 'the whole fold, sampled targets included, is reproducible');

  // Different source, different points - otherwise the "determinism" above would
  // just be a constant.
  const c = await swarmState(textHost('M0,0L100,0L100,300L0,300Z'), { text: 'ABC', seed: 11 });
  assert.notDeepEqual(c.targets.data, a.targets.data);

  // No font resolver at all: the ring, not a failure and not a blank canvas.
  const ring = await swarmState(baseHost(), { text: 'ABC' });
  assert.equal(ring.targets.count, 2048);
  assert.deepEqual(ring.targets.data, (await swarmState(baseHost(), { text: 'ABC' })).targets.data);
  // A ring is what an empty headline draws too, so it must be the SAME ring.
  assert.deepEqual((await swarmState(textHost(), { text: '   ' })).targets.data, ring.targets.data);
});

test('the sampling constants are the ones community/growth traces a logo with', { skip: SKIP }, () => {
  // Sampled positions are part of the visual contract a shared URL replays, and
  // the two tools claim to sample the same way. Reading both files is the only
  // thing that keeps that claim true.
  const growth = readFileSync(GROWTH, 'utf8');
  const val = (src: string, name: string): string => {
    const m = src.match(new RegExp(`var ${name} = ([^;]+);`));
    assert.ok(m, `${name} is missing`);
    return String(m![1]).trim();
  };
  for (const [here, there] of [
    ['TARGET_RASTER', 'LOGO_RASTER'], ['TARGET_ALPHA', 'LOGO_ALPHA'],
    ['TARGET_LUMA', 'LOGO_LUMA'], ['TARGET_STRIDE', 'LOGO_STRIDE'],
  ] as const) {
    assert.equal(val(HOOKS, here), val(growth, there), `${here} drifted from growth's ${there}`);
  }
});

test('the particle count is clamped, in the hooks AND in the lib', { skip: SKIP }, async () => {
  assert.equal((await swarmState(baseHost(), { particles: 1e9 })).particles, 200000);
  assert.equal((await swarmState(baseHost(), { particles: -5 })).particles, 1000);
  assert.equal((await swarmState(baseHost(), { particles: 'lots' })).particles, 160000);
  assert.equal((await swarmState(baseHost(), { particles: 4321.6 })).particles, 4322, 'a count has to be whole');

  // The lib clamps again on its own, because _state can be hand-written: it is
  // JSON in the page, and the count sizes two GPU buffers.
  const cfg = await swarmState(baseHost());
  assert.equal(mount({ ...cfg, particles: 1e9 }).inst.swarm.count, lib.MAX_PARTICLES);
  assert.equal(mount({ ...cfg, particles: 0 }).inst.swarm.count, lib.PARTICLE_MIN);
  assert.equal(mount({ ...cfg, particles: -1 }).inst.swarm.count, lib.PARTICLE_MIN);
});

test('a target payload that disagrees with its own header is refused', { skip: SKIP }, async () => {
  assert.equal(lib.unpackTargets(null), null);
  assert.equal(lib.unpackTargets({ count: 4, data: '' }), null);
  assert.equal(lib.unpackTargets({ count: 999, data: 'AAAA' }), null, 'a truncated payload');
  assert.equal(lib.unpackTargets({ count: 0, data: 'AAAA' }), null);
  // And the scene still mounts on one, with a single centre target rather than
  // an empty texture - a blank export reads as a broken tool.
  const cfg = await swarmState(baseHost());
  assert.equal(mount({ ...cfg, targets: { count: 999, data: 'AAAA' } }).inst.swarm.targets, 1);
});

test('the swarm registers its transform-feedback resources, and releases every one', { skip: SKIP }, async () => {
  const cfg = await swarmState(baseHost(), { particles: 5000 });
  const { inst, calls, made } = mount(cfg);
  const used = (name: string) => calls.filter((c) => c.m === name).length;

  assert.equal(inst.scene, 'swarm');
  assert.ok(used('transformFeedbackVaryings') > 0, 'the capture list has to be declared BEFORE the link, or the update pass writes nowhere');
  assert.ok(used('beginTransformFeedback') > 0 && used('endTransformFeedback') === used('beginTransformFeedback'),
    'every feedback pass must be closed');
  assert.equal(used('createVertexArray'), 2, 'two VAOs ping-pong the particle state');
  assert.equal(used('createBuffer'), 3, 'the fullscreen quad plus the two particle buffers');
  // Feedback into a buffer that is also bound for reading is undefined, so the
  // pass always writes the OTHER side: never the same object twice in a row.
  const bound = calls.filter((c) => c.m === 'bindBufferBase' && c.a[2]).map((c) => c.a[2]);
  assert.ok(bound.length > 1);
  for (let i = 1; i < bound.length; i++) assert.notEqual(bound[i], bound[i - 1], 'the feedback target must alternate');

  const before = made.length;
  inst.dispose();
  const released = new Set<any>();
  for (const c of calls) if (c.m.startsWith('delete')) for (const arg of c.a) released.add(arg);
  for (const o of made) assert.ok(released.has(o), `${o.kind} #${o.id} was never released`);
  assert.equal(made.length, before, 'dispose must not allocate');
  assert.ok(calls.some((c) => c.m === 'getExtension' && c.a[0] === 'WEBGL_lose_context'),
    'dispose must drop the context, not wait for collection');

  // The ink scene allocates none of this - it carries its state in textures.
  const ink = mount({ ...cfg, scene: 'ink' });
  assert.equal(ink.inst.scene, 'ink');
  assert.equal(ink.inst.swarm, null);
  assert.equal(ink.calls.filter((c) => c.m === 'createVertexArray').length, 0);
  assert.equal(ink.calls.filter((c) => c.m === 'transformFeedbackVaryings').length, 0);
});

/* ── WP-D: the field and camera scenes ────────────────────────────────────── */

/** The hooks' live-camera surface, with a stand-in realm to hand frames to. */
function frameHooks(win: Record<string, any> = {}): any {
  const f = new Function('window', `${HOOKS}\nreturn { onFrame: onFrame, compute: _compute };`) as (w: unknown) => any;
  return f(win);
}

/** One RGBA camera frame of a flat colour, in the shape host.media hands over. */
function camFrame(w: number, h: number, rgb: [number, number, number] = [255, 255, 255]): any {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = rgb[0]; data[i * 4 + 1] = rgb[1]; data[i * 4 + 2] = rgb[2]; data[i * 4 + 3] = 255;
  }
  return { width: w, height: h, data, t: 0 };
}

/** A lib realm with just enough DOM for the on-canvas note, plus a canvas that
 *  has a parent to hang it on. */
function mountNoted(cfg: any, win?: any): { inst: any; kids: any[]; win: any; frame: (n?: number) => void } {
  const kids: any[] = [];
  const doc = {
    createElement: () => {
      const attrs: Record<string, string> = {};
      return {
        className: '', textContent: '', parentNode: null as any, attrs,
        setAttribute: (k: string, v: string) => { attrs[k] = v; },
      };
    },
  };
  let tick: ((ts: number) => void) | null = null;
  let ts = 0;
  const w: any = win ?? {};
  w.requestAnimationFrame = (fn: (t: number) => void) => { tick = fn; return 1; };
  w.cancelAnimationFrame = () => { tick = null; };
  w.document = doc;
  const { gl } = fakeGl();
  const canvas = fakeCanvas(gl);
  canvas.parentNode = {
    appendChild: (el: any) => { el.parentNode = canvas.parentNode; kids.push(el); },
    removeChild: (el: any) => { kids.splice(kids.indexOf(el), 1); el.parentNode = null; },
  };
  const inst = new Function('window', `${LIB}\nreturn window.LollySynth;`)(w).create(canvas, cfg);
  // Drive the live rAF loop by hand: the camera is only pumped there.
  const frame = (n = 1) => { for (let i = 0; i < n; i++) { ts += 16; tick?.(ts); } };
  return { inst, kids, win: w, frame };
}

test('the field and camera scenes are real options, and the wedge count is clamped', { skip: SKIP }, async () => {
  const m = JSON.parse(readFileSync(join(DIR, 'tool.json'), 'utf8'));
  const scene = m.inputs.find((i: any) => i.id === 'scene');
  assert.deepEqual(scene.options.map((o: any) => o.value), ['ink', 'swarm', 'field', 'camera']);
  assert.deepEqual(lib.SCENES, ['ink', 'swarm', 'field', 'camera'], 'the lib must accept exactly the declared scenes');

  const sym = m.inputs.find((i: any) => i.id === 'symmetry');
  assert.deepEqual(sym.showIf, { scene: ['field', 'camera'] }, 'symmetry belongs to the scenes that fold');
  assert.equal((await state({ scene: 'field' })).scene, 'field');
  assert.equal((await state({ scene: 'camera' })).scene, 'camera');
  assert.equal((await state({ scene: 'field', symmetry: 1e9 })).symmetry, 12, 'the wedge count divides in a shader');
  assert.equal((await state({ scene: 'field', symmetry: -4 })).symmetry, 1);
  assert.equal((await state({ scene: 'field', symmetry: 5.6 })).symmetry, 6, 'half a wedge does not meet its mirror');
  assert.equal((await state({ scene: 'field', symmetry: 'lots' })).symmetry, 6);
  // And again in the lib, because _state is JSON in the page and can be hand-written.
  const cfg = await state({ scene: 'field' });
  assert.equal(mountNoted({ ...cfg, symmetry: 1e9 }).inst.symmetry, 12);
  assert.equal(mountNoted({ ...cfg, symmetry: 0 }).inst.symmetry, 1, 'a zero wedge count would divide by zero');
});

test('the symmetry fold mirrors wedges onto one another and magnifies nothing', { skip: SKIP }, () => {
  const AR = 1280 / 720;
  const fold = (u: number, v: number, n: number) => lib.symmetryFold(u, v, n, AR);
  // Square units, so a wedge of a 16:9 frame is a wedge and not a sheared one.
  const radius = (p: number[]) => Math.hypot((p[0]! - 0.5) * AR, p[1]! - 0.5);
  const at = (a: number, r: number) => [0.5 + (Math.cos(a) * r) / AR, 0.5 + Math.sin(a) * r];

  // 1 is symmetry OFF, and so is anything that is not a wedge count - the value
  // arrives off a URL.
  for (const n of [1, 0, -6, NaN, undefined, 'six']) {
    assert.deepEqual(lib.symmetryFold(0.3, 0.8, n as any, AR), [0.3, 0.8], `sectors ${String(n)} must leave the picture alone`);
  }

  for (const n of [2, 3, 6, 12]) {
    const sector = (Math.PI * 2) / n;
    for (const a of [0.05, 0.4, 1.1, 2.7, -0.6, 3.9]) {
      for (const r of [0.05, 0.22, 0.5]) {
        const here = fold(...(at(a, r) as [number, number]), n);
        // Every wedge shows the same picture...
        for (const k of [1, 2, n - 1]) {
          const there = fold(...(at(a + k * sector, r) as [number, number]), n);
          assert.ok(Math.hypot(there[0] - here[0], there[1] - here[1]) < 1e-9,
            `n=${n}: wedge ${k} away must read the same point`);
        }
        // ...and each is mirrored about its own middle, so neighbours meet along
        // their shared edge instead of showing a seam.
        const mirrored = fold(...(at(-a, r) as [number, number]), n);
        assert.ok(Math.hypot(mirrored[0] - here[0], mirrored[1] - here[1]) < 1e-9, `n=${n}: the wedge is not mirrored`);
        // The radius is untouched: a fold rearranges the picture, it never zooms it.
        assert.ok(Math.abs(radius(here) - r) < 1e-9, `n=${n}: the fold changed the radius`);
        // A folded point is already inside its wedge.
        assert.deepEqual(fold(here[0], here[1], n), here, `n=${n}: the fold must be idempotent`);
      }
    }
  }
  // The centre is the one fixed point of every fold.
  for (const n of [2, 5, 12]) {
    const c = fold(0.5, 0.5, n);
    assert.ok(Math.abs(c[0] - 0.5) < 1e-12 && Math.abs(c[1] - 0.5) < 1e-12);
  }
});

test('the shader fold is the same mapping as the exported one', { skip: SKIP }, () => {
  // The GLSL cannot be run here (no GPU, and a compile is the browser tier's job),
  // so what is checkable is that both copies carry the SAME six steps in the same
  // order. They have to be changed together or a shared URL folds two ways.
  const glsl = String(LIB.match(/vec2 fold\(vec2 uv\)\{([\s\S]*?)\n\s*'\}',/)![1]);
  for (const step of [
    /uSectors < 1\.5/,                      // 1 is symmetry off
    /uv\.x - 0\.5\) \* uAspect/,            // square units
    /6\.2831853 \/ uSectors/,               // the wedge angle
    /atan\(p\.y, p\.x\)/,
    /a - floor\(a \/ sector\) \* sector/,   // into the first wedge
    /a > sector \* 0\.5.*sector - a/,       // mirrored about its middle
    /cos\(a\) \* r \/ uAspect/,             // the radius is carried through
  ]) {
    assert.match(glsl, step, 'the shader fold drifted from symmetryFold');
  }
  // A folded point can sit outside [0,1] (the corners of a 16:9 frame reach past
  // the short edge once they are rotated), so the field texture must clamp.
  assert.match(LIB, /TEXTURE_WRAP_S, gl\.CLAMP_TO_EDGE/, 'a wrapped field would tile the folded corners back in');
});

test('the field scene runs the feedback pass and none of the ink solver', { skip: SKIP }, async () => {
  const cfg = await state({ scene: 'field' });
  const { inst, calls, made } = mount(cfg);
  assert.equal(inst.scene, 'field');
  assert.equal(inst.swarm, null, 'the field carries no particles');
  // Nine ink passes down to three: the field is one warp of the dye buffer the
  // emitters splat into, so the pressure solve and its four grids are not built.
  assert.equal(calls.filter((c) => c.m === 'createProgram').length, 3, 'splat, field, display - and nothing else');
  assert.equal(calls.filter((c) => c.m === 'createVertexArray').length, 0);

  const released = new Set<any>();
  inst.dispose();
  for (const c of calls) if (c.m.startsWith('delete')) for (const arg of c.a) released.add(arg);
  for (const o of made) assert.ok(released.has(o), `${o.kind} #${o.id} was never released`);
});

test('the camera scene allocates the live frame texture, and no other scene does', { skip: SKIP }, async () => {
  const cfg = await state({ scene: 'camera' });
  const cam = mount(cfg);
  assert.equal(cam.inst.scene, 'camera');
  // R8 luma, at the grid the hooks sample into - fixed on both sides, so the
  // texture is allocated once and never resized.
  const alloc = cam.calls.filter((c) => c.m === 'texImage2D' && c.a[3] === lib.CAM_W && c.a[4] === lib.CAM_H);
  assert.equal(alloc.length, 1, 'the camera grid is uploaded into one fixed-size texture');

  const inkCfg = await state({ scene: 'ink' });
  assert.equal(mount(inkCfg).calls.filter((c) => c.m === 'texImage2D' && c.a[3] === lib.CAM_W && c.a[4] === lib.CAM_H).length, 0,
    'the ink scene has no camera to hold');

  const released = new Set<any>();
  cam.inst.dispose();
  for (const c of cam.calls) if (c.m.startsWith('delete')) for (const arg of c.a) released.add(arg);
  for (const o of cam.made) assert.ok(released.has(o), `${o.kind} #${o.id} was never released`);
});

test('onFrame hands the camera to the instrument WITHOUT returning a patch', { skip: SKIP }, () => {
  const m = JSON.parse(readFileSync(join(DIR, 'tool.json'), 'utf8'));
  assert.equal(m.hooks.onFrame, true, 'the runtime only drives onFrame for a tool that declares it');

  // The shell hangs its Play + Go live buttons on the FIRST asset input's picker
  // row (views/live-controls.ts sourceInputId). A row hidden by showIf takes the
  // camera control away with it, so the camera scene could never be started: the
  // first asset slot has to be one that shows in every scene.
  const firstAsset = m.inputs.find((i: any) => i.type === 'asset');
  assert.ok(firstAsset && !firstAsset.showIf,
    `Go live would ride "${firstAsset?.id}", which is hidden outside its own scene`);

  const win: Record<string, any> = {};
  const h = frameHooks(win);
  // A returned patch re-renders the tool's DOM, which drops the WebGL context:
  // one context built and leaked per camera frame, against a browser cap of ~16.
  assert.equal(h.onFrame({ frame: camFrame(64, 32) }), undefined, 'a per-frame patch would leak a GL context a frame');

  const chan = win.__lollySynthCam;
  assert.ok(chan, 'the frame reaches the instrument as a property on the realm');
  assert.equal(chan.w, lib.CAM_W);
  assert.equal(chan.h, lib.CAM_H);
  assert.equal(chan.lum.length, lib.CAM_W * lib.CAM_H);
  assert.ok(chan.lum.every((v: number) => v >= 250), 'a white frame samples to white luma');
  assert.equal(chan.n, 1, 'the instrument uploads only when the count moves');

  // frame.data is valid only for the synchronous duration of the call, so the
  // pixels have to be COPIED, never retained.
  const frame = camFrame(8, 8, [0, 0, 0]);
  h.onFrame({ frame });
  assert.equal(chan.n, 2);
  assert.ok(chan.lum.every((v: number) => v === 0));
  frame.data.fill(255);
  assert.ok(chan.lum.every((v: number) => v === 0), 'the sampler kept a reference to the shell\'s buffer');

  // A frame that disagrees with its own dimensions is dropped, not sampled past
  // the end of the buffer.
  for (const bad of [null, undefined, {}, { width: 0, height: 4, data: new Uint8ClampedArray(16) },
    { width: 8, height: 8, data: new Uint8ClampedArray(4) }]) {
    assert.equal(h.onFrame({ frame: bad }), undefined);
    assert.equal(chan.n, 2, `a malformed frame must not advance the sequence: ${JSON.stringify(bad)}`);
  }
  assert.equal(h.onFrame({}), undefined, 'no frame at all is not an error either');
});

test('a camera scene with no camera says so, instead of showing an unexplained picture', { skip: SKIP }, async () => {
  const withCam = await createRuntime(tool, baseHost({ media: { isAvailable: () => true } }), { scene: 'camera' });
  const ready = JSON.parse(String((withCam.getHydrated() as string).match(/id="synth-state">([\s\S]*?)<\/script>/)![1]));
  assert.equal(ready.cameraReady, true, 'the fold reports whether this shell could open a camera at all');
  assert.equal((await state({ scene: 'camera' })).cameraReady, false, 'no host.media, no camera');

  // Two different truths, and neither of them is a blank canvas.
  const waiting = mountNoted(ready);
  assert.match(waiting.inst.note(), /Go live/, 'a shell WITH a camera is told how to start it');
  const absent = mountNoted({ ...ready, cameraReady: false });
  assert.match(absent.inst.note(), /cannot open a camera/, 'a shell without one is told that, not left guessing');
  assert.equal(absent.kids.length, 1, 'the note is on the canvas, where the picture is');

  // The other scenes are not camera scenes and say nothing.
  assert.equal(mountNoted(await state({ scene: 'field' })).inst.note(), null);
  assert.equal(mountNoted(await state()).inst.note(), null);

  absent.inst.dispose();
  assert.equal(absent.kids.length, 0, 'dispose takes the note away with the instrument');
});

test('the note is chrome, not part of the picture', { skip: SKIP }, async () => {
  // The note is a sibling of the canvas inside the node the exporter rasterises,
  // so nothing but data-export-hide keeps an English instruction out of a PNG.
  const noted = mountNoted({ ...(await state({ scene: 'camera' })), cameraReady: true });
  assert.equal(noted.kids.length, 1);
  assert.equal(noted.kids[0].attrs['data-export-hide'], '', 'the note would be baked into every export');

  // The template's own failure message sits in the same place.
  const msg = TEMPLATE.match(/function message\(txt\)\{?[\s\S]*?\n  \}/)![0];
  assert.match(msg, /setAttribute\('data-export-hide'/, 'an error string is not part of the user\'s picture');

  // And it must not eat the gesture the canvas underneath is listening for.
  assert.match(readFileSync(join(DIR, 'styles.css'), 'utf8').match(/\.synth-msg\s*\{[^}]*\}/)![0],
    /pointer-events:\s*none/, 'the overlay would swallow the pointer swirl in that band');
});

test('a camera note tracks frames still ARRIVING, not one that arrived once', { skip: SKIP }, async () => {
  const cfg = { ...(await state({ scene: 'camera' })), cameraReady: true };
  const chan = { w: lib.CAM_W, h: lib.CAM_H, lum: new Uint8Array(lib.CAM_W * lib.CAM_H), n: 7 };

  // A channel left on the realm by a PREVIOUS mount: its count is high but it
  // never advances again, so it is not a running camera and must not be latched.
  const m = mountNoted(cfg, { __lollySynthCam: chan });
  m.frame(3);
  assert.match(m.inst.note(), /Go live/, 'a stale channel from an earlier mount was taken as a live feed');

  chan.n = 8;                       // the camera is actually running now
  m.frame(1);
  assert.equal(m.inst.note(), null, 'a frame that arrived after mount drives the scene');

  // The user stops the camera: the last frame stays latched, and the note has to
  // come back rather than claim a feed that has gone away.
  m.frame(120);
  assert.match(m.inst.note(), /Go live/, 'a stopped camera left the note off forever');
  chan.n = 9;
  m.frame(1);
  assert.equal(m.inst.note(), null, 'and it clears again when frames resume');
});

test('a build that throws drops its own GL context', { skip: SKIP }, async () => {
  // create() is the only path that takes a context, and the template can do
  // nothing with the failure but show the message - it never gets an instance to
  // dispose. Contexts cap around 16 a tab and a failing paint repeats on every
  // nudge, so the context has to go back with the throw.
  const cfg = await state();
  const { gl, calls } = fakeGl();
  const bad: any = new Proxy(gl, {
    get: (t, p: string) => (p === 'getShaderParameter' ? () => false : (t as any)[p]),
  });
  assert.throws(() => glLib().create(fakeCanvas(bad), cfg), /synth shader/);
  assert.ok(calls.some((c) => c.m === 'loseContext'), 'the failed build leaked its context');

  // A build that succeeds keeps its context until dispose asks for it.
  const ok = mount(cfg);
  assert.ok(!ok.calls.some((c) => c.m === 'loseContext'));
});

test('nothing in the sim or the fold reads a wall clock or an unseeded random', { skip: SKIP }, () => {
  for (const [name, raw] of [['lib/synth.js', LIB], ['hooks.js', HOOKS]] as const) {
    const src = code(raw);
    assert.ok(!/Math\.random/.test(src), `${name}: all randomness is seeded (mulberry32)`);
    assert.ok(!/Date\.now|new Date\s*\(\s*\)/.test(src), `${name}: a wall clock would break deterministic replay`);
    assert.ok(!/performance\.now/.test(src), `${name}: the only clock is the rAF timestamp, live mode only`);
  }
});

/* ── WP-E: MIDI ───────────────────────────────────────────────────────────── */

/** The template's own IIFE, run in a stand-in realm. Only the MIDI half is
 *  exercised: the lib is handed over already loaded, so nothing here touches a
 *  GL context. */
function runTemplate(opts: {
  cfg?: Record<string, unknown>;
  panel?: unknown;
  midi?: unknown;
  /** The permission prompt was refused or dismissed. */
  midiFails?: boolean;
  mounted?: boolean;
  /** The exporter owns the canvas and is stepping the frame clock. */
  frameDriven?: boolean;
  /** Reuse a realm, the way successive paints of one session share a window. */
  win?: Record<string, any>;
}): { win: Record<string, any>; asked: number; canvas: any } {
  const src = TEMPLATE.match(/<script>([\s\S]*?)<\/script>/)![1]!;
  const canvas: any = { id: 'synth-canvas', __lollyFrameDriven: opts.frameDriven === true };
  const stateEl = { textContent: JSON.stringify({ emitters: [], ...(opts.cfg ?? {}) }) };
  let asked = 0;
  const doc: any = {
    getElementById: (id: string) => (
      id === 'synth-canvas' ? (opts.mounted === false ? null : canvas)
        : id === 'synth-state' ? stateEl
          : id === 'tool-inputs' ? (opts.panel ?? null) : null),
    dispatchEvent: () => true,
    createElement: () => ({ style: {}, remove() {}, setAttribute() {} }),
    head: { appendChild() {} },
  };
  const win: Record<string, any> = opts.win ?? {
    LollySynth: { create: () => ({ renderLoopFrame() {}, dispose() {} }) },
  };
  const nav: any = {};
  if (opts.midi || opts.midiFails) {
    nav.requestMIDIAccess = () => {
      asked++;
      return opts.midiFails ? Promise.reject(new Error('refused')) : Promise.resolve(opts.midi);
    };
  }
  const KeyEv = function (this: any, _type: string, init: any) { this.key = init.key; } as unknown as new (t: string, i: any) => unknown;
  const Cust = function (this: any) {} as unknown as new (...a: unknown[]) => unknown;
  new Function('window', 'document', 'navigator', 'KeyboardEvent', 'CustomEvent', 'console', src)(
    win, doc, nav, KeyEv, Cust, { error() {}, warn() {} });
  return { win, asked, canvas };
}

/** A stand-in for the shell's `.custom-slider`, carrying the same attributes and
 *  answering an arrow/page key the way mountCustomSlider does (snap, clamp,
 *  aria-valuenow is the value). */
function fakeSlider(min: number, max: number, step: number, value: number): any {
  const attrs: Record<string, string> = {
    'data-min': String(min), 'data-max': String(max), 'data-step': String(step),
    'aria-valuenow': String(value),
  };
  const keys: string[] = [];
  return {
    keys,
    get value(): number { return parseFloat(attrs['aria-valuenow']!); },
    getAttribute: (n: string) => attrs[n] ?? null,
    dispatchEvent(e: { key: string }) {
      keys.push(e.key);
      const d = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step
        : e.key === 'PageUp' ? step * 10 : e.key === 'PageDown' ? -step * 10 : 0;
      const raw = parseFloat(attrs['aria-valuenow']!) + d;
      const snapped = Math.round((raw - min) / step) * step + min;
      attrs['aria-valuenow'] = String(+Math.min(max, Math.max(min, snapped)).toFixed(10));
      return true;
    },
  };
}

/** A panel holding named sliders, matched on the exact selector the template builds. */
function fakePanel(sliders: Record<string, any>): any {
  return {
    querySelector: (sel: string) => {
      const m = sel.match(/data-input-id="([^"]+)"/);
      return (m && sliders[m[1]!]) || null;
    },
  };
}

/** A MIDI access stub with one port, plus the message the template listens for. */
function fakeMidi(): { access: any; send: (bytes: number[]) => void } {
  const port: any = { onmidimessage: null };
  const access: any = {
    inputs: { forEach: (fn: (p: unknown) => void) => fn(port) },
    onstatechange: null,
  };
  return { access, send: (bytes) => port.onmidimessage?.({ data: Uint8Array.from(bytes) }) };
}

test('a MIDI knob turns the sidebar control itself, and only once the tool is live', { skip: SKIP }, async () => {
  const intensity = fakeSlider(0, 2, 0.05, 1);
  const panel = fakePanel({ intensity });
  const { access, send } = fakeMidi();

  // Nothing is asked of the user's MIDI devices while the tool is not being played.
  assert.equal(runTemplate({ cfg: { live: false }, panel, midi: access }).asked, 0);
  // ...and where there is no Web MIDI at all (Safari), the tool is unaffected.
  const noMidi = runTemplate({ cfg: { live: true }, panel });
  assert.equal(noMidi.win.__lollySynthMidi, undefined, 'no flag, no listener, no error');

  const { win, asked } = runTemplate({ cfg: { live: true }, panel, midi: access });
  assert.equal(asked, 1);
  await Promise.resolve(); await Promise.resolve();

  // CC1 at the top of its travel walks the slider to its maximum THROUGH the
  // control's own keyboard commit - the write path that carries undo, the URL
  // and the share link. Never _state, which would be a second, unshareable
  // copy of the same knob.
  send([0xb0, 1, 127]);
  assert.equal(intensity.value, 2, 'the knob reached the top of the declared range');
  assert.ok(intensity.keys.length <= 12, `a full sweep is a handful of commits, not forty (${intensity.keys.length})`);
  assert.ok(intensity.keys.every((k: string) => k === 'PageUp' || k === 'ArrowRight'), 'one direction only');

  // Absolute, both ways, on any channel, and idempotent once it has arrived.
  send([0xb5, 1, 0]);
  assert.equal(intensity.value, 0);
  const spent = intensity.keys.length;
  send([0xb0, 1, 0]);
  assert.equal(intensity.keys.length, spent, 'a knob that has not moved commits nothing');
  send([0xb0, 1, 64]);
  assert.equal(intensity.value, 1, 'the middle of the knob is the middle of the range');

  // Everything that is not a control-change message, or not a mapped CC, or
  // arrives malformed, is ignored rather than guessed at.
  const before = intensity.value;
  for (const msg of [[0x90, 1, 127], [0xb0, 9, 127], [0xb0, 1], [], [0xb0]]) send(msg);
  assert.equal(intensity.value, before);

  // The registration is once per session (the template re-runs on every paint),
  // and a knob whose control this scene does not show does nothing at all.
  assert.equal(runTemplate({ cfg: { live: true }, panel, midi: access, win }).asked, 0, 'one request per session');
  assert.equal(win.__lollySynthMidi, true);
  send([0xb0, 3, 127]);   // symmetry: hidden outside the field/camera scenes

  // A session-long listener outlives the paint that registered it: once this
  // tool is gone from the page it must stop writing to whatever is there now.
  const orphan = fakeSlider(0, 2, 0.05, 1);
  const gone = runTemplate({ cfg: { live: true }, panel: fakePanel({ intensity: orphan }), midi: access, mounted: false, win });
  await Promise.resolve();
  assert.equal(gone.asked, 0);
  send([0xb0, 1, 127]);
  assert.equal(orphan.keys.length, 0, 'a detached tool must not drive another tool\'s sidebar');
});

test('a knob turned mid-export does not kill the export', { skip: SKIP }, async () => {
  // A commit re-renders the tool: the next paint disposes the instrument and
  // loses the GL context, while the exporter goes on calling the frame clock on
  // that same canvas - every remaining frame of the clip would be a dead canvas.
  const speed = fakeSlider(0, 2, 0.05, 1);
  const panel = fakePanel({ speed });
  const { access, send } = fakeMidi();
  const { canvas } = runTemplate({ cfg: { live: true }, panel, midi: access, frameDriven: true });
  await Promise.resolve(); await Promise.resolve();

  send([0xb0, 2, 127]);
  assert.equal(speed.keys.length, 0, 'the knob wrote into a canvas the exporter owns');
  assert.equal(speed.value, 1);

  // Once the clip is done the exporter hands the canvas back, and the same knob
  // works again.
  canvas.__lollyFrameDriven = false;
  send([0xb0, 2, 127]);
  assert.equal(speed.value, 2);
});

test('a refused MIDI prompt is asked exactly once', { skip: SKIP }, async () => {
  // The template re-runs on EVERY paint, so a flag cleared on rejection is a
  // permission prompt per slider nudge.
  const first = runTemplate({ cfg: { live: true }, midiFails: true });
  assert.equal(first.asked, 1);
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(first.win.__lollySynthMidi, true, 'a refusal must not re-arm the request');
  assert.equal(runTemplate({ cfg: { live: true }, midiFails: true, win: first.win }).asked, 0);
});

test('the CC map is fixed, documented, and points only at controls it can actually write', { skip: SKIP }, () => {
  const m = JSON.parse(readFileSync(join(DIR, 'tool.json'), 'utf8'));
  const table = new Function('return ' + TEMPLATE.match(/var MIDI_CC = (\[[\s\S]*?\]);/)![1]!)() as [number, string][];
  assert.deepEqual(table, [[1, 'intensity'], [2, 'speed'], [3, 'symmetry'], [74, 'rampRotate']]);

  const help = String(m.inputs.find((i: any) => i.id === 'live').help);
  for (const [cc, id] of table) {
    const input = m.inputs.find((i: any) => i.id === id);
    assert.ok(input, `CC${cc} is mapped to an input that does not exist: ${id}`);
    // The write path is the slider's own keyboard commit, so a mapped input has
    // to BE a slider - a plain number field would silently swallow the knob.
    assert.equal(input.display, 'slider', `CC${cc} -> ${id} is not a slider, so nothing would move`);
    assert.ok(help.includes(`CC${cc} is ${input.label}`),
      `the fixed map is the only map there is, so it has to be written down: CC${cc} is ${input.label}`);
  }
});

test('the colour ramp rotates as a hue, is clamped, and reaches the shader in radians', { skip: SKIP }, async () => {
  assert.equal((await state()).rampRotate, 0, 'off by default - an untouched piece keeps its palette');
  assert.equal((await state({ rampRotate: 90 })).rampRotate, 90);
  assert.equal((await state({ rampRotate: 1e9 })).rampRotate, 360, 'a turn past a full circle is a hostile URL');
  assert.equal((await state({ rampRotate: -720 })).rampRotate, 0);
  assert.equal((await state({ rampRotate: 'round' })).rampRotate, 0);

  const cfg = await state({ rampRotate: 180 });
  assert.ok(Math.abs(mountNoted(cfg).inst.rampRotate - Math.PI) < 1e-9);
  assert.equal(mountNoted({ ...cfg, rampRotate: 1e9 }).inst.rampRotate, 2 * Math.PI, 'clamped in the lib too');
  assert.equal(mountNoted({ ...cfg, rampRotate: 'round' }).inst.rampRotate, 0);

  // Lightness is untouched by the rotation, so a re-tint cannot flatten the
  // contrast the palette was chosen for.
  const shader = LIB.match(/vec3 hueRot\(vec3 lab\)\{[\s\S]*?\}'/)![0];
  assert.match(shader, /vec3\(lab\.x,/, 'the L channel must pass through unrotated');
});
