// SPDX-License-Identifier: MPL-2.0
/**
 * The renovation controller against stub deps (plan 274 sections 2.1, 3.5 and 4).
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/lib/rebrand/controller.test.ts
 *
 * The store is an in-memory `WebRenovationProjectStore` written here, the same way
 * `lifecycle.test.ts` writes its own: it refuses a write whose expected revision is
 * not the stored one, so a stale refusal asserted below is the store's answer. The
 * stages answer with the contract samples in `tests/fixtures/rebrand/samples`, and the
 * last tests run the real engine stages over `simple.pptx`, so the edits, the
 * compile and the handoff are exercised against a plan the first pass wrote.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { censusDeck, compileFaithful, compileRenovated, firstPass, neutralSlideMaster, PLAN_RULES, resolveRebrandDesignSystem } from '@lolly/engine';
import type {
  CompiledDeckV1,
  DeckCensusV1,
  ProjectPartKindV1,
  ProjectStageV1,
  ProjectWriteResultV1,
  RenovationPlanV1,
  RenovationProjectV1,
  SourceDeckV1,
} from '@lolly-tools/core/rebrand-v1';
import type { JobHandle, StartJobOpts } from '../jobs.ts';
import { openPendingIds as engineOpenPendingIds } from '@lolly/engine';
import {
  ANOTHER_LOOK_ITEM_ID,
  CARRIED_ITEM_ID,
  KEEP_FAILURE_CODES,
  carryIntoNewerVersion,
  createRebrandController,
  keepLineageFacts,
  lineageQueueItems,
  nearestSystemColour,
  openPendingIds,
  overDesignHistory,
  drawnLabelCount,
  previewPlanOf,
  queueWithLineage,
  rebrandControllerFor,
  PROJECT_THUMB_EDGE,
  projectThumbnail,
  readingSentence,
  recoveryRefs,
  splicePreviewDeck,
} from './controller.ts';
import type { RebrandPresetEntryV1 } from './presets.ts';
import type {
  CompileStageInputV1,
  PlanStageInputV1,
  RebrandControllerDepsV1,
  RebrandDownloadV1,
  RebrandJobHandleV1,
  RebrandJobOptsV1,
  RebrandPackPartsV1,
  RebrandResolvedSystemV1,
  RebrandStageNameV1,
  RebrandStateV1,
} from './controller-api.ts';
import type { CreateProjectInputV1, CreateProjectOptsV1, WebRenovationProjectStore } from './project-store.ts';
import { resumePoint } from './lifecycle.ts';

// ─── an in-memory store implementing the web contract ────────────────────────

type PartValue = SourceDeckV1 | DeckCensusV1 | RenovationPlanV1 | CompiledDeckV1;

class MemoryStore implements WebRenovationProjectStore {
  readonly projects = new Map<string, RenovationProjectV1>();
  readonly parts = new Map<string, PartValue>();
  quotaFull = false;
  /** Part kinds refused for quota even when the device is not full. */
  readonly quotaParts = new Set<ProjectPartKindV1>();
  readonly writes: string[] = [];

  private key(id: string, kind: ProjectPartKindV1): string {
    return `${id}:${kind}`;
  }

  async list(): Promise<RenovationProjectV1[]> {
    return [...this.projects.values()].map((p) => structuredClone(p));
  }

  async get(id: string): Promise<RenovationProjectV1 | null> {
    const p = this.projects.get(id);
    return p ? structuredClone(p) : null;
  }

  async create(input: CreateProjectInputV1, opts: CreateProjectOptsV1 = {}): Promise<RenovationProjectV1> {
    const project: RenovationProjectV1 = {
      ...input,
      source: { ...input.source, ...(opts.bytes ? { bytesAssetRef: `user/source/${input.id}` } : {}) },
      version: 1,
      revision: 1,
      checkpoint: { stage: 'ingest' },
      parts: {},
      designSessionIds: [],
    };
    this.projects.set(project.id, project);
    this.writes.push('create');
    return structuredClone(project);
  }

  private guard(id: string, expected: number): ProjectWriteResultV1 | RenovationProjectV1 {
    const stored = this.projects.get(id);
    if (!stored) return { ok: false, refusal: 'missing-project', message: `No project ${id}.` };
    if (stored.revision !== expected) {
      return { ok: false, refusal: 'stale-revision', message: 'Another view changed this project.', currentRevision: stored.revision };
    }
    return stored;
  }

  async update(id: string, expected: number, patch: Partial<Omit<RenovationProjectV1, 'id' | 'version' | 'revision'>>): Promise<ProjectWriteResultV1> {
    const g = this.guard(id, expected);
    if ('ok' in g) return g;
    const next = { ...g, ...patch, revision: g.revision + 1 };
    this.projects.set(id, next);
    this.writes.push('update');
    return { ok: true, revision: next.revision };
  }

  async putPart(id: string, expected: number, kind: ProjectPartKindV1, value: PartValue): Promise<ProjectWriteResultV1> {
    const g = this.guard(id, expected);
    if ('ok' in g) return g;
    if (this.quotaFull || this.quotaParts.has(kind)) return { ok: false, refusal: 'quota', message: 'No room left on this device.' };
    this.parts.set(this.key(id, kind), structuredClone(value));
    this.projects.set(id, { ...g, parts: { ...g.parts, [kind]: this.key(id, kind) }, revision: g.revision + 1 });
    this.writes.push(`part:${kind}`);
    return { ok: true, revision: g.revision + 1 };
  }

  async getPart<T = unknown>(id: string, kind: ProjectPartKindV1): Promise<T | null> {
    const v = this.parts.get(this.key(id, kind));
    return v ? (structuredClone(v) as T) : null;
  }

  async checkpoint(id: string, expected: number, stage: ProjectStageV1, planRevision?: number): Promise<ProjectWriteResultV1> {
    const g = this.guard(id, expected);
    if ('ok' in g) return g;
    const next: RenovationProjectV1 = {
      ...g,
      checkpoint: { stage, at: '2026-09-24T00:00:00.000Z', ...(planRevision === undefined ? {} : { planRevision }) },
      revision: g.revision + 1,
    };
    this.projects.set(id, next);
    this.writes.push(`checkpoint:${stage}`);
    return { ok: true, revision: next.revision };
  }

  async remove(id: string): Promise<{ removedAssetRefs: string[]; keptAssetRefs: string[] }> {
    this.projects.delete(id);
    for (const k of [...this.parts.keys()]) if (k.startsWith(`${id}:`)) this.parts.delete(k);
    this.writes.push(`remove:${id}`);
    return { removedAssetRefs: [], keptAssetRefs: [] };
  }
}

// ─── the samples ─────────────────────────────────────────────────────────────

const REPO = new URL('../../../../../', import.meta.url);
const sample = <T>(name: string): T => JSON.parse(readFileSync(new URL(`tests/fixtures/rebrand/samples/${name}.json`, REPO), 'utf8')) as T;

const SOURCE = sample<SourceDeckV1>('source');
const CENSUS = sample<DeckCensusV1>('census');
const COMPILED = sample<CompiledDeckV1>('compiled');

/** The sample plan with one row still waiting for a person, so a suggestion is pending. */
function planSample(): RenovationPlanV1 {
  const plan = sample<RenovationPlanV1>('plan');
  plan.revision = 1;
  const row = plan.slides[1]?.objects.find((one) => one.id === 'ppt/slides/slide2.xml.5');
  assert.ok(row, 'the sample plan holds slide2.xml.5');
  row.review = 'unreviewed';
  delete row.decision;
  delete row.author;
  return plan;
}

/** A deck whose one picture row draws `ref`. */
function deckDrawing(ref: string, planRevision: number): CompiledDeckV1 {
  const deck = structuredClone(COMPILED);
  deck.planRevision = planRevision;
  for (const frame of deck.frames) {
    for (const row of frame.layers) if (row.kind === 'image') row.image = ref;
  }
  return deck;
}

/** The design system every test opens against unless it says otherwise. */
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

/** What a plan stage records for the design system it ran against. */
async function snapshotOf(system: PlanStageInputV1['system']): Promise<RenovationPlanV1['designSystem']> {
  return (await resolveRebrandDesignSystem(system)).snapshot;
}

// ─── stub deps ───────────────────────────────────────────────────────────────

interface StageCall {
  name: RebrandStageNameV1;
  input: unknown;
  tag: { projectId: string; planRevision?: number };
  signal: AbortSignal;
}

/** A method type, so a handler can name the input it expects (method parameters are bivariant). */
type StageHandler = { run(input: unknown, call: StageCall): unknown }['run'];

interface HarnessBase {
  store: MemoryStore;
  stages: StageCall[];
  handlers: Partial<Record<RebrandStageNameV1, StageHandler>>;
  jobs: StartJobOpts[];
  jobProgress: Array<[number, number]>;
  /** The sentence each progress report carried, when it carried one. */
  jobNotes: string[];
  /** The in-memory parts each `.lolly` download was handed, or null when it read the store. */
  packed: Array<RebrandPackPartsV1 | null>;
  released: string[];
  mediaAsked: string[];
  imported: number[];
  keepCalls: number;
}

interface Harness extends HarnessBase {
  deps: RebrandControllerDepsV1;
}

function harness(over: Partial<RebrandControllerDepsV1> = {}): Harness {
  const store = new MemoryStore();
  const h: HarnessBase = {
    store,
    stages: [],
    handlers: {
      'rebrand.census': () => structuredClone(CENSUS),
      'rebrand.plan': async (input: PlanStageInputV1) => ({
        ...planSample(),
        designSystem: await snapshotOf(input.system),
        shuffleSeed: input.seed ?? 0,
      }),
      'rebrand.faithful': () => deckDrawing('user/media/source-photo', 0),
      'rebrand.compile': (input) => deckDrawing('user/media/proposed-photo', (input as CompileStageInputV1).plan.revision),
    },
    jobs: [],
    jobProgress: [],
    jobNotes: [],
    packed: [],
    released: [],
    mediaAsked: [],
    imported: [],
    keepCalls: 0,
  };
  const handle = (): JobHandle => ({
    id: `job-${h.jobs.length}`,
    started: Promise.resolve(),
    cancelled: false,
    progress: (done, total, note) => {
      h.jobProgress.push([done, total]);
      if (note) h.jobNotes.push(note);
    },
    finish: () => {},
    fail: () => {},
    settle: () => {},
  });
  const deps: RebrandControllerDepsV1 = {
    store,
    async ingest({ file, onProgress }) {
      onProgress(1, 2);
      onProgress(2, 2);
      const project = await store.create(
        { id: 'proj-1', name: 'Quarterly review', source: { ...SOURCE.source, name: file.name }, designSystem: planSample().designSystem, updatedAt: '2026-09-24T01:00:00.000Z' },
        { bytes: file },
      );
      return { project, source: structuredClone(SOURCE) };
    },
    async runStage<I, O>(name: RebrandStageNameV1, input: I, tag: { projectId: string; planRevision?: number }, signal: AbortSignal): Promise<O> {
      const call: StageCall = { name, input, tag, signal };
      h.stages.push(call);
      const handler = h.handlers[name];
      if (!handler) throw new Error(`no stage ${name}`);
      return (await handler(input, call)) as O;
    },
    resolveDesignSystem: async () => SYSTEM,
    readiness: async () => [],
    async mediaUrl(ref) {
      h.mediaAsked.push(ref);
      return `blob:${ref}`;
    },
    releaseMediaUrl(url) {
      h.released.push(url);
    },
    sourceBytes: async (project) => (project.source.bytesAssetRef ? new Uint8Array([1, 2, 3]) : null),
    packProject: async (project: RenovationProjectV1, parts?: RebrandPackPartsV1) => {
      h.packed.push(parts ?? null);
      return { blob: new Blob(['lolly']), filename: `${project.name}.lolly` };
    },
    design: {
      navigate: () => ({ id: 'session/design/1' }),
      importer: (frames) => {
        h.imported.push(frames.length);
        return { landed: frames.length, keptIds: true };
      },
    },
    async keepDesign() {
      h.keepCalls += 1;
      return {
        bytes: new Uint8Array([80, 75, 3, 4]),
        preview: deckDrawing('user/media/source-photo', 0),
        changes: { themeSlots: 6, colours: 3, fonts: [{ from: 'Calibri', to: 'Outfit' }] },
      };
    },
    async runJob<T>(opts: StartJobOpts, work: (handle: JobHandle) => Promise<T> | T): Promise<T | undefined> {
      h.jobs.push(opts);
      return await work(handle());
    },
    previewDelayMs: 0,
    ...over,
  };
  return Object.assign(h, { deps });
}

const file = (name = 'quarterly-review.pptx'): File => new File([new Uint8Array([80, 75, 3, 4])], name);

/** Wait for a condition the controller reaches on a timer or a settled promise. */
async function until(check: () => boolean, what: string): Promise<void> {
  for (let i = 0; i < 400; i += 1) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  assert.fail(`timed out waiting for ${what}`);
}

/** Wait until the Proposed pane holds the preview for the plan in hand: Open in Design waits for it. */
async function previewSettled(c: ReturnType<typeof createRebrandController>): Promise<void> {
  await until(() => {
    const state = c.getState();
    return !state.previewStale && state.preview !== null && state.preview.planRevision === state.plan?.revision;
  }, 'the preview for the current plan');
}

/** A controller with a plan open for review. */
async function reviewing(h: Harness = harness()): Promise<{ h: Harness; c: ReturnType<typeof createRebrandController> }> {
  const c = createRebrandController(h.deps);
  await c.start(file());
  assert.equal(c.getState().phase, 'review', `setup: ${JSON.stringify(c.getState().error)}`);
  return { h, c };
}

function row(state: RebrandStateV1, id: string) {
  return state.plan?.slides.flatMap((slide) => slide.objects).find((one) => one.id === id);
}

// ─── start ───────────────────────────────────────────────────────────────────

test('start reads with counts, runs the stages in order and ends on review', async () => {
  const h = harness();
  const c = createRebrandController(h.deps);
  const seen: RebrandStateV1[] = [];
  c.subscribe((state) => seen.push(state));
  await c.start(file());

  const state = c.getState();
  assert.equal(state.phase, 'review');
  assert.equal(state.error, null);
  assert.equal(state.progress, null);
  assert.equal(h.jobs.length, 1, 'one job for read, census and plan');
  assert.equal(h.jobs[0]?.title, 'Planning a renovation of quarterly-review.pptx');
  assert.deepEqual(h.stages.map((call) => call.name), ['rebrand.census', 'rebrand.plan', 'rebrand.faithful', 'rebrand.compile']);
  const preview = h.stages[3]?.input as CompileStageInputV1;
  assert.equal(preview.applyUnreviewed, true, 'the preview shows unreviewed proposals applied');
  assert.equal(preview.applyNeedsAttention, true, 'and the flagged ones, so the pane shows what Accept all gives');
  assert.equal(h.stages[3]?.tag.planRevision, state.plan?.revision);

  // Reading reports counts, never a share.
  const reading = seen.filter((one) => one.phase === 'reading' && one.progress?.done !== undefined);
  assert.deepEqual(reading.map((one) => [one.progress?.done, one.progress?.total]), [[1, 2], [2, 2]]);
  assert.ok(seen.some((one) => one.phase === 'analysing' && one.progress?.step === 'census'));
  assert.ok(seen.some((one) => one.phase === 'analysing' && one.progress?.step === 'plan'));

  // Every notification is one state, one tick on.
  for (let i = 1; i < seen.length; i += 1) assert.equal(seen[i]?.tick, (seen[i - 1]?.tick ?? 0) + 1);

  // Each part is written and checkpointed, so a reload resumes after the plan.
  assert.ok(h.store.writes.includes('part:sourceDeck'));
  assert.ok(h.store.writes.includes('part:census'));
  assert.ok(h.store.writes.includes('part:plan'));
  const stored = await h.store.get('proj-1');
  assert.equal(stored?.checkpoint.stage, 'plan');
  assert.equal(resumePoint(stored as RenovationProjectV1).resumeFrom, 'review');
  assert.equal(h.store.parts.has('proj-1:compiled'), false, 'the preview is disposable and never stored');

  assert.equal(state.designSystem?.id, 'lolly-start');
  assert.equal(state.preview?.planRevision, state.plan?.revision);
  assert.equal(state.previewStale, false);
  assert.ok(state.faithful);
  assert.deepEqual(state.save, { kind: 'saved', revision: stored?.revision });
});

