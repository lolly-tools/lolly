// SPDX-License-Identifier: MPL-2.0
/**
 * Reading the slide pictures of a scanned deck in the web shell (plan 274 section 6),
 * through the real controller, the real ingest and the real stages, over the committed
 * `tests/fixtures/rebrand/flattened.pdf`.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/lib/rebrand/read-slide-pictures.test.ts
 *
 * The text recognition model is offered through the shell's own wiring
 * (`createRebrandDeps(...).ensureTextReading`, which is `ensureModel("ocr")`), with the
 * model-offer's dependencies stubbed to say the model is there, or is not and the
 * person has not pressed anything yet. The recogniser is a stub that reads one line over
 * each crop, and pictures decode through the node pipeline's own decoder, so the test
 * needs no browser and no model.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { neutralSlideMaster } from '@lolly/engine';
import type { AssetRef } from '@lolly-tools/core/host-v1';
import type { SourceDeckV1 } from '@lolly-tools/core';
import { createMockHost } from '../../../../../packages/core/src/mock-host.ts';
import type { JobHandle, StartJobOpts } from '../jobs.ts';
import { __setModelOfferDepsForTest } from '../model-offer.ts';
import { decodeBudgetFor } from './budget.ts';
import { createRebrandController, slidePictureIdsOf, type RebrandSlidePictureDepsV1 } from './controller.ts';
import type { RebrandControllerDepsV1, RebrandResolvedSystemV1, RebrandStageNameV1, RebrandStateV1 } from './controller-api.ts';
import { createRebrandDeps } from './deps.ts';
import { ingestDeck, rebuildSlidePictures } from './ingest.ts';
import { createWebProjectStore } from './project-store.ts';
import { censusStage, compileStage, faithfulStage, planStage } from './stage-rebrand.ts';
import type { StageFnV1, StageRunCtxV1 } from './stage-core.ts';

const SCANNED = readFileSync(new URL('../../../../../tests/fixtures/rebrand/flattened.pdf', import.meta.url));

const SYSTEM: RebrandResolvedSystemV1 = {
  input: { id: 'lolly-start', name: 'Lolly start', master: neutralSlideMaster(), colors: { 'color.ink.default': '#11201C' }, neutralMaster: true },
  info: {
    id: 'lolly-start',
    name: 'Lolly start',
    neutralMaster: true,
    hasLogo: false,
    archetypes: ['title', 'content'],
    colors: { 'color.ink.default': '#11201C' },
    fonts: ['Outfit'],
  },
};

const STAGES: Record<RebrandStageNameV1, StageFnV1<never, unknown>> = {
  'rebrand.census': censusStage,
  'rebrand.plan': planStage,
  'rebrand.compile': compileStage,
  'rebrand.faithful': faithfulStage,
};

/** The stages run in place, as the runner's fallback runs them where there is no worker. */
async function runInPlace<I, O>(name: RebrandStageNameV1, input: I, signal: AbortSignal): Promise<O> {
  const ctx: StageRunCtxV1 = {
    budget: decodeBudgetFor({}),
    get cancelled() { return signal.aborted; },
    throwIfCancelled() { signal.throwIfAborted(); },
    progress() {},
  };
  const stage = STAGES[name] as StageFnV1<I, O>;
  return await stage(input, ctx);
}

interface Harness {
  deps: RebrandControllerDepsV1 & RebrandSlidePictureDepsV1;
  /** How often the rebuild ran, and how many crops the recogniser read. */
  counts: { rebuilds: number; ocrCalls: number };
  store: ReturnType<typeof createWebProjectStore>;
  /** Every picture stored, by ref, and the refs released. */
  blobs: Map<string, Blob>;
  deleted: string[];
  /** Set to make the next plan stage fail, as a stage failure after the rebuild would. */
  failPlan: { next: boolean };
  /** Every picture ref stored, in order, kept after a release. */
  stored: string[];
  /** Cleared to make the recogniser read nothing, so each region stays a cropped picture. */
  reads: { text: boolean };
}

