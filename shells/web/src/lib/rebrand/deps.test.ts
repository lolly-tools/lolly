// SPDX-License-Identifier: MPL-2.0
/**
 * The controller's real deps (plan 274 sections 3.5 and 4), against the real module over
 * an in-memory host.
 *
 * What these pin: the stage adapter names each stage, versions it, titles it and drops
 * an envelope that answers for other work; a heavy job lets the stages inside it run
 * rather than queueing behind it; the store keeps the deck verbatim and releases only
 * bytes this journey stored; readiness lists only what is missing; a stored picture
 * comes back as a Blob URL the release revokes.
 */
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import type { AssetRef } from '@lolly-tools/core/host-v1';
import type { DeckCensusV1, SourceDeckV1, StageEnvelopeV1 } from '@lolly-tools/core';
import { CENSUS_RULES, DECK_COMPILE_VERSION, DECK_RENOVATE_VERSION, PLAN_RULES } from '@lolly/engine';
import { createMockHost } from '../../../../../packages/core/src/mock-host.ts';
import { __resetJobsForTest, cancelJob, jobsSnapshot, startJob } from '../jobs.ts';
import type { RebrandControllerDepsV1, RebrandStageNameV1 } from './controller-api.ts';
import {
  OCR_STAGE_READY,
  REBRAND_SOURCE_HINT,
  QUIET_POLL_MS,
  createRebrandDeps,
  loadDesignSystemFaces,
  rebrandStoreFor,
  runJobOverHeavySlot,
  stageRunnerFor,
  type UserAssetWriteV1,
} from './deps.ts';
import { ECHO_STAGE } from './stage-core.ts';
import { StaleReplyError, runStage, type RunStageOptsV1 } from './stage-runner.ts';

const DESIGN: RebrandControllerDepsV1['design'] = {
  navigate: () => ({ id: 'session-1' }),
  importer: () => ({ landed: 0, keptIds: true }),
};

/** A partial record read as the full one, for a function that reads only the named field. */
function shaped<T>(value: unknown): T {
  return value as T;
}

/** A mock host with the web bridge's internal user-asset methods over one map. */
function webHost(assets: AssetRef[] = []) {
  const byId = Object.fromEntries(assets.map((a) => [a.id, a]));
  const base = createMockHost({ assets: byId });
  const records = new Map<string, UserAssetWriteV1>();
  const deleted: string[] = [];
  const internal = {
    async _uploadUserAsset(record: UserAssetWriteV1) { records.set(record.id, record); },
    async _deleteUserAsset(id: string) { deleted.push(id); records.delete(id); },
    async _getUserRecord(id: string) { return records.get(id) ?? null; },
    async _getBlob(id: string) { return records.get(id)?.blob ?? null; },
  };
  Object.assign(base.assets, internal);
  return { host: base, records, deleted };
}

// ─── the stage adapter ───────────────────────────────────────────────────────

test('each stage runs under its name, its project stage, its version and a title', async () => {
  const calls: RunStageOptsV1[] = [];
  const fake = async <I, O>(opts: RunStageOptsV1<I>): Promise<StageEnvelopeV1<O>> => {
    calls.push(opts);
    return {
      projectId: opts.projectId,
      ...(opts.planRevision === undefined ? {} : { planRevision: opts.planRevision }),
      stage: opts.stage,
      algorithmVersion: opts.algorithmVersion,
      result: shaped<O>({ echoed: opts.input }),
    };
  };
  const run = stageRunnerFor(fake);
  const signal = new AbortController().signal;
  const expected: Array<[RebrandStageNameV1, string, string]> = [
    ['rebrand.census', 'census', CENSUS_RULES.version],
    ['rebrand.plan', 'plan', PLAN_RULES.version],
    ['rebrand.compile', 'compile', DECK_RENOVATE_VERSION],
    ['rebrand.faithful', 'compile', DECK_COMPILE_VERSION],
  ];
  for (const [name, stage, version] of expected) {
    const out = await run<{ n: string }, { echoed: { n: string } }>(name, { n: name }, { projectId: 'p1', planRevision: 3 }, signal);
    assert.deepEqual(out, { echoed: { n: name } }, 'the result comes back out of its envelope');
    const call = calls[calls.length - 1];
    assert.equal(call?.name, name);
    assert.equal(call?.stage, stage);
    assert.equal(call?.algorithmVersion, version);
    assert.equal(call?.projectId, 'p1');
    assert.equal(call?.planRevision, 3);
    assert.equal(call?.signal, signal);
    assert.ok(call?.title, 'the job toast has a title');
    // A review edit's compile and colour solve show on the Proposed pane, not the toast.
    assert.equal(call?.quiet === true, name === 'rebrand.compile' || name === 'rebrand.plan', `${name} quiet`);
  }
  assert.equal(new Set(calls.map((c) => c.title)).size, 4, 'each stage has its own title');
});

