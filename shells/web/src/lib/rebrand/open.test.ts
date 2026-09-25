// SPDX-License-Identifier: MPL-2.0
/**
 * Opening a renovation `.lolly` on a device that has never seen it (plan 274 section 3.5,
 * reached through the drop door of section 2.1).
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/lib/rebrand/open.test.ts
 *
 * The fixture is a real file: `buildRenovationLolly` writes it from a project whose
 * record and parts point at four pictures, three of which the sending device still
 * holds. Reading it back through the real ingest is the point of the suite, because the
 * receiver-local ids are minted in there and the rebase is worthless against ids a mock
 * chose.
 *
 * The store is written here rather than imported. It keeps the suite free of IndexedDB,
 * and it makes the two rules these tests lean on visible: a write states the revision it
 * read, and an id already in use is refused with `project-exists` rather than
 * overwritten. Quota is a switch on the same store, so the refused-part path runs
 * against a store that otherwise behaves.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type {
  CompiledDeckV1,
  DeckCensusV1,
  ProjectPartKindV1,
  ProjectStageV1,
  ProjectWriteResultV1,
  RenovationPlanV1,
  RenovationProjectStoreV1,
  RenovationProjectV1,
  SourceDeckV1,
} from '@lolly-tools/core';
import type { BeamAssetRecord, BeamPackHost, BeamSessionRow } from '../beam-pack.ts';
import { buildLollyFile } from '../lolly-pack.ts';
import { buildRenovationLolly, type RenovationPartsV1 } from '../lolly-renovation.ts';
import { openRenovationFile, rebaseAssetRefs } from './open.ts';

// ─── an in-memory store implementing the contract ────────────────────────────

type PartValue = SourceDeckV1 | DeckCensusV1 | RenovationPlanV1 | CompiledDeckV1;

/** The refusal the web store raises for an id this device already holds. */
class ExistsError extends Error {
  readonly refusal = 'project-exists' as const;
  constructor(id: string) {
    super(`A renovation project ${id} is already stored on this device.`);
    this.name = 'ProjectExistsError';
  }
}

class MemoryStore implements RenovationProjectStoreV1 {
  readonly projects = new Map<string, RenovationProjectV1>();
  readonly parts = new Map<string, PartValue>();
  /** Flip to make every part write answer `quota`, as a full device would. */
  quotaFull = false;
  readonly writes: string[] = [];

  private key(id: string, kind: ProjectPartKindV1): string {
    return `${id}:${kind}`;
  }

  async list(): Promise<RenovationProjectV1[]> {
    return [...this.projects.values()];
  }

  async get(id: string): Promise<RenovationProjectV1 | null> {
    const stored = this.projects.get(id);
    return stored ? structuredClone(stored) : null;
  }

  async create(
    input: Omit<RenovationProjectV1, 'version' | 'revision' | 'checkpoint' | 'parts' | 'designSessionIds'>,
  ): Promise<RenovationProjectV1> {
    if (this.projects.has(input.id)) throw new ExistsError(input.id);
    const project: RenovationProjectV1 = {
      ...input,
      version: 1,
      revision: 1,
      checkpoint: { stage: 'ingest' },
      parts: {},
      designSessionIds: [],
    };
    this.projects.set(project.id, project);
    this.writes.push(`create:${project.id}`);
    return structuredClone(project);
  }

  private guard(id: string, expectedRevision: number): ProjectWriteResultV1 | RenovationProjectV1 {
    const stored = this.projects.get(id);
    if (!stored) return { ok: false, refusal: 'missing-project', message: `No project ${id}.` };
    if (stored.revision !== expectedRevision) {
      return {
        ok: false,
        refusal: 'stale-revision',
        message: 'Another view changed this project.',
        currentRevision: stored.revision,
      };
    }
    return stored;
  }

  async update(
    id: string,
    expectedRevision: number,
    patch: Partial<Omit<RenovationProjectV1, 'id' | 'version' | 'revision'>>,
  ): Promise<ProjectWriteResultV1> {
    const g = this.guard(id, expectedRevision);
    if ('ok' in g) return g;
    const next = { ...g, ...patch, revision: g.revision + 1 };
    this.projects.set(id, next);
    this.writes.push(`update:${id}`);
    return { ok: true, revision: next.revision };
  }

