// SPDX-License-Identifier: MPL-2.0
/**
 * The renovation stage runner, its registry, the worker protocol and the heavy
 * slot rule (plan 274 section 9, "Work scheduling").
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/lib/rebrand/stage-runner.test.ts
 *
 * There is no Worker in this realm, so the runner's in-realm fallback is what most
 * of these cases exercise, which is the point: the fallback has to carry the same
 * envelope and the same cancellation semantics as the worker path, or the CLI and
 * the node tests are proving nothing about the browser. The worker path itself is
 * driven through a fake worker and, for the other half of the protocol, by
 * installing the worker loop over a fake scope. No timer here is over 50 ms, and
 * the cancellation grace is pinned low for the same reason.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { __resetJobsForTest, cancelJob, jobsSnapshot, startJob } from '../jobs.ts';
import {
  ECHO_STAGE,
  StageCancelledError,
  UnknownStageError,
  __resetStagesForTest,
  installStageWorker,
  type StageWorkerReplyV1,
  type StageWorkerRequestV1,
} from './stage-core.ts';
import {
  CANCEL_GRACE,
  REPLY_BUDGET,
  StageStalledError,
  StaleReplyError,
  hasStage,
  isStale,
  registerStage,
  runStage,
  setStageWorkerFactoryForTest,
  stageNames,
  withHeavySlot,
  type StageWorkerLikeV1,
} from './stage-runner.ts';
import { DECODE_BUDGETS } from './budget.ts';
// The worker entry, imported for the one case that pins it installs no listener
// outside a worker. Nothing in the shell imports it: stage-runner.ts names it in
// a `new URL` so Vite emits it as its own chunk.
import './stage-worker.ts';

const budget = DECODE_BUDGETS.laptop;
const tick = (ms = 0): Promise<void> => new Promise((r) => { setTimeout(r, ms); });

function baseOpts(over: Partial<Parameters<typeof runStage>[0]> = {}): Parameters<typeof runStage>[0] {
  return {
    projectId: 'proj-1',
    stage: 'census',
    name: ECHO_STAGE,
    algorithmVersion: 'census-2026-09-23',
    input: { hello: 'deck' },
    budget,
    title: 'Renovating the deck',
    ...over,
  };
}

function reset(): void {
  __resetJobsForTest();
  __resetStagesForTest();
  setStageWorkerFactoryForTest(null);
  CANCEL_GRACE.ms = 200;
  REPLY_BUDGET.ms = 120_000;
}

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------

test('the built-in echo stage is registered and named', () => {
  reset();
  assert.equal(hasStage(ECHO_STAGE), true);
  assert.deepEqual(stageNames(), [ECHO_STAGE]);
});

test('a stage registers by name, which is how milestone 3 adds census and plan in stages.ts', () => {
  reset();
  // A registration reaches the realm that made it. A real stage registers from
  // stages.ts, which the worker entry and the in-realm fallback both load.
  registerStage('census', (input: unknown) => ({ seen: input }));
  assert.equal(hasStage('census'), true);
  assert.deepEqual(stageNames(), ['census', ECHO_STAGE].sort());
  __resetStagesForTest();
  assert.equal(hasStage('census'), false, 'the reset puts the built-in back on its own');
});

test('an unknown stage name is a named error', async () => {
  reset();
  await assert.rejects(
    () => runStage(baseOpts({ name: 'no-such-stage' })),
    (err: unknown) => err instanceof UnknownStageError && err.stageName === 'no-such-stage',
  );
});

// ---------------------------------------------------------------------------
// The envelope
// ---------------------------------------------------------------------------

test('a stage resolves an envelope tagged with the project, revision and algorithm', async () => {
  reset();
  const envelope = await runStage(baseOpts({ planRevision: 7 }));
  assert.deepEqual(envelope, {
    projectId: 'proj-1',
    planRevision: 7,
    stage: 'census',
    algorithmVersion: 'census-2026-09-23',
    result: { hello: 'deck' },
  });
});

test('a stage with no plan yet carries no revision at all', async () => {
  reset();
  const envelope = await runStage(baseOpts({ stage: 'ingest' }));
  assert.equal('planRevision' in envelope, false);
  assert.equal(envelope.stage, 'ingest');
});

test('progress arrives stamped with the project, revision and stage', async () => {
  reset();
  const seen: unknown[] = [];
  await runStage(baseOpts({ planRevision: 2, onProgress: (p) => { seen.push(p); } }));
  assert.deepEqual(seen, [{
    projectId: 'proj-1',
    planRevision: 2,
    stage: 'census',
    message: 'Echoing the input',
    done: 1,
    total: 1,
  }]);
});

test('a stage failure rejects with the stage error', async () => {
  reset();
  registerStage('angry', () => { throw new Error('The deck could not be read.'); });
  await assert.rejects(
    () => runStage(baseOpts({ name: 'angry' })),
    /The deck could not be read\./,
  );
});

// ---------------------------------------------------------------------------
// The heavy slot rule
// ---------------------------------------------------------------------------

test('a stage started on its own claims a heavy slot', async () => {
  reset();
  await runStage(baseOpts({ title: 'Reading the deck' }));
  const jobs = jobsSnapshot();
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0]?.title, 'Reading the deck');
  assert.equal(jobs[0]?.heavy, true);
  assert.equal(jobs[0]?.status, 'done');
});

test('a parent that holds the slot runs its stages directly, claiming nothing more', async () => {
  reset();
  registerStage('inner', (input: unknown) => ({ inner: input }));
  const out = await withHeavySlot('Renovating the deck', async (slot) => {
    const a = await runStage(baseOpts({ slot }));
    const b = await runStage(baseOpts({ slot, name: 'inner', input: 'x' }));
    return [a.result, b.result];
  });
  assert.deepEqual(out, [{ hello: 'deck' }, { inner: 'x' }]);
  const jobs = jobsSnapshot();
  assert.equal(jobs.length, 1, 'one heavy job for the whole run, not one per stage');
  assert.equal(jobs[0]?.title, 'Renovating the deck');
});

test('a stage that forgets the token adopts the held slot instead of deadlocking against it', async () => {
  reset();
  // Queueing here would be a deadlock: the parent awaits the child, the child
  // waits for the slot the parent holds, and lib/jobs.ts has no timeout, so the
  // one heavy slot the whole shell shares would be gone for good.
  let childSettled = false;
  const out = await withHeavySlot('Renovating the deck', async () => {
    const child = runStage(baseOpts({ title: 'Reading text' })).then((e) => { childSettled = true; return e; });
    await tick(10);
    assert.equal(childSettled, true, 'the child ran at once under the slot the parent holds');
    return (await child).result;
  });
  assert.deepEqual(out, { hello: 'deck' });
  const jobs = jobsSnapshot();
  assert.equal(jobs.length, 1, 'and claimed no job of its own');
  assert.equal(jobs[0]?.title, 'Renovating the deck');
});

test('a quiet stage with no slot held runs at once with no job of its own, and adopts a held slot', async () => {
  reset();
  const envelope = await runStage(baseOpts({ title: 'Drawing the proposed slides', quiet: true }));
  assert.deepEqual(envelope.result, { hello: 'deck' });
  assert.equal(jobsSnapshot().length, 0, 'nothing on the job toast');
  const out = await withHeavySlot('Renovating the deck', async () => (await runStage(baseOpts({ quiet: true }))).result);
  assert.deepEqual(out, { hello: 'deck' });
  assert.equal(jobsSnapshot().length, 1, 'under a held slot it runs as any stage does');
});

test('a stage started with no slot held anywhere still claims one and waits its turn', async () => {
  reset();
  // A heavy job that is not a renovation slot: nothing to adopt, so the stage queues.
  const holder = startJob({ title: 'Something else heavy', heavy: true });
  await holder.started;

  let settled = false;
  const run = runStage(baseOpts({ title: 'Reading text' })).then((e) => { settled = true; return e; });
  await tick(10);
  assert.equal(settled, false, 'queued behind the other heavy job');
  assert.equal(jobsSnapshot().find((j) => j.title === 'Reading text')?.status, 'queued');

  holder.finish();
  holder.settle();
  const envelope = await run;
  assert.equal(settled, true);
  assert.deepEqual(envelope.result, { hello: 'deck' });
});

test('a progress report under a slot reaches the job that holds it', async () => {
  reset();
  await withHeavySlot('Renovating the deck', async (slot) => {
    await runStage(baseOpts({ slot }));
  });
  const job = jobsSnapshot()[0];
  assert.equal(job?.progress?.done, 1);
  assert.equal(job?.progress?.total, 1);
  assert.equal(job?.progress?.note, 'Echoing the input');
});

// ---------------------------------------------------------------------------
// Cancellation, in this realm
// ---------------------------------------------------------------------------

test('a signal that is already aborted rejects before any work starts', async () => {
  reset();
  let ran = false;
  registerStage('counted', () => { ran = true; return 1; });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    () => runStage(baseOpts({ name: 'counted', signal: controller.signal })),
    (err: unknown) => err instanceof StageCancelledError && err.acknowledged && !err.terminated,
  );
  assert.equal(ran, false);
});

test('a stage that polls the cancel stops and the error records the acknowledgement', async () => {
  reset();
  CANCEL_GRACE.ms = 10;
  registerStage('cooperative', async (_input: unknown, ctx) => {
    for (let i = 0; i < 40; i++) {
      ctx.throwIfCancelled();
      await tick(1);
    }
    return 'finished';
  });
  const controller = new AbortController();
  const run = runStage(baseOpts({ name: 'cooperative', signal: controller.signal }));
  await tick(3);
  controller.abort();
  await assert.rejects(run, (err: unknown) =>
    err instanceof StageCancelledError && err.name === 'StageCancelledError' && err.acknowledged && !err.terminated);
});

test('a stage that ignores the cancel is abandoned after the grace, and says it was not acknowledged', async () => {
  reset();
  CANCEL_GRACE.ms = 5;
  let finished = false;
  registerStage('stubborn', async () => { await tick(30); finished = true; return 'late'; });
  const controller = new AbortController();
  const run = runStage(baseOpts({ name: 'stubborn', signal: controller.signal }));
  await tick(1);
  controller.abort();
  await assert.rejects(run, (err: unknown) =>
    err instanceof StageCancelledError && !err.acknowledged && !err.terminated);
  // Nothing in this realm can end a running function, so it does finish; its
  // result is dropped rather than delivered.
  await tick(40);
  assert.equal(finished, true);
});

// ---------------------------------------------------------------------------
// Staleness
// ---------------------------------------------------------------------------

test('isStale drops another project and an older revision', () => {
  assert.equal(isStale({ projectId: 'a', planRevision: 3 }, { projectId: 'a', planRevision: 3 }), false);
  assert.equal(isStale({ projectId: 'a', planRevision: 2 }, { projectId: 'a', planRevision: 3 }), true);
  assert.equal(isStale({ projectId: 'a', planRevision: 4 }, { projectId: 'a', planRevision: 3 }), true);
  assert.equal(isStale({ projectId: 'a' }, { projectId: 'b' }), true);
  assert.equal(isStale({ projectId: 'a', planRevision: 3 }, { projectId: 'b', planRevision: 3 }), true);
});

test('isStale compares a revision only when both sides state one', () => {
  // Ingest and census are not bound to a plan revision.
  assert.equal(isStale({ projectId: 'a' }, { projectId: 'a', planRevision: 3 }), false);
  // A view that holds no revision has discarded the plan the result was
  // computed against, so a result that names one is stale.
  assert.equal(isStale({ projectId: 'a', planRevision: 3 }, { projectId: 'a' }), true);
  assert.equal(isStale({ projectId: 'a' }, { projectId: 'a' }), false);
});

test('a settled envelope can be handed straight to isStale', async () => {
  reset();
  const envelope = await runStage(baseOpts({ planRevision: 4 }));
  assert.equal(isStale(envelope, { projectId: 'proj-1', planRevision: 4 }), false);
  assert.equal(isStale(envelope, { projectId: 'proj-1', planRevision: 5 }), true);
});

// ---------------------------------------------------------------------------
// The worker path, over a fake worker
// ---------------------------------------------------------------------------

class FakeWorker implements StageWorkerLikeV1 {
  onmessage: ((event: { data: StageWorkerReplyV1 }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  sent: StageWorkerRequestV1[] = [];
  terminations = 0;
  /** What to do when a message arrives. Set by each test. */
  respond: ((worker: FakeWorker, message: StageWorkerRequestV1) => void) | null = null;

  postMessage(message: StageWorkerRequestV1): void {
    this.sent.push(message);
    this.respond?.(this, message);
  }

  terminate(): void { this.terminations++; }

  reply(r: StageWorkerReplyV1): void { this.onmessage?.({ data: r }); }
}

