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
  assert.equal(s.emitters.length, 5);
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
  assert.equal(junk.intensity, 1);
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
  // A capability is a hard gate, not a stub: declaring microphone/camera made the
  // CLI refuse to render the tool at all (exit 3) and told the gallery this tool
  // opens your camera. Nothing here calls host.recorder or host.media - so nothing
  // is declared. Re-add one only with the hook that consumes it.
  assert.ok(!m.capabilities, 'no capability is used, so none may be declared');
  for (const src of [LIB, HOOKS, TEMPLATE]) {
    assert.ok(!/host\.recorder|host\.media|getUserMedia/.test(code(src)),
      'a mic/camera call needs its capability declared alongside it');
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

test('nothing in the sim or the fold reads a wall clock or an unseeded random', { skip: SKIP }, () => {
  for (const [name, raw] of [['lib/synth.js', LIB], ['hooks.js', HOOKS]] as const) {
    const src = code(raw);
    assert.ok(!/Math\.random/.test(src), `${name}: all randomness is seeded (mulberry32)`);
    assert.ok(!/Date\.now|new Date\s*\(\s*\)/.test(src), `${name}: a wall clock would break deterministic replay`);
    assert.ok(!/performance\.now/.test(src), `${name}: the only clock is the rAF timestamp, live mode only`);
  }
});
