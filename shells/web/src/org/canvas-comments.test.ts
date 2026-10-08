// SPDX-License-Identifier: MPL-2.0
/**
 * org/canvas-comments.ts - the Work comments capability (plan 76 milestone 4, S-15).
 *
 * Driven against a stubbed fetch: no network, no DOM. Proves that the optional review
 * members reach the routes the spec names, that every one of them refuses after the
 * account or the instance changes, that ids from links and frames are validated, that
 * the list is read leniently and revalidated with its ETag, and that a 429 becomes a
 * stated cooldown rather than a stream of retries.
 *
 * Run directly:  node --test shells/web/src/org/canvas-comments.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import type { CommentThread } from '@lolly-tools/core/canvas-review-v1';
import { type CommentAccessError, createWorkComments, mentionIds, retryAfterSeconds } from './canvas-comments.ts';
import { _setBaseForTests } from '../lib/instance.ts';
import { setReviewTarget, takeReviewTarget } from '../lib/review-target.ts';

const BASE = 'https://instance.test';
const ROOT = `${BASE}/api/v1/sessions/ses_1`;
const at = '2026-10-07T10:00:00.000Z';

function threadOf(id: string, over: Partial<CommentThread> = {}): CommentThread {
  return { id, sessionId: 'ses_1', anchor: { kind: 'canvas', surface: 'main', x: 1, y: 2 }, authorId: 'u2', authorName: 'Ana',
    revision: 1, createdAt: at, updatedAt: at, messages: [{ id: `${id}m`, authorId: 'u2', authorName: 'Ana', body: 'Hello', createdAt: at }], ...over };
}
const permissions = { userId: 'u1', create: true, editOwn: true, resolveAny: false, deleteAny: false };
const listBody = (extra: Record<string, unknown> = {}) => ({ enabled: true, permissions, threads: [threadOf('t1')], ...extra });
const allFeatures = { mentions: true, reads: true, events: true, thread: true };

interface Seen { url: string; method: string; headers: Headers; body?: unknown }
type Reply = (request: Seen) => Response;
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

/** Install a fetch stub for one case; every request is recorded in order. */
function serve(reply: Reply): Seen[] {
  const seen: Seen[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request: Seen = { url: String(input), method: init?.method ?? 'GET', headers: new Headers(init?.headers),
      ...(typeof init?.body === 'string' ? { body: JSON.parse(init.body) } : {}) };
    seen.push(request);
    return reply(request);
  }) as typeof fetch;
  return seen;
}

/** A capability for `ses_1` whose signed-in person the case can change. */
function capability(options: Parameters<typeof createWorkComments>[2] = {}) {
  _setBaseForTests(BASE);
  const who = { id: 'u1' as string | undefined };
  return { who, comments: createWorkComments('ses_1', () => who.id, options) };
}

/** The usual server: lists with every feature and an ETag, and answers the new routes. */
const fullServer: Reply = ({ url, method }) => {
  if (url === `${ROOT}/comments` && method === 'GET') return json(listBody({ features: allFeatures, reads: {}, readFloor: at, notices: [] }), 200, { etag: '"v1"' });
  if (url === `${ROOT}/comments/t1`) return json({ thread: threadOf('t1'), readAt: at });
  if (url.startsWith(`${ROOT}/comment-people`)) return json({ people: [{ id: 'u3', name: 'Bo' }], truncated: false });
  if (url === `${ROOT}/comment-reads`) return json({ readAt: at, count: 1 });
  return json({ error: { code: 'NOT_FOUND' } }, 404);
};

test('list reads the new fields leniently and drops anything malformed', async () => {
  serve(() => json(listBody({
    reads: { t1: at, 'bad id': at, t2: 'not a time', toString: at },
    readFloor: at,
    notices: ['t1', 't1', 'bad id', 7],
    features: { mentions: true, reads: 'yes', events: true, thread: true },
  })));
  const { comments } = capability({ changes: { subscribe: () => () => {} } });
  const listed = await comments.list();
  assert.deepEqual(Object.entries(listed.reads ?? {}), [['t1', at], ['toString', at]]);
  assert.equal(Object.getPrototypeOf(listed.reads), null, 'a thread id never reads an inherited member');
  assert.equal(listed.readFloor, at);
  assert.deepEqual(listed.notices, ['t1']);
  assert.deepEqual(listed.features, { mentions: true, reads: false, events: true, thread: true });
});

