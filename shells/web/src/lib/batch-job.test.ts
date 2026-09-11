// SPDX-License-Identifier: MPL-2.0
/**
 * The batch render as a background JOB (lib/batch-job.ts) - WP-F.
 *
 * Run:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/batch-job.test.ts
 *
 * What is pinned here is the failure the conversion existed to fix, not the happy
 * path: the batch run lock used to be a module-level boolean in pro/run-overlay.ts
 * that only that function's own `finally` could clear. A /pro remount (its
 * `_cleanup` never touched the flag) left it stuck ON, and every later export was
 * refused with an error the user could do nothing about.
 *
 * So these cases hold the lock to the JOB's lifecycle from every direction it can
 * end - finish, fail, cancel-from-the-toast - and hold the run to being INDEPENDENT
 * of the view that started it: a teardown must leave it running, reporting and
 * finishing. Plus the third promise the toast makes: a failure is visible on the
 * job, never swallowed.
 *
 * jsdom because i18n (and the lazily-imported live region) want a document.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="view"></div></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
// a11y.ts's announce() defers to a frame; node has no rAF, and the completion
// announcement must never be what breaks a finished run.
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => { cb(0); return 0; }) as typeof requestAnimationFrame;

const { startBatchExport, startBatchJob, releaseBatchJob, isBatchRunActive } = await import('./batch-job.ts');
const { cancelJob, jobsSnapshot, activeJobs, __resetJobsForTest } = await import('./jobs.ts');

/** A promise plus its resolvers - a run we can hold open while we poke at the world. */
function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

/** Let the microtask queue drain (job.started resolves on one). */
const tick = (): Promise<void> => new Promise(res => { setTimeout(res, 0); });

test('the lock follows the JOB: it is held while the run is live and freed when it finishes', async () => {
  __resetJobsForTest();
  assert.equal(isBatchRunActive(), false);

  const gate = deferred<{ zipName: string }>();
  const job = startBatchExport('Rendering Folder', async () => gate.promise);
  // Claimed SYNCHRONOUSLY - /pro's Render button asks before it commits to a run.
  assert.equal(isBatchRunActive(), true);
  await tick();
  assert.equal(jobsSnapshot().find(j => j.id === job.id)!.status, 'running');

  gate.resolve({ zipName: 'folder.zip' });
  await tick();
  assert.equal(jobsSnapshot().find(j => j.id === job.id)!.status, 'done');
  assert.equal(isBatchRunActive(), false, 'a finished run must free the slot');
});

test('REGRESSION: a run stranded by a view teardown is freed by cancelling the job', async () => {
  __resetJobsForTest();
  // A run that never settles - the old boolean lock was cleared ONLY by this
  // function returning, so a stranded run (or a /pro remount, whose `_cleanup`
  // never touched the flag) refused every later export for the rest of the session.
  const job = startBatchExport('Rendering Selection', async () => new Promise(() => { /* never settles */ }));
  await tick();
  assert.equal(isBatchRunActive(), true);

  // The toast's ✕ - the only handle a user has once the view is gone.
  cancelJob(job.id);
  assert.equal(jobsSnapshot().find(j => j.id === job.id)!.status, 'cancelled');
  assert.equal(isBatchRunActive(), false, 'cancel frees the slot even though the run never returned');
  assert.equal(job.cancelled, true, 'and the runner sees it, so it stops between rows');
});

test('a view teardown leaves the run alive, still reporting, and still able to finish', async () => {
  __resetJobsForTest();
  // Stand in for the initiating view: a mount the run writes into, torn out mid-run.
  const view = dom.window.document.getElementById('view')!;
  const mount = dom.window.document.createElement('div');
  view.appendChild(mount);

  const gate = deferred<{ zipName: string }>();
  const job = startBatchExport('Rendering Folder', async (handle) => {
    handle.progress(1, 3, 'one.png');
    return gate.promise;
  });
  await tick();

  // The router swaps the view out (_cleanup): the toast lives on <body>, outside it.
  mount.remove();
  view.innerHTML = '';

  const live = activeJobs().find(j => j.id === job.id);
  assert.ok(live, 'the run must survive its view');
  assert.deepEqual({ done: live!.progress?.done, total: live!.progress?.total }, { done: 1, total: 3 });

  // …and progress keeps landing after the teardown, on the same handle.
  job.progress(3, 3, 'three.png');
  assert.equal(activeJobs().find(j => j.id === job.id)!.progress!.done, 3);

  gate.resolve({ zipName: 'folder.zip' });
  await tick();
  assert.equal(jobsSnapshot().find(j => j.id === job.id)!.status, 'done');
  assert.equal(isBatchRunActive(), false);
});

test('a failure surfaces on the job - never silently, and never as a held lock', async () => {
  __resetJobsForTest();
  const job = startBatchExport('Rendering Selection', async () => {
    throw new Error('Nothing in the selection can be rendered.');
  });
  await tick();

  const failed = jobsSnapshot().find(j => j.id === job.id)!;
  assert.equal(failed.status, 'failed');
  assert.equal(failed.error, 'Nothing in the selection can be rendered.');
  assert.equal(isBatchRunActive(), false, 'a failed run must not strand the lock either');
});

test('a second export queues behind the first rather than sharing the offscreen stage', async () => {
  __resetJobsForTest();
  const first = deferred<void>();
  let secondStarted = false;
  const a = startBatchExport('Rendering A', async () => first.promise);
  const b = startBatchExport('Rendering B', async () => { secondStarted = true; });
  await tick();

  assert.equal(jobsSnapshot().find(j => j.id === a.id)!.status, 'running');
  assert.equal(jobsSnapshot().find(j => j.id === b.id)!.status, 'queued');
  assert.equal(secondStarted, false, 'concurrency 1: the second run must not touch the stage yet');

  first.resolve();
  await tick();
  assert.equal(secondStarted, true);
  await tick();
  assert.equal(isBatchRunActive(), false);
});

test('the completion is announced by name, for when there is no view left to show it', async () => {
  __resetJobsForTest();
  startBatchExport('Rendering Folder', async () => ({ zipName: 'andys-lolly.zip' }));
  // The live region is imported lazily on delivery; give the import a few turns.
  let spoken = '';
  for (let i = 0; i < 50 && !spoken.includes('andys-lolly.zip'); i++) {
    await tick();
    spoken = [...dom.window.document.querySelectorAll('[data-a11y-live]')].map(el => el.textContent ?? '').join(' ');
  }
  assert.match(spoken, /andys-lolly\.zip/);
});

test('the un-wrapped handle (the Retry path) registers and releases the same lock', async () => {
  __resetJobsForTest();
  const job = startBatchJob('Retrying failed rows');
  assert.equal(isBatchRunActive(), true);
  job.finish();
  assert.equal(isBatchRunActive(), false);
  releaseBatchJob(job);
  releaseBatchJob(job);   // idempotent
  assert.equal(isBatchRunActive(), false);
});
