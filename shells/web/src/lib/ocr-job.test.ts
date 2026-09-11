// SPDX-License-Identifier: MPL-2.0
/**
 * "Read text" as a WP-F background job (lib/ocr-job.ts).
 *
 * What is pinned here is what moving the read OFF the button must not have broken:
 *   - the job is registered heavy + cancellable and named for the toast;
 *   - its cancel really ABORTS the reader (the signal reaches `host.ocr.run`), and a
 *     cancel is not a failure - no onComplete, no onError, no error toast;
 *   - `onSettled` fires on EVERY terminal path including that cancel, because it is
 *     the only thing that gives a caller's "Reading…" button its label back;
 *   - the OcrResult reaches onComplete unchanged (this job invents nothing - no
 *     asset, no provenance, just text);
 *   - a first-run model download surfaces as its own progress phase with a real
 *     percentage, so a multi-MB fetch never looks like a hung read;
 *   - the caller's own run options survive, while `signal`/`onProgress` are the
 *     job's to own.
 *
 * `host.ocr` is a stub, so this runs headless - no worker, no wasm, no weights.
 *
 * Run directly:  node --test shells/web/src/lib/ocr-job.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { __resetJobsForTest, jobsSnapshot, cancelJob } from './jobs.ts';
import { startOcrJob, runOcrJob, reportOcrProgress, type OcrJobHost } from './ocr-job.ts';
import type { OcrFrame, OcrOpts, OcrResult } from '@lolly-tools/core/host-v1';

// ── fixture ───────────────────────────────────────────────────────────────────

const frame = (w = 8, h = 4): OcrFrame => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });

const result = (text = 'hello world'): OcrResult => ({
  text,
  lines: [{ text, confidence: 0.9, box: { x: 0, y: 0, w: 8, h: 4 } }],
  lang: 'en',
});

interface Recorded {
  runOpts: OcrOpts[];
  logs: string[];
}

const recorder = (): Recorded => ({ runOpts: [], logs: [] });

function makeHost(run: (f: OcrFrame, o: OcrOpts) => Promise<OcrResult>, rec: Recorded): OcrJobHost {
  return {
    log: (_lvl: string, msg: string) => { rec.logs.push(msg); },
    ocr: {
      isAvailable: () => true,
      backend: () => 'wasm',
      models: () => [],
      modelBytes: () => 0,
      cached: async () => true,
      canRun: async () => ({ ok: true }),
      run: (f: OcrFrame, o: OcrOpts = {}) => { rec.runOpts.push(o); return run(f, o); },
    },
  } as unknown as OcrJobHost;
}

/** Wait for the job registry to have no queued/running job left. */
async function settle(): Promise<void> {
  for (let i = 0; i < 50; i++) {
    await new Promise<void>((r) => setTimeout(r, 0));
    if (!jobsSnapshot().some((j) => j.status === 'queued' || j.status === 'running')) return;
  }
}

// ── the job wrapper ───────────────────────────────────────────────────────────

test('startOcrJob registers a cancellable heavy job and hands the text back unchanged', async () => {
  __resetJobsForTest();
  const rec = recorder();
  const host = makeHost(async () => result('Ⅰ read this'), rec);
  let landed: OcrResult | null = null;
  let settledCount = 0;
  const job = startOcrJob(host, { frame: frame() }, {
    onComplete: (r) => { landed = r; },
    onSettled: () => { settledCount++; },
  });

  const listed = jobsSnapshot().find((j) => j.id === job.id)!;
  assert.equal(listed.title, 'Reading text', 'the toast names the operation');
  assert.equal(listed.heavy, true, 'wasm inference claims the single heavy slot');
  assert.equal(listed.cancellable, true, 'so the toast shows its ✕');

  await settle();
  assert.equal(jobsSnapshot().find((j) => j.id === job.id)!.status, 'done');
  assert.equal((landed as OcrResult | null)?.text, 'Ⅰ read this', 'the reader\'s text reaches onComplete verbatim');
  assert.equal(settledCount, 1, 'onSettled fires exactly once on the happy path');
});

test('cancelling the job ABORTS the read, writes nothing back, and still settles', async () => {
  __resetJobsForTest();
  const rec = recorder();
  // A read that only settles when its signal aborts, the way a real long run behaves.
  const host = makeHost((_f, o) => new Promise<OcrResult>((_res, rej) => {
    o.signal?.addEventListener('abort', () => {
      const err = new Error('aborted'); err.name = 'AbortError'; rej(err);
    });
  }), rec);
  let completed = false;
  let failed = false;
  let settledCount = 0;
  const job = startOcrJob(host, { frame: frame() }, {
    onComplete: () => { completed = true; },
    onError: () => { failed = true; },
    onSettled: () => { settledCount++; },
  });

  await job.started;
  assert.equal(rec.runOpts.length, 1, 'the read started');
  assert.ok(rec.runOpts[0]!.signal, 'and it was handed a signal to abort with');

  cancelJob(job.id);
  assert.equal(rec.runOpts[0]!.signal!.aborted, true, 'the job cancel really aborts the reader');
  await settle();

  assert.equal(jobsSnapshot().find((j) => j.id === job.id)!.status, 'cancelled');
  assert.equal(completed, false);
  assert.equal(failed, false, 'a cancel is not a failure - no error toast, no onError');
  assert.equal(settledCount, 1, 'the only hook a cancelled read fires - the caller\'s button depends on it');
});

