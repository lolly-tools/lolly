// SPDX-License-Identifier: MPL-2.0
/**
 * /verify's watermark work as BACKGROUND JOBS (views/valid.ts, plans/124 WP-F).
 *
 * Run: node --import ./tests/css-stub.mjs --test shells/web/src/views/valid-deepscan-job.test.ts
 *
 * Three runs on that page were long, heavy and unobservable: the banner's
 * "Enable" (~90 MB of detectors, then a scan of the whole batch), the passive
 * auto-scan (completely silent - a minute of invisible CPU on a big drop), and
 * the Tier-2 Imprint grid search (a frozen button label). All three go through
 * the registry now. What these pin:
 *
 *   - a run REGISTERS one heavy, cancellable job and reports i-of-N over the files;
 *   - cancel is HONEST at the granularity available - no detector here takes an
 *     AbortSignal, so it lands BETWEEN files: the one in flight finishes, the next
 *     never starts, and the partial result is never announced;
 *   - SILENT ON NEGATIVE survives the conversion: a scan that finds nothing
 *     announces nothing. Only a positive count is ever spoken;
 *   - the same batch cannot be double-started, which is what a re-entered view
 *     (#/verify?src=…, the catalog hand-off) would otherwise do.
 *
 * The drivers take a sink and a `scanOne`, so everything below runs with no
 * detector, no canvas and no DOM - the file's own paint path is guarded by
 * livePaintTarget/liveBtn inside mountValid and is not exercised here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
// valid.ts reads `window.__toolIndex` - the same type-only augmentation
// valid-appended.test.ts needs (nothing executes from sync.ts at runtime).
import type {} from '../catalog/sync.ts';
import {
  batchKey, runScanBatch, startScanJob, scanJobActive, announceScanResult, __resetScanJobsForTest,
  type ScanJobSink, type ScanRunResult,
} from './valid.ts';
import { jobsSnapshot, cancelJob, __resetJobsForTest, type Job } from '../lib/jobs.ts';

// ── helpers ──────────────────────────────────────────────────────────────────

async function settle(n = 12): Promise<void> {
  for (let i = 0; i < n; i++) await new Promise<void>((r) => setTimeout(r, 0));
}

function reset(): void {
  __resetScanJobsForTest();
  __resetJobsForTest();
}

/** A stand-in File - batchKey only ever reads these three fields. */
const file = (name: string, size = 10, lastModified = 1): File =>
  ({ name, size, lastModified }) as unknown as File;

/** A sink that records every progress call, with a cancel flag a test can flip. */
function makeSink(): ScanJobSink & { calls: Array<[number, number, string | undefined]>; stop(): void } {
  let cancelled = false;
  const calls: Array<[number, number, string | undefined]> = [];
  return {
    get cancelled(): boolean { return cancelled; },
    progress(done, total, note): void { calls.push([done, total, note]); },
    calls,
    stop(): void { cancelled = true; },
  };
}

const titles = (): string[] => jobsSnapshot().map((j: Job) => j.title);
const scanJobs = (): readonly Job[] => jobsSnapshot();

// ── the batch driver: i-of-N, in order, counting positives ───────────────────

test('runScanBatch visits every index in order and reports i-of-N', async () => {
  const sink = makeSink();
  const seen: number[] = [];
  const r = await runScanBatch(sink, [0, 2, 5], async (i) => { seen.push(i); return i === 2 ? 1 : 0; });

  assert.deepEqual(seen, [0, 2, 5], 'sequential, in the order given');
  assert.deepEqual(r, { scanned: 3, positives: 1, cancelled: false });
  // One note-carrying tick per file, then a bare final tick that clears the note.
  assert.deepEqual(sink.calls.map(([done, total]) => `${done}/${total}`), ['0/3', '1/3', '2/3', '3/3']);
  assert.ok(sink.calls[0]![2], 'a per-file tick carries a note');
  assert.equal(sink.calls[3]![2], undefined, 'the final tick has none - the run is over');
});

// ── cancel is honest: BETWEEN files, never mid-inference ──────────────────────

test('cancel stops the batch between files - the one in flight finishes, the next never starts', async () => {
  const sink = makeSink();
  const seen: number[] = [];
  const r = await runScanBatch(sink, [0, 1, 2, 3], async (i) => {
    seen.push(i);
    if (i === 1) sink.stop();   // the ✕ lands while file 1 is being scanned
    return 0;
  });

  assert.deepEqual(seen, [0, 1], 'file 1 ran to completion; 2 and 3 were never started');
  assert.equal(r.cancelled, true);
  assert.equal(r.scanned, 2, 'the count is what actually happened, not what was asked for');
});