function useFakeWorker(respond: (worker: FakeWorker, message: StageWorkerRequestV1) => void): () => FakeWorker | null {
  let made: FakeWorker | null = null;
  setStageWorkerFactoryForTest(() => {
    const w = new FakeWorker();
    w.respond = respond;
    made = w;
    return w;
  });
  return () => made;
}

test('the worker request carries the project, revision, stage name, algorithm and budget', async () => {
  reset();
  const worker = useFakeWorker((w, m) => {
    if (m.type !== 'run') return;
    queueMicrotask(() => { w.reply({ id: m.id, projectId: m.projectId, planRevision: m.planRevision, result: { ok: true } }); });
  });
  const envelope = await runStage(baseOpts({ planRevision: 9 }));
  assert.deepEqual(envelope.result, { ok: true });
  const sent = worker()?.sent[0];
  assert.equal(sent?.type, 'run');
  assert.deepEqual(sent, {
    id: sent && 'id' in sent ? sent.id : 0,
    type: 'run',
    projectId: 'proj-1',
    planRevision: 9,
    stage: 'census',
    name: ECHO_STAGE,
    algorithmVersion: 'census-2026-09-23',
    budget,
    input: { hello: 'deck' },
  });
  assert.equal(worker()?.terminations, 1, 'one disposable worker per run');
});

