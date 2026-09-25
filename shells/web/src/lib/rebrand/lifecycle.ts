// SPDX-License-Identifier: MPL-2.0
/**
 * Renovation project lifecycle (plan 274 section 3.5, WP 0b): open, advance a
 * stage, record one decision, commit a whole edited plan as one transaction,
 * step a checkpoint back, and refuse a write that would overwrite work another
 * tab already committed.
 *
 * Everything here is a function over two injected interfaces and nothing else.
 * The store is `RenovationProjectStoreV1`, so the same rules hold over the web
 * store (host.state plus the user asset store), a node directory store and a
 * test store. The stage runner arrives as a function type rather than an import,
 * so this module never reaches into the worker side of the journey. No DOM, no
 * clock, no network, no storage of its own.
 *
 * Five rules this file exists to hold:
 *
 * 1. Every write carries the revision the caller read. A different stored
 *    revision refuses the write and the caller reloads rather than retrying.
 *    Two tabs on one project never apply last writer wins to a person's
 *    decisions.
 * 2. A quota refusal keeps the in-memory result and offers a download. It is
 *    never reported as a save. "Saved on this device" belongs after an `ok`
 *    write, and nowhere else.
 * 3. The reverse reading is held to just as hard. A stage writes its part and
 *    its checkpoint as two store calls, because the contract has no call that
 *    does both. When the part is written and the checkpoint is refused, the
 *    answer is `uncheckpointed`: the work IS on the device, no download is
 *    offered as if it were the only copy, and the fresh project handle comes
 *    back so the caller can mark the stage on its own.
 * 4. Cancelling a stage stops the work and writes nothing. Every decision that
 *    was already committed and the last checkpoint stay exactly as they were.
 *    Only an abort-shaped rejection reads as a cancel: a stage that failed for
 *    its own reason keeps its message, whatever the signal was doing.
 * 5. A stage runs at the resume point or behind it, never ahead of it. A jump
 *    would mark a stage complete over parts that were never written.
 *
 * A stage result is accepted only when its project id and stage match what the
 * caller holds, and when the plan revision it carries is not older than the
 * checkpointed one. That revision is read from the result record first and from
 * the envelope second, because the envelope's field is optional and a worker
 * that leaves it unset would otherwise walk past the guard. A worker reply that
 * arrives after the person moved on is discarded.
 */
import type {
  CompiledDeckV1,
  DeckCensusV1,
  DecisionAuthorV1,
  ObjectPlanV1,
  PlanActionV1,
  ProjectPartKindV1,
  ProjectStageV1,
  ProjectWriteRefusalV1,
  ProjectWriteResultV1,
  RenovationPlanV1,
  RenovationProjectStoreV1,
  RenovationProjectV1,
  ReplacementV1,
  ReviewStateV1,
  SourceDeckV1,
  StageEnvelopeV1,
} from '@lolly-tools/core';
import { PROJECT_STAGES } from '@lolly-tools/core';

/** The four big records a stage can produce, in the order the stages run. */
export type StagePartValueV1 = SourceDeckV1 | DeckCensusV1 | RenovationPlanV1 | CompiledDeckV1;

/**
 * Which part a completed stage writes. `review` writes the plan again, because a
 * person's decisions live in the plan. `done` writes nothing.
 */
export const STAGE_PART: Readonly<Record<ProjectStageV1, ProjectPartKindV1 | null>> = Object.freeze({
  ingest: 'sourceDeck',
  census: 'census',
  plan: 'plan',
  review: 'plan',
  compile: 'compiled',
  done: null,
});

// ─── opening a project ───────────────────────────────────────────────────────

