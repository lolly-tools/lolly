// SPDX-License-Identifier: MPL-2.0
/**
 * Readiness rows and the surface capability record.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/lib/rebrand/readiness.test.ts
 *
 * Three properties the tests exist for:
 *
 * 1. Nothing here downloads. Every case runs against a host whose optional APIs
 *    are stubs that throw when called, so a readiness pass that reached for a
 *    fetch, a model load or `run()` would fail loudly rather than quietly cost
 *    somebody twenty megabytes.
 * 2. An item the caller did not ask about is not returned, and an item that is
 *    missing says what the person can do instead of it.
 * 3. `capabilitiesFor` reports OCR from the same probe the readiness row uses,
 *    so the two cannot disagree on one device.
 * 4. A row says only what its probe answered. The catalog index and the bytes on
 *    hand are separate questions, and a probe that threw is neither a yes nor a
 *    no, so `withCatalog` lets the two disagree and a broken host is its own
 *    case.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMockHost, withOptionalStubs } from '@lolly-tools/core';
import type { AssetQuery, AssetRef, HostV1, OcrAPI, OcrModelInfo } from '@lolly-tools/core';
import { OCR_MODEL_BYTES, OCR_MODELS } from '../ocr-models.ts';
import {
  REBRAND_MAX_DECODED_PIXELS,
  REBRAND_MAX_SOURCE_BYTES,
  capabilitiesFor,
  ocrAvailable,
  readinessFor,
  type ReadinessHostV1,
} from './readiness.ts';

/** A host with every optional API present as a throwing stub. */
function stubbedHost(assets: Record<string, AssetRef> = {}): HostV1 {
  return withOptionalStubs(createMockHost({ shell: 'web', assets }));
}

/**
 * A host whose OCR is answerable. Only the four members readiness reads are
 * real; the rest throw, so a call that strayed past the probe is visible.
 */
function withOcr(host: HostV1, opts: { models?: OcrModelInfo[]; cached?: boolean } = {}): HostV1 {
  const models = opts.models ?? OCR_MODELS;
  const ocr: Partial<OcrAPI> = {
    isAvailable: () => true,
    models: () => models,
    cached: async () => opts.cached === true,
    modelBytes: () => {
      throw new Error('readiness must read sizes from the roster, not from the bridge');
    },
    run: () => {
      throw new Error('readiness must never run a model');
    },
  };
  return { ...host, ocr: ocr as OcrAPI };
}

function asset(id: string, tags: string[] = []): AssetRef {
  return { source: 'library', id, type: 'vector', format: 'svg', url: `/catalog/${id}.svg`, meta: { tags } };
}

/**
 * A host whose catalog index and cached bytes can disagree, which is the real
 * case: `query` reads the index, `isAvailable` reads what can be placed now.
 * `createMockHost` answers both from one map, so a test that wants them apart
 * builds its own.
 */
function withCatalog(host: HostV1, opts: { index: AssetRef[]; available?: string[] }): HostV1 {
  const tagsOf = (a: AssetRef): string[] => {
    const tags = (a.meta as { tags?: unknown } | undefined)?.tags;
    return Array.isArray(tags) ? tags.filter((t): t is string => typeof t === 'string') : [];
  };
  return {
    ...host,
    assets: {
      ...host.assets,
      async query(filter: AssetQuery) {
        const wanted = filter.tags ?? [];
        return opts.index.filter((a) => wanted.every((t) => tagsOf(a).includes(t)));
      },
      async isAvailable(id: string) {
        return (opts.available ?? []).includes(id);
      },
    },
  };
}

/** A model part that states nothing, so the roster's numbers answer. */
const NO_PART = async (): Promise<null> => null;

function itemOf(items: Awaited<ReturnType<typeof readinessFor>>, id: string) {
  return items.find((i) => i.id === id);
}

// ─── the OCR row ─────────────────────────────────────────────────────────────

