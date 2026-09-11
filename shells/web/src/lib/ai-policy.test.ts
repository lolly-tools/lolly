// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  AI_CAPABILITIES,
  AiPolicyController,
  AiPolicyError,
  aiPolicy,
  guardAiWorker,
  runAi,
} from './ai-policy.ts';

const allow = { version: 1, enabled: true, capabilities: [...AI_CAPABILITIES], maxAgeSeconds: 60 };
afterEach(() => aiPolicy.setManaged(false));

test('standalone works; managed missing, disabled, unknown and expired policy fails closed', () => {
  let now = 100;
  const policy = new AiPolicyController(false, () => now);
  assert.equal(policy.allowed('ocr'), true);
  policy.setManaged(true);
  assert.equal(policy.allowed('ocr'), false);
  for (const invalid of [
    undefined,
    {},
    { ...allow, version: 2 },
    { ...allow, enabled: 'true' },
    { ...allow, maxAgeSeconds: 61 },
    { ...allow, maxAgeSeconds: 0 },
    { ...allow, capabilities: ['future'] },
  ]) {
    policy.apply(invalid);
    assert.equal(policy.allowed('ocr'), false);
  }
  policy.apply({ ...allow, capabilities: ['ocr'] });
  assert.equal(policy.allowed('ocr'), true);
  assert.equal(policy.allowed('matte'), false);
  now += 60_000;
  assert.equal(policy.allowed('ocr'), false, 'expiry checked even before a throttled timer runs');
  policy.setManaged(true);
});

test('denial never invokes execution; revocation aborts work and drops late results', async () => {
  aiPolicy.setManaged(true);
  let dispatched = 0;
  await assert.rejects(
    runAi('ocr', async () => {
      dispatched++;
      return 'wrong';
    }),
    AiPolicyError
  );
  assert.equal(dispatched, 0);
  aiPolicy.apply(allow);
  let signal: AbortSignal | undefined;
  let finish!: (value: string) => void;
  const result = runAi('ocr', (s) => {
    signal = s;
    return new Promise<string>((resolve) => {
      finish = resolve;
    });
  });
  aiPolicy.apply({ ...allow, enabled: false });
  assert.equal(signal?.aborted, true);
  finish('late result');
  await assert.rejects(result, AiPolicyError);
});

test('renewing unchanged permission preserves active work; removing a capability cancels only that capability', async () => {
  aiPolicy.apply(allow);
  let finish!: (value: number) => void;
  const result = runAi(
    'ocr',
    () =>
      new Promise<number>((resolve) => {
        finish = resolve;
      })
  );
  aiPolicy.apply({ ...allow, capabilities: ['ocr'] });
  finish(42);
  assert.equal(await result, 42);
});

test('worker construction, warm dispatch and incoming results are governed; revocation terminates', () => {
  class FakeWorker extends EventTarget {
    sent = 0;
    terminated = 0;
    postMessage(): void {
      this.sent++;
    }
    terminate(): void {
      this.terminated++;
    }
  }
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'ErrorEvent');
  Object.defineProperty(globalThis, 'ErrorEvent', { value: Event, configurable: true });
  try {
    aiPolicy.setManaged(true);
    let constructed = 0;
    const fake = new FakeWorker();
    const create = () => {
      constructed++;
      return fake as unknown as Worker;
    };
    assert.throws(() => guardAiWorker('matte', create), AiPolicyError);
    assert.equal(constructed, 0);
    aiPolicy.apply(allow);
    const worker = guardAiWorker('matte', create);
    let errors = 0,
      replies = 0;
    worker.addEventListener('error', () => errors++);
    worker.addEventListener('message', () => replies++);
    worker.postMessage({ type: 'run' });
    assert.equal(fake.sent, 1);
    aiPolicy.apply({ ...allow, capabilities: ['ocr'] });
    assert.equal(fake.terminated, 1);
    assert.equal(errors, 1, 'pending clients receive the error used to settle their promises');
    fake.dispatchEvent(new Event('message'));
    assert.equal(replies, 0, 'queued result suppressed');
    assert.throws(() => worker.postMessage({ type: 'run' }), AiPolicyError);
    assert.doesNotThrow(() => worker.postMessage({ type: 'abort' }));
    assert.equal(fake.sent, 1);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'ErrorEvent', previous);
    else Reflect.deleteProperty(globalThis, 'ErrorEvent');
  }
});

