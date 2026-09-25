// SPDX-License-Identifier: MPL-2.0
/**
 * Design handoff from a compiled deck (plan 274 sections 2.1 step 5, 3.4 and 3.5).
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/lib/rebrand/design-handoff.test.ts
 *
 * The deck is `tests/fixtures/rebrand/samples/compiled.json`, read as the contract
 * type, so what these tests pin is the mapping against a record the rest of the
 * journey already agrees on rather than one written to suit the mapping. A second,
 * hand-built deck covers the shape the engine's own compile produces, where the
 * frame's row travels inside `layers` and carries the slide transition.
 *
 * The store is the contract (`RenovationProjectStoreV1`) with the revision rule in
 * it, so the recorded session id is the store's answer and not a stub's convenience.
 *
 * The last two tests drive the real `importAsArtboards` over a stub canvas context,
 * because `keepIds` is only worth anything if the rows that come back carry the ids
 * the lineage names. The stub is the sibling `free-canvas/slide-masters.test.ts`
 * fixture pattern, cast once at the seam for the same reason.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type {
  CompiledDeckV1,
  ProjectPartKindV1,
  ProjectStageV1,
  ProjectWriteResultV1,
  RenovationProjectStoreV1,
  RenovationProjectV1,
} from '@lolly-tools/core/rebrand-v1';
import {
  REBRAND_HANDOFF_MARKER,
  compiledDeckToFrames,
  getRebrandHandoff,
  openCompiledDeckInDesign,
  restoreRebrandHandoff,
  type DesignHandoffFrameV1,
} from './design-handoff.ts';
import { importAsArtboards } from '../../views/free-canvas/menus.ts';
import type { FcCtx } from '../../views/free-canvas/context.ts';
import type { Box } from '../../views/free-canvas-math.ts';

const REPO = new URL('../../../../../', import.meta.url);

function sampleDeck(): CompiledDeckV1 {
  const json = readFileSync(new URL('tests/fixtures/rebrand/samples/compiled.json', REPO), 'utf8');
  return JSON.parse(json) as CompiledDeckV1;
}

/** A two-frame deck in the shape `engine/src/deck-compile.ts` produces: the frame's own row inside `layers`. */
function handBuiltDeck(): CompiledDeckV1 {
  return {
    version: 1,
    source: { lineageId: 'lin-1', hash: 'sha256:abcd', instanceId: 'inst-1' },
    planRevision: 2,
    designSystem: { id: 'lolly-start', tokenHash: 'sha256:0000', fontHashes: {}, assetHashes: {} },
    algorithms: { reader: '1', census: 'none', plan: 'none', compile: '1' },
    frames: [
      {
        id: 'f1',
        sourceSlideId: 'slide1',
        name: 'Opening',
        width: 1280,
        height: 720,
        archetype: 'title',
        masterId: 'master/neutral',
        layers: [
          { id: 'f1', kind: 'frame', x: 0, y: 0, w: 1280, h: 720, name: 'Opening', order: 0, bg: '#101010', notes: 'Say hello', slideTransition: 'fade' },
          { id: 'f1.title', frame: 'f1', kind: 'text', x: 96, y: 120, w: 1088, h: 148, text: 'Opening', role: 'title', master: 'master/neutral' },
          { id: 'f1.bar', frame: 'f1', kind: 'box', x: 0, y: 0, w: 1280, h: 12, bg: '#11201C', furniture: 'colour-bar', master: 'master/neutral' },
        ],
        furnitureLayerIds: ['f1.bar'],
        placeholderLayerIds: [],
      },
      {
        id: 'f2',
        sourceSlideId: 'slide2',
        name: 'Numbers',
        width: 1280,
        height: 720,
        archetype: 'content',
        layers: [
          // The compile writes a whole deck as one strip, so the second frame and its
          // child both carry strip positions: 1360 is the frame, 1360 + 160 the child.
          { id: 'f2', kind: 'frame', x: 1360, y: 0, w: 1280, h: 720, name: 'Numbers', order: 1 },
          { id: 'f2.hole', frame: 'f2', kind: 'box', x: 1520, y: 180, w: 960, h: 420, text: 'Chart could not be read', name: 'ppt/slides/slide2.xml.3' },
        ],
        furnitureLayerIds: [],
        placeholderLayerIds: ['f2.hole'],
      },
    ],
    tray: [],
    lineage: {
      forward: [{ sourceObjectId: 'slide2.3', layerIds: ['f2.hole'] }],
      backward: [
        { layerId: 'f1.title', sourceObjectIds: ['slide1.4'] },
        { layerId: 'f2.hole', sourceObjectIds: ['slide2.3'], derived: 'placeholder' },
      ],
    },
    report: {
      version: 1,
      sourceHash: 'sha256:abcd',
      planRevision: 2,
      counts: {
        slides: { source: 2, included: 2, excluded: 0, continuation: 0 },
        objects: { retained: 1, transformed: 0, removed: 0, unresolved: 1 },
        byClass: {},
        logosReplaced: 0,
        coloursAssigned: 0,
        coloursUnresolved: 0,
        fontsSubstituted: 0,
        appliedUnreviewed: 0,
      },
      entries: [
        {
          code: 'object.unresolved',
          message: 'The native chart carried no fallback image.',
          layerId: 'f2.hole',
          objectId: 'slide2.3',
          disposition: 'unresolved',
          class: 'chart',
        },
      ],
    },
  };
}

