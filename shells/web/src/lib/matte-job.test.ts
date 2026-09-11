// SPDX-License-Identifier: MPL-2.0
/**
 * The still-image MATTE job (lib/matte-job.ts) - background removal as a WP-F
 * background job instead of a modal the user has to sit and watch.
 *
 * What is pinned here is what moving the run OFF the dialog must not have changed:
 *   - the saved cutout's PROVENANCE and meta are byte-identical to the modal path
 *     ("Background removed with <model> <version> (on-device)" as a plain
 *     `c2pa.edited` step, the original carried as an ingredient, and NOT flagged
 *     aiGenerated - a matte computes alpha, it invents no pixels);
 *   - the job is cancellable and its cancel really ABORTS the model run, writing
 *     nothing;
 *   - a failure surfaces a HUMAN message, never ort-web's raw C++ string;
 *   - the model's progress reaches the toast (percent where knowable, indeterminate
 *     where not).
 *
 * The canvas encode, the credential scan and the signer are `deps` seams, so all of
 * this runs headless - no DOM, no model, no signer.
 *
 * Run directly:  node --test shells/web/src/lib/matte-job.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { __resetJobsForTest, jobsSnapshot, cancelJob, subscribe } from './jobs.ts';
import {
  startMatteJob, runMatteJob, matteErrorMessage, matteAssetIds,
  type MatteJobDeps, type MatteJobHost, type MatteJobRequest, type MatteStampOpts, type OutFormat,
} from './matte-job.ts';
import type { AssetRef, MatteFrame, MatteOpts, MatteProgress } from '@lolly-tools/core/host-v1';

// ── fixture ───────────────────────────────────────────────────────────────────

const MODEL = { id: 'u2netp', name: 'U²-Net lite', version: '1.0', tier: 'default', approxBytes: 1, license: 'Apache-2.0', attribution: '' };

const frame = (w = 10, h = 5): MatteFrame => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });

interface Recorded {
  uploaded: Record<string, unknown>[];
  stamped: MatteStampOpts[];
  runOpts: MatteOpts[];
  logs: string[];
}

function makeHost(run: (f: MatteFrame, o: MatteOpts) => Promise<MatteFrame>, rec: Recorded): MatteJobHost {
  return {
    log: (_lvl: string, msg: string) => { rec.logs.push(msg); },
    matte: {
      isAvailable: () => true,
      backend: () => 'wasm',
      models: () => [MODEL],
      modelBytes: () => MODEL.approxBytes,
      cached: async () => true,
      canRun: async () => ({ ok: true }),
      run: (f: MatteFrame, o: MatteOpts = {}) => { rec.runOpts.push(o); return run(f, o); },
    },
    assets: {
      get: async (id: string) => ({ id, type: 'raster', url: `blob:${id}` } as AssetRef),
      _uploadUserAsset: async (r: Record<string, unknown>) => { rec.uploaded.push(r); },
    },
  } as unknown as MatteJobHost;
}

function makeDeps(rec: Recorded, format: OutFormat = 'png'): MatteJobDeps {
  return {
    encode: async (_f, _fmt) => ({ blob: new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: `image/${format}` }), format }),
    extractIngredient: (bytes) => (bytes.length ? { kind: 'ingredient-of-source' } : null),
    stamp: async (_host, _blob, _fmt, o) => { rec.stamped.push(o); return new Blob([new Uint8Array(7)], { type: `image/${format}` }); },
  };
}

const recorder = (): Recorded => ({ uploaded: [], stamped: [], runOpts: [], logs: [] });

const req = (over: Partial<MatteJobRequest> = {}): MatteJobRequest => ({
  frame: frame(),
  sourceName: 'my photo.jpg',
  sourceBytes: new Uint8Array([9, 9, 9]),
  model: 'u2netp',
  outFormat: 'png',
  ...over,
});

/** Wait for the job registry to have no queued/running job left. */
async function settle(): Promise<void> {
  for (let i = 0; i < 50; i++) {
    await new Promise<void>((r) => setTimeout(r, 0));
    if (!jobsSnapshot().some((j) => j.status === 'queued' || j.status === 'running')) return;
  }
}

