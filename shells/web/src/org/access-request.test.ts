// SPDX-License-Identifier: MPL-2.0
/**
 * org/access-request.ts - Ask for access and Ask to edit (lolly-work plans/75 G13).
 *
 * Proves, against a stubbed fetch and a jsdom document:
 *
 *  1. The pure helpers: the paths, the rows kept, the state a form opens in, the
 *     answer an inbox list carries for this person's own requests, the org-config
 *     switch, and the error sentence.
 *  2. The calls: what is posted (a trimmed note, none when empty), what a refusal
 *     reports, and that no answer reads as status 0.
 *  3. The form: its labelled controls, Sending… while busy, the sent state, the 429
 *     and generic errors, the waiting state with Withdraw, the declined state, Ask to
 *     edit (no role select), text that stays text, and an inbox answer that moves the
 *     form to approved and lets go of the inbox.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/org/access-request.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><main id="view"></main></body></html>', {
  url: 'https://instance.test/#/team/project/p1',
  pretendToBeVisual: true,
});
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location as unknown as Location;
globalThis.Element = dom.window.Element as unknown as typeof Element;
globalThis.HTMLElement = dom.window.HTMLElement as unknown as typeof HTMLElement;
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => { setTimeout(() => cb(0), 0); return 0; }) as unknown as typeof requestAnimationFrame;

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;
let router: Handler = () => new Response('', { status: 404 });
const calls: Array<{ url: string; method: string; body?: unknown }> = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const method = (init?.method ?? 'GET').toUpperCase();
  calls.push({ url, method, ...(typeof init?.body === 'string' ? { body: JSON.parse(init.body) } : {}) });
  return router(url, init);
}) as typeof fetch;
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const {
  askPath, minePath, myRequestFromRow, askStateOf, answerOutcome, projectRequestsOn, askErrorMessage,
  askForAccess, myRequests, withdrawRequest, buildAskForm, NOTE_MAX,
} = await import('./access-request.ts');
type AnswerMessage = import('./access-request.ts').AnswerMessage;
type AskState = import('./access-request.ts').AskState;

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
async function settle(): Promise<void> { for (let i = 0; i < 8; i++) await tick(); }
const view = (): HTMLElement => document.getElementById('view')!;
const ago = (min: number): string => new Date(Date.now() - min * 60_000).toISOString();

function reset(): void {
  router = () => new Response('', { status: 404 });
  calls.length = 0;
  view().replaceChildren();
}

/** A form mounted in the view, with the states it reported. */
function mount(o: Parameters<typeof buildAskForm>[0]): { form: HTMLElement; states: AskState[] } {
  const states: AskState[] = [];
  const form = buildAskForm({ ...o, onState: (s) => { states.push(s); o.onState?.(s); } });
  view().append(form);
  return { form, states };
}
const submit = (root: HTMLElement): void => {
  root.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
};

// ── 1. Pure helpers ──────────────────────────────────────────────────────────

test('the paths for a project and a session, with ids encoded', () => {
  assert.equal(askPath({ projectId: 'p 1' }), '/api/v1/projects/p%201/access-requests');
  assert.equal(askPath({ sessionId: 's/1' }), '/api/v1/sessions/s%2F1/access-requests');
  assert.equal(minePath({ projectId: 'p1' }), '/api/v1/access-requests/mine?projectId=p1');
  assert.equal(minePath({ sessionId: 's&1' }), '/api/v1/access-requests/mine?sessionId=s%261');
});

test('a request row is kept only with an id, a status and a readable time', () => {
  assert.deepEqual(myRequestFromRow({ id: 'req_1', status: 'open', role: 'editor', createdAt: '2026-10-03T10:00:00Z' }), {
    id: 'req_1', status: 'open', role: 'editor', createdAt: '2026-10-03T10:00:00Z', answeredAt: null, answerRole: null,
  });
  assert.equal(myRequestFromRow({ id: 'req_1', status: 'open', role: 'owner', createdAt: '2026-10-03T10:00:00Z' })!.role, null, 'an unknown role is dropped');
  assert.equal(myRequestFromRow({ id: 'req_1', status: 'open', createdAt: 'yesterday' }), null);
  assert.equal(myRequestFromRow({ status: 'open', createdAt: '2026-10-03T10:00:00Z' }), null);
  assert.equal(myRequestFromRow('req_1'), null);
});