test('progress for another project or another revision never reaches the caller', async () => {
  reset();
  const worker = useFakeWorker((w, m) => {
    if (m.type !== 'run') return;
    queueMicrotask(() => {
      w.reply({ id: m.id, projectId: 'someone-else', planRevision: m.planRevision, progress: { message: 'wrong project' } });
      w.reply({ id: m.id, projectId: m.projectId, planRevision: 3, progress: { message: 'older revision' } });
      w.reply({ id: m.id + 99, projectId: m.projectId, planRevision: m.planRevision, result: 'other request' });
      w.reply({ id: m.id, projectId: m.projectId, planRevision: m.planRevision, result: 'right one' });
    });
  });
  const seen: unknown[] = [];
  const envelope = await runStage(baseOpts({ planRevision: 4, onProgress: (pr) => { seen.push(pr); } }));
  assert.equal(envelope.result, 'right one');
  assert.deepEqual(seen, [], 'none of the mismatched progress was relayed');
  assert.ok(worker());
});

test('worker progress is relayed and stamped', async () => {
  reset();
  useFakeWorker((w, m) => {
    if (m.type !== 'run') return;
    queueMicrotask(() => {
      w.reply({ id: m.id, projectId: m.projectId, progress: { message: 'Reading slide 8 of 40', done: 8, total: 40 } });
      w.reply({ id: m.id, projectId: m.projectId, result: 'done' });
    });
  });
  const seen: unknown[] = [];
  await runStage(baseOpts({ onProgress: (p) => { seen.push(p); } }));
  assert.deepEqual(seen, [{ projectId: 'proj-1', stage: 'census', message: 'Reading slide 8 of 40', done: 8, total: 40 }]);
});

