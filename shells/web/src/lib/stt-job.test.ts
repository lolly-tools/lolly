// SPDX-License-Identifier: MPL-2.0
/**
 * On-device transcription as a background job (lib/stt-job.ts).
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/lib/stt-job.test.ts
 *
 * The seams that matter are the ones a user falls through when they stop
 * watching a run that costs a ~77 MB download and minutes of wasm inference:
 *  - the run is registered as a HEAVY, CANCELLABLE job before anything is
 *    awaited, so the global toast owns it from any view;
 *  - progress mirrors the consent sheet's own reading - the download phase and
 *    the inference, with an unknowable fraction reported as indeterminate rather
 *    than as a made-up percentage;
 *  - a transcript that finishes with NOBODY there is never discarded: it is
 *    stashed in memory, written onto the clip's own user-asset record in exactly
 *    the shape the caption ladder reads back, and the completion says so;
 *  - cancel is honest: the signal really aborts, the job ends `cancelled`, and a
 *    cancelled run persists and stashes nothing.
 *
 * jsdom because announce() writes to a live region; everything else here is the
 * real module against a hand-settled speech bridge.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/', pretendToBeVisual: true });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.Event = dom.window.Event;
// announce() schedules its text through rAF, which pretendToBeVisual puts on
// dom.window only - not on the bare global this file runs in.
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => { setTimeout(() => cb(0), 0); return 0; }) as unknown as typeof requestAnimationFrame;

import {
  persistTranscript, runTranscribeJob, startTranscribeJob, stashTranscript, stashedTranscript,
  transcribeProgressFraction, transcriptKey, __resetTranscriptStashForTest,
  type SttJobHost,
} from './stt-job.ts';
import { cancelJob, jobsSnapshot, __resetJobsForTest } from './jobs.ts';
import { TRANSCRIPT_META_KEY, transcriptWordsOf } from '../views/timeline-captions.ts';
import type { SpeechProgress, SpeechTranscript, SpeechWordTiming } from '@lolly-tools/core/host-v1';

const WORDS: SpeechWordTiming[] = [
  { text: 'hello', start: 0, end: 0.4 },
  { text: 'there', start: 0.5, end: 0.9 },
];

const transcript = (words = WORDS): SpeechTranscript => ({
  text: words.map(w => w.text).join(' '), words, lang: 'en', granularity: 'word',
});

/** Let queued microtasks (and the rAF shim's setTimeout) drain. */
const tick = async (n = 3): Promise<void> => { for (let i = 0; i < n; i++) await new Promise<void>(r => { setTimeout(r, 0); }); };

/** What a screen reader would have been told, politely. */
const announced = (): string =>
  Array.from(dom.window.document.querySelectorAll('[data-a11y-live]'))
    .map(el => el.textContent ?? '').filter(Boolean).join(' | ');

const clearAnnouncements = (): void => {
  for (const el of Array.from(dom.window.document.querySelectorAll('[data-a11y-live]'))) el.textContent = '';
};

/** A host.speech whose transcribe() this test settles by hand, rejecting with an
 *  AbortError when the signal fires - what bridge/speech.ts really does. */
function fakeSpeech(): {
  speech: NonNullable<SttJobHost['speech']>;
  calls: { src: unknown; opts: { signal?: AbortSignal; onProgress?: (p: SpeechProgress) => void; lang?: string } }[];
  resolve: (t: SpeechTranscript) => void;
  reject: (e: unknown) => void;
  report: (p: SpeechProgress) => void;
} {
  const calls: { src: unknown; opts: { signal?: AbortSignal; onProgress?: (p: SpeechProgress) => void; lang?: string } }[] = [];
  let settle: { resolve: (t: SpeechTranscript) => void; reject: (e: unknown) => void } | null = null;
  const speech = {
    isAvailable: () => true,
    cached: async () => true,
    modelBytes: () => 0,
    voices: async () => [],
    synthesize: async () => { throw new Error('not used'); },
    transcribeAvailable: () => true,
    transcribeCached: async () => true,
    transcribeModelBytes: () => 77_000_000,
    transcribe(src: unknown, opts: { signal?: AbortSignal; onProgress?: (p: SpeechProgress) => void; lang?: string } = {}) {
      calls.push({ src, opts });
      return new Promise<SpeechTranscript>((resolve, reject) => {
        settle = { resolve, reject };
        opts.signal?.addEventListener('abort', () => {
          reject(Object.assign(new Error('speech transcription aborted'), { name: 'AbortError' }));
        }, { once: true });
      });
    },
  } as unknown as NonNullable<SttJobHost['speech']>;
  return {
    speech, calls,
    resolve: (t) => settle?.resolve(t),
    reject: (e) => settle?.reject(e),
    report: (p) => calls.at(-1)?.opts.onProgress?.(p),
  };
}

