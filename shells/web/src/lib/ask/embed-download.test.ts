// SPDX-License-Identifier: MPL-2.0
/**
 * The Ask "better matching" model download, as a job (lib/ask/embed-download.ts).
 *
 * Run:  node --test shells/web/src/lib/ask/embed-download.test.ts
 *
 * WHAT THIS PINS. The ~23 MB download used to belong to a DOM node in views/ask.ts:
 * its only progress readout was a `<span>` inside the consent chip, so leaving
 * #/ask killed the readout while the fetches carried on unwatched and unstoppable.
 * Now it is a job, and:
 *   • it is LIGHT - a network download must not hold the single heavy slot that
 *     wasm inference and video transcodes serialise on, nor wait behind one;
 *   • progress reaches the toast in whole MB (the unit the chip quotes the size
 *     in) and every mirror in raw bytes;
 *   • detaching a mirror is what a view teardown does - the download keeps going
 *     and still reaches `done`;
 *   • a second caller (coming back to #/ask mid-download) ATTACHES, replaying the
 *     latest progress, instead of starting a second download of the same bytes;
 *   • cancelling aborts the fetch through the signal downloadAsk already accepts.
 *
 * lib/offline-manager.ts is stubbed at the module boundary: node has no Cache API
 * and there is no manifest to fetch, and the point here is the wiring, not the
 * bytes. Everything else - the job registry, the fan-out - is the real thing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// The stub records each call and hands the test the promise's own controls, so
// progress and completion are driven from the assertions.
registerHooks({
  load(url: string, ctx: unknown, next: (u: string, c: unknown) => unknown) {
    if (url.endsWith('lib/offline-manager.ts')) {
      return {
        format: 'module', shortCircuit: true,
        source: `export async function downloadAsk(manifest, opts = {}) {
          const calls = (globalThis.__askDownloads ??= []);
          const rec = { manifest, opts, aborted: false, settle: null, blowUp: null };
          calls.push(rec);
          return await new Promise((resolve, reject) => {
            rec.settle = resolve; rec.blowUp = reject;
            opts.signal?.addEventListener('abort', () => {
              rec.aborted = true;
              reject(new Error('download aborted'));
            }, { once: true });
          });
        }`,
      };
    }
    return next(url, ctx);
  },
} as Parameters<typeof registerHooks>[0]);

const { downloadEmbedModel, embedDownloadActive, __resetEmbedDownloadForTest } = await import('./embed-download.ts');
const { startJob, cancelJob, jobsSnapshot, __resetJobsForTest } = await import('../jobs.ts');

// ── harness ──────────────────────────────────────────────────────────────────

interface StubCall {
  opts: { signal?: AbortSignal; onProgress?: (p: { loaded: number; total: number; done: number; count: number }) => void };
  aborted: boolean;
  settle: (v: unknown) => void;
  blowUp: (e: unknown) => void;
}
const calls = (): StubCall[] => ((globalThis as unknown as { __askDownloads?: StubCall[] }).__askDownloads ??= []);

const TITLE = 'Downloading the matching model';
const job = () => jobsSnapshot().find((j) => j.title === TITLE);
/** A precache manifest is opaque to this module - it only forwards it. */
const MANIFEST = { version: 'test', groups: { embed: [{ url: '/models/embed/x', size: 23_685_047 }] } } as never;

async function tick(n = 6): Promise<void> {
  for (let i = 0; i < n; i++) await new Promise<void>((r) => { setTimeout(r, 0); });
}

function reset(): void {
  __resetEmbedDownloadForTest();
  __resetJobsForTest();
  (globalThis as unknown as { __askDownloads: StubCall[] }).__askDownloads = [];
}

const progress = (loaded: number, total: number): { loaded: number; total: number; done: number; count: number } =>
  ({ loaded, total, done: 0, count: 5 });

// ── the slot ─────────────────────────────────────────────────────────────────

test('the download is a LIGHT job: it neither takes nor waits for the heavy slot', async () => {
  reset();
  // Something memory-hungry is already running, and stays running.
  const video = startJob({ title: 'Removing background' });
  await video.started;

  downloadEmbedModel(MANIFEST);
  await tick();

  const j = job();
  assert.ok(j, 'the download announced itself');
  assert.equal(j.heavy, false, 'a network fetch holds nothing the inference slot is for');
  assert.equal(j.status, 'running', 'and it did not queue behind the video job');
  assert.equal(calls().length, 1, 'the fetch actually started');
  assert.equal(jobsSnapshot().find((x) => x.title === 'Removing background')?.status, 'running',
    'nor did it displace the heavy job');

  assert.equal(j.cancellable, true, 'the toast can stop a 23 MB download');
  video.finish();
  calls()[0]!.settle(undefined);
  await tick();
});