test('an older server sends no review fields, so every feature is off', async () => {
  const seen = serve(() => json(listBody()));
  const { comments } = capability();
  const listed = await comments.list();
  for (const key of ['reads', 'readFloor', 'notices', 'features'] as const) assert.equal(listed[key], undefined, key);
  // Off features make no request at all.
  await assert.rejects(comments.get!('t1'), (error: CommentAccessError) => error.status === 404);
  await assert.rejects(comments.suggest!('a'), (error: CommentAccessError) => error.status === 404);
  await comments.markRead!(['t1']);
  assert.equal(seen.length, 1);
});

test('live events are reported only when this capability actually receives them', async () => {
  serve(fullServer);
  assert.equal((await capability().comments.list()).features?.events, false, 'no changes stream: keep the 2 s poll');
  assert.equal((await capability({ changes: { subscribe: () => () => {} } }).comments.list()).features?.events, true);
});

test('list revalidates with If-None-Match and a 304 returns the previous list as a copy', async () => {
  let etag = '"v1"';
  const seen = serve(({ headers }) => headers.get('if-none-match') === etag ? new Response(null, { status: 304 })
    : json(listBody({ features: allFeatures }), 200, { etag }));
  const { comments } = capability();
  const first = await comments.list();
  assert.equal(seen[0]!.headers.get('if-none-match'), null);
  const second = await comments.list();
  assert.equal(seen[1]!.headers.get('if-none-match'), '"v1"');
  assert.deepEqual(second, first);
  assert.notEqual(second.threads, first.threads, 'the caller gets its own array');
  etag = '"v2"';
  await comments.list();
  assert.equal(seen[2]!.headers.get('if-none-match'), '"v1"', 'a changed list comes back whole');
});

test('get fetches one thread, answers null when it is gone, and validates what it receives', async () => {
  const seen = serve((request) => request.url === `${ROOT}/comments/t9` ? json({ error: { code: 'NOT_FOUND' } }, 404)
    : request.url === `${ROOT}/comments/t2` ? json({ thread: threadOf('t3') })
    : request.url === `${ROOT}/comments/t4` ? json({ thread: threadOf('t4', { sessionId: 'ses_2' }) })
    : fullServer(request));
  const { comments } = capability();
  await assert.rejects(comments.get!('t1'), (error: CommentAccessError) => error.status === 404, 'nothing listed yet: the caller lists instead');
  await comments.list();
  assert.equal((await comments.get!('t1'))?.id, 't1');
  assert.equal(seen.at(-1)!.url, `${ROOT}/comments/t1`);
  assert.equal(await comments.get!('t9'), null);
  await assert.rejects(comments.get!('t2'), (error: CommentAccessError) => error.status === 422, 'another thread than the one asked for');
  await assert.rejects(comments.get!('t4'), (error: CommentAccessError) => error.status === 422, 'a thread from another session');
  const count = seen.length;
  assert.equal(await comments.get!('../t1'), null);
  assert.equal(await comments.get!('constructor'), null);
  assert.equal(seen.length, count, 'an invalid id makes no request');
});

test('create and command send clean mentions and pass the notified answer back', async () => {
  const seen = serve(({ url }) => json({ thread: threadOf(url.endsWith('/t1') ? 't1' : 't5'), notified: false }, url.endsWith('/comments') ? 201 : 200));
  const { comments } = capability();
  const many = Array.from({ length: 14 }, (_, i) => `u${i}`);
  const created = await comments.create({ kind: 'canvas', surface: 'main', x: 1, y: 2 }, 'Hi @Bo', 't5', 'm5', ['u3', 'u3', '', '__proto__', ...many]);
  assert.equal(created.notified, false);
  const sent = seen[0]!.body as { mentions: string[] };
  assert.equal(seen[0]!.method, 'POST');
  assert.deepEqual(sent.mentions, ['u3', 'u0', 'u1', 'u2', 'u4', 'u5', 'u6', 'u7', 'u8', 'u9']);
  await comments.create({ kind: 'canvas', surface: 'main', x: 1, y: 2 }, 'Hi', 't5', 'm6');
  assert.equal('mentions' in (seen[1]!.body as object), false, 'absent stays absent');
  await comments.command(threadOf('t1'), 'edit', { messageId: 't1m', body: 'Hi', mentions: [] });
  assert.deepEqual(seen[2]!.body, { revision: 1, action: 'edit', messageId: 't1m', body: 'Hi', mentions: [] }, 'an edit may clear its mentions');
  await comments.command(threadOf('t1'), 'resolve', { mentions: ['u3'] });
  assert.deepEqual(seen[3]!.body, { revision: 1, action: 'resolve' }, 'only replies and edits carry mentions');
  assert.equal(seen[3]!.url, `${ROOT}/comments/t1`);
});

