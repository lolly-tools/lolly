// SPDX-License-Identifier: MPL-2.0
/**
 * The image UPSCALE background job (lib/upscale-job.ts) - WP-F.
 *
 * Run:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/upscale-job.test.ts
 *
 * jsdom with a real origin so the i18n chain the module pulls in never trips on
 * about:blank. There is no canvas and no ONNX model under node, so the encode,
 * the local nearest-neighbour scale, the ingredient scan and the C2PA stamp are
 * all injected through the `deps` seam; `host.upscale.run` is a fake.
 *
 * What is pinned:
 *   - PROVENANCE IS UNCHANGED from the modal-blocking dialog, string for string:
 *     the model path's `c2pa.edited` + compositeWithTrainedAlgorithmicMedia and
 *     its "Upscaled 4× with <name> <version> (on-device)" description, the pixel
 *     path's plain "Scaled 4× (nearest-neighbour, pixel art)" with NO genAI claim,
 *     the credential title (the decoded source's own name), the dimensions, and
 *     the source's own credential carried as an ingredient;
 *   - the saved record: id/name shape, aiGenerated only on the model path, and
 *     `meta.aiUpscale = { model, version }` (the engine's composite-disclosure
 *     signal);
 *   - the job wiring: progress reaches the handle, finish carries the AssetRef and
 *     fires onComplete, and a cancel aborts the run and saves NOTHING.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;

const { runUpscaleJob, startUpscaleJob, upscaleAssetIds } = await import('./upscale-job.ts');
const { cancelJob, jobsSnapshot, __resetJobsForTest } = await import('./jobs.ts');
const { COMPOSITE_SOURCE_TYPE } = await import('@lolly/engine');

type Frame = { width: number; height: number; data: Uint8ClampedArray };
type Rec = Record<string, unknown>;
type StampCall = { format: string; o: Rec };

const MODEL = {
  id: 'realesr-general-x4v3', name: 'Real-ESRGAN general (fast)', scale: 4 as const, version: 'v0.3.0',
  approxBytes: 4_000_000, license: 'BSD-3-Clause', attribution: 'xinntao',
};

function frame(w = 8, h = 6): Frame {
  return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4).fill(200) };
}

/** A host whose upscale.run returns a 4×-larger frame (or whatever `run` overrides). */
function makeHost(run?: (f: Frame, o: Rec) => Promise<Frame>) {
  const uploads: Rec[] = [];
  const host = {
    log: () => {},
    upscale: {
      isAvailable: () => true,
      models: () => [MODEL],
      modelBytes: () => MODEL.approxBytes,
      cached: async () => true,
      canRun: async () => ({ ok: true }),
      run: run ?? (async (f: Frame) => ({ width: f.width * 4, height: f.height * 4, data: new Uint8ClampedArray(f.width * 4 * f.height * 4 * 4) })),
    },
    assets: {
      _uploadUserAsset: async (rec: Rec) => { uploads.push(rec); },
      get: async (id: string) => ({ id, type: 'raster', url: `blob:${id}`, meta: { name: 'saved' } }),
    },
  };
  return { host, uploads };
}

/** The deps seam: no canvas, no signer, a spy on the stamp. */
function makeDeps(withIngredient = true) {
  const stamps: StampCall[] = [];
  const deps = {
    encode: async () => new Blob(['png-bytes']),
    scaleNearest: (f: Frame, scale: number) => ({ width: f.width * scale, height: f.height * scale, data: f.data }),
    extractIngredient: () => (withIngredient ? { manifest: 'source-credential' } : null),
    stamp: async (_h: unknown, blob: Blob, format: string, o: Rec) => { stamps.push({ format, o }); return blob; },
  };
  return { deps, stamps };
}

// ── the model path: provenance, byte for byte ─────────────────────────────────

