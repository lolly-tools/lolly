// SPDX-License-Identifier: MPL-2.0
/**
 * lib/instance.ts in the apps: a caller's abort signal ends the wait on the native
 * request, which cannot itself be cancelled, and a time budget (lib/instance-json.ts)
 * reaches the native side as its own limit.
 *
 * Run directly:  node --test shells/web/src/lib/instance-abort.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { _setBaseForTests, hasInstanceSession, instanceFetch, setInstanceSession } from './instance.ts';
import { fetchWithin } from './instance-json.ts';

const WORK = 'https://work.example';
interface NativeRequest { url: string; headers: Array<[string, string]>; timeoutMs?: number }
type NativeAnswer = { status: number; statusText: string; url: string; headers: Array<[string, string]>; body: number[] };

/** A Tauri page whose native requests answer only when the test says so. */
function nativeShell(ctx: { after(fn: () => void | Promise<void>): void }): { requests: NativeRequest[]; answer(headers?: Array<[string, string]>): void } {
  const requests: NativeRequest[] = [];
  const waiting: Array<(answer: NativeAnswer) => void> = [];
  const saved = ['window', 'location'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  Object.defineProperty(globalThis, 'location', { configurable: true, value: { origin: 'tauri://localhost', href: 'tauri://localhost/' } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    __TAURI_INTERNALS__: { invoke: (_command: string, args: { request: NativeRequest }) => {
      requests.push(args.request);
      return new Promise<NativeAnswer>(resolve => { waiting.push(resolve); });
    } },
  } });
  ctx.after(async () => {
    await setInstanceSession(null);
    _setBaseForTests('');
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  return {
    requests,
    answer(headers = []) {
      const request = requests[requests.length - waiting.length]!;
      waiting.shift()!({ status: 200, statusText: 'OK', url: request.url, headers, body: [] });
    },
  };
}

test('an abort ends the wait on a native request that has not answered', async (ctx) => {
  const shell = nativeShell(ctx);
  _setBaseForTests(WORK);
  const abort = new AbortController();
  const pending = instanceFetch(`${WORK}/api/auth/config`, { signal: abort.signal });
  const outcome = pending.then(() => 'answered', (error: unknown) => (error as Error).name);
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(shell.requests.length, 1, 'the request went out');
  abort.abort();
  assert.equal(await outcome, 'AbortError');
  // The native request answers later: nothing is left unhandled.
  shell.answer();
  await new Promise(resolve => setTimeout(resolve, 5));
});

test('a request with no signal, or one that never aborts, answers as before', async (ctx) => {
  const shell = nativeShell(ctx);
  _setBaseForTests(WORK);
  const plain = instanceFetch(`${WORK}/catalog/tools/index.json`);
  const signalled = instanceFetch(`${WORK}/catalog/assets/index.json`, { signal: new AbortController().signal });
  await new Promise(resolve => setTimeout(resolve, 5));
  shell.answer();
  shell.answer();
  assert.equal((await plain).status, 200);
  assert.equal((await signalled).status, 200);
});

test('a session the instance renewed is kept even when the caller stopped waiting', async (ctx) => {
  const shell = nativeShell(ctx);
  _setBaseForTests(WORK);
  await setInstanceSession('lw_session=old');
  const abort = new AbortController();
  const pending = instanceFetch(`${WORK}/api/v1/org-config`, { signal: abort.signal }).catch(() => null);
  await new Promise(resolve => setTimeout(resolve, 5));
  abort.abort();
  await pending;
  shell.answer([['set-cookie', 'lw_session=renewed; Path=/; HttpOnly; Secure; Max-Age=43200']]);
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.ok(hasInstanceSession());
  // The renewed pair travels to the instance, and only there.
  void instanceFetch(`${WORK}/api/auth/session`);
  void instanceFetch('https://other.example/file');
  await new Promise(resolve => setTimeout(resolve, 5));
  const [toInstance, toOther] = shell.requests.slice(-2);
  assert.equal(new Headers(toInstance!.headers).get('cookie'), 'lw_session=renewed');
  assert.equal(new Headers(toOther!.headers).get('cookie'), null);
  shell.answer();
  shell.answer();
});

test('a late answer to an older session does not replace or clear a newer one', async (ctx) => {
  const shell = nativeShell(ctx);
  _setBaseForTests(WORK);
  await setInstanceSession('lw_session=first');
  const old = instanceFetch(`${WORK}/api/v1/inbox`).catch(() => null);
  await new Promise(resolve => setTimeout(resolve, 5));
  // The person signs in again before that request is answered.
  await setInstanceSession('lw_session=second');
  shell.answer([['set-cookie', 'lw_session=; Path=/; Max-Age=0']]);
  await old;
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.ok(hasInstanceSession(), 'the newer session stays');
  void instanceFetch(`${WORK}/api/auth/session`);
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(new Headers(shell.requests.at(-1)!.headers).get('cookie'), 'lw_session=second');
  shell.answer();
});

test('a time budget ends the wait and is also the native request\'s own limit', async (ctx) => {
  const shell = nativeShell(ctx);
  _setBaseForTests(WORK);
  const started = Date.now();
  const result = await fetchWithin('/api/auth/config', undefined, 40);
  assert.deepEqual(result, { res: null, timedOut: true });
  assert.ok(Date.now() - started < 2000, 'the wait ended with the budget, not with the native limit');
  assert.equal(shell.requests[0]!.url, `${WORK}/api/auth/config`);
  assert.equal(shell.requests[0]!.timeoutMs, 40);
  shell.answer();
  // No budget: no native limit is sent, as before.
  const open = fetchWithin('/api/auth/session', undefined, undefined);
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(shell.requests[1]!.timeoutMs, undefined);
  shell.answer();
  assert.equal((await open).res?.status, 200);
});
