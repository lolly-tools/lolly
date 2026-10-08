// SPDX-License-Identifier: MPL-2.0
/**
 * org/inbox.ts - the member's inbox, kept current (plan 74 invite spec 5.1).
 *
 * The pure parts (reading the instance's answer, the poll delay) are checked on
 * their own. The fetching is driven in jsdom against a stubbed fetch with node's mock
 * timers standing in for the clock: the first fetch (at once with unread messages,
 * else on the first focus), the ETag round trip and the 304, the one-minute floor
 * on focus and visibility, polling only while the tab is visible, the stop on a 401
 * and the doubling wait after a 5xx. Then what a fetch does with the list: one
 * polite announcement per fetch for new messages, a dismissed message staying gone,
 * and a share for an open project acked instead of listed.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/org/inbox.test.ts
 */
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';

// Node cannot import a locale catalog (.json with no import attribute), so i18n.ts
// would fall back to English in every language. A small German catalog is served in
// its place, holding only the keys the comment-notice test reads.
const GERMAN: Record<string, string> = {
  'New message: {title}': 'Neue Nachricht: {title}',
  '{name} mentioned you in {document}': '{name} hat Sie in {document} erwähnt',
  'New replies in {document}: {count}': 'Neue Antworten in {document}: {count}',
  'This comment is no longer available.': 'Dieser Kommentar ist nicht mehr verfügbar.',
};
registerHooks({
  load(url: string, ctx: unknown, next: (u: string, c: unknown) => unknown) {
    if (url.endsWith('/locales/de.json')) return { format: 'module', shortCircuit: true, source: `export default ${JSON.stringify(GERMAN)};` };
    return next(url, ctx);
  },
} as Parameters<typeof registerHooks>[0]);

const dom = new JSDOM(
  '<!doctype html><html><body><div id="app"><main id="view"></main></div></body></html>',
  { url: 'https://instance.test/', pretendToBeVisual: true },
);
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location as unknown as Location;
// The clock is mocked below, so the next frame rides setImmediate instead.
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => { setImmediate(() => cb(0)); return 0; }) as unknown as typeof requestAnimationFrame;

let visibility: DocumentVisibilityState = 'visible';
Object.defineProperty(dom.window.document, 'visibilityState', { configurable: true, get: () => visibility });

type Handler = (url: string, init?: RequestInit) => Response;
let router: Handler = () => new Response('', { status: 404 });
let calls: Array<{ url: string; method: string; ifNoneMatch: string | null }> = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  calls.push({ url: String(input), method: (init?.method ?? 'GET').toUpperCase(), ifNoneMatch: new Headers(init?.headers).get('if-none-match') });
  return router(String(input), init);
}) as typeof fetch;
const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

const inbox = await import('./inbox.ts');
const { _resetBannerForTests, attachBanner } = await import('./banner.ts');
const { noteProjectOpened } = await import('./opened-projects.ts');
const {
  dismissMessage, inboxMessages, messageFromRow, messagesFromBody, nextPollDelay, onInboxChange, refreshInbox, startInbox,
  MAX_BACKOFF_MS, POLL_MS,
} = inbox;
type InboxMessage = import('./inbox.ts').InboxMessage;

const msg = (id: string, extra: Partial<InboxMessage> = {}): InboxMessage =>
  ({ id, kind: 'notice', severity: 'info', title: `Message ${id}`, dismissible: true, ...extra });

/** Settle the fetch stub's promises and the announcement's frame (the clock is mocked). */
async function settle(): Promise<void> {
  for (let i = 0; i < 6; i++) await new Promise<void>((r) => setImmediate(r));
}
const gets = (): number => calls.filter((c) => c.method === 'GET' && c.url.endsWith('/api/v1/inbox')).length;
const politeText = (): string => document.querySelector('[aria-live="polite"]')?.textContent ?? '';

function reset(): void {
  _resetBannerForTests(); // the banner's own state, then the inbox's
  calls = [];
  visibility = 'visible';
  router = () => new Response('', { status: 404 });
  const region = document.querySelector('[aria-live="polite"]');
  if (region) region.textContent = '';
}

test.beforeEach(() => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 10_000_000 });
  mock.method(Math, 'random', () => 0.5); // no jitter: a poll is due exactly a minute on
});
test.afterEach(() => {
  reset();
  mock.timers.reset();
  mock.restoreAll();
});