export interface OpenedProjectV1 {
  project: RenovationProjectV1;
  /**
   * The stage to run next, or null when the project is finished. A checkpoint
   * with no `at` has committed nothing, so its own stage is the one to run.
   */
  resumeFrom: ProjectStageV1 | null;
  /**
   * True when the next stage needs the original file and neither the retained
   * bytes nor an ingested source deck is on hand. The view asks for the same
   * file rather than guessing.
   */
  needsSource: boolean;
  /**
   * Present when the stored checkpoint names a stage this build does not know,
   * which happens after a newer version wrote the project or after the record
   * was damaged. `resumeFrom` is null in that case: there is nothing safe to run,
   * and the view says so rather than restarting the first stage over a source
   * deck that is already there.
   */
  unknownStage?: string;
}

/**
 * The stage after this one, or null at the end of the list and for a stage name
 * this build does not know. An unknown name never reads as "start again".
 */
export function nextStage(stage: ProjectStageV1): ProjectStageV1 | null {
  const at = PROJECT_STAGES.indexOf(stage);
  if (at < 0) return null;
  return PROJECT_STAGES[at + 1] ?? null;
}

/**
 * Reads a project and says where work picks up. Reads nothing else: the part
 * records stay on disk until a caller asks for one.
 */
export async function openProject(
  store: RenovationProjectStoreV1,
  id: string,
): Promise<OpenedProjectV1 | null> {
  const project = await store.get(id);
  if (!project) return null;
  return { project, ...resumePoint(project) };
}

/** The resume point of a project already in hand. Pure. */
export function resumePoint(project: RenovationProjectV1): Omit<OpenedProjectV1, 'project'> {
  const stage = project.checkpoint.stage;
  if (!PROJECT_STAGES.includes(stage)) {
    return { resumeFrom: null, needsSource: false, unknownStage: String(stage) };
  }
  const committed = typeof project.checkpoint.at === 'string' && project.checkpoint.at.length > 0;
  const after = committed ? nextStage(stage) : stage;
  const resumeFrom: ProjectStageV1 | null = after === 'done' ? null : after;

  const hasBytes = typeof project.source.bytesAssetRef === 'string' && project.source.bytesAssetRef.length > 0;
  const hasDeck = typeof project.parts.sourceDeck === 'string' && project.parts.sourceDeck.length > 0;
  // Ingest reads the original bytes and every stage after it reads the record
  // ingest wrote, so a project holding neither needs the same file again
  // whatever its checkpoint says. Reading this from the parts rather than from
  // the stage name is what keeps a project that was marked complete without its
  // source deck repairable.
  const needsSource = resumeFrom !== null && !hasBytes && !hasDeck;
  return { resumeFrom, needsSource };
}

// ─── advancing one stage ─────────────────────────────────────────────────────

/**
 * Work the store would not take. The caller keeps it and offers a `.lolly`
 * download, which is the person's own backup whether or not the browser granted
 * persistent storage.
 */
export interface HeldWorkV1 {
  kind: ProjectPartKindV1 | null;
  value: StagePartValueV1 | null;
  offer: 'download-project';
}

export type AdvanceResultV1 =
  /** The part and the checkpoint were written. `project` is re-read from the store. */
  | { outcome: 'advanced'; project: RenovationProjectV1; part: ProjectPartKindV1 | null }
  /** The caller aborted. Nothing was written, so the last checkpoint stands. */
  | { outcome: 'cancelled'; project: RenovationProjectV1 }
  /** The runner answered about another project, another stage or an older plan revision. */
  | { outcome: 'discarded'; project: RenovationProjectV1; message: string }
  /** Another handle moved the project on. Reload and do not retry blindly. */
  | { outcome: 'reload'; project: RenovationProjectV1 | null; message: string; currentRevision?: number }
  /** Storage is full. The work is in memory and a download is offered. */
  | { outcome: 'held'; project: RenovationProjectV1; message: string; held: HeldWorkV1 }
  /**
   * The part is written and the stage is not marked complete. Nothing is lost
   * and nothing is held: `markStageComplete` with the project handed back here
   * finishes the job.
   */
  | {
      outcome: 'uncheckpointed';
      project: RenovationProjectV1;
      stage: ProjectStageV1;
      part: ProjectPartKindV1 | null;
      planRevision?: number;
      refusal: ProjectWriteRefusalV1;
      message: string;
    }
  | { outcome: 'refused'; project: RenovationProjectV1; refusal: ProjectWriteRefusalV1; message: string }
  /** The runner threw. Nothing was written. */
  | { outcome: 'failed'; project: RenovationProjectV1; message: string };

