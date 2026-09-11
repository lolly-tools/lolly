// SPDX-License-Identifier: MPL-2.0
/**
 * "Available offline" downloads as a JOB (views/profile.ts + lib/offline-run.ts, WP-F).
 *
 * Run:  node --test shells/web/src/views/profile-offline-job.test.ts
 *
 * The conversion this pins: the Profile section's part downloads and its
 * "Download everything" sweep used to be owned by the view's mount closure -
 * the AbortController lived there and _cleanup aborted it, so navigating away
 * mid-sweep stopped a potentially multi-gigabyte download (resumable, so
 * nothing fetched was lost, but leaving cancelled it) and every control was
 * disabled for the duration. It now runs as a registry job:
 *
 *   - light, NEVER heavy: a download must not take or wait for the single
 *     serial slot lib/jobs.ts keeps for model inference;
 *   - cancellable, with the toast's ✕ aborting the same signal the fetches read;
 *   - progress is the byte counts the in-view bar already showed, with the
 *     current part's name as the job note;
 *   - view teardown DETACHES (unsubscribe), it does not abort;
 *   - a /profile mounted while a run is live reads as busy instead of offering
 *     a second, concurrent sweep over the same buckets.
 *
 * The module half is exercised against the real lib/jobs.ts (both are DOM-free,
 * so no jsdom is needed); the view half is a source scan, the profile-nav.test.ts
 * convention - mounting the whole Profile view would drag in IndexedDB, the
 * catalog sync and the host bridge for no extra signal.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  beginOfflineRun, cancelOfflineRun, offlineRunActive, offlineRunLine,
  subscribeOfflineRun, __resetOfflineRunForTest, type OfflineRunLine,
} from '../lib/offline-run.ts';
import { startJob, jobsSnapshot, cancelJob, __resetJobsForTest, type Job } from '../lib/jobs.ts';

const PROFILE_SRC = readFileSync(fileURLToPath(new URL('./profile.ts', import.meta.url)), 'utf8');
const RUN_SRC = readFileSync(fileURLToPath(new URL('../lib/offline-run.ts', import.meta.url)), 'utf8');

function reset(): void {
  __resetOfflineRunForTest();
  __resetJobsForTest();
}
const jobOf = (title: string): Job | undefined => jobsSnapshot().find(j => j.title === title);

// ── heavy: false ─────────────────────────────────────────────────────────────

test('a download run is a LIGHT job - it never contends for the model-inference slot', () => {
  reset();
  // A heavy job holds the single serial slot for the whole test.
  const heavy = startJob({ title: 'Removing background' });
  assert.equal(jobOf('Removing background')!.status, 'running');

  const run = beginOfflineRun('Downloading everything for offline')!;
  assert.ok(run, 'the run started');
  const job = jobOf('Downloading everything for offline')!;
  assert.equal(job.heavy, false, 'declared light');
  assert.equal(job.status, 'running', 'and running immediately, not queued behind the matte');
  assert.equal(jobOf('Removing background')!.status, 'running', 'the heavy job is untouched');

  run.end();
  heavy.finish();
});

test('the reason is written down where the next reader will look', () => {
  assert.match(RUN_SRC, /heavy: false/, 'the flag is set explicitly');
  assert.match(RUN_SRC, /serial slot/, 'with the serial-slot reason in a comment');
  assert.match(RUN_SRC, /NOT HEAVY/, 'called out in the file header too');
});

// ── progress ─────────────────────────────────────────────────────────────────

test('progress is the byte counts, noted with the part being downloaded', () => {
  reset();
  const run = beginOfflineRun('Downloading for offline')!;
  run.report({ label: 'Catalogue', loaded: 1024, total: 4096, unit: 'bytes' });
  const job = jobOf('Downloading for offline')!;
  assert.deepEqual(job.progress, { done: 1024, total: 4096, note: 'Catalogue' });

  // A phase with no known end reports an indeterminate total (the toast's rule
  // is total <= 0), never a fabricated one.
  run.report({ label: 'Speech voices', loaded: 99, total: null, unit: 'bytes' });
  assert.deepEqual(job.progress, { done: 99, total: 0, note: 'Speech voices' });
  run.end();
});

test('the last line is readable after the fact, so a view mounted mid-run paints at once', () => {
  reset();
  assert.equal(offlineRunLine(), null, 'nothing to paint with no run');
  const run = beginOfflineRun('Downloading for offline')!;
  assert.equal(offlineRunLine(), null, 'and nothing until the first report');
  run.report({ label: 'The app', loaded: 7, total: 10, unit: 'bytes' });
  assert.deepEqual(offlineRunLine(), { label: 'The app', loaded: 7, total: 10, unit: 'bytes' });
  run.end();
  assert.equal(offlineRunLine(), null, 'and gone once the run ends');
});

// ── teardown detaches, it does not abort ─────────────────────────────────────

test('unsubscribing (view teardown) stops the painting but NOT the run', () => {
  reset();
  const seen: OfflineRunLine[] = [];
  const unsub = subscribeOfflineRun({ onProgress: line => seen.push(line) });
  const run = beginOfflineRun('Downloading for offline')!;
  run.report({ label: 'The app', loaded: 1, total: 2, unit: 'bytes' });
  assert.equal(seen.length, 1, 'the mounted view painted');

  unsub();   // what _cleanup does
  run.report({ label: 'The app', loaded: 2, total: 2, unit: 'bytes' });
  assert.equal(seen.length, 1, 'the detached view stopped painting');
  assert.equal(run.signal.aborted, false, 'and the download was NOT aborted');
  assert.equal(offlineRunActive(), true, 'the run is still live');
  assert.equal(jobOf('Downloading for offline')!.status, 'running', 'so is its job');
  run.end();
});

test('the view teardown hook unsubscribes and aborts nothing', () => {
  const cleanup = PROFILE_SRC.slice(PROFILE_SRC.indexOf('_cleanup = () => {'));
  const body = cleanup.slice(0, cleanup.indexOf('\n  };'));
  assert.match(body, /offlineRunUnsub\?\.\(\)/, '_cleanup detaches this view from the run');
  // Comments stripped: the block EXPLAINS that it no longer aborts, in prose.
  const code = body.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  assert.doesNotMatch(code, /abort/i, 'and no longer aborts it');
  assert.ok(!PROFILE_SRC.includes('offlineDownloadAbort'), 'the old abort hook is gone');
  // The view owns no controller at all any more - the run does (lib/offline-run.ts).
  assert.ok(!PROFILE_SRC.includes('new AbortController('), 'no view-owned AbortController left');
});

// ── one run at a time / re-entry ─────────────────────────────────────────────

test('a second run is refused while one is live - a remount cannot double up', () => {
  reset();
  const run = beginOfflineRun('Downloading for offline')!;
  assert.equal(offlineRunActive(), true);
  assert.equal(beginOfflineRun('Downloading everything for offline'), null, 'refused');
  assert.equal(jobsSnapshot().length, 1, 'and no second job was registered');
  run.end();
  assert.equal(offlineRunActive(), false, 'the slot frees on end');
  const again = beginOfflineRun('Downloading tools')!;
  assert.ok(again, 'a later run is fine');
  again.end();
});

test('a /profile mounted mid-run paints itself busy instead of offering another sweep', () => {
  // The section's re-entry adoption: busy state comes from the MODULE-level run,
  // not from the view's own re-entrancy flag (which is fresh on every mount).
  assert.match(PROFILE_SRC, /if \(offlineRunActive\(\)\) \{\s*\n\s*setBusy\(true\);/,
    'the mount adopts a live run as busy');
  assert.match(PROFILE_SRC, /const line = offlineRunLine\(\);\s*\n\s*if \(line\) showProgress\(line\);/,
    'and paints the run’s current line straight away');
  assert.match(PROFILE_SRC, /if \(running \|\| \(!outer && offlineRunActive\(\)\)\) return false;/,
    'runParts refuses when a run is already in flight');
  assert.match(PROFILE_SRC, /if \(running \|\| offlineRunActive\(\)\) return;/,
    'so does "Download everything"');
  // syncPartRow re-reads storage, so an async re-price mid-run would otherwise
  // flicker the frozen rows back to enabled.
  assert.match(PROFILE_SRC, /if \(offlineRunActive\(\)\) setBusy\(true\);/,
    'and a re-price keeps the rows frozen while the run is live');
});

test('the mounted view subscribes to the run rather than driving the bar itself', () => {
  assert.match(PROFILE_SRC, /offlineRunUnsub = subscribeOfflineRun\(\{/, 'the bar is a subscriber');
  assert.match(PROFILE_SRC, /onProgress: line => showProgress\(line\)/, 'painting the fanned-out line');
  assert.match(PROFILE_SRC, /run\.report\(\{ label: partLabel\(id\), loaded: p\.loaded, total: p\.total, unit: 'bytes' \}\)/,
    'and each part reports its byte counts into the run, not into one view');
});

// ── cancel ───────────────────────────────────────────────────────────────────

test('cancelling from the toast aborts the fetches and settles the job', () => {
  reset();
  const run = beginOfflineRun('Downloading everything for offline')!;
  const job = jobOf('Downloading everything for offline')!;
  assert.equal(job.cancellable, true, 'so the toast renders its ✕');

  // Exactly what job-toast.ts's ✕ does with the id it rendered.
  cancelJob(job.id);

  assert.equal(run.signal.aborted, true, 'the in-flight fetches are aborted');
  assert.equal(run.cancelled, true, 'and the run reports itself cancelled');
  assert.equal(job.status, 'cancelled');
  // The driver still runs its own finally: end() must not resurrect the job.
  run.end();
  assert.equal(job.status, 'cancelled', 'still cancelled, not "done"');
  assert.equal(offlineRunActive(), false, 'and the slot is free again');
});

test('the in-view Cancel routes through the registry, so the toast agrees', () => {
  reset();
  const run = beginOfflineRun('Downloading for offline')!;
  cancelOfflineRun();
  assert.equal(run.signal.aborted, true);
  assert.equal(jobOf('Downloading for offline')!.status, 'cancelled');
  assert.doesNotThrow(() => cancelOfflineRun(), 'a cancel with no run is a no-op');
  // The button no longer holds a bare controller of its own.
  assert.match(PROFILE_SRC, /cancelBtn\.addEventListener\('click', \(\) => cancelOfflineRun\(\)\)/);
});

// ── completion ───────────────────────────────────────────────────────────────

test('a finished run tells its views and announces completion', () => {
  reset();
  let ended = 0;
  subscribeOfflineRun({ onEnd: () => { ended++; } });
  const run = beginOfflineRun('Downloading for offline')!;
  run.end();
  assert.equal(ended, 1, 'the mounted view repaints');
  assert.equal(jobOf('Downloading for offline')!.status, 'done');
  run.end();
  assert.equal(ended, 1, 'end() is idempotent');

  // Completion is announced through the body-level live region (a11y.ts), which
  // outlives the view - so it still reaches the user who navigated away.
  assert.match(PROFILE_SRC, /t\('Offline download complete'\)/, 'a multi-part run announces completion');
  assert.match(PROFILE_SRC, /tRaw\('\{name\} is available offline', \{ name: partLabel\(want\[0\]!\) \}\)/,
    'a single part announces by name');
  assert.match(PROFILE_SRC, /t\('Everything you picked is saved for offline'\)/, 'and the everything sweep keeps its own');
});

test('a run with failures fails its job, carrying the message the user was given', () => {
  reset();
  const run = beginOfflineRun('Downloading for offline')!;
  run.end('2 downloads failed');
  const job = jobOf('Downloading for offline')!;
  assert.equal(job.status, 'failed');
  assert.equal(job.error, '2 downloads failed');
});

// ── the tools sweep rides along ──────────────────────────────────────────────

test('the tools sweep reports item counts, and stops cooperatively on cancel', () => {
  reset();
  const run = beginOfflineRun('Downloading tools')!;
  run.report({ label: 'Tools', loaded: 3, total: 28, unit: 'items' });
  assert.deepEqual(jobOf('Downloading tools')!.progress, { done: 3, total: 28, note: 'Tools' });
  cancelOfflineRun();
  assert.equal(run.cancelled, true);
  run.end();

  assert.match(PROFILE_SRC, /if \(run\?\.cancelled\) break;/, 'the sweep polls between tools');
  assert.match(PROFILE_SRC, /run\?\.report\(\{ label: t\('Tools'\), loaded: n, total: queue\.length, unit: 'items' \}\)/,
    'and reports its position');
  // "Download everything" is ONE job across both phases, not two.
  assert.match(PROFILE_SRC, /if \(!await runParts\(sweepIds, run\)\) return;/);
  assert.match(PROFILE_SRC, /await sweepTools\(\{ fanfare: false, run \}\)/);
  // …which means the run holds every control disabled while the tools phase
  // runs, so the sweep's re-entrancy guard can no longer be the button's own
  // disabled state - that would silently skip the phase.
  assert.match(PROFILE_SRC, /let toolsSweeping = false;/, 'the sweep has its own guard flag');
  assert.ok(!PROFILE_SRC.includes('if (allBtn.disabled) return 0;'), 'and no longer reads the button');
});