test('a failed read fails the job, logs it, and reports through onError', async () => {
  __resetJobsForTest();
  const rec = recorder();
  const host = makeHost(async () => { throw new Error('the text could not be read'); }, rec);
  let seen: unknown = null;
  let settledCount = 0;
  const job = startOcrJob(host, { frame: frame() }, {
    onError: (e) => { seen = e; },
    onSettled: () => { settledCount++; },
  });
  await settle();

  const listed = jobsSnapshot().find((j) => j.id === job.id)!;
  assert.equal(listed.status, 'failed');
  assert.equal(listed.error, 'the text could not be read');
  assert.ok(seen, 'onError saw the failure');
  assert.deepEqual(rec.logs, ['Read text failed'], 'and it was logged once');
  assert.equal(settledCount, 1, 'a failure settles too');
});

test('the caller\'s run options survive; signal and onProgress belong to the job', async () => {
  __resetJobsForTest();
  const rec = recorder();
  const host = makeHost(async () => result(), rec);
  startOcrJob(host, { frame: frame(), opts: { model: 'ppocr-v5-en', minConfidence: 0.4, singleLine: true } });
  await settle();

  const o = rec.runOpts[0]!;
  assert.equal(o.model, 'ppocr-v5-en');
  assert.equal(o.minConfidence, 0.4);
  assert.equal(o.singleLine, true);
  assert.ok(o.signal, 'the job supplies the abort signal');
  assert.equal(typeof o.onProgress, 'function', 'and the progress fan-out');
});

// ── the driver on its own ─────────────────────────────────────────────────────

test('runOcrJob hands back nothing when a cancel landed while the reply was in flight', async () => {
  const rec = recorder();
  const host = makeHost(async () => result(), rec);
  const out = await runOcrJob(host, { frame: frame() }, { isCancelled: () => true });
  assert.equal(out, null, 'the caller asked for this not to happen, so it gets no result');
});

test('runOcrJob refuses plainly on a shell with no reader', async () => {
  const host = { log: () => {} } as unknown as OcrJobHost;
  await assert.rejects(() => runOcrJob(host, { frame: frame() }), /not available/);
});

// ── progress mapping ──────────────────────────────────────────────────────────

test('a first-run model download reports a real percentage under its own note', () => {
  const seen: Array<[number, number, string | undefined]> = [];
  const ctx = { onProgress: (d: number, t: number, n?: string) => { seen.push([d, t, n]); } };
  reportOcrProgress(ctx, { phase: 'download', loaded: 5_000_000, total: 10_000_000 });
  assert.deepEqual(seen[0], [50, 100, 'Downloading the model…'],
    'a multi-MB first-use fetch must never look like a hung read');
});

test('a download with no content-length pulses rather than inventing a number', () => {
  const seen: Array<[number, number, string | undefined]> = [];
  const ctx = { onProgress: (d: number, t: number, n?: string) => { seen.push([d, t, n]); } };
  reportOcrProgress(ctx, { phase: 'download', loaded: 1234, total: null });
  assert.deepEqual(seen[0], [0, 0, 'Downloading the model…'], 'total <= 0 is the indeterminate form');
});

test('detection is indeterminate; recognition quotes its box-of-boxes fraction', () => {
  const seen: Array<[number, number, string | undefined]> = [];
  const ctx = { onProgress: (d: number, t: number, n?: string) => { seen.push([d, t, n]); } };
  reportOcrProgress(ctx, { phase: 'detect' });
  reportOcrProgress(ctx, { phase: 'recognize', fraction: 0.25 });
  assert.deepEqual(seen[0], [0, 0, 'Finding text…'], 'one forward pass has nothing to report inside it');
  assert.deepEqual(seen[1], [25, 100, 'Reading text…']);
});

test('a fraction outside 0..1 is clamped, never rendered as a bar past its end', () => {
  const seen: Array<[number, number, string | undefined]> = [];
  const ctx = { onProgress: (d: number, t: number, n?: string) => { seen.push([d, t, n]); } };
  reportOcrProgress(ctx, { phase: 'recognize', fraction: 1.4 });
  reportOcrProgress(ctx, { phase: 'recognize', fraction: -0.2 });
  assert.equal(seen[0]![0], 100);
  assert.equal(seen[1]![0], 0);
});