test('a worker error reply becomes a rejection with its message', async () => {
  reset();
  useFakeWorker((w, m) => {
    if (m.type !== 'run') return;
    queueMicrotask(() => { w.reply({ id: m.id, projectId: m.projectId, error: 'That deck is encrypted.' }); });
  });
  await assert.rejects(() => runStage(baseOpts()), /That deck is encrypted\./);
});

test('a worker stage that stops inside the grace is not terminated for it', async () => {
  reset();
  CANCEL_GRACE.ms = 20;
  const worker = useFakeWorker((w, m) => {
    if (m.type !== 'cancel') return;
    const run = w.sent.find((s): s is Extract<StageWorkerRequestV1, { type: 'run' }> => s.type === 'run');
    if (!run) return;
    w.reply({ id: m.id, projectId: run.projectId, cancelAck: true });
    queueMicrotask(() => { w.reply({ id: m.id, projectId: run.projectId, cancelled: true }); });
  });
  const controller = new AbortController();
  const run = runStage(baseOpts({ signal: controller.signal }));
  await tick(1);
  controller.abort();
  await assert.rejects(run, (err: unknown) =>
    err instanceof StageCancelledError && err.acknowledged && !err.terminated);
  assert.equal(worker()?.terminations, 1, 'the disposable worker is still disposed of');
});

