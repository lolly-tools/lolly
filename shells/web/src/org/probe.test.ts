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
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
} as unknown as Storage;

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;
let router: Handler = () => new Response('', { status: 404 });
let calls = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  calls++;
  return router(String(input), init);
}) as typeof fetch;

const { probeInstance, probeForBoot, gateRemembered, initOrgProbeFirst, isRecentlyAbsent, cleanAnswerRemembered, onGateShown, noteGateShown, AUTH_PROBE_BUDGET_MS, CLEAN_ANSWER_TTL_MS, GATED_RETRY_DELAYS_MS, PROBE_TIMEOUT_MS, SHARED_ANSWER_FRESH_MS } = await import('./probe.ts');

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

// ── The last answer (plan 371): paint before the probe only after a clean answer ─────

/** Node has no page, so the origin part of the key is empty here. */
const LAST_KEY = 'lolly:org-last-answer:|same-origin';
const lastAnswer = (): { v: number; answer: string; at: number } | null =>
  store.has(LAST_KEY) ? JSON.parse(store.get(LAST_KEY)!) : null;

for (const [label, answer] of [['a 404', () => new Response('', { status: 404 })], ['the SPA\'s own HTML', () => html(200)]] as const) {
  test(`${label} is remembered as "no control plane", so the next boot may paint first`, async () => {
    assert.equal(cleanAnswerRemembered(), false, 'no record: boot waits');
    router = answer;
    await probeInstance();
    assert.equal(lastAnswer()?.answer, 'absent');
    assert.equal(cleanAnswerRemembered(), true);
  });
}

test('a control plane is remembered as one, and replaces an earlier clean answer', async () => {
  router = () => new Response('', { status: 404 });
  await probeInstance();
  assert.equal(cleanAnswerRemembered(), true);
  router = () => json({ mode: 'gated', provider: 'oidc', loginPath: '/login' });
  await probeInstance();
  assert.equal(lastAnswer()?.answer, 'control-plane');
  assert.equal(cleanAnswerRemembered(), false, 'a gated deployment never paints first');
});

test('a probe with no answer writes nothing: never "no control plane", and an earlier gate stands', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  router = after(60_000, () => html(404));
  await run(t, probeInstance(), AUTH_PROBE_BUDGET_MS + 1000);
  assert.equal(lastAnswer(), null, 'a timeout is not an answer');
  assert.equal(cleanAnswerRemembered(), false);

  router = () => json(config);
  await run(t, probeInstance(), AUTH_PROBE_BUDGET_MS);
  for (const silent of [after(60_000, () => html(404)), () => html(503), () => { throw new TypeError('Failed to fetch'); }]) {
    router = silent as Handler;
    await run(t, probeInstance(), AUTH_PROBE_BUDGET_MS + 1000);
    assert.equal(lastAnswer()?.answer, 'control-plane', 'a silent probe does not clear what a control plane said');
    assert.equal(cleanAnswerRemembered(), false);
  }
});

for (const status of [401, 403, 429, 500, 503]) {
  test(`a ${status} writes no answer`, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
    router = () => html(status);
    await run(t, probeInstance(), AUTH_PROBE_BUDGET_MS);
    assert.equal(lastAnswer(), null);
    assert.equal(cleanAnswerRemembered(), false);
  });
}

test('JSON that is not an auth config writes no answer', async () => {
  router = () => json({ hello: 'world' });
  await probeInstance();
  assert.equal(lastAnswer(), null);
});

test('a clean answer lasts its lifetime and no longer', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  assert.equal(CLEAN_ANSWER_TTL_MS, 30 * 24 * 60 * 60 * 1000);
  router = () => new Response('', { status: 404 });
  await probeInstance();
  const at = Date.now();
  assert.equal(cleanAnswerRemembered(at + CLEAN_ANSWER_TTL_MS - 1), true);
  assert.equal(cleanAnswerRemembered(at + CLEAN_ANSWER_TTL_MS), false, 'expired: boot waits again');
});

