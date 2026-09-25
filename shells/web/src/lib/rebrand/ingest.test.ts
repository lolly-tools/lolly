// SPDX-License-Identifier: MPL-2.0
/**
 * Stage 1 in the web shell (plan 274 sections 2.1 and 3.5), against the real module
 * and the committed fixture `tests/fixtures/rebrand/simple.pptx`.
 *
 * The store is the real web store over an in-memory host; the picture upload, the asset
 * release and the design-system snapshot are stubs that record what they were asked, so
 * each test can say what reached the device and what was taken back off it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { zipSync } from 'fflate';
import type { AssetRef } from '@lolly-tools/core/host-v1';
import type { SourceDeckV1 } from '@lolly-tools/core';
import { createMockHost } from '../../../../../packages/core/src/mock-host.ts';
import { createWebProjectStore } from './project-store.ts';
import { setRebrandPictureUpload, type RebrandStoreHost } from './user-assets.ts';
import { REBRAND_MAX_SOURCE_BYTES } from './readiness.ts';
import { isStageCancelled } from './stage-core.ts';
import { readerAlgorithm } from './stage-rebrand.ts';
import { slidePictureIdsOf } from './controller.ts';
import {
  IngestCancelledError,
  PDF_READER_NAME,
  RebrandIngestError,
  hasPdfSignature,
  headerDimensions,
  ingestDeck,
  ingestPptx,
  rebuildSlidePictures,
  slidePictureIds,
  isFreshRecord,
  isFreshUpload,
  rebrandPictureStore,
  type IngestDepsV1,
} from './ingest.ts';

const FIXTURE = readFileSync(new URL('../../../../../tests/fixtures/rebrand/simple.pptx', import.meta.url));

const win = new JSDOM('').window;
const parseXml = (xml: string): Document => new win.DOMParser().parseFromString(xml, 'application/xml');

const PPTX_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

function deckFile(bytes: Uint8Array = FIXTURE, name = 'Quarterly review.pptx', type = PPTX_TYPE): File {
  return new File([bytes as BlobPart], name, { type });
}

interface Harness {
  deps: Partial<IngestDepsV1>;
  store: ReturnType<typeof createWebProjectStore>;
  /** Every picture the upload was handed, with the sha256 of its bytes. */
  pictures: Array<{ name: string; hash: string }>;
  /** Source bytes the store retained. */
  sources: string[];
  /** Refs released through either path. */
  deleted: string[];
}

function harness(): Harness {
  const host = createMockHost();
  const pictures: Harness['pictures'] = [];
  const sources: string[] = [];
  const deleted: string[] = [];
  const store = createWebProjectStore(host, {
    now: () => new Date(0).toISOString(),
    async storeUpload(file, opts) {
      assert.equal(opts.batch, true, 'the source bytes are stored as part of a batch');
      const id = `user/upload/source-${sources.length}`;
      sources.push(file.name);
      const ref: AssetRef = { source: 'user', id, type: 'data', format: 'pptx', url: '' };
      return ref;
    },
    async referencedElsewhere() { return false; },
    async deleteAsset(ref) { deleted.push(ref); },
  });
  let n = 0;
  const deps: Partial<IngestDepsV1> = {
    store,
    parseXml,
    async storePicture(file) {
      const hash = createHash('sha256').update(new Uint8Array(await file.arrayBuffer())).digest('hex');
      pictures.push({ name: file.name, hash });
      n += 1;
      return { id: `user/upload/picture-${n}`, fresh: true };
    },
    async deleteAsset(ref) { deleted.push(ref); },
    async snapshot() {
      return { id: 'stub', tokenHash: 'sha256:stub', fontHashes: {}, assetHashes: {} };
    },
    now: () => 1_000,
    newProjectId: () => 'rebrand-test',
    newInstanceId: () => 'instance-test',
  };
  return { deps, store, pictures, sources, deleted };
}

function input(file: File, over: { signal?: AbortSignal; onProgress?: (done: number, total: number) => void } = {}) {
  return {
    file,
    signal: over.signal ?? new AbortController().signal,
    onProgress: over.onProgress ?? ((): void => {}),
  };
}

/** Every stored media ref a source deck names, pictures, fallbacks and grounds together. */
function mediaRefs(deck: SourceDeckV1): Set<string> {
  const refs = new Set<string>();
  for (const slide of deck.slides) {
    if (slide.background.media) refs.add(slide.background.media);
    for (const object of slide.objects) {
      if (object.media) refs.add(object.media);
      if (object.fidelity.state === 'raster-preserved' && object.fidelity.fallbackAssetRef) {
        refs.add(object.fidelity.fallbackAssetRef);
      }
    }
  }
  return refs;
}

