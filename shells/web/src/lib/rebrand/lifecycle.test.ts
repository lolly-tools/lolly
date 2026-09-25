// SPDX-License-Identifier: MPL-2.0
/**
 * Renovation project lifecycle: recovery, the revision rule, quota, cancel and
 * one-object decision writes.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/lib/rebrand/lifecycle.test.ts
 *
 * The store under the tests is written here rather than imported, for two
 * reasons. It keeps the suite free of IndexedDB and of the web store's own
 * schedule, and it makes the revision rule visible: `MemoryStore` refuses a
 * write whose expected revision is not the stored one, exactly as the contract
 * says a real store must, so the refusals these tests assert are the store's
 * answer and not a mock's convenience. Quota is a switch on the same store, so
 * the held-work path runs against a store that otherwise behaves, and a second
 * switch refuses the checkpoint alone, which is how the two-write split is
 * tested: the part is written and the stage is left unmarked.
 *
 * The runner is a plain function, so every stage result is chosen by the test:
 * a result for another project, a result from an older plan revision, a result
 * carrying an old plan with no envelope revision at all, a result that arrives
 * after cancel, and a runner that throws.
 *
 * Setup walks the stages in order, because a stage ahead of the resume point is
 * refused. `projectWithCensus` and `projectWithPlan` are that walk.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type {
  CompiledDeckV1,
  DeckCensusV1,
  DesignSystemSnapshotV1,
  ObjectPlanV1,
  ProjectPartKindV1,
  ProjectStageV1,
  ProjectWriteResultV1,
  RenovationPlanV1,
  RenovationProjectStoreV1,
  RenovationProjectV1,
  SlidePlanV1,
  SourceDeckV1,
  StageEnvelopeV1,
} from '@lolly-tools/core';
import {
  advance,
  applyDecision,
  commitPlan,
  markStageComplete,
  nextStage,
  openProject,
  recordDecision,
  resumePoint,
  rewindTo,
  staleEnvelope,
  type StagePartValueV1,
  type StageRunnerV1,
} from './lifecycle.ts';

// ─── an in-memory store implementing the contract ────────────────────────────

type PartValue = SourceDeckV1 | DeckCensusV1 | RenovationPlanV1 | CompiledDeckV1;

class MemoryStore implements RenovationProjectStoreV1 {
  readonly projects = new Map<string, RenovationProjectV1>();
  readonly parts = new Map<string, PartValue>();
  /** Flip to make every part write answer `quota`, as a full device would. */
  quotaFull = false;
  /** Set to make `checkpoint` alone refuse, with the part write still taken. */
  checkpointRefusal: Extract<ProjectWriteResultV1, { ok: false }> | null = null;
  /** Every write the store took, so a test can count transactions. */
  readonly writes: string[] = [];

  private key(id: string, kind: ProjectPartKindV1): string {
    return `${id}:${kind}`;
  }

  async list(): Promise<RenovationProjectV1[]> {
    return [...this.projects.values()];
  }

  async get(id: string): Promise<RenovationProjectV1 | null> {
    const p = this.projects.get(id);
    return p ? structuredClone(p) : null;
  }

  async create(
    input: Omit<RenovationProjectV1, 'version' | 'revision' | 'checkpoint' | 'parts' | 'designSessionIds'>,
  ): Promise<RenovationProjectV1> {
    const project: RenovationProjectV1 = {
      ...input,
      version: 1,
      revision: 1,
      // Nothing has completed, so the checkpoint carries no time.
      checkpoint: { stage: 'ingest' },
      parts: {},
      designSessionIds: [],
    };
    this.projects.set(project.id, project);
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
    if (this.quotaFull) {
      return { ok: false, refusal: 'quota', message: 'No room left on this device.' };
    }
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
    const v = this.parts.get(this.key(id, kind));
    return v ? (structuredClone(v) as T) : null;
  }

  async checkpoint(
    id: string,
    expectedRevision: number,
    stage: ProjectStageV1,
    planRevision?: number,
  ): Promise<ProjectWriteResultV1> {
    const g = this.guard(id, expectedRevision);
    if ('ok' in g) return g;
    if (this.checkpointRefusal) return this.checkpointRefusal;
    const next: RenovationProjectV1 = {
      ...g,
      checkpoint: { stage, at: '2026-09-23T00:00:00.000Z', ...(planRevision === undefined ? {} : { planRevision }) },
      revision: g.revision + 1,
    };
    this.projects.set(id, next);
    this.writes.push(`checkpoint:${stage}`);
    return { ok: true, revision: next.revision };
  }

  async remove(id: string): Promise<{ removedAssetRefs: string[]; keptAssetRefs: string[] }> {
    this.projects.delete(id);
    for (const k of [...this.parts.keys()]) if (k.startsWith(`${id}:`)) this.parts.delete(k);
    return { removedAssetRefs: [], keptAssetRefs: [] };
  }
}

// ─── fixtures ────────────────────────────────────────────────────────────────

const DESIGN_SYSTEM: DesignSystemSnapshotV1 = {
  id: 'lolly-start',
  tokenHash: 'sha256:0000',
  fontHashes: {},
  assetHashes: {},
};