// ── provenance + meta: byte-identical to the modal path ───────────────────────

test('the saved cutout carries the same credential and meta the modal path wrote', async () => {
  __resetJobsForTest();
  const rec = recorder();
  const host = makeHost(async (f) => ({ width: f.width, height: f.height, data: f.data }), rec);
  const ref = await runMatteJob(host, req(), {}, makeDeps(rec));

  assert.equal(rec.stamped.length, 1, 'the output bytes were stamped exactly once');
  const s = rec.stamped[0]!;
  assert.equal(s.title, 'my photo.jpg', 'the credential title is the DECODED source name');
  assert.equal(s.tool, 'Remove background');
  assert.deepEqual(s.actions, [{
    action: 'c2pa.edited',
    description: 'Background removed with U²-Net lite 1.0 (on-device)',
  }], 'a plain edit step naming the model - no digitalSourceType, so no genAI claim');
  assert.deepEqual(s.ingredients, [{ kind: 'ingredient-of-source' }], 'the original rides along as an ingredient');
  assert.equal(s.dimensions, '10×5');

  assert.equal(rec.uploaded.length, 1);
  const up = rec.uploaded[0]!;
  assert.match(String(up.id), /^user\/matte\/\d+-my-photo$/, 'the permanent id shape is unchanged');
  assert.equal(up.type, 'raster');
  assert.equal(up.format, 'png');
  assert.equal(up.version, '1.0.0');
  assert.equal(up.width, 10);
  assert.equal(up.height, 5);
  assert.equal((up.blob as Blob).size, 7, 'the STAMPED blob is what gets saved, not the raw encode');
  assert.ok(!('aiGenerated' in up), 'a matte computes alpha; it invents nothing, so it is never flagged AI-generated');
  const meta = up.meta as Record<string, unknown>;
  assert.equal(meta.name, matteAssetIds('my photo.jpg', 0).name);
  assert.equal(meta.bytes, 7);
  assert.deepEqual(meta.matte, { model: 'u2netp', version: '1.0' });
  assert.equal(ref?.id, up.id, 'the job resolves the saved asset it just wrote');
});

test('saveName drives the saved id/name while sourceName stays the credential title', async () => {
  __resetJobsForTest();
  const rec = recorder();
  const host = makeHost(async (f) => f, rec);
  await runMatteJob(host, req({ sourceName: 'DSC_0001.png', saveName: 'Team portrait.png' }), {}, makeDeps(rec));
  assert.equal(rec.stamped[0]!.title, 'DSC_0001.png');
  assert.match(String(rec.uploaded[0]!.id), /^user\/matte\/\d+-team-portrait$/);
});

test('no source bytes means no ingredient key at all (never an empty one)', async () => {
  __resetJobsForTest();
  const rec = recorder();
  const host = makeHost(async (f) => f, rec);
  await runMatteJob(host, req({ sourceBytes: null }), {}, makeDeps(rec));
  assert.ok(!('ingredients' in rec.stamped[0]!), 'nothing to carry forward, so the key is absent');
});

// ── the job wrapper: title, cancel, completion ────────────────────────────────

test('startMatteJob registers a cancellable heavy job and hands back the saved ref', async () => {
  __resetJobsForTest();
  const rec = recorder();
  const host = makeHost(async (f) => f, rec);
  let landed: AssetRef | null = null;
  const job = startMatteJob(host, req(), { onComplete: (r) => { landed = r; } }, makeDeps(rec));

  const listed = jobsSnapshot().find((j) => j.id === job.id)!;
  assert.equal(listed.title, 'Removing background', 'the toast names the operation');
  assert.equal(listed.heavy, true, 'wasm inference claims the single heavy slot');
  assert.equal(listed.cancellable, true, 'so the toast shows its ✕');

  await settle();
  assert.equal(jobsSnapshot().find((j) => j.id === job.id)!.status, 'done');
  assert.equal(rec.uploaded.length, 1);
  assert.ok(landed, 'onComplete fired with the saved cutout');
});