// ─── the mapping ─────────────────────────────────────────────────────────────

test('every frame becomes a page with its id, its layers and their fields intact', () => {
  const frames = compiledDeckToFrames(sampleDeck());
  // The sample's one tray object goes on a last page of its own (see the Not placed test).
  assert.deepEqual(frames.map((f) => f.id), ['frame-1', 'frame-2', 'frame-3', 'rebrand.not-placed']);
  assert.deepEqual(frames.map((f) => f.name), ['Quarterly review', 'Renewals', 'Renewals, continued', 'Not placed']);
  assert.deepEqual(frames.map((f) => [f.width, f.height]), [[1280, 720], [1280, 720], [1280, 720], [1280, 720]]);

  const first = frames[0]!;
  assert.deepEqual(first.boxes.map((b) => b.id), ['frame-1/band', 'frame-1/title']);
  const title = first.boxes[1]!;
  // A field the engine wrote reaches the page exactly as authored.
  assert.equal(title.master, 'master/neutral');
  assert.equal(title.role, 'title');
  assert.equal(title.text, 'Quarterly review');
  assert.equal(title.frame, 'frame-1');
  // The archetype and the master the frame states ride on the frame row.
  assert.deepEqual(first.extra, {
    archetype: 'title',
    master: 'master/neutral',
    sourceSlideId: 'ppt/slides/slide1.xml',
  });
  // The continuation the compile added says so on its own frame row.
  assert.equal(frames[2]!.extra?.continuation, true);
  assert.equal(frames[2]!.extra?.sourceSlideId, 'ppt/slides/slide2.xml');
  assert.equal(frames[1]!.notes, 'The chart could not be read from the source file.');
});

test('furniture lands locked, a placeholder lands locked and named for what it stands in for', () => {
  const frames = compiledDeckToFrames(sampleDeck());
  const band = frames[0]!.boxes.find((b) => b.id === 'frame-1/band')!;
  assert.equal(band.locked, true);
  assert.equal(band.furniture, 'colour-bar');
  // Named for what the master drew, in words, never by the master's key for it.
  assert.equal(band.name, 'Master: accent bar');

  const hole = frames[1]!.boxes.find((b) => b.id === 'frame-2/placeholder-1')!;
  assert.equal(hole.locked, true);
  assert.equal(hole.name, 'Stand-in: chart');
  // The compile's own label is left where it was.
  assert.equal(hole.text, 'Chart could not be read from this file');

  const kept = frames[2]!.boxes[0]!;
  assert.equal(kept.locked, undefined);
});

test('master furniture is named in words, and a continuation frame takes its slide name', async () => {
  const { furnitureName } = await import('./design-handoff.ts');
  assert.equal(furnitureName('page-number', 'text'), 'Master: page number');
  assert.equal(furnitureName('sldNum', 'text'), 'Master: text');
  assert.equal(furnitureName('logo', 'image'), 'Master: mark', 'the noun the queue uses for a logo');
  assert.equal(furnitureName('footer', 'text'), 'Master: footer');
  assert.equal(furnitureName('bar-green', 'shape'), 'Master: accent bar');
  assert.equal(furnitureName('panel', 'shape'), 'Master: shape');

  const deck = sampleDeck();
  const first = deck.frames[0]!;
  const more = { ...structuredClone(first), id: `${first.id}.more`, name: 'Engine words (continued)', continuation: true, layers: [] };
  deck.frames.splice(1, 0, more);
  const frames = compiledDeckToFrames(deck);
  assert.equal(frames[1]!.name, `${frames[0]!.name}, continued`);
});

test('a frame row inside the layers becomes the page, not a box on it', () => {
  const frames = compiledDeckToFrames(handBuiltDeck());
  const first = frames[0]!;
  assert.deepEqual(first.boxes.map((b) => b.id), ['f1.title', 'f1.bar']);
  assert.equal(first.background, '#101010');
  assert.equal(first.notes, 'Say hello');
  // The transition the row carried travels as an extra frame field, with the archetype.
  assert.deepEqual(first.extra, {
    slideTransition: 'fade',
    archetype: 'title',
    master: 'master/neutral',
    sourceSlideId: 'slide1',
  });
  assert.equal(frames[1]!.extra?.archetype, 'content');
  assert.equal(frames[1]!.boxes[0]!.name, 'Stand-in: chart');
});

