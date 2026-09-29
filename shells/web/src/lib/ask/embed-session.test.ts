// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmbedSession } from './embed-session.ts';

class FakeWorker extends EventTarget {
  static instances: FakeWorker[] = [];
  stopped = false;
  messages: Array<{ id: number; text: string }> = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() { super(); FakeWorker.instances.push(this); }
  postMessage(message: { id: number; text: string }): void { this.messages.push(message); }
  terminate(): void { this.stopped = true; }
  reply(result: Float32Array): void { this.onmessage?.({ data: { id: this.messages.at(-1)!.id, result } }); }
}

test('cancelling an embedding session terminates only its own worker and ignores late replies', async () => {
  const before = Reflect.get(globalThis, 'Worker');
  Reflect.set(globalThis, 'Worker', FakeWorker);
  const first = new AbortController(); const second = new AbortController();
  const a = createEmbedSession(first.signal); const b = createEmbedSession(second.signal);
  try {
    const pending = a.embed('first');
    const rejected = assert.rejects(pending, /aborted/);
    first.abort(); await rejected;
    assert.equal(FakeWorker.instances[0]!.stopped, true);
    assert.equal(FakeWorker.instances[1]!.stopped, false);
    FakeWorker.instances[0]!.reply(new Float32Array(384));
    const other = b.embed('second'); FakeWorker.instances[1]!.reply(new Float32Array(384));
    assert.equal((await other).length, 384);
  } finally { a.dispose(); b.dispose(); Reflect.set(globalThis, 'Worker', before); }
});

test('invalid vectors and overlapping work fail explicitly and a failed call can retry', async () => {
  const before = Reflect.get(globalThis, 'Worker');
  Reflect.set(globalThis, 'Worker', FakeWorker);
  const session = createEmbedSession(new AbortController().signal);
  try {
    const worker = FakeWorker.instances.at(-1)!;
    const pending = session.embed('first');
    await assert.rejects(session.embed('overlap'), /unavailable/);
    worker.reply(Float32Array.of(1)); await assert.rejects(pending, /Invalid embedding/);
    const next = session.embed('retry'); worker.reply(new Float32Array(384)); assert.equal((await next).length, 384);
  } finally { session.dispose(); Reflect.set(globalThis, 'Worker', before); }
});