test('the form opens on the newest request: waiting, declined, or the form', () => {
  const createdAt = ago(5);
  const row = (status: string, id = 'req_1') => ({ id, status, role: 'editor' as const, createdAt, answeredAt: null, answerRole: null });
  assert.deepEqual(askStateOf(null), { state: 'form' });
  assert.deepEqual(askStateOf([]), { state: 'form' });
  assert.deepEqual(askStateOf([row('open')]), { state: 'asked', open: row('open') });
  assert.deepEqual(askStateOf([row('declined'), row('open', 'req_0')]), { state: 'declined' }, 'only the newest counts');
  assert.deepEqual(askStateOf([row('approved')]), { state: 'form' }, 'access given once and taken away since');
  for (const s of ['withdrawn', 'superseded', 'expired']) assert.deepEqual(askStateOf([row(s)]), { state: 'form' }, s);
});

test('an inbox answer counts only for this person\'s own requests, and approval wins', () => {
  const answer = (requestId: string, outcome: string): AnswerMessage => ({ id: `msg_ans_${requestId}`, data: { kind: 'access-answer', requestId, outcome } });
  const own = new Set(['req_2']);
  assert.equal(answerOutcome([], own), null);
  assert.equal(answerOutcome([answer('req_1', 'approved')], own), null, 'an answer to an older request is not this one');
  assert.equal(answerOutcome([answer('req_2', 'declined')], own), 'declined');
  assert.equal(answerOutcome([answer('req_2', 'declined'), answer('req_2', 'approved')], own), 'approved');
  assert.equal(answerOutcome([{ id: 'm', data: { kind: 'project-share', requestId: 'req_2', outcome: 'approved' } }], own), null);
  assert.equal(answerOutcome([{ id: 'm' }, { id: 'n', data: { kind: 'access-answer' } }], own), null);
});

test('project requests are on only when the instance says so', () => {
  assert.equal(projectRequestsOn({ requests: { project: true } }), true);
  assert.equal(projectRequestsOn({ requests: { project: false } }), false);
  assert.equal(projectRequestsOn({ requests: {} }), false);
  assert.equal(projectRequestsOn({ instance: { name: 'Acme' } }), false, 'an older instance sends no requests block');
  assert.equal(projectRequestsOn(null), false);
  assert.equal(projectRequestsOn(undefined), false);
});

test('the error sentence: one for too many requests, one for anything else', () => {
  assert.equal(askErrorMessage(429), 'That is a lot of requests for one day. Try again tomorrow.');
  assert.equal(askErrorMessage(500), 'Could not send the request. Try again.');
  assert.equal(askErrorMessage(0), 'Could not send the request. Try again.');
});

// ── 2. The calls ─────────────────────────────────────────────────────────────

test('askForAccess posts the role and a trimmed note, and no note when it is empty', async () => {
  reset();
  router = () => json({ ok: true }, 202);
  assert.deepEqual(await askForAccess({ projectId: 'p1' }, 'editor', '  Please, for the Q3 deck.  '), { ok: true });
  assert.deepEqual(await askForAccess({ sessionId: 's1' }, 'viewer', '   '), { ok: true });
  assert.deepEqual(await askForAccess({ projectId: 'p1' }, 'viewer', 'x'.repeat(NOTE_MAX + 20)), { ok: true });
  assert.deepEqual(calls.map((c) => [c.method, c.url, c.body]), [
    ['POST', '/api/v1/projects/p1/access-requests', { role: 'editor', note: 'Please, for the Q3 deck.' }],
    ['POST', '/api/v1/sessions/s1/access-requests', { role: 'viewer' }],
    ['POST', '/api/v1/projects/p1/access-requests', { role: 'viewer', note: 'x'.repeat(NOTE_MAX) }],
  ]);
});

