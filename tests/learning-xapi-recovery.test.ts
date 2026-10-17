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
    /** Statement POSTs fail on the network while the LMS and state API still answer. */
    statementsOffline: false,
    /** A status for one statement ID, sent instead of accepting that statement. */
    refuse: new Map<string, number>(),
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
    // Each cmi5 launch gets its own token, named after its fetch URL.
    if (u.hostname === 'lms.test')
      return Response.json({ 'auth-token': `Basic cmi5-secret-${u.pathname.split('/').pop()}` });
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
      if (server.statementsOffline) throw new TypeError('Failed to fetch');
      const statement = JSON.parse(String(init.body)) as Statement;
      const refused = server.refuse.get(statement.id);
      if (refused) return new Response(null, { status: refused });
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
type Pending = {
  statements: Array<{ session: string; body: string }>;
  state: string | null;
  base: string | null;
  started: string[];
  ended: string[];
};
const pending = (storage: ReturnType<typeof browserStorage>) => {
  const rows = storage.rows();
  assert.equal(rows.length, 1, 'one record for the one attempt');
  return rows[0]![1] as Pending;
};
const stored = (storage: ReturnType<typeof browserStorage>) =>
  pending(storage).statements.map((s) => JSON.parse(s.body) as Statement);
/** Checks that no stored row holds a token, a launch URL or a cmi5 fetch URL. */
const noSecrets = (storage: ReturnType<typeof browserStorage>) => {
  const rows = JSON.stringify(storage.rows());
  for (const secret of ['secret', 'Basic', 'auth', 'lms.test/course', 'lms.test/token'])
    assert.ok(!rows.includes(secret), `the recovery record never holds ${secret}`);
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
  const queued = stored(storage);
  assert.deepEqual(verbs(queued), ['completed', 'terminated']);
  assert.equal(record.state, 'progress-two');
  assert.equal(record.base, '"1"', 'the copy names the document it replaces');
  noSecrets(storage);
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
    queued,
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
  const lost = stored(storage)[0]!;
  assert.equal(sessionOf(lost), 'session-one');
  noSecrets(storage);
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
  assert.deepEqual(pending(storage).statements, [], 'the earlier session statement is dropped');
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
  assert.equal(pending(storage).state, 'stale', 'the unsent copy was stored');
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
  const refused = stored(storage)[0]!;
  first.dom.window.close();

  net.server.statementStatus = 0;
  net.server.refuse.set(refused.id, 400);
  const second = page('tincan', 'Basic second-secret', storage, net);
  await second.open();
  assert.deepEqual(verbs(net.server.statements), ['initialized', 'initialized']);
  assert.equal(storage.rows().length, 0);
  second.dom.window.close();
});

/** Leaves a statements-only record: completed and terminated, with the progress acknowledged. */
async function strand(storage: ReturnType<typeof browserStorage>, net: ReturnType<typeof lrs>) {
  const first = page('tincan', 'Basic first-secret', storage, net);
  const one = await first.open();
  await one.read();
  net.server.statementStatus = 503;
  await assert.rejects(one.save('progress-one', true, 'intro'));
  await assert.rejects(one.finish());
  net.server.statementStatus = 0;
  first.dom.window.close();
  assert.equal(net.server.state, 'progress-one');
  assert.equal(pending(storage).state, null, 'only statements are pending');
  assert.deepEqual(verbs(stored(storage)), ['completed', 'terminated']);
  return JSON.stringify(storage.rows());
}

test('a statements-only record is not sent under a launch that is not authorized', async () => {
  const storage = browserStorage();
  const net = lrs();
  const before = await strand(storage, net);

  net.server.expired = true;
  const second = page('tincan', 'Basic expired-secret', storage, net);
  await assert.rejects(second.open(), /authorization has expired/);
  assert.ok(
    second.calls().some((c) => c.url.searchParams.get('stateId') === 'lolly.progress.v1'),
    'the progress read checks the authorization first'
  );
  assert.ok(!second.calls().some((c) => c.init.method === 'POST' || c.init.method === 'PUT'));
  assert.equal(JSON.stringify(storage.rows()), before);
  second.dom.window.close();
});

test('a 401 on an older statement keeps the record and fails the launch', async () => {
  const storage = browserStorage();
  const net = lrs();
  const before = await strand(storage, net);

  // The progress read succeeds, so only the statement API refuses these credentials.
  net.server.statementStatus = 401;
  const second = page('tincan', 'Basic statement-refused', storage, net);
  await assert.rejects(second.open(), /authorization has expired/);
  assert.equal(JSON.stringify(storage.rows()), before, 'nothing is dropped');
  second.dom.window.close();

  net.server.statementStatus = 0;
  const third = page('tincan', 'Basic third-secret', storage, net);
  await third.open();
  assert.deepEqual(verbs(net.server.statements), [
    'initialized',
    'completed',
    'terminated',
    'initialized',
  ]);
  assert.equal(storage.rows().length, 0);
  third.dom.window.close();
});