test('a damaged, foreign or future record is not believed', () => {
  const now = Date.now();
  for (const raw of [
    'not json',
    'null',
    JSON.stringify({ answer: 'absent', at: now }),
    JSON.stringify({ v: 2, answer: 'absent', at: now }),
    JSON.stringify({ v: 1, answer: 'none', at: now }),
    JSON.stringify({ v: 1, answer: 'absent', at: 'now' }),
    JSON.stringify({ v: 1, answer: 'absent', at: null }),
    JSON.stringify({ v: 1, answer: 'absent', at: now + 10 * 60 * 1000 }),
  ]) {
    store.set(LAST_KEY, raw);
    assert.equal(cleanAnswerRemembered(now), false, raw);
  }
  store.set(LAST_KEY, JSON.stringify({ v: 1, answer: 'absent', at: now }));
  assert.equal(cleanAnswerRemembered(now), true, 'the well-formed record is');
});

test('the record is kept per origin and instance base', async () => {
  const realLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
  const setOrigin = (origin: string) => Object.defineProperty(globalThis, 'location', { value: { origin }, configurable: true, writable: true });
  try {
    setOrigin('https://a.example');
    router = () => new Response('', { status: 404 });
    await probeInstance();
    assert.ok(store.has('lolly:org-last-answer:https://a.example|same-origin'));
    assert.equal(cleanAnswerRemembered(), true);
    setOrigin('https://b.example');
    assert.equal(cleanAnswerRemembered(), false, 'another origin has its own record');
  } finally {
    if (realLocation) Object.defineProperty(globalThis, 'location', realLocation);
    else delete (globalThis as { location?: unknown }).location;
  }
});

test('a device that has seen a managed AI policy here never paints first', async () => {
  router = () => new Response('', { status: 404 });
  await probeInstance();
  store.set('lolly:managed-ai:same-origin', '1');
  assert.equal(cleanAnswerRemembered(), false);
});

test('a clean answer from a slower tab does not undo a later control-plane answer', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const now = Date.now();
  // Another tab learned of a control plane a moment after this tab's probe answered.
  store.set(LAST_KEY, JSON.stringify({ v: 1, answer: 'control-plane', at: now + 5000 }));
  router = () => new Response('', { status: 404 });
  await probeInstance();
  assert.equal(lastAnswer()?.answer, 'control-plane');
  assert.equal(cleanAnswerRemembered(), false);
  // A clean answer stamped after the control plane's does replace the record.
  t.mock.timers.setTime(now + 10_000);
  await probeInstance();
  assert.equal(lastAnswer()?.answer, 'absent');
});

test('the gate listener hears the drawn gate, and a failing listener cannot break the renderer', () => {
  const seen: Array<unknown> = [];
  const gate = { marker: 'gate' } as unknown as Element;
  onGateShown(node => { seen.push(node); });
  noteGateShown(gate);
  assert.deepEqual(seen, [gate]);
  onGateShown(() => { throw new Error('listener broke'); });
  const error = console.error;
  console.error = () => {};
  try { assert.doesNotThrow(() => noteGateShown(gate)); } finally { console.error = error; }
  onGateShown(null);
  noteGateShown(gate);
  assert.equal(seen.length, 1);
});

test('a device that has seen a control plane here never paints first again, even after a later clean answer', async () => {
  // A control plane answers on this origin (a gated workspace that members sign in to).
  router = () => json({ mode: 'gated', provider: 'oidc', loginPath: '/login' });
  const error = console.error;
  const warn = console.warn;
  console.error = () => {};
  console.warn = () => {};
  try { await initOrgProbeFirst(); } finally { console.error = error; console.warn = warn; }
  assert.equal(store.get('lolly:managed-ai:same-origin'), '1', 'the first control-plane answer marks the device');
  // The control plane goes away, then comes back with a gate. In between the probe saw a 404.
  router = () => new Response('', { status: 404 });
  await probeInstance();
  assert.equal(lastAnswer()?.answer, 'absent');
  assert.equal(cleanAnswerRemembered(), false, 'saved work made under accounts is never painted ahead of the gate');
  // A forged clean record changes nothing on such a device either.
  store.set(LAST_KEY, JSON.stringify({ v: 1, answer: 'absent', at: Date.now() }));
  assert.equal(cleanAnswerRemembered(), false);
});

