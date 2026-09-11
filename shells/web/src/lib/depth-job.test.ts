// SPDX-License-Identifier: MPL-2.0
/**
 * The depth JOB (lib/depth-job.ts) - what moving inference off the tool's thread
 * must not have changed, in the matte-job.test.ts idiom.
 *
 * Pinned here:
 *   - the CACHE identity: a second run of the same (image, model) never re-infers,
 *     and a different model does;
 *   - the job is heavy (it claims the single serial slot - two wasm runs in one tab
 *     is the OOM the queue exists to prevent) and its cancel really ABORTS the run;
 *   - a failure surfaces a HUMAN message, never ort-web's raw C++ string;
 *   - the model's progress reaches the toast (percent where knowable, indeterminate
 *     where not).
 *
 * The model run and the cache are `deps` seams, so all of this runs headless - no
 * worker, no weights, no IndexedDB.
 *
 * Run: node --test shells/web/src/lib/depth-job.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { __resetJobsForTest, cancelJob, jobsSnapshot, subscribe, startJob } from './jobs.ts';
import {
  depthErrorMessage, imageChecksum, runDepthJob, startDepthJob,
  type DepthCache, type DepthJobDeps, type DepthJobRequest,
} from './depth-job.ts';
import { depthCacheKey, type DepthFrame, type DepthMap, type DepthProgress } from './depth-models.ts';

// ── fixture ───────────────────────────────────────────────────────────────────

const frame = (w = 8, h = 4): DepthFrame => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4).fill(200) });

const mapOf = (w = 8, h = 4, fill = 0.5): DepthMap =>
  ({ width: w, height: h, data: new Float32Array(w * h).fill(fill) });

/** A Map-backed DepthCache, so a cache hit is observable without IndexedDB. */
function memCache(): DepthCache & { store: Map<string, DepthMap> } {
  const store = new Map<string, DepthMap>();
  return {
    store,
    get: async (k) => store.get(k) ?? null,
    put: async (k, m) => { store.set(k, m); },
  };
}

const req = (over: Partial<DepthJobRequest> = {}): DepthJobRequest => ({
  frame: frame(), checksum: 'sha-of-the-photo', ...over,
});

/** Wait for the job registry to have no queued/running job left. */
async function settle(): Promise<void> {
  for (let i = 0; i < 50; i++) {
    await new Promise<void>((r) => setTimeout(r, 0));
    if (!jobsSnapshot().some((j) => j.status === 'queued' || j.status === 'running')) return;
  }
}

// ── the cache: why reopening a shared link is instant ─────────────────────────

test('a computed map is cached under (image checksum, model id) and reused', async () => {
  const cache = memCache();
  let runs = 0;
  const deps: DepthJobDeps = { cache, infer: async () => { runs++; return mapOf(); } };

  const first = await runDepthJob(req(), {}, deps);
  assert.ok(first, 'the first run computes a map');
  assert.equal(runs, 1);
  assert.deepEqual([...cache.store.keys()], [depthCacheKey('sha-of-the-photo', 'depth-anything-v2-small')]);

  const second = await runDepthJob(req(), {}, deps);
  assert.equal(runs, 1, 'the second run never touches the model');
  assert.deepEqual(second, first, 'and hands back the same map');
});

test('a different photo, or a different model, re-infers rather than mixing maps', async () => {
  const cache = memCache();
  let runs = 0;
  const deps: DepthJobDeps = { cache, infer: async () => { runs++; return mapOf(); } };

  await runDepthJob(req(), {}, deps);
  await runDepthJob(req({ checksum: 'a-different-photo' }), {}, deps);
  assert.equal(runs, 2, 'a different image is a different key');
  assert.equal(cache.store.size, 2);
});

test('the run gets a COPY of the frame - the caller keeps its flat photo on screen', async () => {
  const cache = memCache();
  const source = req();
  let handed: DepthFrame | null = null;
  await runDepthJob(source, {}, { cache, infer: async (f) => { handed = f; return mapOf(); } });
  const seen = handed as unknown as DepthFrame;
  assert.notEqual(seen.data, source.frame.data, 'the worker gets its own buffer to neuter');
  assert.equal(source.frame.data.length, 8 * 4 * 4, 'the caller\'s frame is intact');
});

test('imageChecksum is content-addressed and stable', async () => {
  const a = await imageChecksum(new Uint8Array([1, 2, 3]));
  const b = await imageChecksum(new Uint8Array([1, 2, 3]));
  const c = await imageChecksum(new Uint8Array([1, 2, 4]));
  assert.equal(a, b, 'the same bytes hash the same');
  assert.notEqual(a, c);
  assert.match(a, /^[0-9a-f]{64}$/, 'lowercase hex SHA-256');
});

// ── the job wrapper ───────────────────────────────────────────────────────────