test('model path: the genAI-composite credential and the aiUpscale meta are unchanged', async () => {
  __resetJobsForTest();
  const { host, uploads } = makeHost();
  const { deps, stamps } = makeDeps();
  const ref = await runUpscaleJob(host as never, {
    frame: frame(),
    sourceName: 'holiday.png',
    saveName: 'Holiday snap.png',
    sourceBytes: new Uint8Array([1, 2, 3]),
    model: { model: 'realesr-general-x4v3', scale: 4, denoise: 0.3, targetMaxEdge: 2048 },
  }, {}, deps as never);

  assert.ok(ref, 'the saved AssetRef comes back');
  assert.equal(stamps.length, 1, 'the copy is stamped exactly once');
  const o = stamps[0]!.o as { title: string; tool: string; actions: Rec[]; ingredients?: unknown[]; dimensions: string };
  assert.equal(stamps[0]!.format, 'png');
  assert.equal(o.title, 'holiday.png', 'the credential title is the DECODED source name, not the save name');
  assert.equal(o.tool, 'Upscale');
  assert.equal(o.dimensions, '32×24');
  assert.deepEqual(o.actions, [{
    action: 'c2pa.edited',
    digitalSourceType: COMPOSITE_SOURCE_TYPE,
    description: 'Upscaled 4× with Real-ESRGAN general (fast) v0.3.0 (on-device)',
  }]);
  assert.deepEqual(o.ingredients, [{ manifest: 'source-credential' }], "the source's own credential rides forward");

  assert.equal(uploads.length, 1);
  const rec = uploads[0] as { id: string; type: string; format: string; version: string; width: number; height: number; aiGenerated?: string; meta: Rec };
  assert.equal(rec.type, 'raster');
  assert.equal(rec.format, 'png');
  assert.equal(rec.version, '1.0.0');
  assert.equal(rec.width, 32);
  assert.equal(rec.height, 24);
  assert.equal(rec.aiGenerated, 'partial', 'a super-resolver invents pixels → the Gen-AI pill');
  assert.deepEqual(rec.meta.aiUpscale, { model: 'realesr-general-x4v3', version: 'v0.3.0' });
  assert.ok(String(rec.id).startsWith('user/upscaled/'), 'the id keeps its permanent shape');
  assert.ok(String(rec.id).endsWith('-holiday-snap'), 'and is slugged from the SAVE name');
  assert.equal(rec.meta.name, 'Upscaled Holiday snap');
});

test('model path: no source bytes → no ingredient key at all', async () => {
  __resetJobsForTest();
  const { host } = makeHost();
  const { deps, stamps } = makeDeps();
  await runUpscaleJob(host as never, {
    frame: frame(), sourceName: 'x.png',
    model: { model: 'realesr-general-x4v3', scale: 4, targetMaxEdge: 1024 },
  }, {}, deps as never);
  assert.equal('ingredients' in (stamps[0]!.o as Rec), false, 'nothing to carry, nothing claimed');
});

// ── the pixel-art path: a plain edit, never a genAI claim ─────────────────────

test('pixel path: a plain c2pa.edited, no digitalSourceType, no Gen-AI pill', async () => {
  __resetJobsForTest();
  const { host, uploads } = makeHost();
  const { deps, stamps } = makeDeps();
  await runUpscaleJob(host as never, {
    frame: frame(4, 4), sourceName: 'sprite.png', sourceBytes: new Uint8Array([9]),
    pixel: { scale: 3 },
  }, {}, deps as never);

  const o = stamps[0]!.o as { actions: Rec[]; dimensions: string };
  assert.deepEqual(o.actions, [{ action: 'c2pa.edited', description: 'Scaled 3× (nearest-neighbour, pixel art)' }]);
  assert.equal(o.dimensions, '12×12');
  const rec = uploads[0] as Rec;
  assert.equal('aiGenerated' in rec, false, 'a lossless integer scale invents nothing');
  assert.equal('aiUpscale' in (rec.meta as Rec), false);
});

test('pixel path: a nonsense scale still lands on a sane integer', async () => {
  __resetJobsForTest();
  const { host } = makeHost();
  const { deps, stamps } = makeDeps();
  await runUpscaleJob(host as never, { frame: frame(2, 2), sourceName: 's.png', pixel: { scale: 0 } }, {}, deps as never);
  assert.match(String((stamps[0]!.o as { actions: Rec[] }).actions[0]!.description), /^Scaled 4×/);
});

// ── ids ───────────────────────────────────────────────────────────────────────

test('upscaleAssetIds slugs the base name and keeps the user/upscaled prefix', () => {
  const { id, name } = upscaleAssetIds('My Photo (2).JPG', 1234);
  assert.equal(id, 'user/upscaled/1234-my-photo-2');
  assert.equal(name, 'Upscaled My Photo (2)');
});

// ── progress ──────────────────────────────────────────────────────────────────