test('a run cancelled before its first file scans nothing at all', async () => {
  const sink = makeSink();
  sink.stop();
  const seen: number[] = [];
  const r = await runScanBatch(sink, [0, 1], async (i) => { seen.push(i); return 0; });
  assert.deepEqual(seen, []);
  assert.deepEqual(r, { scanned: 0, positives: 0, cancelled: true });
});

// ── the registry wiring ──────────────────────────────────────────────────────

test('startScanJob registers ONE heavy, cancellable job and finishes it with the count', async () => {
  reset();
  const done: ScanRunResult[] = [];
  const handle = startScanJob('k1', 'Checking for invisible watermarks',
    (sink) => runScanBatch(sink, [0, 1], async () => 1),
    { onDone: (r) => done.push(r) });
  assert.ok(handle, 'a handle came back');
  await settle();

  const jobs = scanJobs();
  const scan = jobs.find((j) => j.title === 'Checking for invisible watermarks')!;
  assert.ok(scan, 'the scan job is in the registry');
  assert.equal(scan.heavy, true, 'heavy: it shares the one serial slot with matte/upscale/video');
  assert.equal(scan.cancellable, true, 'the toast shows its ✕');
  assert.equal(scan.status, 'done');
  assert.deepEqual(scan.result, { scanned: 2, positives: 2, cancelled: false });
  assert.deepEqual(done, [{ scanned: 2, positives: 2, cancelled: false }]);
  reset();
});

test('cancelling the registered job stops the run and never announces a partial count', async () => {
  reset();
  const seen: number[] = [];
  const done: ScanRunResult[] = [];
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });

  const handle = startScanJob('k-cancel', 'Checking for invisible watermarks',
    (sink) => runScanBatch(sink, [0, 1, 2], async (i) => {
      seen.push(i);
      if (i === 0) await gate;   // hold inside file 0 so the cancel lands mid-file
      return 1;                  // every file is a hit, so a partial count would show
    }),
    { onDone: (r) => done.push(r) });
  await settle(2);
  assert.deepEqual(seen, [0], 'the run is inside its first file');

  cancelJob(handle!.id);
  release();
  await settle();

  assert.deepEqual(seen, [0], 'the file in flight finished; nothing after it started');
  assert.equal(jobsSnapshot().find((j) => j.id === handle!.id)!.status, 'cancelled');
  assert.deepEqual(done, [{ scanned: 1, positives: 1, cancelled: true }], 'the caller is told it was cancelled');
  assert.deepEqual(titles().filter((x) => x !== 'Checking for invisible watermarks'), [],
    'a cancelled run announces NOTHING - not even the hit it already had');
  reset();
});

test('a thrown run fails the job with its human message, and calls onError', async () => {
  reset();
  const errs: unknown[] = [];
  startScanJob('k-fail', 'Checking for invisible watermarks',
    async () => { throw new Error('Couldn’t download the watermark detector.'); },
    { onError: (e) => errs.push(e) });
  await settle();

  const job = jobsSnapshot()[0]!;
  assert.equal(job.status, 'failed');
  assert.equal(job.error, 'Couldn’t download the watermark detector.', 'the toast row shows the human string');
  assert.equal(errs.length, 1);
  reset();
});

// ── silent on negative ───────────────────────────────────────────────────────

test('a scan that finds nothing announces nothing (the report’s rule, kept)', async () => {
  reset();
  startScanJob('k-clean', 'Checking for invisible watermarks',
    (sink) => runScanBatch(sink, [0, 1, 2], async () => 0));
  await settle();

  assert.deepEqual(titles(), ['Checking for invisible watermarks'],
    'exactly one job - absence is never spoken as a verdict, in the toast or the report');
  reset();
});

test('a scan that finds something announces the COUNT, on a light job so it survives the view', async () => {
  reset();
  startScanJob('k-hits', 'Checking for invisible watermarks',
    (sink) => runScanBatch(sink, [0, 1, 2], async (i) => (i === 0 ? 2 : 0)));
  await settle();

  const announcement = jobsSnapshot().find((j) => j.title !== 'Checking for invisible watermarks');
  assert.ok(announcement, 'the finished scan spoke');
  assert.match(announcement!.title, /2/, 'and the count is in the title - the only field a done row renders');
  assert.equal(announcement!.heavy, false, 'light: it must never occupy the serial heavy slot');
  assert.equal(announcement!.cancellable, false, 'there is nothing left to cancel');
  assert.equal(announcement!.status, 'done');
  reset();
});