function harness(): Harness {
  const host = createMockHost();
  const blobs = new Map<string, Blob>();
  const store = createWebProjectStore(host, {
    now: () => new Date(0).toISOString(),
    async storeUpload(file) {
      const ref: AssetRef = { source: 'user', id: `user/upload/source-${file.name}`, type: 'data', format: 'pdf', url: '' };
      return ref;
    },
    async referencedElsewhere() { return false; },
    async deleteAsset() {},
  });
  let n = 0;
  let projects = 0;
  const storePicture = async (file: File): Promise<{ id: string; fresh: boolean }> => {
    n += 1;
    const id = `user/upload/picture-${n}`;
    blobs.set(id, file);
    stored.push(id);
    return { id, fresh: true };
  };
  const decode = async (blob: Blob) => {
    const { decodePipelinePicture } = await import('@lolly-tools/node-shell/rebrand');
    return decodePipelinePicture(new Uint8Array(await blob.arrayBuffer()), blob.type);
  };
  const shell = createRebrandDeps(host, { design: { navigate: () => ({ id: 'session-1' }), importer: () => ({ landed: 0, keptIds: true }) } });
  const counts = { rebuilds: 0, ocrCalls: 0 };
  const deleted: string[] = [];
  const failPlan = { next: false };
  const stored: string[] = [];
  const reads = { text: true };
  const handle: JobHandle = {
    id: 'job',
    started: Promise.resolve(),
    cancelled: false,
    progress: () => {},
    finish: () => {},
    fail: () => {},
    settle: () => {},
  };
  const deps: Harness['deps'] = {
    store,
    ingest: (input) => ingestDeck(host, input, {
      store,
      storePicture,
      pdfReaders: async () => ({}),
      snapshot: async () => ({ id: 'stub', tokenHash: 'sha256:stub', fontHashes: {}, assetHashes: {} }),
      now: () => 1_000,
      newProjectId: () => {
        projects += 1;
        return `rebrand-scanned-${projects}`;
      },
      newInstanceId: () => 'instance-scanned',
    }),
    runStage: (name, input, _tag, signal) => {
      if (name === 'rebrand.plan' && failPlan.next) {
        failPlan.next = false;
        return Promise.reject(new Error('The first pass failed.'));
      }
      return runInPlace(name, input, signal);
    },
    resolveDesignSystem: async () => SYSTEM,
    readiness: async () => [],
    mediaUrl: async () => undefined,
    releaseMediaUrl() {},
    sourceBytes: async () => null,
    packProject: async () => ({ blob: new Blob(['lolly']), filename: 'x.lolly' }),
    design: { navigate: () => ({ id: 'session-1' }), importer: () => ({ landed: 0, keptIds: true }) },
    async runJob<T>(_opts: StartJobOpts, work: (job: JobHandle) => Promise<T> | T): Promise<T | undefined> {
      return await work(handle);
    },
    previewDelayMs: 0,
    // The shell's own offer: ensureModel("ocr"), stubbed below per case.
    ensureTextReading: shell.ensureTextReading,
    rebuildSlidePictures: (input) => {
      counts.rebuilds += 1;
      return rebuildSlidePictures(host, input, {
        storePicture,
        deleteAsset: async (ref) => {
          deleted.push(ref);
          blobs.delete(ref);
        },
        pictureBytes: async (ref) => blobs.get(ref) ?? null,
        decodePicture: decode,
        ocr: async (frame) => {
          counts.ocrCalls += 1;
          if (!reads.text) return [];
          return [{ text: 'Revenue growth', confidence: 0.99, box: { x: 0, y: 0, w: frame.width, h: frame.height } }];
        },
        ocrModel: 'stub-ocr',
        now: () => 1_000,
      });
    },
  };
  return { deps, counts, store, blobs, deleted, failPlan, stored, reads };
}

const scannedFile = (): File => new File([new Uint8Array(SCANNED) as BlobPart], 'Scanned.pdf', { type: 'application/pdf' });

/**
 * Start a read with the arrival offer declined. A deck of slide pictures asks to read
 * them as it opens (plan 275 decision 29); these cases ask by hand, so the offer made
 * on arrival is answered no, and settled, before they go on.
 */
