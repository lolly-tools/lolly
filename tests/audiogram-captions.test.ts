// SPDX-License-Identifier: MPL-2.0
//
// Audiogram captions: a Script-audio asset carries its word timings on
// meta.tts.words, and the tool turns them into lower-third cues (agCues).
// Hooks are data and may not import the engine, so hooks.js carries a small
// MIRROR of `groupWordsToCues` (engine/src/captions.ts) — these tests compile
// the REAL hooks.js and pin that mirror against the engine implementation on
// the same inputs, so the two cannot drift apart silently. Also pinned: the
// in-point shifts and filters the timings, the captions toggle, and that
// non-TTS audio (and the placeholder) emit no cues at all.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analysePcm } from '../engine/src/audio-analyse.ts';
import { groupWordsToCues } from '../engine/src/captions.ts';
import type { AudioAnalyseOpts, SpeechWordTiming } from '../packages/core/src/host-v1.ts';

const SR = 8000;

const HOOKS_SRC = readFileSync(new URL('../community/audiogram/hooks.js', import.meta.url), 'utf8');

interface HookModule {
  onInit: (ctx: unknown) => Promise<Record<string, string>>;
}

/** Compile hooks.js exactly as engine/src/runtime.ts getHookFactory does. */
function compileHooks(): HookModule {
  const factory = new Function(
    'host',
    `${HOOKS_SRC}; return { onInit: typeof onInit !== 'undefined' ? onInit : null };`,
  ) as (host: unknown) => HookModule;
  return factory(null);
}

/** A quiet-ish tone with periodic bursts, `seconds` long. */
function pcm(seconds: number): Float32Array {
  const out = new Float32Array(Math.round(seconds * SR));
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const burst = Math.sin(2 * Math.PI * 0.5 * t) > 0.8 ? 1 : 0.25;
    out[i] = 0.6 * burst * Math.sin(2 * Math.PI * 220 * t);
  }
  return out;
}

function fakeHost(channel: Float32Array): { audio: object; log: () => void } {
  return {
    log: () => {},
    audio: {
      isAvailable: () => true,
      analyse: async (_src: unknown, opts: AudioAnalyseOpts) => analysePcm([channel], SR, opts),
    },
  };
}

function ctxFor(
  host: object,
  audio: unknown,
  extra: Record<string, unknown> = {},
): { model: { id: string; value: unknown }[]; host: object } {
  return {
    host,
    model: [
      { id: 'audio', value: audio },
      { id: 'style', value: 'bars' },
      { id: 'start', value: extra.start ?? 0 },
      ...('captions' in extra ? [{ id: 'captions', value: extra.captions }] : []),
    ],
  };
}

// A narration's worth of timings, built to exercise every grouping rule the
// mirror carries: sentence punctuation closing a cue, a >= 0.6 s pause starting
// one, and a run long enough to trip the 42-character ceiling.
const WORDS: SpeechWordTiming[] = [
  { text: 'Hello', start: 0.1, end: 0.4 },
  { text: 'from', start: 0.45, end: 0.6 },
  { text: 'Lolly.', start: 0.65, end: 1.1 },
  // Pause > 0.6 s.
  { text: 'This', start: 2.0, end: 2.2 },
  { text: 'sentence', start: 2.25, end: 2.7 },
  { text: 'keeps', start: 2.75, end: 3.0 },
  { text: 'going', start: 3.05, end: 3.3 },
  { text: 'well', start: 3.35, end: 3.5 },
  { text: 'past', start: 3.55, end: 3.8 },
  { text: 'the', start: 3.85, end: 3.95 },
  { text: 'character', start: 4.0, end: 4.5 },
  { text: 'ceiling', start: 4.55, end: 4.9 },
  { text: 'for', start: 4.95, end: 5.1 },
  { text: 'one', start: 5.15, end: 5.3 },
  { text: 'cue.', start: 5.35, end: 5.8 },
  { text: 'Done!', start: 6.4, end: 6.9 },
];

interface Cue { t0: number; t1: number; text: string }

