// SPDX-License-Identifier: MPL-2.0
//
// The audiogram must always match the duration of the selected audio: pick a clip,
// get a video of the whole thing. These tests compile the REAL community hooks.js
// (the same `new Function('host', …)` shape the runtime uses) and drive it with the
// engine's real `analysePcm`, so what is pinned here is the tool's actual behaviour:
//
//   1. The analysis window follows the clip — a 30 s clip yields ~30 s of frames.
//   2. The fps ADAPTS to the clip so the payload stays near the MAX_FRAMES budget
//      (30fps up to 2 minutes, floor 6fps), and agMeta.fps reports the fps used.
//   3. An asset ref's meta.durationMs makes the fps guess exact, so long clips do
//      not analyse twice; without it, a long clip re-analyses once at the adapted
//      fps (guess wrong by more than 2x).
//   4. beforeExport sets the export duration from the analysed seconds, so an mp4
//      of a 30 s clip comes out 30 s.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analysePcm } from '../engine/src/audio-analyse.ts';
import type { AudioAnalyseOpts } from '../packages/core/src/host-v1.ts';

// A low sample rate keeps a minutes-long synthetic clip cheap to analyse; the
// analysis maths only cares about the rate it is told.
const SR = 8000;

const HOOKS_SRC = readFileSync(new URL('../community/audiogram/hooks.js', import.meta.url), 'utf8');

interface HookModule {
  onInit: (ctx: unknown) => Promise<Record<string, string>>;
  beforeExport: (ctx: { format: string; opts: Record<string, unknown> }) => void;
}

/** Compile hooks.js exactly as engine/src/runtime.ts getHookFactory does. */
function compileHooks(): HookModule {
  const factory = new Function(
    'host',
    `${HOOKS_SRC}; return {` +
    `onInit: typeof onInit !== 'undefined' ? onInit : null,` +
    `beforeExport: typeof beforeExport !== 'undefined' ? beforeExport : null` +
    `};`,
  ) as (host: unknown) => HookModule;
  return factory(null);
}

/** A quiet-ish tone with periodic bursts, `seconds` long — enough life that the
 *  analysis has something to normalise against. */
function pcm(seconds: number): Float32Array {
  const out = new Float32Array(Math.round(seconds * SR));
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const burst = Math.sin(2 * Math.PI * 0.5 * t) > 0.8 ? 1 : 0.25;
    out[i] = 0.6 * burst * Math.sin(2 * Math.PI * 220 * t);
  }
  return out;
}

/** A host whose audio.analyse runs the engine's real analysis over `channel`,
 *  counting calls and recording the fps of each. */
function fakeHost(channel: Float32Array): {
  host: { audio: object; log: () => void };
  calls: number[];
} {
  const calls: number[] = [];
  return {
    calls,
    host: {
      log: () => {},
      audio: {
        isAvailable: () => true,
        analyse: async (_src: unknown, opts: AudioAnalyseOpts) => {
          calls.push(opts.fps ?? 30);
          return analysePcm([channel], SR, opts);
        },
      },
    },
  };
}

function ctxFor(host: object, audio: unknown): { model: { id: string; value: unknown }[]; host: object } {
  return {
    host,
    model: [
      { id: 'audio', value: audio },
      { id: 'style', value: 'bars' },
      { id: 'start', value: 0 },
    ],
  };
}

