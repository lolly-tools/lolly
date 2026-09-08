// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../engine/src/runtime.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';

function deferred() {
  let resolve!: () => void, reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function setup() {
  const starts: ReturnType<typeof deferred>[] = [];
  let refs = 0, subscriptions = 0, stops = 0;
  const host = {
    version: '1', log() {}, profile: { get: async () => ({}) },
    media: {
      isAvailable: () => true,
      start: () => { const call = deferred(); starts.push(call); return call.promise.then(() => { refs++; }); },
      stop: () => { refs--; stops++; },
      subscribe: () => { subscriptions++; return () => { subscriptions--; }; },
    },
  } as unknown as HostV1;
  const tool: Parameters<typeof createRuntime>[0] = {
    trustClass: 'development-unsigned', styles: null, hooksUrl: null, textTemplates: {}, textTemplateErrors: {},
    manifest: { id: 'live-lifecycle', name: 'Live lifecycle', version: '1.0.0', engineVersion: '^1.0.0', status: 'official',
      render: { width: 10, height: 10, formats: ['png'] }, inputs: [], hooks: { onFrame: true } },
    template: '<b>Preview</b>', hooksSource: 'function onFrame() { return { live: true }; }',
  };
  const runtime = await createRuntime(tool, host);
  return { runtime, starts, counts: () => ({ refs, subscriptions, stops }) };
}

test('leaving while the camera opens releases the eventual stream without subscribing', async () => {
  const { runtime, starts, counts } = await setup();
  const pending = runtime.startLive();
  runtime.stopLive(); starts[0]!.resolve();
  assert.equal(await pending, false);
  assert.equal(runtime.isLive(), false);
  assert.deepEqual(counts(), { refs: 0, subscriptions: 0, stops: 1 });
  runtime.stopLive(); assert.equal(counts().stops, 1, 'stop is idempotent');
});

test('a second start while opening cannot leak an extra media reference', async () => {
  const { runtime, starts, counts } = await setup();
  const first = runtime.startLive(); const second = runtime.startLive();
  assert.equal(starts.length, 1);
  starts[0]!.resolve();
  assert.equal(await first, true); assert.equal(await second, false);
  runtime.stopLive();
  assert.deepEqual(counts(), { refs: 0, subscriptions: 0, stops: 1 });
});

test('an obsolete start cannot replace or stop a newer live session', async () => {
  const { runtime, starts, counts } = await setup();
  const old = runtime.startLive(); runtime.stopLive();
  const latest = runtime.startLive();
  starts[1]!.resolve(); assert.equal(await latest, true);
  starts[0]!.resolve(); assert.equal(await old, false);
  assert.equal(runtime.isLive(), true);
  assert.deepEqual(counts(), { refs: 1, subscriptions: 1, stops: 1 });
  runtime.stopLive();
  assert.deepEqual(counts(), { refs: 0, subscriptions: 0, stops: 2 });
});

test('permission rejection allows a later retry without stopping an unacquired stream', async () => {
  const { runtime, starts, counts } = await setup();
  const first = runtime.startLive(); starts[0]!.reject(new Error('Permission denied'));
  await assert.rejects(first, /Permission denied/);
  const retry = runtime.startLive(); starts[1]!.resolve(); assert.equal(await retry, true);
  runtime.stopLive();
  assert.deepEqual(counts(), { refs: 0, subscriptions: 0, stops: 1 });
});

test('destroy also cancels pending media and rejects later starts', async () => {
  const { runtime, starts, counts } = await setup();
  const pending = runtime.startLive(); runtime.destroy(); starts[0]!.resolve();
  assert.equal(await pending, false);
  assert.equal(await runtime.startLive(), false);
  assert.deepEqual(counts(), { refs: 0, subscriptions: 0, stops: 1 });
});