test('a 403 on an older statement drops it only after the launch is accepted', async () => {
  const storage = browserStorage();
  const net = lrs();
  const first = page('tincan', 'Basic first-secret', storage, net);
  const one = await first.open();
  await one.read();
  net.server.statementStatus = 503;
  await assert.rejects(one.save('progress-one', true, 'intro'));
  const before = JSON.stringify(storage.rows());
  const forbidden = stored(storage)[0]!;
  first.dom.window.close();

  // The launch's own statement is refused too, so every older record stays.
  net.server.statementStatus = 403;
  const second = page('tincan', 'Basic second-secret', storage, net);
  await assert.rejects(second.open(), /authorization has expired/);
  assert.equal(JSON.stringify(storage.rows()), before);
  second.dom.window.close();

  net.server.statementStatus = 0;
  net.server.refuse.set(forbidden.id, 403);
  const third = page('tincan', 'Basic third-secret', storage, net);
  await third.open();
  assert.deepEqual(verbs(net.server.statements), ['initialized', 'initialized']);
  assert.equal(storage.rows().length, 0, 'the accepted launch drops the forbidden statement');
  third.dom.window.close();
});

for (const target of ['tincan', 'cmi5'] as const)
  test(`${target}: a launch that cannot reach the LRS keeps none of its own statements`, async () => {
    const storage = browserStorage();
    const net = lrs();
    net.server.statementsOffline = true;
    const first = page(target, target === 'cmi5' ? 'one' : 'Basic first-secret', storage, net);
    await assert.rejects(first.open(), /could not be saved/);
    assert.equal(storage.rows().length, 0, 'no initialized and no cmi5 start marker remain');
    first.dom.window.close();

    net.server.statementsOffline = false;
    const second = page(target, target === 'cmi5' ? 'again' : 'Basic second-secret', storage, net);
    await second.open();
    assert.deepEqual(verbs(net.server.statements), ['initialized']);
    second.dom.window.close();
  });

test('cmi5: reloading the same session does not send initialized again', async () => {
  const storage = browserStorage();
  const net = lrs();
  const first = page('cmi5', 'one', storage, net);
  await first.open();
  first.dom.window.close();

  const reload = page('cmi5', 'reload', storage, net);
  const again = await reload.open();
  assert.deepEqual(verbs(net.server.statements), ['initialized']);
  await again.read();
  await again.save('progress-one', true, 'end');
  assert.deepEqual(verbs(net.server.statements), ['initialized', 'completed']);
  assert.deepEqual(net.server.statements.map(sessionOf), ['session-one', 'session-one']);
  reload.dom.window.close();
});

test('terminated waits behind a completed statement that failed in the same page', async () => {
  const storage = browserStorage();
  const net = lrs();
  const first = page('tincan', 'Basic first-secret', storage, net);
  const one = await first.open();
  await one.read();
  net.server.statementStatus = 503;
  await assert.rejects(one.save('progress-one', true, 'end'));
  net.server.statementStatus = 0;
  await one.finish();
  assert.deepEqual(verbs(net.server.statements), ['initialized', 'completed', 'terminated']);
  assert.equal(storage.rows().length, 0);
  first.dom.window.close();
});

test('a completion reached after a failed Exit is sent before terminated', async () => {
  const storage = browserStorage();
  const net = lrs();
  const first = page('tincan', 'Basic first-secret', storage, net);
  const one = await first.open();
  await one.read();
  await one.save('progress-one', false, 'intro');
  net.server.statementStatus = 503;
  await assert.rejects(one.finish());
  const closing = stored(storage)[0]!;
  assert.deepEqual(verbs([closing]), ['terminated']);

  net.server.statementStatus = 0;
  await one.save('progress-two', true, 'end');
  assert.deepEqual(
    verbs(net.server.statements),
    ['initialized', 'completed'],
    'Save sends the completion and leaves terminated for Finish'
  );
  await one.finish();
  assert.deepEqual(verbs(net.server.statements), ['initialized', 'completed', 'terminated']);
  assert.equal(net.server.statements[2]!.id, closing.id, 'terminated keeps its original ID');
  first.dom.window.close();
});

test('cmi5: two open sessions each send only their own statements', async () => {
  const storage = browserStorage();
  const net = lrs();
  const tokens: Record<string, string> = {
    'session-one': 'Basic cmi5-secret-one',
    'session-two': 'Basic cmi5-secret-two',
  };
  const first = page('cmi5', 'one', storage, net);
  const one = await first.open();
  // The LMS launches the same registration again while the first page stays open.
  net.server.session = 'session-two';
  const second = page('cmi5', 'two', storage, net);
  const two = await second.open();

  net.server.statementStatus = 503;
  await one.read();
  await assert.rejects(one.save('progress-one', true, 'intro'));
  await two.read();
  await assert.rejects(two.save('progress-two', true, 'end'));
  assert.deepEqual(stored(storage).map(sessionOf), ['session-one', 'session-two']);

  net.server.statementStatus = 0;
  await two.finish();
  await one.finish();
  const posts = net.server.calls.filter((c) => c.url.pathname.endsWith('/statements'));
  for (const { init } of posts) {
    const statement = JSON.parse(String(init.body)) as Statement;
    assert.equal(
      (init.headers as Record<string, string>).Authorization,
      tokens[String(sessionOf(statement))],
      'a statement is sent only under the token of the session that made it'
    );
  }
  for (const session of ['session-one', 'session-two'])
    assert.deepEqual(
      verbs(net.server.statements.filter((s) => sessionOf(s) === session)),
      ['initialized', 'completed', 'terminated'],
      session
    );
  assert.equal(pending(storage).statements.length, 0);
  first.dom.window.close();
  second.dom.window.close();
});