test('a pptx becomes a stored project with its source deck, checkpointed at ingest', async () => {
  const h = harness();
  const { project, source } = await ingestPptx(createMockHost(), input(deckFile()), h.deps);

  assert.equal(project.id, 'rebrand-test');
  assert.equal(project.name, 'Quarterly review', 'the project is named after the file, extension dropped');
  assert.equal(project.checkpoint.stage, 'ingest');
  assert.ok(project.checkpoint.at, 'the checkpoint carries a time, so recovery resumes after it');
  assert.ok(project.parts.sourceDeck, 'the source deck is a stored part');
  assert.equal(project.source.pageCount, source.slides.length, 'the page count the read settled is on the record');
  assert.ok(source.slides.length > 0);
  assert.match(project.source.hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(project.source.hash, `sha256:${createHash('sha256').update(FIXTURE).digest('hex')}`);
  assert.equal(project.source.bytesAssetRef, 'user/upload/source-0', 'the source bytes are retained');
  assert.deepEqual(h.sources, ['Quarterly review.pptx']);
  assert.equal(source.reader.name, 'pptx-read');

  const stored = await h.store.getPart<SourceDeckV1>(project.id, 'sourceDeck');
  assert.deepEqual(stored, source, 'the part the store holds is the deck handed back');
  const latest = await h.store.get(project.id);
  assert.equal(latest?.revision, project.revision, 'the project comes back at its latest revision');
});

test('each distinct picture is stored once, and the deck names only what was stored', async () => {
  const h = harness();
  const { source } = await ingestPptx(createMockHost(), input(deckFile()), h.deps);

  assert.ok(h.pictures.length > 0, 'the fixture carries pictures');
  const hashes = h.pictures.map((p) => p.hash);
  assert.equal(new Set(hashes).size, hashes.length, 'no picture was stored twice');
  const refs = mediaRefs(source);
  assert.equal(refs.size, h.pictures.length, 'one stored ref per distinct picture');
  for (const ref of refs) assert.match(ref, /^user\/upload\/picture-\d+$/);
  for (const picture of h.pictures) assert.match(picture.name, /^Quarterly review \d+\.[a-z]+$/);
});

test('progress counts slides, from nought to the whole deck', async () => {
  const h = harness();
  const seen: Array<[number, number]> = [];
  const { source } = await ingestPptx(
    createMockHost(),
    input(deckFile(), { onProgress: (done, total) => { seen.push([done, total]); } }),
    h.deps,
  );
  const total = source.slides.length;
  assert.deepEqual(seen[0], [0, total], 'the first report names the total before a slide is read');
  assert.deepEqual(seen[seen.length - 1], [total, total]);
  assert.equal(seen.length, total + 1, 'one report per slide, plus the opening one');
  for (let i = 1; i < seen.length; i += 1) assert.equal(seen[i]?.[0], (seen[i - 1]?.[0] ?? 0) + 1);
});

test('a cancel mid-read removes the project and the pictures already stored', async () => {
  const h = harness();
  const controller = new AbortController();
  const store = h.deps.storePicture;
  assert.ok(store);
  const seen: number[] = [];
  let total = 0;
  const deps: Partial<IngestDepsV1> = {
    ...h.deps,
    async storePicture(file, startedAt) {
      const stored = await store(file, startedAt);
      // The person presses Cancel while the first picture is being stored.
      controller.abort();
      return stored;
    },
  };
  await assert.rejects(
    ingestPptx(
      createMockHost(),
      input(deckFile(), { signal: controller.signal, onProgress: (done, all) => { seen.push(done); total = all; } }),
      deps,
    ),
    (err: unknown) => err instanceof IngestCancelledError && isStageCancelled(err) && err.code === 'cancelled',
  );
  assert.ok(h.pictures.length > 0, 'a picture was stored before the cancel');
  assert.ok(Math.max(...seen) < total, 'the read stopped before the last slide');
  assert.deepEqual(await h.store.list(), [], 'no project is left on the device');
  assert.ok(h.deleted.includes('user/upload/source-0'), 'the retained source bytes are released');
  for (let i = 1; i <= h.pictures.length; i += 1) {
    assert.ok(h.deleted.includes(`user/upload/picture-${i}`), `picture ${i} is released`);
  }
});

test('a picture reused from the library is never released on a cancel', async () => {
  const h = harness();
  const controller = new AbortController();
  const deleted: string[] = [];
  let asked = 0;
  const deps: Partial<IngestDepsV1> = {
    ...h.deps,
    async storePicture() {
      asked += 1;
      controller.abort();
      return { id: 'user/upload/already-mine', fresh: false };
    },
    async deleteAsset(ref) { deleted.push(ref); },
  };
  await assert.rejects(ingestPptx(createMockHost(), input(deckFile(), { signal: controller.signal }), deps), IngestCancelledError);
  assert.equal(asked, 1);
  assert.equal(deleted.includes('user/upload/already-mine'), false);
});

test('a deck over the size limit is refused with its code and nothing stored', async () => {
  const h = harness();
  const file = deckFile(new Uint8Array(4));
  Object.defineProperty(file, 'size', { value: REBRAND_MAX_SOURCE_BYTES + 1 });
  await assert.rejects(
    ingestPptx(createMockHost(), input(file), h.deps),
    (err: unknown) => err instanceof RebrandIngestError && err.code === 'source.too-large',
  );
  assert.deepEqual(await h.store.list(), []);
  assert.deepEqual(h.sources, []);
});

test('a password-protected deck, a legacy deck and an unreadable package each say which', async () => {
  const cfb = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]);
  const cases: Array<{ file: File; code: string }> = [
    { file: deckFile(cfb, 'Locked.pptx'), code: 'source.encrypted' },
    { file: deckFile(cfb, 'Old deck.ppt', 'application/vnd.ms-powerpoint'), code: 'unsupported-file' },
    { file: deckFile(new TextEncoder().encode('not a zip'), 'Broken.pptx'), code: 'source.unreadable' },
    { file: deckFile(new TextEncoder().encode('plain words'), 'notes.txt', 'text/plain'), code: 'unsupported-file' },
    { file: deckFile(zipSync({ 'readme.txt': new TextEncoder().encode('hi') }), 'bundle.zip', 'application/zip'), code: 'unsupported-file' },
    { file: deckFile(zipSync({ 'readme.txt': new TextEncoder().encode('hi') }), 'Hollow.pptx'), code: 'source.unreadable' },
  ];
  for (const { file, code } of cases) {
    const h = harness();
    await assert.rejects(
      ingestPptx(createMockHost(), input(file), h.deps),
      (err: unknown) => err instanceof RebrandIngestError && err.code === code,
      `${file.name} should be refused as ${code}`,
    );
    assert.deepEqual(await h.store.list(), [], `${file.name} left a project behind`);
    assert.deepEqual(h.sources, [], `${file.name} stored its bytes`);
  }
});