// ── progress ─────────────────────────────────────────────────────────────────

test('progress reaches the toast in MB and the mirror in bytes', async () => {
  reset();
  const seen: Array<[number, number]> = [];
  downloadEmbedModel(MANIFEST, { onProgress: (loaded, total) => seen.push([loaded, total]) });
  await tick();

  calls()[0]!.opts.onProgress?.(progress(12 * 1024 * 1024, 24 * 1024 * 1024));
  assert.deepEqual(job()?.progress, { done: 12, total: 24 }, 'whole MB - the unit the chip quotes');
  assert.deepEqual(seen, [[12 * 1024 * 1024, 24 * 1024 * 1024]], 'the mirror gets the raw bytes');

  calls()[0]!.settle(undefined);
  await tick();
  assert.equal(job()?.status, 'done');
  assert.equal(embedDownloadActive(), false);
});

test('an unknown total leaves the bar indeterminate rather than claiming 0 of 0', async () => {
  reset();
  downloadEmbedModel(MANIFEST);
  await tick();
  calls()[0]!.opts.onProgress?.(progress(1024 * 1024, 0));
  assert.deepEqual(job()?.progress, { done: 1, total: 0 }, 'total 0 is what the toast draws as indeterminate');
  calls()[0]!.settle(undefined);
  await tick();
});

// ── the view is a mirror, not the owner ──────────────────────────────────────

test('detaching a mirror (the view teardown) does not stop the download', async () => {
  reset();
  const seen: number[] = [];
  let done = 0;
  const { detach } = downloadEmbedModel(MANIFEST, {
    onProgress: (loaded) => seen.push(loaded),
    onDone: () => { done++; },
  });
  await tick();
  calls()[0]!.opts.onProgress?.(progress(1_000_000, 23_000_000));
  assert.deepEqual(seen, [1_000_000]);

  detach();   // the user navigated away from #/ask
  calls()[0]!.opts.onProgress?.(progress(9_000_000, 23_000_000));
  assert.deepEqual(seen, [1_000_000], 'a torn-down view hears nothing more');
  assert.deepEqual(job()?.progress, { done: 9, total: 22 }, 'but the toast keeps counting');

  calls()[0]!.settle(undefined);
  await tick();
  assert.equal(job()?.status, 'done', 'the download ran to completion without the view');
  assert.equal(done, 0, 'and the detached mirror was not called on completion either');
});

// ── one download, however many chips ─────────────────────────────────────────

test('a second caller attaches to the running download and replays its progress', async () => {
  reset();
  downloadEmbedModel(MANIFEST);
  await tick();
  calls()[0]!.opts.onProgress?.(progress(5_000_000, 23_000_000));

  assert.equal(embedDownloadActive(), true);
  const replayed: Array<[number, number]> = [];
  downloadEmbedModel(MANIFEST, { onProgress: (l, tot) => replayed.push([l, tot]) });
  await tick();

  assert.equal(calls().length, 1, 'a re-mounted chip must not re-download 23 MB');
  assert.deepEqual(replayed, [[5_000_000, 23_000_000]], 'it opens on a real number, not on nothing');
  assert.equal(jobsSnapshot().filter((j) => j.title === TITLE).length, 1, 'and there is still one job');

  calls()[0]!.settle(undefined);
  await tick();
});

// ── cancel ───────────────────────────────────────────────────────────────────

test('cancelling the job aborts the fetch and tells the mirror', async () => {
  reset();
  const errors: unknown[] = [];
  downloadEmbedModel(MANIFEST, { onError: (e) => errors.push(e) });
  await tick();

  cancelJob(job()!.id);
  await tick();

  assert.equal(calls()[0]!.aborted, true, "downloadAsk's own signal did the stopping");
  assert.equal(job()?.status, 'cancelled');
  assert.equal(errors.length, 1, 'the chip is told, so it stops showing a percentage');
  assert.equal(embedDownloadActive(), false, 'and a later Download can start a fresh one');
});

test('a failed download fails the job and leaves answers working', async () => {
  reset();
  const errors: unknown[] = [];
  downloadEmbedModel(MANIFEST, { onError: (e) => errors.push(e) });
  await tick();

  calls()[0]!.blowUp(new Error('network went away'));
  await tick();

  assert.equal(job()?.status, 'failed');
  assert.match(job()?.error ?? '', /network went away/);
  assert.equal(errors.length, 1);
  assert.equal(embedDownloadActive(), false);
});