test('a layer written on the compile strip comes back inside its own frame', () => {
  const frames = compiledDeckToFrames(handBuiltDeck());
  // The second frame was written at x 1360 with its child at 1520. The import packs
  // the pages itself and adds its own origin, so what travels is the 160 inside.
  assert.equal(frames[1]!.boxes[0]!.x, 160);
  assert.equal(frames[1]!.boxes[0]!.y, 180);
  // The first frame sits at the origin, so its rows are untouched.
  assert.equal(frames[0]!.boxes[0]!.x, 96);
  // A deck with no frame row of its own wrote its children inside the frame already.
  assert.equal(compiledDeckToFrames(sampleDeck())[1]!.boxes[0]!.x, 160);
});

test('a stand-in is named for its class, never for the source part it was read from', () => {
  const frames = compiledDeckToFrames(handBuiltDeck());
  const hole = frames[1]!.boxes[0]!;
  // The compile names every row after the source part; the class is what the person reads.
  assert.equal(hole.name, 'Stand-in: chart');

  // With no class on record, the word alone, and still no file path on the canvas.
  const deck = handBuiltDeck();
  deck.report.entries = [];
  assert.equal(compiledDeckToFrames(deck)[1]!.boxes[0]!.name, 'Stand-in');
});

test('the deck is read, never rewritten', () => {
  const deck = handBuiltDeck();
  const before = JSON.stringify(deck);
  compiledDeckToFrames(deck);
  assert.equal(JSON.stringify(deck), before);
});

// ─── the store, with the revision rule in it ─────────────────────────────────

class MemoryStore implements RenovationProjectStoreV1 {
  readonly projects = new Map<string, RenovationProjectV1>();
  readonly writes: string[] = [];

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
    const project: RenovationProjectV1 = {
      ...input,
      version: 1,
      revision: 1,
      checkpoint: { stage: 'compile' },
      parts: {},
      designSessionIds: [],
    };
    this.projects.set(project.id, project);
    return structuredClone(project);
  }

  async update(
    id: string,
    expectedRevision: number,
    patch: Partial<Omit<RenovationProjectV1, 'id' | 'version' | 'revision'>>,
  ): Promise<ProjectWriteResultV1> {
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
    const next = { ...stored, ...patch, revision: stored.revision + 1 };
    this.projects.set(id, next);
    this.writes.push(`update:${id}`);
    return { ok: true, revision: next.revision };
  }

  async putPart(): Promise<ProjectWriteResultV1> {
    return { ok: false, refusal: 'invalid-part', message: 'Not part of this test.' };
  }

  async getPart<T = unknown>(): Promise<T | null> {
    return null;
  }

  async checkpoint(
    id: string,
    expectedRevision: number,
    stage: ProjectStageV1,
  ): Promise<ProjectWriteResultV1> {
    return await this.update(id, expectedRevision, { checkpoint: { stage } });
  }

  async remove(id: string): Promise<{ removedAssetRefs: string[]; keptAssetRefs: string[] }> {
    this.projects.delete(id);
    return { removedAssetRefs: [], keptAssetRefs: [] };
  }
}

async function newProject(store: MemoryStore): Promise<RenovationProjectV1> {
  return await store.create({
    id: 'proj-1',
    name: 'Quarterly review',
    source: { kind: 'pptx', hash: 'sha256:abcd', lineageId: 'lin-1', instanceId: 'inst-1', pageCount: 2 },
    designSystem: { id: 'lolly-start', tokenHash: 'sha256:0000', fontHashes: {}, assetHashes: {} },
  });
}

function partKinds(): ProjectPartKindV1[] {
  return ['sourceDeck', 'census', 'plan', 'compiled'];
}

// ─── opening the document ────────────────────────────────────────────────────

test('the importer gets the pages in order and the project records the session', async () => {
  const store = new MemoryStore();
  const project = await newProject(store);
  const deck = sampleDeck();
  const seen: DesignHandoffFrameV1[][] = [];
  const owner = {};

  const result = await openCompiledDeckInDesign({
    deck,
    project,
    store,
    navigate: () => ({ id: 'design:9', owner }),
    importer: (frames, opts) => {
      assert.equal(opts.keepIds, true);
      seen.push(frames);
      return { landed: frames.length, keptIds: true };
    },
  });

  assert.deepEqual(seen[0]?.map((f) => f.id), ['frame-1', 'frame-2', 'frame-3', 'rebrand.not-placed']);
  assert.equal(result.sessionId, 'design:9');
  assert.equal(result.landed, 4);
  assert.equal(result.recorded, true);
  assert.equal(result.revision, 2);
  // The one warning is the tray: kept objects that fit no slide, and where they went.
  assert.deepEqual(result.warnings, ['1 object is on the Not placed artboard, which exports with the deck until you delete it.']);
  assert.equal(result.idsKept, true);
  assert.deepEqual((await store.get('proj-1'))?.designSessionIds, ['design:9']);

  // The report and the lineage are held against the document, under one marker.
  const marker = getRebrandHandoff(owner);
  assert.equal(marker?.projectId, 'proj-1');
  assert.equal(marker?.planRevision, deck.planRevision);
  assert.deepEqual(marker?.lineage, deck.lineage);
  assert.equal(marker?.report.counts.objects.unresolved, 1);
  assert.equal(REBRAND_HANDOFF_MARKER, '__rebrandHandoff');
  // Every part kind the contract knows is still spelled the way the store expects.
  assert.ok(partKinds().includes('compiled'));
});

