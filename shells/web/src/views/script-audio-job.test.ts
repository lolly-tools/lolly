// SPDX-License-Identifier: MPL-2.0
/**
 * Script audio's Generate as a background job (generateSpeechAsJob).
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/views/script-audio-job.test.ts
 *
 * The seams that matter are the ones a navigating user falls through:
 *  - Generate registers a heavy, cancellable job before it awaits anything, so
 *    the global toast shows the run from any view.
 *  - The job mirrors the panel's own progress reading; it never computes a
 *    second percentage.
 *  - When the panel is GONE at completion the take is saved through the same
 *    saveTtsClip path the Save button uses - same Gen AI disclosure, same
 *    embedded credential, same meta.tts - and the completion names the clip.
 *  - Cancel really aborts the synthesis request, and a cancelled run persists
 *    nothing.
 *
 * A sibling of script-audio.test.ts rather than more of it: this file needs a
 * DOM (announce() writes to a live region) and owns the jobs-registry module
 * state, which that DOM-free suite must not inherit.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/', pretendToBeVisual: true });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
// invalidateNeurospicyTracks dispatches a jsdom Event on the jsdom document, and
// a11y.ts's announce() schedules through rAF, which pretendToBeVisual only puts
// on dom.window - not the bare global this file runs in.
globalThis.Event = dom.window.Event;
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => { setTimeout(() => cb(0), 0); return 0; }) as unknown as typeof requestAnimationFrame;

import {
  generateSpeechAsJob, speechProgressFraction, ttsAssetName,
  type ScriptAudioHost,
} from './script-audio.ts';
import { startJob, cancelJob, jobsSnapshot, __resetJobsForTest } from '../lib/jobs.ts';
import type { SpeechProgress, SpeechResult } from '@lolly-tools/core/host-v1';

const SCRIPT = 'Hello from Lolly, this voice is synthetic.';

/** Let the queued microtasks (and the rAF shim's setTimeout) drain. */
const tick = (): Promise<void> => new Promise(r => { setTimeout(r, 0); });

const resultFixture = (): SpeechResult => ({
  pcm: new Float32Array(2400),
  sampleRate: 24000,
  duration: 0.1,
  words: [],
  granularity: 'none',
});

/** A host.speech whose synthesize() this test settles by hand, rejecting with an
 *  AbortError when the signal fires - what bridge/speech.ts really does. */
function fakeSpeech(): {
  speech: unknown;
  calls: { text: string; opts: { signal?: AbortSignal; onProgress?: (p: SpeechProgress) => void; voice?: string; speed?: number } }[];
  resolve: (r: SpeechResult) => void;
  reject: (e: unknown) => void;
} {
  const calls: { text: string; opts: Record<string, unknown> }[] = [];
  let settle: { resolve: (r: SpeechResult) => void; reject: (e: unknown) => void } | null = null;
  const speech = {
    isAvailable: () => true,
    cached: async () => true,
    modelBytes: () => 1,
    voices: async () => [],
    synthesize: (text: string, opts: Record<string, unknown> = {}) => new Promise<SpeechResult>((resolve, reject) => {
      calls.push({ text, opts });
      settle = { resolve, reject };
      (opts.signal as AbortSignal | undefined)?.addEventListener('abort', () => {
        reject(Object.assign(new Error('speech synthesis aborted'), { name: 'AbortError' }));
      }, { once: true });
    }),
  };
  return {
    speech,
    calls: calls as never,
    resolve: (r) => settle?.resolve(r),
    reject: (e) => settle?.reject(e),
  };
}

function fakeHost(uploads: unknown[], speech: unknown): ScriptAudioHost {
  return {
    version: '1',
    profile: { get: async () => ({}) },
    log: () => {},
    speech,
    assets: {
      _uploadUserAsset: async (record: unknown) => { uploads.push(record); },
      get: async (id: string) => ({ source: 'user', id, type: 'audio', format: 'wav', url: 'blob:x' }),
    },
  } as unknown as ScriptAudioHost;
}