test('askForAccess reports a refusal with its code, and no answer as status 0', async () => {
  reset();
  router = () => json({ error: { code: 'RATE_LIMITED' } }, 429);
  assert.deepEqual(await askForAccess({ projectId: 'p1' }, 'editor', ''), { ok: false, status: 429, code: 'RATE_LIMITED' });
  router = () => { throw new TypeError('offline'); };
  assert.deepEqual(await askForAccess({ projectId: 'p1' }, 'editor', ''), { ok: false, status: 0 });
});

test('myRequests reads the list newest first, and null for a failure or another body', async () => {
  reset();
  router = (url) => url === '/api/v1/access-requests/mine?projectId=p1'
    ? json({ requests: [{ id: 'req_2', status: 'open', role: 'editor', createdAt: ago(1) }, { id: 'bad' }] })
    : new Response('', { status: 404 });
  const got = await myRequests({ projectId: 'p1' });
  assert.deepEqual(got?.map((r) => r.id), ['req_2'], 'the unusable row is left out');
  assert.equal(await myRequests({ sessionId: 's1' }), null);
  router = () => json({ nope: true });
  assert.equal(await myRequests({ projectId: 'p1' }), null);
});

test('withdrawRequest posts to the request and says whether it went', async () => {
  reset();
  router = (url) => url === '/api/v1/access-requests/req_1/withdraw' ? json({ request: {} }) : json({ error: {} }, 404);
  assert.equal(await withdrawRequest('req_1'), true);
  assert.equal(await withdrawRequest('req_9'), false);
  assert.deepEqual(calls.map((c) => [c.method, c.url, c.body]), [
    ['POST', '/api/v1/access-requests/req_1/withdraw', {}],
    ['POST', '/api/v1/access-requests/req_9/withdraw', {}],
  ]);
});

// ── 3. The form ──────────────────────────────────────────────────────────────

test('the form: labelled role and note, Edit by default, and the request sent', async () => {
  reset();
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => { release = r; });
  router = async (url, init) => {
    if (url.startsWith('/api/v1/access-requests/mine')) return json({ requests: [] });
    if ((init?.method ?? 'GET') === 'POST') { await gate; return json({ ok: true }, 202); }
    return new Response('', { status: 404 });
  };
  const { form, states } = mount({ target: { projectId: 'p1' }, defaultRole: 'editor' });
  assert.match(form.textContent!, /Loading…/, 'a loading line while its own requests are read');
  await settle();
  assert.deepEqual(states, ['form']);
  const select = form.querySelector('select')!;
  assert.equal(form.querySelector<HTMLLabelElement>(`label[for="${select.id}"]`)!.textContent, 'Access you need');
  assert.deepEqual([...select.options].map((o) => [o.value, o.textContent]), [['viewer', 'Can view'], ['editor', 'Can edit']]);
  assert.equal(select.value, 'editor');
  const described = select.getAttribute('aria-describedby')!.split(' ').map((id) => document.getElementById(id)!.textContent);
  assert.deepEqual(described, ['View: open the work and make your own copy.', 'Edit: open the work and save changes.']);
  const note = form.querySelector('textarea')!;
  assert.equal(form.querySelector<HTMLLabelElement>(`label[for="${note.id}"]`)!.textContent, 'Add a note (optional)');
  assert.equal(note.maxLength, 280);
  assert.equal(document.getElementById(note.getAttribute('aria-describedby')!)!.textContent, 'Notes can be up to 280 characters.');

  select.value = 'viewer';
  note.value = 'For the launch deck';
  submit(form);
  const send = form.querySelector<HTMLButtonElement>('[data-act="team-ask-send"]')!;
  assert.equal(send.textContent, 'Sending…');
  assert.equal(send.disabled, true);
  submit(form);
  release();
  await settle();
  const posts = calls.filter((c) => c.method === 'POST');
  assert.deepEqual(posts.map((c) => c.body), [{ role: 'viewer', note: 'For the launch deck' }], 'a second submit while busy sends nothing');
  assert.match(form.textContent!, /Request sent\. The people who manage this project will see your request\. Their answer comes to your inbox here\./);
  assert.deepEqual(states, ['form', 'sent']);
  assert.equal(form.querySelector('form'), null);
});