/**
 * Runs one stage and answers with an envelope. Injected, so this module carries
 * no dependency on the worker, the parsers or the engine. A runner that produces
 * no new record for its stage answers with `result: null`, which is accepted only
 * when the stage's part is already stored (the review stage over a plan the
 * decisions were written into). Throwing is allowed and reported as `failed`.
 */
export type StageRunnerV1 = (
  project: RenovationProjectV1,
  stage: ProjectStageV1,
  signal?: AbortSignal,
) => Promise<StageEnvelopeV1<StagePartValueV1 | null>>;

export interface AdvanceOptsV1 {
  /**
   * Cancels the stage. Checked before the runner starts and again before the
   * first write, so an abort that arrives while the runner was busy still
   * writes nothing.
   */
  signal?: AbortSignal;
}

/**
 * Runs `stage`, writes its part under the revision the caller read, marks the
 * checkpoint, and answers with the re-read project. Every refusal comes back for
 * the caller to show; none of them is retried here.
 */
export async function advance(
  store: RenovationProjectStoreV1,
  project: RenovationProjectV1,
  stage: ProjectStageV1,
  run: StageRunnerV1,
  opts: AdvanceOptsV1 = {},
): Promise<AdvanceResultV1> {
  const { signal } = opts;
  if (signal?.aborted) return { outcome: 'cancelled', project };

  const ordering = stageOrderRefusal(project, stage);
  if (ordering) return { outcome: 'discarded', project, message: ordering };

  let envelope: StageEnvelopeV1<StagePartValueV1 | null>;
  try {
    envelope = await run(project, stage, signal);
  } catch (err) {
    if (signal?.aborted && isAbortError(err)) return { outcome: 'cancelled', project };
    return { outcome: 'failed', project, message: messageOf(err) };
  }

  // Cancel that arrived while the runner was busy: keep the last checkpoint and
  // write nothing at all.
  if (signal?.aborted) return { outcome: 'cancelled', project };

  const stale = staleEnvelope(project, stage, envelope);
  if (stale) return { outcome: 'discarded', project, message: stale };

  const kind = STAGE_PART[stage];
  const value = envelope.result;
  const planRevision = planRevisionFor(project, envelope, value);

  if (kind !== null && value === null && !hasPart(project, kind)) {
    // Marking this stage complete would leave the project with no record to
    // resume from and no way back to the file it came from.
    return {
      outcome: 'failed',
      project,
      message: `The ${stage} stage produced no ${kind}, so there is nothing to record.`,
    };
  }

  if (kind !== null && value !== null) {
    const written = await store.putPart(project.id, project.revision, kind, value);
    if (!written.ok) return await refusalResult(store, project, written, { kind, value, offer: 'download-project' });
    // The part is on the device from here on, so a later refusal is never
    // reported as work that was not saved.
    return await afterPart(store, project, stage, kind, written.revision, planRevision);
  }

  const marked = await store.checkpoint(project.id, project.revision, stage, planRevision);
  if (!marked.ok) {
    if (marked.refusal === 'stale-revision') {
      const fresh = await store.get(project.id);
      return { outcome: 'reload', project: fresh, message: staleMessage(marked), currentRevision: marked.currentRevision };
    }
    return { outcome: 'refused', project, refusal: marked.refusal, message: marked.message };
  }
  return await reread(store, project, null);
}

/**
 * Marks a stage complete on its own. The retry for an `uncheckpointed` result:
 * the part is already stored, so this writes the checkpoint and nothing else.
 */
