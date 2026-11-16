// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { holdScreenAwake } from './wake-lock.ts';

const tick = async (): Promise<void> => { await new Promise<void>(resolve => setImmediate(resolve)); };

function fixture(t: TestContext, request?: () => Promise<unknown>) {
  const page = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const sentinel = { released: false, releases: 0, async release() { this.released = true; this.releases++; } };
  let requests = 0;
  const wakeLock = { request: (type: string) => {
    assert.equal(type, 'screen');
    requests++;
    return request ? request() : Promise.resolve(sentinel);
  } };
  for (const [key, value] of Object.entries({ document: page, navigator: { wakeLock } })) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
  return { page, sentinel, requests: () => requests, visibility: (value: string) => {
    page.visibilityState = value;
    page.dispatchEvent(new Event('visibilitychange'));
  } };
}

test('one hold makes one request and releases once', async (t) => {
  const f = fixture(t);
  const release = holdScreenAwake();
  t.after(release);
  await tick();
  f.visibility('visible');
  assert.equal(f.requests(), 1);
  release(); release();
  assert.equal(f.sentinel.releases, 1);
  f.visibility('hidden'); f.visibility('visible');
  assert.equal(f.requests(), 1);
});

test('a visible page requests a new lock after the browser releases the old one', async (t) => {
  const f = fixture(t);
  const release = holdScreenAwake();
  t.after(release);
  await tick();
  f.visibility('hidden');
  f.sentinel.released = true;
  assert.equal(f.requests(), 1);
  f.visibility('visible'); f.visibility('visible');
  assert.equal(f.requests(), 2);
  await tick();
  release();
  assert.equal(f.sentinel.releases, 1);
});

test('a hidden page waits until it is visible', async (t) => {
  const f = fixture(t);
  f.visibility('hidden');
  const release = holdScreenAwake();
  t.after(release);
  assert.equal(f.requests(), 0);
  f.visibility('visible');
  await tick();
  assert.equal(f.requests(), 1);
});

test('release also frees a lock whose request is still pending', async (t) => {
  let resolve!: (value: unknown) => void;
  const f = fixture(t, () => new Promise(yes => { resolve = yes; }));
  const release = holdScreenAwake();
  release(); release();
  resolve(f.sentinel);
  await tick();
  assert.equal(f.sentinel.releases, 1);
  f.visibility('visible');
  assert.equal(f.requests(), 1);
});

test('a rejected request is harmless and can retry when the page becomes visible', async (t) => {
  const f = fixture(t, () => Promise.reject(new Error('Wake lock declined')));
  const release = holdScreenAwake();
  t.after(release);
  await tick();
  f.visibility('hidden'); f.visibility('visible');
  await tick();
  assert.equal(f.requests(), 2);
  assert.doesNotThrow(release);
});

test('a missing API is harmless', (t) => {
  const f = fixture(t);
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
  const release = holdScreenAwake();
  assert.doesNotThrow(() => { release(); release(); });
  f.visibility('visible');
  assert.equal(f.requests(), 0);
});