test('a session already listed is not listed twice', async () => {
  const store = new MemoryStore();
  await newProject(store);
  await store.update('proj-1', 1, { designSessionIds: ['design:9'] });
  const held = (await store.get('proj-1'))!;

  const result = await openCompiledDeckInDesign({
    deck: sampleDeck(),
    project: held,
    store,
    navigate: () => ({ id: 'design:9' }),
    importer: (frames) => ({ landed: frames.length, keptIds: true }),
  });

  assert.equal(result.recorded, true);
  assert.equal(result.revision, held.revision);
  assert.deepEqual(store.writes, ['update:proj-1']);
  assert.deepEqual((await store.get('proj-1'))?.designSessionIds, ['design:9']);
});

test('a stale project handle is reported as refused, never as recorded', async () => {
  const store = new MemoryStore();
  const project = await newProject(store);
  // Another view moved the project on after this one read it.
  await store.update('proj-1', 1, { name: 'Renamed in the other tab' });

  const result = await openCompiledDeckInDesign({
    deck: sampleDeck(),
    project,
    store,
    navigate: () => ({ id: 'design:9' }),
    importer: (frames) => ({ landed: frames.length, keptIds: true }),
  });

  assert.equal(result.recorded, false);
  assert.equal(result.refusal, 'stale-revision');
  assert.equal(result.landed, 4);
  assert.deepEqual((await store.get('proj-1'))?.designSessionIds, []);
});

test('a marker written by another build is dropped rather than half-read', () => {
  const owner = {};
  restoreRebrandHandoff(owner, { projectId: 'proj-1', planRevision: 1, source: { lineageId: 'l', hash: 'h' } });
  assert.equal(getRebrandHandoff(owner), undefined);

  const deck = sampleDeck();
  const whole = {
    projectId: 'proj-1',
    planRevision: 3,
    source: deck.source,
    idsKept: true,
    lineage: deck.lineage,
    report: deck.report,
  };
  restoreRebrandHandoff(owner, whole);
  assert.equal(getRebrandHandoff(owner)?.planRevision, 3);

  // A source that lost the field separating two imports of the same bytes.
  const noInstance = {};
  restoreRebrandHandoff(noInstance, {
    ...whole,
    source: { lineageId: deck.source.lineageId, hash: deck.source.hash },
  });
  assert.equal(getRebrandHandoff(noInstance), undefined);

  // A report written against another version of the contract.
  const otherVersion = {};
  restoreRebrandHandoff(otherVersion, { ...whole, report: { ...deck.report, version: 2 } });
  assert.equal(getRebrandHandoff(otherVersion), undefined);

  // Ids minted: no lineage at all, and a lineage alongside that is a record this
  // build did not write.
  const minted = {};
  restoreRebrandHandoff(minted, { ...whole, idsKept: false, lineage: undefined });
  assert.equal(getRebrandHandoff(minted)?.idsKept, false);
  const halfMinted = {};
  restoreRebrandHandoff(halfMinted, { ...whole, idsKept: false });
  assert.equal(getRebrandHandoff(halfMinted), undefined);
});

test('a compiled deck with no page to lay down is refused with nothing opened', async () => {
  const store = new MemoryStore();
  const project = await newProject(store);
  const deck = sampleDeck();
  deck.frames = [];
  let opened = 0;

  await assert.rejects(
    openCompiledDeckInDesign({
      deck,
      project,
      store,
      navigate: () => {
        opened += 1;
        return { id: 'design:9' };
      },
      importer: (frames) => ({ landed: frames.length, keptIds: true }),
    }),
    /no slides/,
  );
  assert.equal(opened, 0);
  assert.deepEqual((await store.get('proj-1'))?.designSessionIds, []);
});

test('an import that throws closes the document it opened', async () => {
  const store = new MemoryStore();
  const project = await newProject(store);
  let closed = 0;

  await assert.rejects(
    openCompiledDeckInDesign({
      deck: sampleDeck(),
      project,
      store,
      navigate: () => ({ id: 'design:9', close: () => { closed += 1; } }),
      importer: () => {
        throw new Error('This tool has no artboards.');
      },
    }),
    /no artboards/,
  );
  assert.equal(closed, 1);
  assert.deepEqual((await store.get('proj-1'))?.designSessionIds, []);
});