export async function markStageComplete(
  store: RenovationProjectStoreV1,
  project: RenovationProjectV1,
  stage: ProjectStageV1,
  planRevision?: number,
): Promise<AdvanceResultV1> {
  const marked = await store.checkpoint(project.id, project.revision, stage, planRevision);
  if (marked.ok) return await reread(store, project, null);
  const fresh = await store.get(project.id);
  if (!fresh) {
    return { outcome: 'refused', project, refusal: 'missing-project', message: MISSING_PROJECT };
  }
  return {
    outcome: 'uncheckpointed',
    project: fresh,
    stage,
    part: STAGE_PART[stage],
    ...(planRevision === undefined ? {} : { planRevision }),
    refusal: marked.refusal,
    message: uncheckpointedMessage(stage, marked),
  };
}

/** The checkpoint half of `advance`, run once the part is durably written. */
async function afterPart(
  store: RenovationProjectStoreV1,
  project: RenovationProjectV1,
  stage: ProjectStageV1,
  kind: ProjectPartKindV1,
  revision: number,
  planRevision?: number,
): Promise<AdvanceResultV1> {
  const marked = await store.checkpoint(project.id, revision, stage, planRevision);
  if (marked.ok) return await reread(store, project, kind);

  const fresh = await store.get(project.id);
  if (!fresh) {
    return { outcome: 'refused', project, refusal: 'missing-project', message: MISSING_PROJECT };
  }
  return {
    outcome: 'uncheckpointed',
    project: fresh,
    stage,
    part: kind,
    ...(planRevision === undefined ? {} : { planRevision }),
    refusal: marked.refusal,
    message: uncheckpointedMessage(stage, marked),
  };
}

async function reread(
  store: RenovationProjectStoreV1,
  project: RenovationProjectV1,
  part: ProjectPartKindV1 | null,
): Promise<AdvanceResultV1> {
  const fresh = await store.get(project.id);
  if (!fresh) {
    return { outcome: 'refused', project, refusal: 'missing-project', message: MISSING_PROJECT };
  }
  return { outcome: 'advanced', project: fresh, part };
}

/**
 * Why this stage cannot run against this project yet, or null when it can.
 * Re-running a stage that already completed stays allowed, because a person can
 * ask for a fresh census or a fresh plan; running ahead of the resume point is
 * what this refuses.
 */
function stageOrderRefusal(project: RenovationProjectV1, stage: ProjectStageV1): string | null {
  const asked = PROJECT_STAGES.indexOf(stage);
  if (asked < 0) return `"${String(stage)}" is not a stage of this journey.`;
  const point = resumePoint(project);
  if (point.unknownStage !== undefined) {
    return `This project stopped at "${point.unknownStage}", which this version of Lolly cannot read. It was probably made by a newer version.`;
  }
  const limit = point.resumeFrom === null ? PROJECT_STAGES.length - 1 : PROJECT_STAGES.indexOf(point.resumeFrom);
  if (asked > limit) {
    return `The ${stage} stage comes after ${point.resumeFrom ?? 'done'}, which has not finished yet.`;
  }
  return null;
}

function hasPart(project: RenovationProjectV1, kind: ProjectPartKindV1): boolean {
  const at = project.parts[kind];
  return typeof at === 'string' && at.length > 0;
}

// ─── recording one decision ──────────────────────────────────────────────────

export interface DecisionInputV1 {
  action: PlanActionV1;
  replacement?: ReplacementV1;
  /** Who chose. Defaults to `user`, because this path is the review surface. */
  author?: DecisionAuthorV1;
  /** Defaults to `accepted`: a person just looked at it. */
  review?: ReviewStateV1;
  /** The group the decision was applied through, when it was a group action. */
  scope?: string;
  locked?: boolean;
}

export type DecisionResultV1 =
  | { outcome: 'recorded'; project: RenovationProjectV1; plan: RenovationPlanV1 }
  | { outcome: 'reload'; project: RenovationProjectV1 | null; message: string; currentRevision?: number }
  | { outcome: 'held'; project: RenovationProjectV1; plan: RenovationPlanV1; message: string; held: HeldWorkV1 }
  /**
   * The choice is stored and the checkpointed plan revision was not moved on, so
   * a stage result computed before the choice would still pass the guard. The
   * caller reloads or marks the stage again.
   */
  | {
      outcome: 'uncheckpointed';
      project: RenovationProjectV1;
      plan: RenovationPlanV1;
      refusal: ProjectWriteRefusalV1;
      message: string;
    }
  | { outcome: 'refused'; project: RenovationProjectV1; refusal: ProjectWriteRefusalV1; message: string }
  | { outcome: 'not-found'; project: RenovationProjectV1; message: string };