/** A user-asset store: get() reads it, _updateUserAssetMeta() annotates it. */
function fakeAssets(records: Record<string, { source: string; meta?: Record<string, unknown> }> = {}): {
  api: NonNullable<SttJobHost['assets']>;
  writes: { id: string; meta: Record<string, unknown> }[];
  records: Record<string, { source: string; meta?: Record<string, unknown> }>;
} {
  const writes: { id: string; meta: Record<string, unknown> }[] = [];
  return {
    records, writes,
    api: {
      async get(id: string) {
        const rec = records[id];
        return rec ? { source: rec.source, id, type: 'audio', format: 'wav', url: 'blob:clip', meta: rec.meta } as never : null;
      },
      async _updateUserAssetMeta(id: string, meta: Record<string, unknown>) {
        writes.push({ id, meta });
        if (records[id]) records[id]!.meta = meta;
      },
    },
  };
}

beforeEach(() => {
  __resetJobsForTest();
  __resetTranscriptStashForTest();
  clearAnnouncements();
});

// ── the job registration ─────────────────────────────────────────────────────

test('the run registers a heavy, cancellable job before anything is awaited', () => {
  const sp = fakeSpeech();
  startTranscribeJob({ speech: sp.speech }, { src: 'blob:clip' });
  const jobs = jobsSnapshot();
  assert.equal(jobs.length, 1, 'one job, registered synchronously');
  assert.equal(jobs[0]!.heavy, true, 'wasm inference claims the single serial slot');
  assert.equal(jobs[0]!.cancellable, true, 'the toast must be able to show a ✕ that really aborts');
  assert.equal(jobs[0]!.title, 'Generating subtitles');
});

test('a custom title rides through to the toast', () => {
  const sp = fakeSpeech();
  startTranscribeJob({ speech: sp.speech }, { src: 'blob:clip', title: 'Transcribing take 3' });
  assert.equal(jobsSnapshot()[0]!.title, 'Transcribing take 3');
});

// ── progress mirrors the sheet's own reading ─────────────────────────────────

test('transcribeProgressFraction reads a fraction, bytes, or honest nothing', () => {
  assert.equal(transcribeProgressFraction({ phase: 'download', fraction: 0.25 }), 0.25);
  assert.equal(transcribeProgressFraction({ phase: 'download', loaded: 50, total: 200 }), 0.25);
  assert.equal(transcribeProgressFraction({ phase: 'synthesis' }), null, 'no reading is null, never 0');
  assert.equal(transcribeProgressFraction({ phase: 'download', loaded: 5, total: null }), null);
  assert.equal(transcribeProgressFraction({ phase: 'download', fraction: 4 }), 1, 'clamped');
  assert.equal(transcribeProgressFraction({ phase: 'download', fraction: Number.NaN }), null);
});