async function startDeclined(h: Harness, controller: ReturnType<typeof createRebrandController>): Promise<void> {
  const ensure = h.deps.ensureTextReading;
  h.deps.ensureTextReading = async () => false;
  try {
    await controller.start(scannedFile());
    await new Promise((resolve) => setTimeout(resolve, 0));
  } finally {
    h.deps.ensureTextReading = ensure;
  }
}

async function opened(h: Harness): Promise<ReturnType<typeof createRebrandController>> {
  const controller = createRebrandController(h.deps);
  await startDeclined(h, controller);
  const state = controller.getState();
  assert.equal(state.phase, 'review', state.error?.message ?? 'the deck opened for review');
  assert.ok(state.source && slidePictureIdsOf(state.source).length > 0, 'the fixture reads as slide pictures');
  return controller;
}

/** The readiness row the controller reads before it reads slide pictures on arrival. */
const OCR_READY = { id: 'ocr', state: 'ready' as const, message: '', actions: [] };

test('with the model ready, Read the text rebuilds the slide pictures as one job and the decisions carry', async () => {
  __setModelOfferDepsForTest({
    info: async (id) => ({ id, label: 'Text reading', available: true, allowed: true, ready: true, source: 'precache' }),
  });
  try {
    const h = harness();
    const controller = await opened(h);
    const before: RebrandStateV1 = controller.getState();
    const pictures = slidePictureIdsOf(before.source!);
    // A person's own choice before the read: the last slide left out.
    const last = before.plan!.slides[before.plan!.slides.length - 1]!.id;
    assert.equal((await controller.include([last], false)).ok, true);
    const plan = controller.getState().plan!;

    const outcome = await controller.readSlidePictures!();
    assert.equal(outcome.ok, true, `refused: ${outcome.refusal ?? 'none'}`);
    assert.equal(h.counts.rebuilds, 1, 'one rebuild for the whole deck');
    assert.ok(h.counts.ocrCalls > 0, 'the recogniser read the regions');
    const after = controller.getState();
    assert.equal(after.phase, 'review');
    assert.equal(after.progress, null);
    assert.equal(after.error, null);
    assert.equal(outcome.touched + outcome.skipped, pictures.length, 'every slide asked for is accounted for');
    const rebuilt = after.source!.slides.filter((slide) => slide.recovery);
    assert.equal(rebuilt.length, outcome.touched);
    assert.ok(after.plan!.revision > plan.revision, 'the plan made again is a newer revision');
    assert.match(after.plan!.algorithms.reader, /\+rebuild\/ocr:stub-ocr$/, 'the plan records how the pages were read');
    assert.equal(after.plan!.slides.find((slide) => slide.id === last)?.include, false, 'the slide left out stays left out');
    assert.equal(after.history.canUndo, false, 'the undo history was captured against the pictures, so it is cleared');
    assert.ok(after.preview && after.preview.planRevision === after.plan!.revision, 'the Proposed pane is the new plan');
    const stored = await h.store.getPart<SourceDeckV1>(after.project!.id, 'sourceDeck');
    assert.equal(stored?.slides.filter((slide) => slide.recovery).length, rebuilt.length, 'the rebuilt deck is the stored one');

    // Nothing is left to read, so a second ask does nothing.
    if (outcome.skipped === 0) assert.equal((await controller.readSlidePictures!()).refusal, 'nothing-to-do');
  } finally {
    __setModelOfferDepsForTest();
  }
});

test('with the model missing and not asked for, the slides stay pictures and nothing is rebuilt', async () => {
  const notices: string[] = [];
  __setModelOfferDepsForTest({
    info: async (id) => ({ id, label: 'Text reading', available: true, allowed: true, ready: false, source: 'precache' }),
    activated: () => false,
    notify: (message) => { notices.push(message); },
  });
  try {
    const h = harness();
    const controller = await opened(h);
    const before = controller.getState();
    const outcome = await controller.readSlidePictures!();
    assert.equal(outcome.ok, false);
    assert.equal(outcome.refusal, 'nothing-to-do');
    assert.equal(h.counts.rebuilds, 0, 'no rebuild without the model');
    assert.equal(notices.length, 1, 'the in-place offer said how to get the model');
    const after = controller.getState();
    assert.equal(after.source, before.source, 'the slides stay the pictures they were');
    assert.equal(after.plan, before.plan);
  } finally {
    __setModelOfferDepsForTest();
  }
});