test('cancelling the job reaches the stage and keeps what was written', async () => {
  const h = harness();
  let release: () => void = () => {};
  h.handlers['rebrand.census'] = (_input: never, call: StageCall) => new Promise((resolve, reject) => {
    release = () => resolve(structuredClone(CENSUS));
    call.signal.addEventListener('abort', () => {
      const err = new Error('stopped');
      err.name = 'AbortError';
      reject(err);
    });
  });
  const c = createRebrandController(h.deps);
  const started = c.start(file());
  await until(() => h.stages.length === 1, 'the census to start');
  assert.equal(c.getState().phase, 'analysing');
  h.jobs[0]?.cancel?.();
  await started;
  release();

  const state = c.getState();
  assert.equal(state.phase, 'failed');
  assert.equal(state.error?.code, 'cancelled');
  assert.equal(state.error?.step, 'census');
  assert.equal(state.project?.id, 'proj-1', 'the project stays open to resume');
  assert.ok(h.store.parts.has('proj-1:sourceDeck'), 'the read deck is kept');
  assert.equal(h.store.parts.has('proj-1:census'), false);
});

test('no design system fails with its own code and keeps the census', async () => {
  const h = harness({ resolveDesignSystem: async () => null });
  const c = createRebrandController(h.deps);
  await c.start(file());
  const state = c.getState();
  assert.equal(state.phase, 'failed');
  assert.equal(state.error?.code, 'no-design-system');
  assert.ok(state.census, 'the census stays in view');
  assert.ok(h.store.parts.has('proj-1:census'));
  assert.equal(h.stages.some((call) => call.name === 'rebrand.plan'), false);
});

test('a stage that throws fails with the step it was on', async () => {
  const h = harness();
  h.handlers['rebrand.plan'] = () => {
    throw new Error('The plan rules could not read this deck.');
  };
  const c = createRebrandController(h.deps);
  await c.start(file());
  const state = c.getState();
  assert.equal(state.phase, 'failed');
  assert.deepEqual(state.error, { code: 'stage-failed', message: 'The plan rules could not read this deck.', step: 'plan' });
});

test('an ingest error that names a code keeps it', async () => {
  const h = harness({
    ingest: async () => {
      throw Object.assign(new Error('This file is encrypted.'), { code: 'source.encrypted' });
    },
  });
  const c = createRebrandController(h.deps);
  await c.start(file());
  assert.equal(c.getState().error?.code, 'source.encrypted');
  assert.equal(c.getState().error?.step, 'read');
});

test('edits are refused while the deck is still being read or analysed', async () => {
  const h = harness();
  let go: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    go = resolve;
  });
  const faithful = h.handlers['rebrand.faithful'];
  h.handlers['rebrand.faithful'] = async (input: never, call: StageCall) => {
    await gate;
    return faithful?.(input, call);
  };
  const c = createRebrandController(h.deps);
  const started = c.start(file());
  assert.equal(c.getState().phase, 'reading');
  assert.equal((await c.acceptSuggestions()).refusal, 'no-plan');
  await until(() => h.stages.some((call) => call.name === 'rebrand.faithful'), 'the faithful deck');
  assert.equal(c.getState().phase, 'analysing');
  assert.ok(c.getState().plan, 'the plan shows before the comparison is ready');
  const writes = h.store.writes.length;
  assert.equal((await c.include(['ppt/slides/slide1.xml'], false)).refusal, 'busy');
  assert.equal((await c.undo()).refusal, 'busy');
  assert.equal((await c.shuffleColours()).refusal, 'busy');
  assert.equal((await c.openInDesign()).reason, 'busy');
  assert.equal(h.store.writes.length, writes);
  go();
  await started;
  assert.equal(c.getState().phase, 'review');
});

// ─── open ────────────────────────────────────────────────────────────────────

test('open runs only the stages after the checkpoint and recomputes the disposable decks', async () => {
  const { h } = await reviewing();
  h.stages.length = 0;
  const again = createRebrandController(h.deps);
  await again.open('proj-1');
  assert.equal(again.getState().phase, 'review');
  assert.deepEqual(h.stages.map((call) => call.name), ['rebrand.faithful', 'rebrand.compile']);
  assert.ok(again.getState().plan);
  assert.ok(again.getState().faithful);
  assert.equal(again.getState().preview?.planRevision, again.getState().plan?.revision);
});

test('open after the census runs the plan, carrying the stored plan forward', async () => {
  const h = harness();
  h.handlers['rebrand.plan'] = () => {
    throw new Error('stopped at the plan');
  };
  const c = createRebrandController(h.deps);
  await c.start(file());
  assert.equal((await h.store.get('proj-1'))?.checkpoint.stage, 'census');

  h.handlers['rebrand.plan'] = (input: PlanStageInputV1) => ({ ...planSample(), shuffleSeed: input.seed ?? 0 });
  h.stages.length = 0;
  const again = createRebrandController(h.deps);
  await again.open('proj-1');
  assert.deepEqual(h.stages.map((call) => call.name), ['rebrand.plan', 'rebrand.faithful', 'rebrand.compile']);
  assert.equal(again.getState().phase, 'review');
  assert.equal((await h.store.get('proj-1'))?.checkpoint.stage, 'plan');
});

test('open for a project that is not stored fails without inventing one', async () => {
  const h = harness();
  const c = createRebrandController(h.deps);
  await c.open('nothing');
  assert.equal(c.getState().phase, 'failed');
  assert.equal(c.getState().project, null);
  assert.equal(h.stages.length, 0);
});

test('recent lists newest first, remove deletes, close goes back to the intake', async () => {
  const { h, c } = await reviewing();
  await h.store.create({
    id: 'proj-0',
    name: 'Older deck',
    source: { ...SOURCE.source, name: 'older.pptx', pageCount: 5 },
    designSystem: planSample().designSystem,
    updatedAt: '2026-09-20T00:00:00.000Z',
  });
  const older = await h.store.get('proj-0');
  assert.ok(older);
  await h.store.putPart('proj-0', older.revision, 'sourceDeck', structuredClone(SOURCE));
  // A read that stopped before its deck was stored cannot be opened, so it is not listed.
  await h.store.create({ id: 'proj-2', name: 'Half read', source: { ...SOURCE.source }, designSystem: planSample().designSystem, updatedAt: '2026-09-25T00:00:00.000Z' });
  const list = await c.recent();
  assert.deepEqual(list.map((one) => one.id), ['proj-1', 'proj-0']);
  assert.deepEqual(list[1], { id: 'proj-0', name: 'Older deck', sourceName: 'older.pptx', slides: 5, stage: 'ingest', updatedAt: '2026-09-20T00:00:00.000Z' });

  await c.remove('proj-0');
  assert.equal(await h.store.get('proj-0'), null);
  assert.equal(c.getState().phase, 'review', 'removing another project leaves this one open');

  c.close();
  const state = c.getState();
  assert.equal(state.phase, 'idle');
  assert.equal(state.project, null);
  assert.equal(state.plan, null);
  assert.ok(await h.store.get('proj-1'), 'closing keeps the project stored');
  assert.ok(h.released.length > 0, 'closing releases the picture URLs');
});

test('removing the open project closes it first', async () => {
  const { h, c } = await reviewing();
  await c.remove('proj-1');
  assert.equal(c.getState().phase, 'idle');
  assert.equal(await h.store.get('proj-1'), null);
});

// ─── edits ───────────────────────────────────────────────────────────────────

test('a decision is one transaction, one undo step, and undo and redo are one each', async () => {
  const { h, c } = await reviewing();
  const start = c.getState().plan as RenovationPlanV1;
  const writes = h.store.writes.length;
  const out = await c.decide({ objectIds: ['ppt/slides/slide1.xml.4'], action: 'remove', includeCorrected: true, scope: 'This object' });
  assert.deepEqual(out, { ok: true, touched: 1, skipped: 0 });
  assert.deepEqual(h.store.writes.slice(writes), ['part:plan', 'checkpoint:review']);

  let state = c.getState();
  assert.equal(state.plan?.revision, start.revision + 1);
  assert.equal(row(state, 'ppt/slides/slide1.xml.4')?.decision, 'remove');
  assert.equal(row(state, 'ppt/slides/slide1.xml.4')?.author, 'user');
  assert.deepEqual(state.history.undo, { kind: 'decide', action: 'remove', count: 1 });
  assert.equal(state.history.canRedo, false);
  assert.equal(state.previewStale, true);
  const stored = await h.store.get('proj-1');
  assert.equal(stored?.checkpoint.stage, 'review');
  assert.equal(stored?.checkpoint.planRevision, start.revision + 1);
  assert.deepEqual(state.save, { kind: 'saved', revision: stored?.revision });

  const undone = await c.undo();
  assert.equal(undone.ok, true);
  state = c.getState();
  assert.equal(row(state, 'ppt/slides/slide1.xml.4')?.decision, undefined);
  assert.equal(state.plan?.revision, start.revision + 2, 'an undo is its own revision');
  assert.equal(state.history.canUndo, false);
  assert.deepEqual(state.history.redo, { kind: 'decide', action: 'remove', count: 1 });
  assert.equal((await h.store.getPart<RenovationPlanV1>('proj-1', 'plan'))?.slides[0]?.objects[0]?.decision, undefined);

  await c.redo();
  state = c.getState();
  assert.equal(row(state, 'ppt/slides/slide1.xml.4')?.decision, 'remove');
  assert.equal(state.history.canRedo, false);
  assert.equal(state.history.canUndo, true);

  await c.undo();
  assert.equal(c.getState().history.canRedo, true);
  await c.include(['ppt/slides/slide2.xml'], false);
  assert.equal(c.getState().history.canRedo, false, 'a new edit clears redo');
  assert.deepEqual(c.getState().history.undo, { kind: 'exclude', count: 1 });
});

test('an edit that touches nothing writes nothing and adds no step', async () => {
  const { h, c } = await reviewing();
  const writes = h.store.writes.length;
  const tick = c.getState().tick;
  const out = await c.decide({ objectIds: ['nobody'], action: 'keep' });
  assert.deepEqual(out, { ok: false, touched: 0, skipped: 1, refusal: 'nothing-to-do' });
  assert.equal(h.store.writes.length, writes);
  assert.equal(c.getState().tick, tick, 'no state change, no notification');
  assert.equal(c.getState().history.canUndo, false);
  assert.equal((await c.undo()).refusal, 'nothing-to-do');
});

test('a group apply leaves a corrected row alone and reports it', async () => {
  const { c } = await reviewing();
  // slide1.xml.7 was decided keep by a person; a group remove passes over it.
  const out = await c.decide({ objectIds: ['ppt/slides/slide1.xml.7', 'ppt/slides/slide2.xml.3'], action: 'remove', scope: 'group/partner-mark' });
  assert.equal(out.ok, true);
  assert.equal(out.touched, 1);
  assert.equal(out.skipped, 1);
  assert.equal(row(c.getState(), 'ppt/slides/slide1.xml.7')?.decision, 'keep');
  assert.equal(row(c.getState(), 'ppt/slides/slide2.xml.3')?.scope, 'group/partner-mark');
});

test('a stale write is refused, changes nothing shown, and reload picks up the other tab', async () => {
  const { h, c } = await reviewing();
  const before = c.getState();
  const stored = await h.store.get('proj-1');
  assert.ok(stored);
  await h.store.update('proj-1', stored.revision, { name: 'Renamed in another tab' });

  const out = await c.decide({ objectIds: ['ppt/slides/slide1.xml.4'], action: 'remove' });
  assert.equal(out.ok, false);
  assert.equal(out.refusal, 'stale-revision');
  const after = c.getState();
  assert.deepEqual(after.save, { kind: 'stale' });
  assert.equal(after.plan, before.plan, 'the plan shown is the same object');
  assert.equal(after.history.canUndo, false);

  await c.reload();
  const reloaded = c.getState();
  assert.equal(reloaded.project?.name, 'Renamed in another tab');
  assert.equal(reloaded.save.kind, 'saved');
  assert.equal((await c.decide({ objectIds: ['ppt/slides/slide1.xml.4'], action: 'remove' })).ok, true);
});

test('a full device holds the edit in memory and says so', async () => {
  const { h, c } = await reviewing();
  h.store.quotaFull = true;
  const out = await c.decide({ objectIds: ['ppt/slides/slide1.xml.4'], action: 'remove' });
  assert.equal(out.ok, true);
  assert.deepEqual(c.getState().save, { kind: 'held', reason: 'quota' });
  assert.equal(row(c.getState(), 'ppt/slides/slide1.xml.4')?.decision, 'remove', 'the edit stays in view');
  assert.equal((await h.store.getPart<RenovationPlanV1>('proj-1', 'plan'))?.slides[0]?.objects[0]?.decision, undefined);
  assert.equal(c.getState().history.canUndo, true);

  // Room again: the next write carries every held edit in one plan.
  h.store.quotaFull = false;
  await c.setFont('Calibri', 'Outfit');
  assert.equal(c.getState().save.kind, 'saved');
  assert.equal((await h.store.getPart<RenovationPlanV1>('proj-1', 'plan'))?.slides[0]?.objects[0]?.decision, 'remove');
});

test('a full device at the census keeps the whole journey in memory and the download carries it', async () => {
  const h = harness();
  h.store.quotaParts.add('census');
  const c = createRebrandController(h.deps);
  await c.start(file());
  const state = c.getState();
  assert.equal(state.phase, 'review', JSON.stringify(state.error));
  assert.deepEqual(state.save, { kind: 'held', reason: 'quota' });
  assert.ok(state.plan, 'the plan is in view');
  const stored = await h.store.get('proj-1');
  assert.equal(stored?.checkpoint.stage, 'ingest', 'the checkpoint stays where the store last took a part');
  assert.equal(h.store.writes.includes('part:plan'), false, 'nothing after the refusal is written');

  const writes = h.store.writes.length;
  assert.equal((await c.decide({ objectIds: ['ppt/slides/slide1.xml.4'], action: 'remove' })).ok, true);
  assert.deepEqual(c.getState().save, { kind: 'held', reason: 'quota' });
  assert.equal(h.store.writes.length, writes, 'an edit is held too');

  const download = await c.downloadProject();
  assert.ok(download);
  const parts = h.packed[h.packed.length - 1];
  assert.ok(parts, 'the download is packed from memory');
  assert.ok(parts.census, 'the census the store refused travels in the file');
  assert.equal(parts.plan?.slides[0]?.objects[0]?.decision, 'remove');
});

test('a download while an edit is held packs the held plan', async () => {
  const { h, c } = await reviewing();
  assert.ok(await c.downloadProject());
  assert.equal(h.packed[0], null, 'a saved project is packed from the store');
  h.store.quotaFull = true;
  await c.decide({ objectIds: ['ppt/slides/slide1.xml.4'], action: 'remove' });
  await c.downloadProject();
  const parts = h.packed[1];
  assert.equal(parts?.plan?.slides[0]?.objects[0]?.decision, 'remove', 'the held edit is in the file');
});