/**
 * Writes one person's choice about one object, in one short transaction plus the
 * checkpoint that moves the plan revision.
 *
 * It rewrites that object's plan entry and nothing else: every other object,
 * every colour and font mapping and the carry-forward memory come through
 * untouched, and no proposal is regenerated. A proposal a rule made stays
 * readable beside the decision, which is what lets the review show who chose
 * what. Carry-forward memory is written by the plan stage, not here, because it
 * is keyed by fingerprint and this path holds only the object id.
 *
 * The plan's own `revision` goes up by one and the checkpoint records it, so a
 * worker reply computed before the choice reads as older and is discarded. A
 * project that has committed no stage yet has no revision to guard, so the
 * checkpoint write is skipped rather than marking a stage nobody finished.
 */
export async function recordDecision(
  store: RenovationProjectStoreV1,
  project: RenovationProjectV1,
  objectId: string,
  decision: DecisionInputV1,
): Promise<DecisionResultV1> {
  const plan = await store.getPart<RenovationPlanV1>(project.id, 'plan');
  if (!plan) {
    return { outcome: 'not-found', project, message: 'This project has no renovation plan yet.' };
  }

  const next = applyDecision(plan, objectId, decision);
  if (!next) {
    return { outcome: 'not-found', project, message: `No object "${objectId}" in this plan.` };
  }

  const written = await store.putPart(project.id, project.revision, 'plan', next);
  if (!written.ok) {
    if (written.refusal === 'stale-revision') {
      const fresh = await store.get(project.id);
      return { outcome: 'reload', project: fresh, message: staleMessage(written), currentRevision: written.currentRevision };
    }
    if (written.refusal === 'quota') {
      return {
        outcome: 'held',
        project,
        plan: next,
        message: quotaMessage(),
        held: { kind: 'plan', value: next, offer: 'download-project' },
      };
    }
    return { outcome: 'refused', project, refusal: written.refusal, message: written.message };
  }

  const committed = typeof project.checkpoint.at === 'string' && project.checkpoint.at.length > 0;
  if (committed) {
    const marked = await store.checkpoint(project.id, written.revision, project.checkpoint.stage, next.revision);
    if (!marked.ok) {
      const after = await store.get(project.id);
      return {
        outcome: 'uncheckpointed',
        project: after ?? project,
        plan: next,
        refusal: marked.refusal,
        message: `Your choice is saved on this device. Recording it as plan revision ${next.revision} was refused, so a result that was already running could still write over it. Reload the project before carrying on.`,
      };
    }
  }

  const fresh = await store.get(project.id);
  if (!fresh) {
    return { outcome: 'refused', project, refusal: 'missing-project', message: MISSING_PROJECT };
  }
  return { outcome: 'recorded', project: fresh, plan: next };
}

/**
 * The pure half of `recordDecision`: a new plan with one object entry replaced
 * and the plan revision moved on by one, or null when no slide holds that
 * object. Slides and objects that did not change come through as the same values
 * they went in as.
 */
export function applyDecision(
  plan: RenovationPlanV1,
  objectId: string,
  decision: DecisionInputV1,
): RenovationPlanV1 | null {
  let found = false;
  const slides = plan.slides.map((slide) => {
    if (found) return slide;
    let touched = false;
    const objects = slide.objects.map((obj) => {
      if (obj.id !== objectId) return obj;
      touched = true;
      found = true;
      return decided(obj, decision);
    });
    return touched ? { ...slide, objects } : slide;
  });
  if (!found) return null;
  return { ...plan, slides, revision: plan.revision + 1 };
}