// ── Pure ─────────────────────────────────────────────────────────────────────

test('messageFromRow keeps a usable message and drops the rest', () => {
  assert.equal(messageFromRow({ id: 'a', severity: 'loud', title: 'x' }), null, 'unknown severity');
  assert.equal(messageFromRow({ id: 'a', severity: 'toString', title: 'x' }), null, 'not a severity, even if Object has it');
  assert.equal(messageFromRow({ severity: 'info', title: 'x' }), null, 'no id');
  assert.equal(messageFromRow({ id: 'a', severity: 'info', title: '  ' }), null, 'no title');
  assert.deepEqual(
    messageFromRow({ id: 'a', kind: 'request', severity: 'action', title: 'Sam asks', body: 'b', cta: { label: 'Review', url: '/#/x' }, data: { kind: 'access-request', n: 3, at: '2026-10-03T10:00:00Z' }, dismissible: true }),
    { id: 'a', kind: 'request', severity: 'action', title: 'Sam asks', body: 'b', cta: { label: 'Review', url: '/#/x' }, data: { kind: 'access-request', at: '2026-10-03T10:00:00Z' }, dismissible: true },
    'data keeps string values only',
  );
  assert.equal(messageFromRow({ id: 'a', severity: 'info', title: 'x', dismissible: 'yes' })?.dismissible, false);
  assert.equal(messageFromRow({ id: 'a', severity: 'info', title: 'x', cta: { label: 'Open' } })?.cta, undefined, 'a link needs both halves');
  assert.equal(messagesFromBody({ nope: [] }), null);
  assert.deepEqual(messagesFromBody({ messages: [{ id: 'a', severity: 'info', title: 'x' }, 7] })?.map((m) => m.id), ['a']);
});

test('nextPollDelay: a minute give or take 10 seconds, doubling after failures up to 10 minutes', () => {
  assert.equal(nextPollDelay(0, 0.5), POLL_MS);
  assert.equal(nextPollDelay(0, 0), POLL_MS - 10_000);
  assert.ok(nextPollDelay(0, 0.9999) <= POLL_MS + 10_000);
  assert.equal(nextPollDelay(1, 0.5), 2 * POLL_MS);
  assert.equal(nextPollDelay(2, 0.5), 4 * POLL_MS);
  assert.equal(nextPollDelay(9, 0.5), MAX_BACKOFF_MS);
});

// ── Fetching ─────────────────────────────────────────────────────────────────

test('unread messages at boot: the first fetch runs at once, then the ETag rides along and a 304 keeps the list', async () => {
  let answer: Response = json({ messages: [msg('a')], unread: 1 }, 200, { etag: '"ib-1"' });
  router = () => answer;
  startInbox({ initialUnread: 1 });
  await settle();
  assert.equal(gets(), 1);
  assert.equal(calls[0]!.ifNoneMatch, null, 'nothing to match yet');
  assert.deepEqual(inboxMessages().map((m) => m.id), ['a']);

  let heard = 0;
  onInboxChange(() => { heard++; });
  answer = new Response(null, { status: 304 });
  mock.timers.tick(POLL_MS);
  await settle();
  assert.equal(gets(), 2, 'the minute poll');
  assert.equal(calls.at(-1)!.ifNoneMatch, '"ib-1"');
  assert.deepEqual(inboxMessages().map((m) => m.id), ['a'], 'a 304 keeps the list');
  assert.equal(heard, 0, 'and tells nobody');
});

test('no unread messages at boot: nothing until the first focus, and focus never fetches twice in a minute', async () => {
  router = () => json({ messages: [] });
  startInbox({ initialUnread: 0 });
  await settle();
  assert.equal(gets(), 0);
  window.dispatchEvent(new dom.window.Event('focus'));
  await settle();
  assert.equal(gets(), 1, 'the first focus fetches');
  mock.timers.tick(30_000);
  window.dispatchEvent(new dom.window.Event('focus'));
  document.dispatchEvent(new dom.window.Event('visibilitychange'));
  window.dispatchEvent(new dom.window.Event('online'));
  await settle();
  assert.equal(gets(), 1, 'half a minute later: no fetch');
  mock.timers.tick(30_000);
  await settle();
  assert.equal(gets(), 2, 'the poll a minute after the last fetch');
});