test('Open in Design writes held edits first, and opens from memory while the device is still full', async () => {
  const { h, c } = await reviewing();
  h.store.quotaFull = true;
  await c.acceptSuggestions();
  assert.deepEqual(c.getState().save, { kind: 'held', reason: 'quota' });

  // Still full: Design opens, and no checkpoint or compiled part names a plan the store lacks.
  await previewSettled(c);
  const writes = h.store.writes.length;
  const held = await c.openInDesign();
  assert.equal(held.ok, true, JSON.stringify(held));
  assert.equal(h.imported.length, 1);
  assert.deepEqual(h.store.writes.slice(writes).filter((one) => one !== 'update'), [], 'only the session list was written');
  assert.deepEqual(c.getState().save, { kind: 'held', reason: 'quota' });

  // Room again: the held plan is written, then marked and compiled against.
  h.store.quotaFull = false;
  const opened = await c.openInDesign();
  assert.equal(opened.ok, true, JSON.stringify(opened));
  const plan = await h.store.getPart<RenovationPlanV1>('proj-1', 'plan');
  const compiled = await h.store.getPart<CompiledDeckV1>('proj-1', 'compiled');
  assert.equal(plan?.slides[1]?.objects.find((one) => one.id === 'ppt/slides/slide2.xml.5')?.review, 'accepted');
  assert.equal(compiled?.planRevision, plan?.revision, 'the compiled part names the stored plan');
  assert.equal((await h.store.get('proj-1'))?.checkpoint.stage, 'done', 'the handoff wrote its session, so the project opened in Design');
  assert.equal(c.getState().save.kind, 'saved');
  // The write only moved the revision on, so the preview still describes the plan and a
  // third Open in Design goes ahead instead of waiting for a preview that never comes.
  assert.equal(c.getState().preview?.planRevision, c.getState().plan?.revision, 'the preview follows the written revision');
  const third = await c.openInDesign();
  assert.equal(third.ok, true, JSON.stringify(third));
});

test('open against a changed design system makes the plan again and keeps what the person chose', async () => {
  const { h, c } = await reviewing();
  assert.equal((await c.setLayout(['ppt/slides/slide1.xml'], 'content')).ok, true);
  assert.equal((await c.include(['ppt/slides/slide2.xml'], false)).ok, true);
  assert.equal((await c.setFont('Arial', 'Outfit')).ok, true);
  assert.equal((await c.setColour(['use/ink/1a1a1a'], { hex: '#11201C', path: 'color.ink.default' })).ok, true);
  const before = await h.store.getPart<RenovationPlanV1>('proj-1', 'plan');
  assert.ok(before);
  c.dispose();

  const changed: RebrandResolvedSystemV1 = {
    input: { ...SYSTEM.input, colors: { 'color.ink.default': '#222222' } },
    info: { ...SYSTEM.info, colors: { 'color.ink.default': '#222222' } },
  };
  const next = harness({ resolveDesignSystem: async () => changed });
  Object.assign(next.deps, { store: h.store });
  const again = createRebrandController(next.deps);
  await again.open('proj-1');
  const state = again.getState();
  assert.equal(state.phase, 'review', JSON.stringify(state.error));
  const planCall = next.stages.find((one) => one.name === 'rebrand.plan');
  assert.ok(planCall, 'the plan is made again');
  assert.equal((planCall.input as PlanStageInputV1).previous?.revision, before.revision);

  const plan = state.plan;
  assert.ok(plan);
  assert.ok(plan.revision > before.revision);
  assert.equal(plan.designSystem.tokenHash, (await snapshotOf(changed.input)).tokenHash);
  assert.equal(plan.slides[0]?.layout, 'content');
  assert.equal(plan.slides[0]?.layoutSource, 'user');
  assert.equal(plan.slides[1]?.include, false);
  assert.deepEqual(plan.fonts.find((one) => one.from === 'Arial'), { from: 'Arial', to: 'Outfit', source: 'user' });
  const ink = plan.colors.find((one) => one.useId === 'use/ink/1a1a1a');
  assert.equal(ink?.to, '#222222', 'a locked colour follows its token into the new design system');
  assert.equal(ink?.locked, true);
  assert.equal((await h.store.get('proj-1'))?.checkpoint.planRevision, plan.revision);

  // Opened again against the same design system, nothing is made again.
  next.stages.length = 0;
  const third = createRebrandController(next.deps);
  await third.open('proj-1');
  assert.equal(next.stages.some((one) => one.name === 'rebrand.plan'), false);
});

test('a cancel that arrives as the read finishes leaves no project behind', async () => {
  const h = harness();
  const ingest = h.deps.ingest;
  h.deps.ingest = async (input) => {
    const out = await ingest.call(h.deps, input);
    h.jobs[0]?.cancel?.();
    return out;
  };
  const c = createRebrandController(h.deps);
  await c.start(file());
  assert.equal(c.getState().error?.code, 'cancelled');
  assert.equal(await h.store.get('proj-1'), null);
});

test('a start that failed on another tab reopens from the store on reload, with both panes', async () => {
  const h = harness();
  const plan = h.handlers['rebrand.plan'];
  h.handlers['rebrand.plan'] = async (input: PlanStageInputV1, call: StageCall) => {
    const stored = await h.store.get('proj-1');
    assert.ok(stored);
    await h.store.update('proj-1', stored.revision, { name: 'Renamed in another tab' });
    return plan?.(input, call);
  };
  const c = createRebrandController(h.deps);
  await c.start(file());
  assert.equal(c.getState().error?.code, 'plan.revision-stale');
  assert.equal(c.getState().faithful, null);

  h.handlers['rebrand.plan'] = plan;
  await c.reload();
  const state = c.getState();
  assert.equal(state.phase, 'review', JSON.stringify(state.error));
  assert.ok(state.faithful, 'the Original pane is drawn');
  assert.equal(state.project?.name, 'Renamed in another tab');
});

test('a picture whose URL failed is asked for again by the next deck', async () => {
  let failures = 1;
  const asked: string[] = [];
  const h = harness({
    async mediaUrl(ref) {
      asked.push(ref);
      if (ref === 'user/media/proposed-photo' && failures > 0) {
        failures -= 1;
        throw new Error('The picture could not be read.');
      }
      return `blob:${ref}`;
    },
  });
  const { c } = await reviewing(h);
  await until(() => asked.includes('user/media/proposed-photo'), 'the first ask');
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(c.mediaHref('user/media/proposed-photo'), undefined);
  await c.decide({ objectIds: ['ppt/slides/slide1.xml.4'], action: 'remove' });
  await until(() => c.mediaHref('user/media/proposed-photo') !== undefined, 'the picture on the next deck');
});

test('slides, layouts, colours and fonts each apply as one labelled step', async () => {
  const { h, c } = await reviewing();
  assert.equal((await c.move('ppt/slides/slide2.xml', -1)).ok, true);
  assert.deepEqual(c.getState().history.undo, { kind: 'move', count: 1 });
  assert.deepEqual(c.getState().plan?.slides.map((slide) => slide.order), [1, 0]);

  assert.equal((await c.setLayout(['ppt/slides/slide1.xml', 'ppt/slides/slide2.xml'], 'title')).ok, true);
  assert.deepEqual(c.getState().history.undo, { kind: 'layout', count: 2 });
  assert.equal(c.getState().plan?.slides[0]?.layoutSource, 'user');

  assert.equal((await c.setColour(['use/series/0c322c'], { hex: '#11201C', path: 'color.ink.default' })).ok, true);
  assert.deepEqual(c.getState().history.undo, { kind: 'colour', count: 1 });
  const colour = c.getState().plan?.colors.find((one) => one.useId === 'use/series/0c322c');
  assert.equal(colour?.to, '#11201C');
  assert.equal(colour?.locked, true, 'a chosen colour is locked');

  // Automatic runs the solve again for that use. For this one the solve answers that
  // the palette is too small, which would leave the source colour in the compile, so
  // the row takes the nearest design system colour: Automatic always gives a target.
  h.stages.length = 0;
  assert.equal((await c.setColour(['use/series/0c322c'], null)).ok, true);
  const auto = c.getState().plan?.colors.find((one) => one.useId === 'use/series/0c322c');
  assert.equal(auto?.to?.toUpperCase(), '#11201C', 'a target, never the source colour');
  assert.equal(auto?.toPath, 'color.ink.default');
  assert.equal(auto?.unresolved, undefined);
  assert.equal(auto?.locked, undefined, 'an automatic colour is not locked');
  assert.ok(h.stages.some((one) => one.name === 'rebrand.plan'), 'the solve ran');
  assert.deepEqual(c.getState().history.undo, { kind: 'colour', count: 1 });

  assert.equal((await c.setFont('Arial', 'Outfit', 'font.body.family')).ok, true);
  assert.deepEqual(c.getState().history.undo, { kind: 'font', count: 1 });

  assert.equal((await c.include(['ppt/slides/slide1.xml'], false)).ok, true);
  assert.equal((await c.include(['ppt/slides/slide1.xml'], true)).ok, true);
  assert.deepEqual(c.getState().history.undo, { kind: 'include', count: 1 });

  // Undo walks every step back in order.
  for (let i = 0; i < 7; i += 1) assert.equal((await c.undo()).ok, true, `undo ${i}`);
  assert.equal(c.getState().history.canUndo, false);
  const plan = c.getState().plan;
  const shape = (slides: RenovationPlanV1['slides'] | undefined) => (slides ?? []).map((slide) => [slide.layout, slide.layoutSource, slide.order, slide.include]);
  assert.deepEqual(shape(plan?.slides), shape(planSample().slides));
  assert.deepEqual(plan?.fonts, planSample().fonts);
  assert.deepEqual(plan?.colors, planSample().colors);
});

test('a bulk include counts the slides whose include flipped, not every slide it named', async () => {
  const { c } = await reviewing();
  assert.equal((await c.include(['ppt/slides/slide2.xml'], false)).ok, true);
  // Both named, one already in: the step is about the one that changed.
  assert.equal((await c.include(['ppt/slides/slide1.xml', 'ppt/slides/slide2.xml'], true)).ok, true);
  assert.deepEqual(c.getState().history.undo, { kind: 'include', count: 1 });
});

test('Shuffle takes only the colours and the seed, keeps locked rows, and is undoable', async () => {
  const { h, c } = await reviewing();
  h.handlers['rebrand.plan'] = (input: PlanStageInputV1) => {
    const plan = planSample();
    // A plan stage that also moved a layout: none of that may come across.
    plan.slides[0] = { ...(plan.slides[0] as RenovationPlanV1['slides'][number]), layout: 'quote' };
    plan.colors = plan.colors.map((one) => ({ ...one, to: '#123456' }));
    plan.shuffleSeed = input.seed ?? 0;
    return plan;
  };
  const base = c.getState().plan as RenovationPlanV1;
  h.stages.length = 0;
  const out = await c.shuffleColours();
  assert.equal(out.ok, true);
  const call = h.stages.find((one) => one.name === 'rebrand.plan');
  const input = call?.input as PlanStageInputV1;
  assert.equal(input.seed, (base.shuffleSeed ?? 0) + 1);
  assert.equal(input.previous, base);

  const plan = c.getState().plan as RenovationPlanV1;
  assert.equal(plan.shuffleSeed, (base.shuffleSeed ?? 0) + 1);
  assert.equal(plan.slides[0]?.layout, base.slides[0]?.layout, 'the layout did not come across');
  const locked = plan.colors.find((one) => one.useId === 'use/bg/ffffff');
  assert.equal(locked?.to, '#FFFFFF', 'a locked row stays');
  assert.equal(plan.colors.find((one) => one.useId === 'use/ink/1a1a1a')?.to, '#123456');
  assert.deepEqual(c.getState().history.undo, { kind: 'shuffle', count: 2 });

  await c.undo();
  assert.deepEqual(c.getState().plan?.colors, base.colors);
});

// ─── the preview ─────────────────────────────────────────────────────────────

test('edits coalesce into one compile, and an edit during a compile waits for it and compiles once after', async () => {
  const { h, c } = await reviewing(harness({ previewDelayMs: 20 }));
  const pending: Array<{ revision: number; resolve: () => void }> = [];
  h.handlers['rebrand.compile'] = (input: CompileStageInputV1) => new Promise((resolve) => {
    pending.push({ revision: input.plan.revision, resolve: () => resolve(deckDrawing('user/media/proposed-photo', input.plan.revision)) });
  });
  h.stages.length = 0;
  await c.decide({ objectIds: ['ppt/slides/slide1.xml.4'], action: 'remove' });
  await c.decide({ objectIds: ['ppt/slides/slide2.xml.3'], action: 'keep' });
  await until(() => pending.length === 1, 'one coalesced compile');
  const first = pending[0];
  assert.equal(first?.revision, c.getState().plan?.revision);
  assert.equal(c.getState().previewStale, true);

  // Two more edits while the first compile runs: neither starts a compile of its own.
  await c.include(['ppt/slides/slide2.xml'], false);
  await c.include(['ppt/slides/slide2.xml'], true);
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(pending.length, 1, 'nothing queues behind the running compile');

  // The first result arrives (older than the plan), then one compile runs for the plan in hand.
  first?.resolve();
  await until(() => c.getState().preview?.planRevision === first?.revision, 'the older preview');
  assert.equal(c.getState().previewStale, true, 'the pane still says it is behind');
  await until(() => pending.length === 2, 'the follow-up compile');
  const second = pending[1];
  assert.equal(second?.revision, c.getState().plan?.revision, 'the follow-up reads the latest plan');
  second?.resolve();
  await until(() => c.getState().previewStale === false, 'the current preview');
  assert.equal(c.getState().preview?.planRevision, second?.revision);
  assert.equal(h.stages.filter((one) => one.name === 'rebrand.compile').length, 2);
});

test('a failed preview names its step, and the next preview that arrives clears it', async () => {
  const { h, c } = await reviewing();
  const compile = h.handlers['rebrand.compile'];
  h.handlers['rebrand.compile'] = () => {
    throw new Error('The master has no content layout.');
  };
  await c.decide({ objectIds: ['ppt/slides/slide1.xml.4'], action: 'remove' });
  await until(() => c.getState().error?.step === 'preview', 'the preview error');
  h.handlers['rebrand.compile'] = compile;
  await c.decide({ objectIds: ['ppt/slides/slide2.xml.3'], action: 'keep' });
  await until(() => c.getState().previewStale === false, 'the current preview');
  assert.equal(c.getState().error, null);
});

test('a locked row still waiting for review shows held back in the preview, as Design will', async () => {
  const h = harness();
  const plan = h.handlers['rebrand.plan'];
  h.handlers['rebrand.plan'] = async (input: PlanStageInputV1, call: StageCall) => {
    const made = (await plan?.(input, call)) as RenovationPlanV1;
    const waiting = made.slides[1]?.objects.find((one) => one.id === 'ppt/slides/slide2.xml.3');
    assert.ok(waiting);
    Object.assign(waiting, { review: 'unreviewed', locked: true });
    return made;
  };
  const { c } = await reviewing(h);
  const preview = h.stages.find((one) => one.name === 'rebrand.compile')?.input as CompileStageInputV1;
  const shown = preview.plan.slides[1]?.objects.find((one) => one.id === 'ppt/slides/slide2.xml.3');
  assert.equal(shown?.proposal, 'keep', 'the preview holds the proposal back');
  assert.equal(row(c.getState(), 'ppt/slides/slide2.xml.3')?.proposal, 'replace', 'the plan itself is unchanged');
  assert.equal(row(c.getState(), 'ppt/slides/slide2.xml.3')?.review, 'unreviewed');
});

test('a reload after edits held in memory lets the next preview through', async () => {
  const { h, c } = await reviewing();
  h.store.quotaFull = true;
  await c.decide({ objectIds: ['ppt/slides/slide1.xml.4'], action: 'remove' });
  await c.decide({ objectIds: ['ppt/slides/slide2.xml.3'], action: 'keep' });
  await until(() => c.getState().previewStale === false, 'the held preview');
  const heldRevision = c.getState().preview?.planRevision ?? 0;
  h.store.quotaFull = false;

  await c.reload();
  const reloaded = c.getState().plan?.revision ?? 0;
  assert.ok(reloaded < heldRevision, 'the store holds an older revision than the held edits');
  await until(() => c.getState().preview?.planRevision === reloaded && !c.getState().previewStale, 'the reloaded preview');

  await c.decide({ objectIds: ['ppt/slides/slide1.xml.4'], action: 'remove' });
  const next = c.getState().plan?.revision;
  await until(() => c.getState().preview?.planRevision === next && !c.getState().previewStale, 'the preview after the reload');
});