test('run progress maps download bytes and tiles onto the job bar', async () => {
  __resetJobsForTest();
  const seen: Array<[number, number, string | undefined]> = [];
  const { host } = makeHost(async (f: Frame, o: Rec) => {
    const on = o.onProgress as (p: Rec) => void;
    on({ phase: 'download', loaded: 50, total: 200 });
    on({ phase: 'download', loaded: 10, total: null });
    on({ phase: 'inference', tile: 0, tiles: 4 });
    on({ phase: 'inference', tile: 3, tiles: 4 });
    return { width: f.width, height: f.height, data: f.data };
  });
  const { deps } = makeDeps();
  await runUpscaleJob(host as never, {
    frame: frame(), sourceName: 'a.png',
    model: { model: 'realesr-general-x4v3', scale: 4, targetMaxEdge: 512 },
  }, { onProgress: (d, t, n) => seen.push([d, t, n]) }, deps as never);

  assert.deepEqual(seen.slice(0, 4), [
    [25, 100, 'Downloading the model…'],
    [0, 0, 'Downloading the model…'],   // no total → indeterminate
    [1, 4, 'Upscaling…'],
    [4, 4, 'Upscaling…'],
  ]);
  assert.equal(seen[seen.length - 1]![2], 'Saving…', 'the save step reports too');
});

// ── the job driver ────────────────────────────────────────────────────────────

test('startUpscaleJob finishes with the saved ref and fires onComplete', async () => {
  __resetJobsForTest();
  const { host, uploads } = makeHost();
  const { deps } = makeDeps();
  const completed: Array<{ id: string }> = [];
  const job = startUpscaleJob(host as never, {
    frame: frame(), sourceName: 'a.png',
    model: { model: 'realesr-general-x4v3', scale: 4, targetMaxEdge: 512 },
  }, { onComplete: (r) => completed.push(r as { id: string }) }, deps as never);

  await job.started;
  for (let i = 0; i < 12 && completed.length === 0; i++) await new Promise<void>(r => setTimeout(r, 0));
  assert.equal(completed.length, 1, 'the caller is handed the finished asset');
  assert.equal(uploads.length, 1);
  assert.equal(jobsSnapshot().find(j => j.id === job.id)?.status, 'done');
  assert.equal(jobsSnapshot().find(j => j.id === job.id)?.title, 'Upscaling image');
});

test('cancelling the job aborts the run and saves NOTHING', async () => {
  __resetJobsForTest();
  let sawSignal: AbortSignal | undefined;
  const { host, uploads } = makeHost((_f: Frame, o: Rec) => new Promise<Frame>((_res, rej) => {
    sawSignal = o.signal as AbortSignal;
    sawSignal.addEventListener('abort', () => {
      const err = new Error('aborted'); err.name = 'AbortError'; rej(err);
    });
  }));
  const { deps } = makeDeps();
  const errors: unknown[] = [];
  const completed: unknown[] = [];
  const job = startUpscaleJob(host as never, {
    frame: frame(), sourceName: 'a.png',
    model: { model: 'realesr-general-x4v3', scale: 4, targetMaxEdge: 512 },
  }, { onComplete: (r) => completed.push(r), onError: (e) => errors.push(e) }, deps as never);

  await job.started;
  for (let i = 0; i < 4 && !sawSignal; i++) await new Promise<void>(r => setTimeout(r, 0));
  assert.ok(sawSignal, 'the run was handed the job’s abort signal');
  cancelJob(job.id);
  assert.equal(sawSignal!.aborted, true, 'cancel reaches the run');
  for (let i = 0; i < 8; i++) await new Promise<void>(r => setTimeout(r, 0));

  assert.equal(uploads.length, 0, 'a cancelled run writes no asset');
  assert.equal(completed.length, 0, 'and never reports a completion');
  assert.equal(errors.length, 0, 'a cancel is not a failure');
  assert.equal(jobsSnapshot().find(j => j.id === job.id)?.status, 'cancelled');
});

test('a failed run fails the job and reports once', async () => {
  __resetJobsForTest();
  const { host, uploads } = makeHost(async () => { throw new Error('out of memory'); });
  const { deps } = makeDeps();
  const errors: unknown[] = [];
  const job = startUpscaleJob(host as never, {
    frame: frame(), sourceName: 'a.png',
    model: { model: 'realesr-general-x4v3', scale: 4, targetMaxEdge: 512 },
  }, { onError: (e) => errors.push(e) }, deps as never);
  await job.started;
  for (let i = 0; i < 8 && errors.length === 0; i++) await new Promise<void>(r => setTimeout(r, 0));
  assert.equal(errors.length, 1);
  assert.equal(uploads.length, 0);
  const j = jobsSnapshot().find(x => x.id === job.id);
  assert.equal(j?.status, 'failed');
  assert.equal(j?.error, 'out of memory');
});