test('a refused send says why and keeps the form, ready to try again', async () => {
  reset();
  let status = 429;
  router = (url) => url.startsWith('/api/v1/access-requests/mine') ? json({ requests: [] }) : json({ error: {} }, status);
  const { form } = mount({ target: { projectId: 'p1' }, defaultRole: 'editor' });
  await settle();
  submit(form);
  await settle();
  const line = form.querySelector('.team-ask-status')!;
  assert.equal(line.textContent, 'That is a lot of requests for one day. Try again tomorrow.');
  assert.equal(line.getAttribute('role'), 'status');
  const send = form.querySelector<HTMLButtonElement>('[data-act="team-ask-send"]')!;
  assert.equal(send.disabled, false);
  assert.equal(send.textContent, 'Send request');
  status = 500;
  submit(form);
  await settle();
  assert.equal(line.textContent, 'Could not send the request. Try again.');
});

test('a request still waiting shows when it was sent, and Withdraw brings the form back', async () => {
  reset();
  let withdrawOk = false;
  router = (url) => {
    if (url.startsWith('/api/v1/access-requests/mine')) return json({ requests: [{ id: 'req_1', status: 'open', role: 'editor', createdAt: ago(5) }] });
    if (url === '/api/v1/access-requests/req_1/withdraw') return withdrawOk ? json({ request: {} }) : json({ error: {} }, 500);
    return new Response('', { status: 404 });
  };
  const { form, states } = mount({ target: { sessionId: 's1' }, defaultRole: 'editor' });
  await settle();
  assert.deepEqual(states, ['asked']);
  assert.match(form.textContent!, /You asked for access 5 minutes ago\. Nobody has answered yet\./);
  assert.ok(calls.some((c) => c.url === '/api/v1/access-requests/mine?sessionId=s1'));
  const withdraw = form.querySelector<HTMLButtonElement>('[data-act="team-ask-withdraw"]')!;
  withdraw.click();
  await settle();
  assert.equal(form.querySelector('.team-ask-status')!.textContent, 'Could not make that change. Try again.');
  assert.equal(withdraw.disabled, false);
  withdrawOk = true;
  withdraw.click();
  await settle();
  assert.deepEqual(states, ['asked', 'form']);
  assert.equal(form.querySelector('.team-ask-status')!.textContent, 'Request withdrawn.');
  assert.ok(form.querySelector('form'), 'the form again');
});

test('a Withdraw refused because the request was answered meanwhile shows the answer', async () => {
  reset();
  let answered = false;
  router = (url) => {
    if (url.startsWith('/api/v1/access-requests/mine')) {
      return json({ requests: [{ id: 'req_1', status: answered ? 'approved' : 'open', role: 'editor', createdAt: ago(5) }] });
    }
    if (url.endsWith('/withdraw')) { answered = true; return json({ error: { code: 'ALREADY_ANSWERED' } }, 409); }
    return new Response('', { status: 404 });
  };
  const { form, states } = mount({ target: { projectId: 'p1' }, defaultRole: 'editor' });
  await settle();
  form.querySelector<HTMLButtonElement>('[data-act="team-ask-withdraw"]')!.click();
  await settle();
  assert.deepEqual(states, ['asked', 'approved']);
  assert.match(form.textContent!, /You have access now\./);
  assert.equal(form.querySelector<HTMLElement>('.team-ask-status')!.hidden, true, 'no error to try again');
});

test('a declined last request says so above the form', async () => {
  reset();
  router = (url) => url.startsWith('/api/v1/access-requests/mine')
    ? json({ requests: [{ id: 'req_1', status: 'declined', role: 'editor', createdAt: ago(60), answeredAt: ago(30) }] })
    : new Response('', { status: 404 });
  const { form, states } = mount({ target: { projectId: 'p1' }, defaultRole: 'editor' });
  await settle();
  assert.deepEqual(states, ['declined']);
  assert.match(form.textContent!, /Your last request was not approved\. You can ask again\./);
  assert.ok(form.querySelector('form select'));
});

test('a list that cannot be read still offers the form', async () => {
  reset();
  router = () => { throw new TypeError('offline'); };
  const { form, states } = mount({ target: { projectId: 'p1' }, defaultRole: 'viewer' });
  await settle();
  assert.deepEqual(states, ['form']);
  assert.equal(form.querySelector('select')!.value, 'viewer');
});