test('cancelling the job ABORTS the model run and writes nothing', async () => {
  __resetJobsForTest();
  const rec = recorder();
  // A run that only settles when its signal aborts, like a real long run.
  const host = makeHost((_f, o) => new Promise<MatteFrame>((_res, rej) => {
    o.signal?.addEventListener('abort', () => {
      const err = new Error('aborted'); err.name = 'AbortError'; rej(err);
    });
  }), rec);
  let completed = false;
  let failed = false;
  const job = startMatteJob(host, req(), { onComplete: () => { completed = true; }, onError: () => { failed = true; } }, makeDeps(rec));

  await job.started;
  assert.equal(rec.runOpts.length, 1, 'the run started');
  assert.ok(rec.runOpts[0]!.signal, 'and it was handed a signal to abort with');

  cancelJob(job.id);
  assert.equal(rec.runOpts[0]!.signal!.aborted, true, 'the job cancel really aborts the run');
  await settle();

  assert.equal(jobsSnapshot().find((j) => j.id === job.id)!.status, 'cancelled');
  assert.equal(rec.uploaded.length, 0, 'a cancelled run saves nothing');
  assert.equal(completed, false);
  assert.equal(failed, false, 'a cancel is not a failure - no error toast, no onError');
});

test('a failed run reports a human message, never the raw runtime string', async () => {
  __resetJobsForTest();
  const rec = recorder();
  const host = makeHost(async () => {
    throw new Error('failed to call OrtRun(). ERROR_CODE: 6, ERROR_MESSAGE: std::bad_alloc');
  }, rec);
  let seen: unknown = null;
  const job = startMatteJob(host, req(), { onError: (e) => { seen = e; } }, makeDeps(rec));
  await settle();

  const listed = jobsSnapshot().find((j) => j.id === job.id)!;
  assert.equal(listed.status, 'failed');
  assert.equal(listed.error, matteErrorMessage('memory'), 'classified to the actionable memory message');
  assert.ok(!/OrtRun|bad_alloc/.test(String(listed.error)), 'ort-web\'s C++ string never reaches the toast');
  assert.ok(seen, 'onError fired for the caller\'s own logging');
  assert.equal(rec.uploaded.length, 0);
});

// ── progress reaches the toast ────────────────────────────────────────────────

test('download bytes become a percentage; an unknowable fraction stays indeterminate', async () => {
  __resetJobsForTest();
  const seen: { done: number; total: number; note?: string }[] = [];
  const off = subscribe((jobs) => {
    const p = jobs[0]?.progress;
    if (p) seen.push({ done: p.done, total: p.total, ...(p.note ? { note: p.note } : {}) });
  });
  const rec = recorder();
  const host = makeHost(async (f, o) => {
    const emit = (p: MatteProgress): void => o.onProgress?.(p);
    emit({ phase: 'download', loaded: 50, total: 200 });
    emit({ phase: 'inference' });
    emit({ phase: 'inference', fraction: 0.5 });
    return f;
  }, rec);
  startMatteJob(host, req(), {}, makeDeps(rec));
  await settle();
  off();

  assert.deepEqual(seen[0], { done: 25, total: 100, note: 'Downloading the model…' }, 'bytes → percent');
  assert.deepEqual(seen[1], { done: 0, total: 0, note: 'Removing background…' }, 'total 0 = the indeterminate candy stripe');
  assert.deepEqual(seen[2], { done: 50, total: 100, note: 'Removing background…' });
  assert.ok(seen.some((p) => p.note === 'Saving…'), 'and the save step is reported too');
});