test('a 30 s clip analyses to its full length at 30fps and exports 30 s', async () => {
  const hooks = compileHooks();
  const clip = pcm(30);
  const { host, calls } = fakeHost(clip);
  // A plain URL source (no meta.durationMs): a short clip's full-rate guess is
  // already the adapted fps, so exactly one analysis happens.
  const out = await hooks.onInit(ctxFor(host, 'blob:clip-30s'));

  const meta = JSON.parse(out.agMeta!) as { fps: number; count: number; dur: number; real: boolean };
  assert.equal(meta.real, true, 'the real clip was analysed, not the placeholder');
  assert.equal(meta.fps, 30, '30 s is inside the frame budget, so full rate');
  assert.ok(Math.abs(meta.dur - 30) < 0.1, `analysed ~30 s, got ${meta.dur}`);
  assert.ok(Math.abs(meta.count - 30 * meta.fps) <= meta.fps, `count ≈ 30×fps, got ${meta.count}`);
  assert.equal(calls.length, 1, 'one analysis, no probe');

  // beforeExport follows the analysed duration for animated formats.
  const ex = { format: 'mp4', opts: {} as Record<string, unknown> };
  hooks.beforeExport(ex);
  assert.ok(Math.abs((ex.opts.duration as number) - 30) < 0.1, `mp4 duration ≈ 30 s, got ${ex.opts.duration}`);

  // ...but never overrides a duration the user chose.
  const chosen = { format: 'mp4', opts: { duration: 5, durationUserSet: true } };
  hooks.beforeExport(chosen);
  assert.equal(chosen.opts.duration, 5, 'a user-set duration wins');
});

test('a long clip adapts its fps to the frame budget (meta.durationMs path, single analysis)', async () => {
  const hooks = compileHooks();
  const seconds = 300;
  const clip = pcm(seconds);
  const { host, calls } = fakeHost(clip);
  // An asset ref carrying durationMs, as user uploads and TTS assets do. `url` is
  // what marks it as a ref for the bridge; here it only needs to be an object.
  const ref = { id: 'user/audio/long', url: 'blob:clip-300s', meta: { durationMs: seconds * 1000 } };
  const out = await hooks.onInit(ctxFor(host, ref));

  const meta = JSON.parse(out.agMeta!) as { fps: number; count: number; dur: number; real: boolean };
  assert.equal(meta.real, true);
  // floor(3600 / 300) = 12fps — the budget spread over the whole clip.
  assert.equal(meta.fps, 12, `adapted fps for a 300 s clip, got ${meta.fps}`);
  assert.ok(Math.abs(meta.dur - seconds) < 0.5, `analysed the whole ~${seconds} s, got ${meta.dur}`);
  assert.ok(Math.abs(meta.count - seconds * meta.fps) <= meta.fps, `count ≈ dur×fps, got ${meta.count}`);
  assert.equal(calls.length, 1, 'durationMs made the guess exact: one analysis');
  assert.equal(calls[0], 12, 'analysed at the adapted fps directly');

  const ex = { format: 'webm', opts: {} as Record<string, unknown> };
  hooks.beforeExport(ex);
  assert.ok(Math.abs((ex.opts.duration as number) - seconds) < 0.5, `export follows the clip, got ${ex.opts.duration}`);
});

test('a long clip WITHOUT durationMs re-analyses once at the adapted fps', async () => {
  const hooks = compileHooks();
  const seconds = 300;
  const { host, calls } = fakeHost(pcm(seconds));
  const out = await hooks.onInit(ctxFor(host, 'blob:clip-300s-no-meta'));

  const meta = JSON.parse(out.agMeta!) as { fps: number; count: number };
  // First guess 30fps (no hint), truth says 12 — wrong by more than 2x, so exactly
  // one corrective re-analysis.
  assert.deepEqual(calls, [30, 12], 'full-rate probe, then the adapted fps');
  assert.equal(meta.fps, 12);
  assert.ok(Math.abs(meta.count - seconds * 12) <= 12, `count ≈ dur×fps, got ${meta.count}`);
});

test('no audio still yields the 8 s placeholder track', async () => {
  const hooks = compileHooks();
  const { host, calls } = fakeHost(pcm(1));
  const out = await hooks.onInit(ctxFor(host, undefined));
  const meta = JSON.parse(out.agMeta!) as { fps: number; count: number; dur: number; real: boolean };
  assert.equal(meta.real, false);
  assert.equal(meta.fps, 30);
  assert.equal(meta.count, 240, '8 s at 30fps');
  assert.equal(meta.dur, 8);
  assert.equal(calls.length, 0, 'nothing analysed');
});