test('suggest asks comment-people and offers only valid people without an email address', async () => {
  const people = [{ id: 'u3', name: 'Bo' }, { id: 'u3', name: 'Bo again' }, { id: 'u1', name: 'Me' }, { id: 'u4', name: 'ana@corp.example' },
    { id: '', name: 'Nobody' }, { id: 'u5', name: '' }, ...Array.from({ length: 25 }, (_, i) => ({ id: `p${i}`, name: `Person ${i}` }))];
  const seen = serve((request) => request.url.startsWith(`${ROOT}/comment-people`) ? json({ people, truncated: false }) : fullServer(request));
  const { comments } = capability();
  await comments.list();
  const found = await comments.suggest!(`  ${'b'.repeat(80)}  `);
  assert.equal(seen.at(-1)!.url, `${ROOT}/comment-people?q=${'b'.repeat(64)}`);
  assert.deepEqual(found.people.slice(0, 2), [{ id: 'u3', name: 'Bo' }, { id: 'p0', name: 'Person 0' }]);
  assert.equal(found.people.length, 20);
  assert.equal(found.truncated, true);
  assert.ok(found.people.every(person => !person.name.includes('@') && person.id !== 'u1'));
});

test('a server without comment-people turns mentions off for the next list', async () => {
  serve((request) => request.url.startsWith(`${ROOT}/comment-people`) ? json({ error: { code: 'NOT_FOUND' } }, 404) : fullServer(request));
  const { comments } = capability();
  assert.equal((await comments.list()).features?.mentions, true);
  await assert.rejects(comments.suggest!('b'), (error: CommentAccessError) => error.status === 404);
  assert.equal((await comments.list()).features?.mentions, false, 'the panel hides @');
});

test('markRead posts valid thread ids in batches of 100 with a normalised time', async () => {
  const seen = serve(fullServer);
  const { comments } = capability();
  await comments.list();
  const ids = Array.from({ length: 150 }, (_, i) => `t${i}`);
  await comments.markRead!([...ids, 't1', 'bad id'], '2026-10-07T12:00:00+02:00');
  const posts = seen.filter(request => request.url === `${ROOT}/comment-reads`);
  assert.equal(posts.length, 2);
  assert.ok(posts.every(request => request.method === 'POST'));
  assert.deepEqual(posts[0]!.body, { threadIds: ids.slice(0, 100), at: '2026-10-07T10:00:00.000Z' });
  assert.deepEqual(posts[1]!.body, { threadIds: ids.slice(100), at: '2026-10-07T10:00:00.000Z' });
  await comments.markRead!(['bad id']);
  await comments.markRead!(['t1'], 'yesterday');
  assert.deepEqual(seen.at(-1)!.body, { threadIds: ['t1'] }, 'an unreadable time is left to the server');
  assert.equal(seen.filter(request => request.url === `${ROOT}/comment-reads`).length, 3, 'nothing valid, no request');
});

test('a thread link is the team link plus the validated thread id', async () => {
  const { teamLinkUrl } = await import('./team-save.ts');
  const { comments } = capability();
  assert.equal(comments.link!('t1'), `${teamLinkUrl('ses_1')}?thread=t1`);
  assert.equal(comments.link!('t1'), `${BASE}/#/team/ses_1?thread=t1`);
  assert.equal(comments.link!('a b'), teamLinkUrl('ses_1'), 'an invalid id never reaches a link');
  _setBaseForTests(`${BASE}/sub/`);
  const odd = createWorkComments('a/b c', () => 'u1');
  assert.equal(odd.link!('t1'), `${teamLinkUrl('a/b c')}?thread=t1`, 'the same address as the Share dialog for any base and id');
  _setBaseForTests(BASE);
});

test('targets are taken once, for this session only, and never for another account', () => {
  const { comments, who } = capability();
  assert.equal(setReviewTarget('ses_1', 'bad id'), false);
  assert.equal(comments.pendingTarget!(), undefined, 'an invalid link id was never held');
  setReviewTarget('ses_2', 't1');
  assert.equal(comments.pendingTarget!(), undefined, 'another session keeps its own target');
  assert.equal(takeReviewTarget('ses_2'), 't1');
  setReviewTarget('ses_1', 't1');
  assert.equal(comments.pendingTarget!(), 't1');
  assert.equal(comments.pendingTarget!(), undefined, 'taken once');

  const heard: string[] = [];
  const off = comments.onTarget!(id => heard.push(id));
  setReviewTarget('ses_2', 't2');
  setReviewTarget('ses_1', 't3');
  assert.deepEqual(heard, ['t3']);
  assert.equal(comments.pendingTarget!(), undefined, 'a target acted on is not offered again');
  who.id = 'u9';
  setReviewTarget('ses_1', 't4');
  assert.deepEqual(heard, ['t3'], 'another account hears nothing');
  assert.equal(comments.pendingTarget!(), undefined);
  off();
  takeReviewTarget('ses_1'); takeReviewTarget('ses_2');
});