test('a picker id is fresh only when it carries this file and a time from this read', () => {
  assert.equal(isFreshUpload('user/upload/2000-Deck_1.png', 'Deck 1.png', 1_000), true);
  assert.equal(isFreshUpload('user/upload/500-Deck_1.png', 'Deck 1.png', 1_000), false, 'minted before the read began');
  assert.equal(isFreshUpload('user/upload/2000-logo.png', 'Deck 1.png', 1_000), false, 'another file the library held');
  assert.equal(isFreshUpload('lolly/logo/primary', 'Deck 1.png', 1_000), false);
});

// ─── the picker path, as the view hands it in ────────────────────────────────

interface PickerStub {
  host: RebrandStoreHost;
  /** The options every picker call carried. */
  calls: Array<{ name: string; opts: unknown }>;
  /** Records written verbatim, beside the picker. */
  verbatim: Array<{ id: string; meta?: Record<string, unknown> }>;
  records: Map<string, unknown>;
}

/** A host carrying what the picker reaches for, and a picker upload that records what it was asked. */
function pickerStub(behave: (file: File, n: number) => 'store' | Error = () => 'store'): PickerStub {
  const base = createMockHost();
  const calls: PickerStub['calls'] = [];
  const verbatim: PickerStub['verbatim'] = [];
  const records = new Map<string, unknown>();
  const host = {
    ...base,
    assets: {
      ...base.assets,
      async _uploadUserAsset(record: { id: string; meta?: Record<string, unknown> }) {
        verbatim.push({ id: record.id, ...(record.meta ? { meta: record.meta } : {}) });
        records.set(record.id, record);
      },
      async _deleteUserAsset() {},
      async _listUserAssets() { return []; },
      async _getUserRecord(id: string) { return records.get(id) ?? null; },
    },
  };
  let n = 0;
  setRebrandPictureUpload(async (_host, file, opts) => {
    n += 1;
    calls.push({ name: file.name, opts });
    const outcome = behave(file, n);
    if (outcome instanceof Error) throw outcome;
    // The picker renames what it converts, so the id does not carry the file name.
    const id = `user/upload/${Date.now()}-converted-${n}.png`;
    records.set(id, { id, meta: { provenance: { sourceHint: opts.sourceHint, importedAt: new Date().toISOString() } } });
    const ref: AssetRef = { source: 'user', id, type: 'raster', format: 'png', url: '' };
    return ref;
  });
  return { host, calls, verbatim, records };
}