test('both phases feed the one bar: the model download, then the listening', async () => {
  const sp = fakeSpeech();
  const job = startTranscribeJob({ speech: sp.speech }, { src: 'blob:clip' });
  await tick();
  sp.report({ phase: 'download', loaded: 38_500_000, total: 77_000_000 });
  const dl = jobsSnapshot().find(j => j.id === job.id)!;
  assert.deepEqual({ ...dl.progress }, { done: 50, total: 100, note: 'Downloading the speech model…' });

  sp.report({ phase: 'synthesis', fraction: 0.5 });
  const run = jobsSnapshot().find(j => j.id === job.id)!;
  assert.deepEqual({ ...run.progress }, { done: 50, total: 100, note: 'Listening to the clip…' });

  // An unknowable fraction is reported as INDETERMINATE (total 0 - the toast's
  // candy stripe), never as a made-up 0%.
  sp.report({ phase: 'synthesis' });
  assert.equal(jobsSnapshot().find(j => j.id === job.id)!.progress!.total, 0);
  sp.resolve(transcript());
  await tick();
});

// ── the panel-gone completion: nothing is ever discarded ─────────────────────

test('with nobody left to place them, the words are stashed, persisted, and announced', async () => {
  const sp = fakeSpeech();
  const assets = fakeAssets({ 'user/recording/1': { source: 'user', meta: { name: 'take.wav', durationMs: 4200 } } });
  const settled: string[] = [];
  const job = startTranscribeJob(
    { speech: sp.speech, assets: assets.api },
    { src: 'blob:clip', assetId: 'user/recording/1' },
    { onComplete: () => false, onSettled: () => settled.push('settled') },   // the panel is gone
  );
  await tick();
  sp.resolve(transcript());
  await tick();

  // 1. the in-memory stash, under BOTH the asset id and the source URL
  assert.deepEqual(stashedTranscript('user/recording/1'), WORDS);
  assert.deepEqual(stashedTranscript('blob:clip'), WORDS);

  // 2. the record annotation, MERGED into the meta that was already there
  assert.equal(assets.writes.length, 1, 'exactly one meta write');
  const meta = assets.writes[0]!.meta;
  assert.equal(meta.name, 'take.wav', 'the existing meta survives the annotation');
  assert.equal(meta.durationMs, 4200);
  assert.equal(meta.tts, undefined, 'a transcript never claims the clip was synthesised by Lolly');
  // …and the ladder reads back exactly what was written (the writer/reader contract).
  assert.deepEqual(transcriptWordsOf(meta), WORDS);
  assert.equal((meta[TRANSCRIPT_META_KEY] as { engine: string }).engine, 'whisper');

  // 3. the job's own record of what happened, and the announcement
  const done = jobsSnapshot().find(j => j.id === job.id)!;
  assert.equal(done.status, 'done');
  assert.deepEqual(done.result, { words: WORDS, applied: false, persisted: true });
  assert.match(announced(), /transcript is ready and saved with the clip/);
  assert.deepEqual(settled, ['settled'], 'the caller\'s guard is released exactly once');
});

test('a source with no record of its own still keeps the transcript for this tab, and says so', async () => {
  const sp = fakeSpeech();
  const assets = fakeAssets();                       // get() finds nothing to annotate
  startTranscribeJob(
    { speech: sp.speech, assets: assets.api },
    { src: 'https://example.test/clip.mp3' },
    { onComplete: () => false },
  );
  await tick();
  sp.resolve(transcript());
  await tick();

  assert.equal(assets.writes.length, 0, 'nothing to write onto');
  assert.deepEqual(stashedTranscript('https://example.test/clip.mp3'), WORDS, 'the session stash still holds it');
  assert.match(announced(), /while this tab stays open/);
});

test('a library asset is never annotated (only the user store can be)', async () => {
  const sp = fakeSpeech();
  const assets = fakeAssets({ 'suse/audio/bed': { source: 'library', meta: { name: 'bed.mp3' } } });
  startTranscribeJob(
    { speech: sp.speech, assets: assets.api },
    { src: 'blob:bed', assetId: 'suse/audio/bed' },
    { onComplete: () => false },
  );
  await tick();
  sp.resolve(transcript());
  await tick();
  assert.equal(assets.writes.length, 0);
  assert.deepEqual(stashedTranscript('suse/audio/bed'), WORDS, 'still not lost');
});