function decided(obj: ObjectPlanV1, decision: DecisionInputV1): ObjectPlanV1 {
  const next: ObjectPlanV1 = {
    ...obj,
    decision: decision.action,
    review: decision.review ?? 'accepted',
    author: decision.author ?? 'user',
  };
  // The three fields a decision carries are set together and cleared together.
  // A choice made on one object after a group action is not the group's choice,
  // and a lock from an earlier call has to be clearable through the same path
  // that set it.
  if (decision.replacement !== undefined) next.decisionReplacement = decision.replacement;
  else delete next.decisionReplacement;
  if (decision.scope !== undefined) next.scope = decision.scope;
  else delete next.scope;
  if (decision.locked !== undefined) next.locked = decision.locked;
  else delete next.locked;
  return next;
}

// ─── one plan transaction ────────────────────────────────────────────────────

export type PlanCommitResultV1 =
  /** The plan and the review checkpoint were written. `project` is re-read from the store. */
  | { outcome: 'committed'; project: RenovationProjectV1; plan: RenovationPlanV1 }
  /** Another handle moved the project on. Nothing was written. */
  | { outcome: 'reload'; project: RenovationProjectV1 | null; message: string; currentRevision?: number }
  /** Storage is full. `plan` is the revision that would have been written, kept in memory. */
  | { outcome: 'held'; project: RenovationProjectV1; plan: RenovationPlanV1; message: string; held: HeldWorkV1 }
  /**
   * The plan is stored and the checkpoint was refused, so the plan revision the
   * guard reads did not move. `project` is the stored record after the plan write.
   */
  | {
      outcome: 'uncheckpointed';
      project: RenovationProjectV1;
      plan: RenovationPlanV1;
      refusal: ProjectWriteRefusalV1;
      message: string;
    }
  | { outcome: 'refused'; project: RenovationProjectV1; refusal: ProjectWriteRefusalV1; message: string };

/**
 * Writes a whole edited plan as one transaction: the view's group apply, Accept
 * all suggestions, an undo and a redo each come through here once.
 *
 * The stored record is read first and its revision compared with the one the
 * caller holds, so a handle that fell behind is refused before anything is
 * written. The plan goes in with its revision moved past both its own and the
 * checkpointed one, and the checkpoint is then set to `review` with that
 * revision, so a stage result computed before the edit reads as older and is
 * discarded. An edit made after a compile moves the checkpoint back to review
 * this way too; the compiled part stays where it is.
 *
 * `plan` is the edited plan as the pure edit returned it, with the revision it
 * was read at. Nothing else about it is changed here.
 */
export async function commitPlan(
  store: RenovationProjectStoreV1,
  project: RenovationProjectV1,
  plan: RenovationPlanV1,
): Promise<PlanCommitResultV1> {
  const stored = await store.get(project.id);
  if (!stored) return { outcome: 'refused', project, refusal: 'missing-project', message: MISSING_PROJECT };
  if (stored.revision !== project.revision) {
    return {
      outcome: 'reload',
      project: stored,
      message: staleMessage({ ok: false, refusal: 'stale-revision', message: '', currentRevision: stored.revision }),
      currentRevision: stored.revision,
    };
  }

  const floor = Math.max(plan.revision, project.checkpoint.planRevision ?? 0);
  const next: RenovationPlanV1 = { ...plan, revision: floor + 1 };

  const written = await store.putPart(project.id, project.revision, 'plan', next);
  if (!written.ok) {
    if (written.refusal === 'stale-revision') {
      const fresh = await store.get(project.id);
      return { outcome: 'reload', project: fresh, message: staleMessage(written), currentRevision: written.currentRevision };
    }
    if (written.refusal === 'quota') {
      return {
        outcome: 'held',
        project,
        plan: next,
        message: quotaMessage(),
        held: { kind: 'plan', value: next, offer: 'download-project' },
      };
    }
    return { outcome: 'refused', project, refusal: written.refusal, message: written.message };
  }

  const marked = await store.checkpoint(project.id, written.revision, 'review', next.revision);
  const fresh = await store.get(project.id);
  if (!marked.ok) {
    return {
      outcome: 'uncheckpointed',
      project: fresh ?? project,
      plan: next,
      refusal: marked.refusal,
      message: `The plan is saved on this device. Recording it as plan revision ${next.revision} was refused, so a result that was already running could still write over it. Reload the project before carrying on.`,
    };
  }
  if (!fresh) return { outcome: 'refused', project, refusal: 'missing-project', message: MISSING_PROJECT };
  return { outcome: 'committed', project: fresh, plan: next };
}