/** The ingest deps without a picture store, so the real one runs. */
function withoutPictureStore(h: Harness): Partial<IngestDepsV1> {
  const { storePicture: _unused, ...rest } = h.deps;
  return { ...rest, now: () => Date.now() };
}

test('every deck picture goes through the picker as part of a batch, marked as this journey', async () => {
  const h = harness();
  const stub = pickerStub();
  try {
    await ingestPptx(stub.host, input(deckFile()), withoutPictureStore(h));
    assert.ok(stub.calls.length > 0, 'the fixture carries pictures');
    for (const call of stub.calls) assert.deepEqual(call.opts, { batch: true, sourceHint: 'rebrand' });
    assert.deepEqual(stub.verbatim, []);
  } finally {
    setRebrandPictureUpload(null);
  }
});

test('a picture the picker cannot take is kept verbatim, and a full device fails the deck', async () => {
  const h = harness();
  const stub = pickerStub(() => new Error('This format cannot be decoded.'));
  try {
    await ingestPptx(stub.host, input(deckFile()), withoutPictureStore(h));
    assert.equal(stub.verbatim.length, stub.calls.length, 'each refused picture is written as it arrived');
    for (const one of stub.verbatim) assert.equal(isFreshRecord(one, 0), true, 'each carries this journey as its source');
  } finally {
    setRebrandPictureUpload(null);
  }

  const full = harness();
  const quota = pickerStub(() => Object.assign(new Error('The device is full.'), { name: 'QuotaExceededError' }));
  try {
    await assert.rejects(
      ingestPptx(quota.host, input(deckFile()), withoutPictureStore(full)),
      (err: unknown) => err instanceof RebrandIngestError && err.code === 'storage.quota',
    );
    assert.deepEqual(await full.store.list(), [], 'the deck leaves nothing behind');
  } finally {
    setRebrandPictureUpload(null);
  }
});

test('a picture the picker would stop to ask about is written verbatim, with no dialog', async () => {
  const stub = pickerStub();
  try {
    // A PNG header 8000 pixels wide: past the picker's "Very large image" edge.
    const png = new Uint8Array(64);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    new DataView(png.buffer).setUint32(16, 8000);
    new DataView(png.buffer).setUint32(20, 4500);
    assert.deepEqual(headerDimensions(png), { width: 8000, height: 4500 });
    const stored = await rebrandPictureStore(stub.host)(new File([png], 'Deck 1.png', { type: 'image/png' }), 0);
    assert.equal(stub.calls.length, 0, 'the picker was never asked');
    assert.equal(stored.fresh, true);
    assert.deepEqual(stub.verbatim.map((one) => one.id), [stored.id]);
  } finally {
    setRebrandPictureUpload(null);
  }
});

test('a picture the picker converted and renamed still counts as this read\'s own', async () => {
  const stub = pickerStub();
  try {
    const startedAt = Date.now();
    const stored = await rebrandPictureStore(stub.host)(new File([new Uint8Array([0x42, 0x4d])], 'Deck 3.bmp', { type: 'image/bmp' }), startedAt);
    assert.match(stored.id, /converted/);
    assert.equal(stored.fresh, true, 'the record names this journey and this read');
  } finally {
    setRebrandPictureUpload(null);
  }
  const now = Date.parse('2026-09-24T10:00:00.000Z');
  assert.equal(isFreshRecord({ meta: { provenance: { sourceHint: 'rebrand', importedAt: '2026-09-24T10:00:01.000Z' } } }, now), true);
  assert.equal(isFreshRecord({ meta: { provenance: { sourceHint: 'rebrand', importedAt: '2026-09-24T09:00:00.000Z' } } }, now), false, 'from an earlier read');
  assert.equal(isFreshRecord({ meta: { provenance: { sourceHint: 'picker', importedAt: '2026-09-24T10:00:01.000Z' } } }, now), false, 'the person\'s own upload');
  assert.equal(isFreshRecord(null, now), false);
});