test('a live surface that PLACES the captions gets no announcement, and the work is kept anyway', async () => {
  const sp = fakeSpeech();
  const assets = fakeAssets({ 'user/recording/1': { source: 'user', meta: {} } });
  const handed: SpeechWordTiming[][] = [];
  const job = startTranscribeJob(
    { speech: sp.speech, assets: assets.api },
    { src: 'blob:clip', assetId: 'user/recording/1' },
    { onComplete: (w) => { handed.push(w); return true; } },
  );
  await tick();
  sp.resolve(transcript());
  await tick();

  assert.deepEqual(handed, [WORDS], 'the surface got the words');
  assert.equal(announced(), '', 'the panel announces the caption boxes itself');
  assert.deepEqual(jobsSnapshot().find(j => j.id === job.id)!.result, { words: WORDS, applied: true, persisted: true });
  // Persisted even on the happy path, so a SECOND Generate subtitles on this clip
  // costs nothing at all.
  assert.deepEqual(transcriptWordsOf(assets.records['user/recording/1']!.meta), WORDS);
});

test('a clip with no speech in it says so, and files nothing', async () => {
  const sp = fakeSpeech();
  const assets = fakeAssets({ 'user/recording/1': { source: 'user', meta: {} } });
  const job = startTranscribeJob(
    { speech: sp.speech, assets: assets.api },
    { src: 'blob:clip', assetId: 'user/recording/1' },
    { onComplete: () => false },
  );
  await tick();
  sp.resolve(transcript([]));
  await tick();

  assert.equal(assets.writes.length, 0, 'an empty transcript is not worth a record write');
  assert.equal(stashedTranscript('user/recording/1'), null);
  assert.deepEqual(jobsSnapshot().find(j => j.id === job.id)!.result, { words: [], applied: false, persisted: false });
  assert.match(announced(), /No speech was found/);
});

// ── cancel + failure ─────────────────────────────────────────────────────────

test('cancel really aborts the transcription, and a cancelled run persists nothing', async () => {
  const sp = fakeSpeech();
  const assets = fakeAssets({ 'user/recording/1': { source: 'user', meta: {} } });
  const settled: string[] = [];
  const errors: unknown[] = [];
  const job = startTranscribeJob(
    { speech: sp.speech, assets: assets.api },
    { src: 'blob:clip', assetId: 'user/recording/1' },
    { onComplete: () => true, onError: (e) => errors.push(e), onSettled: () => settled.push('settled') },
  );
  await tick();
  assert.equal(sp.calls[0]!.opts.signal?.aborted, false, 'running, not aborted');

  cancelJob(job.id);
  await tick();

  assert.equal(sp.calls[0]!.opts.signal?.aborted, true, 'the ✕ reaches the speech bridge');
  assert.equal(jobsSnapshot().find(j => j.id === job.id)!.status, 'cancelled');
  assert.equal(assets.writes.length, 0, 'nothing half-transcribed is filed');
  assert.equal(stashedTranscript('user/recording/1'), null);
  assert.deepEqual(errors, [], 'a cancel is not a failure');
  assert.deepEqual(settled, ['settled'], 'the guard is still released');
});

test('a failed run fails the job with the message, and still releases the guard', async () => {
  const sp = fakeSpeech();
  const logs: string[] = [];
  const settled: string[] = [];
  const errors: unknown[] = [];
  const job = startTranscribeJob(
    { speech: sp.speech, log: (_l, m) => logs.push(m) },
    { src: 'blob:clip' },
    { onError: (e) => errors.push(e), onSettled: () => settled.push('settled') },
  );
  await tick();
  sp.reject(new Error('no audio track'));
  await tick();

  const failed = jobsSnapshot().find(j => j.id === job.id)!;
  assert.equal(failed.status, 'failed');
  assert.equal(failed.error, 'no audio track');
  assert.equal(errors.length, 1);
  assert.deepEqual(settled, ['settled']);
  assert.ok(logs.some(m => m.includes('no audio track')));
});

