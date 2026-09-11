// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { aiAllowed, aiPolicy } from '../lib/ai-policy.ts';
import {
  beginAiProbe,
  finishAiProbe,
  knownManagedAi,
  startAiPolicyPolling,
  stopAiPolicyPolling,
} from './ai-policy.ts';

const allow = { version: 1, enabled: true, capabilities: ['ocr'], maxAgeSeconds: 60 };
const originalFetch = globalThis.fetch;
afterEach(() => {
  stopAiPolicyPolling();
  aiPolicy.setManaged(false);
  globalThis.fetch = originalFetch;
});

test('renewal failure revokes; a later valid response can recover', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let response = new Response('unavailable', { status: 503 });
  let requests = 0;
  globalThis.fetch = async (_url, init) => {
    requests++;
    assert.equal(init?.cache, 'no-store');
    return response;
  };
  startAiPolicyPolling(allow);
  assert.equal(aiAllowed('ocr'), true);
  t.mock.timers.tick(30_000);
  await setImmediate();
  assert.equal(requests, 1);
  assert.equal(aiAllowed('ocr'), false);
  response = Response.json(allow);
  t.mock.timers.tick(30_000);
  await setImmediate();
  assert.equal(aiAllowed('ocr'), true);
});

test('late renewal after logout cannot restore permission', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let finish!: (response: Response) => void;
  globalThis.fetch = () =>
    new Promise<Response>((resolve) => {
      finish = resolve;
    });
  startAiPolicyPolling(allow);
  t.mock.timers.tick(30_000);
  stopAiPolicyPolling();
  finish(Response.json(allow));
  await setImmediate();
  assert.equal(aiAllowed('ocr'), false);
});

test('oversized and unknown-version renewal bodies never grant permission', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const response of [
    Response.json({ ...allow, padding: 'x'.repeat(5000) }),
    Response.json({ ...allow, version: 2 }),
  ]) {
    globalThis.fetch = async () => response;
    startAiPolicyPolling();
    t.mock.timers.tick(30_000);
    await setImmediate();
    assert.equal(aiAllowed('ocr'), false);
  }
});

test('a previously managed origin cannot become standalone when its probe goes offline', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });
  try {
    beginAiProbe();
    assert.equal(aiAllowed('ocr'), false);
    finishAiProbe(false);
    assert.equal(aiAllowed('ocr'), true, 'ordinary standalone behaviour retained');
    finishAiProbe(true);
    assert.equal(knownManagedAi(), true);
    beginAiProbe();
    finishAiProbe(false);
    assert.equal(aiAllowed('ocr'), false);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