test('a shell without OCR reports it missing and offers the two ways on', async () => {
  const host = stubbedHost();
  assert.equal(ocrAvailable(host), false);

  const items = await readinessFor({ host, needs: { ocr: true } });
  assert.equal(items.length, 1);
  const row = items[0];
  assert.equal(row?.state, 'missing');
  assert.equal(row?.sizeBytes, undefined, 'there is no size to consent to');
  assert.deepEqual(row?.actions, ['continue-with-pictures', 'choose-another-file']);
  assert.match(row?.message ?? '', /not available on this device/);
});

test('a shell with a runtime but an empty roster has nothing to offer', async () => {
  const host = withOcr(stubbedHost(), { models: [] });
  assert.equal(ocrAvailable(host), false);
  const items = await readinessFor({ host, needs: { ocr: true } });
  assert.equal(itemOf(items, 'ocr')?.state, 'missing');
});

test('a model that is not on the device is downloadable, with the roster size and no fetch', async () => {
  const host = withOcr(stubbedHost(), { cached: false });
  const items = await readinessFor({ host, needs: { ocr: true }, ocrPart: NO_PART });
  const row = itemOf(items, 'ocr');
  assert.equal(row?.state, 'downloadable');
  assert.equal(row?.sizeBytes, OCR_MODEL_BYTES['ppocr-v5-mobile']);
  assert.deepEqual(row?.actions, ['download', 'continue-with-pictures', 'choose-another-file']);
  assert.match(row?.message ?? '', /sends no part of your deck/);
});

test('a model already on the device is ready and offers nothing', async () => {
  const host = withOcr(stubbedHost(), { cached: true });
  const items = await readinessFor({ host, needs: { ocr: true } });
  const row = itemOf(items, 'ocr');
  assert.equal(row?.state, 'ready');
  assert.deepEqual(row?.actions, []);
});

test('a cached() that throws is read as not on the device, never as ready', async () => {
  const host = stubbedHost();
  const broken: Partial<OcrAPI> = {
    isAvailable: () => true,
    models: () => OCR_MODELS,
    cached: async () => {
      throw new Error('the cache could not be opened');
    },
  };
  const items = await readinessFor({ host: { ...host, ocr: broken as OcrAPI }, needs: { ocr: true } });
  assert.equal(itemOf(items, 'ocr')?.state, 'downloadable');
});

// ─── the other rows ──────────────────────────────────────────────────────────

test('the layout model is missing rather than downloadable while it is off the roster', async () => {
  const items = await readinessFor({ host: stubbedHost(), needs: { layoutModel: true } });
  const row = itemOf(items, 'layout-model');
  assert.equal(row?.state, 'missing');
  assert.equal(row?.sizeBytes, undefined, 'no size means no download button');
  assert.ok(!row?.actions.includes('download'));
});

test('an installed slide master is ready; a missing one names itself', async () => {
  const present = stubbedHost({ 'lolly/master/neutral': asset('lolly/master/neutral') });
  const ready = await readinessFor({ host: present, needs: { masterAssetId: 'lolly/master/neutral' } });
  assert.equal(itemOf(ready, 'master')?.state, 'ready');

  const missing = await readinessFor({ host: stubbedHost(), needs: { masterAssetId: 'lolly/master/neutral' } });
  const row = itemOf(missing, 'master');
  assert.equal(row?.state, 'missing');
  assert.match(row?.message ?? '', /lolly\/master\/neutral/);
});

test('a logo variant is checked by tag and a missing one keeps what the slide has', async () => {
  const host = stubbedHost({ 'lolly/logo/primary': asset('lolly/logo/primary', ['on-light']) });
  const items = await readinessFor({ host, needs: { logoTags: ['on-light', 'on-dark'] } });
  assert.equal(items.length, 2);
  assert.equal(itemOf(items, 'logo:on-light')?.state, 'ready');
  const dark = itemOf(items, 'logo:on-dark');
  assert.equal(dark?.state, 'missing');
  assert.match(dark?.message ?? '', /flagged for review/);
});