test('kept objects that fit no slide are said out loud, not dropped in silence', async () => {
  const store = new MemoryStore();
  const project = await newProject(store);
  const deck = sampleDeck();
  assert.equal(deck.tray.length, 1);

  const result = await openCompiledDeckInDesign({
    deck,
    project,
    store,
    navigate: () => ({ id: 'design:9' }),
    importer: (frames) => ({ landed: frames.length, keptIds: true }),
  });

  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0]!, /1 object is on the Not placed artboard/);
  assert.match(result.warnings[0]!, /exports with the deck until you delete it/, 'and it says the artboard is a page of the deck');
});

test('minted ids retire the lineage the marker carries', async () => {
  const store = new MemoryStore();
  const project = await newProject(store);
  const owner = {};

  const result = await openCompiledDeckInDesign({
    deck: sampleDeck(),
    project,
    store,
    navigate: () => ({ id: 'design:9', owner }),
    importer: (frames, opts) => {
      opts.onWarning('Some layers in this document share an id, so every layer was given a fresh one.');
      return { landed: frames.length, keptIds: false };
    },
  });

  assert.equal(result.idsKept, false);
  assert.equal(result.marker.lineage, undefined);
  assert.equal(result.marker.idsKept, false);
  // The report still travels: it accounts for the source, not for the rows.
  assert.equal(result.marker.report.counts.objects.unresolved, 1);
  assert.equal(getRebrandHandoff(owner)?.lineage, undefined);
});

test('a refused write leaves no marker claiming the project', async () => {
  const store = new MemoryStore();
  const project = await newProject(store);
  await store.update('proj-1', 1, { name: 'Renamed in the other tab' });
  const owner = {};

  const result = await openCompiledDeckInDesign({
    deck: sampleDeck(),
    project,
    store,
    navigate: () => ({ id: 'design:9', owner }),
    importer: (frames) => ({ landed: frames.length, keptIds: true }),
  });

  assert.equal(result.recorded, false);
  assert.equal(getRebrandHandoff(owner), undefined);
});

// ─── the import itself ───────────────────────────────────────────────────────

interface Canvas {
  fc: FcCtx;
  rows(): Box[];
  minted: number;
}

function canvas(): Canvas {
  let rows: Box[] = [];
  const state = { minted: 0 };
  // One cast, at the seam: `FcCtx` is the whole free-canvas closure and this stub is
  // the handful of it `importAsArtboards` reads. Same pattern as slide-masters.test.ts.
  const fc = {
    disposed: false,
    cfg: {
      idField: 'id',
      kindField: 'kind',
      xField: 'x',
      yField: 'y',
      wField: 'w',
      hField: 'h',
      rotationField: 'rot',
      fillField: 'bg',
      groupField: 'group',
      clipField: 'clip',
    },
    // The real geometry config has no name field: Design names rows through
    // `canvas.labelField`, which the closure keeps as `nameField`.
    nameField: 'name',
    frameCfg: { frameField: 'frame', frameKind: 'frame', orderField: 'order' },
    FRAME_NOTES_FIELD: 'notes',
    addKinds: [{ id: 'frame', seed: { kind: 'frame', bg: '', shape: 'rect' } }],
    host: {},
    importMap: {},
    pendingImport: null,
    selection: new Set<string>(),
    setCanvasSize: () => {},
    select: {
      freshId: () => `mint-${++state.minted}`,
      commit: (next: Box[]) => {
        rows = next;
      },
    },
  } as unknown as FcCtx;
  return {
    fc,
    rows: () => rows,
    get minted() {
      return state.minted;
    },
  };
}