async function newProject(store: MemoryStore, opts: { bytesAssetRef?: string } = {}): Promise<RenovationProjectV1> {
  return await store.create({
    id: 'proj-1',
    name: 'Why SUSE Summary',
    source: {
      kind: 'pptx',
      hash: 'sha256:abcd',
      lineageId: 'lin-1',
      instanceId: 'inst-1',
      pageCount: 3,
      ...(opts.bytesAssetRef === undefined ? {} : { bytesAssetRef: opts.bytesAssetRef }),
    },
    designSystem: DESIGN_SYSTEM,
  });
}

function objectPlan(id: string): ObjectPlanV1 {
  return { id, class: 'logo-candidate', evidence: [], proposal: 'keep', review: 'unreviewed' };
}

function planFixture(revision = 1): RenovationPlanV1 {
  const slide = (id: string, objects: ObjectPlanV1[]): SlidePlanV1 => ({
    id,
    include: true,
    layout: 'content',
    layoutSource: 'proposed',
    objects,
  });
  return {
    version: 1,
    source: { lineageId: 'lin-1', hash: 'sha256:abcd', instanceId: 'inst-1' },
    revision,
    designSystem: DESIGN_SYSTEM,
    algorithms: { reader: 'r1', census: 'c1', plan: 'p1' },
    mode: 'renovate',
    slides: [
      slide('s1', [objectPlan('s1.a'), objectPlan('s1.b')]),
      slide('s2', [objectPlan('s2.a')]),
    ],
    colors: [],
    fonts: [],
    logo: { policy: 'brand', variantByBackground: true },
    decisions: [],
  };
}

function sourceDeckFixture(): SourceDeckV1 {
  return {
    version: 1,
    source: { kind: 'pptx', hash: 'sha256:abcd', lineageId: 'lin-1', instanceId: 'inst-1', pageCount: 3 },
    slides: [],
    fonts: [],
    reader: { name: 'test', version: '1' },
    warnings: [],
  };
}

function censusFixture(): DeckCensusV1 {
  return {
    version: 1,
    sourceHash: 'sha256:abcd',
    rules: { name: 'test', version: '1' },
    objects: [],
    groups: [],
    colors: { uses: [], contrastPairs: [] },
    fonts: [],
    layouts: [],
    flattenedSlideIds: [],
    warnings: [],
  };
}