test('a worker stage that will not stop has its worker ended after the grace', async () => {
  reset();
  CANCEL_GRACE.ms = 5;
  const worker = useFakeWorker(() => { /* every message is ignored */ });
  const controller = new AbortController();
  const run = runStage(baseOpts({ signal: controller.signal }));
  await tick(1);
  controller.abort();
  await assert.rejects(run, (err: unknown) =>
    err instanceof StageCancelledError && !err.acknowledged && err.terminated);
  assert.equal(worker()?.terminations, 1);
  assert.equal(worker()?.sent.filter((m) => m.type === 'cancel').length, 1, 'the cancel was posted first');
});

test('a worker that acknowledges but never stops is still ended, and the error records both', async () => {
  reset();
  CANCEL_GRACE.ms = 5;
  useFakeWorker((w, m) => {
    if (m.type !== 'cancel') return;
    const run = w.sent.find((s): s is Extract<StageWorkerRequestV1, { type: 'run' }> => s.type === 'run');
    if (run) w.reply({ id: m.id, projectId: run.projectId, cancelAck: true });
  });
  const controller = new AbortController();
  const run = runStage(baseOpts({ signal: controller.signal }));
  await tick(1);
  controller.abort();
  await assert.rejects(run, (err: unknown) =>
    err instanceof StageCancelledError && err.acknowledged && err.terminated);
});

test('a worker that fails outright rejects and is disposed of', async () => {
  reset();
  const worker = useFakeWorker((w, m) => {
    if (m.type !== 'run') return;
    queueMicrotask(() => { w.onerror?.({ message: 'boom' }); });
  });
  await assert.rejects(() => runStage(baseOpts()), /The local stage worker could not finish\./);
  assert.equal(worker()?.terminations, 1);
});

// ---------------------------------------------------------------------------
// The worker's own message loop, over a fake scope
// ---------------------------------------------------------------------------

function fakeScope() {
  const replies: StageWorkerReplyV1[] = [];
  let listener: ((event: { data: StageWorkerRequestV1 }) => void) | null = null;
  const scope = {
    addEventListener(_type: 'message', fn: (event: { data: StageWorkerRequestV1 }) => void): void { listener = fn; },
    postMessage(message: StageWorkerReplyV1): void { replies.push(message); },
  };
  installStageWorker(scope);
  return {
    replies,
    send(message: StageWorkerRequestV1): void { listener?.({ data: message }); },
  };
}

const runMessage = (over: Partial<Extract<StageWorkerRequestV1, { type: 'run' }>> = {}): StageWorkerRequestV1 => ({
  id: 1,
  type: 'run',
  projectId: 'proj-1',
  planRevision: 5,
  stage: 'census',
  name: ECHO_STAGE,
  algorithmVersion: 'census-2026-09-23',
  budget,
  input: 'payload',
  ...over,
});