  async putPart(
    id: string,
    expectedRevision: number,
    kind: ProjectPartKindV1,
    value: PartValue,
  ): Promise<ProjectWriteResultV1> {
    const g = this.guard(id, expectedRevision);
    if ('ok' in g) return g;
    if (this.quotaFull) return { ok: false, refusal: 'quota', message: 'No room left on this device.' };
    this.parts.set(this.key(id, kind), structuredClone(value));
    const next: RenovationProjectV1 = {
      ...g,
      parts: { ...g.parts, [kind]: this.key(id, kind) },
      revision: g.revision + 1,
    };
    this.projects.set(id, next);
    this.writes.push(`part:${kind}`);
    return { ok: true, revision: next.revision };
  }

  async getPart<T = unknown>(id: string, kind: ProjectPartKindV1): Promise<T | null> {
    const value = this.parts.get(this.key(id, kind));
    return value ? (structuredClone(value) as T) : null;
  }

  async checkpoint(
    id: string,
    expectedRevision: number,
    stage: ProjectStageV1,
    planRevision?: number,
  ): Promise<ProjectWriteResultV1> {
    const g = this.guard(id, expectedRevision);
    if ('ok' in g) return g;
    const next: RenovationProjectV1 = {
      ...g,
      checkpoint: { stage, at: NOW, ...(planRevision === undefined ? {} : { planRevision }) },
      revision: g.revision + 1,
    };
    this.projects.set(id, next);
    this.writes.push(`checkpoint:${stage}`);
    return { ok: true, revision: next.revision };
  }

  async remove(id: string): Promise<{ removedAssetRefs: string[]; keptAssetRefs: string[] }> {
    this.projects.delete(id);
    for (const key of [...this.parts.keys()]) if (key.startsWith(`${id}:`)) this.parts.delete(key);
    return { removedAssetRefs: [], keptAssetRefs: [] };
  }
}

/** A receiving device: saved-session slots and a user asset store, both in memory. */
function stubHost(): { host: BeamPackHost; slots: Map<string, unknown>; userStore: Map<string, BeamAssetRecord> } {
  const slots = new Map<string, unknown>();
  const userStore = new Map<string, BeamAssetRecord>();
  const host: BeamPackHost = {
    state: {
      list: async (): Promise<BeamSessionRow[]> => [...slots.keys()].map((slot) => ({ slot })),
      load: async (slot: string) => slots.get(slot) ?? null,
      save: async (slot: string, data: unknown) => {
        slots.set(slot, data);
      },
      delete: async (slot: string) => {
        slots.delete(slot);
      },
    },
    assets: {
      _exportUserAssets: async () => [...userStore.values()],
      _uploadUserAsset: async (record: BeamAssetRecord) => {
        userStore.set(record.id, record);
      },
      _getUserRecord: async (id: string) => userStore.get(id) ?? null,
      _deleteUserAsset: async (id: string) => {
        userStore.delete(id);
      },
    },
  };
  return { host, slots, userStore };
}

// ─── fixtures ────────────────────────────────────────────────────────────────

const NOW = '2026-09-24T09:00:00.000Z';
const now = (): string => NOW;

const SOURCE_REF = 'user/rebrand/source/sha256-deck';
const PHOTO_REF = 'user/rebrand/media/sha256-photo';
const SHOT_REF = 'user/rebrand/media/sha256-shot';
const LOST_REF = 'user/rebrand/media/sha256-lost';

const PNG = (tag: number) => new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, tag, 0, 0]);
const held = (id: string, tag: number): BeamAssetRecord => ({
  id,
  type: 'raster',
  format: 'png',
  blob: new Blob([PNG(tag)], { type: 'image/png' }),
  meta: { name: `${id.split('/').pop()}.png` },
});

function sampleProject(): RenovationProjectV1 {
  return {
    version: 1,
    id: 'ren-meddpicc',
    name: 'MEDDPICC Question-based Selling',
    source: {
      kind: 'pptx',
      hash: 'sha256:aa11',
      lineageId: 'lin-1',
      instanceId: 'inst-1',
      name: 'MEDDPICC Question-based Selling - SAP.pptx',
      bytes: 2_100_000,
      pageCount: 24,
      bytesAssetRef: SOURCE_REF,
    },
    checkpoint: { stage: 'plan', at: '2026-09-23T10:00:00.000Z', planRevision: 2 },
    revision: 7,
    designSystem: { id: 'suse', tokenHash: 'sha256:bb22', fontHashes: {}, assetHashes: {} },
    parts: { sourceDeck: 'part-source', census: 'part-census', plan: 'part-plan' },
    designSessionIds: [],
    createdAt: '2026-09-23T09:00:00.000Z',
    updatedAt: '2026-09-23T10:00:00.000Z',
  };
}

