// SPDX-License-Identifier: MPL-2.0
/**
 * org/probe.ts - the boot probe and its negative cache.
 *
 * The rule under test: dormancy for this boot comes from any failure, but the
 * six-hour "no instance here" memory comes only from a definitive answer (a 2xx
 * that is not JSON, or a 404/405). A timeout, a network error or a 5xx is not
 * remembered, so a new device whose first probe loses to a cold start is not
 * left dormant for six hours. A slow but successful answer inside the budget is
 * a control plane, and the dormant path stays one quick request.
 *
 * Timers and Date are mocked, so the 5 s budget runs in no real time.
 *
 * Run directly:  node --test shells/web/src/org/probe.test.ts
 */
import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as unknown as Storage;

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;
let router: Handler = () => new Response('', { status: 404 });
let calls = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  calls++;
  return router(String(input), init);
}) as typeof fetch;

const { probeInstance, initOrgProbeFirst, isRecentlyAbsent, AUTH_PROBE_BUDGET_MS, PROBE_TIMEOUT_MS } = await import('./probe.ts');

const ABSENT_KEY = 'lolly:org-absent:same-origin';
const SLOW_KEY = 'lolly:org-probe-unanswered:same-origin';
const config = { mode: 'open', provider: 'oidc', loginPath: '/login' };
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const html = (status = 200): Response =>
  new Response('<!doctype html><html></html>', { status, headers: { 'content-type': 'text/html' } });

/** A fetch that answers after `ms` of (mocked) time, or rejects when aborted first. */
function after(ms: number, make: () => Response): Handler {
  return (_url, init) => new Promise<Response>((resolve, reject) => {
    const signal = init?.signal;
    if (signal?.aborted) { reject(new DOMException('aborted', 'AbortError')); return; }
    const t = setTimeout(() => resolve(make()), ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('aborted', 'AbortError')); });
  });
}

/** Let pending promise callbacks run between mocked timer ticks. */
async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

/** Advance mocked time in steps, flushing between them, while `p` settles. */
async function run<T>(t: { mock: { timers: { tick(ms: number): void } } }, p: Promise<T>, totalMs: number, stepMs = 50): Promise<T> {
  let done = false;
  void p.then(() => { done = true; }, () => { done = true; });
  for (let elapsed = 0; elapsed <= totalMs && !done; elapsed += stepMs) {
    await flush();
    if (done) break;
    t.mock.timers.tick(stepMs);
  }
  await flush();
  return p;
}

beforeEach(() => {
  store.clear();
  calls = 0;
  router = () => new Response('', { status: 404 });
});
afterEach(() => { router = () => new Response('', { status: 404 }); });
test.after(() => { globalThis.fetch = originalFetch; });

test('the boot probe budget is about 5 s; the short helper budget is unchanged', () => {
  assert.equal(AUTH_PROBE_BUDGET_MS, 5000);
  assert.equal(PROBE_TIMEOUT_MS, 1500);
});

// ── Definitive absence: remembered, one request ──────────────────────────────

for (const status of [404, 405]) {
  test(`a ${status} is definitive: one request, absence remembered, the next boot skips the probe`, async () => {
    router = () => new Response('', { status });
    assert.deepEqual(await probeInstance(), { auth: null, absent: true });
    assert.equal(calls, 1, 'no retry on a definitive answer');

    calls = 0;
    assert.equal(await initOrgProbeFirst(), null);
    assert.equal(calls, 1);
    assert.ok(store.has(ABSENT_KEY), 'negative cached');
    assert.equal(isRecentlyAbsent(), true);

    calls = 0;
    assert.equal(await initOrgProbeFirst(), null);
    assert.equal(calls, 0, 'remembered-absent origin is not probed again');
  });
}

test('a 2xx HTML page (the SPA fallback) is definitive: one request, absence remembered', async () => {
  router = () => html(200);
  assert.equal(await initOrgProbeFirst(), null);
  assert.equal(calls, 1);
  assert.ok(store.has(ABSENT_KEY));
});

// ── Inconclusive answers: dormant now, never remembered ──────────────────────

test('a network error (an offline device) is one request with no added wait, and is not remembered', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  router = () => { throw new TypeError('Failed to fetch'); };
  const start = Date.now();
  assert.equal(await run(t, initOrgProbeFirst(), AUTH_PROBE_BUDGET_MS), null);
  assert.equal(calls, 1, 'no retry: a cold start shows up as a slow answer or a 5xx, not a refused connection');
  assert.equal(Date.now() - start, 0, 'boot is not delayed');
  assert.ok(!store.has(ABSENT_KEY), 'a network error says nothing about the origin');
  assert.ok(!store.has(SLOW_KEY), 'an instant failure does not shorten the next probe');

  calls = 0;
  assert.equal(await run(t, initOrgProbeFirst(), AUTH_PROBE_BUDGET_MS), null);
  assert.equal(calls, 1, 'the next boot probes again');
});

for (const status of [500, 502, 503, 504]) {
  test(`a ${status} is not remembered and is retried once`, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
    router = () => html(status);
    assert.deepEqual(await run(t, probeInstance(), AUTH_PROBE_BUDGET_MS), { auth: null, absent: false });
    assert.equal(calls, 2);

    calls = 0;
    assert.equal(await run(t, initOrgProbeFirst(), AUTH_PROBE_BUDGET_MS), null);
    assert.ok(!store.has(ABSENT_KEY), 'a server error is not cached as "no instance"');
  });
}