test('tray objects land on a last artboard named Not placed, never dropped', async () => {
  const deck = handBuiltDeck();
  deck.tray = [
    { sourceObjectId: 'slide1.9', layer: { id: 'r.tray.a', kind: 'text', x: 900, y: 600, w: 400, h: 60, text: 'Source: annual report', fontSize: 14 } },
    { sourceObjectId: 'slide2.8', layer: { id: 'r.tray.b', kind: 'image', x: 0, y: 0, w: 2000, h: 500, image: 'user/media/wide' } },
    { sourceObjectId: 'slide2.9', layer: { id: 'f2', kind: 'box', w: 100, h: 100 } },
  ];
  // A tray row can never be told apart from a slide by its id: here one reuses a frame id.
  deck.tray[2]!.layer.id = 'r.tray.c';
  const pages = compiledDeckToFrames(deck);
  assert.equal(pages.length, 3, 'two slides and the Not placed page');
  const tray = pages[2]!;
  assert.equal(tray.name, 'Not placed');
  assert.equal(tray.id, 'rebrand.not-placed');
  assert.equal(tray.width, 1280, 'as wide as the slides');
  assert.deepEqual(tray.boxes.map((b) => b.id), ['r.tray.a', 'r.tray.b', 'r.tray.c'], 'every object, ids kept, in reading order');
  for (const box of tray.boxes) {
    assert.ok(Number(box.x) >= 0 && Number(box.x) + Number(box.w) <= tray.width, `${box.id} inside the page across`);
    assert.ok(Number(box.y) >= 0 && Number(box.y) + Number(box.h) <= tray.height, `${box.id} inside the page down`);
  }
  // No two objects overlap.
  for (const [i, a] of tray.boxes.entries()) {
    for (const b of tray.boxes.slice(i + 1)) {
      const apart = Number(a.x) + Number(a.w) <= Number(b.x) || Number(b.x) + Number(b.w) <= Number(a.x)
        || Number(a.y) + Number(a.h) <= Number(b.y) || Number(b.y) + Number(b.h) <= Number(a.y);
      assert.ok(apart, `${a.id} and ${b.id} do not overlap`);
    }
  }
  // The wide picture shrank to the page, keeping its shape; the text kept its size.
  const wide = tray.boxes[1]!;
  assert.ok(Number(wide.w) < 2000 && Math.abs(Number(wide.w) / Number(wide.h) - 4) < 0.01);
  assert.equal(tray.boxes[0]!.fontSize, 14);

  // Through the real import, the tray becomes its own artboard with its ids.
  const c = canvas();
  const n = await importAsArtboards(c.fc, null, () => {}, { frames: pages, keepIds: true, onWarning: () => {} });
  assert.equal(n, 3);
  const rows = c.rows();
  const board = rows.find((r) => r.id === 'rebrand.not-placed');
  assert.equal(board?.kind, 'frame');
  assert.equal(board?.name, 'Not placed');
  for (const id of ['r.tray.a', 'r.tray.b', 'r.tray.c']) {
    assert.equal(rows.find((r) => r.id === id)?.frame, 'rebrand.not-placed', `${id} sits on the Not placed artboard`);
  }
});

test('keepIds lands the compiled ids, the frame links and the authored fields', async () => {
  const c = canvas();
  const frames = compiledDeckToFrames(handBuiltDeck());
  const warnings: string[] = [];

  const n = await importAsArtboards(c.fc, null, () => {}, {
    frames,
    keepIds: true,
    onWarning: (m) => warnings.push(m),
  });

  assert.equal(n, 2);
  assert.equal(c.minted, 0);
  assert.deepEqual(warnings, []);
  assert.deepEqual(c.rows().map((r) => r.id), ['f1', 'f1.title', 'f1.bar', 'f2', 'f2.hole']);
  const frame = c.rows()[0]!;
  assert.equal(frame.kind, 'frame');
  assert.equal(frame.name, 'Opening');
  assert.equal(frame.notes, 'Say hello');
  assert.equal(frame.order, 0);
  // The extra frame fields land, and never over a field the layout just set.
  assert.equal(frame.archetype, 'title');
  assert.equal(frame.master, 'master/neutral');
  assert.equal(frame.slideTransition, 'fade');
  assert.equal(frame.w, 1280);

  const title = c.rows()[1]!;
  assert.equal(title.frame, 'f1');
  assert.equal(title.role, 'title');
  assert.equal(title.master, 'master/neutral');
  const placeholder = c.rows()[4]!;
  assert.equal(placeholder.frame, 'f2');
  assert.equal(placeholder.locked, true);
  assert.equal(placeholder.name, 'Stand-in: chart');
  // The second page sits to the right of the first, so the ids travel and the layout does not.
  assert.ok(Number(c.rows()[3]!.x) > 1280);
});

test('a repeated id falls back to minting for the whole import, and says so', async () => {
  const c = canvas();
  const frames = compiledDeckToFrames(handBuiltDeck());
  frames[1]!.boxes[0]!.id = 'f1.title';
  const warnings: string[] = [];

  const n = await importAsArtboards(c.fc, null, () => {}, {
    frames,
    keepIds: true,
    onWarning: (m) => warnings.push(m),
  });

  assert.equal(n, 2);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0]!, /share an id/);
  assert.deepEqual(c.rows().map((r) => r.id), ['mint-1', 'mint-2', 'mint-3', 'mint-4', 'mint-5']);
  // The rows themselves are unharmed: the frame link follows the minted ids.
  assert.equal(c.rows()[1]!.frame, 'mint-1');
  assert.equal(c.rows()[4]!.frame, 'mint-4');
});

test('without keepIds the import mints every id, exactly as it always has', async () => {
  const c = canvas();
  const frames = compiledDeckToFrames(handBuiltDeck());

  const n = await importAsArtboards(c.fc, null, () => {}, { frames });

  assert.equal(n, 2);
  assert.deepEqual(c.rows().map((r) => r.id), ['mint-1', 'mint-2', 'mint-3', 'mint-4', 'mint-5']);
  assert.equal(c.rows()[0]!.name, 'Opening');
  assert.equal(c.rows()[0]!.notes, 'Say hello');
  assert.equal(c.rows()[0]!.frame, '');
  assert.equal(c.rows()[1]!.frame, 'mint-1');
  assert.equal(c.rows()[3]!.order, 1);
});