test('model fetchers deny cached/network acquisition, and abort a download already in progress', async () => {
  const { createModelFetcher } = await import('./ort.ts');
  const original = globalThis.fetch;
  let fetched = 0;
  const fetcher = createModelFetcher({
    store: 'matte-models',
    dir: 'matte',
    version: 1,
    dbg: () => {},
  });
  try {
    globalThis.fetch = async () => {
      fetched++;
      return new Response(new Uint8Array([1, 2, 3]));
    };
    aiPolicy.setManaged(true);
    await assert.rejects(fetcher('cached.onnx', true), AiPolicyError);
    await assert.rejects(fetcher('new.onnx'), AiPolicyError);
    assert.equal(fetched, 0);
    aiPolicy.apply(allow);
    let began!: () => void;
    const started = new Promise<void>((resolve) => {
      began = resolve;
    });
    let downloadSignal: AbortSignal | null | undefined;
    globalThis.fetch = async (_url, init) => {
      downloadSignal = init?.signal;
      began();
      return new Promise<Response>((_resolve, reject) =>
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
      );
    };
    const result = fetcher('new.onnx');
    await started;
    aiPolicy.apply(null);
    await assert.rejects(result, AiPolicyError);
    assert.equal(downloadSignal?.aborted, true);
  } finally {
    globalThis.fetch = original;
  }
});

test('known and unclassified model offline downloads are denied before fetch', async () => {
  const { downloadList } = await import('./offline-manager.ts');
  const originalFetch = globalThis.fetch;
  const originalCaches = Object.getOwnPropertyDescriptor(globalThis, 'caches');
  let fetched = 0;
  globalThis.fetch = async () => {
    fetched++;
    return new Response('model');
  };
  Object.defineProperty(globalThis, 'caches', {
    configurable: true,
    value: { open: async () => ({ match: async () => undefined }) },
  });
  try {
    aiPolicy.setManaged(true);
    await assert.rejects(
      downloadList('test', [{ url: '/models/kokoro/weights.onnx', size: 5 }]),
      AiPolicyError
    );
    aiPolicy.apply(allow);
    await assert.rejects(
      downloadList('test', [{ url: '/models/future/weights.onnx', size: 5 }]),
      AiPolicyError
    );
    assert.equal(fetched, 0);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalCaches) Object.defineProperty(globalThis, 'caches', originalCaches);
    else Reflect.deleteProperty(globalThis, 'caches');
  }
});

test('an observer failure cannot prevent another capability from being revoked', () => {
  const policy = new AiPolicyController(false);
  let notified = false;
  policy.subscribe(() => {
    throw new Error('synthetic UI failure');
  });
  policy.subscribe(() => {
    notified = true;
  });
  policy.setManaged(true);
  assert.equal(notified, true);
  assert.equal(policy.allowed('ocr'), false);
});

test('an aborted lazy import cannot dispatch after AI is re-enabled', async () => {
  const { callAiApi } = await import('./ai-policy.ts');
  aiPolicy.apply(allow);
  let load!: (api: object) => void;
  const loading = new Promise<object>((resolve) => {
    load = resolve;
  });
  let called = false;
  const result = callAiApi(
    'ocr',
    () => loading,
    async () => {
      called = true;
      return 'output';
    }
  );
  aiPolicy.apply(null);
  await assert.rejects(result, AiPolicyError);
  aiPolicy.apply(allow);
  load({});
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(called, false);
});