test('a cancel never releases a picture the store kept or another stored deck names', async () => {
  // A first read stores the deck with its pictures.
  const first = harness();
  const done = await ingestPptx(createMockHost(), input(deckFile()), first.deps);
  const named = mediaRefs(done.source);
  assert.ok(named.size > 1);
  const [kept] = [...named];
  assert.ok(kept);

  // A second read of the same deck reuses those pictures (as the picker's duplicate
  // check would hand them back) and is cancelled; the store says it kept one of them.
  const controller = new AbortController();
  let n = 0;
  const deps: Partial<IngestDepsV1> = {
    ...first.deps,
    store: {
      ...first.store,
      async remove(id: string) {
        const out = await first.store.remove(id);
        return { removedAssetRefs: out.removedAssetRefs, keptAssetRefs: [...out.keptAssetRefs, kept] };
      },
    },
    newProjectId: () => 'rebrand-second',
    async storePicture() {
      n += 1;
      if (n === 2) controller.abort();
      return { id: `user/upload/picture-${n}`, fresh: true };
    },
  };
  first.deleted.length = 0;
  await assert.rejects(ingestPptx(createMockHost(), input(deckFile(), { signal: controller.signal }), deps), IngestCancelledError);
  for (const ref of named) assert.equal(first.deleted.includes(ref), false, `${ref} is still drawn by the first deck`);
  assert.ok(await first.store.get('rebrand-test'), 'the first project is untouched');
});

test('a newer version joins the lineage it names, and its bytes are still its own', async () => {
  const h = harness();
  const { project, source } = await ingestPptx(createMockHost(), { ...input(deckFile()), lineageId: 'lineage-of-v1' }, h.deps);
  assert.equal(project.source.lineageId, 'lineage-of-v1', 'the project joins the lineage');
  assert.equal(source.source.lineageId, 'lineage-of-v1', 'and so does the source deck the plan reads');
  assert.equal(project.source.hash, `sha256:${createHash('sha256').update(FIXTURE).digest('hex')}`, 'the hash pins these bytes');
  const stored = await h.store.getPart<SourceDeckV1>(project.id, 'sourceDeck');
  assert.equal(stored?.source.lineageId, 'lineage-of-v1');

  const first = harness();
  const plain = await ingestPptx(createMockHost(), input(deckFile()), first.deps);
  assert.equal(plain.project.source.lineageId, plain.project.source.hash, 'a first read is its own lineage');
});

// ─── PDF decks and slide pictures ────────────────────────────────────────────

const PDF_EDITABLE = readFileSync(new URL('../../../../../tests/fixtures/rebrand-pdf/editable.pdf', import.meta.url));
const PDF_SCANNED = readFileSync(new URL('../../../../../tests/fixtures/rebrand/flattened.pdf', import.meta.url));

/** The harness with every stored picture kept by ref, so a rebuild can read it back. */
function keepingHarness(): Harness & { blobs: Map<string, Blob> } {
  const h = harness();
  const blobs = new Map<string, Blob>();
  let n = 0;
  h.deps.storePicture = async (file) => {
    n += 1;
    const id = `user/upload/picture-${n}`;
    blobs.set(id, file);
    h.pictures.push({ name: file.name, hash: createHash('sha256').update(new Uint8Array(await file.arrayBuffer())).digest('hex') });
    return { id, fresh: true };
  };
  // The node read path: the pure codec, and no browser decoders.
  h.deps.pdfReaders = async () => ({});
  return Object.assign(h, { blobs });
}

/** Pixels for a stored picture, through the node pipeline's own decoder. */
async function nodeDecode(blob: Blob): Promise<{ width: number; height: number; data: Uint8ClampedArray | Uint8Array } | null> {
  const { decodePipelinePicture } = await import('@lolly-tools/node-shell/rebrand');
  return decodePipelinePicture(new Uint8Array(await blob.arrayBuffer()), blob.type);
}

/** An OCR that reads one line over the whole crop, so every text region becomes text. */
function stubOcr(calls: { n: number }): (frame: { width: number; height: number }) => Promise<Array<{ text: string; confidence: number; box: { x: number; y: number; w: number; h: number } }>> {
  return async (frame) => {
    calls.n += 1;
    return [{ text: 'Revenue growth', confidence: 0.99, box: { x: 0, y: 0, w: frame.width, h: frame.height } }];
  };
}