// ─── stepping a checkpoint back ──────────────────────────────────────────────

export type RewindResultV1 =
  /** The checkpoint now names `stage`. Every part is where it was. */
  | { outcome: 'rewound'; project: RenovationProjectV1 }
  | { outcome: 'reload'; project: RenovationProjectV1 | null; message: string; currentRevision?: number }
  | { outcome: 'refused'; project: RenovationProjectV1; refusal?: ProjectWriteRefusalV1; message: string };

/**
 * The inverse of `advance` for the checkpoint alone: marks an earlier stage as
 * the last one completed, so work resumes from the stage after it. Moving back
 * to `review` after a compile is the case this is for: the plan is open to
 * edits again, and the compiled part stays stored as the previous baseline.
 *
 * Nothing is deleted and no part is written. The plan revision the checkpoint
 * carries is kept, never lowered, because lowering it would let a stage result
 * from before the last edit through the guard. A rewind goes back or stays put;
 * moving forward is `advance`, so a later stage is refused, and so is a stage
 * whose own record, or a record before it, is not stored.
 */
export async function rewindTo(
  store: RenovationProjectStoreV1,
  project: RenovationProjectV1,
  stage: ProjectStageV1,
): Promise<RewindResultV1> {
  const target = PROJECT_STAGES.indexOf(stage);
  if (target < 0) return { outcome: 'refused', project, message: `"${String(stage)}" is not a stage of this journey.` };
  const point = resumePoint(project);
  if (point.unknownStage !== undefined) {
    return {
      outcome: 'refused',
      project,
      message: `This project stopped at "${point.unknownStage}", which this version of Lolly cannot read, so there is nothing safe to step back from.`,
    };
  }
  const committed = typeof project.checkpoint.at === 'string' && project.checkpoint.at.length > 0;
  const current = PROJECT_STAGES.indexOf(project.checkpoint.stage);
  if (!committed || target > current) {
    return { outcome: 'refused', project, message: `The ${stage} stage is not behind the last completed stage, so there is nothing to step back to.` };
  }
  for (const earlier of PROJECT_STAGES.slice(0, target + 1)) {
    const kind = STAGE_PART[earlier];
    if (kind !== null && !hasPart(project, kind)) {
      return { outcome: 'refused', project, message: `The ${earlier} stage has no stored ${kind}, so work cannot resume after it.` };
    }
  }
  if (target === current) return { outcome: 'rewound', project };

  const marked = await store.checkpoint(project.id, project.revision, stage, project.checkpoint.planRevision);
  if (!marked.ok) {
    if (marked.refusal === 'stale-revision') {
      const fresh = await store.get(project.id);
      return { outcome: 'reload', project: fresh, message: staleMessage(marked), currentRevision: marked.currentRevision };
    }
    return { outcome: 'refused', project, refusal: marked.refusal, message: marked.message };
  }
  const fresh = await store.get(project.id);
  if (!fresh) return { outcome: 'refused', project, refusal: 'missing-project', message: MISSING_PROJECT };
  return { outcome: 'rewound', project: fresh };
}

// ─── shared refusal handling ─────────────────────────────────────────────────

const MISSING_PROJECT = 'This project is no longer stored on this device.';