test('a newer version of a PDF deck is read into the same lineage, a PDF like the first', async () => {
  __setModelOfferDepsForTest({
    info: async (id) => ({ id, label: 'Text reading', available: true, allowed: true, ready: true, source: 'precache' }),
  });
  try {
    const h = harness();
    const controller = await opened(h);
    const first = controller.getState().project!;
    const editable = readFileSync(new URL('../../../../../tests/fixtures/rebrand-pdf/editable.pdf', import.meta.url));
    await controller.openNewerVersion!(new File([new Uint8Array(editable) as BlobPart], 'Scanned v2.pdf', { type: 'application/pdf' }));
    const state = controller.getState();
    assert.equal(state.phase, 'review', state.error?.message ?? 'the newer version opened for review');
    assert.notEqual(state.project!.id, first.id, 'the newer version is a project of its own');
    assert.equal(state.project!.source.kind, 'pdf');
    assert.equal(state.project!.source.lineageId, first.source.lineageId, 'it joins the lineage of the first');
    assert.ok(state.versions?.some((one) => one.id === first.id), 'the first version stays reachable');
  } finally {
    __setModelOfferDepsForTest();
  }
});

test('a stage that fails after the rebuild leaves the store and the review as they were, and gives the crops back', async () => {
  __setModelOfferDepsForTest({
    info: async (id) => ({ id, label: 'Text reading', available: true, allowed: true, ready: true, source: 'precache' }),
  });
  try {
    const h = harness();
    const controller = await opened(h);
    const before = controller.getState();
    const id = before.project!.id;
    const storedBefore = await h.store.getPart<SourceDeckV1>(id, 'sourceDeck');
    const pictures = new Set(h.stored);
    h.failPlan.next = true;
    h.reads.text = false;
    const outcome = await controller.readSlidePictures!();
    assert.equal(outcome.ok, false);
    assert.equal(h.counts.rebuilds, 1, 'the rebuild ran');
    const after = controller.getState();
    assert.equal(after.source, before.source, 'the review keeps the slide pictures');
    assert.equal(after.plan, before.plan);
    assert.equal(after.error?.step, 'plan', 'the failure is named');
    const storedAfter = await h.store.getPart<SourceDeckV1>(id, 'sourceDeck');
    assert.deepEqual(storedAfter, storedBefore, 'the stored deck is the one the review shows');
    assert.equal((await h.store.get(id))?.checkpoint.stage, before.project!.checkpoint.stage, 'the checkpoint did not move');
    // The crops go back once the dropped result is released, a turn later.
    await new Promise((resolve) => setTimeout(resolve, 10));
    const made = h.stored.filter((ref) => !pictures.has(ref));
    assert.ok(made.length > 0, 'the rebuild stored crops');
    for (const ref of made) assert.ok(h.deleted.includes(ref), `${ref} was given back`);
    for (const ref of pictures) assert.equal(h.deleted.includes(ref), false, `${ref} was the read's own and stays`);
  } finally {
    __setModelOfferDepsForTest();
  }
});

test('a rebuild asked for over one deck does not run on another deck opened while the model was offered', async () => {
  const h = harness();
  let answer: (ready: boolean) => void = () => {};
  h.deps.ensureTextReading = () => new Promise<boolean>((resolve) => { answer = resolve; });
  const controller = await opened(h);
  const asked = controller.readSlidePictures!();
  // The person opens another deck while the download runs.
  await startDeclined(h, controller);
  const other = controller.getState().project!.id;
  answer(true);
  const outcome = await asked;
  assert.equal(outcome.ok, false);
  assert.equal(h.counts.rebuilds, 0, 'nothing was rebuilt');
  assert.equal(controller.getState().project!.id, other);
  assert.equal(controller.getState().source!.slides.some((slide) => slide.recovery), false, 'the deck open now is still slide pictures');
});