beforeEach(() => { __resetJobsForTest(); });

test('Generate registers a heavy, cancellable job before it awaits anything', async () => {
  const { speech, calls, resolve } = fakeSpeech();
  const uploads: unknown[] = [];
  const p = generateSpeechAsJob(
    fakeHost(uploads, speech),
    { spokenText: SCRIPT, voice: 'af_heart', speed: 1 },
    { alive: () => true },
  );
  // Synchronously visible: the toast must be able to show it on the same click.
  const jobs = jobsSnapshot();
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0]!.title, 'Generating speech');
  assert.equal(jobs[0]!.heavy, true, 'a model run takes the serial slot');
  assert.equal(jobs[0]!.cancellable, true);

  await tick();
  assert.equal(calls.length, 1, 'the synthesis started once the slot was ours');
  assert.equal(calls[0]!.text, SCRIPT);
  assert.equal(calls[0]!.opts.voice, 'af_heart');
  assert.equal(jobsSnapshot()[0]!.status, 'running');

  resolve(resultFixture());
  const clip = await p;
  assert.ok(clip, 'a live panel gets the clip back to paint');
  assert.equal(clip.spokenText, SCRIPT);
  assert.equal(clip.voice, 'af_heart');
  assert.ok(clip.wavBlob.size > 0, 'the PCM came back as wav bytes');
  assert.equal(jobsSnapshot()[0]!.status, 'done');
  assert.equal(uploads.length, 0, 'a live panel still owns its own explicit Save');
});

test('the job mirrors the panel reading, it does not compute a second percentage', async () => {
  const { speech, calls, resolve } = fakeSpeech();
  const seen: SpeechProgress[] = [];
  const p = generateSpeechAsJob(
    fakeHost([], speech),
    { spokenText: SCRIPT, voice: '', speed: 1 },
    { alive: () => true, onProgress: (q) => { seen.push(q); } },
  );
  await tick();

  const download: SpeechProgress = { phase: 'download', loaded: 4, total: 10 };
  calls[0]!.opts.onProgress?.(download);
  assert.equal(speechProgressFraction(download), 0.4, 'the panel paints 40%');
  assert.deepEqual(
    { ...jobsSnapshot()[0]!.progress },
    { done: 40, total: 100, note: 'Downloading the voice model…' },
    'and the job says the same 40%',
  );

  // A transport that will not say: indeterminate on both, never a made-up number.
  const quiet: SpeechProgress = { phase: 'synthesis' };
  calls[0]!.opts.onProgress?.(quiet);
  assert.equal(speechProgressFraction(quiet), null);
  assert.equal(jobsSnapshot()[0]!.progress?.total, 0, 'total 0 is the indeterminate bar');
  assert.equal(jobsSnapshot()[0]!.progress?.note, 'Generating speech…');

  assert.deepEqual(seen, [download, quiet], 'the surface saw the same events, unaltered');
  resolve(resultFixture());
  await p;
});