test('the announcement wording is overridable, and still silent on zero', async () => {
  reset();
  announceScanResult(0, () => 'should never appear');
  assert.deepEqual(titles(), [], 'zero says nothing, whatever wording was offered');
  announceScanResult(1, () => 'Resized Lolly Imprint recovered');
  assert.deepEqual(titles(), ['Resized Lolly Imprint recovered'],
    'the Imprint search speaks in its own words, not the generic watermark count');
  reset();
});

// ── no double-start ──────────────────────────────────────────────────────────

test('the same batch cannot be started twice while its run is live', async () => {
  reset();
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const runs: string[] = [];

  const first = startScanJob('same-batch', 'Checking for invisible watermarks', async (sink) => {
    runs.push('first');
    await gate;
    return runScanBatch(sink, [0], async () => 0);
  });
  await settle(2);
  assert.ok(first);
  assert.equal(scanJobActive('same-batch'), true);

  const second = startScanJob('same-batch', 'Checking for invisible watermarks', async () => {
    runs.push('second');
    return { scanned: 0, positives: 0, cancelled: false };
  });
  assert.equal(second, null, 'a re-entered view joins the running job instead of queueing a duplicate');
  assert.deepEqual(runs, ['first'], 'and the duplicate work never ran');
  assert.equal(jobsSnapshot().length, 1, 'one job in the registry, not two');

  release();
  await settle();
  assert.equal(scanJobActive('same-batch'), false, 'the key frees the moment the run settles');

  const third = startScanJob('same-batch', 'Checking for invisible watermarks',
    (sink) => runScanBatch(sink, [0], async () => 0));
  assert.ok(third, 'a later drop of the same files can be scanned again');
  await settle();
  reset();
});

test('a failed run frees its key too, so a retry is possible', async () => {
  reset();
  startScanJob('retry', 'Checking for invisible watermarks', async () => { throw new Error('nope'); });
  await settle();
  assert.equal(scanJobActive('retry'), false);
  reset();
});

// ── batch identity ───────────────────────────────────────────────────────────

test('batchKey tells two drops apart and survives a re-render of the same one', () => {
  const a = [file('one.png', 100, 5), file('two.png', 200, 6)];
  assert.equal(batchKey(a), batchKey([file('one.png', 100, 5), file('two.png', 200, 6)]),
    'the same files re-dropped are the same batch - that is what stops the double-start');
  assert.notEqual(batchKey(a), batchKey([file('one.png', 100, 5)]), 'a different file list is a different batch');
  assert.notEqual(batchKey(a), batchKey([file('one.png', 101, 5), file('two.png', 200, 6)]), 'size counts');
  assert.notEqual(batchKey(a), batchKey([file('one.png', 100, 9), file('two.png', 200, 6)]), 'mtime counts');
  assert.notEqual(batchKey(a), batchKey(a, 'imprint:0'),
    'a per-file Imprint search is its own run, not the batch scan');
  assert.notEqual(batchKey(a, 'imprint:0'), batchKey(a, 'imprint:1'), 'and one per file');
});

// ── the three call sites actually go through the wrapper ─────────────────────

test('all three heavy runs in valid.ts are job-wrapped, and none is awaited inline', async () => {
  const { readFileSync } = await import('node:fs');
  const { dirname, join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'valid.ts'), 'utf8');

  // The banner's Enable and the passive arm both go through startBatchScan; the
  // Tier-2 search starts its own job. If any of these regresses to a bare loop the
  // toast loses the run and the ✕ goes with it.
  assert.match(src, /function enableDeepScan[\s\S]{0,700}startBatchScan\(\{ download: true/,
    'Enable downloads + scans inside ONE job');
  assert.match(src, /function armDeepScan[\s\S]{0,900}startBatchScan\(\)/,
    'the passive auto-scan is a job, not a silent loop');
  assert.match(src, /function rescanImprint[\s\S]{0,900}startScanJob\(/,
    'the Tier-2 Imprint search is a job');
  assert.ok(!/scanAllDecodable/.test(src), 'the old un-jobbed batch loop is gone');
  // The click handler must not await these - the whole point is that they outlive
  // the view, so the handler hands off and returns.
  assert.match(src, /if \(enable\) enableDeepScan\(enable\);/);
  assert.match(src, /if \(rescan\) rescanImprint\(rescan\);/);
});