test('the laid rows sit inside the artboard the compile wrote them against', async () => {
  const c = canvas();
  const frames = compiledDeckToFrames(handBuiltDeck());

  await importAsArtboards(c.fc, null, () => {}, { frames, keepIds: true });

  const second = c.rows()[3]!;
  const hole = c.rows()[4]!;
  assert.equal(hole.frame, 'f2');
  // Inside its own frame, at the offset the compile authored, not past its right edge.
  assert.equal(Number(hole.x) - Number(second.x), 160);
  assert.ok(Number(hole.x) + Number(hole.w) <= Number(second.x) + Number(second.w));
});

test('extra frame fields never move a field the layout has just set', async () => {
  const c = canvas();
  const frames = compiledDeckToFrames(handBuiltDeck());
  frames[0]!.extra = { ...frames[0]!.extra, name: 'Not the page name', bg: '#ff0000', notes: 'Not the notes', rot: 45 };

  await importAsArtboards(c.fc, null, () => {}, { frames, keepIds: true });

  const frame = c.rows()[0]!;
  assert.equal(frame.name, 'Opening');
  assert.equal(frame.bg, '#101010');
  assert.equal(frame.notes, 'Say hello');
  assert.equal(frame.rot, 0);
  assert.equal(frame.archetype, 'title');
});

test('a missing id says so, and says the ids were not kept', async () => {
  const c = canvas();
  const frames = compiledDeckToFrames(handBuiltDeck());
  frames[1]!.boxes[0]!.id = '';
  const warnings: string[] = [];
  const kept: boolean[] = [];

  await importAsArtboards(c.fc, null, () => {}, {
    frames,
    keepIds: true,
    onWarning: (m) => warnings.push(m),
    onIdsKept: (k) => kept.push(k),
  });

  assert.deepEqual(kept, [false]);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0]!, /have no id/);
  assert.deepEqual(c.rows().map((r) => r.id), ['mint-1', 'mint-2', 'mint-3', 'mint-4', 'mint-5']);
});

test('a page with no size is left out of the count and said out loud', async () => {
  const c = canvas();
  const frames = compiledDeckToFrames(handBuiltDeck());
  frames[1]!.height = 0;
  const warnings: string[] = [];

  const n = await importAsArtboards(c.fc, null, () => {}, {
    frames,
    keepIds: true,
    onWarning: (m) => warnings.push(m),
  });

  assert.equal(n, 1);
  assert.deepEqual(c.rows().map((r) => r.id), ['f1', 'f1.title', 'f1.bar']);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0]!, /no size/);
});

test('a slot or furniture line the compile left empty is not laid, and the lineage stops naming it', async () => {
  const deck = handBuiltDeck();
  const first = deck.frames[0]!;
  first.layers.push(
    { id: 'f1.footer', frame: 'f1', kind: 'text', x: 96, y: 660, w: 800, h: 24, text: '', furniture: 'footer', master: 'master/neutral' },
    { id: 'f1.subtitle', frame: 'f1', kind: 'text', x: 96, y: 300, w: 800, h: 60, text: '  ', role: 'subtitle', master: 'master/neutral' },
    { id: 'f1.note', frame: 'f1', kind: 'text', x: 96, y: 400, w: 800, h: 60, text: '' },
  );
  first.furnitureLayerIds.push('f1.footer');
  deck.lineage.backward.push({ layerId: 'f1.footer', sourceObjectIds: [], derived: 'furniture' });
  const pages = compiledDeckToFrames(deck);
  const ids = pages[0]!.boxes.map((box) => box.id);
  assert.ok(!ids.includes('f1.footer'), 'an empty footer is not laid');
  assert.ok(!ids.includes('f1.subtitle'), 'a blank subtitle slot is not laid');
  assert.ok(ids.includes('f1.note'), 'an empty text the source itself had still travels');
  assert.ok(ids.includes('f1.title'));

  const owner = {};
  const store = new MemoryStore();
  const project = await newProject(store);
  await openCompiledDeckInDesign({
    deck,
    project,
    store,
    navigate: () => ({ id: 'design:e', owner }),
    importer: (frames) => ({ landed: frames.length, keptIds: true }),
  });
  const backward = getRebrandHandoff(owner)?.lineage?.backward.map((edge) => edge.layerId) ?? [];
  assert.ok(!backward.includes('f1.footer'));
  assert.ok(backward.includes('f1.title'));
});

// ─── names in words, a second opening, the Not placed mark ───────────────────