test('a reload after another tab rebuilt the slide pictures takes the rebuilt deck with its plan', async () => {
  __setModelOfferDepsForTest({
    info: async (id) => ({ id, label: 'Text reading', available: true, allowed: true, ready: true, source: 'precache' }),
  });
  try {
    const h = harness();
    const here = await opened(h);
    const id = here.getState().project!.id;
    const there = createRebrandController(h.deps);
    await there.open(id);
    assert.equal((await there.readSlidePictures!()).ok, true, 'the other tab rebuilt them');
    await here.reload();
    const state = here.getState();
    assert.equal(state.phase, 'review', state.error?.message ?? 'the project opened again');
    assert.ok(state.source!.slides.some((slide) => slide.recovery), 'the rebuilt deck is the one in hand');
    assert.equal(state.plan!.algorithms.reader, there.getState().plan!.algorithms.reader, 'with the plan made over it');
  } finally {
    __setModelOfferDepsForTest();
  }
});

test('a deck of slide pictures starts reading them as it opens, from the drop itself', async () => {
  __setModelOfferDepsForTest({
    info: async (id) => ({ id, label: 'Text reading', available: true, allowed: true, ready: true, source: 'precache' }),
  });
  try {
    const h = harness();
    // The model is on the device, as the readiness check found it; without it the
    // notice band carries the offer instead (close-out section 2.5).
    h.deps.readiness = async () => [OCR_READY];
    const controller = createRebrandController(h.deps);
    await controller.start(scannedFile());
    await new Promise<void>((resolve, reject) => {
      const deadline = Date.now() + 60_000;
      const tick = (): void => {
        if (controller.getState().source?.slides.some((slide) => slide.recovery)) resolve();
        else if (Date.now() > deadline) reject(new Error('the slide pictures were never read'));
        else setTimeout(tick, 5);
      };
      tick();
    });
    assert.equal(h.counts.rebuilds, 1, 'one read, started by opening the deck');
    assert.equal(controller.getState().phase, 'review');
  } finally {
    __setModelOfferDepsForTest();
  }
});

test('an edit made while the slide pictures are read is refused at once with its reason, not held behind the reading', async () => {
  __setModelOfferDepsForTest({
    info: async (id) => ({ id, label: 'Text reading', available: true, allowed: true, ready: true, source: 'precache' }),
  });
  try {
    const h = harness();
    h.deps.readiness = async () => [OCR_READY];
    // The reading waits on a gate, so the test can act while it runs.
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const rebuild = h.deps.rebuildSlidePictures;
    h.deps.rebuildSlidePictures = async (input) => {
      await gate;
      return rebuild(input);
    };
    const controller = createRebrandController(h.deps);
    await controller.start(scannedFile());
    const slideId = controller.getState().plan!.slides[0]!.id;
    // Give the arrival read the time to reach the rebuild.
    for (let i = 0; i < 200 && controller.getState().progress?.step !== 'read'; i += 1) await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(controller.getState().phase, 'review', 'the review is open');
    assert.equal(controller.getState().progress?.step, 'read', 'and the reading runs');
    const started = Date.now();
    const outcome = await Promise.race([
      controller.setLayout([slideId], 'content'),
      new Promise<'held'>((resolve) => setTimeout(() => resolve('held'), 2_000)),
    ]);
    assert.notEqual(outcome, 'held', 'the edit answered while the reading still ran');
    assert.equal(outcome !== 'held' && outcome.ok, false);
    assert.equal(outcome !== 'held' ? outcome.refusal : '', 'busy', 'refused as busy, which the view says in words');
    assert.ok(Date.now() - started < 2_000);
    release();
    await new Promise<void>((resolve, reject) => {
      const deadline = Date.now() + 60_000;
      const tick = (): void => {
        if (controller.getState().source?.slides.some((slide) => slide.recovery)) resolve();
        else if (Date.now() > deadline) reject(new Error('the slide pictures were never read'));
        else setTimeout(tick, 5);
      };
      tick();
    });
    // Once the reading is done, edits go through again.
    for (let i = 0; i < 200 && controller.getState().progress; i += 1) await new Promise((resolve) => setTimeout(resolve, 5));
    const after = controller.getState().plan!.slides[0]!.id;
    assert.equal((await controller.setLayout([after], 'title')).ok, true, 'an edit after the reading is written');
  } finally {
    __setModelOfferDepsForTest();
  }
});

