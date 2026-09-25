// SPDX-License-Identifier: MPL-2.0
/**
 * lib/model-parts.ts: one answer for "can this device get model part X, how big is
 * it, is it here already", with or without a build's precache.json.
 *
 * Run:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/model-parts.test.ts
 */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  __setModelPartsDepsForTest, groupModelFiles, LISTED_VERSION, MODEL_PART_IDS, modelPartInfo, modelPartsInfo,
  partFiles, withModelFiles,
} from './model-parts.ts';
import type { ManifestFile, PrecacheManifest } from './offline-manager.ts';

const LISTING = JSON.parse(readFileSync(new URL('../../models-manifest.json', import.meta.url), 'utf8')) as ManifestFile[];
const sum = (files: readonly ManifestFile[]): number => files.reduce((n, f) => n + f.size, 0);

afterEach(() => {
  __setModelPartsDepsForTest();
  delete (globalThis as { __LOLLY_AI_DISABLED__?: boolean }).__LOLLY_AI_DISABLED__;
});

test('the model groups follow the build rules exactly (vite.config.js groupPrecacheFiles)', async () => {
  const { groupPrecacheFiles } = await import('../../vite.config.js');
  const built = groupPrecacheFiles(LISTING) as Record<string, ManifestFile[]>;
  const ours = groupModelFiles(LISTING);
  for (const key of Object.keys(ours) as (keyof typeof ours)[]) {
    assert.deepEqual(ours[key].map(f => f.url), built[key]!.map(f => f.url), `group ${key} matches the build`);
  }
});

test('with no precache every model part is listed from the committed listing, runtime groups stay empty', () => {
  const { manifest, listed } = withModelFiles(null);
  assert.equal(manifest.version, LISTED_VERSION);
  assert.deepEqual(manifest.groups.ort, [], 'the ort runtime is never filled from the listing');
  assert.equal(manifest.groups.ortHf, undefined);
  for (const id of MODEL_PART_IDS) {
    assert.ok(partFiles(manifest, id).length > 0, `${id} has files`);
  }
  assert.ok(listed.has('upscale') && listed.has('models') && listed.has('embed'));
});

test('a precache group wins over the listing, and only missing groups are filled', () => {
  const precache: PrecacheManifest = {
    version: 'build-7',
    groups: { app: [], ort: [{ url: '/ort/ort-wasm-simd.wasm', size: 10 }], models: [], upscale: [{ url: '/models/upscale/x.onnx', size: 5 }] },
  };
  const { manifest, listed } = withModelFiles(precache);
  assert.equal(manifest.version, 'build-7');
  assert.deepEqual(manifest.groups.upscale, [{ url: '/models/upscale/x.onnx', size: 5 }]);
  assert.ok(!listed.has('upscale'));
  assert.ok(listed.has('matte'), 'the missing matte group comes from the listing');
  assert.ok(listed.has('models'), 'an empty group counts as missing');
});

test('precache present: sizes come from precache and nothing is probed', async () => {
  const probed: string[] = [];
  __setModelPartsDepsForTest({ probe: async (u) => { probed.push(u); return false; }, ready: async () => false, records: async () => ({}) });
  const upscale = [{ url: '/models/upscale/a.onnx', size: 700 }, { url: '/models/upscale/b.onnx', size: 300 }];
  const precache: PrecacheManifest = { version: 'v', groups: { app: [], ort: [], models: [], upscale } };
  const info = await modelPartInfo('upscale', { precache });
  assert.equal(info.available, true);
  assert.equal(info.bytes, 1000);
  assert.equal(info.source, 'precache');
  assert.equal(info.ready, false);
  assert.equal(info.label, 'Upscaling models');
  assert.deepEqual(probed, [], 'a build that listed the group needs no probe');
});