test('a completion with the panel gone saves the take through the Save path and names it', async () => {
  const { speech, resolve } = fakeSpeech();
  const uploads: Record<string, unknown>[] = [];
  const p = generateSpeechAsJob(
    fakeHost(uploads, speech),
    { spokenText: SCRIPT, voice: 'af_heart', speed: 1 },
    { alive: () => false },   // the sheet closed / the view was replaced
  );
  await tick();
  resolve(resultFixture());
  assert.equal(await p, null, 'nothing left for the caller to paint');

  assert.equal(uploads.length, 1, 'the take was not lost');
  const rec = uploads[0]!;
  assert.equal(rec.type, 'audio');
  assert.equal(rec.format, 'wav');
  // The provenance the explicit Save writes, reused verbatim - not reinvented.
  assert.equal(rec.aiGenerated, 'full', 'the Gen AI disclosure rides the auto-save');
  assert.ok(rec.credential instanceof Uint8Array && rec.credential.length > 0, 'a signed credential store rides the record');
  assert.equal(rec.credentialFormat, 'wav');
  const meta = rec.meta as { tts?: { voice?: string; speed?: number; text?: string }; tags?: string[] };
  assert.equal(meta.tts?.voice, 'af_heart');
  assert.equal(meta.tts?.speed, 1);
  assert.equal(meta.tts?.text, SCRIPT);
  assert.ok(meta.tags?.includes('tts'));

  const job = jobsSnapshot()[0]!;
  assert.equal(job.status, 'done');
  assert.equal((job.result as { id?: string } | undefined)?.id, rec.id, 'the completion carries the saved ref');

  // …and the completion says WHICH clip: the toast only ever says "Generating speech".
  await tick();
  const live = document.querySelector('[data-a11y-live]');
  assert.match(live?.textContent ?? '', new RegExp(ttsAssetName(SCRIPT).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('a non-integer speed still saves the take with its Gen AI disclosure', async () => {
  // 0.8× and 1.2× are two of the three speeds the UI offers, and they take the
  // SAME save path - which is worth pinning, because the Content Credential is
  // the part that currently gives way there: the created action carries
  // `speed` as a number, and the engine's CBOR encoder (engine/src/c2pa.ts,
  // "only safe integers are supported") refuses a float, so both the in-file
  // embed and the record-side fallback degrade to null. Pre-existing, on the
  // explicit Save just as much as here. What must NEVER give way is the
  // disclosure and the recipe, so that is what this asserts - and it keeps
  // passing on the day the encoder learns floats.
  const { speech, resolve } = fakeSpeech();
  const uploads: Record<string, unknown>[] = [];
  const p = generateSpeechAsJob(
    fakeHost(uploads, speech),
    { spokenText: SCRIPT, voice: 'af_heart', speed: 1.2 },
    { alive: () => false },
  );
  await tick();
  resolve(resultFixture());
  assert.equal(await p, null);
  assert.equal(uploads.length, 1, 'the take is never dropped over a provenance hiccup');
  assert.equal(uploads[0]!.aiGenerated, 'full');
  assert.equal((uploads[0]!.meta as { tts?: { speed?: number } }).tts?.speed, 1.2, 'the recipe records the real speed');
  assert.equal(jobsSnapshot()[0]!.status, 'done');
});

test('cancel really aborts the synthesis, and a cancelled run persists nothing', async () => {
  const { speech, calls } = fakeSpeech();
  const uploads: unknown[] = [];
  const p = generateSpeechAsJob(
    fakeHost(uploads, speech),
    { spokenText: SCRIPT, voice: '', speed: 1 },
    { alive: () => false },
  );
  await tick();
  const signal = calls[0]!.opts.signal!;
  assert.equal(signal.aborted, false);

  cancelJob(jobsSnapshot()[0]!.id);
  assert.equal(signal.aborted, true, 'the ✕ aborts the real request, it is not decoration');

  await assert.rejects(p, (e: Error) => e.name === 'AbortError');
  assert.equal(jobsSnapshot()[0]!.status, 'cancelled', 'cancelled, not failed');
  assert.equal(uploads.length, 0, 'a cancelled take is never written to the catalogue');
});

test('a job queued behind other heavy work says so, and cancels without running the model', async () => {
  const blocker = startJob({ title: 'Something heavy' });
  const { speech, calls } = fakeSpeech();
  let queued = 0;
  const p = generateSpeechAsJob(
    fakeHost([], speech),
    { spokenText: SCRIPT, voice: '', speed: 1 },
    { alive: () => true, onQueued: () => { queued++; } },
  );
  assert.equal(queued, 1, 'the panel is told it is waiting, not left looking stalled');
  await tick();
  assert.equal(calls.length, 0, 'no second model run while the slot is taken');

  const speechJob = jobsSnapshot().find(j => j.title === 'Generating speech')!;
  cancelJob(speechJob.id);
  assert.equal(await p, null, 'cancelled before its turn resolves to nothing');
  assert.equal(calls.length, 0, 'and the model never ran');
  blocker.finish();
});