test('slide pictures are read two slides at a time with one reading at once, a repeated picture is decoded once, and crops are named by their slide', async () => {
  const h = harness();
  const controller = await opened(h);
  const read = controller.getState().source;
  assert.ok(read);
  const first = read.slides.find((slide) => slidePictureIdsOf({ ...read, slides: [slide] }).length === 1);
  const media = first?.objects.find((object) => object.kind === 'pic')?.media;
  assert.ok(first && media, 'the fixture has a slide picture');
  const bytes = h.blobs.get(media);
  assert.ok(bytes);
  // Four slides each with a picture of its own, then the same four sharing one.
  const copies = (shared: boolean): SourceDeckV1 => ({
    ...read,
    slides: [0, 1, 2, 3].map((n) => {
      const slide = structuredClone(first);
      const ref = shared ? media : `${media}.copy${n}`;
      h.blobs.set(ref, bytes);
      return { ...slide, id: `${first.id}.copy${n}`, index: n, objects: slide.objects.map((object) => (object.kind === 'pic' ? { ...object, media: ref } : object)) };
    }),
  });
  const run = async (deck: SourceDeckV1) => {
    const seen = { decodes: 0, decoding: 0, mostDecoding: 0, reading: 0, mostReading: 0, names: [] as string[], progress: [] as number[] };
    let n = 0;
    const result = await rebuildSlidePictures(createMockHost(), {
      source: deck,
      signal: new AbortController().signal,
      onProgress: (done) => seen.progress.push(done),
    }, {
      storePicture: async (file) => {
        seen.names.push(file.name);
        n += 1;
        const id = `user/upload/crop-${n}`;
        h.blobs.set(id, file);
        return { id, fresh: true };
      },
      pictureBytes: async (ref) => h.blobs.get(ref) ?? null,
      decodePicture: async (blob) => {
        seen.decodes += 1;
        seen.decoding += 1;
        seen.mostDecoding = Math.max(seen.mostDecoding, seen.decoding);
        await new Promise((resolve) => setTimeout(resolve, 5));
        const { decodePipelinePicture } = await import('@lolly-tools/node-shell/rebrand');
        const out = await decodePipelinePicture(new Uint8Array(await blob.arrayBuffer()), blob.type);
        seen.decoding -= 1;
        return out;
      },
      ocr: async () => {
        seen.reading += 1;
        seen.mostReading = Math.max(seen.mostReading, seen.reading);
        await new Promise((resolve) => setTimeout(resolve, 1));
        seen.reading -= 1;
        // Nothing read, so each region stays a cropped picture and the crops can be counted.
        return [];
      },
      ocrModel: 'stub-ocr',
      now: () => 1_000,
    });
    return { result, seen };
  };

  const apart = await run(copies(false));
  assert.equal(apart.result.rebuilt, 4, 'every slide was rebuilt');
  assert.deepEqual(apart.result.source.slides.map((slide) => slide.id), [0, 1, 2, 3].map((k) => `${first.id}.copy${k}`), 'the slides keep their order');
  assert.equal(apart.seen.decodes, 4);
  assert.equal(apart.seen.mostDecoding, 2, 'two slides are in hand at once, never more');
  assert.equal(apart.seen.mostReading, 1, 'the recogniser reads one crop at a time');
  assert.deepEqual(apart.seen.progress, [0, 1, 2, 3, 4], 'progress counts the slides finished');
  for (const name of apart.seen.names) assert.match(name, /^Scanned [1-4] \d+\.png$/, name);
  // Each slide's crops are numbered from 1 in that slide, whichever slide finished
  // first. The two slides read together both store theirs; the later ones repeat
  // the same pixels, which the rebuild reuses.
  for (const slide of [1, 2]) {
    const own = apart.seen.names.filter((name) => name.startsWith(`Scanned ${slide} `)).map((name) => Number(name.split(' ')[2]?.split('.')[0]));
    assert.ok(own.length > 0, `slide ${slide} has crops`);
    assert.deepEqual(own, own.map((_, k) => k + 1), `slide ${slide} crops ${own.join(',')}`);
  }

  const shared = await run(copies(true));
  assert.equal(shared.result.rebuilt, 4);
  assert.equal(shared.seen.decodes, 1, 'one picture on four slides is decoded once');
});