test('a control plane met under another instance base also keeps boot waiting (saved work is per origin)', async () => {
  router = () => new Response('', { status: 404 });
  await probeInstance();
  assert.equal(cleanAnswerRemembered(), true);
  store.set('lolly:managed-ai:https://a.example', '1');
  assert.equal(cleanAnswerRemembered(), false, 'a managed instance used from this origin');
  store.delete('lolly:managed-ai:https://a.example');
  store.set('lolly:org-last-answer:|https://a.example', JSON.stringify({ v: 1, answer: 'control-plane', at: Date.now() }));
  assert.equal(cleanAnswerRemembered(), false, 'a control plane answered for another base');
  store.delete('lolly:org-last-answer:|https://a.example');
  assert.equal(cleanAnswerRemembered(), true);
});

test('storage that cannot be listed counts as having met a control plane', async () => {
  router = () => new Response('', { status: 404 });
  await probeInstance();
  const key = localStorage.key;
  (localStorage as { key: (i: number) => string | null }).key = () => { throw new Error('blocked'); };
  try { assert.equal(cleanAnswerRemembered(), false); } finally { (localStorage as { key: typeof key }).key = key; }
});

// ── A gated origin stays gated (plan 371) ─────────────────────────────────────
//
// Two tabs booting together on a slow control plane share one HTTP/1.1 connection
// pool, so the second tab's probe can wait behind the first tab's downloads and run
// out of time. Before this, that silence read as "no control plane" and the tab
// booted without its gate. Now silence on an origin last known to be gated keeps the
// tab waiting and asking, and a tab takes another tab's answer when it arrives first.

const gatedConfig = { mode: 'gated', provider: 'oidc', loginPath: '/login' };
const HOUR = 60 * 60 * 1000;
const rememberGate = (extra: Record<string, unknown> = { auth: gatedConfig }, age = HOUR): void => {
  store.set(LAST_KEY, JSON.stringify({ v: 1, answer: 'control-plane', at: Date.now() - age, ...extra }));
};
/** Move mocked time on by `ms`, letting promise callbacks run between steps. */
async function advance(t: { mock: { timers: { tick(ms: number): void } } }, ms: number, stepMs = 50): Promise<void> {
  for (let elapsed = 0; elapsed < ms; elapsed += stepMs) { await flush(); t.mock.timers.tick(stepMs); }
  await flush();
}
/** Let real event-loop turns pass (a BroadcastChannel message needs one). */
async function turns(n = 5): Promise<void> {
  for (let i = 0; i < n; i++) await new Promise(resolve => setImmediate(resolve));
}

test('a control-plane answer is written down with its public auth config', async () => {
  router = () => json(gatedConfig);
  await probeInstance();
  assert.deepEqual((lastAnswer() as { auth?: unknown } | null)?.auth, gatedConfig);
  store.set(LAST_KEY, JSON.stringify({ v: 1, answer: 'control-plane', at: Date.now(), auth: { mode: 'nonsense' } }));
  assert.equal(gateRemembered(), false, 'a record with a damaged config is not believed');
});

test('which remembered answers count as a gate', () => {
  assert.equal(gateRemembered(), false, 'no record');
  store.set(LAST_KEY, JSON.stringify({ v: 1, answer: 'absent', at: Date.now() }));
  assert.equal(gateRemembered(), false, 'no control plane');
  rememberGate({ auth: { ...gatedConfig, mode: 'open' } });
  assert.equal(gateRemembered(), false, 'an open control plane draws no gate');
  rememberGate({ auth: gatedConfig });
  assert.equal(gateRemembered(), true);
  rememberGate({ auth: { ...gatedConfig, mode: 'per-tool' } });
  assert.equal(gateRemembered(), true, 'per tool gates some tools');
  rememberGate({});
  assert.equal(gateRemembered(), true, 'a record from before the config was kept is treated as gated');
});

test('a timeout on a gated origin stays gated: the tab keeps waiting and asks again until the control plane answers', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  rememberGate();
  // Three requests go unanswered, then the control plane answers at once.
  router = (url, init) => (calls <= 3 ? after(60_000, () => html(404))(url, init) : json(gatedConfig));
  let done = false;
  const boot = probeForBoot().then(r => { done = true; return r; });
  // The first long budget, the first pause and ask, and most of the second pause.
  const [first, second] = GATED_RETRY_DELAYS_MS as [number, number];
  await advance(t, AUTH_PROBE_BUDGET_MS + first + AUTH_PROBE_BUDGET_MS + second - 500);
  assert.equal(done, false, 'silence is not "no control plane" on a gated origin');
  assert.equal(calls, 2, 'asked again after the first pause, each time with the long budget');
  assert.deepEqual(await run(t, boot, 60_000), { auth: gatedConfig, absent: false });
  assert.equal(calls, 4);
});