test('a hidden tab does not poll; showing it again fetches at once', async () => {
  router = () => json({ messages: [] });
  startInbox({ initialUnread: 1 });
  await settle();
  assert.equal(gets(), 1);
  visibility = 'hidden';
  document.dispatchEvent(new dom.window.Event('visibilitychange'));
  mock.timers.tick(5 * POLL_MS);
  await settle();
  assert.equal(gets(), 1, 'five minutes hidden: no fetch');
  visibility = 'visible';
  document.dispatchEvent(new dom.window.Event('visibilitychange'));
  await settle();
  assert.equal(gets(), 2, 'visible again: fetched');
  mock.timers.tick(POLL_MS);
  await settle();
  assert.equal(gets(), 3, 'and polling again');
});

test('a 401 stops the inbox: no polls, no focus fetches', async () => {
  router = () => json({ error: { code: 'UNAUTHORIZED' } }, 401);
  startInbox({ initialUnread: 1 });
  await settle();
  assert.equal(gets(), 1);
  mock.timers.tick(10 * POLL_MS);
  window.dispatchEvent(new dom.window.Event('focus'));
  await settle();
  assert.equal(gets(), 1);
  assert.equal(await refreshInbox(), false, 'an ordinary refresh does nothing');
  assert.equal(gets(), 1);
});

test('no answer or a 5xx waits twice as long each time, then a minute again after a success', async () => {
  let status = 503;
  router = () => (status === 200 ? json({ messages: [] }) : new Response('', { status }));
  startInbox({ initialUnread: 1 });
  await settle();
  assert.equal(gets(), 1);
  mock.timers.tick(POLL_MS);
  await settle();
  assert.equal(gets(), 1, 'not after a minute');
  mock.timers.tick(POLL_MS);
  await settle();
  assert.equal(gets(), 2, 'after two');
  router = () => { throw new TypeError('offline'); };
  mock.timers.tick(4 * POLL_MS - 1);
  await settle();
  assert.equal(gets(), 2, 'the next wait is four minutes');
  mock.timers.tick(1);
  await settle();
  assert.equal(gets(), 3, 'a network failure counts too');
  status = 200;
  router = () => json({ messages: [] });
  mock.timers.tick(8 * POLL_MS);
  await settle();
  assert.equal(gets(), 4);
  mock.timers.tick(POLL_MS);
  await settle();
  assert.equal(gets(), 5, 'back to every minute');
});

test('refreshInbox: a fetch on its way is shared, and force skips the one-minute floor', async () => {
  router = () => json({ messages: [msg('a')] });
  const [one, two] = [refreshInbox({ force: true }), refreshInbox({ force: true })];
  assert.equal(one, two, 'one fetch for both callers');
  assert.equal(await one, true);
  assert.equal(gets(), 1);
  assert.equal(await refreshInbox(), true, 'within the minute: skipped, the list is current');
  assert.equal(gets(), 1);
  assert.equal(await refreshInbox({ force: true }), true);
  assert.equal(gets(), 2);
});

// ── What a fetch does with the list ──────────────────────────────────────────

test('new messages are announced politely, one per fetch, each message once', async () => {
  let list = [msg('a', { title: 'Quarterly report shared' }), msg('b', { title: 'Sam asks to edit Launch', severity: 'action' })];
  router = () => json({ messages: list });
  await refreshInbox({ force: true });
  await settle();
  assert.equal(politeText(), 'New message: Sam asks to edit Launch', 'the most important new one');
  document.querySelector('[aria-live="polite"]')!.textContent = '';
  await refreshInbox({ force: true });
  await settle();
  assert.equal(politeText(), '', 'nothing new: nothing said');
  list = [...list, msg('c', { title: 'Welcome to lolly.ing' })];
  await refreshInbox({ force: true });
  await settle();
  assert.equal(politeText(), 'New message: Welcome to lolly.ing');
});