test('a PDF deck is read by its bytes into a stored project, page by page, with its pictures in the same store', async () => {
  const h = keepingHarness();
  const seen: Array<[number, number]> = [];
  const file = deckFile(new Uint8Array(PDF_EDITABLE), 'Board update.pdf', 'application/pdf');
  const { project, source } = await ingestDeck(createMockHost(), input(file, { onProgress: (done, total) => { seen.push([done, total]); } }), h.deps);
  assert.equal(project.source.kind, 'pdf');
  assert.equal(source.source.kind, 'pdf');
  assert.equal(source.reader.name, PDF_READER_NAME);
  assert.equal(project.name, 'Board update');
  assert.equal(project.checkpoint.stage, 'ingest');
  assert.ok(source.slides.length > 0);
  assert.equal(project.source.pageCount, source.slides.length);
  assert.equal(project.source.hash, `sha256:${createHash('sha256').update(PDF_EDITABLE).digest('hex')}`);
  assert.deepEqual(seen[seen.length - 1], [source.slides.length, source.slides.length], 'progress counts pages');
  for (const ref of mediaRefs(source)) assert.ok(h.blobs.has(ref), `${ref} went through the picture store`);
  assert.deepEqual(slidePictureIds(source), [], 'a born-digital PDF has no page that is a picture');
  assert.equal(await h.store.getPart<SourceDeckV1>(project.id, 'sourceDeck').then((deck) => deck?.source.kind), 'pdf');
});

test('a PDF is known by its signature, and a file named .pdf without one is refused', async () => {
  const h = keepingHarness();
  // The signature, not the name, makes it a PDF.
  const unnamed = deckFile(new Uint8Array(PDF_EDITABLE), 'export', '');
  assert.equal((await ingestDeck(createMockHost(), input(unnamed), h.deps)).source.source.kind, 'pdf');
  assert.equal(hasPdfSignature(new TextEncoder().encode('junk %PDF-1.7')), true, 'a little leading junk is allowed');
  assert.equal(hasPdfSignature(new TextEncoder().encode('PK not a pdf')), false);
  const other = keepingHarness();
  await assert.rejects(
    ingestDeck(createMockHost(), input(deckFile(new TextEncoder().encode('not a pdf'), 'Broken.pdf', 'application/pdf')), other.deps),
    (err: unknown) => err instanceof RebrandIngestError && err.code === 'source.unreadable',
  );
  assert.deepEqual(await other.store.list(), [], 'nothing is stored for a refused file');
});

/** A one-page PDF with `trailer` in its trailer (a cross-reference table) or its cross-reference stream's dictionary. */
function builtPdf(objects: string[], opts: { trailer?: string; xref?: 'table' | 'stream' } = {}): Uint8Array {
  const latin1 = (text: string): number[] => Array.from(text, (ch) => ch.charCodeAt(0));
  const out: number[] = latin1('%PDF-1.7\n');
  const offsets: number[] = [];
  for (const [i, body] of objects.entries()) {
    offsets.push(out.length);
    out.push(...latin1(`${i + 1} 0 obj\n${body}\nendobj\n`));
  }
  const extra = opts.trailer ?? '';
  const xrefAt = out.length;
  if ((opts.xref ?? 'table') === 'table') {
    const rows = ['0000000000 65535 f \n', ...offsets.map((at) => `${String(at).padStart(10, '0')} 00000 n \n`)];
    out.push(...latin1(`xref\n0 ${rows.length}\n${rows.join('')}trailer\n<< /Size ${rows.length} /Root 1 0 R ${extra} >>\nstartxref\n${xrefAt}\n%%EOF\n`));
  } else {
    const entry = (type: number, field: number, gen: number): number[] =>
      [type, (field >>> 24) & 255, (field >>> 16) & 255, (field >>> 8) & 255, field & 255, (gen >>> 8) & 255, gen & 255];
    const data = [...entry(0, 0, 65535), ...offsets.flatMap((at) => entry(1, at, 0)), ...entry(1, xrefAt, 0)];
    out.push(...latin1(`${objects.length + 1} 0 obj\n<< /Type /XRef /Size ${objects.length + 2} /W [1 4 2] /Root 1 0 R ${extra} /Length ${data.length} >>\nstream\n`));
    out.push(...data, ...latin1(`\nendstream\nendobj\nstartxref\n${xrefAt}\n%%EOF\n`));
  }
  return Uint8Array.from(out);
}