test('a 5xx followed by a real answer on the retry finds the control plane', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  router = () => (calls === 1 ? json({ error: 'migrating' }, 503) : json(config));
  const r = await run(t, probeInstance(), AUTH_PROBE_BUDGET_MS);
  assert.deepEqual(r, { auth: config, absent: false });
  assert.equal(calls, 2);
  assert.ok(!store.has(ABSENT_KEY));
});

test('a probe that times out is not remembered and is not retried past the budget', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  router = after(60_000, () => json(config));
  assert.equal(await run(t, initOrgProbeFirst(), AUTH_PROBE_BUDGET_MS + 1000), null);
  assert.equal(calls, 1, 'a timeout used the whole budget, so no retry');
  assert.ok(!store.has(ABSENT_KEY), 'a timeout is not cached as "no instance"');
});

test('a stalled network costs the long budget once: the next boot probes with the short one', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  router = after(60_000, () => html(404)); // no instance, and the request never comes back

  let start = Date.now();
  assert.equal(await run(t, initOrgProbeFirst(), AUTH_PROBE_BUDGET_MS + 1000), null);
  assert.equal(Date.now() - start, AUTH_PROBE_BUDGET_MS, 'first boot waits the full budget');
  assert.ok(store.has(SLOW_KEY), 'an unanswered probe is noted');
  assert.ok(!store.has(ABSENT_KEY), 'but not as "no instance"');

  calls = 0;
  start = Date.now();
  assert.equal(await run(t, initOrgProbeFirst(), AUTH_PROBE_BUDGET_MS + 1000), null);
  assert.equal(calls, 1, 'the second boot still probes');
  assert.ok(Date.now() - start <= PROBE_TIMEOUT_MS, 'and does not wait the long budget again');
  assert.ok(!store.has(ABSENT_KEY));
});

test('after an unanswered probe, a warm control plane answering inside the short budget is found', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  router = after(60_000, () => json(config)); // cold start slower than the whole budget
  assert.deepEqual(await run(t, probeInstance(), AUTH_PROBE_BUDGET_MS + 1000), { auth: null, absent: false });
  assert.ok(store.has(SLOW_KEY));

  router = after(400, () => json(config)); // the first request warmed the function
  assert.deepEqual(await run(t, probeInstance(), AUTH_PROBE_BUDGET_MS), { auth: config, absent: false });
  assert.ok(!store.has(SLOW_KEY), 'an answer clears the note');
});

test('the unanswered note expires, so the long budget comes back', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  router = after(60_000, () => json(config));
  await run(t, probeInstance(), AUTH_PROBE_BUDGET_MS + 1000);
  assert.ok(store.has(SLOW_KEY));

  t.mock.timers.setTime(Date.now() + 11 * 60 * 1000);
  router = after(3000, () => json(config)); // cold again, inside the long budget only
  assert.deepEqual(await run(t, probeInstance(), AUTH_PROBE_BUDGET_MS), { auth: config, absent: false });
});

test('a retry whose wait ran late is skipped instead of starting with no time box', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const start = Date.now();
  router = () => (calls === 1 ? html(503) : new Promise<Response>(() => { /* never answers, never aborts */ }));
  const p = probeInstance();
  let settled = false;
  void p.then(() => { settled = true; });
  await flush();
  assert.equal(calls, 1);
  // The page was busy: the 250 ms pause ends exactly at the deadline.
  t.mock.timers.setTime(start + AUTH_PROBE_BUDGET_MS);
  t.mock.timers.tick(0);
  await flush();
  assert.equal(calls, 1, 'no retry once the budget is spent');
  assert.equal(settled, true, 'the probe settles instead of waiting on an unbounded request');
  assert.deepEqual(await p, { auth: null, absent: false });
});

test('a 5xx arriving late in the budget is not retried, so boot never waits past it', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  router = after(AUTH_PROBE_BUDGET_MS - 500, () => html(500));
  assert.deepEqual(await run(t, probeInstance(), AUTH_PROBE_BUDGET_MS + 1000), { auth: null, absent: false });
  assert.equal(calls, 1);
});

test('a cold start answering in 3 s (past the old 1.5 s budget) is found, not dormant', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  router = after(3000, () => json(config));
  const r = await run(t, probeInstance(), AUTH_PROBE_BUDGET_MS);
  assert.deepEqual(r, { auth: config, absent: false });
  assert.equal(calls, 1);
  assert.ok(!store.has(ABSENT_KEY));
});

// ── Other non-answers: dormant, not remembered, not retried ──────────────────

test('JSON that is not an auth config is dormant but not remembered', async () => {
  router = () => json({ hello: 'world' });
  assert.deepEqual(await probeInstance(), { auth: null, absent: false });
  assert.equal(calls, 1);
});

for (const status of [401, 403, 429]) {
  test(`a ${status} (a proxy or rate limit in front) is dormant but not remembered`, async () => {
    router = () => html(status);
    assert.equal(await initOrgProbeFirst(), null);
    assert.equal(calls, 1);
    assert.ok(!store.has(ABSENT_KEY));
  });
}