function sampleParts(): RenovationPartsV1 {
  const sourceDeck: SourceDeckV1 = {
    version: 1,
    source: { kind: 'pptx', hash: 'sha256:aa11', lineageId: 'lin-1', instanceId: 'inst-1', pageCount: 1 },
    slides: [
      {
        id: 'slide1',
        index: 0,
        width: 1280,
        height: 720,
        background: { media: PHOTO_REF },
        objects: [
          {
            id: 'slide1.1',
            fingerprint: 'fp1',
            kind: 'pic',
            box: { x: 0, y: 0, w: 400, h: 300, rot: 0 },
            origin: 'slide',
            fidelity: { state: 'raster-preserved' },
            media: PHOTO_REF,
          },
          {
            id: 'slide1.2',
            fingerprint: 'fp2',
            kind: 'chart',
            box: { x: 0, y: 320, w: 400, h: 300, rot: 0 },
            origin: 'slide',
            fidelity: { state: 'raster-preserved', reason: 'native-chart-no-fallback', fallbackAssetRef: LOST_REF },
          },
        ],
        readingOrder: ['slide1.1', 'slide1.2'],
        warnings: [],
        origin: { kind: 'pptx' },
        preview: { assetRef: SHOT_REF, fidelity: 'raster-preserved' },
      },
    ],
    fonts: [],
    warnings: [],
    reader: { name: 'pptx-read', version: '1.0' },
  };
  const census: DeckCensusV1 = {
    version: 1,
    sourceHash: 'sha256:aa11',
    rules: { name: 'deck-census', version: '1.0' },
    objects: [],
    groups: [],
    colors: { uses: [], contrastPairs: [] },
    fonts: [],
    layouts: [],
    flattenedSlideIds: [],
    warnings: [],
  };
  const plan: RenovationPlanV1 = {
    version: 1,
    source: { lineageId: 'lin-1', hash: 'sha256:aa11', instanceId: 'inst-1' },
    revision: 2,
    designSystem: { id: 'suse', tokenHash: 'sha256:bb22', fontHashes: {}, assetHashes: {} },
    algorithms: { reader: '1.0', census: '1.0', plan: '1.0' },
    mode: 'renovate',
    slides: [
      {
        id: 'slide1',
        include: true,
        layout: 'content',
        layoutSource: 'proposed',
        objects: [
          {
            id: 'slide1.1',
            class: 'photo',
            evidence: [],
            proposal: 'replace',
            decision: 'replace',
            decisionReplacement: { kind: 'supplied-picture', assetRef: SHOT_REF },
            review: 'accepted',
          },
        ],
      },
    ],
    colors: [],
    fonts: [],
    logo: { policy: 'brand', variantByBackground: true },
    decisions: [],
  };
  const compiled: CompiledDeckV1 = {
    version: 1,
    source: { lineageId: 'lin-1', hash: 'sha256:aa11', instanceId: 'inst-1' },
    planRevision: 2,
    designSystem: { id: 'suse', tokenHash: 'sha256:bb22', fontHashes: {}, assetHashes: {} },
    algorithms: { reader: '1.0', census: '1.0', plan: '1.0', compile: '1.0' },
    frames: [
      {
        id: 'frame1',
        sourceSlideId: 'slide1',
        name: 'Opening',
        width: 1280,
        height: 720,
        archetype: 'title',
        layers: [{ id: 'layer1', frame: 'frame1', kind: 'image', image: PHOTO_REF }],
        furnitureLayerIds: [],
        placeholderLayerIds: [],
      },
    ],
    tray: [],
    lineage: { forward: [], backward: [] },
    report: {
      version: 1,
      sourceHash: 'sha256:aa11',
      planRevision: 2,
      counts: {
        slides: { source: 1, included: 1, excluded: 0, continuation: 0 },
        objects: { retained: 1, transformed: 0, removed: 0, unresolved: 0 },
        byClass: {},
        logosReplaced: 0,
        coloursAssigned: 0,
        coloursUnresolved: 0,
        fontsSubstituted: 0,
        appliedUnreviewed: 0,
      },
      entries: [],
    },
  };
  return { sourceDeck, census, plan, compiled };
}