test('startDepthJob registers a cancellable HEAVY job and hands back the map', async () => {
  __resetJobsForTest();
  const cache = memCache();
  let landed: DepthMap | null = null;
  const job = startDepthJob(req(), { onComplete: (m) => { landed = m; } }, { cache, infer: async () => mapOf() });

  const listed = jobsSnapshot().find((j) => j.id === job.id)!;
  assert.equal(listed.title, 'Reading depth', 'the toast names the operation');
  assert.equal(listed.heavy, true, 'wasm inference claims the single heavy slot');
  assert.equal(listed.cancellable, true, 'so the toast shows its ✕');

  await settle();
  assert.equal(jobsSnapshot().find((j) => j.id === job.id)!.status, 'done');
  assert.ok(landed, 'onComplete fired with the map - the moment the photo inflates');
});

test('cancelling the job ABORTS the run and caches nothing', async () => {
  __resetJobsForTest();
  const cache = memCache();
  let signal: AbortSignal | undefined;
  // A caller awaiting the map (the tool seam does) must be settled by a cancel,
  // not left waiting forever - so onComplete is total and reports null.
  const completions: (DepthMap | null)[] = [];
  const job = startDepthJob(req(), { onComplete: (m) => completions.push(m) }, {
    cache,
    infer: (_f, o) => new Promise<DepthMap>((_res, rej) => {
      signal = o.signal;
      o.signal?.addEventListener('abort', () => {
        const err = new Error('aborted'); err.name = 'AbortError'; rej(err);
      });
    }),
  });

  // The cache lookup sits between "your turn" and the run, so the signal arrives
  // a tick or two after job.started.
  for (let i = 0; i < 20 && !signal; i++) await new Promise<void>((r) => setTimeout(r, 0));
  assert.ok(signal, 'the run was handed a signal to abort with');
  cancelJob(job.id);
  assert.equal(signal!.aborted, true, 'the job cancel really aborts the run');
  await settle();

  assert.equal(jobsSnapshot().find((j) => j.id === job.id)!.status, 'cancelled');
  assert.equal(cache.store.size, 0, 'a cancelled run caches nothing');
  assert.deepEqual(completions, [null], 'a cancel must settle the caller, never hang it');
});

test('a failed run reports a human message, never the raw runtime string', async () => {
  __resetJobsForTest();
  const cache = memCache();
  const job = startDepthJob(req(), {}, {
    cache,
    infer: async () => { throw new Error('failed to call OrtRun(). ERROR_CODE: 6, ERROR_MESSAGE: std::bad_alloc'); },
  });
  await settle();

  const listed = jobsSnapshot().find((j) => j.id === job.id)!;
  assert.equal(listed.status, 'failed');
  assert.equal(listed.error, depthErrorMessage('memory'), 'classified to the actionable memory message');
  assert.ok(!/OrtRun|bad_alloc/.test(String(listed.error)), 'ort-web\'s C++ string never reaches the toast');
});

test('no weights on device surfaces the download message, not a hang', async () => {
  __resetJobsForTest();
  const cache = memCache();
  const job = startDepthJob(req(), {}, {
    cache,
    infer: async () => {
      const e = new Error("The depth-anything-v2-small depth model isn't downloaded on this device yet.");
      e.name = 'ModelNotInstalledError';
      throw e;
    },
  });
  await settle();
  assert.equal(jobsSnapshot().find((j) => j.id === job.id)!.error, depthErrorMessage('not-installed'));
});

// ── progress reaches the toast ────────────────────────────────────────────────

test('download bytes become a percentage; an unknowable fraction stays indeterminate', async () => {
  __resetJobsForTest();
  const seen: { done: number; total: number; note?: string }[] = [];
  const off = subscribe((jobs) => {
    const p = jobs[0]?.progress;
    if (p) seen.push({ done: p.done, total: p.total, ...(p.note ? { note: p.note } : {}) });
  });
  startDepthJob(req(), {}, {
    cache: memCache(),
    infer: async (_f, o) => {
      const emit = (p: DepthProgress): void => o.onProgress?.(p);
      emit({ phase: 'download', loaded: 50, total: 200 });
      emit({ phase: 'inference' });
      emit({ phase: 'inference', fraction: 0.5 });
      return mapOf();
    },
  });
  await settle();
  off();

  assert.deepEqual(seen[0], { done: 25, total: 100, note: 'Downloading the model…' }, 'bytes → percent');
  assert.deepEqual(seen[1], { done: 0, total: 0, note: 'Reading depth…' }, 'total 0 = the indeterminate candy stripe');
  assert.deepEqual(seen[2], { done: 50, total: 100, note: 'Reading depth…' });
});


test('cancelling queued depth settles its consumer without starting inference', async () => {
  __resetJobsForTest();
  const blocker = startJob({ title: 'First job', heavy: true });
  let calls = 0, inferred = false;
  const depth = startDepthJob(req(), { onComplete: (map) => { calls++; assert.equal(map, null); } }, {
    cache: memCache(), infer: async () => { inferred = true; return mapOf(); },
  });
  cancelJob(depth.id);
  await new Promise<void>(resolve => setTimeout(resolve, 0));
  assert.equal(calls, 1);
  assert.equal(inferred, false);
  blocker.finish();
  __resetJobsForTest();
});
