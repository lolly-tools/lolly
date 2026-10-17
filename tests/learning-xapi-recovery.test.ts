// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createLearningTracking } from '../packages/learning-player/src/tracking.ts';

// Packages embed the factory as source text, so every scenario runs that form:
// a reference to anything outside the function fails here as it would in a ZIP.
const connect = new Function(
  `return ${createLearningTracking.toString()}`
)() as typeof createLearningTracking;

type Handler = (() => void) | undefined;
type Statement = {
  id: string;
  verb: { id: string };
  context: { extensions: Record<string, unknown> };
};
interface FakeRequest {
  result?: unknown;
  onsuccess?: Handler;
  onupgradeneeded?: Handler;
}
interface FakeTransaction {
  oncomplete?: Handler;
  objectStore(): Record<'get' | 'put' | 'delete', (...args: unknown[]) => FakeRequest>;
}

/** The subset of IndexedDB the recovery record uses, shared by every page of one browser. */
function browserStorage() {
  const databases = new Map<string, Map<string, Map<unknown, unknown>>>();
  const indexedDB = {
    open(name: string) {
      const request: FakeRequest = {};
      queueMicrotask(() => {
        const fresh = !databases.has(name);
        if (fresh) databases.set(name, new Map());
        const stores = databases.get(name)!;
        request.result = {
          createObjectStore: (store: string) => stores.set(store, new Map()),
          transaction: (store: string) => {
            const rows = stores.get(store)!;
            const tx: FakeTransaction = {
              objectStore: () => ({
                get: (key) => run(() => structuredClone(rows.get(key))),
                put: (value, key) => run(() => void rows.set(key, structuredClone(value))),
                delete: (key) => run(() => void rows.delete(key)),
              }),
            };
            let open = 0;
            const run = (work: () => unknown) => {
              const req: FakeRequest = {};
              open++;
              queueMicrotask(() => {
                req.result = work();
                req.onsuccess?.();
                if (--open === 0) setTimeout(() => tx.oncomplete?.());
              });
              return req;
            };
            return tx;
          },
        };
        if (fresh) request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
  };
  const rows = () => [...(databases.get('lolly-learning-recovery')?.get('pending') ?? new Map())];
  return { indexedDB, rows };
}

/** One LRS and LMS whose availability changes between pages. */
function lrs() {
  const server = {
    online: true,
    statementStatus: 0,
    refuse: new Set<string>(),
    expired: false,
    session: 'session-one',
    mode: 'Normal',
    state: null as string | null,
    version: 0,
    statements: [] as Statement[],
    calls: [] as Array<{ url: URL; init: RequestInit }>,
  };
  const fetch = async (url: URL | string, init: RequestInit = {}) => {
    const u = new URL(url);
    server.calls.push({ url: u, init });
    if (!server.online) throw new TypeError('Failed to fetch');
    if (u.hostname === 'lms.test') return Response.json({ 'auth-token': 'Basic cmi5-secret' });
    if (server.expired) return new Response(null, { status: 401 });
    if (u.searchParams.get('stateId') === 'LMS.LaunchData')
      return Response.json({
        launchMode: server.mode,
        moveOn: 'Completed',
        contextTemplate: {
          extensions: { 'https://w3id.org/xapi/cmi5/context/extensions/sessionid': server.session },
        },
      });
    if (u.pathname.endsWith('/statements')) {
      const statement = JSON.parse(String(init.body)) as Statement;
      if (server.refuse.has(statement.id)) return new Response(null, { status: 400 });
      if (server.statementStatus) return new Response(null, { status: server.statementStatus });
      if (!server.statements.some((s) => s.id === statement.id)) server.statements.push(statement);
      return Response.json([statement.id]);
    }
    const tag = `"${server.version}"`;
    if (init.method === 'PUT') {
      const headers = init.headers as Record<string, string>;
      const allowed = headers['If-Match']
        ? server.state !== null && headers['If-Match'] === tag
        : server.state === null;
      if (!allowed) return new Response(null, { status: 412 });
      server.state = String(init.body);
      server.version++;
      return new Response(null, { status: 204, headers: { ETag: `"${server.version}"` } });
    }
    return server.state === null
      ? new Response(null, { status: 404 })
      : new Response(server.state, { headers: { ETag: tag } });
  };
  return { server, fetch };
}

const actor = {
  objectType: 'Agent',
  account: { homePage: 'https://lms.test', name: 'learner-one' },
};
const registration = '48cb6364-0953-468b-8b60-21687284c4d3';

function page(
  target: 'tincan' | 'cmi5',
  auth: string,
  storage: ReturnType<typeof browserStorage>,
  net: ReturnType<typeof lrs>
) {
  const params = new URLSearchParams({
    endpoint: 'https://lrs.test/xapi/',
    actor: JSON.stringify(actor),
    registration,
    ...(target === 'cmi5'
      ? { fetch: `https://lms.test/token/${auth}`, activityId: 'urn:activity:one' }
      : { auth, activity_id: 'urn:activity:one' }),
  });
  const dom = new JSDOM('', { url: `https://lms.test/course/?${params}` });
  Object.assign(dom.window, {
    fetch: net.fetch,
    indexedDB: storage.indexedDB,
    setTimeout: (fn: () => void) => setTimeout(fn, 0),
  });
  const calls = net.server.calls.length;
  return {
    dom,
    open: () => connect(dom.window as unknown as Window, target, 'urn:fallback'),
    /** Requests made by this page so far. */
    calls: () => net.server.calls.slice(calls),
  };
}

const verbs = (statements: Statement[]) => statements.map((s) => s.verb.id.split('/').pop());
const sessionOf = (statement: Statement) =>
  statement.context.extensions['https://w3id.org/xapi/cmi5/context/extensions/sessionid'];
const pending = (storage: ReturnType<typeof browserStorage>) => {
  const rows = storage.rows();
  assert.equal(rows.length, 1, 'one record for the one attempt');
  return rows[0]![1] as { statements: string[]; state: string | null; base: string | null };
};

test('Tin Can: unsent progress and statements outlive the page and replay under a later launch', async () => {
  const storage = browserStorage();
  const net = lrs();
  const first = page('tincan', 'Basic first-secret', storage, net);
  const one = await first.open();
  assert.equal(await one.read(), '');
  net.server.statementStatus = 503;
  await assert.rejects(one.save('progress-one', true, 'intro'), /could not be saved/);
  assert.equal(net.server.state, 'progress-one', 'the document was acknowledged');
  net.server.online = false;
  await assert.rejects(one.save('progress-two', true, 'end'), /could not be saved/);
  await assert.rejects(one.finish(), /could not be saved/);

  const record = pending(storage);
  assert.deepEqual(verbs(record.statements.map((s) => JSON.parse(s) as Statement)), [
    'completed',
    'terminated',
  ]);
  assert.equal(record.state, 'progress-two');
  assert.equal(record.base, '"1"', 'the copy names the document it replaces');
  const stored = JSON.stringify(storage.rows());
  for (const secret of ['secret', 'Basic', 'auth', 'lms.test/course'])
    assert.ok(!stored.includes(secret), `the recovery record never holds ${secret}`);
  first.dom.window.close();

  net.server.online = true;
  net.server.statementStatus = 0;
  const second = page('tincan', 'Basic second-secret', storage, net);
  const two = await second.open();
  assert.equal(net.server.state, 'progress-two');
  assert.deepEqual(verbs(net.server.statements), [
    'initialized',
    'completed',
    'terminated',
    'initialized',
  ]);
  assert.deepEqual(
    net.server.statements.slice(1, 3),
    record.statements.map((s) => JSON.parse(s)),
    'replayed statements keep their original ID, timestamp and registration'
  );
  for (const { init } of second.calls())
    assert.equal((init.headers as Record<string, string>).Authorization, 'Basic second-secret');
  assert.equal(storage.rows().length, 0, 'a delivered record is removed');
  assert.equal(await two.read(), 'progress-two');
  second.dom.window.close();
});

test('cmi5: another session never replays statements, while the attempt keeps its progress', async () => {
  const storage = browserStorage();
  const net = lrs();
  const first = page('cmi5', 'one', storage, net);
  const one = await first.open();
  await one.read();
  net.server.statementStatus = 503;
  await assert.rejects(one.save('progress-one', true, 'intro'));
  net.server.online = false;
  await assert.rejects(one.save('progress-two', true, 'end'));
  const lost = JSON.parse(pending(storage).statements[0]!) as Statement;
  first.dom.window.close();

  net.server.online = true;
  net.server.statementStatus = 0;
  net.server.session = 'session-two';
  const second = page('cmi5', 'two', storage, net);
  const two = await second.open();
  assert.equal(net.server.state, 'progress-two', 'the registration-scoped document is recovered');
  assert.deepEqual(verbs(net.server.statements), ['initialized', 'initialized']);
  assert.deepEqual(net.server.statements.map(sessionOf), ['session-one', 'session-two']);
  assert.ok(
    !second.calls().some((c) => String(c.init.body).includes(lost.id)),
    'an earlier session statement is not sent, or relabelled, under a new session'
  );
  assert.equal(await two.read(), 'progress-two');
  await two.save('progress-two', true, 'end');
  const completed = net.server.statements.at(-1)!;
  assert.equal(verbs([completed])[0], 'completed');
  assert.equal(sessionOf(completed), 'session-two');
  assert.notEqual(completed.id, lost.id, 'the new session reports completion itself');
  second.dom.window.close();
});

test('cmi5: an ended session delivers its own termination and records nothing new', async () => {
  const storage = browserStorage();
  const net = lrs();
  const first = page('cmi5', 'one', storage, net);
  const one = await first.open();
  await one.read();
  await one.save('progress-one', false, 'intro');
  net.server.statementStatus = 503;
  await assert.rejects(one.finish());
  first.dom.window.close();

  net.server.statementStatus = 0;
  const second = page('cmi5', 'again', storage, net);
  await assert.rejects(second.open(), /session has ended/);
  assert.deepEqual(verbs(net.server.statements), ['initialized', 'terminated']);
  assert.ok(!second.calls().some((c) => c.init.method === 'PUT'));
  second.dom.window.close();
});

test('newer LMS progress wins over a stale browser copy', async () => {
  const storage = browserStorage();
  const net = lrs();
  const first = page('tincan', 'Basic first-secret', storage, net);
  const one = await first.open();
  await one.read();
  await one.save('progress-one', false, 'intro');
  net.server.online = false;
  await assert.rejects(one.save('stale', false, 'end'));
  first.dom.window.close();

  net.server.online = true;
  net.server.state = 'from-another-device';
  net.server.version = 2;
  const second = page('tincan', 'Basic second-secret', storage, net);
  const two = await second.open();
  assert.equal(net.server.state, 'from-another-device');
  assert.ok(!second.calls().some((c) => c.init.method === 'PUT'));
  assert.equal(storage.rows().length, 0);
  assert.equal(await two.read(), 'from-another-device');
  second.dom.window.close();
});

test('a launch that is not authorized replays nothing and keeps the record', async () => {
  const storage = browserStorage();
  const net = lrs();
  const first = page('tincan', 'Basic first-secret', storage, net);
  const one = await first.open();
  await one.read();
  net.server.online = false;
  await assert.rejects(one.save('progress-one', true, 'intro'));
  await assert.rejects(one.finish());
  const before = JSON.stringify(storage.rows());
  first.dom.window.close();

  net.server.online = true;
  net.server.expired = true;
  const second = page('tincan', 'Basic expired-secret', storage, net);
  await assert.rejects(second.open(), /authorization has expired/);
  assert.ok(!second.calls().some((c) => c.init.method === 'POST' || c.init.method === 'PUT'));
  assert.equal(JSON.stringify(storage.rows()), before);
  second.dom.window.close();

  net.server.expired = false;
  const third = page('tincan', 'Basic third-secret', storage, net);
  await third.open();
  assert.equal(net.server.state, 'progress-one', 'an authorized launch of the attempt replays it');
  assert.deepEqual(verbs(net.server.statements), ['initialized', 'terminated', 'initialized']);
  third.dom.window.close();
});

test('review launches leave the browser copy for a later normal launch', async () => {
  const storage = browserStorage();
  const net = lrs();
  const first = page('cmi5', 'one', storage, net);
  const one = await first.open();
  await one.read();
  net.server.online = false;
  await assert.rejects(one.save('progress-one', true, 'intro'));
  first.dom.window.close();

  net.server.online = true;
  net.server.session = 'session-review';
  net.server.mode = 'Review';
  const review = page('cmi5', 'review', storage, net);
  const reviewing = await review.open();
  assert.equal(reviewing.readOnly, true);
  assert.equal(net.server.state, null);
  assert.equal(pending(storage).state, 'progress-one');
  review.dom.window.close();

  net.server.session = 'session-two';
  net.server.mode = 'Normal';
  const second = page('cmi5', 'two', storage, net);
  await second.open();
  assert.equal(net.server.state, 'progress-one');
  second.dom.window.close();
});

test('a statement the LRS refuses outright does not block later launches', async () => {
  const storage = browserStorage();
  const net = lrs();
  const first = page('tincan', 'Basic first-secret', storage, net);
  const one = await first.open();
  await one.read();
  net.server.statementStatus = 503;
  await assert.rejects(one.save('progress-one', true, 'intro'));
  const refused = JSON.parse(pending(storage).statements[0]!) as Statement;
  first.dom.window.close();

  net.server.statementStatus = 0;
  net.server.refuse.add(refused.id);
  const second = page('tincan', 'Basic second-secret', storage, net);
  await second.open();
  assert.deepEqual(verbs(net.server.statements), ['initialized', 'initialized']);
  assert.equal(storage.rows().length, 0);
  second.dom.window.close();
});