/** The sending device still holds three of the four pictures the renovation names. */
async function sampleFile(): Promise<Uint8Array> {
  const store = new Map([held(SOURCE_REF, 1), held(PHOTO_REF, 2), held(SHOT_REF, 3)].map((r) => [r.id, r]));
  const built = await buildRenovationLolly({
    project: sampleProject(),
    parts: sampleParts(),
    resolveAsset: async (ref) => store.get(ref) ?? null,
  });
  return built.bytes;
}

// ─── the rebase on its own ───────────────────────────────────────────────────

test('rebaseAssetRefs points every named key at the local id and leaves the rest alone', () => {
  const rekey = new Map([[PHOTO_REF, 'user/upload/1-photo.png']]);
  const before = {
    source: { bytesAssetRef: LOST_REF },
    slides: [{ background: { media: PHOTO_REF }, preview: { assetRef: PHOTO_REF, fidelity: 'approximate' } }],
    replacement: { kind: 'asset', id: PHOTO_REF },
    layers: [{ image: `${PHOTO_REF}?treatment=mono`, label: PHOTO_REF }],
  };
  const after = rebaseAssetRefs(before, rekey);

  assert.equal(after.rebased, 3, 'the background, the preview and the compiled layer; the catalog asset is not one of them');
  assert.deepEqual(after.unresolved, [LOST_REF]);
  assert.equal(after.value.slides[0]!.background.media, 'user/upload/1-photo.png');
  assert.equal(after.value.slides[0]!.preview.assetRef, 'user/upload/1-photo.png');
  assert.equal(after.value.layers[0]!.image, 'user/upload/1-photo.png?treatment=mono', 'a treatment picks a treatment, not another picture');
  assert.equal(after.value.replacement.id, PHOTO_REF, 'a catalog asset is named under id and the catalog owns it on both devices');
  assert.equal(after.value.layers[0]!.label, PHOTO_REF, 'a ref-shaped string under another key is not a ref');
  assert.equal(before.slides[0]!.background.media, PHOTO_REF, 'the contents the reader handed back are not mutated');
});

// ─── opening a file ──────────────────────────────────────────────────────────

test('the record and every part point at the ids this device minted', async () => {
  const bytes = await sampleFile();
  const { host, userStore } = stubHost();
  const store = new MemoryStore();

  const opened = await openRenovationFile({ bytes, host, store, now });

  assert.equal(opened.projectId, 'ren-meddpicc');
  assert.equal(opened.route, '#/rebrand?project=ren-meddpicc');
  assert.equal(opened.imported, 3);

  const project = await store.get('ren-meddpicc');
  assert.ok(project, 'the project is on the device');
  const source = project.source.bytesAssetRef!;
  assert.notEqual(source, SOURCE_REF, 'the retained bytes point at this device, not the sender');
  assert.ok(userStore.has(source), 'and the bytes are here under that id');
  assert.equal(project.name, 'MEDDPICC Question-based Selling');
  assert.equal(project.source.pageCount, 24);

  const deck = await store.getPart<SourceDeckV1>('ren-meddpicc', 'sourceDeck');
  const slide = deck!.slides[0]!;
  const photo = slide.objects[0]!.media!;
  assert.notEqual(photo, PHOTO_REF);
  assert.ok(userStore.has(photo), 'the picture on the slide is on this device');
  assert.equal(slide.background.media, photo, 'one picture used twice keeps one id');
  assert.notEqual(slide.preview!.assetRef, SHOT_REF);
  assert.ok(userStore.has(slide.preview!.assetRef), 'the slide preview came across too');
  assert.equal(slide.objects[1]!.fidelity.fallbackAssetRef, LOST_REF, 'a picture the sender had lost is left naming nothing rather than pointed somewhere wrong');

  const plan = await store.getPart<RenovationPlanV1>('ren-meddpicc', 'plan');
  const replacement = plan!.slides[0]!.objects[0]!.decisionReplacement!;
  assert.equal(replacement.kind, 'supplied-picture');
  assert.equal(replacement.kind === 'supplied-picture' ? replacement.assetRef : '', slide.preview!.assetRef, 'a picture a person supplied is rebased with the rest');

  const compiled = await store.getPart<CompiledDeckV1>('ren-meddpicc', 'compiled');
  assert.equal(compiled!.frames[0]!.layers[0]!.image, photo, 'and so is a compiled picture layer');

  assert.deepEqual(opened.warnings.map((w) => w.code), ['media-missing']);
  assert.equal(opened.warnings[0]!.count, 1, 'and the count travels with the code, so a view can word it');
});