test('a logo the catalog lists but cannot place yet is not reported as ready', async () => {
  const listed = asset('lolly/logo/primary', ['on-light']);
  const host = withCatalog(stubbedHost(), { index: [listed], available: [] });
  const items = await readinessFor({ host, needs: { logoTags: ['on-light'] } });
  const row = itemOf(items, 'logo:on-light');
  assert.notEqual(row?.state, 'ready', 'the index lists an asset whether or not its bytes were ever fetched');
  assert.equal(row?.state, 'downloadable');
  assert.ok(row?.actions.includes('download'), 'and there is something to press');
  assert.match(row?.message ?? '', /flagged for review/);

  // The same index with the bytes on hand is the ready case.
  const ready = await readinessFor({
    host: withCatalog(stubbedHost(), { index: [listed], available: ['lolly/logo/primary'] }),
    needs: { logoTags: ['on-light'] },
  });
  assert.equal(itemOf(ready, 'logo:on-light')?.state, 'ready');
});

test('a probe that throws is its own answer, never "there is none"', async () => {
  const host = stubbedHost();
  const broken: HostV1 = {
    ...host,
    assets: {
      ...host.assets,
      async query() {
        throw new Error('the catalog index could not be opened');
      },
      async isAvailable() {
        throw new Error('the catalog index could not be opened');
      },
    },
  };
  const items = await readinessFor({ host: broken, needs: { masterAssetId: 'lolly/master/neutral', logoTags: ['on-light'] } });
  assert.equal(itemOf(items, 'master')?.state, 'unknown');
  assert.equal(itemOf(items, 'logo:on-light')?.state, 'unknown');
  assert.match(itemOf(items, 'master')?.message ?? '', /could not check/);
});

test('a model the static table does not list keeps its size and its download', async () => {
  const pack: OcrModelInfo = {
    id: 'ppocr-v5-hindi',
    name: 'PP-OCRv5 (Hindi)',
    tier: 'default',
    approxBytes: 12_345_678,
    license: 'Apache-2.0',
    attribution: 'PaddleOCR, (c) PaddlePaddle authors (Apache-2.0)',
    version: 'v5-hindi',
    languages: ['hi'],
  };
  assert.equal(OCR_MODEL_BYTES[pack.id], undefined, 'the static table is not the live roster');

  const host = withOcr(stubbedHost(), { models: [pack], cached: false });
  const row = itemOf(await readinessFor({ host, needs: { ocr: true }, ocrPart: NO_PART }), 'ocr');
  assert.equal(row?.state, 'downloadable');
  assert.equal(row?.sizeBytes, pack.approxBytes, 'the size comes from the roster entry the shell handed over');
  assert.ok(row?.actions.includes('download'));
});

test('the OCR size is the model part the in-place offer downloads, whatever the roster says', async () => {
  const host = withOcr(stubbedHost(), { cached: false });
  const row = itemOf(await readinessFor({ host, needs: { ocr: true }, ocrPart: async () => ({ bytes: 21_000_000, ready: false }) }), 'ocr');
  assert.equal(row?.state, 'downloadable');
  assert.equal(row?.sizeBytes, 21_000_000, 'the offer sheet and the row name the same size');
  assert.ok(row?.actions.includes('download'));
});

test('a model part already downloaded reads as ready, the answer Settings gives', async () => {
  const host = withOcr(stubbedHost(), { cached: false });
  const row = itemOf(await readinessFor({ host, needs: { ocr: true }, ocrPart: async () => ({ bytes: 21_000_000, ready: true }) }), 'ocr');
  assert.equal(row?.state, 'ready');
  assert.deepEqual(row?.actions, []);
});

test('a model part that cannot be read leaves the roster in charge', async () => {
  const host = withOcr(stubbedHost(), { cached: false });
  const row = itemOf(await readinessFor({ host, needs: { ocr: true }, ocrPart: async () => { throw new Error('no manifest'); } }), 'ocr');
  assert.equal(row?.sizeBytes, OCR_MODEL_BYTES['ppocr-v5-mobile']);
});