function compiledFixture(planRevision = 1): CompiledDeckV1 {
  return {
    version: 1,
    source: { lineageId: 'lin-1', hash: 'sha256:abcd', instanceId: 'inst-1' },
    planRevision,
    designSystem: DESIGN_SYSTEM,
    algorithms: { reader: 'r1', census: 'c1', plan: 'p1', compile: 'k1' },
    frames: [],
    tray: [],
    lineage: { forward: [], backward: [] },
    report: {
      version: 1,
      sourceHash: 'sha256:abcd',
      planRevision,
      counts: {
        slides: { source: 0, included: 0, excluded: 0, continuation: 0 },
        objects: { retained: 0, transformed: 0, removed: 0, unresolved: 0 },
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
}

/** A runner that answers for whatever stage it is asked about. */
function runnerFor(value: StagePartValueV1 | null, over: Partial<StageEnvelopeV1<StagePartValueV1 | null>> = {}): StageRunnerV1 {
  return async (project, stage) => ({
    projectId: project.id,
    stage,
    algorithmVersion: 'test-1',
    result: value,
    ...over,
  });
}

/**
 * Setup runs the stages in order, because `advance` refuses a stage that is
 * ahead of the resume point. A test that wants a plan on disk gets there the
 * way the journey does.
 */
async function ranStage(
  store: MemoryStore,
  project: RenovationProjectV1,
  stage: ProjectStageV1,
  value: StagePartValueV1 | null,
): Promise<RenovationProjectV1> {
  const res = await advance(store, project, stage, runnerFor(value));
  assert.ok(res.outcome === 'advanced', `setup: the ${stage} stage answered ${res.outcome}`);
  return res.project;
}

/** Ingested and counted, with no plan yet. */
async function projectWithCensus(store: MemoryStore): Promise<RenovationProjectV1> {
  const project = await ranStage(store, await newProject(store), 'ingest', sourceDeckFixture());
  return await ranStage(store, project, 'census', censusFixture());
}

/** A project with a stored plan. */
async function projectWithPlan(store: MemoryStore, plan: RenovationPlanV1 = planFixture(1)): Promise<RenovationProjectV1> {
  return await ranStage(store, await projectWithCensus(store), 'plan', plan);
}

// ─── recovery ────────────────────────────────────────────────────────────────

test('a project that has committed nothing resumes at ingest and asks for the file', async () => {
  const store = new MemoryStore();
  const project = await newProject(store);
  const opened = await openProject(store, project.id);
  assert.ok(opened);
  assert.equal(opened.resumeFrom, 'ingest');
  assert.equal(opened.needsSource, true, 'no retained bytes and no source deck means ask for the same file');
});

test('a project whose bytes were retained does not ask for the file again', async () => {
  const store = new MemoryStore();
  const project = await newProject(store, { bytesAssetRef: 'asset:bytes-1' });
  const opened = await openProject(store, project.id);
  assert.ok(opened);
  assert.equal(opened.resumeFrom, 'ingest');
  assert.equal(opened.needsSource, false);
});

test('resume after ingest, after census and mid-plan', async () => {
  const store = new MemoryStore();
  let project = await newProject(store);

  // After ingest: the source deck is stored, so census is next and the original
  // file is not needed even though its bytes were not retained.
  let res = await advance(store, project, 'ingest', runnerFor(sourceDeckFixture()));
  assert.equal(res.outcome, 'advanced');
  assert.ok(res.outcome === 'advanced');
  project = res.project;
  assert.deepEqual(resumePoint(project), { resumeFrom: 'census', needsSource: false });

  // After census: plan is next.
  res = await advance(store, project, 'census', runnerFor(censusFixture()));
  assert.ok(res.outcome === 'advanced');
  project = res.project;
  assert.deepEqual(resumePoint(project), { resumeFrom: 'plan', needsSource: false });

  // Mid-plan: the plan stage was interrupted before its checkpoint, so the
  // checkpoint still reads census and the plan stage runs again.
  const interrupted = await store.get(project.id);
  assert.ok(interrupted);
  assert.equal(interrupted.checkpoint.stage, 'census');
  assert.equal(resumePoint(interrupted).resumeFrom, 'plan');

  // Once plan completes, review is next and the plan revision is checkpointed.
  res = await advance(store, project, 'plan', runnerFor(planFixture(4)));
  assert.ok(res.outcome === 'advanced');
  assert.equal(res.project.checkpoint.stage, 'plan');
  assert.equal(res.project.checkpoint.planRevision, 4);
  assert.equal(resumePoint(res.project).resumeFrom, 'review');
});

test('a finished project has nothing to resume', async () => {
  const store = new MemoryStore();
  let project = await projectWithPlan(store, planFixture(2));
  // The review stage writes no new plan here: the decisions went in one at a
  // time, so the stored plan is the record and the runner has nothing to add.
  project = await ranStage(store, project, 'review', null);
  project = await ranStage(store, project, 'compile', compiledFixture(2));
  const done = await advance(store, project, 'done', runnerFor(null));
  assert.ok(done.outcome === 'advanced');
  assert.equal(done.part, null, 'the done stage writes no part');
  assert.equal(resumePoint(done.project).resumeFrom, null);
});

test('a stage ahead of the resume point is refused, and nothing is marked complete', async () => {
  const store = new MemoryStore();
  const project = await newProject(store);
  const jumped = await advance(store, project, 'done', runnerFor(null));
  assert.equal(jumped.outcome, 'discarded');
  assert.ok(jumped.outcome === 'discarded');
  assert.match(jumped.message, /done stage comes after ingest/);
  assert.equal(store.writes.length, 0, 'a refused jump writes nothing');

  const stored = await store.get(project.id);
  assert.equal(stored?.checkpoint.at, undefined, 'no stage was marked complete');
  assert.equal(resumePoint(project).resumeFrom, 'ingest');
});

test('a completed stage may be run again', async () => {
  const store = new MemoryStore();
  const project = await ranStage(store, await newProject(store), 'ingest', sourceDeckFixture());
  const again = await advance(store, project, 'ingest', runnerFor(sourceDeckFixture()));
  assert.equal(again.outcome, 'advanced');
});

test('a stage that owes a record and produces none fails rather than marking the stage', async () => {
  const store = new MemoryStore();
  const project = await newProject(store);
  const res = await advance(store, project, 'ingest', runnerFor(null));
  assert.equal(res.outcome, 'failed');
  assert.ok(res.outcome === 'failed');
  assert.match(res.message, /produced no sourceDeck/);
  assert.equal(store.writes.length, 0);

  // The project is still resumable and still asks for the same file, which is
  // the whole point: a checkpoint here would have stranded it.
  const stored = await store.get(project.id);
  assert.ok(stored);
  assert.deepEqual(resumePoint(stored), { resumeFrom: 'ingest', needsSource: true });
});

test('a checkpoint naming a stage this build cannot read stops rather than restarting', async () => {
  const store = new MemoryStore();
  const project = await newProject(store);
  const fromTheFuture: RenovationProjectV1 = {
    ...project,
    parts: { sourceDeck: 'proj-1:sourceDeck' },
    checkpoint: { stage: 'polish' as ProjectStageV1, at: '2026-09-23T00:00:00.000Z' },
  };
  const point = resumePoint(fromTheFuture);
  assert.equal(point.resumeFrom, null);
  assert.equal(point.unknownStage, 'polish');
  assert.equal(point.needsSource, false);
  assert.equal(nextStage('polish' as ProjectStageV1), null, 'an unknown stage is not "start again"');

  const res = await advance(store, fromTheFuture, 'ingest', runnerFor(sourceDeckFixture()));
  assert.equal(res.outcome, 'discarded');
  assert.ok(res.outcome === 'discarded');
  assert.match(res.message, /newer version/);
  assert.equal(store.writes.length, 0);
});

test('nextStage walks the stage list and stops at the end', () => {
  assert.equal(nextStage('ingest'), 'census');
  assert.equal(nextStage('compile'), 'done');
  assert.equal(nextStage('done'), null);
});

// ─── the revision rule ───────────────────────────────────────────────────────

test('a stale write from a second handle is refused and the first handle reloads', async () => {
  const store = new MemoryStore();
  const first = await newProject(store);
  // Two handles read the same project at revision 1.
  const second = await store.get(first.id);
  assert.ok(second);

  // The second handle finishes ingest, which moves the stored revision on.
  const theirs = await advance(store, second, 'ingest', runnerFor(sourceDeckFixture()));
  assert.ok(theirs.outcome === 'advanced');
  assert.ok(theirs.project.revision > first.revision);

  // The first handle tries the same stage against the revision it read.
  const mine = await advance(store, first, 'ingest', runnerFor(sourceDeckFixture()));
  assert.equal(mine.outcome, 'reload');
  assert.ok(mine.outcome === 'reload');
  assert.equal(mine.currentRevision, theirs.project.revision);
  assert.ok(mine.project, 'the refusal hands back the stored project to reload from');
  assert.equal(mine.project.revision, theirs.project.revision);
  assert.match(mine.message, /changed somewhere else/);

  // The reloaded project carries the other handle's checkpoint, and retrying
  // from it succeeds.
  const retried = await advance(store, mine.project, 'census', runnerFor(censusFixture()));
  assert.equal(retried.outcome, 'advanced');
});

test('a result for another project or an older plan revision is discarded, not written', async () => {
  const store = new MemoryStore();
  const project = await projectWithPlan(store, planFixture(3));
  const before = store.writes.length;

  const wrongProject = await advance(store, project, 'review', runnerFor(planFixture(3), { projectId: 'someone-else' }));
  assert.equal(wrongProject.outcome, 'discarded');

  const wrongStage = await advance(store, project, 'review', runnerFor(planFixture(3), { stage: 'census' }));
  assert.equal(wrongStage.outcome, 'discarded');

  const oldRevision = await advance(store, project, 'review', runnerFor(planFixture(2), { planRevision: 2 }));
  assert.equal(oldRevision.outcome, 'discarded');
  assert.ok(oldRevision.outcome === 'discarded');
  assert.match(oldRevision.message, /plan revision 2/);

  // The envelope field is optional, so the guard reads the plan's own revision
  // too. A runner that leaves the field unset cannot walk an old plan past it.
  const unlabelled = await advance(store, project, 'review', runnerFor(planFixture(2)));
  assert.equal(unlabelled.outcome, 'discarded');
  assert.ok(unlabelled.outcome === 'discarded');
  assert.match(unlabelled.message, /plan revision 2/);

  assert.equal(store.writes.length, before, 'a discarded result writes nothing at all');

  const stored = await store.get(project.id);
  assert.equal(stored?.checkpoint.planRevision, 3, 'the checkpointed revision never goes backwards');
});

test('staleEnvelope reads the envelope on its own', () => {
  const project: RenovationProjectV1 = {
    version: 1,
    id: 'p',
    name: 'n',
    source: { kind: 'pptx', hash: 'h', lineageId: 'l', instanceId: 'i', pageCount: 1 },
    checkpoint: { stage: 'plan', at: 'now', planRevision: 5 },
    revision: 9,
    designSystem: DESIGN_SYSTEM,
    parts: {},
    designSessionIds: [],
  };
  const env = (over: Partial<StageEnvelopeV1<null>>): StageEnvelopeV1<null> => ({
    projectId: 'p', stage: 'review', algorithmVersion: 'a', result: null, ...over,
  });
  assert.equal(staleEnvelope(project, 'review', env({})), null);
  assert.equal(staleEnvelope(project, 'review', env({ planRevision: 5 })), null);
  assert.equal(staleEnvelope(project, 'review', env({ planRevision: 6 })), null, 'a newer revision is not stale');
  assert.ok(staleEnvelope(project, 'review', env({ planRevision: 4 })));

  // The result record answers for itself when the envelope says nothing.
  const carrying = (revision: number): StageEnvelopeV1<RenovationPlanV1> => ({
    projectId: 'p', stage: 'review', algorithmVersion: 'a', result: planFixture(revision),
  });
  assert.ok(staleEnvelope(project, 'review', carrying(4)), 'an older plan body is stale on its own');
  assert.equal(staleEnvelope(project, 'review', carrying(6)), null);
});

// ─── quota ───────────────────────────────────────────────────────────────────

test('a quota refusal leaves the plan in memory and returns the download offer', async () => {
  const store = new MemoryStore();
  const project = await projectWithCensus(store);
  const plan = planFixture(2);
  store.quotaFull = true;

  const res = await advance(store, project, 'plan', runnerFor(plan));
  assert.equal(res.outcome, 'held');
  assert.ok(res.outcome === 'held');
  assert.equal(res.held.kind, 'plan');
  assert.deepEqual(res.held.value, plan, 'the work the store would not take comes back untouched');
  assert.equal(res.held.offer, 'download-project');
  assert.match(res.message, /download the project/);

  // Nothing was recorded, so nothing claims to be saved on this device.
  const stored = await store.get(project.id);
  assert.ok(stored);
  assert.equal(stored.revision, project.revision);
  assert.equal(stored.parts.plan, undefined);
  assert.deepEqual(stored.checkpoint, project.checkpoint, 'the census checkpoint is where it was');
});

test('a part the store took is never reported as work that was not saved', async () => {
  const store = new MemoryStore();
  const project = await projectWithCensus(store);
  const plan = planFixture(2);
  // The device fills up between the two writes: the plan is written and the
  // checkpoint is refused.
  store.checkpointRefusal = { ok: false, refusal: 'quota', message: 'No room left on this device.' };

  const res = await advance(store, project, 'plan', runnerFor(plan));
  assert.equal(res.outcome, 'uncheckpointed');
  assert.ok(res.outcome === 'uncheckpointed');
  assert.equal(res.part, 'plan');
  assert.equal(res.refusal, 'quota');
  assert.equal(res.planRevision, 2);
  assert.doesNotMatch(res.message, /download the project/, 'the work is on the device, so no download is offered as the only copy');
  assert.match(res.message, /saved on this device/);

  // The plan really is stored, and the handle that comes back is the stored one.
  assert.deepEqual(await store.getPart<RenovationPlanV1>(project.id, 'plan'), plan);
  const stored = await store.get(project.id);
  assert.equal(res.project.revision, stored?.revision, 'the caller is not handed a revision the store has moved past');
  assert.equal(stored?.checkpoint.stage, 'census', 'the stage is not marked complete');

  // Marking the stage on its own finishes the job once there is room.
  store.checkpointRefusal = null;
  const marked = await markStageComplete(store, res.project, 'plan', res.planRevision);
  assert.equal(marked.outcome, 'advanced');
  assert.ok(marked.outcome === 'advanced');
  assert.equal(marked.project.checkpoint.stage, 'plan');
  assert.equal(marked.project.checkpoint.planRevision, 2);
});

test('a checkpoint another handle refuses hands back the stored project, not the one that went in', async () => {
  const store = new MemoryStore();
  const project = await projectWithCensus(store);
  store.checkpointRefusal = {
    ok: false, refusal: 'stale-revision', message: 'Another view changed this project.', currentRevision: 99,
  };
  const res = await advance(store, project, 'plan', runnerFor(planFixture(2)));
  assert.ok(res.outcome === 'uncheckpointed');
  assert.equal(res.refusal, 'stale-revision');
  assert.ok(res.project.revision > project.revision, 'the part write moved the revision on');
  assert.notEqual(await store.getPart<RenovationPlanV1>(project.id, 'plan'), null);
});

test('a quota refusal on a decision keeps the edited plan in memory', async () => {
  const store = new MemoryStore();
  const project = await projectWithPlan(store);

  store.quotaFull = true;
  const res = await recordDecision(store, project, 's1.b', { action: 'remove' });
  assert.equal(res.outcome, 'held');
  assert.ok(res.outcome === 'held');
  assert.equal(res.plan.slides[0]?.objects[1]?.decision, 'remove');
  assert.equal(res.held.offer, 'download-project');

  const onDisk = await store.getPart<RenovationPlanV1>(project.id, 'plan');
  assert.equal(onDisk?.slides[0]?.objects[1]?.decision, undefined, 'the stored plan is unchanged');
});

// ─── cancel ──────────────────────────────────────────────────────────────────

test('a cancelled stage leaves the checkpoint where it was', async () => {
  const store = new MemoryStore();
  let project = await newProject(store);
  const ingested = await advance(store, project, 'ingest', runnerFor(sourceDeckFixture()));
  assert.ok(ingested.outcome === 'advanced');
  project = ingested.project;
  const committed = project.checkpoint;
  const writesBefore = store.writes.length;

  // The person cancels while the census runs. The runner still finishes, which
  // is the real case: a worker cannot always be stopped between two lines.
  const controller = new AbortController();
  const slowRunner: StageRunnerV1 = async (p, stage) => {
    controller.abort();
    return { projectId: p.id, stage, algorithmVersion: 'test-1', result: censusFixture() };
  };
  const res = await advance(store, project, 'census', slowRunner, { signal: controller.signal });

  assert.equal(res.outcome, 'cancelled');
  assert.equal(store.writes.length, writesBefore, 'a cancelled stage writes nothing');
  const stored = await store.get(project.id);
  assert.deepEqual(stored?.checkpoint, committed);
  assert.equal(stored?.parts.census, undefined);
});

test('cancelling before the runner starts does not run it', async () => {
  const store = new MemoryStore();
  const project = await newProject(store);
  const controller = new AbortController();
  controller.abort();
  let ran = false;
  const res = await advance(
    store,
    project,
    'ingest',
    async (p, stage) => {
      ran = true;
      return { projectId: p.id, stage, algorithmVersion: 'test-1', result: sourceDeckFixture() };
    },
    { signal: controller.signal },
  );
  assert.equal(res.outcome, 'cancelled');
  assert.equal(ran, false);
});

test('a runner that throws fails the stage and writes nothing', async () => {
  const store = new MemoryStore();
  const project = await newProject(store);
  const res = await advance(store, project, 'ingest', async () => {
    throw new Error('the file could not be read');
  });
  assert.equal(res.outcome, 'failed');
  assert.ok(res.outcome === 'failed');
  assert.equal(res.message, 'the file could not be read');
  assert.equal(store.writes.length, 0);
});

test('a stage that fails while the person cancels keeps its own reason', async () => {
  const store = new MemoryStore();
  const project = await newProject(store);
  const controller = new AbortController();

  const failed = await advance(store, project, 'ingest', async () => {
    controller.abort();
    throw new Error('the zip directory is damaged');
  }, { signal: controller.signal });
  assert.equal(failed.outcome, 'failed', 'a cancel that lands at the same moment does not swallow the reason');
  assert.ok(failed.outcome === 'failed');
  assert.equal(failed.message, 'the zip directory is damaged');

  // An abort-shaped rejection still reads as the cancel it is.
  const second = new AbortController();
  const cancelled = await advance(store, project, 'ingest', async () => {
    second.abort();
    const err = new Error('aborted');
    err.name = 'AbortError';
    throw err;
  }, { signal: second.signal });
  assert.equal(cancelled.outcome, 'cancelled');
  assert.equal(store.writes.length, 0);
});

// ─── decisions ───────────────────────────────────────────────────────────────

test('a decision writes one object and regenerates nothing else', async () => {
  const store = new MemoryStore();
  const project = await projectWithPlan(store);
  const before = await store.getPart<RenovationPlanV1>(project.id, 'plan');
  assert.ok(before);
  const writesBefore = store.writes.length;

  const res = await recordDecision(store, project, 's1.b', {
    action: 'replace',
    replacement: { kind: 'brand-logo', variant: 'auto' },
    scope: 'group-7',
  });
  assert.equal(res.outcome, 'recorded');
  assert.ok(res.outcome === 'recorded');

  const after = await store.getPart<RenovationPlanV1>(project.id, 'plan');
  assert.ok(after);
  const touched = after.slides[0]?.objects[1];
  assert.equal(touched?.decision, 'replace');
  assert.deepEqual(touched?.decisionReplacement, { kind: 'brand-logo', variant: 'auto' });
  assert.equal(touched?.author, 'user');
  assert.equal(touched?.review, 'accepted');
  assert.equal(touched?.scope, 'group-7');
  assert.equal(touched?.proposal, 'keep', 'the proposal stays readable beside the decision');

  // Every other object, and the rest of the plan, is byte for byte what it was.
  assert.deepEqual(after.slides[0]?.objects[0], before.slides[0]?.objects[0]);
  assert.deepEqual(after.slides[1], before.slides[1]);
  assert.deepEqual(after.colors, before.colors);
  assert.deepEqual(after.decisions, before.decisions);
  // One part write plus the checkpoint that moves the plan revision on. The
  // contract has no call that does both, and the guard is worth the second one.
  assert.deepEqual(store.writes.slice(writesBefore), ['part:plan', 'checkpoint:plan']);
  assert.equal(after.revision, (before.revision ?? 0) + 1, 'the plan revision moves with the decision');
  const stored = await store.get(project.id);
  assert.equal(stored?.checkpoint.planRevision, after.revision);
  assert.equal(stored?.checkpoint.stage, 'plan', 'the stage the project was on is the stage it stays on');
});

test('a result computed before a decision cannot write over it', async () => {
  const store = new MemoryStore();
  let project = await projectWithPlan(store, planFixture(5));

  // A review worker started here, holding plan revision 5.
  const inFlight = runnerFor(planFixture(5), { planRevision: 5 });

  const decided = await recordDecision(store, project, 's1.a', { action: 'remove' });
  assert.equal(decided.outcome, 'recorded');
  assert.ok(decided.outcome === 'recorded');
  project = decided.project;
  assert.equal(decided.plan.revision, 6);
  assert.equal(project.checkpoint.planRevision, 6, 'the guard the next result is read against moved with the choice');

  const late = await advance(store, project, 'review', inFlight);
  assert.equal(late.outcome, 'discarded');
  assert.ok(late.outcome === 'discarded');
  assert.match(late.message, /plan revision 5/);

  const onDisk = await store.getPart<RenovationPlanV1>(project.id, 'plan');
  assert.equal(onDisk?.slides[0]?.objects[0]?.decision, 'remove', 'the choice is still there');
});

test('a decision the store keeps but cannot guard says so', async () => {
  const store = new MemoryStore();
  const project = await projectWithPlan(store);
  store.checkpointRefusal = { ok: false, refusal: 'quota', message: 'No room left on this device.' };

  const res = await recordDecision(store, project, 's1.a', { action: 'remove' });
  assert.equal(res.outcome, 'uncheckpointed');
  assert.ok(res.outcome === 'uncheckpointed');
  assert.match(res.message, /saved on this device/);
  const onDisk = await store.getPart<RenovationPlanV1>(project.id, 'plan');
  assert.equal(onDisk?.slides[0]?.objects[0]?.decision, 'remove', 'the choice is stored even so');
});

test('a decision against a stale handle is refused and the handle reloads', async () => {
  const store = new MemoryStore();
  const project = await projectWithPlan(store);

  const other = await store.get(project.id);
  assert.ok(other);
  const theirs = await recordDecision(store, other, 's1.a', { action: 'remove' });
  assert.equal(theirs.outcome, 'recorded');

  const mine = await recordDecision(store, project, 's1.b', { action: 'keep' });
  assert.equal(mine.outcome, 'reload');
  assert.ok(mine.outcome === 'reload');
  assert.ok(mine.project);
  assert.ok(mine.project.revision > project.revision);
});

test('a decision about an object no plan holds is reported, not invented', async () => {
  const store = new MemoryStore();
  const project = await projectWithPlan(store);

  const res = await recordDecision(store, project, 'nope', { action: 'remove' });
  assert.equal(res.outcome, 'not-found');
});

test('a decision before there is a plan is reported', async () => {
  const store = new MemoryStore();
  const project = await newProject(store);
  const res = await recordDecision(store, project, 's1.a', { action: 'remove' });
  assert.equal(res.outcome, 'not-found');
  assert.ok(res.outcome === 'not-found');
  assert.match(res.message, /no renovation plan/);
});

test('applyDecision clears what the new decision does not carry', () => {
  const plan = planFixture(1);
  const replaced = applyDecision(plan, 's1.a', {
    action: 'replace',
    replacement: { kind: 'asset', id: 'a/b' },
    scope: 'group-7',
    locked: true,
  });
  assert.ok(replaced);
  assert.deepEqual(replaced.slides[0]?.objects[0]?.decisionReplacement, { kind: 'asset', id: 'a/b' });
  assert.equal(replaced.slides[0]?.objects[0]?.scope, 'group-7');
  assert.equal(replaced.slides[0]?.objects[0]?.locked, true);
  assert.equal(replaced.revision, 2, 'a decision moves the plan revision');

  // One object taken out of a group action by hand is not the group's choice,
  // and the lock goes with it.
  const removed = applyDecision(replaced, 's1.a', { action: 'remove' });
  assert.ok(removed);
  assert.equal(removed.slides[0]?.objects[0]?.decisionReplacement, undefined);
  assert.equal(removed.slides[0]?.objects[0]?.scope, undefined);
  assert.equal(removed.slides[0]?.objects[0]?.locked, undefined);
  assert.equal(removed.slides[0]?.objects[0]?.decision, 'remove');
  assert.equal(removed.revision, 3);

  assert.equal(applyDecision(plan, 'missing', { action: 'keep' }), null);
  assert.equal(plan.revision, 1, 'the plan that went in is not touched');
});

test('an agent decision records its author', () => {
  const plan = applyDecision(planFixture(1), 's2.a', { action: 'keep', author: 'agent', review: 'needs-attention' });
  assert.ok(plan);
  assert.equal(plan.slides[1]?.objects[0]?.author, 'agent');
  assert.equal(plan.slides[1]?.objects[0]?.review, 'needs-attention');
});

test('openProject answers null for a project that is not stored', async () => {
  const store = new MemoryStore();
  assert.equal(await openProject(store, 'nothing'), null);
});

// ─── one plan transaction ────────────────────────────────────────────────────

/** A plan with one row decided, the way a pure edit hands it back: same revision. */
function editedPlan(plan: RenovationPlanV1): RenovationPlanV1 {
  const next = applyDecision(plan, 's1.a', { action: 'remove' });
  assert.ok(next);
  return { ...next, revision: plan.revision };
}

test('commitPlan writes the plan and the review checkpoint once, one revision on', async () => {
  const store = new MemoryStore();
  const project = await projectWithPlan(store, planFixture(4));
  const before = store.writes.length;
  const res = await commitPlan(store, project, editedPlan(planFixture(4)));
  assert.equal(res.outcome, 'committed');
  if (res.outcome !== 'committed') return;
  assert.deepEqual(store.writes.slice(before), ['part:plan', 'checkpoint:review']);
  assert.equal(res.plan.revision, 5);
  assert.equal(res.project.checkpoint.stage, 'review');
  assert.equal(res.project.checkpoint.planRevision, 5);
  assert.equal(res.project.revision, project.revision + 2);
  const stored = await store.getPart<RenovationPlanV1>(project.id, 'plan');
  assert.equal(stored?.revision, 5);
  assert.equal(stored?.slides[0]?.objects[0]?.decision, 'remove');
  assert.equal(resumePoint(res.project).resumeFrom, 'compile');
});

test('commitPlan moves past the checkpointed revision when the plan in hand is behind it', async () => {
  const store = new MemoryStore();
  const project = await projectWithPlan(store, planFixture(7));
  const res = await commitPlan(store, project, editedPlan(planFixture(3)));
  assert.equal(res.outcome, 'committed');
  if (res.outcome === 'committed') assert.equal(res.plan.revision, 8);
});

test('commitPlan from a handle that fell behind writes nothing and hands back the stored project', async () => {
  const store = new MemoryStore();
  const project = await projectWithPlan(store);
  const other = await store.update(project.id, project.revision, { name: 'Renamed elsewhere' });
  assert.ok(other.ok);
  const before = store.writes.length;
  const res = await commitPlan(store, project, editedPlan(planFixture(1)));
  assert.equal(res.outcome, 'reload');
  if (res.outcome !== 'reload') return;
  assert.equal(res.project?.name, 'Renamed elsewhere');
  assert.equal(res.currentRevision, project.revision + 1);
  assert.equal(store.writes.length, before, 'nothing was written');
  assert.equal((await store.getPart<RenovationPlanV1>(project.id, 'plan'))?.slides[0]?.objects[0]?.decision, undefined);
});

test('commitPlan on a full device keeps the next plan in memory and offers the download', async () => {
  const store = new MemoryStore();
  const project = await projectWithPlan(store, planFixture(2));
  store.quotaFull = true;
  const res = await commitPlan(store, project, editedPlan(planFixture(2)));
  assert.equal(res.outcome, 'held');
  if (res.outcome !== 'held') return;
  assert.equal(res.plan.revision, 3);
  assert.equal(res.held.offer, 'download-project');
  assert.equal(res.held.value, res.plan);
  assert.equal((await store.get(project.id))?.revision, project.revision, 'the project did not move');
});

test('commitPlan whose checkpoint is refused says the plan is stored', async () => {
  const store = new MemoryStore();
  const project = await projectWithPlan(store, planFixture(1));
  store.checkpointRefusal = { ok: false, refusal: 'stale-revision', message: 'Another view moved it.', currentRevision: 99 };
  const res = await commitPlan(store, project, editedPlan(planFixture(1)));
  assert.equal(res.outcome, 'uncheckpointed');
  if (res.outcome !== 'uncheckpointed') return;
  assert.equal(res.refusal, 'stale-revision');
  assert.equal(res.plan.revision, 2);
  assert.equal(res.project.revision, project.revision + 1, 'the handle is the one after the plan write');
  assert.equal((await store.getPart<RenovationPlanV1>(project.id, 'plan'))?.revision, 2);
});

test('commitPlan for a project that is gone is refused', async () => {
  const store = new MemoryStore();
  const project = await projectWithPlan(store);
  await store.remove(project.id);
  const res = await commitPlan(store, project, editedPlan(planFixture(1)));
  assert.equal(res.outcome, 'refused');
  if (res.outcome === 'refused') assert.equal(res.refusal, 'missing-project');
});

// ─── stepping a checkpoint back ──────────────────────────────────────────────

/** A plan, reviewed and compiled: the case "undo for advance" is for. */
async function projectCompiled(store: MemoryStore): Promise<RenovationProjectV1> {
  const planned = await projectWithPlan(store, planFixture(2));
  const reviewed = await ranStage(store, planned, 'review', null);
  return await ranStage(store, reviewed, 'compile', compiledFixture(2));
}

test('rewindTo review after a compile reopens the plan and keeps the compiled part', async () => {
  const store = new MemoryStore();
  const project = await projectCompiled(store);
  assert.equal(resumePoint(project).resumeFrom, null);
  const res = await rewindTo(store, project, 'review');
  assert.equal(res.outcome, 'rewound');
  if (res.outcome !== 'rewound') return;
  assert.equal(res.project.checkpoint.stage, 'review');
  assert.equal(res.project.checkpoint.planRevision, 2, 'the guard revision is kept');
  assert.equal(resumePoint(res.project).resumeFrom, 'compile');
  assert.ok(res.project.parts.compiled, 'the compiled part is still named');
  assert.equal((await store.getPart<CompiledDeckV1>(project.id, 'compiled'))?.planRevision, 2);

  // The compile can run again from there.
  const again = await advance(store, res.project, 'compile', runnerFor(compiledFixture(3)));
  assert.equal(again.outcome, 'advanced');
});

test('rewindTo refuses to move forward and writes nothing', async () => {
  const store = new MemoryStore();
  const project = await projectWithPlan(store);
  const before = store.writes.length;
  const res = await rewindTo(store, project, 'compile');
  assert.equal(res.outcome, 'refused');
  assert.equal(store.writes.length, before);
});

test('rewindTo the stage already checkpointed writes nothing', async () => {
  const store = new MemoryStore();
  const project = await projectWithPlan(store);
  const before = store.writes.length;
  const res = await rewindTo(store, project, 'plan');
  assert.equal(res.outcome, 'rewound');
  if (res.outcome === 'rewound') assert.equal(res.project.revision, project.revision);
  assert.equal(store.writes.length, before);
});

test('rewindTo a stage whose record is not stored is refused', async () => {
  const store = new MemoryStore();
  const project = await projectCompiled(store);
  const { census: _census, ...parts } = project.parts;
  const damaged: RenovationProjectV1 = { ...project, parts };
  store.projects.set(project.id, damaged);
  const res = await rewindTo(store, damaged, 'plan');
  assert.equal(res.outcome, 'refused');
  if (res.outcome === 'refused') assert.match(res.message, /census/);
});

test('rewindTo from a stale handle reloads', async () => {
  const store = new MemoryStore();
  const project = await projectCompiled(store);
  const other = await store.update(project.id, project.revision, { name: 'Moved on' });
  assert.ok(other.ok);
  const res = await rewindTo(store, project, 'review');
  assert.equal(res.outcome, 'reload');
  if (res.outcome === 'reload') assert.equal(res.project?.name, 'Moved on');
  assert.equal((await store.get(project.id))?.checkpoint.stage, 'compile');
});

test('rewindTo a project that committed nothing is refused', async () => {
  const store = new MemoryStore();
  const project = await newProject(store);
  const res = await rewindTo(store, project, 'ingest');
  assert.equal(res.outcome, 'refused');
});