test('the checkpoint the file carried is restored, with the plan revision it belongs to', async () => {
  const bytes = await sampleFile();
  const { host } = stubHost();
  const store = new MemoryStore();

  await openRenovationFile({ bytes, host, store, now });

  const project = await store.get('ren-meddpicc');
  assert.deepEqual(project!.checkpoint, { stage: 'plan', at: NOW, planRevision: 2 });
  assert.deepEqual(store.writes, [
    'create:ren-meddpicc',
    'part:sourceDeck',
    'part:census',
    'part:plan',
    'part:compiled',
    'checkpoint:plan',
  ]);
});

test('an id this device already holds opens as a separate copy, never over the first one', async () => {
  const bytes = await sampleFile();
  const { host } = stubHost();
  const store = new MemoryStore();

  const first = await openRenovationFile({ bytes, host, store, now });
  const second = await openRenovationFile({ bytes, host, store, now });

  assert.equal(first.projectId, 'ren-meddpicc');
  assert.equal(second.projectId, 'ren-meddpicc-2');
  assert.equal(second.route, '#/rebrand?project=ren-meddpicc-2');
  assert.ok(
    second.warnings.some((w) => w.code === 'renamed'),
    'and the person is told which one they are looking at',
  );
  const kept = await store.get('ren-meddpicc');
  assert.equal(kept!.checkpoint.stage, 'plan', 'the first copy is untouched');
  assert.equal((await store.list()).length, 2);
});

test('a part the device refuses is reported, and no stage is marked over work that is not here', async () => {
  const bytes = await sampleFile();
  const { host } = stubHost();
  const store = new MemoryStore();
  store.quotaFull = true;

  const opened = await openRenovationFile({ bytes, host, store, now });

  assert.equal(opened.warnings[0]!.code, 'part-refused');
  assert.equal(opened.warnings[0]!.kind, 'sourceDeck');
  assert.match(opened.warnings[0]!.message, /^No room left on this device\./);
  assert.ok(opened.warnings.some((w) => w.code === 'partial-stage'));
  const project = await store.get(opened.projectId);
  assert.equal(project!.checkpoint.stage, 'ingest', 'the project opens at the stage its records support');
  assert.deepEqual(store.writes, ['create:ren-meddpicc'], 'the refused write stops the rest rather than repeating itself');
});

test('a record with no readable source is turned away before a byte is written', async () => {
  const project = sampleProject();
  const built = await buildRenovationLolly({
    project: { ...project, source: { ...project.source, hash: '' } },
    parts: sampleParts(),
    resolveAsset: async () => held(PHOTO_REF, 2),
  });
  const { host, userStore } = stubHost();
  const store = new MemoryStore();

  await assert.rejects(
    openRenovationFile({ bytes: built.bytes, host, store, now }),
    /no readable source document/,
  );
  assert.equal(userStore.size, 0, 'nothing is left behind in the library');
  assert.equal((await store.list()).length, 0);
});

test('a document travelling beside the renovation still lands, and the person is told', async () => {
  const built = await buildLollyFile({
    toolId: 'chart',
    session: { __toolId: 'chart', title: 'Q3' },
    name: 'both',
    userAssets: [held(SOURCE_REF, 1)],
    renovation: {
      id: 'ren-mixed',
      name: 'Mixed',
      project: {
        version: 1,
        id: 'ren-mixed',
        name: 'Mixed',
        source: { kind: 'pptx', hash: 'sha256:cc33', lineageId: 'lin-2', instanceId: 'inst-2', pageCount: 4, bytesAssetRef: SOURCE_REF },
        checkpoint: { stage: 'ingest' },
        revision: 1,
        designSystem: { id: 'lolly-start', tokenHash: 'sha256:dd44', fontHashes: {}, assetHashes: {} },
        parts: {},
        designSessionIds: [],
      },
      assets: [SOURCE_REF],
    },
  });
  const { host, slots } = stubHost();
  const store = new MemoryStore();

  const opened = await openRenovationFile({
    bytes: new Uint8Array(await built.blob.arrayBuffer()),
    host,
    store,
    now,
  });

  assert.equal(opened.projectId, 'ren-mixed');
  assert.equal(slots.size, 1, 'the document lands in Projects as every other .lolly does');
  assert.ok(opened.warnings.some((w) => w.code === 'document-landed' && w.count === 1));
  const project = await store.get('ren-mixed');
  assert.notEqual(project!.source.bytesAssetRef, SOURCE_REF);
  assert.equal(project!.checkpoint.stage, 'ingest', 'a checkpoint that completed nothing is not restored as though it had');
});