test('the worker loop answers a run with progress and then the result, echoing the tags', async () => {
  reset();
  const scope = fakeScope();
  scope.send(runMessage());
  await tick(1);
  assert.deepEqual(scope.replies, [
    { id: 1, projectId: 'proj-1', planRevision: 5, progress: { message: 'Echoing the input', done: 1, total: 1 } },
    { id: 1, projectId: 'proj-1', planRevision: 5, result: 'payload' },
  ]);
});

test('the worker loop acknowledges a cancel at once and reports the stop', async () => {
  reset();
  registerStage('cooperative', async (_input: unknown, ctx) => {
    for (let i = 0; i < 40; i++) { ctx.throwIfCancelled(); await tick(1); }
    return 'finished';
  });
  const scope = fakeScope();
  scope.send(runMessage({ name: 'cooperative' }));
  await tick(2);
  scope.send({ id: 1, type: 'cancel' });
  assert.deepEqual(scope.replies.at(-1), { id: 1, projectId: 'proj-1', planRevision: 5, cancelAck: true },
    'the acknowledgement is sent in the same turn as the cancel');
  await tick(4);
  assert.deepEqual(scope.replies.at(-1), { id: 1, projectId: 'proj-1', planRevision: 5, cancelled: true });
});

test('the worker loop reports an unknown stage as an error, not a crash, and names it', async () => {
  reset();
  const scope = fakeScope();
  scope.send(runMessage({ name: 'no-such-stage' }));
  await tick(1);
  const reply = scope.replies.at(-1);
  assert.equal(reply?.error, 'No stage is registered under the name "no-such-stage".');
  // The name travels too, so the runner can rebuild the same error on the main
  // thread and a caller's instanceof check means the same thing in both realms.
  assert.equal(reply?.errorName, 'UnknownStageError');
  assert.equal(reply?.errorStageName, 'no-such-stage');
});

test('a cancel for a run the worker never saw is ignored', async () => {
  reset();
  const scope = fakeScope();
  scope.send({ id: 404, type: 'cancel' });
  await tick(1);
  assert.deepEqual(scope.replies, []);
});

test('importing the worker module in this realm installs no listener', () => {
  // The guard is what keeps the runner able to import the registry from the
  // worker entry. If it ever fired here, node would have a message listener it
  // never asked for, and the main thread would have one in the browser.
  const g = globalThis as { onmessage?: unknown };
  assert.equal(g.onmessage, undefined);
});

// ---------------------------------------------------------------------------
// A run always reaches a terminal state, and a cancel is recorded as one
// ---------------------------------------------------------------------------

/** A stage that polls the cancel between short waits. */
function registerCooperative(name = 'cooperative'): void {
  registerStage(name, async (_input: unknown, ctx) => {
    for (let i = 0; i < 60; i++) { ctx.throwIfCancelled(); await tick(1); }
    return 'finished';
  });
}

test('the job that holds the slot offers a cancel, and cancelling it stops the stages under it', async () => {
  reset();
  CANCEL_GRACE.ms = 10;
  registerCooperative();
  const run = withHeavySlot('Renovating the deck', (slot) => runStage(baseOpts({ slot, name: 'cooperative' })));
  await tick(3);
  const job = jobsSnapshot()[0];
  assert.equal(job?.cancellable, true, 'a job with no cancel callback hides the control in the toast');
  cancelJob(job?.id ?? '');
  await assert.rejects(run, (err: unknown) => err instanceof StageCancelledError);
  assert.equal(jobsSnapshot()[0]?.status, 'cancelled');
});

test('a stage handed a slot that was already cancelled never starts', async () => {
  reset();
  let ran = false;
  registerStage('counted', () => { ran = true; return 1; });
  await assert.rejects(
    () => withHeavySlot('Renovating the deck', async (slot) => {
      cancelJob(slot.id);
      return await runStage(baseOpts({ slot, name: 'counted' }));
    }),
    (err: unknown) => err instanceof StageCancelledError,
  );
  assert.equal(ran, false);
});