test('an envelope for another revision, another project or another stage is refused', async () => {
  const signal = new AbortController().signal;
  const answering = (over: Partial<Omit<StageEnvelopeV1, 'result'>>) =>
    stageRunnerFor(async <I, O>(opts: RunStageOptsV1<I>): Promise<StageEnvelopeV1<O>> => ({
      projectId: opts.projectId,
      stage: opts.stage,
      algorithmVersion: opts.algorithmVersion,
      result: shaped<O>({}),
      ...(opts.planRevision === undefined ? {} : { planRevision: opts.planRevision }),
      ...over,
    }));
  await assert.rejects(answering({ planRevision: 2 })('rebrand.plan', {}, { projectId: 'p1', planRevision: 3 }, signal), StaleReplyError);
  await assert.rejects(answering({ projectId: 'p0' })('rebrand.census', {}, { projectId: 'p1' }, signal), StaleReplyError);
  await assert.rejects(answering({ stage: 'plan' })('rebrand.census', {}, { projectId: 'p1' }, signal), StaleReplyError);
});

test('a stage started inside a heavy job runs under its slot instead of queueing behind it', async () => {
  __resetJobsForTest();
  const out = await Promise.race([
    runJobOverHeavySlot({ title: 'Renovating' }, async () => {
      const envelope = await runStage<{ hello: string }, { hello: string }>({
        projectId: 'p1',
        stage: 'census',
        name: ECHO_STAGE,
        algorithmVersion: 'test',
        input: { hello: 'deck' },
        budget: { deviceClass: 'laptop', maxDecodedPixels: 1, maxCacheBytes: 1, thumbnailLongEdge: 1, previewLongEdge: 1, ocrConcurrency: 1, decodeConcurrency: 1 },
        title: 'Checking the slides',
      });
      return envelope.result;
    }),
    new Promise<'stuck'>((resolve) => { setTimeout(() => resolve('stuck'), 2000).unref(); }),
  ]);
  assert.deepEqual(out, { hello: 'deck' });
  const light = await runJobOverHeavySlot({ title: 'Light', heavy: false }, () => 'done');
  assert.equal(light, 'done');
});

test('work a heavy job finished stands when the cancel reaches the slot after it', async () => {
  __resetJobsForTest();
  let cancelled = false;
  const out = await runJobOverHeavySlot({ title: 'Opening in Design', cancel: () => { cancelled = true; } }, async (handle) => {
    // Design has opened by now; the cancel from the toast arrives after the last check.
    cancelJob(handle.id);
    return 'opened';
  });
  assert.equal(cancelled, true, 'the cancel reached the work');
  assert.equal(out, 'opened', 'what the work did is reported, not dropped as a cancel');
});

// ─── the quiet read (close-out section 2.1) ───────────────────────────────────

const BUDGET = { deviceClass: 'laptop' as const, maxDecodedPixels: 1, maxCacheBytes: 1, thumbnailLongEdge: 1, previewLongEdge: 1, ocrConcurrency: 1, decodeConcurrency: 1 };

test('a job run while the view shows the reading puts nothing on the toast, nor do its stages', async () => {
  __resetJobsForTest();
  const seen: number[] = [];
  let dismiss: (() => void) | undefined;
  const out = await runJobOverHeavySlot({ title: 'Reading the deck', quietWhile: () => true }, async (handle) => {
    dismiss = handle.dismiss;
    handle.progress(3, 12, 'Reading slide 4 of 12');
    seen.push(jobsSnapshot().length);
    // A stage the controller runs inside it adopts the quiet run rather than a job of its own.
    const envelope = await runStage<{ hello: string }, { hello: string }>({
      projectId: 'p1', stage: 'census', name: ECHO_STAGE, algorithmVersion: 'test', input: { hello: 'deck' }, budget: BUDGET, title: 'Checking the slides',
      ...(stageSlotFor() ? { slot: stageSlotFor() } : {}),
    });
    seen.push(jobsSnapshot().length);
    return envelope.result;
  });
  assert.deepEqual(out, { hello: 'deck' });
  assert.deepEqual(seen, [0, 0], 'no job on the toast while the reading shows');
  assert.equal(jobsSnapshot().length, 0);
  assert.equal(typeof dismiss, 'function', 'the finished job hands back a dismiss');
  dismiss?.();
});