test('a run cancelled while still QUEUED never reaches the speech bridge', async () => {
  // Occupy the single heavy slot, so the transcription queues behind it.
  const blocker = fakeSpeech();
  startTranscribeJob({ speech: blocker.speech }, { src: 'blob:first' });
  const sp = fakeSpeech();
  const job = startTranscribeJob({ speech: sp.speech }, { src: 'blob:second' });
  await tick();
  assert.equal(sp.calls.length, 0, 'queued, not started');

  cancelJob(job.id);
  await tick();
  assert.equal(sp.calls.length, 0, 'and it never starts');
  assert.equal(jobsSnapshot().find(j => j.id === job.id)!.status, 'cancelled');
});

// ── the pieces, directly ─────────────────────────────────────────────────────

test('runTranscribeJob reports an empty transcript as [] and a cancel as null', async () => {
  const sp = fakeSpeech();
  const p = runTranscribeJob({ speech: sp.speech }, { src: 'blob:clip', lang: 'de' });
  await tick();
  assert.equal(sp.calls[0]!.opts.lang, 'de', 'the language hint rides through');
  sp.resolve(transcript([]));
  assert.deepEqual(await p, []);

  const sp2 = fakeSpeech();
  const p2 = runTranscribeJob({ speech: sp2.speech }, { src: 'blob:clip' }, { isCancelled: () => true });
  await tick();
  sp2.resolve(transcript());
  assert.equal(await p2, null);
});

test('runTranscribeJob refuses a host that cannot transcribe, rather than pretending', async () => {
  await assert.rejects(() => runTranscribeJob({}, { src: 'blob:clip' }), /available/);
});

test('a junk word list from storage is filtered, not trusted', async () => {
  const sp = fakeSpeech();
  const p = runTranscribeJob({ speech: sp.speech }, { src: 'blob:clip' });
  await tick();
  sp.resolve({
    text: 'x', lang: 'en', granularity: 'word',
    words: [
      { text: 'keep', start: 1, end: 2 },
      { text: '  ', start: 2, end: 3 },
      { text: 'backwards', start: 5, end: 4 },
      { text: 'negative', start: -1, end: 1 },
    ] as SpeechWordTiming[],
  });
  assert.deepEqual(await p, [{ text: 'keep', start: 1, end: 2 }]);
});

test('the stash copies in and out, and is bounded', () => {
  const words = [{ text: 'one', start: 0, end: 1 }];
  stashTranscript(words, 'a');
  words[0]!.text = 'mutated';
  assert.equal(stashedTranscript('a')![0]!.text, 'one', 'the stash holds its own copy');
  stashedTranscript('a')![0]!.text = 'mutated too';
  assert.equal(stashedTranscript('a')![0]!.text, 'one', 'and hands out copies');

  for (let i = 0; i < 40; i++) stashTranscript([{ text: `w${i}`, start: 0, end: 1 }], `k${i}`);
  assert.equal(stashedTranscript('k0'), null, 'the oldest entries are evicted');
  assert.ok(stashedTranscript('k39'), 'the newest survive');
  assert.equal(stashedTranscript(''), null, 'an empty key names nothing');
});

test('transcriptKey prefers the permanent asset id, then the URL', () => {
  assert.equal(transcriptKey({ id: 'user/recording/1', url: 'blob:x' } as never), 'user/recording/1');
  assert.equal(transcriptKey({ url: 'blob:x' } as never), 'blob:x');
  assert.equal(transcriptKey('https://example.test/a.mp3'), 'https://example.test/a.mp3');
  assert.equal(transcriptKey(null), '');
});

test('persistTranscript is best-effort: a store that throws is logged, never fatal', async () => {
  const logs: string[] = [];
  const host: SttJobHost = {
    log: (_l, m) => logs.push(m),
    assets: {
      get: async () => ({ source: 'user', id: 'user/recording/1', type: 'audio', format: 'wav', url: 'blob:x', meta: {} } as never),
      _updateUserAssetMeta: async () => { throw new Error('quota'); },
    },
  };
  assert.equal(await persistTranscript(host, 'user/recording/1', WORDS), false);
  assert.ok(logs.some(m => m.includes('quota')));
});