test('pictures are asked for once, drawn once they arrive, and released on dispose', async () => {
  const { h, c } = await reviewing();
  await until(() => c.mediaHref('user/media/proposed-photo') !== undefined, 'the proposed picture');
  assert.equal(c.mediaHref('user/media/source-photo'), 'blob:user/media/source-photo');
  assert.equal(c.mediaHref('user/media/unknown'), undefined);

  await c.decide({ objectIds: ['ppt/slides/slide1.xml.4'], action: 'remove' });
  await until(() => c.getState().previewStale === false, 'the next preview');
  assert.deepEqual([...h.mediaAsked].sort(), ['user/media/proposed-photo', 'user/media/source-photo'], 'each ref is asked for once');

  c.dispose();
  assert.deepEqual([...h.released].sort(), ['blob:user/media/proposed-photo', 'blob:user/media/source-photo']);
});

// ─── Design ──────────────────────────────────────────────────────────────────

test('Open in Design waits for every suggestion, flagged ones included, then compiles what was accepted', async () => {
  const { h, c } = await reviewing();
  // One unreviewed row and one flagged row wait; the locked flagged row cannot be answered, so it does not.
  const plan = c.getState().plan;
  assert.ok(plan);
  assert.deepEqual(openPendingIds(plan), ['ppt/slides/slide2.xml.3', 'ppt/slides/slide2.xml.5']);
  const refused = await c.openInDesign();
  assert.deepEqual(refused, { ok: false, reason: 'unreviewed', pending: 2, warnings: [] });
  assert.equal(h.imported.length, 0);

  const accepted = await c.acceptSuggestions();
  assert.equal(accepted.ok, true);
  assert.equal(accepted.touched, 2, 'Accept all answers the flagged row too');
  assert.deepEqual(c.getState().history.undo, { kind: 'accept', count: 2 }, 'one undoable step');
  assert.equal(row(c.getState(), 'ppt/slides/slide2.xml.5')?.review, 'accepted');
  assert.equal(row(c.getState(), 'ppt/slides/slide2.xml.3')?.decision, 'replace', 'answered as proposed');
  assert.equal(row(c.getState(), 'ppt/slides/slide2.xml.3')?.author, 'user');
  assert.deepEqual(openPendingIds(c.getState().plan ?? plan), []);

  await previewSettled(c);
  h.stages.length = 0;
  const phases: string[] = [];
  c.subscribe((state) => phases.push(state.phase));
  const opened = await c.openInDesign();
  assert.equal(opened.ok, true);
  assert.equal(opened.sessionId, 'session/design/1');
  const compile = h.stages.find((one) => one.name === 'rebrand.compile' && (one.input as CompileStageInputV1).applyUnreviewed === false);
  assert.ok(compile, 'the compile for Design applies nothing unreviewed');
  assert.equal((compile.input as CompileStageInputV1).applyNeedsAttention, false, 'nor anything flagged');
  assert.ok(phases.includes('opening'));
  assert.equal(c.getState().phase, 'review');
  assert.equal(h.imported[0], COMPILED.frames.length + (COMPILED.tray.length > 0 ? 1 : 0), 'every slide, and the Not placed artboard');
  assert.ok(h.jobs.some((job) => job.title === 'Opening Quarterly review in Design'));

  const stored = await h.store.get('proj-1');
  assert.equal(stored?.checkpoint.stage, 'done', 'the session is recorded, so the lists read "opened in Design"');
  assert.ok(h.store.parts.has('proj-1:compiled'));
  assert.deepEqual(stored?.designSessionIds, ['session/design/1']);
  assert.deepEqual(c.getState().project?.designSessionIds, ['session/design/1']);

  // An edit after the handoff reopens the review; the compiled part stays.
  await c.setFont('Calibri', 'Outfit');
  assert.equal((await h.store.get('proj-1'))?.checkpoint.stage, 'review');
  assert.ok(h.store.parts.has('proj-1:compiled'));
});

test('Automatic runs the colour solve again, so the use gets a design system target back, unlocked', async () => {
  const { h, c } = await reviewing();
  const seed = c.getState().plan?.shuffleSeed;
  assert.equal((await c.setColour(['use/ink/1a1a1a'], { hex: '#FFFFFF', path: 'color.surface.page' })).ok, true);
  h.stages.length = 0;
  assert.equal((await c.setColour(['use/ink/1a1a1a'], null)).ok, true);
  const ink = c.getState().plan?.colors.find((one) => one.useId === 'use/ink/1a1a1a');
  assert.equal(ink?.to, '#11201C', 'the solve maps it again');
  assert.equal(ink?.toPath, 'color.ink.default');
  assert.equal(ink?.locked, undefined);
  const solve = h.stages.find((one) => one.name === 'rebrand.plan');
  assert.ok(solve, 'the solve ran');
  assert.equal((solve.input as PlanStageInputV1).seed, seed, 'with the seed the plan holds');
  // Other rows stay as they were, the locked page colour included.
  assert.equal(c.getState().plan?.colors.find((one) => one.useId === 'use/bg/ffffff')?.locked, true);
  assert.deepEqual(c.getState().history.undo, { kind: 'colour', count: 1 });
  assert.equal((await c.undo()).ok, true);
  assert.equal(c.getState().plan?.colors.find((one) => one.useId === 'use/ink/1a1a1a')?.to, '#FFFFFF', 'one undoable step');
});

test('rows on a slide left out neither hold Open in Design back nor get answered by Accept all', async () => {
  const { h, c } = await reviewing();
  // Both waiting rows of the sample sit on slide 2.
  assert.deepEqual(openPendingIds(c.getState().plan ?? planSample()), ['ppt/slides/slide2.xml.3', 'ppt/slides/slide2.xml.5']);
  assert.equal((await c.include(['ppt/slides/slide2.xml'], false)).ok, true);
  assert.deepEqual(openPendingIds(c.getState().plan ?? planSample()), []);
  assert.equal((await c.acceptSuggestions()).refusal, 'nothing-to-do', 'Accept all answers only what Open in Design waits on');
  assert.equal(row(c.getState(), 'ppt/slides/slide2.xml.5')?.review, 'unreviewed');
  await previewSettled(c);
  const opened = await c.openInDesign();
  assert.equal(opened.ok, true, JSON.stringify(opened));
  assert.equal(h.imported.length, 1);
});

test('Open in Design waits while the preview is updating or failed, so what opens is what the pane showed', async () => {
  const { h, c } = await reviewing();
  await c.acceptSuggestions();
  await previewSettled(c);
  // The next compile fails: the pane says so, and Open in Design is held back.
  h.handlers['rebrand.compile'] = () => {
    throw new Error('The master has no content layout.');
  };
  assert.equal((await c.setFont('Calibri', 'Outfit')).ok, true);
  assert.equal((await c.openInDesign()).reason, 'busy', 'a stale preview holds it back');
  await until(() => c.getState().error?.step === 'preview', 'the failed preview');
  assert.equal((await c.openInDesign()).reason, 'busy', 'a failed preview holds it back');
  assert.equal(h.imported.length, 0);
});

test('a compile that fails for Design goes back to review and names the step', async () => {
  const { h, c } = await reviewing();
  await c.acceptSuggestions();
  h.handlers['rebrand.compile'] = (input: CompileStageInputV1) => {
    if (!input.applyUnreviewed) throw new Error('The master has no content layout.');
    return deckDrawing('user/media/proposed-photo', input.plan.revision);
  };
  await previewSettled(c);
  const out = await c.openInDesign();
  assert.equal(out.ok, false);
  assert.equal(out.reason, 'compile-failed');
  assert.equal(c.getState().phase, 'review');
  assert.equal(c.getState().error?.step, 'compile');
});

test('downloadProject packs the open project and answers null with none open', async () => {
  const h = harness();
  const c = createRebrandController(h.deps);
  assert.equal(await c.downloadProject(), null);
  await c.start(file());
  const out = await c.downloadProject();
  assert.equal(out?.filename, 'Quarterly review.lolly');
});

// ─── keep the design ─────────────────────────────────────────────────────────