/** The stage runner the deps build, run once to learn whether it passes a slot: the adapter's own rule. */
function stageSlotFor(): RunStageOptsV1['slot'] {
  let slot: RunStageOptsV1['slot'];
  void stageRunnerFor(async <I, O>(opts: RunStageOptsV1<I>): Promise<StageEnvelopeV1<O>> => {
    slot = opts.slot;
    return { projectId: opts.projectId, stage: opts.stage, algorithmVersion: opts.algorithmVersion, result: shaped<O>({}) };
  })('rebrand.census', {}, { projectId: 'p1' }, new AbortController().signal);
  return slot;
}

test('the toast appears with the last progress once the person leaves the reading, and a cancel from it reaches the work', async () => {
  __resetJobsForTest();
  let quiet = true;
  let cancelled = false;
  const out = await runJobOverHeavySlot({ title: 'Reading the deck', quietWhile: () => quiet, cancel: () => { cancelled = true; } }, async (handle) => {
    handle.progress(2, 10, 'Reading slide 3 of 10');
    assert.equal(jobsSnapshot().length, 0);
    quiet = false;
    // The view is polled, so the toast appears within one poll.
    await new Promise((resolve) => { setTimeout(resolve, QUIET_POLL_MS * 2).unref(); });
    const [job] = jobsSnapshot();
    assert.ok(job, 'the toast shows the read');
    assert.equal(job.title, 'Reading the deck');
    assert.equal(job.heavy, false, 'a light entry, so it never queues behind the work it reports');
    assert.deepEqual(job.progress, { done: 2, total: 10, note: 'Reading slide 3 of 10' });
    handle.progress(3, 10, 'Reading slide 4 of 10');
    assert.equal(jobsSnapshot()[0]?.progress?.done, 3);
    cancelJob(job.id);
    assert.equal(handle.cancelled, true);
    return 'read';
  });
  assert.equal(out, 'read');
  assert.equal(cancelled, true, 'the toast\'s cancel reached the controller');
});

test('a quiet read waits for a heavy job already running, and queues on the toast once it is not quiet', async () => {
  __resetJobsForTest();
  const other = startJob({ title: 'Removing a background' });
  await other.started;
  let started = false;
  const quiet = runJobOverHeavySlot({ title: 'Reading the deck', quietWhile: () => true }, async () => {
    started = true;
    return 'read';
  });
  await new Promise((resolve) => { setTimeout(resolve, QUIET_POLL_MS).unref(); });
  assert.equal(started, false, 'the heavy slot is someone else\'s');
  other.finish();
  other.settle();
  assert.equal(await quiet, 'read');
  assert.equal(jobsSnapshot().some((job) => job.title === 'Reading the deck'), false, 'it ran quietly once the slot was free');

  // Not quiet from the start: the ordinary job, on the toast.
  __resetJobsForTest();
  let listed = 0;
  await runJobOverHeavySlot({ title: 'Opening', quietWhile: () => false }, async () => {
    listed = jobsSnapshot().filter((job) => job.title === 'Opening').length;
  });
  assert.equal(listed, 1);
});

// ─── the design system's faces ───────────────────────────────────────────────

test('the faces load in the weights a slide draws, quoted, and a slow face does not hold the drawing', async () => {
  const asked: string[] = [];
  const doc = globalThis as { document?: unknown };
  const had = 'document' in doc;
  const before = doc.document;
  doc.document = { fonts: { load: (font: string) => { asked.push(font); return new Promise(() => {}); } } };
  try {
    const started = Date.now();
    await loadDesignSystemFaces(['SUSE', 'SUSE Mono', 'SUSE', ' '], 50);
    assert.ok(Date.now() - started < 1000, 'the budget ends the wait');
    assert.deepEqual(asked, ['400 16px "SUSE"', '700 16px "SUSE"', '400 16px "SUSE Mono"', '700 16px "SUSE Mono"']);
    asked.length = 0;
    await loadDesignSystemFaces(['Say "hi"'], 10);
    assert.deepEqual(asked, ['400 16px "Say \\"hi\\""', '700 16px "Say \\"hi\\""']);
  } finally {
    if (had) doc.document = before;
    else delete doc.document;
  }
  // No document at all: nothing to wait for.
  await loadDesignSystemFaces(['SUSE'], 10);
});