test('a dismissed message is acked, leaves the list, and stays gone when a fetch still lists it', async () => {
  router = () => json({ messages: [msg('a'), msg('b')] });
  await refreshInbox({ force: true });
  const seen: string[][] = [];
  onInboxChange((msgs) => seen.push(msgs.map((m) => m.id)));
  dismissMessage('a');
  await settle();
  assert.deepEqual(seen, [['b']], 'listeners hear the change');
  assert.ok(calls.some((c) => c.method === 'POST' && c.url.endsWith('/api/v1/inbox/a/ack')));
  await refreshInbox({ force: true });
  assert.deepEqual(inboxMessages().map((m) => m.id), ['b'], 'the stale copy is not brought back');
  assert.deepEqual(seen, [['b']], 'an unchanged list tells nobody');
});

test('a share message for a project already open is acked instead of listed', async () => {
  noteProjectOpened('prj_open');
  const share = (id: string, projectId: string): InboxMessage =>
    msg(id, { kind: 'share', data: { kind: 'project-share', projectId } });
  router = () => json({ messages: [share('s1', 'prj_open'), share('s2', 'prj_other')] });
  await refreshInbox({ force: true });
  await settle();
  assert.deepEqual(inboxMessages().map((m) => m.id), ['s2']);
  assert.ok(calls.some((c) => c.method === 'POST' && c.url.endsWith('/api/v1/inbox/s1/ack')));
});

test('the started inbox feeds its attached banner exactly once', async () => {
  attachBanner();
  const notice = msg('cn_0123456789abcdef01234567', { kind: 'comment', title: 'Ana mentioned you in Poster',
    cta: { label: 'Open thread', url: 'https://elsewhere.example/#/team/s1?thread=t1' },
    data: { kind: 'comment-mention', sessionId: 's1', threadId: 't1', actorName: 'Ana', label: 'Poster', count: '1' } });
  router = () => json({ messages: [msg('hello', { title: 'Welcome to lolly.ing' }), notice] });
  startInbox({ initialUnread: 1 });
  await settle();
  const { notificationEntries } = await import('../lib/notifications.ts');
  assert.ok(notificationEntries().some(row => row.title === 'Welcome to lolly.ing'));
  // A comment notice never follows the server's cta.url: its action opens the inbox, where Open thread is built from data.
  const queued = notificationEntries().find(row => row.id.endsWith(`:${notice.id}`));
  assert.ok(queued?.action && !('href' in queued.action && queued.action.href), 'no link from cta.url');
  assert.equal(document.getElementById('org-banner'), null);
  startInbox({ initialUnread: 1 });
  await settle();
  assert.equal(gets(), 1, 'starting again does nothing');
});

test('a comment notice reaches the queue and the announcement in the app language, not in the instance English', async () => {
  const { setActiveLang } = await import('../i18n.ts');
  const { notificationEntries } = await import('../lib/notifications.ts');
  await setActiveLang('de', { persist: false });
  try {
    const mention = msg('cn_mention000000000000000001', { kind: 'comment', severity: 'action', title: 'Ana mentioned you in Poster',
      body: 'This comment is no longer available.',
      data: { kind: 'comment-mention', sessionId: 's1', threadId: 't1', actorName: 'Ana', label: 'Poster', count: '1' } });
    const replies = msg('cn_reply00000000000000000001', { kind: 'comment', title: 'New replies in Poster: 3', body: 'Looks good',
      data: { kind: 'comment-reply', sessionId: 's1', threadId: 't2', actorName: 'Bo', label: 'Poster', count: '3' } });
    router = () => json({ messages: [mention, replies, msg('hello', { title: 'Welcome to lolly.ing' })] });
    startInbox({ initialUnread: 1 });
    await settle();
    const queued = (id: string) => notificationEntries().find(row => row.id.endsWith(`:${id}`));
    assert.equal(queued(mention.id)?.title, 'Ana hat Sie in Poster erwähnt');
    assert.equal(queued(mention.id)?.body, 'Dieser Kommentar ist nicht mehr verfügbar.');
    assert.equal(queued(replies.id)?.title, 'Neue Antworten in Poster: 3');
    assert.equal(queued(replies.id)?.body, 'Looks good', 'a quoted message stays as written');
    assert.equal(queued('hello')?.title, 'Welcome to lolly.ing', 'any other message keeps the instance title');
    assert.equal(politeText(), 'Neue Nachricht: Ana hat Sie in Poster erwähnt', 'the announcement reads the translated title');
  } finally {
    await setActiveLang('en', { persist: false });
  }
});