test('a stage the caller cancels is recorded as cancelled, not as a failure', async () => {
  reset();
  CANCEL_GRACE.ms = 10;
  registerCooperative();
  const controller = new AbortController();
  const run = runStage(baseOpts({ name: 'cooperative', title: 'Reading text', signal: controller.signal }));
  await tick(3);
  controller.abort();
  await assert.rejects(run, (err: unknown) => err instanceof StageCancelledError);
  assert.equal(jobsSnapshot().find((j) => j.title === 'Reading text')?.status, 'cancelled',
    'a red failure for work the person stopped would be a lie');
});

test('a stage that really fails is still recorded as a failure', async () => {
  reset();
  registerStage('angry', () => { throw new Error('The deck could not be read.'); });
  await assert.rejects(() => runStage(baseOpts({ name: 'angry', title: 'Reading text' })));
  assert.equal(jobsSnapshot().find((j) => j.title === 'Reading text')?.status, 'failed');
});

test('a terminal reply tagged for another project fails the run and frees the slot', async () => {
  reset();
  useFakeWorker((w, m) => {
    if (m.type !== 'run') return;
    queueMicrotask(() => { w.reply({ id: m.id, projectId: 'someone-else', result: 'wrong project' }); });
  });
  await assert.rejects(
    () => runStage(baseOpts({ title: 'Reading text' })),
    (err: unknown) => err instanceof StaleReplyError,
  );
  assert.equal(jobsSnapshot().find((j) => j.title === 'Reading text')?.status, 'failed',
    'a silent drop here would hold the one heavy slot for the life of the page');
});

test('a terminal reply that states no revision when one was asked for is stale, not silence', async () => {
  reset();
  useFakeWorker((w, m) => {
    if (m.type !== 'run') return;
    queueMicrotask(() => { w.reply({ id: m.id, projectId: m.projectId, result: 'ok' }); });
  });
  await assert.rejects(
    () => runStage(baseOpts({ planRevision: 4, title: 'Reading text' })),
    (err: unknown) => err instanceof StaleReplyError,
  );
  assert.equal(jobsSnapshot().find((j) => j.title === 'Reading text')?.status, 'failed');
});

test('a worker that says nothing at all is ended once the reply budget runs out', async () => {
  reset();
  REPLY_BUDGET.ms = 10;
  const worker = useFakeWorker(() => { /* a worker that died before installing its loop */ });
  await assert.rejects(
    () => runStage(baseOpts({ title: 'Reading text' })),
    (err: unknown) => err instanceof StageStalledError && err.quietMs === 10,
  );
  assert.equal(worker()?.terminations, 1);
  assert.equal(jobsSnapshot().find((j) => j.title === 'Reading text')?.status, 'failed');
});

test('progress keeps a slow worker alive: the reply budget measures silence, not duration', async () => {
  reset();
  REPLY_BUDGET.ms = 25;
  useFakeWorker((w, m) => {
    if (m.type !== 'run') return;
    let sent = 0;
    const beat = setInterval(() => {
      sent++;
      if (sent <= 4) { w.reply({ id: m.id, projectId: m.projectId, progress: { message: `Slide ${sent}`, done: sent, total: 5 } }); return; }
      clearInterval(beat);
      w.reply({ id: m.id, projectId: m.projectId, result: 'done' });
    }, 10);
    (beat as unknown as { unref?: () => void }).unref?.();
  });
  const envelope = await runStage(baseOpts({ title: 'Reading text' }));
  assert.equal(envelope.result, 'done', 'fifty milliseconds of work under a twenty-five millisecond silence budget');
});

test('a named error survives the worker boundary', async () => {
  reset();
  useFakeWorker((w, m) => {
    if (m.type !== 'run') return;
    queueMicrotask(() => {
      w.reply({
        id: m.id,
        projectId: m.projectId,
        error: 'No stage is registered under the name "no-such-stage".',
        errorName: 'UnknownStageError',
        errorStageName: 'no-such-stage',
      });
    });
  });
  await assert.rejects(
    () => runStage(baseOpts()),
    (err: unknown) => err instanceof UnknownStageError && err.stageName === 'no-such-stage',
  );
});