// ─── the store takes a different id than the one asked for ───────────────────

/**
 * Another tab creating the same project between the free-id check and the create. The
 * store really does hold it by then, so the retry has to land somewhere else - and every
 * write after it has to follow.
 */
class RacingStore extends MemoryStore {
  raced = false;
  override async create(
    input: Omit<RenovationProjectV1, 'version' | 'revision' | 'checkpoint' | 'parts' | 'designSessionIds'>,
  ): Promise<RenovationProjectV1> {
    if (!this.raced) {
      this.raced = true;
      await super.create({ ...input, name: 'The copy that was already here' });
      throw new ExistsError(input.id);
    }
    return super.create(input);
  }
}

test('when the store takes a different id, every part follows it and nothing is written over', async () => {
  const bytes = await sampleFile();
  const { host } = stubHost();
  const store = new RacingStore();

  const opened = await openRenovationFile({ bytes, host, store, now });

  assert.equal(opened.projectId, 'ren-meddpicc-2', 'the id the store took, not the id that was asked for');
  assert.equal(opened.route, '#/rebrand?project=ren-meddpicc-2');
  assert.equal(opened.project.id, 'ren-meddpicc-2');
  assert.ok(opened.warnings.some((w) => w.code === 'renamed'));

  const other = await store.get('ren-meddpicc');
  assert.equal(other!.name, 'The copy that was already here', 'the project that was here is untouched');
  assert.equal(other!.revision, 1);
  assert.deepEqual(other!.parts, {}, 'and this file wrote none of its records into it');
  assert.equal(other!.checkpoint.stage, 'ingest');

  const landed = await store.get('ren-meddpicc-2');
  assert.equal(landed!.checkpoint.stage, 'plan', 'the checkpoint went to the project the file opened as');
  assert.ok(await store.getPart('ren-meddpicc-2', 'sourceDeck'));
});

// ─── a stage is only marked over the records it stands on ────────────────────

test('a file claiming it is finished, carrying nothing, is not checkpointed as finished', async () => {
  const project = sampleProject();
  const built = await buildRenovationLolly({
    project: { ...project, checkpoint: { stage: 'done', at: '2026-09-23T11:00:00.000Z' }, parts: {} },
    parts: {},
    resolveAsset: async () => null,
  });
  const { host } = stubHost();
  const store = new MemoryStore();

  const opened = await openRenovationFile({ bytes: built.bytes, host, store, now });

  assert.ok(opened.warnings.some((w) => w.code === 'partial-stage'));
  const landed = await store.get(opened.projectId);
  assert.equal(landed!.checkpoint.stage, 'ingest', 'a finished renovation with no compiled deck is not a finished renovation');
  assert.deepEqual(store.writes, ['create:ren-meddpicc']);
});

// ─── the rebase walk's own edges ─────────────────────────────────────────────

test('a field named __proto__ stays a field, and a subtree past the depth cap is counted', () => {
  const carried = JSON.parse('{"__proto__":{"version":1},"media":"a"}') as Record<string, unknown>;
  const after = rebaseAssetRefs(carried, new Map([['a', 'user/upload/1.png']]));

  assert.ok(Object.hasOwn(after.value, '__proto__'), 'the name the file stated is still a field of the copy');
  assert.equal((after.value as { version?: unknown }).version, undefined, 'and it did not become the prototype');
  assert.equal(after.value.media, 'user/upload/1.png');

  let deep: Record<string, unknown> = { media: 'a' };
  for (let n = 0; n < 70; n += 1) deep = { child: deep };
  const nested = rebaseAssetRefs(deep, new Map([['a', 'user/upload/1.png']]));
  assert.ok(nested.truncated > 0, 'the subtree the walk did not enter is counted rather than passed over');
  assert.equal(nested.rebased, 0);
});