test('a .lolly file for a large document is kept as data under its own name', async () => {
  const { host, records } = webHost();
  const deps = createRebrandDeps(host, { design: DESIGN });
  const kept = await deps.saveProjectFile?.({ blob: new Blob(['lolly']), filename: 'Global Collaboration.lolly' });
  assert.deepEqual(kept, { name: 'Global Collaboration.lolly' });
  const [record] = [...records.values()];
  assert.equal(record?.type, 'data');
  assert.equal(record?.format, 'lolly');
  assert.equal(record?.meta?.name, 'Global Collaboration.lolly');
  // A host with no user asset store keeps nothing.
  const bare = createRebrandDeps(createMockHost({}), { design: DESIGN });
  assert.equal(await bare.saveProjectFile?.({ blob: new Blob(['x']), filename: 'x.lolly' }), null);
});

// ─── the store ───────────────────────────────────────────────────────────────

const FACTS = {
  kind: 'pptx' as const,
  hash: 'sha256:deck',
  lineageId: 'sha256:deck',
  instanceId: 'i1',
  name: 'Deck.pptx',
  pageCount: 1,
};
const SNAPSHOT = { id: 'stub', tokenHash: 'sha256:stub', fontHashes: {}, assetHashes: {} };

test('one store per host, and the deck is kept verbatim as data carrying the journey hint', async () => {
  const { host, records } = webHost();
  const store = rebrandStoreFor(host);
  assert.equal(rebrandStoreFor(host), store);
  assert.equal(createRebrandDeps(host, { design: DESIGN }).store, store);

  const file = new File([new Uint8Array([0x50, 0x4b, 3, 4])], 'Deck.pptx');
  const project = await store.create({ id: 'p1', name: 'Deck', source: FACTS, designSystem: SNAPSHOT }, { bytes: file });
  const ref = project.source.bytesAssetRef;
  assert.ok(ref);
  const record = records.get(ref);
  assert.equal(record?.type, 'data');
  assert.equal(record?.format, 'pptx');
  assert.equal(record?.blob, file, 'the bytes are stored as they arrived');
  const provenance = record?.meta?.provenance as { sourceHint?: string } | undefined;
  assert.equal(provenance?.sourceHint, REBRAND_SOURCE_HINT);

  const removed = await store.remove('p1');
  assert.deepEqual(removed.removedAssetRefs, [ref], 'bytes the journey stored are released with it');
  assert.equal(records.has(ref), false);
});

test('bytes the person uploaded before are kept when a project that named them is removed', async () => {
  const { host, records, deleted } = webHost();
  records.set('user/upload/1-logo.png', {
    id: 'user/upload/1-logo.png',
    type: 'raster',
    format: 'png',
    blob: new Blob([new Uint8Array([1])]),
    meta: { name: 'logo.png', provenance: { sourceHint: 'picker' } },
  });
  const store = rebrandStoreFor(host);
  await store.create({ id: 'p2', name: 'Deck', source: { ...FACTS, bytesAssetRef: 'user/upload/1-logo.png' }, designSystem: SNAPSHOT });
  const removed = await store.remove('p2');
  assert.deepEqual(removed.keptAssetRefs, ['user/upload/1-logo.png']);
  assert.deepEqual(deleted, []);
});

// ─── the rest ────────────────────────────────────────────────────────────────