/** One blank page, with `content` as its page description. */
const onePage = (content: string): string[] => [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>',
  `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
];
const ENCRYPT_DICT = '<< /Filter /Standard /V 2 /R 3 /Length 128 /P -3904 /O <00> /U <00> >>';

test('an encrypted PDF is refused as source.encrypted before anything is stored, as the node pipeline refuses it', async () => {
  for (const xref of ['table', 'stream'] as const) {
    const h = keepingHarness();
    const locked = builtPdf([...onePage('0 0 m'), ENCRYPT_DICT], { trailer: '/Encrypt 5 0 R', xref });
    await assert.rejects(
      ingestDeck(createMockHost(), input(deckFile(locked, 'Restricted.pdf', 'application/pdf')), h.deps),
      (err: unknown) => err instanceof RebrandIngestError && err.code === 'source.encrypted',
      `${xref}: an /Encrypt entry in the trailer refuses the file`,
    );
    assert.deepEqual(await h.store.list(), [], `${xref}: nothing is stored`);
    assert.deepEqual(h.sources, [], `${xref}: the bytes are not kept`);
    assert.deepEqual(h.pictures, [], `${xref}: no picture is stored`);
  }
  // The words inside a page's text do not make a PDF encrypted.
  const h = keepingHarness();
  const words = builtPdf(onePage('% a page about PDF security: /Encrypt 1 0 R\n0 0 m'));
  assert.equal((await ingestDeck(createMockHost(), input(deckFile(words, 'Security.pdf', 'application/pdf')), h.deps)).source.source.kind, 'pdf');
});

test('a zip package is a pptx even when the PDF signature sits near its start, as the node pipeline sniffs it', async () => {
  const h = keepingHarness();
  const zip = zipSync({ 'a.pdf': new TextEncoder().encode('%PDF-1.7 inside a zip') }, { level: 0 });
  assert.equal(hasPdfSignature(zip), true, 'the signature is in the first kilobyte');
  await assert.rejects(
    ingestDeck(createMockHost(), input(deckFile(zip, 'Hollow.pptx')), h.deps),
    (err: unknown) => err instanceof RebrandIngestError && err.code === 'source.unreadable' && /presentation part/.test(err.message),
  );
  assert.deepEqual(await h.store.list(), []);
});

test('a scanned PDF reads as slide pictures, and the rebuild reads their text with the OCR it is given', async () => {
  const h = keepingHarness();
  const file = deckFile(new Uint8Array(PDF_SCANNED), 'Scanned.pdf', 'application/pdf');
  const { source } = await ingestDeck(createMockHost(), input(file), h.deps);
  const pictures = slidePictureIds(source);
  assert.ok(pictures.length > 0, 'the fixture has scanned pages');
  assert.equal(readerAlgorithm(source), `${PDF_READER_NAME}/${source.reader.version}+keep`, 'a plan says the pages were kept');

  const calls = { n: 0 };
  const seen: Array<[number, number]> = [];
  const stored = h.pictures.length;
  const result = await rebuildSlidePictures(createMockHost(), { source, signal: new AbortController().signal, onProgress: (done, total) => { seen.push([done, total]); } }, {
    storePicture: h.deps.storePicture!,
    deleteAsset: h.deps.deleteAsset!,
    pictureBytes: async (ref) => h.blobs.get(ref) ?? null,
    decodePicture: nodeDecode,
    ocr: stubOcr(calls),
    ocrModel: 'stub-ocr',
    now: () => 1_000,
  });
  assert.deepEqual(seen[0], [0, pictures.length]);
  assert.deepEqual(seen[seen.length - 1], [pictures.length, pictures.length], 'progress counts the slides asked for');
  assert.ok(result.rebuilt > 0, 'at least one page was rebuilt');
  assert.equal(result.rebuilt + result.kept, pictures.length);
  assert.ok(calls.n > 0, 'the OCR it was given read the regions');
  const rebuilt = result.source.slides.filter((slide) => slide.recovery);
  assert.equal(rebuilt.length, result.rebuilt);
  for (const slide of rebuilt) {
    assert.ok(h.blobs.has(slide.recovery!.assetRef), 'the whole-slide picture stays reachable');
    assert.equal(slide.objects.some((one) => one.id === slide.recovery!.fromObjectId), false, 'the picture object is replaced');
  }
  assert.ok(result.source.slides.flatMap((slide) => slide.objects).some((one) => one.kind === 'text' && one.ocr?.model === 'stub-ocr'), 'the text carries the reading as evidence');
  for (const ref of mediaRefs(result.source)) assert.ok(h.blobs.has(ref), `${ref}: every crop went through the same picture store`);
  assert.ok(h.pictures.length >= stored);
  assert.equal(readerAlgorithm(result.source), `${PDF_READER_NAME}/${source.reader.version}+rebuild/ocr:stub-ocr`);
  assert.deepEqual(slidePictureIds(result.source).length, result.kept, 'only the pages that stayed pictures are left to read');
});

test('a cancelled rebuild releases the crops it stored and leaves the deck as it was', async () => {
  const h = keepingHarness();
  const { source } = await ingestDeck(createMockHost(), input(deckFile(new Uint8Array(PDF_SCANNED), 'Scanned.pdf', 'application/pdf')), h.deps);
  const controller = new AbortController();
  h.deleted.length = 0;
  const before = new Set(h.blobs.keys());
  const store = h.deps.storePicture!;
  await assert.rejects(
    rebuildSlidePictures(createMockHost(), { source, signal: controller.signal, onProgress: () => {} }, {
      // The cancel arrives once the first fresh crop is stored, however the OCR reads
      // the page, so the release rule is what is tested.
      storePicture: async (file, startedAt) => {
        const stored = await store(file, startedAt);
        controller.abort();
        return stored;
      },
      deleteAsset: h.deps.deleteAsset!,
      pictureBytes: async (ref) => h.blobs.get(ref) ?? null,
      decodePicture: nodeDecode,
      // Reads nothing, so each text region stays a cropped picture and the crops are stored.
      ocr: async () => [],
      now: () => 1_000,
    }),
    IngestCancelledError,
  );
  const made = [...h.blobs.keys()].filter((ref) => !before.has(ref));
  assert.ok(made.length > 0, 'the rebuild stored crops before the cancel');
  for (const ref of made) assert.ok(h.deleted.includes(ref), `${ref} was released`);
  for (const ref of before) assert.equal(h.deleted.includes(ref), false, `${ref} was the read's own and stays`);
});