test('a gated origin whose control plane keeps failing with 5xx also keeps waiting', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  rememberGate();
  router = () => (calls <= 4 ? html(503) : json(gatedConfig));
  assert.deepEqual(await run(t, probeForBoot(), 60_000), { auth: gatedConfig, absent: false });
  assert.equal(calls, 5);
});

test('a gated origin takes a real "no control plane" when it finally comes', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  rememberGate({});
  router = (url, init) => (calls <= 1 ? after(60_000, () => html(404))(url, init) : new Response('', { status: 404 }));
  assert.deepEqual(await run(t, probeForBoot(), 60_000), { auth: null, absent: true });
  assert.equal(calls, 2);
  assert.equal(lastAnswer()?.answer, 'absent');
});

test('a timeout on a never-gated origin paints as before: one request, dormant after the budget', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  store.set(LAST_KEY, JSON.stringify({ v: 1, answer: 'absent', at: Date.now() - 1000 }));
  assert.equal(cleanAnswerRemembered(), true, 'the browse routes paint before the probe answers (PR #1053)');
  router = after(60_000, () => html(404));
  assert.deepEqual(await run(t, probeForBoot(), AUTH_PROBE_BUDGET_MS + 1000), { auth: null, absent: false });
  assert.equal(calls, 1, 'not asked again');
  store.clear(); calls = 0;
  assert.deepEqual(await run(t, probeForBoot(), AUTH_PROBE_BUDGET_MS + 1000), { auth: null, absent: false }, 'no record at all: the same');
  assert.equal(calls, 1);
});

test('an open control plane, or an offline device on a gated origin, boots as before', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  rememberGate({ auth: { ...gatedConfig, mode: 'open' } });
  router = after(60_000, () => html(404));
  assert.deepEqual(await run(t, probeForBoot(), AUTH_PROBE_BUDGET_MS + 1000), { auth: null, absent: false });
  assert.equal(calls, 1);
  rememberGate(); calls = 0;
  router = () => { throw new TypeError('Failed to fetch'); };
  assert.deepEqual(await run(t, probeForBoot(), 1000), { auth: null, absent: false }, 'a request that fails at once is not silence');
  assert.equal(calls, 1);
});

test('a second tab uses the first tab\'s answer instead of waiting on its own request', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  rememberGate();
  let aborted = false;
  // This tab's request is stuck behind the other tab's downloads.
  router = (_url, init) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => { aborted = true; reject(new DOMException('aborted', 'AbortError')); });
  });
  let result: unknown = null;
  const boot = probeForBoot().then(r => { result = r; });
  await flush();
  t.mock.timers.tick(500);
  await flush();
  const otherTab = new BroadcastChannel('lolly:org-answer');
  try {
    otherTab.postMessage({ v: 1, key: 'lolly:org-last-answer:|https://elsewhere.example', answer: 'absent' });
    await turns();
    await flush();
    assert.equal(result, null, 'an answer about another instance base is ignored');
    otherTab.postMessage({ v: 1, key: LAST_KEY, answer: 'control-plane', auth: gatedConfig });
    await turns();
    await boot;
  } finally { otherTab.close(); }
  assert.deepEqual(result, { auth: gatedConfig, absent: false });
  assert.equal(calls, 1, 'no further request');
  assert.ok(aborted, 'its own request is let go');
});

test('a tab booting just after another tab answered uses that answer with no request', async () => {
  rememberGate({ auth: gatedConfig }, 2000);
  router = () => { throw new Error('no request expected'); };
  assert.deepEqual(await probeForBoot(), { auth: gatedConfig, absent: false });
  assert.equal(calls, 0);
  rememberGate({ auth: gatedConfig }, SHARED_ANSWER_FRESH_MS + 1);
  router = () => json(gatedConfig);
  assert.deepEqual(await probeForBoot(), { auth: gatedConfig, absent: false });
  assert.equal(calls, 1, 'an older answer is asked again');
});