/** The engine's grouping of `words`, in the hook's own {t0,t1,text} shape. */
function engineCues(words: readonly SpeechWordTiming[]): Cue[] {
  return groupWordsToCues(words).map((c) => ({ t0: c.start, t1: c.end, text: c.text }));
}

test('agCues matches the engine groupWordsToCues output for the same words', async () => {
  const hooks = compileHooks();
  const ref = { id: 'user/tts/demo', url: 'blob:tts', meta: { durationMs: 8000, tts: { words: WORDS } } };
  const out = await hooks.onInit(ctxFor(fakeHost(pcm(8)), ref));

  assert.ok(out.agCues, 'cues were emitted for a TTS asset');
  const cues = JSON.parse(out.agCues!) as Cue[];
  const expected = engineCues(WORDS);
  assert.deepEqual(cues, expected, 'the hooks mirror groups exactly like the engine');
  // Sanity on the shape the fixture was built to exercise, so a silently
  // degenerate grouping (one giant cue) cannot pass the comparison by accident.
  assert.ok(expected.length >= 4, `the fixture yields several cues, got ${expected.length}`);
  assert.equal(expected[0]!.text, 'Hello from Lolly.', 'sentence punctuation closes the first cue');
  assert.equal(expected[expected.length - 1]!.text, 'Done!', 'the pause plus punctuation isolates the last word');
  for (const c of cues) {
    assert.ok(c.t1 > c.t0, `cue "${c.text}" spans forward`);
    assert.ok(c.text.length <= 42 || !c.text.includes(' '), `cue "${c.text}" respects the ceiling`);
  }
});

test('the in-point shifts cue times onto the analysed window and drops finished words', async () => {
  const hooks = compileHooks();
  const start = 2;
  const ref = { id: 'user/tts/demo', url: 'blob:tts', meta: { durationMs: 8000, tts: { words: WORDS } } };
  const out = await hooks.onInit(ctxFor(fakeHost(pcm(8)), ref, { start }));

  const cues = JSON.parse(out.agCues!) as Cue[];
  // What the hook is DOCUMENTED to do: filter to words still sounding at the
  // in-point, shift onto the window, then group — via the engine, so the
  // comparison stays an engine-parity check.
  const shifted = WORDS.filter((w) => w.end > start).map((w) => ({
    text: w.text,
    start: Math.max(0, w.start - start),
    end: w.end - start,
  }));
  assert.deepEqual(cues, engineCues(shifted));
  assert.ok(cues.every((c) => c.t0 >= 0), 'no cue starts before the window');
  assert.ok(!cues.some((c) => /Hello|Lolly/.test(c.text)), 'words finished before the in-point are gone');
});

test('captions=false suppresses cues without touching the animation payload', async () => {
  const hooks = compileHooks();
  const ref = { id: 'user/tts/demo', url: 'blob:tts', meta: { durationMs: 8000, tts: { words: WORDS } } };
  const out = await hooks.onInit(ctxFor(fakeHost(pcm(8)), ref, { captions: false }));

  assert.equal(out.agCues, '', 'no cues when the toggle is off');
  const meta = JSON.parse(out.agMeta!) as { real: boolean; count: number };
  assert.equal(meta.real, true, 'the clip still analysed');
  assert.ok(meta.count > 0 && out.agData, 'the packed track is untouched');
});

test('audio without meta.tts.words emits no cues (nothing is transcribed)', async () => {
  const hooks = compileHooks();
  const ref = { id: 'user/audio/plain', url: 'blob:plain', meta: { durationMs: 8000 } };
  const out = await hooks.onInit(ctxFor(fakeHost(pcm(8)), ref));
  assert.equal(out.agCues, '');
  assert.equal((JSON.parse(out.agMeta!) as { real: boolean }).real, true);
});

test('the placeholder track emits no cues', async () => {
  const hooks = compileHooks();
  const out = await hooks.onInit(ctxFor(fakeHost(pcm(1)), undefined));
  assert.equal(out.agCues, '');
});