test('a rebuilt deck the caller does not keep gives its fresh crops back once the signal aborts', async () => {
  const h = keepingHarness();
  const { source } = await ingestDeck(createMockHost(), input(deckFile(new Uint8Array(PDF_SCANNED), 'Scanned.pdf', 'application/pdf')), h.deps);
  const controller = new AbortController();
  h.deleted.length = 0;
  const before = new Set(h.blobs.keys());
  const result = await rebuildSlidePictures(createMockHost(), { source, signal: controller.signal, onProgress: () => {} }, {
    storePicture: h.deps.storePicture!,
    deleteAsset: h.deps.deleteAsset!,
    pictureBytes: async (ref) => h.blobs.get(ref) ?? null,
    decodePicture: nodeDecode,
    ocr: async () => [],
    ocrModel: 'stub-ocr',
    now: () => 1_000,
  });
  assert.ok(result.rebuilt > 0, 'at least one page was rebuilt');
  const named = [...mediaRefs(result.source)].filter((ref) => !before.has(ref));
  assert.ok(named.length > 0, 'the rebuilt deck names crops of its own');
  assert.equal(named.some((ref) => h.deleted.includes(ref)), false, 'nothing the rebuilt deck names is released while it may be kept');
  // Text recognition ran and found nothing: the reader still says it ran.
  assert.equal(readerAlgorithm(result.source), `${PDF_READER_NAME}/${source.reader.version}+rebuild/ocr:stub-ocr`);
  assert.equal(result.source.reader.version, `${source.reader.version}+rebuild/ocr:stub-ocr`);

  controller.abort();
  await new Promise((resolve) => setTimeout(resolve, 0));
  for (const ref of named) assert.ok(h.deleted.includes(ref), `${ref} was released once the rebuild was dropped`);
  for (const ref of before) assert.equal(h.deleted.includes(ref), false, `${ref} was the read's own and stays`);
});

test('the controller counts the same slide pictures the rebuild would read', async () => {
  const h = keepingHarness();
  const { source } = await ingestDeck(createMockHost(), input(deckFile(new Uint8Array(PDF_SCANNED), 'Scanned.pdf', 'application/pdf')), h.deps);
  assert.deepEqual(slidePictureIdsOf(source), slidePictureIds(source));
  // A page whose picture could not be stored has nothing to rebuild from.
  const first = source.slides.find((slide) => slidePictureIds(source).includes(slide.id))!;
  const unstored: SourceDeckV1 = {
    ...source,
    slides: source.slides.map((slide) => (slide.id === first.id ? { ...slide, objects: slide.objects.map(({ media: _media, ...object }) => object) } : slide)),
  };
  assert.equal(slidePictureIds(unstored).includes(first.id), false);
  assert.deepEqual(slidePictureIdsOf(unstored), slidePictureIds(unstored));
});
