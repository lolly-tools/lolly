// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../engine/src/runtime.ts';
import type { HostV1, RecordSession } from '@lolly-tools/core/host-v1';

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function setup() {
  const meters: ReturnType<typeof deferred<void>>[] = [];
  const recordings: ReturnType<typeof deferred<RecordSession>>[] = [];
  let refs = 0, subscriptions = 0, stops = 0;
  const subscribe = () => { subscriptions++; return () => { subscriptions--; }; };
  const host = {
    version: '1', log() {}, profile: { get: async () => ({}) },
    recorder: {
      meter: {
        start: () => { const call = deferred<void>(); meters.push(call); return call.promise.then(() => { refs++; }); },
        stop: () => { refs--; stops++; }, subscribe,
      },
      record: () => { const call = deferred<RecordSession>(); recordings.push(call); return call.promise; },
    },
  } as unknown as HostV1;
  const tool: Parameters<typeof createRuntime>[0] = {
    trustClass: 'development-unsigned', styles: null, hooksUrl: null, textTemplates: {}, textTemplateErrors: {},
    manifest: { id: 'recording-lifecycle', name: 'Recording lifecycle', version: '1.0.0', engineVersion: '^1.0.0', status: 'official',
      render: { width: 10, height: 10, formats: ['png'] }, inputs: [], hooks: { onLevel: true } },
    template: '<b>Levels</b>', hooksSource: 'function onLevel() { return { metering: true }; }',
  };
  const runtime = await createRuntime(tool, host);
  function session() {
    let cancelled = 0;
    const final = deferred<Blob>();
    const value = { subscribe, stop: () => final.promise, cancel: () => { cancelled++; }, micActive: true } as RecordSession;
    return { value, final, cancelled: () => cancelled };
  }
  return { runtime, meters, recordings, session, counts: () => ({ refs, subscriptions, stops }) };
}

test('stopping a pending meter releases the late mic without subscribing', async () => {
  const { runtime, meters, counts } = await setup();
  const pending = runtime.startMeter(); runtime.stopMeter(); meters[0]!.resolve();
  assert.equal(await pending, false);
  // No meter is running: nothing subscribed, and the late mic was released exactly once.
  assert.deepEqual(counts(), { refs: 0, subscriptions: 0, stops: 1 });
  runtime.stopMeter(); assert.equal(counts().stops, 1);
});

test('duplicate meter starts acquire only one reference', async () => {
  const { runtime, meters, counts } = await setup();
  const pending = runtime.startMeter(), duplicate = runtime.startMeter();
  assert.equal(meters.length, 1); meters[0]!.resolve();
  assert.equal(await pending, true); assert.equal(await duplicate, false);
  runtime.destroy(); assert.deepEqual(counts(), { refs: 0, subscriptions: 0, stops: 1 });
});

test('obsolete meter acquisition cannot replace or release a newer sound check', async () => {
  const { runtime, meters, counts } = await setup();
  const old = runtime.startMeter(); runtime.stopMeter(); const latest = runtime.startMeter();
  meters[1]!.resolve(); assert.equal(await latest, true);
  meters[0]!.resolve(); assert.equal(await old, false);
  assert.deepEqual(counts(), { refs: 1, subscriptions: 1, stops: 1 });
  runtime.destroy(); assert.deepEqual(counts(), { refs: 0, subscriptions: 0, stops: 2 });
});

test('recording supersedes a pending meter and prevents another sound check', async () => {
  const { runtime, meters, recordings, session, counts } = await setup();
  const meter = runtime.startMeter(), recording = runtime.startRecording();
  assert.equal(await runtime.startMeter(), false);
  const take = session(); recordings[0]!.resolve(take.value); await recording;
  meters[0]!.resolve(); assert.equal(await meter, false);
  assert.deepEqual(counts(), { refs: 0, subscriptions: 1, stops: 1 });
  // The take is the live session: destroy cancels it, and its level subscription goes with it.
  runtime.destroy(); assert.equal(take.cancelled(), 1); assert.equal(counts().subscriptions, 0);
});

for (const action of ['cancelRecording', 'stopRecording', 'destroy'] as const) {
  test(`${action} cancels a recording that finishes acquiring after teardown`, async () => {
    const { runtime, recordings, session, counts } = await setup();
    const pending = runtime.startRecording(); await runtime[action]();
    const take = session(); recordings[0]!.resolve(take.value);
    assert.deepEqual(await pending, { started: false });
    assert.equal(take.cancelled(), 1); assert.equal(counts().subscriptions, 0);
    // No session is held any more: a second cancel would have cancelled the take twice.
    runtime.cancelRecording(); assert.equal(take.cancelled(), 1);
  });
}

test('duplicate recording requests do not open a second session', async () => {
  const { runtime, recordings, session } = await setup();
  const pending = runtime.startRecording(), duplicate = runtime.startRecording();
  assert.equal(recordings.length, 1); const take = session(); recordings[0]!.resolve(take.value);
  assert.equal((await pending).started, true); assert.deepEqual(await duplicate, { started: false });
  runtime.destroy(); runtime.destroy(); assert.equal(take.cancelled(), 1);
});

test('an obsolete recording result cancels only its own session', async () => {
  const { runtime, recordings, session, counts } = await setup();
  const old = runtime.startRecording(); runtime.cancelRecording(); const latest = runtime.startRecording();
  const a = session(), b = session(); recordings[1]!.resolve(b.value); await latest;
  recordings[0]!.resolve(a.value); assert.deepEqual(await old, { started: false });
  assert.equal(a.cancelled(), 1); assert.equal(b.cancelled(), 0);
  assert.equal(counts().subscriptions, 1);
  // Only the newest session is still held, so destroy cancels b and not a again.
  runtime.destroy(); assert.equal(b.cancelled(), 1);
});

test('permission rejection allows meter and recording retries', async () => {
  const { runtime, meters, recordings, session, counts } = await setup();
  const deniedMeter = runtime.startMeter(); meters[0]!.reject(new Error('denied'));
  await assert.rejects(deniedMeter, /denied/);
  const meter = runtime.startMeter(); meters[1]!.resolve(); assert.equal(await meter, true);
  const deniedRecording = runtime.startRecording(); recordings[0]!.reject(new Error('denied'));
  await assert.rejects(deniedRecording, /denied/);
  const pending = runtime.startRecording(), take = session(); recordings[1]!.resolve(take.value);
  assert.equal((await pending).started, true);
  runtime.destroy(); assert.equal(take.cancelled(), 1);
  assert.deepEqual(counts(), { refs: 0, subscriptions: 0, stops: 1 });
});

test('destroy releases a pending meter and refuses future device starts', async () => {
  const { runtime, meters, counts } = await setup();
  const pending = runtime.startMeter(); runtime.destroy(); meters[0]!.resolve();
  assert.equal(await pending, false); assert.equal(await runtime.startMeter(), false);
  assert.deepEqual(await runtime.startRecording(), { started: false });
  assert.deepEqual(counts(), { refs: 0, subscriptions: 0, stops: 1 });
});

test('leaving during finalisation discards the late recording result', async () => {
  const { runtime, recordings, session } = await setup();
  const pending = runtime.startRecording(), take = session(); recordings[0]!.resolve(take.value); await pending;
  const saving = runtime.stopRecording(); runtime.destroy();
  take.final.resolve(new Blob(['take'], { type: 'audio/webm' }));
  assert.equal(await saving, null);
});