test('precache absent: a part the host serves is available, sized from the listing, never "0 B"', async () => {
  const probed: string[] = [];
  __setModelPartsDepsForTest({ probe: async (u) => { probed.push(u); return true; }, ready: async () => false, records: async () => ({}) });
  const infos = await modelPartsInfo(MODEL_PART_IDS, { precache: null });
  const { manifest } = withModelFiles(null);
  for (const info of infos) {
    assert.equal(info.available, true, `${info.id} is offered`);
    assert.equal(info.source, 'models-manifest');
    assert.ok(info.bytes && info.bytes > 0, `${info.id} has a real size`);
    assert.equal(info.bytes, sum(partFiles(manifest, info.id)));
  }
  const ocr = infos.find(i => i.id === 'ocr')!;
  const biggest = LISTING.filter(f => f.url.startsWith('/models/ocr/')).sort((a, b) => b.size - a.size)[0]!;
  assert.ok(probed.includes(biggest.url), 'the probe asks for the part’s largest file');
  assert.equal(ocr.ready, false);
});

test('precache absent and the host lacks the file: not offered, size still known', async () => {
  __setModelPartsDepsForTest({ probe: async () => false, ready: async () => false, records: async () => ({}) });
  const info = await modelPartInfo('matte', { precache: null });
  assert.equal(info.available, false);
  assert.ok(info.bytes && info.bytes > 0);
});

test('policy off: allowed is false, the host is still asked nothing', async () => {
  (globalThis as { __LOLLY_AI_DISABLED__?: boolean }).__LOLLY_AI_DISABLED__ = true;
  const probed: string[] = [];
  __setModelPartsDepsForTest({ probe: async (u) => { probed.push(u); return true; }, ready: async () => false, records: async () => ({}) });
  const info = await modelPartInfo('ocr', { precache: null });
  assert.equal(info.allowed, false);
  assert.equal(info.available, true, 'availability is the host’s answer, the policy has its own field');
  assert.deepEqual(probed, [], 'no request is made on behalf of a forbidden part');
});

test('ready: a recorded download, the runtime’s own check, or unknown when the check fails', async () => {
  __setModelPartsDepsForTest({
    probe: async () => true,
    ready: async (id) => { if (id === 'durable') throw new Error('no idb'); return id === 'matte'; },
    records: async () => ({ ocr: { at: '', version: 'x', bytes: 1, files: 1 } }),
  });
  const [ocr, matte, durable, upscale] = await modelPartsInfo(['ocr', 'matte', 'durable', 'upscale'], { precache: null });
  assert.equal(ocr!.ready, true, 'recorded');
  assert.equal(matte!.ready, true, 'fetched on first use, found by the runtime check');
  assert.equal(durable!.ready, 'unknown');
  assert.equal(upscale!.ready, false);
});

/** A Cache Storage stand-in holding the given keys per bucket. */
function fakeCaches(buckets: Record<string, string[]>): void {
  (globalThis as { caches?: unknown }).caches = {
    open: async (name: string) => ({
      match: async (key: string) => ((buckets[name] ?? []).includes(key) ? { ok: true } : undefined),
    }),
  };
}

test('speech: cached weights and one voice are not the whole part, so the Download stays', async () => {
  const { speechFileLists, SPEECH_CACHE, TRANSFORMERS_CACHE } = await import('./offline-manager.ts');
  const { manifest } = withModelFiles(null);
  const { model, voices } = speechFileLists(manifest);
  assert.ok(voices.length > 1, 'the listing has several voices');
  __setModelPartsDepsForTest({ probe: async () => true, records: async () => ({}) });
  try {
    fakeCaches({
      [TRANSFORMERS_CACHE]: model.map(f => f.url),
      [SPEECH_CACHE]: [voices[0]!.url],
    });
    assert.equal((await modelPartInfo('speech', { precache: null })).ready, false, 'one voice after first use');
    fakeCaches({
      [TRANSFORMERS_CACHE]: model.map(f => f.url),
      [SPEECH_CACHE]: voices.map(f => f.url),
    });
    assert.equal((await modelPartInfo('speech', { precache: null })).ready, true, 'every model file and every voice');
  } finally {
    delete (globalThis as { caches?: unknown }).caches;
  }
});

test('a failed precache read is not kept for the session', async () => {
  let reads = 0;
  const { modelPrecache } = await import('./model-parts.ts');
  const origFetch = globalThis.fetch;
  globalThis.fetch = (async () => { reads++; throw new Error('offline'); }) as typeof fetch;
  try {
    __setModelPartsDepsForTest();
    assert.equal(await modelPrecache(), null);
    assert.equal(await modelPrecache(), null);
    assert.equal(reads >= 2, true, 'the second call asks again');
  } finally {
    globalThis.fetch = origFetch;
  }
});