test('Ask to edit: heading and intro as text, no role select, and the role sent is edit', async () => {
  reset();
  router = (url) => url.startsWith('/api/v1/access-requests/mine') ? json({ requests: [] }) : json({ ok: true }, 202);
  const project = '<img src=x onerror=alert(1)> Summit';
  const { form } = mount({
    target: { projectId: 'p1' }, defaultRole: 'editor', fixedRole: 'editor', level: 4,
    heading: `Ask to edit ${project}`, intro: `The managers of ${project} will see your request.`,
  });
  await settle();
  const h = form.querySelector('h4')!;
  assert.equal(h.textContent, `Ask to edit ${project}`);
  assert.equal(form.querySelector('img'), null, 'the name stays text');
  assert.equal(form.querySelector('select'), null);
  submit(form);
  await settle();
  assert.deepEqual(calls.filter((c) => c.method === 'POST').map((c) => c.body), [{ role: 'editor' }]);
});

test('an inbox answer to the request moves the form to approved, and the watch lets go', async () => {
  reset();
  router = (url, init) => {
    if (url.startsWith('/api/v1/access-requests/mine')) {
      const sent = calls.some((c) => c.method === 'POST');
      return json({ requests: sent ? [{ id: 'req_2', status: 'open', role: 'editor', createdAt: ago(0) }] : [] });
    }
    return (init?.method ?? 'GET') === 'POST' ? json({ ok: true }, 202) : new Response('', { status: 404 });
  };
  let listener: ((msgs: readonly AnswerMessage[]) => void) | null = null;
  let stopped = 0;
  const watch = (fn: (msgs: readonly AnswerMessage[]) => void): (() => void) => { listener = fn; return () => { stopped++; listener = null; }; };
  const { form, states } = mount({ target: { projectId: 'p1' }, defaultRole: 'editor', watch });
  await settle();
  submit(form);
  await settle();
  assert.deepEqual(states, ['form', 'sent']);
  // An answer to an older request of theirs is not this one.
  listener!([{ id: 'msg_ans_req_1', data: { kind: 'access-answer', requestId: 'req_1', projectId: 'p1', outcome: 'approved' } }]);
  assert.deepEqual(states, ['form', 'sent']);
  listener!([{ id: 'msg_ans_req_2', data: { kind: 'access-answer', requestId: 'req_2', projectId: 'p1', outcome: 'approved' } }]);
  assert.deepEqual(states, ['form', 'sent', 'approved']);
  assert.match(form.textContent!, /You have access now\./);
  assert.equal(stopped, 1);
});

test('a decline from the inbox brings the form back with the line', async () => {
  reset();
  router = (url) => url.startsWith('/api/v1/access-requests/mine')
    ? json({ requests: [{ id: 'req_3', status: 'open', role: 'editor', createdAt: ago(2) }] })
    : new Response('', { status: 404 });
  let listener: ((msgs: readonly AnswerMessage[]) => void) | null = null;
  const { form, states } = mount({ target: { projectId: 'p1' }, defaultRole: 'editor', watch: (fn) => { listener = fn; return () => {}; } });
  await settle();
  listener!([{ id: 'msg_ans_req_3', data: { kind: 'access-answer', requestId: 'req_3', outcome: 'declined' } }]);
  assert.deepEqual(states, ['asked', 'declined']);
  assert.match(form.textContent!, /Your last request was not approved\. You can ask again\./);
  listener!([{ id: 'msg_ans_req_3', data: { kind: 'access-answer', requestId: 'req_3', outcome: 'declined' } }]);
  assert.deepEqual(states, ['asked', 'declined'], 'the same answer again changes nothing');
});

test('a form taken off the page lets go of the inbox on the next change', async () => {
  reset();
  router = () => json({ requests: [] });
  let listener: ((msgs: readonly AnswerMessage[]) => void) | null = null;
  let stopped = 0;
  const { form } = mount({ target: { projectId: 'p1' }, defaultRole: 'editor', watch: (fn) => { listener = fn; return () => { stopped++; }; } });
  await settle();
  listener!([]);
  form.remove();
  listener!([]);
  assert.equal(stopped, 1);
});