test('changes forwards valid events only while the same account is signed in', () => {
  let push: (event: { threadId: string; revision: number }) => void = () => {};
  let released = false;
  const { comments, who } = capability({ changes: { subscribe(fn) { push = fn; return () => { released = true; }; } } });
  const heard: unknown[] = [];
  const off = comments.changes!.subscribe(event => heard.push(event));
  push({ threadId: 't1', revision: 2 });
  push({ threadId: 'bad id', revision: 3 });
  push({ threadId: 't1', revision: 0 });
  who.id = 'u9';
  push({ threadId: 't1', revision: 4 });
  assert.deepEqual(heard, [{ threadId: 't1', revision: 2 }]);
  off();
  assert.equal(released, true);
  assert.equal(capability().comments.changes, undefined, 'no stream, no member');
});

test('every workspace call refuses after the account or the instance changes', async () => {
  const seen = serve(fullServer);
  const anchor = { kind: 'canvas' as const, surface: 'main', x: 1, y: 2 };
  const calls = (comments: ReturnType<typeof capability>['comments']) => [
    () => comments.list(), () => comments.get!('t1'), () => comments.create(anchor, 'Hi', 't5', 'm5'),
    () => comments.command(threadOf('t1'), 'reply', { messageId: 'm6', body: 'Hi' }), () => comments.suggest!('b'),
    () => comments.markRead!(['t1']), async () => comments.link!('t1'),
  ];
  for (const change of ['account', 'instance', 'signed out'] as const) {
    const { comments, who } = capability();
    await comments.list();
    const before = seen.length;
    if (change === 'account') who.id = 'u9';
    else if (change === 'instance') _setBaseForTests('https://other.test');
    else who.id = undefined;
    for (const call of calls(comments)) await assert.rejects(call(), (error: CommentAccessError) => error.status === 403, change);
    assert.equal(seen.length, before, `${change}: no request leaves`);
  }
  _setBaseForTests(BASE);
});

test('a rate limit starts a cooldown for that kind of call instead of a retry storm', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(at) });
  let limited = true;
  const seen = serve((request) => request.method === 'POST' && limited ? json({ error: { code: 'RATE_LIMITED' } }, 429, { 'retry-after': '30' }) : fullServer(request));
  const { comments } = capability();
  await comments.list();
  const reply = () => comments.command(threadOf('t1'), 'reply', { messageId: 'm6', body: 'Hi' });
  await assert.rejects(reply(), (error: CommentAccessError) => error.status === 429 && error.retryAfter === 30
    && error.message === 'You are commenting too quickly. Try again in a moment.');
  const posts = () => seen.filter(request => request.method === 'POST').length;
  t.mock.timers.tick(10_000);
  await assert.rejects(reply(), (error: CommentAccessError) => error.status === 429 && error.retryAfter === 20);
  await assert.rejects(comments.create({ kind: 'canvas', surface: 'main', x: 1, y: 2 }, 'Hi', 't5', 'm5'), (error: CommentAccessError) => error.status === 429,
    'create shares the comment write limit');
  assert.equal(posts(), 1, 'the cooldown answers locally');
  await comments.list();
  assert.equal(seen.at(-1)!.method, 'GET', 'other kinds of call still go out');
  limited = false;
  t.mock.timers.tick(20_000);
  assert.equal((await reply()).id, 't1');
  assert.equal(posts(), 2);
});

test('helpers: mention ids and Retry-After', () => {
  assert.equal(mentionIds(undefined), undefined);
  assert.deepEqual(mentionIds(['a', 'a', 'prototype', 7, 'b']), ['a', 'b']);
  const now = Date.parse(at);
  assert.equal(retryAfterSeconds('45', now), 45);
  assert.equal(retryAfterSeconds(null, now), 10);
  assert.equal(retryAfterSeconds('0', now), 1);
  assert.equal(retryAfterSeconds('99999', now), 300);
  assert.equal(retryAfterSeconds(new Date(now + 12_500).toUTCString(), now), 12);
});