test('no layer on the canvas is named by a source part path, a master id or the master label', () => {
  const pages = compiledDeckToFrames(sampleDeck());
  const deck = sampleDeck();
  const sourceIds = new Set(deck.lineage.forward.map((edge) => edge.sourceObjectId));
  for (const page of pages) {
    for (const box of page.boxes) {
      const name = String(box.name ?? '');
      assert.ok(name.length > 0, `layer ${String(box.id)} has a name`);
      assert.doesNotMatch(name, /\.xml|\//, `layer ${String(box.id)} is not named by a part path: ${name}`);
      assert.equal(sourceIds.has(name), false, `layer ${String(box.id)} is not named by its source object id`);
    }
  }
});

test('a master slot is named for its role, a kept object for its class, and the ground in words', () => {
  const deck = handBuiltDeck();
  const first = deck.frames[0];
  assert.ok(first);
  first.layers.push(
    { id: 'f1.ground', frame: 'f1', kind: 'image', x: 0, y: 0, w: 1280, h: 720, name: 'slide1 ground', image: 'user/bg' },
    { id: 'f1.photo', frame: 'f1', kind: 'image', x: 10, y: 10, w: 100, h: 100, name: 'ppt/slides/slide1.xml.9', image: 'user/photo' },
    { id: 'f1.note', frame: 'f1', kind: 'text', x: 10, y: 200, w: 100, h: 20, name: 'Title note', role: 'title', text: 'Source: us' },
  );
  deck.lineage.backward.push({ layerId: 'f1.photo', sourceObjectIds: ['slide1.9'] });
  deck.report.entries.push({ code: 'object.retained', message: 'kept', objectId: 'slide1.9', class: 'photo' });
  const [page] = compiledDeckToFrames(deck);
  const nameOf = (id: string): unknown => page?.boxes.find((box) => box.id === id)?.name;
  assert.equal(nameOf('f1.title'), 'Title');
  assert.equal(nameOf('f1.bar'), 'Master: accent bar');
  assert.equal(nameOf('f1.ground'), 'Slide background');
  assert.equal(nameOf('f1.photo'), 'Photo', 'named through the lineage and the report');
  assert.equal(nameOf('f1.note'), 'Title note');
});

test('a frame the compile could only call "Slide 3" is named through the person\'s language', () => {
  const deck = handBuiltDeck();
  const frame = deck.frames[1];
  assert.ok(frame);
  frame.name = 'Slide 3';
  const row = frame.layers.find((layer) => layer.id === frame.id);
  if (row) row.name = 'Slide 3';
  assert.equal(compiledDeckToFrames(deck)[1]?.name, 'Slide 3');
  // The source reads the English pattern and says it through t(), never as it stands.
  const src = readFileSync(new URL('./design-handoff.ts', import.meta.url), 'utf8');
  assert.match(src, /tRaw\('Slide \{n\}'/);
});

test('the Not placed artboard is marked so an export can leave it out, and stays on the canvas', () => {
  const pages = compiledDeckToFrames(sampleDeck());
  const tray = pages.at(-1);
  assert.equal(tray?.name, 'Not placed');
  assert.equal(tray?.extra?.notPlaced, true);
  assert.equal(tray?.extra?.hidden, undefined, 'a hidden artboard would take the objects off the canvas too');
  for (const box of tray?.boxes ?? []) assert.doesNotMatch(String(box.name ?? ''), /\.xml|\//);
});

test('a second opening is a new document named with its revision', async () => {
  const store = new MemoryStore();
  const project = await newProject(store);
  const names: string[] = [];
  const open = async (current: RenovationProjectV1, id: string) => openCompiledDeckInDesign({
    deck: sampleDeck(),
    project: current,
    store,
    navigate: (opened) => {
      names.push(opened.name);
      return { id };
    },
    importer: (frames) => ({ landed: frames.length, keptIds: true }),
  });
  await open(project, 'design:1');
  const after = await store.get('proj-1');
  assert.ok(after);
  const second = await open(after, 'design:2');
  assert.equal(second.recorded, true);
  assert.deepEqual(names, ['Quarterly review', 'Quarterly review, revision 2']);
  assert.deepEqual((await store.get('proj-1'))?.designSessionIds, ['design:1', 'design:2'], 'the first document is kept beside the second');
});

test('an opening the store could not record still counts toward the next name', async () => {
  const store = new MemoryStore();
  const project = await newProject(store);
  const names: string[] = [];
  await openCompiledDeckInDesign({
    deck: sampleDeck(),
    project,
    store,
    navigate: (opened) => {
      names.push(opened.name);
      return { id: 'design:3' };
    },
    importer: (frames) => ({ landed: frames.length, keptIds: true }),
    // Two documents opened in this tab that the project record never listed.
    openedBefore: 2,
  });
  assert.deepEqual(names, ['Quarterly review, revision 3'], 'never the same name as an earlier document');
});