async function refusalResult(
  store: RenovationProjectStoreV1,
  project: RenovationProjectV1,
  written: Extract<ProjectWriteResultV1, { ok: false }>,
  held: HeldWorkV1,
): Promise<AdvanceResultV1> {
  if (written.refusal === 'stale-revision') {
    const fresh = await store.get(project.id);
    return { outcome: 'reload', project: fresh, message: staleMessage(written), currentRevision: written.currentRevision };
  }
  if (written.refusal === 'quota') {
    return { outcome: 'held', project, message: quotaMessage(), held };
  }
  return { outcome: 'refused', project, refusal: written.refusal, message: written.message };
}

function staleMessage(written: Extract<ProjectWriteResultV1, { ok: false }>): string {
  const at = typeof written.currentRevision === 'number' ? ` It is now at revision ${written.currentRevision}.` : '';
  return `This project changed somewhere else, so the write was refused.${at} Reload it before making the change again.`;
}

function quotaMessage(): string {
  return 'There was not enough room to save this on the device. The work is still open here, and you can download the project to keep it.';
}

function uncheckpointedMessage(stage: ProjectStageV1, marked: Extract<ProjectWriteResultV1, { ok: false }>): string {
  return `The ${stage} result is saved on this device, and marking that stage complete was refused: ${marked.message} Nothing was lost, so marking it again is all this needs.`;
}

/**
 * Why a runner's answer cannot be applied, or null when it can. Reading the
 * envelope's own identity is what stops a reply that was in flight while the
 * person moved on from landing on top of a newer choice.
 *
 * The plan revision is read from the result record first, because
 * `StageEnvelopeV1.planRevision` is optional and a runner that leaves it unset
 * would otherwise carry an old plan straight past this. A revision NEWER than the
 * checkpointed one is not stale: that is what a fresh plan looks like.
 *
 * `envelope.algorithmVersion` is not compared here, and that gap is stated rather
 * than hidden. The project record carries no algorithm versions to compare
 * against (the plan carries its own, in `algorithms`), so the check belongs with
 * the caller that holds the plan.
 */
export function staleEnvelope(
  project: RenovationProjectV1,
  stage: ProjectStageV1,
  envelope: StageEnvelopeV1<unknown>,
): string | null {
  if (envelope.projectId !== project.id) return 'That result belongs to another project.';
  if (envelope.stage !== stage) return `That result is for the ${envelope.stage} stage, not ${stage}.`;
  const committed = project.checkpoint.planRevision;
  const carried = planRevisionOf(envelope.result) ?? envelope.planRevision;
  if (typeof carried === 'number' && typeof committed === 'number' && carried < committed) {
    return `That result is from plan revision ${carried}; this project is on ${committed}.`;
  }
  return null;
}

/**
 * The plan revision a stage record belongs to: a plan states its own `revision`,
 * a compiled deck states the `planRevision` it was compiled from, and the two
 * records that predate a plan state neither.
 */
function planRevisionOf(value: unknown): number | undefined {
  if (value === null || typeof value !== 'object') return undefined;
  const rec = value as { revision?: unknown; planRevision?: unknown };
  if (typeof rec.planRevision === 'number') return rec.planRevision;
  if (typeof rec.revision === 'number') return rec.revision;
  return undefined;
}

/**
 * The plan revision to checkpoint. It never goes backwards: a stale result is
 * refused before this runs, and a rewind here would disarm the guard for every
 * result after it.
 */
function planRevisionFor(
  project: RenovationProjectV1,
  envelope: StageEnvelopeV1<StagePartValueV1 | null>,
  value: StagePartValueV1 | null,
): number | undefined {
  const committed = project.checkpoint.planRevision;
  const carried = planRevisionOf(value) ?? envelope.planRevision ?? committed;
  if (typeof carried !== 'number') return committed;
  if (typeof committed === 'number') return Math.max(carried, committed);
  return carried;
}

/** An abort-shaped rejection, so a stage that failed on its own keeps its message. */
function isAbortError(err: unknown): boolean {
  if (err instanceof Error) return err.name === 'AbortError' || err.name === 'TimeoutError';
  return typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError';
}

function messageOf(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return String(err);
}