test('readiness lists only what is missing, and asks about text reading while a slide is still a picture', async () => {
  const logo: AssetRef = { source: 'library', id: 'lolly/logo/primary', type: 'vector', format: 'svg', url: '/p.svg', meta: { tags: ['logo', 'primary'] } };
  const { host } = webHost([logo]);
  const deps = createRebrandDeps(host, { design: DESIGN });
  const picture = { id: 's1.pic', kind: 'pic', origin: 'pdf-artifact', box: { x: 0, y: 0, w: 960, h: 540, rot: 0 }, media: 'user/upload/1-page.png' };
  const pictures = shaped<SourceDeckV1>({ slides: [{ id: 's1', origin: { kind: 'pdf', flattened: true }, objects: [picture] }] });
  const { media: _media, ...unstoredPicture } = picture;
  const unstored = shaped<SourceDeckV1>({ slides: [{ id: 's1', origin: { kind: 'pdf', flattened: true }, objects: [unstoredPicture] }] });
  const rebuilt = shaped<SourceDeckV1>({
    slides: [{ id: 's1', origin: { kind: 'pdf', flattened: true }, recovery: { assetRef: 'user/upload/1-page.png', fromObjectId: 's1.pic' }, objects: [] }],
  });
  const flat = shaped<DeckCensusV1>({ flattenedSlideIds: ['s1'] });
  const editable = shaped<DeckCensusV1>({ flattenedSlideIds: [] });

  // The web rebrand reads slide pictures (OCR_STAGE_READY), so a deck with a slide
  // that is still a picture asks about text reading.
  assert.equal(OCR_STAGE_READY, true);
  const rows = await deps.readiness(pictures, flat);
  assert.deepEqual(rows.map((row) => row.id).sort(), ['logo:on-dark', 'ocr']);
  assert.ok(rows.every((row) => row.state !== 'ready'));
  const done = await deps.readiness(rebuilt, flat);
  assert.deepEqual(done.map((row) => row.id), ['logo:on-dark'], 'once every picture is rebuilt, the download changes nothing');
  const plain = await deps.readiness(pictures, editable);
  assert.deepEqual(plain.map((row) => row.id), ['logo:on-dark'], 'no text reading row for an editable deck');
  const nothing = await deps.readiness(unstored, flat);
  assert.deepEqual(nothing.map((row) => row.id), ['logo:on-dark'], 'a picture whose bytes were not stored cannot be rebuilt, so the download is not asked for');
});

test('the slide pictures are read through the in-place model offer and the ingest rebuild', async () => {
  const { host } = webHost();
  const deps = createRebrandDeps(host, { design: DESIGN });
  assert.equal(typeof deps.ensureTextReading, 'function');
  assert.equal(typeof deps.rebuildSlidePictures, 'function');
  const src = readFileSync(new URL('./deps.ts', import.meta.url), 'utf8');
  assert.match(src, /ensureTextReading: \(purpose\) => ensureModel\('ocr', \{ reason: textReadingReason\(purpose\) \}\)/, 'the offer is ensureModel, never a route');
  assert.doesNotMatch(src, /#\/profile|OFFLINE_ROUTE/);
});

test('a stored picture comes back as a Blob URL that the release revokes', async () => {
  const { host, records } = webHost();
  records.set('user/upload/2-p.png', { id: 'user/upload/2-p.png', type: 'raster', format: 'png', blob: new Blob([new Uint8Array([9])]) });
  const deps = createRebrandDeps(host, { design: DESIGN });
  const url = await deps.mediaUrl('user/upload/2-p.png');
  assert.ok(url);
  assert.ok(url.startsWith('blob:'));
  assert.equal((await (await fetch(url)).arrayBuffer()).byteLength, 1);
  deps.releaseMediaUrl(url);
  await assert.rejects(fetch(url), 'a revoked URL no longer resolves');
});

test('the retained source bytes come back through the user asset store', async () => {
  const { host } = webHost();
  const deps = createRebrandDeps(host, { design: DESIGN });
  const file = new File([new Uint8Array([0x50, 0x4b, 7])], 'Deck.pptx');
  const project = await deps.store.create({ id: 'p3', name: 'Deck', source: FACTS, designSystem: SNAPSHOT }, { bytes: file });
  assert.deepEqual(await deps.sourceBytes(project), new Uint8Array([0x50, 0x4b, 7]));
  assert.equal(await deps.sourceBytes({ ...project, source: { ...project.source, bytesAssetRef: undefined } }), null);
});

test('the project packs into a .lolly file', async () => {
  const { host } = webHost();
  const deps = createRebrandDeps(host, { design: DESIGN });
  const project = await deps.store.create({ id: 'p4', name: 'Quarterly review', source: FACTS, designSystem: SNAPSHOT });
  const download = await deps.packProject(project);
  assert.match(download.filename, /\.lolly$/);
  assert.ok(download.blob.size > 0);
});