test('the default reads the size from modelPartInfo, never from a hand-written number', () => {
  const src = readFileSync(new URL('./readiness.ts', import.meta.url), 'utf8');
  assert.match(src, /modelPartInfo\('ocr'\)/);
});

test('an OCR probe that throws leaves every other answer standing', async () => {
  const host = stubbedHost();
  const broken: Partial<OcrAPI> = {
    isAvailable: () => {
      throw new Error('the runtime could not be read');
    },
    models: () => OCR_MODELS,
  };
  const withBroken: HostV1 = { ...host, ocr: broken as OcrAPI };
  assert.equal(ocrAvailable(withBroken), false);
  assert.equal(itemOf(await readinessFor({ host: withBroken, needs: { ocr: true } }), 'ocr')?.state, 'missing');

  const caps = capabilitiesFor('web', withBroken);
  assert.equal(caps.ocr, false);
  assert.equal(caps.bytes, 'device', 'one broken probe does not take the record down with it');
  assert.equal(caps.limits.maxBytes, REBRAND_MAX_SOURCE_BYTES);
});

test('a deck that needs nothing produces no panel', async () => {
  assert.deepEqual(await readinessFor({ host: stubbedHost(), needs: {} }), []);
});

test('the rows come back in a fixed order', async () => {
  const host = withOcr(stubbedHost(), { cached: true });
  const items = await readinessFor({
    host,
    needs: { ocr: true, layoutModel: true, masterAssetId: 'm', logoTags: ['on-light'] },
  });
  assert.deepEqual(items.map((i) => i.id), ['ocr', 'layout-model', 'master', 'logo:on-light']);
});

test('readinessFor takes a host narrowed to the two APIs it reads', async () => {
  const narrow: ReadinessHostV1 = withOcr(stubbedHost(), { cached: true });
  const items = await readinessFor({ host: narrow, needs: { ocr: true } });
  assert.equal(itemOf(items, 'ocr')?.state, 'ready');
});

// ─── capabilities ────────────────────────────────────────────────────────────

test('the web surface keeps the bytes on the device and states its limits', () => {
  const caps = capabilitiesFor('web', stubbedHost());
  assert.equal(caps.surface, 'web');
  assert.equal(caps.bytes, 'device');
  assert.equal(caps.ocr, false);
  assert.equal(caps.rasterFallback, true);
  assert.equal(caps.nativePptx, false, 'false until the native writer is in the tree');
  assert.equal(caps.designDocument, true);
  assert.equal(caps.limits.maxBytes, REBRAND_MAX_SOURCE_BYTES);
  assert.equal(caps.limits.maxDecodedPixels, REBRAND_MAX_DECODED_PIXELS);
  assert.equal(caps.limits.maxSlides, undefined, 'unset until the handoff baselines are recorded');
  assert.match(caps.retention ?? '', /on this device/);
});

test('the source cap matches the pptx inflate cap of 100 MiB', () => {
  assert.equal(REBRAND_MAX_SOURCE_BYTES, 100 * 1024 * 1024);
});

test('the tauri surface reports the same local answer', () => {
  const caps = capabilitiesFor('tauri', stubbedHost());
  assert.equal(caps.surface, 'tauri');
  assert.equal(caps.bytes, 'device');
});

test('capabilities read OCR from the same probe the readiness row uses', async () => {
  const host = withOcr(stubbedHost(), { cached: false });
  const caps = capabilitiesFor('web', host);
  assert.equal(caps.ocr, true, 'the device can read text once the model is fetched');
  const row = itemOf(await readinessFor({ host, needs: { ocr: true } }), 'ocr');
  assert.equal(row?.state, 'downloadable', 'and the row says the bytes are not here yet');
});

test('the native pptx flag is injected, never probed', () => {
  assert.equal(capabilitiesFor('web', stubbedHost(), { nativePptx: true }).nativePptx, true);
  assert.equal(capabilitiesFor('web', stubbedHost(), {}).nativePptx, false);
});