test('Keep the design runs once, leaves the renovate draft alone and survives switching back', async () => {
  const { h, c } = await reviewing();
  await c.decide({ objectIds: ['ppt/slides/slide1.xml.4'], action: 'remove' });
  const plan = c.getState().plan;
  const states: string[] = [];
  c.subscribe((state) => states.push(state.keep.status));

  await c.setMode('keep-design');
  assert.equal(h.keepCalls, 1);
  assert.deepEqual(states.filter((one, i) => one !== states[i - 1]), ['idle', 'working', 'ready']);
  const keep = c.getState().keep;
  assert.equal(keep.status, 'ready');
  assert.equal(keep.changes?.themeSlots, 6);
  assert.equal(c.getState().plan, plan, 'the renovate draft is untouched');

  await c.setMode('renovate');
  assert.equal(c.getState().mode, 'renovate');
  assert.equal(c.getState().keep.status, 'ready', 'the keep result stays');
  await c.setMode('keep-design');
  assert.equal(h.keepCalls, 1, 'it ran once');

  const download = await c.keepDesignDownload();
  assert.equal(download?.filename, 'quarterly-review-rebranded.pptx');
  assert.equal(download?.blob.type, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
  assert.equal(download?.blob.size, 4);
});

test('Keep the design without a pptx writer or without the bytes fails with a reason', async () => {
  const none = harness({ keepDesign: undefined });
  const a = createRebrandController(none.deps);
  await a.start(file());
  await a.setMode('keep-design');
  assert.equal(a.getState().keep.status, 'failed');
  assert.equal(a.getState().keep.error, 'keep.no-patcher', 'a code the view has copy for, not English');
  assert.equal(await a.keepDesignDownload(), null);

  const gone = harness({ sourceBytes: async () => null });
  const b = createRebrandController(gone.deps);
  await b.start(file());
  await b.setMode('keep-design');
  assert.equal(b.getState().keep.status, 'failed');
  assert.equal(b.getState().keep.error, 'keep.no-source');
  assert.equal(gone.keepCalls, 0);
});

test('choosing Keep the design before a file runs it once the deck is read', async () => {
  const h = harness();
  const c = createRebrandController(h.deps);
  await c.setMode('keep-design');
  assert.equal(h.keepCalls, 0);
  await c.start(file());
  await until(() => c.getState().keep.status === 'ready', 'the keep result');
  assert.equal(h.keepCalls, 1);
});

test('a patcher refusal is a code: not a deck, and anything else is keep.failed', async () => {
  for (const [thrown, code] of [
    [Object.assign(new Error('The file is not a readable PowerPoint deck.'), { code: 'not-a-deck' }), 'keep.not-a-deck'],
    [Object.assign(new Error('This app cannot patch PowerPoint files.'), { code: 'pptx-unavailable' }), 'keep.no-patcher'],
    [new Error('boom'), 'keep.failed'],
  ] as const) {
    const h = harness({ keepDesign: async () => { throw thrown; } });
    const c = createRebrandController(h.deps);
    await c.start(file());
    await c.setMode('keep-design');
    assert.equal(c.getState().keep.status, 'failed');
    assert.equal(c.getState().keep.error, code);
    assert.ok((KEEP_FAILURE_CODES as readonly string[]).includes(code));
  }
});

test('the preview plan reads a locked waiting row as a keep, and leaves every other row alone', () => {
  const plan = planSample();
  const locked = plan.slides[0]?.objects.find((one) => one.id === 'ppt/slides/slide1.xml.7');
  assert.ok(locked);
  delete locked.decision;
  locked.proposalReplacement = { kind: 'brand-logo', variant: 'auto' };
  const shown = previewPlanOf(plan);
  const held = shown.slides[0]?.objects.find((one) => one.id === locked.id);
  assert.equal(held?.proposal, 'keep', 'nothing answers a locked row, so Open in Design keeps it and so does the pane');
  assert.equal(held?.proposalReplacement, undefined);
  assert.equal(held?.review, 'needs-attention', 'its review state is not rewritten');
  assert.equal(shown.slides[1], plan.slides[1], 'a slide with no such row is the same object');
  assert.ok(!openPendingIds(plan).includes(locked.id), 'and it never holds Open in Design back');
  const plain = planSample();
  assert.equal(previewPlanOf(plain), plain, 'a plan with no such row comes back as it was');
});

// ─── one controller per key ──────────────────────────────────────────────────

test('rebrandControllerFor keeps one controller per key until it is disposed', () => {
  const key = {};
  let made = 0;
  const makeDeps = (): RebrandControllerDepsV1 => {
    made += 1;
    return harness().deps;
  };
  const first = rebrandControllerFor(key, makeDeps);
  assert.equal(rebrandControllerFor(key, makeDeps), first);
  assert.equal(made, 1);
  assert.notEqual(rebrandControllerFor({}, makeDeps), first, 'another key gets its own');
  first.dispose();
  const next = rebrandControllerFor(key, makeDeps);
  assert.notEqual(next, first);
  next.dispose();
});

// ─── the real engine stages over simple.pptx ─────────────────────────────────

test('over the engine: read, accept the suggestions, shuffle, undo, and open in Design', async () => {
  const pipeline = await import('../../../../../tests/helpers/rebrand-pipeline.ts');
  const fixtures = await import('../../../../../tests/helpers/rebrand-fixtures.ts');
  const run = await pipeline.runRebrandPipeline('simple.pptx', fixtures.readFixture('simple.pptx'));
  const designSystem = pipeline.STARTER_DESIGN_SYSTEM;
  const algorithms = { reader: 'pptx-read/test', census: run.census.rules.version, plan: PLAN_RULES.version };

  const h = harness({
    resolveDesignSystem: async () => ({ input: designSystem.input, info: { ...SYSTEM.info, id: designSystem.input.id } }),
    async ingest() {
      const project = await h.store.create({ id: 'simple', name: 'Simple', source: { ...run.deck.source }, designSystem: designSystem.snapshot });
      return { project, source: structuredClone(run.deck) };
    },
  });
  h.handlers['rebrand.census'] = (input: { source: SourceDeckV1 }) => censusDeck(input.source);
  h.handlers['rebrand.plan'] = (input: PlanStageInputV1) => firstPass({
    source: input.source,
    census: input.census,
    designSystem: designSystem.firstPass,
    algorithms,
    ...(input.previous ? { previous: input.previous } : {}),
    ...(input.seed !== undefined ? { seed: input.seed } : {}),
  });
  h.handlers['rebrand.faithful'] = (input: { source: SourceDeckV1 }) => compileFaithful(input.source);
  h.handlers['rebrand.compile'] = (input: CompileStageInputV1) => compileRenovated({
    source: input.source,
    ...(input.census ? { census: input.census } : {}),
    plan: input.plan,
    master: pipeline.STARTER_MASTER,
    designSystem: designSystem.compile,
    opts: { applyUnreviewed: input.applyUnreviewed, applyNeedsAttention: input.applyNeedsAttention },
  });

  const c = createRebrandController(h.deps);
  await c.start(file('simple.pptx'));
  assert.equal(c.getState().phase, 'review', JSON.stringify(c.getState().error));
  assert.equal(c.getState().plan?.slides.length, run.deck.slides.length);

  const pending = (await c.openInDesign()).pending ?? 0;
  if (pending > 0) {
    const accepted = await c.acceptSuggestions();
    assert.equal(accepted.touched, pending);
  }
  assert.equal((await c.shuffleColours()).ok, true);
  if (c.getState().history.undo?.kind === 'shuffle') assert.equal((await c.undo()).ok, true);

  await previewSettled(c);
  const opened = await c.openInDesign();
  assert.equal(opened.ok, true, JSON.stringify(opened));
  const compiled = await h.store.getPart<CompiledDeckV1>('simple', 'compiled');
  assert.ok(compiled);
  assert.equal(h.imported[0], compiled.frames.length + (compiled.tray.length > 0 ? 1 : 0));
  assert.equal((await h.store.get('simple'))?.checkpoint.stage, 'done');
});

// ─── the pending rule, a second opening, newer versions, presets, several decks ──

test('the pending rule and Accept all are the engine\'s own', async () => {
  assert.equal(openPendingIds, engineOpenPendingIds, 'the controller hands out the engine rule, not a copy');
  const { c } = await reviewing();
  const plan = c.getState().plan;
  assert.ok(plan);
  const left = structuredClone(plan);
  const slide2 = left.slides[1];
  assert.ok(slide2);
  slide2.include = false;
  assert.deepEqual(openPendingIds(left), [], 'rows on a slide left out never wait');
});

test('a second Open in Design opens a new document beside the first and says what changed', async () => {
  const names: string[] = [];
  let minted = 0;
  const h = harness({
    design: {
      navigate: (open) => {
        names.push(open.name);
        minted += 1;
        return { id: `design:${minted}` };
      },
      importer: (frames) => ({ landed: frames.length, keptIds: true }),
    },
  });
  // The second compile drops the first frame and uses another colour, so there is something to say.
  let compiles = 0;
  h.handlers['rebrand.compile'] = (input) => {
    const deck = deckDrawing('user/media/proposed-photo', (input as CompileStageInputV1).plan.revision);
    if ((input as CompileStageInputV1).applyUnreviewed === false) {
      compiles += 1;
      if (compiles > 1) {
        deck.frames = deck.frames.slice(1);
        for (const frame of deck.frames) for (const row of frame.layers) row.fill = '#123456';
      }
    }
    return deck;
  };
  const { c } = await reviewing(h);
  await c.acceptSuggestions();
  await previewSettled(c);
  const first = await c.openInDesign();
  assert.equal(first.ok, true);
  assert.equal(first.changes, undefined, 'a first compile has nothing to compare with');
  assert.equal(c.getState().compileDiff, null);

  await c.setFont('Calibri', 'Outfit');
  await previewSettled(c);
  const second = await c.openInDesign();
  assert.equal(second.ok, true, JSON.stringify(second));
  assert.equal(second.sessionId, 'design:2', 'a new document, never the first one again');
  assert.deepEqual(names, ['Quarterly review', 'Quarterly review, revision 2']);
  assert.deepEqual((await h.store.get('proj-1'))?.designSessionIds, ['design:1', 'design:2']);
  const diff = c.getState().compileDiff;
  assert.ok(diff, 'the report can say what changed');
  assert.deepEqual(second.changes, diff);
  assert.deepEqual(diff.framesRemoved, [COMPILED.frames[0]?.id]);
  assert.ok(diff.coloursAdded.includes('#123456'), JSON.stringify(diff));
  assert.ok(diff.objectsChanged.length > 0, 'the objects whose layers changed are named');

  // What changed belongs to this opening of this project: the next project opened, or
  // this one opened again, starts with no diff and no versions of its own yet.
  c.close();
  assert.equal(c.getState().compileDiff, undefined, 'closing clears the diff');
  await c.open('proj-1');
  assert.equal(c.getState().phase, 'review');
  assert.equal(c.getState().compileDiff, undefined, 'a project opened again has not been opened in Design in this session');
});

test('a newer version joins the lineage, carries the open plan as previous and lists the old version', async () => {
  const lineages: Array<string | undefined> = [];
  let reads = 0;
  const h = harness({
    async ingest({ file, lineageId }) {
      lineages.push(lineageId);
      reads += 1;
      const id = reads === 1 ? 'proj-1' : `proj-${reads}`;
      const source = structuredClone(SOURCE);
      source.source = { ...source.source, ...(lineageId ? { lineageId } : {}), hash: `sha256:${String(reads).repeat(64)}` };
      const project = await h.store.create(
        {
          id,
          name: 'Quarterly review',
          source: { ...source.source, name: file.name },
          designSystem: planSample().designSystem,
          updatedAt: `2026-09-24T0${reads}:00:00.000Z`,
        },
        { bytes: file },
      );
      return { project, source };
    },
  });
  const { c } = await reviewing(h);
  const before = c.getState().plan;
  assert.ok(before);
  const oldLineage = c.getState().project?.source.lineageId;
  h.stages.length = 0;
  await c.openNewerVersion?.(file('quarterly-review-v2.pptx'));
  const state = c.getState();
  assert.equal(state.phase, 'review', JSON.stringify(state.error));
  assert.equal(state.project?.id, 'proj-2');
  assert.deepEqual(lineages, [undefined, oldLineage], 'the second read is asked to join the first one\'s lineage');
  assert.equal(state.project?.source.lineageId, oldLineage);
  const planCall = h.stages.find((one) => one.name === 'rebrand.plan');
  assert.ok(planCall);
  assert.deepEqual((planCall.input as PlanStageInputV1).previous, before, 'the open plan is the previous one');
  assert.deepEqual(state.versions?.map((one) => one.id), ['proj-1'], 'the old version stays on offer');
  assert.ok(await h.store.get('proj-1'), 'and stays stored');
});

test('the queue gains Carried from the last version and Needs another look for a newer version', () => {
  const plan = planSample();
  delete plan.carryForward;
  assert.deepEqual(lineageQueueItems(plan, SOURCE), [], 'no items for a plan that is no newer version');
  plan.carryForward = {
    carried: ['ppt/slides/slide1.xml.4', 'gone.1'],
    needsReview: ['ppt/slides/slide2.xml.5', 'ppt/slides/slide1.xml.7', 'gone.2'],
  };
  const items = lineageQueueItems(plan, SOURCE);
  const look = items.find((one) => one.id === ANOTHER_LOOK_ITEM_ID);
  const kept = items.find((one) => one.id === CARRIED_ITEM_ID);
  assert.ok(look && kept);
  // slide1.xml.7 is decided, so it no longer needs a look; an id the new version lacks is left out.
  assert.deepEqual(look.objectIds, ['ppt/slides/slide2.xml.5']);
  assert.equal(look.section, 'attention');
  assert.equal(look.title.text, '1 object changed in this version');
  assert.equal(look.evidence.text, 'The earlier decision did not carry over.');
  assert.deepEqual(kept.objectIds, ['ppt/slides/slide1.xml.4']);
  assert.equal(kept.title.text, 'Carried from the last version');
  assert.equal(kept.review, 'accepted');
  assert.equal(kept.section, 'settled', 'already answered, so never counted as something to review');
  assert.equal(kept.evidence.text, '1 decision from the last version still applies.');
  assert.deepEqual(kept.slideNumbers, [1]);

  const engineQueue = [
    { ...look, id: 'a', section: 'attention' as const },
    { ...kept, id: 'b', section: 'suggestions' as const },
    { ...kept, id: 'c', section: 'settled' as const },
  ];
  assert.deepEqual(queueWithLineage(engineQueue, plan, SOURCE).map((one) => one.id), [ANOTHER_LOOK_ITEM_ID, 'a', 'b', 'c', CARRIED_ITEM_ID]);
});

test('a newer version keeps the slides left out and the layouts chosen, on the slides that match', () => {
  const previous = planSample();
  const [one, two] = previous.slides;
  assert.ok(one && two);
  one.include = false;
  delete one.order;
  two.include = false;
  delete two.order;
  const next = planSample();
  next.source = { ...next.source, hash: 'sha256:newer' };
  // Only slide 1 has an object the engine matched across the versions.
  next.carryForward = { carried: ['ppt/slides/slide1.xml.4'], needsReview: [] };
  const info: Parameters<typeof carryIntoNewerVersion>[2] = { id: 'ds', name: 'Design system', neutralMaster: false, hasLogo: false, archetypes: ['title', 'visual', 'content'], colors: {}, fonts: [] };
  const out = carryIntoNewerVersion(next, previous, info);
  assert.equal(out.slides[0]?.include, false, 'the matched slide stays left out');
  assert.equal(out.slides[0]?.order, undefined);
  assert.equal(out.slides[1]?.include, true, 'a slide with no matched object takes nothing from the one with its id');
  assert.equal(out.slides[1]?.order, 1, 'and keeps the new version\'s order');
});

test('a plan made again over the same bytes keeps the carry-forward facts of the plan it replaces', () => {
  const base = planSample();
  delete base.carryForward;
  const again = { ...planSample(), carryForward: { carried: ['x'], needsReview: [] } };
  assert.equal(keepLineageFacts(again, base).carryForward, undefined, 'same bytes are no newer version');
  base.carryForward = { carried: ['y'], needsReview: ['z'] };
  assert.deepEqual(keepLineageFacts(again, base).carryForward, base.carryForward);
  const newer = { ...again, source: { ...again.source, hash: 'sha256:other' } };
  assert.equal(keepLineageFacts(newer, base), newer, 'a newer version keeps its own');
});

test('the nearest design system colour comes back with its token path', () => {
  assert.deepEqual(nearestSystemColour('#1a1a1a', { 'color.ink.default': '#11201C', 'color.surface.page': '#FFFFFF' }), { hex: '#11201C', path: 'color.ink.default' });
  assert.equal(nearestSystemColour('#1a1a1a', {}), null);
});

/** Presets a harness offers: Tidy from the pack, and a record of what was saved. */
function presetDeps(saved: Array<{ preset: RebrandPresetEntryV1['preset']; name: string }>): NonNullable<RebrandControllerDepsV1['presets']> {
  const tidy: RebrandPresetEntryV1 = {
    preset: { id: 'tidy', actions: { decoration: 'remove' }, review: { decoration: 'accepted' } },
    name: 'Tidy',
    origin: 'pack',
  };
  return {
    list: async () => [tidy, ...saved.map((one) => ({ preset: one.preset, name: one.name, origin: 'personal' as const }))],
    savePersonal: async (preset, name) => {
      saved.push({ preset, name });
      return { preset, name, origin: 'personal' };
    },
  };
}

test('applying a preset runs the first pass again as one step, and undo puts the whole plan back', async () => {
  const saved: Array<{ preset: RebrandPresetEntryV1['preset']; name: string }> = [];
  const h = harness({ presets: presetDeps(saved) });
  h.handlers['rebrand.plan'] = async (input: PlanStageInputV1) => {
    const plan = { ...planSample(), designSystem: await snapshotOf(input.system), shuffleSeed: input.seed ?? 0 };
    if (input.preset) plan.presetId = input.preset.id;
    else delete plan.presetId;
    return plan;
  };
  const { c } = await reviewing(h);
  assert.deepEqual((await c.presets?.())?.map((one) => one.name), ['Tidy']);
  const before = c.getState().plan;
  assert.ok(before);
  h.stages.length = 0;
  const applied = await c.applyPreset?.('tidy');
  assert.equal(applied?.ok, true, JSON.stringify(applied));
  const call = h.stages.find((one) => one.name === 'rebrand.plan');
  assert.ok(call);
  assert.equal((call.input as PlanStageInputV1).preset?.id, 'tidy');
  assert.deepEqual((call.input as PlanStageInputV1).previous, before, 'the plan in hand carries its decisions across');
  assert.equal(c.getState().plan?.presetId, 'tidy');
  assert.deepEqual(c.getState().history.undo, { kind: 'preset', count: 1 });
  assert.equal((await c.applyPreset?.('tidy'))?.refusal, 'nothing-to-do', 'the same preset twice is nothing to do');

  assert.equal((await c.undo()).ok, true);
  assert.equal(c.getState().plan?.presetId, before.presetId, 'undo restores the plan as it was');
  assert.deepEqual(c.getState().plan?.slides, before.slides);
  assert.equal((await c.redo()).ok, true);
  assert.equal(c.getState().plan?.presetId, 'tidy');
});

test('Save as my preset writes the person\'s consistent choices to the personal layer', async () => {
  const saved: Array<{ preset: RebrandPresetEntryV1['preset']; name: string }> = [];
  const h = harness({ presets: presetDeps(saved) });
  const { c } = await reviewing(h);
  await c.decide({ objectIds: ['ppt/slides/slide2.xml.5'], action: 'remove' });
  const outcome = await c.savePreset?.('My charts');
  assert.deepEqual(outcome, { ok: true, id: 'mine/my-charts' });
  assert.equal(saved[0]?.name, 'My charts');
  assert.equal(saved[0]?.preset.id, 'mine/my-charts');
  assert.equal(saved[0]?.preset.logo?.policy, c.getState().plan?.logo.policy);
  assert.deepEqual((await harness().deps.presets), undefined, 'a harness without presets offers none');
  const bare = createRebrandController(harness().deps);
  assert.deepEqual(await bare.presets?.(), []);
  assert.equal((await bare.savePreset?.('x'))?.refusal, 'no-plan');
});

test('the preset the intake chose is applied by the next read', async () => {
  const h = harness({ presets: presetDeps([]) });
  const c = createRebrandController(h.deps);
  c.choosePreset?.('tidy');
  assert.equal(c.getState().nextPresetId, 'tidy');
  await c.start(file());
  const call = h.stages.find((one) => one.name === 'rebrand.plan');
  assert.ok(call);
  assert.equal((call.input as PlanStageInputV1).preset?.id, 'tidy');
  c.choosePreset?.(null);
  assert.equal(c.getState().nextPresetId, undefined);
});

test('several decks are read one after another: the first opens for review, the rest are read into projects of their own', async () => {
  let reads = 0;
  let held = 0;
  let released = 0;
  const h = harness({
    holdOffers: () => {
      held += 1;
      return () => {
        released += 1;
      };
    },
    async ingest({ file, onProgress }) {
      reads += 1;
      onProgress(1, 1);
      const project = await h.store.create(
        { id: `deck-${reads}`, name: file.name.replace(/\.pptx$/, ''), source: { ...SOURCE.source, name: file.name }, designSystem: planSample().designSystem },
        { bytes: file },
      );
      return { project, source: structuredClone(SOURCE) };
    },
  });
  const c = createRebrandController(h.deps);
  const batches: Array<RebrandStateV1['batch']> = [];
  c.subscribe((state) => batches.push(state.batch));
  await c.startMany?.([file('one.pptx'), file('two.pptx'), file('three.pptx')]);

  const state = c.getState();
  // One job per deck, so the heavy slot is free between decks.
  assert.deepEqual(h.jobs.map((job) => job.title), [
    'Planning a renovation of one.pptx',
    'Reading two.pptx, deck 2 of 3',
    'Reading three.pptx, deck 3 of 3',
  ]);
  assert.equal(state.phase, 'review', 'the first deck is open for review');
  assert.equal(state.project?.id, 'deck-1');
  assert.deepEqual(state.batch?.map((one) => [one.name, one.state, one.projectId]), [
    ['one.pptx', 'ready', 'deck-1'],
    ['two.pptx', 'ready', 'deck-2'],
    ['three.pptx', 'ready', 'deck-3'],
  ]);
  assert.ok(batches.some((one) => one?.[1]?.state === 'reading'), 'each deck says when it is being read');
  for (const id of ['deck-2', 'deck-3']) {
    const stored = await h.store.get(id);
    assert.equal(stored?.checkpoint.stage, 'plan', `${id} is planned and waits for review`);
    assert.ok(h.store.parts.has(`${id}:census`) && h.store.parts.has(`${id}:plan`));
  }
  // The offer is held for the deck the person is watching only: a download asked for
  // there is not refused over a read in the background.
  assert.equal(held, 1, 'the model offer is held back while the open deck is read');
  assert.equal(released, 1);
  assert.equal(state.project?.id, 'deck-1', 'reading the others never replaced the open deck');
});

test('with one heavy slot, Open in Design on the first deck waits for one background deck at most', async () => {
  let reads = 0;
  const events: string[] = [];
  let letTwoFinish: () => void = () => {};
  const twoBlocked = new Promise<void>((resolve) => {
    letTwoFinish = resolve;
  });
  // The slot the web shell has: one heavy job at a time, first come first served.
  let slot: Promise<void> = Promise.resolve();
  const h = harness({
    async ingest({ file, onProgress }) {
      reads += 1;
      const n = reads;
      events.push(`read ${file.name}`);
      if (file.name === 'two.pptx') await twoBlocked;
      onProgress(1, 1);
      const project = await h.store.create(
        { id: `deck-${n}`, name: file.name.replace(/\.pptx$/, ''), source: { ...SOURCE.source, name: file.name }, designSystem: planSample().designSystem },
        { bytes: file },
      );
      return { project, source: structuredClone(SOURCE) };
    },
  });
  h.deps.runJob = async <T,>(opts: StartJobOpts, work: (handle: JobHandle) => Promise<T> | T): Promise<T | undefined> => {
    h.jobs.push(opts);
    const turn = slot;
    let free: () => void = () => {};
    slot = new Promise<void>((resolve) => {
      free = resolve;
    });
    await turn;
    try {
      return await work({ id: opts.title, started: Promise.resolve(), cancelled: false, progress() {}, finish() {}, fail() {}, settle() {} });
    } finally {
      free();
    }
  };
  const c = createRebrandController(h.deps);
  const all = c.startMany?.([file('one.pptx'), file('two.pptx'), file('three.pptx')]);
  await until(() => c.getState().phase === 'review' && events.includes('read two.pptx'), 'the first deck in review while the second is read');
  await c.acceptSuggestions();
  await previewSettled(c);
  const importer = h.deps.design.importer;
  h.deps.design.importer = (frames, opts) => {
    events.push('opened');
    return importer(frames, opts);
  };
  const opening = c.openInDesign();
  await until(() => h.jobs.some((job) => job.title.endsWith('in Design')), 'Open in Design waiting for the slot');
  letTwoFinish();
  const opened = await opening;
  await all;
  assert.equal(opened.ok, true, JSON.stringify(opened));
  assert.ok(events.indexOf('opened') < events.indexOf('read three.pptx'), `Open in Design took the slot before the third deck: ${events.join(', ')}`);
});

test('Cancel on the open deck stops its step, not the other decks of the read', async () => {
  let reads = 0;
  const h = harness({
    async ingest({ file, signal, onProgress }) {
      reads += 1;
      const n = reads;
      if (file.name === 'one.pptx') {
        await new Promise<void>((resolve) => {
          if (signal?.aborted) resolve();
          else signal?.addEventListener('abort', () => resolve(), { once: true });
        });
        throw Object.assign(new Error('stopped'), { name: 'AbortError' });
      }
      onProgress(1, 1);
      const project = await h.store.create(
        { id: `deck-${n}`, name: file.name, source: { ...SOURCE.source, name: file.name }, designSystem: planSample().designSystem },
        { bytes: file },
      );
      return { project, source: structuredClone(SOURCE) };
    },
  });
  const c = createRebrandController(h.deps);
  const all = c.startMany?.([file('one.pptx'), file('two.pptx')]);
  await until(() => c.getState().batch?.[0]?.state === 'reading', 'the first deck being read');
  c.cancel();
  await all;
  assert.deepEqual(c.getState().batch?.map((one) => one.state), ['failed', 'ready'], 'the second deck is still read');
});

test('one deck through startMany is a plain start, and a failed deck is named without stopping the rest', async () => {
  let reads = 0;
  const h = harness({
    async ingest({ file }) {
      reads += 1;
      if (file.name === 'broken.pptx') throw Object.assign(new Error('not a deck'), { code: 'source.unreadable' });
      const project = await h.store.create(
        { id: `deck-${reads}`, name: file.name, source: { ...SOURCE.source, name: file.name }, designSystem: planSample().designSystem },
        { bytes: file },
      );
      return { project, source: structuredClone(SOURCE) };
    },
  });
  const c = createRebrandController(h.deps);
  await c.startMany?.([file('solo.pptx')]);
  assert.equal(c.getState().phase, 'review');
  assert.equal(c.getState().batch, undefined, 'one deck makes no batch');

  await c.startMany?.([file('first.pptx'), file('broken.pptx'), file('last.pptx')]);
  const rows = c.getState().batch ?? [];
  assert.deepEqual(rows.map((one) => one.state), ['ready', 'failed', 'ready']);
  assert.equal(rows[1]?.error, 'source.unreadable');
});

// ─── plan 275: the filmstrip commands, the quick preview and picture decks ───

test('a new layout shows its slide at once, before the whole deck compiles again', async () => {
  const h = harness();
  const { c } = await reviewing(h);
  await previewSettled(c);
  const slideId = 'ppt/slides/slide1.xml';
  const compiles: CompileStageInputV1[] = [];
  let releaseWhole: () => void = () => {};
  h.handlers['rebrand.compile'] = (input) => {
    const one = input as CompileStageInputV1;
    compiles.push(one);
    const deck = deckDrawing('user/media/proposed-photo', one.plan.revision);
    if (one.plan.slides.length === 1) {
      deck.frames = deck.frames.filter((frame) => frame.sourceSlideId === slideId).map((frame) => ({ ...frame, archetype: 'content', name: 'Drawn alone' }));
      return deck;
    }
    return new Promise<CompiledDeckV1>((resolve) => { releaseWhole = () => resolve(deck); });
  };
  const outcome = await c.setLayout([slideId], 'content');
  assert.equal(outcome.ok, true);
  await until(() => c.getState().preview?.planRevision === c.getState().plan?.revision, 'the changed slide in the pane');
  const state = c.getState();
  assert.deepEqual(compiles[0]?.plan.slides.map((slide) => slide.id), [slideId], 'the changed slide compiles first, alone');
  assert.equal(state.previewStale, true, 'the pane still says Updating until the whole deck is compiled');
  assert.equal(state.preview?.deck.frames.find((frame) => frame.sourceSlideId === slideId)?.name, 'Drawn alone');
  assert.equal(state.preview?.deck.frames.filter((frame) => frame.sourceSlideId !== slideId).length, 2, 'the other slides keep their frames');
  await until(() => compiles.length === 2, 'the whole deck compiling behind it');
  releaseWhole();
  await previewSettled(c);
  assert.equal(c.getState().previewStale, false);
});

test('an arrangement is one labelled step that keeps the layout, and undo takes it back', async () => {
  const { c } = await reviewing();
  const slideId = 'ppt/slides/slide1.xml';
  const layout = c.getState().plan?.slides.find((slide) => slide.id === slideId)?.layout;
  assert.ok(c.setArrangement, 'the controller carries arrangements out');
  assert.equal((await c.setArrangement([slideId], 'picture')).ok, true);
  assert.deepEqual(c.getState().history.undo, { kind: 'arrangement', count: 1 });
  const kept = c.getState().plan?.slides.find((slide) => slide.id === slideId);
  assert.equal(kept?.arrangement, 'picture');
  assert.equal(kept?.layout, layout, 'the layout stays on the row');
  assert.equal((await c.setArrangement([slideId], 'picture')).refusal, 'nothing-to-do', 'the same arrangement again changes nothing');
  assert.equal((await c.undo()).ok, true);
  assert.equal(c.getState().plan?.slides.find((slide) => slide.id === slideId)?.arrangement, undefined, 'undo takes it back');
});

test('the splice replaces one slide\'s frames, tray rows and links, and keeps the rest', () => {
  const held = structuredClone(COMPILED);
  const quick = structuredClone(COMPILED);
  quick.frames = [{ ...quick.frames[0]!, name: 'new', layers: [{ id: 'frame-1/body', kind: 'text' }] }];
  quick.tray = [];
  quick.lineage = { forward: [{ sourceObjectId: 'ppt/slides/slide1.xml.7', layerIds: ['frame-1/body'] }], backward: [{ layerId: 'frame-1/body', sourceObjectIds: ['ppt/slides/slide1.xml.7'] }] };
  const objects = new Set(SOURCE.slides[0]!.objects.map((object) => object.id));
  const out = splicePreviewDeck(held, quick, new Set(['ppt/slides/slide1.xml']), objects, 9);
  assert.equal(out.planRevision, 9);
  assert.deepEqual(out.frames.map((frame) => frame.id), ['frame-1', 'frame-2', 'frame-3']);
  assert.equal(out.frames[0]?.name, 'new');
  assert.equal(out.tray.length, 0, 'the partner mark left the tray for the new frame');
  assert.ok(out.lineage.forward.some((entry) => entry.sourceObjectId === 'ppt/slides/slide1.xml.7' && entry.layerIds[0] === 'frame-1/body'));
  assert.ok(!out.lineage.backward.some((entry) => entry.layerId === 'frame-1/title'), 'the old frame\'s links go');
  assert.ok(out.lineage.backward.some((entry) => entry.layerId === 'frame-2/placeholder-1'), 'another slide\'s links stay');
  assert.deepEqual(held, COMPILED, 'the held deck is not changed');
});

test('moveTo and moveSlides move a block as one undoable step', async () => {
  const { c } = await reviewing();
  const orders = c.getState().plan?.slides.map((slide) => slide.order);
  const order = (): string[] => {
    const plan = c.getState().plan;
    return [...(plan?.slides ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((slide) => slide.id);
  };
  const first = await c.moveTo?.(['ppt/slides/slide2.xml'], 'start');
  assert.equal(first?.ok, true);
  assert.deepEqual(order(), ['ppt/slides/slide2.xml', 'ppt/slides/slide1.xml']);
  assert.deepEqual(c.getState().history.undo, { kind: 'move', count: 1 });
  await c.undo();
  assert.deepEqual(c.getState().plan?.slides.map((slide) => slide.order), orders, 'undo puts the order back as it was');
  const block = await c.moveSlides?.(['ppt/slides/slide1.xml'], 1);
  assert.equal(block?.ok, true);
  assert.deepEqual(order(), ['ppt/slides/slide2.xml', 'ppt/slides/slide1.xml']);
  const again = await c.moveSlides?.(['ppt/slides/slide1.xml'], 1);
  assert.equal(again?.refusal, 'nothing-to-do', 'a move that changes nothing adds no step');
});

test('a corrected text is one undoable edit, and null gives the reading back', async () => {
  const { c } = await reviewing();
  const id = 'ppt/slides/slide1.xml.4';
  const outcome = await c.setObjectText?.(id, 'Quarterly review\r\n2026');
  assert.equal(outcome?.ok, true);
  assert.equal(row(c.getState(), id)?.textOverride, 'Quarterly review\n2026');
  assert.deepEqual(c.getState().history.undo, { kind: 'text', count: 1 });
  assert.equal(c.getState().previewStale, true, 'the pane compiles again');
  await c.undo();
  assert.equal(row(c.getState(), id)?.textOverride, undefined, 'one undo gives the reading back');
  await c.redo();
  assert.equal(row(c.getState(), id)?.textOverride, 'Quarterly review\n2026');
  assert.equal((await c.setObjectText?.(id, null))?.ok, true);
  assert.equal(row(c.getState(), id)?.textOverride, undefined);
});

test('Undo my changes runs the first pass alone and puts the slide back to it, as one step', async () => {
  const h = harness();
  const { c } = await reviewing(h);
  const plans: PlanStageInputV1[] = [];
  const base = h.handlers['rebrand.plan'];
  h.handlers['rebrand.plan'] = async (input: PlanStageInputV1, call: StageCall) => {
    plans.push(input);
    const plan = (await base?.(input, call)) as RenovationPlanV1;
    // The first pass proposes Content for slide 2; the stored plan holds a person's Visual.
    return { ...plan, slides: plan.slides.map((slide) => (slide.id === 'ppt/slides/slide2.xml' ? { ...slide, layout: 'content', layoutSource: 'proposed' as const } : slide)) };
  };
  const slideId = 'ppt/slides/slide2.xml';
  const decided = await c.decide({ objectIds: ['ppt/slides/slide2.xml.5'], action: 'remove' });
  assert.equal(decided.ok, true);
  const outcome = await c.resetSlide?.([slideId]);
  assert.equal(outcome?.ok, true, `refused: ${outcome?.refusal ?? ''}`);
  assert.deepEqual(c.getState().history.undo, { kind: 'reset', count: 1 }, 'the Undo button names a reset');
  assert.equal(plans.length, 1);
  assert.equal(plans[0]?.previous, undefined, 'the proposal comes from a first pass with no earlier plan');
  const slide = c.getState().plan?.slides.find((one) => one.id === slideId);
  assert.equal(slide?.layout, 'content');
  assert.equal(slide?.layoutSource, 'proposed');
  assert.equal(row(c.getState(), 'ppt/slides/slide2.xml.5')?.decision, undefined, 'the decision goes');
  await c.undo();
  const back = c.getState().plan?.slides.find((one) => one.id === slideId);
  assert.equal(back?.layout, 'visual', 'one undo gives the layout back');
  assert.equal(row(c.getState(), 'ppt/slides/slide2.xml.5')?.decision, 'remove', 'and the decision');
});

test('Open this slide in Design hands the import the slide\'s own frame to open on', async () => {
  let seen: { frames: Array<{ id: string; focus?: boolean }>; focusFrameId?: string } | null = null;
  const h = harness({
    design: {
      navigate: () => ({ id: 'session/design/1' }),
      importer: (frames, opts) => {
        seen = { frames, ...(opts.focusFrameId ? { focusFrameId: opts.focusFrameId } : {}) };
        return { landed: frames.length, keptIds: true };
      },
    },
  });
  const { c } = await reviewing(h);
  await c.acceptSuggestions();
  await previewSettled(c);
  const opened = await c.openInDesign({ focusSlideId: 'ppt/slides/slide2.xml' });
  assert.equal(opened.ok, true, `refused: ${opened.reason ?? ''}`);
  const got = seen as { frames: Array<{ id: string; focus?: boolean }>; focusFrameId?: string } | null;
  assert.equal(got?.focusFrameId, 'frame-2', 'the slide\'s own frame, not its continuation');
  assert.deepEqual(got?.frames.filter((frame) => frame.focus).map((frame) => frame.id), ['frame-2'], 'the page carries it too');
});

test('the picture a rebuilt slide came from loads with the rest of the media', async () => {
  const rebuilt = structuredClone(SOURCE);
  rebuilt.slides[0]!.recovery = { assetRef: 'user/media/slide-1-picture' };
  assert.deepEqual(recoveryRefs(rebuilt), ['user/media/slide-1-picture']);
  const h = harness({
    async ingest({ file: picked }) {
      const project = await h.store.create(
        { id: 'proj-1', name: 'Quarterly review', source: { ...SOURCE.source, name: picked.name }, designSystem: planSample().designSystem },
        { bytes: picked },
      );
      return { project, source: structuredClone(rebuilt) };
    },
  });
  const { c } = await reviewing(h);
  await until(() => c.mediaHref('user/media/slide-1-picture') !== undefined, 'the recovery picture');
  assert.ok(h.mediaAsked.includes('user/media/slide-1-picture'));
});

/** A deck whose every slide is one stored picture of the whole slide. */
function pictureDeck(): SourceDeckV1 {
  const deck = structuredClone(SOURCE);
  deck.slides = deck.slides.map((slide, i) => ({
    ...slide,
    origin: { ...slide.origin, flattened: true },
    objects: [{
      id: `${slide.id}.picture`,
      fingerprint: `media:slide-${i}`,
      kind: 'pic' as const,
      box: { x: 0, y: 0, w: slide.width, h: slide.height, rot: 0 },
      origin: 'slide' as const,
      fidelity: { state: 'raster-preserved' as const },
      media: `user/media/slide-${i}`,
      mediaMime: 'image/png',
    }],
  }));
  return deck;
}

test('a deck that is mostly pictures starts reading them as it opens when the model is on the device, and a stored project never does', async () => {
  // Without the model nothing opens on arrival: the notice band's Read the text carries
  // the offer (close-out section 2.5).
  let offered = 0;
  const missing = harness({
    async ingest({ file: picked }) {
      const project = await missing.store.create(
        { id: 'proj-0', name: 'Pictures', source: { ...SOURCE.source, name: picked.name }, designSystem: planSample().designSystem },
        { bytes: picked },
      );
      return { project, source: pictureDeck() };
    },
    readiness: async () => [{ id: 'ocr', state: 'downloadable', message: '', actions: ['download'] }],
    async ensureTextReading() {
      offered += 1;
      return false;
    },
    async rebuildSlidePictures() {
      throw new Error('never reached');
    },
  });
  await reviewing(missing);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(offered, 0, 'no model offer on arrival');

  let asked = 0;
  const h = harness({
    readiness: async () => [{ id: 'ocr', state: 'ready', message: '', actions: [] }],
    async ingest({ file: picked }) {
      const project = await h.store.create(
        { id: 'proj-1', name: 'Pictures', source: { ...SOURCE.source, name: picked.name }, designSystem: planSample().designSystem },
        { bytes: picked },
      );
      return { project, source: pictureDeck() };
    },
    async ensureTextReading() {
      asked += 1;
      return false;
    },
    async rebuildSlidePictures() {
      throw new Error('declined, so never reached');
    },
  });
  const { c } = await reviewing(h);
  await until(() => asked === 1, 'the reading starts, in answer to the drop');
  assert.equal(c.getState().phase, 'review', 'the review is open while the offer is');
  const reopened = createRebrandController(h.deps);
  await reopened.open('proj-1');
  assert.equal(reopened.getState().phase, 'review');
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(asked, 1, 'opening a stored project offers nothing');

  // A deck with its text in place is not offered anything.
  let editableAsked = 0;
  const plain = harness({ async ensureTextReading() { editableAsked += 1; return false; }, async rebuildSlidePictures() { throw new Error('never'); } });
  await reviewing(plain);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(editableAsked, 0);
});

test('Auto-match sets every matched slide as one undoable step, and never a layout the person chose', async () => {
  const pipeline = await import('../../../../../tests/helpers/rebrand-pipeline.ts');
  const { readFileSync } = await import('node:fs');
  const bytes = new Uint8Array(readFileSync(new URL('../../../../../tests/fixtures/rebrand/structures.pptx', import.meta.url)));
  const run = await pipeline.runRebrandPipeline('structures.pptx', bytes);
  const designSystem = pipeline.STARTER_DESIGN_SYSTEM;
  const algorithms = { reader: 'pptx-read/test', census: run.census.rules.version, plan: PLAN_RULES.version };
  const h = harness({
    resolveDesignSystem: async () => ({ input: designSystem.input, info: { ...SYSTEM.info, id: designSystem.input.id } }),
    async ingest() {
      const project = await h.store.create({ id: 'structures', name: 'Structures', source: { ...run.deck.source }, designSystem: designSystem.snapshot });
      return { project, source: structuredClone(run.deck) };
    },
  });
  h.handlers['rebrand.census'] = (input: { source: SourceDeckV1 }) => censusDeck(input.source);
  // The first pass already sets every clear read; a plan whose layouts are all the
  // plainest is one Auto-match has work on (a slide already on its layout is passed by).
  h.handlers['rebrand.plan'] = (input: PlanStageInputV1) => {
    const planned = firstPass({ source: input.source, census: input.census, designSystem: designSystem.firstPass, algorithms });
    return { ...planned, slides: planned.slides.map((slide) => ({ ...slide, layout: 'content' })) };
  };
  h.handlers['rebrand.faithful'] = (input: { source: SourceDeckV1 }) => compileFaithful(input.source);
  h.handlers['rebrand.compile'] = (input: CompileStageInputV1) => compileRenovated({
    source: input.source,
    ...(input.census ? { census: input.census } : {}),
    plan: input.plan,
    master: pipeline.STARTER_MASTER,
    designSystem: designSystem.compile,
    opts: { applyUnreviewed: input.applyUnreviewed, applyNeedsAttention: input.applyNeedsAttention },
  });
  const c = createRebrandController(h.deps);
  await c.start(file('structures.pptx'));
  assert.equal(c.getState().phase, 'review', JSON.stringify(c.getState().error));
  const before = c.getState().plan;
  assert.ok(before);
  const matched = before.slides.filter((slide) => slide.layoutMatch && slide.layoutMatch.band !== 'none');
  assert.equal(matched.length, 8, 'every slide of the structures fixture carries a clear or likely read');

  // A person chose the last slide's layout: Auto-match passes it by.
  const last = before.slides.at(-1)!.id;
  assert.equal((await c.setLayout([last], 'content')).ok, true);
  const outcome = await c.autoMatchLayouts?.('likely');
  assert.equal(outcome?.ok, true);
  assert.equal(outcome?.touched, 7, 'the seven slides a person did not set');
  assert.deepEqual(c.getState().history.undo, { kind: 'auto-match', count: 7 }, 'one step');
  const after = c.getState().plan!;
  assert.deepEqual(after.slides.filter((slide) => slide.layoutSource === 'auto').map((slide) => slide.id), before.slides.slice(0, 7).map((slide) => slide.id));
  const kept = after.slides.find((slide) => slide.id === last);
  assert.deepEqual([kept?.layout, kept?.layoutSource], ['content', 'user'], 'the person\'s choice stands');
  assert.equal((await c.autoMatchLayouts?.('likely'))?.refusal, 'nothing-to-do', 'a second run has nothing to set');

  await c.undo();
  const undone = c.getState().plan!;
  assert.deepEqual(undone.slides.slice(0, 7).map((slide) => slide.layoutSource), Array(7).fill('proposed'), 'one undo puts every slide back');
  assert.equal(undone.slides.find((slide) => slide.id === last)?.layoutSource, 'user');
});

test('Auto-match passes by a slide kept as it was, and leaves the layout it goes back to alone', async () => {
  const pipeline = await import('../../../../../tests/helpers/rebrand-pipeline.ts');
  const { readFileSync } = await import('node:fs');
  const bytes = new Uint8Array(readFileSync(new URL('../../../../../tests/fixtures/rebrand/structures.pptx', import.meta.url)));
  const run = await pipeline.runRebrandPipeline('structures.pptx', bytes);
  const designSystem = pipeline.STARTER_DESIGN_SYSTEM;
  const algorithms = { reader: 'pptx-read/test', census: run.census.rules.version, plan: PLAN_RULES.version };
  const h = harness({
    resolveDesignSystem: async () => ({ input: designSystem.input, info: { ...SYSTEM.info, id: designSystem.input.id } }),
    async ingest() {
      const project = await h.store.create({ id: 'structures', name: 'Structures', source: { ...run.deck.source }, designSystem: designSystem.snapshot });
      return { project, source: structuredClone(run.deck) };
    },
  });
  h.handlers['rebrand.census'] = (input: { source: SourceDeckV1 }) => censusDeck(input.source);
  // Every slide starts on Title and body, so each matched read has a layout to set.
  h.handlers['rebrand.plan'] = (input: PlanStageInputV1) => {
    const plan = firstPass({ source: input.source, census: input.census, designSystem: designSystem.firstPass, algorithms });
    return { ...plan, slides: plan.slides.map((slide) => ({ ...slide, layout: 'content', layoutSource: 'proposed' as const })) };
  };
  h.handlers['rebrand.faithful'] = (input: { source: SourceDeckV1 }) => compileFaithful(input.source);
  h.handlers['rebrand.compile'] = (input: CompileStageInputV1) => compileRenovated({
    source: input.source,
    ...(input.census ? { census: input.census } : {}),
    plan: input.plan,
    master: pipeline.STARTER_MASTER,
    designSystem: designSystem.compile,
    opts: { applyUnreviewed: input.applyUnreviewed, applyNeedsAttention: input.applyNeedsAttention },
  });
  const c = createRebrandController(h.deps);
  await c.start(file('structures.pptx'));
  assert.equal(c.getState().phase, 'review', JSON.stringify(c.getState().error));
  // A slide Auto-match would set: read with a structure other than the layout it starts on.
  const first = c.getState().plan!.slides.find((slide) => slide.layoutMatch && slide.layoutMatch.band !== 'none' && slide.layoutMatch.structure !== 'content');
  assert.ok(first, 'the fixture has a slide to match');
  assert.ok(c.setArrangement);
  assert.equal((await c.setArrangement([first.id], 'picture')).ok, true);
  const outcome = await c.autoMatchLayouts?.('likely');
  assert.equal(outcome?.ok, true, JSON.stringify(outcome));
  const set = c.getState().plan!.slides.filter((slide) => slide.layoutSource === 'auto').map((slide) => slide.id);
  assert.ok(set.length > 0, 'the other slides are matched');
  assert.equal(outcome?.touched, set.length, 'the count said is the slides set');
  assert.equal(set.includes(first.id), false, 'the slide kept as it was is not counted');
  const kept = c.getState().plan!.slides.find((slide) => slide.id === first.id);
  assert.deepEqual([kept?.arrangement, kept?.layout, kept?.layoutSource], ['picture', first.layout, first.layoutSource], 'its layout stays as the person left it');
});

// ─── close-out CP11: the read job, the faces, the thumbnail, the handoff ─────

test('the reading line names the slide in hand, never slide 0 and never past the last', () => {
  assert.equal(readingSentence(0, 12), 'Reading slide 1 of 12');
  assert.equal(readingSentence(3, 15), 'Reading slide 4 of 15');
  assert.equal(readingSentence(15, 15), 'Reading slide 15 of 15');
  assert.equal(readingSentence(40, 15), 'Reading slide 15 of 15');
});

test('the read job stays quiet while the view shows the reading, says the slide in hand, and hands back a dismiss', async () => {
  const h = harness();
  const notes: string[] = [];
  let dismissed = 0;
  h.deps.runJob = async <T,>(opts: RebrandJobOptsV1, work: (handle: RebrandJobHandleV1) => Promise<T> | T): Promise<T | undefined> => {
    h.jobs.push(opts);
    return await work({
      id: 'job-quiet',
      started: Promise.resolve(),
      cancelled: false,
      progress: (_done, _total, note) => {
        if (note) notes.push(note);
      },
      finish: () => {},
      fail: () => {},
      settle: () => {},
      dismiss: () => {
        dismissed += 1;
      },
    });
  };
  const c = createRebrandController(h.deps);
  let intakeShown = true;
  c.quietJobsWhile?.(() => intakeShown);
  await c.start(file());
  assert.equal(c.getState().phase, 'review');

  const opts = h.jobs[0] as RebrandJobOptsV1;
  assert.ok(opts.quietWhile, 'the read job asks the view whether it shows the reading');
  assert.equal(opts.quietWhile(), true);
  intakeShown = false;
  assert.equal(opts.quietWhile(), false, 'the toast shows once the person leaves the reading');
  c.quietJobsWhile?.(() => {
    throw new Error('the view is gone');
  });
  assert.equal(opts.quietWhile(), false, 'a view that cannot answer is not showing the reading');
  c.quietJobsWhile?.(null);
  assert.equal(opts.quietWhile(), false);

  // The ingest reports one of two slides, then two of two: the toast says the slide in hand.
  assert.deepEqual(notes, ['Reading slide 2 of 2', 'Reading slide 2 of 2']);
  const finished = c.getState().finishedJob;
  assert.ok(finished, 'the finished read job is on the state for the view to take down');
  finished.dismiss();
  assert.equal(dismissed, 1);

  // A job the registry answers without a dismiss puts nothing on the state.
  const plain = harness();
  const d = createRebrandController(plain.deps);
  await d.start(file());
  assert.equal(d.getState().finishedJob, undefined);
});

test('the design system\'s faces load before the first proposed drawing, once per tab', async () => {
  const asked: string[][] = [];
  let release: () => void = () => {};
  const withFaces: RebrandResolvedSystemV1 = { ...SYSTEM, input: { ...SYSTEM.input, fonts: { brand: 'SUSE', mono: 'SUSE Mono' } } };
  const h = harness({
    resolveDesignSystem: async () => withFaces,
    loadFaces: (families) => {
      asked.push(families);
      return new Promise<void>((resolve) => {
        release = resolve;
      });
    },
  });
  const c = createRebrandController(h.deps);
  const seen: RebrandStateV1[] = [];
  c.subscribe((state) => seen.push(state));
  await c.start(file());
  assert.deepEqual(asked, [['SUSE', 'SUSE Mono']]);
  assert.deepEqual(c.getState().designSystem?.faces, { brand: 'SUSE', mono: 'SUSE Mono' });
  assert.equal(c.getState().fontsReady, false, 'the preview is held until the faces are in');
  assert.ok(seen.every((state) => state.preview === null || state.fontsReady === false), 'no preview state ever said the faces were ready early');
  release();
  await until(() => c.getState().fontsReady === true, 'the faces to be ready');

  // A second deck in the same tab does not wait for faces it already has.
  await c.start(file());
  assert.equal(asked.length, 1);
  assert.equal(c.getState().fontsReady, true);

  // A design system that names no face waits for nothing.
  const bare = harness({ loadFaces: async () => assert.fail('nothing to load') });
  const d = createRebrandController(bare.deps);
  await d.start(file());
  assert.equal(d.getState().fontsReady, true);
  assert.equal(d.getState().designSystem?.faces, undefined);
});

test('the first proposed slide is stored small on the project once, and the lists carry it', async () => {
  const h = harness();
  const c = createRebrandController(h.deps);
  await c.start(file());
  const stored = await h.store.get('proj-1');
  const thumb = stored?.thumbSvg ?? '';
  assert.match(thumb, new RegExp(`^<svg [^>]*width="${PROJECT_THUMB_EDGE}"`));
  assert.ok(new TextEncoder().encode(thumb).byteLength <= 16 * 1024);
  assert.equal(thumb.includes('blob:'), false, 'a drawable URL does not outlive the tab, so no picture is drawn from one');
  assert.equal(thumb.includes('<pattern'), false, 'the thumbnail rung');
  assert.deepEqual(c.getState().save, { kind: 'saved', revision: stored?.revision }, 'the save state follows the write');
  assert.equal(c.getState().project?.thumbSvg, thumb);
  const [summary] = await c.recent();
  assert.equal(summary?.thumbSvg, thumb);

  // Opening the project again keeps the thumbnail it has.
  const updates = h.store.writes.filter((one) => one === 'update').length;
  await c.open('proj-1');
  assert.equal(c.getState().phase, 'review');
  assert.equal(h.store.writes.filter((one) => one === 'update').length, updates);
});

test('a thumbnail over 16 KB is not drawn for the lists', () => {
  const deck = structuredClone(COMPILED);
  const frame = deck.frames[0];
  assert.ok(frame);
  frame.layers.push({ id: 'huge', kind: 'text', x: 0, y: 0, w: 1280, h: 720, text: 'word '.repeat(5000), frame: frame.id });
  assert.equal(projectThumbnail(deck, SYSTEM), null);
  assert.match(projectThumbnail(COMPILED, SYSTEM) ?? '', /^<svg /);
});

test('the quick preview numbers a slide with its place in the whole deck', () => {
  const held = structuredClone(COMPILED);
  const second = held.frames[1];
  assert.ok(second);
  const quick = structuredClone(COMPILED);
  quick.frames = [{
    ...second,
    layers: [
      ...second.layers,
      { id: `${second.id}.pn`, kind: 'text', furniture: 'page-no', text: '1', frame: second.id },
      { id: `${second.id}.ft`, kind: 'text', furniture: 'footer', text: '1', frame: second.id },
    ],
  }];
  const out = splicePreviewDeck(held, quick, new Set([second.sourceSlideId]), new Set(), 9, new Set(['page-no']));
  const frame = out.frames[1];
  assert.equal(frame?.layers.find((row) => row.id === `${second.id}.pn`)?.text, '2', 'the second slide reads 2, not 1');
  assert.equal(frame?.layers.find((row) => row.id === `${second.id}.ft`)?.text, '1', 'a footer that reads 1 is left as written');
  // Without the master's page-number furniture nothing is renumbered.
  const plain = splicePreviewDeck(held, quick, new Set([second.sourceSlideId]), new Set(), 9);
  assert.equal(plain.frames[1]?.layers.find((row) => row.id === `${second.id}.pn`)?.text, '1');
});

test('a document over Design\'s history budget is kept as a .lolly file before it opens, and the outcome says so', async () => {
  const kept: RebrandDownloadV1[] = [];
  const h = harness({
    saveProjectFile: async (download) => {
      kept.push(download);
      return { name: download.filename };
    },
  });
  const base = h.handlers['rebrand.compile'];
  h.handlers['rebrand.compile'] = async (input: CompileStageInputV1, call: StageCall) => {
    const deck = (await base?.(input, call)) as CompiledDeckV1;
    // The compile for Design only: pages that stay past 4 MiB once deflated.
    if (!input.applyUnreviewed) deck.frames[0]?.layers.push({ id: 'drawn', kind: 'text', x: 0, y: 0, w: 10, h: 10, text: noise(6 * 1024 * 1024) });
    return deck;
  };
  const { c } = await reviewing(h);
  await c.acceptSuggestions();
  await previewSettled(c);
  const opened = await c.openInDesign();
  assert.equal(opened.ok, true, JSON.stringify({ ...opened, warnings: undefined }));
  assert.equal(opened.savedAs, 'Quarterly review.lolly');
  assert.equal(kept.length, 1);
  const parts = h.packed[h.packed.length - 1];
  assert.ok(parts?.compiled?.frames[0]?.layers.some((row) => row.id === 'drawn'), 'the file carries the compile that opened');

  // A deck within the budget keeps nothing and says nothing.
  const small = harness({ saveProjectFile: async () => assert.fail('nothing to keep') });
  const { c: d } = await reviewing(small);
  await d.acceptSuggestions();
  await previewSettled(d);
  const plain = await d.openInDesign();
  assert.equal(plain.ok, true);
  assert.equal(plain.savedAs, undefined);

  // Pages past 4 MiB as JSON that deflate well within it (a deck of many drawings)
  // keep Design's history now its checkpoints are stored compressed: nothing is kept.
  const roomy = harness({ saveProjectFile: async () => assert.fail('history keeps this document') });
  const roomyBase = roomy.handlers['rebrand.compile'];
  roomy.handlers['rebrand.compile'] = async (input: CompileStageInputV1, call: StageCall) => {
    const deck = (await roomyBase?.(input, call)) as CompiledDeckV1;
    if (!input.applyUnreviewed) deck.frames[0]?.layers.push({ id: 'drawn', kind: 'text', x: 0, y: 0, w: 10, h: 10, text: 'M0 0L10 10Z'.repeat(600_000) });
    return deck;
  };
  const { c: e } = await reviewing(roomy);
  await e.acceptSuggestions();
  await previewSettled(e);
  const compressed = await e.openInDesign();
  assert.equal(compressed.ok, true);
  assert.equal(compressed.savedAs, undefined);
});

/** Text that deflates poorly: a fixed pseudo-random run of printable ASCII, no quote or backslash. */
function noise(length: number): string {
  const out = new Uint8Array(length);
  let seed = 0x2f6b1d;
  for (let i = 0; i < length; i += 1) {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    out[i] = 40 + ((seed >>> 16) % 52);
  }
  return new TextDecoder().decode(out);
}

test('overDesignHistory measures the pages deflated, and pages that fit as JSON are not compressed', async () => {
  const deck = structuredClone(COMPILED);
  assert.equal(await overDesignHistory(deck), false);
  deck.frames[0]?.layers.push({ id: 'big', kind: 'text', x: 0, y: 0, w: 10, h: 10, text: 'ab'.repeat(3 * 1024 * 1024) });
  assert.equal(await overDesignHistory(deck), false, 'six MiB of JSON that deflates small keeps history');
  deck.frames[0]?.layers.push({ id: 'noise', kind: 'text', x: 0, y: 0, w: 10, h: 10, text: noise(6 * 1024 * 1024) });
  assert.equal(await overDesignHistory(deck), true, 'pages that stay past 4 MiB deflated do not');
});

// ─── close-out CP12: the deck theme and a slide's background ─────────────────

test('the deck theme and a slide background are each one undoable step, and the preview draws them', async () => {
  const pipeline = await import('../../../../../tests/helpers/rebrand-pipeline.ts');
  const fixtures = await import('../../../../../tests/helpers/rebrand-fixtures.ts');
  const { buildDeckTheme } = await import('@lolly/engine');
  const { compileStage, planStage } = await import('./stage-rebrand.ts');
  const { decodeBudgetFor } = await import('./budget.ts');
  const run = await pipeline.runRebrandPipeline('simple.pptx', fixtures.readFixture('simple.pptx'));
  const designSystem = pipeline.STARTER_DESIGN_SYSTEM;
  assert.ok(designSystem.input.darkColors, 'the starter pack states a dark mode');
  const stageCtx = { budget: decodeBudgetFor('laptop'), cancelled: false, throwIfCancelled(): void {}, progress(): void {} };

  const h = harness({
    resolveDesignSystem: async () => ({ input: designSystem.input, info: { ...SYSTEM.info, id: designSystem.input.id } }),
    async ingest() {
      const project = await h.store.create({ id: 'themed', name: 'Themed', source: { ...run.deck.source }, designSystem: designSystem.snapshot });
      return { project, source: structuredClone(run.deck) };
    },
  });
  h.handlers['rebrand.census'] = (input: { source: SourceDeckV1 }) => censusDeck(input.source);
  h.handlers['rebrand.plan'] = (input: PlanStageInputV1) => planStage(input, stageCtx);
  h.handlers['rebrand.faithful'] = (input: { source: SourceDeckV1 }) => compileFaithful(input.source);
  h.handlers['rebrand.compile'] = (input: CompileStageInputV1) => compileStage(input, stageCtx);

  const c = createRebrandController(h.deps);
  await c.start(file('simple.pptx'));
  assert.equal(c.getState().phase, 'review', JSON.stringify(c.getState().error));
  await previewSettled(c);
  const before = structuredClone(c.getState().plan);
  assert.ok(before);
  const lightGround = String(c.getState().preview?.deck.frames.find((frame) => !frame.continuation && frame.archetype === 'content')?.layers[0]?.bg ?? '');

  const dark = buildDeckTheme('dark', { colors: designSystem.input.colors, darkColors: designSystem.input.darkColors, master: designSystem.input.master })?.theme;
  assert.ok(dark);
  assert.ok(c.setTheme && c.setGround, 'the controller carries both commands');
  const applied = await c.setTheme(dark);
  assert.equal(applied.ok, true, JSON.stringify(applied));
  assert.deepEqual(c.getState().history.undo, { kind: 'theme', count: 1 });
  assert.deepEqual(c.getState().plan?.designSystem.theme, dark);
  assert.equal((await c.setTheme(dark)).refusal, 'nothing-to-do', 'the same theme again changes nothing');
  await previewSettled(c);
  const preview = c.getState().preview?.deck;
  assert.equal(preview?.designSystem.theme?.id, 'dark', 'the preview compiles the theme');
  const darkGround = String(preview?.frames.find((frame) => !frame.continuation && frame.archetype === 'content')?.layers[0]?.bg ?? '');
  assert.notEqual(darkGround, lightGround, 'a content slide moves off its light ground');

  const slideId = c.getState().plan?.slides.find((slide) => slide.include && slide.layout !== 'title')?.id;
  assert.ok(slideId);
  const grounded = await c.setGround([slideId], 'light');
  assert.equal(grounded.ok, true, JSON.stringify(grounded));
  assert.deepEqual(c.getState().history.undo, { kind: 'ground', count: 1 });
  assert.equal(c.getState().plan?.slides.find((slide) => slide.id === slideId)?.ground, 'light');

  assert.equal((await c.undo()).ok, true);
  assert.equal(c.getState().plan?.slides.find((slide) => slide.id === slideId)?.ground, undefined, 'undo takes the background back');
  assert.equal((await c.undo()).ok, true);
  const after = c.getState().plan;
  assert.equal(after?.designSystem.theme, undefined, 'undo takes the theme back');
  assert.deepEqual(after?.colors, before.colors, 'and every colour the theme moved');
  assert.equal((await c.redo()).ok, true);
  assert.deepEqual(c.getState().plan?.designSystem.theme, dark, 'redo puts the theme back');
});

// ─── close-out CP18: chart labels drawn as outlines ──────────────────────────

/** Outline path data for a word of `n` glyph boxes, each with a counter, standing on y = 0. */
function glyphWord(n: number): { d: string; width: number } {
  const height = 14.4;
  const w = 0.6 * height;
  let d = '';
  let x = 0;
  for (let i = 0; i < n; i += 1) {
    d += `M${x} 0H${x + w}V${-height}H${x}Z`;
    d += `M${x + 0.2 * w} ${-0.2 * height}V${-0.8 * height}H${x + 0.8 * w}V${-0.2 * height}Z`;
    x += w + 0.1 * height;
  }
  return { d, width: x - 0.1 * height };
}

/** A bar chart whose three category labels are drawn as outlines, right-aligned at an axis. */
async function labelledChart(): Promise<NonNullable<SourceDeckV1['slides'][number]['objects'][number]['vectorItems']>> {
  const { JSDOM } = await import('jsdom');
  const { svgItemsOf } = await import('../../../../../engine/src/svg-items.ts');
  const parser = new (new JSDOM('').window.DOMParser)();
  const label = (n: number, y: number): string => {
    const { d, width } = glyphWord(n);
    return `<path d="${d}" transform="translate(${90 - width},${y})" fill="rgb(20, 20, 20)" stroke="none"/>`;
  };
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 560" width="1280" height="560"><g class="cat-axis">'
    + label(3, 180) + label(5, 280) + label(4, 380)
    + '</g><rect x="100" y="150" width="500" height="60" fill="#30ba78"/><rect x="100" y="250" width="200" height="60" fill="#30ba78"/></svg>';
  return svgItemsOf(svg, (text) => parser.parseFromString(text, 'image/svg+xml') as unknown as Document);
}

/** The sample deck with one more object on its first slide: a chart whose labels are outlines. */
async function labelledSource(): Promise<SourceDeckV1> {
  const source = structuredClone(SOURCE);
  const slide = source.slides[0];
  assert.ok(slide);
  slide.objects.push({
    id: 'ppt/slides/slide1.xml.20',
    fingerprint: 'vector:chart',
    kind: 'vector',
    box: { x: 96, y: 300, w: 640, h: 280, rot: 0 },
    origin: 'slide',
    fidelity: { state: 'editable' },
    vectorItems: await labelledChart(),
  });
  return source;
}

/** The deck with the chart's label runs gone, as a reading that wrote them as text gives it back. */
function labelsRead(source: SourceDeckV1): SourceDeckV1 {
  const out = structuredClone(source);
  for (const slide of out.slides) {
    for (const object of slide.objects) {
      if (object.kind === 'vector' && object.vectorItems) object.vectorItems = { ...object.vectorItems, items: object.vectorItems.items.filter((item) => item.kind !== 'path') };
    }
  }
  return out;
}

test('chart labels drawn as outlines are counted, and Read the labels offers the model before one job reads them', async () => {
  const source = await labelledSource();
  const runs = drawnLabelCount(source);
  assert.equal(runs, 3, 'the three category labels are runs');
  const offers: boolean[] = [];
  let answer = false;
  const reads: SourceDeckV1[] = [];
  const h = harness({
    async ingest({ file: picked }) {
      const project = await h.store.create({ id: 'proj-1', name: 'Charts', source: { ...SOURCE.source, name: picked.name }, designSystem: planSample().designSystem });
      return { project, source: structuredClone(source), vectorLabels: { runs, text: 0, drawn: runs, read: false } };
    },
    async ensureTextReading() {
      offers.push(answer);
      return answer;
    },
    async readVectorLabels(input) {
      reads.push(input.source);
      input.onProgress(0, 1);
      input.onProgress(1, 1);
      return { ok: true, source: labelsRead(input.source), summary: { runs, text: runs - 1, drawn: 1, read: true } };
    },
  });
  const { c } = await reviewing(h);
  assert.deepEqual(c.getState().vectorLabels, { drawn: 3, read: false }, 'the read says how many stayed drawn');

  // Declining the offer leaves the labels drawn and reads nothing.
  const declined = await c.readVectorLabels?.();
  assert.equal(declined?.refusal, 'nothing-to-do');
  assert.deepEqual(offers, [false]);
  assert.equal(reads.length, 0);

  answer = true;
  const stagesBefore = h.stages.length;
  const read = await c.readVectorLabels?.();
  assert.deepEqual(read, { ok: true, touched: 2, skipped: 1 });
  assert.deepEqual(offers, [false, true], 'the model is offered in answer to the press');
  assert.equal(reads.length, 1);
  assert.equal(h.jobs.at(-1)?.title, 'Reading the chart labels');
  assert.ok(h.jobNotes.includes('Reading the labels of chart 1 of 1'));
  const state = c.getState();
  assert.deepEqual(state.vectorLabels, { drawn: 1, text: 2, read: true });
  assert.equal(state.progress, null);
  assert.equal(
    state.source?.slides[0]?.objects.find((object) => object.kind === 'vector')?.vectorItems?.items.some((item) => item.kind === 'path'),
    false,
    'the deck in hand is the one the reading gave back',
  );
  // The plan is made again over the read deck, and the stored deck is that one.
  assert.deepEqual(h.stages.slice(stagesBefore).map((call) => call.name), ['rebrand.census', 'rebrand.plan', 'rebrand.faithful', 'rebrand.compile']);
  const stored = await h.store.getPart<SourceDeckV1>('proj-1', 'sourceDeck');
  assert.equal(stored?.slides[0]?.objects.find((object) => object.kind === 'vector')?.vectorItems?.items.some((item) => item.kind === 'path'), false);
});

test('a stored deck with drawn labels reads them on its own when the model is there, and never offers it', async () => {
  const source = await labelledSource();
  let modelThere = false;
  let reads = 0;
  const h = harness({
    async ingest({ file: picked }) {
      const project = await h.store.create({ id: 'proj-1', name: 'Charts', source: { ...SOURCE.source, name: picked.name }, designSystem: planSample().designSystem });
      return { project, source: structuredClone(source), vectorLabels: { runs: 3, text: 0, drawn: 3, read: false } };
    },
    ensureTextReading: async () => assert.fail('an open never offers the model'),
    async readVectorLabels(input) {
      reads += 1;
      if (!modelThere) return { ok: false, reason: 'model-missing' };
      return { ok: true, source: labelsRead(input.source), summary: { runs: 3, text: 3, drawn: 0, read: true } };
    },
  });
  const { c } = await reviewing(h);
  assert.equal(reads, 0, 'a fresh read already tried with the model it had');

  // Without the model an open tries once, quietly, and the labels stay drawn.
  c.close();
  await c.open('proj-1');
  await until(() => reads === 1 && c.getState().phase === 'review', 'the quiet try');
  await until(() => c.getState().progress === null, 'the try to end');
  assert.deepEqual(c.getState().vectorLabels, { drawn: 3, read: false });

  // The model arrived in place: checking readiness again reads the labels.
  modelThere = true;
  await c.refreshReadiness?.();
  await until(() => c.getState().vectorLabels?.read === true, 'the labels read');
  assert.equal(reads, 2);
  assert.deepEqual(c.getState().vectorLabels, { text: 3, drawn: 0, read: true });
});

test('a finished read job\'s toast can be taken off at once, whether it ran on the slot or quietly', async () => {
  const { runJobOverHeavySlot } = await import('./deps.ts');
  const jobs = await import('../jobs.ts');
  jobs.__resetJobsForTest();
  let dismiss: (() => void) | undefined;
  const value = await runJobOverHeavySlot({ title: 'Reading the deck' }, async (handle) => {
    dismiss = handle.dismiss;
    return 7;
  });
  assert.equal(value, 7);
  assert.equal(jobs.jobsSnapshot().length, 1, 'the finished job shows for its retention');
  dismiss?.();
  assert.equal(jobs.jobsSnapshot().length, 0, 'and leaves at once when dismissed');

  // A quiet run that showed (the person left the intake) is taken down the same way.
  let quiet = true;
  let quietDismiss: (() => void) | undefined;
  await runJobOverHeavySlot({ title: 'Reading the deck', quietWhile: () => quiet }, async (handle) => {
    quietDismiss = handle.dismiss;
    quiet = false;
    handle.progress(1, 2);
    return true;
  });
  assert.equal(jobs.jobsSnapshot().length, 1, 'the job showed once the view stopped showing the reading');
  quietDismiss?.();
  assert.equal(jobs.jobsSnapshot().length, 0);

  // A job still running is taken off as soon as it ends.
  const running = jobs.startJob({ title: 'Reading the deck', heavy: false });
  jobs.dismissJob(running.id);
  assert.equal(jobs.jobsSnapshot().length, 1, 'a running job stays');
  running.finish();
  running.settle();
  assert.equal(jobs.jobsSnapshot().length, 0, 'and leaves when it ends');
  jobs.__resetJobsForTest();
});
