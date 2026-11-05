// SPDX-License-Identifier: MPL-2.0
/**
 * org/approval-work.ts - the instance client behind the approval views, and the queue's
 * pure rows. A reassignable fetch router stands in for the instance.
 *
 * Run directly:  node --test shells/web/src/org/approval-work.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { JSDOM } from 'jsdom';
import {
  _resetApprovalsForTests, approvalStatus, approvedFile, currentApproval, decideApproval, decidedAt, fetchApprovalFile, fileNameOf, findApproval, listApprovals,
  rowFromBody, sessionApprovals, statusFromBody, type ApprovalRow,
} from './approval-work.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://instance.test/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location as unknown as Location;

const { approvalNotifications, DECISION_WINDOW_MS } = await import('./approval-queue.ts');

const BYTES = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');
const SHA = createHash('sha256').update(BYTES).digest('hex');

const wire = (over: Record<string, unknown> = {}, file: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'apr_1', title: 'Launch card', state: 'in_review', relation: 'inbox', stepIndex: 0, stepCount: 2, stepName: 'Brand', createdByName: 'Mia',
  createdAt: '2026-11-01T10:00:00.000Z', actions: [],
  exportReview: {
    sha256: SHA, size: BYTES.length, name: 'card.svg', format: 'svg', mediaType: 'image/svg+xml', preview: 'image', toolId: 'card', toolVersion: '1.0.0',
    fingerprint: 'fp', artifactUrl: '/api/v1/approvals/apr_1/artifact', ...file,
  },
  ...over,
});
const row = (over: Record<string, unknown> = {}, file: Record<string, unknown> = {}): ApprovalRow => rowFromBody(wire(over, file))!;

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;
let router: Handler = () => new Response('', { status: 404 });
let calls: Array<{ url: string; init?: RequestInit }> = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  calls.push({ url, ...(init ? { init } : {}) });
  return router(url, init);
}) as typeof fetch;
const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const reset = (): void => { router = () => new Response('', { status: 404 }); calls = []; _resetApprovalsForTests(); };

test('a row without a file stays with the console', () => {
  assert.equal(rowFromBody({ id: 'apr_2', relation: 'inbox', state: 'in_review', title: 'Old request' }), null);
  assert.equal(rowFromBody(null), null);
  assert.equal(rowFromBody(wire({ state: 'sideways' })), null, 'an unknown state is not guessed at');
  assert.equal(rowFromBody(wire({ relation: 'someone' })), null);
  assert.equal(row().exportReview.fingerprint, 'fp');
  assert.equal(row({}, { preview: 'hologram' }).exportReview.preview, 'none', 'an unknown preview draws no file');
});

test('the match answer: known states pass, anything else is no answer', () => {
  assert.deepEqual(statusFromBody({ state: 'approved', approvalId: 'apr_1', decidedAt: 'x', extra: 1 }), { state: 'approved', approvalId: 'apr_1', decidedAt: 'x' });
  assert.deepEqual(statusFromBody({ state: 'none' }), { state: 'none' });
  assert.equal(statusFromBody({ state: 'maybe' }), null);
  assert.equal(statusFromBody('approved'), null);
});

test('match sends the contract and treats a refusal as no answer', async () => {
  reset();
  router = (url, init) => {
    assert.match(url, /\/api\/v1\/approvals\/match$/);
    assert.equal(init?.method, 'POST');
    return json({ state: 'changed', approvalId: 'apr_1' });
  };
  assert.deepEqual(await approvalStatus({ toolId: 'card', format: 'svg', query: 'a=1' }), { state: 'changed', approvalId: 'apr_1' });
  assert.deepEqual(JSON.parse(String(calls[0]!.init!.body)), { toolId: 'card', format: 'svg', query: 'a=1' });
  router = () => json({ error: { code: 'NOT_FOUND' } }, 404);
  assert.equal(await approvalStatus({ toolId: 'card', format: 'svg', query: '' }), null);
});

test('one read per view: a fresh list asks nothing, and a request not in it asks again', async () => {
  reset();
  router = () => json({ approvals: [wire(), { id: 'apr_old', relation: 'mine', state: 'approved' }] });
  const first = await listApprovals();
  assert.deepEqual(first.map(r => r.id), ['apr_1'], 'a request with no file is left out');
  await listApprovals(60_000);
  await findApproval('apr_1');
  assert.equal(calls.length, 1);
  assert.equal(await findApproval('apr_gone'), null);
  assert.equal(calls.length, 2);
});

test('a person about to read a request gets it as it stands now, or the last answer when offline', async () => {
  reset();
  router = () => json({ approvals: [wire()] });
  await listApprovals();
  router = () => json({ approvals: [wire({ state: 'rejected' })] });
  assert.equal((await currentApproval('apr_1'))!.state, 'rejected', 'an old answer is not trusted while the instance can be asked');
  router = () => { throw new Error('offline'); };
  assert.equal((await currentApproval('apr_1'))!.state, 'rejected');
  assert.equal(await currentApproval('apr_gone'), null);
});

test('a file comes with its token and its digest checked', async () => {
  reset();
  router = () => new Response(BYTES, { headers: { 'content-type': 'image/svg+xml', 'x-lolly-review-token': 'tok' } });
  const got = await fetchApprovalFile(row());
  assert.equal(got.token, 'tok');
  assert.equal(got.checked, true);
  assert.equal(got.blob.size, BYTES.length);
});

test('a file that does not match its digest never reaches the caller', async () => {
  reset();
  router = () => new Response('tampered', { headers: { 'x-lolly-review-token': 'tok' } });
  await assert.rejects(fetchApprovalFile(row()), (e: Error & { code?: string }) => e.code === 'ARTIFACT_DIGEST_MISMATCH');
});

test('a decision names the file; only an approval carries the token', async () => {
  reset();
  router = (url) => url.endsWith('/act') ? json({}) : json({ approvals: [] });
  await decideApproval(row(), 'approve', '', 'tok');
  assert.deepEqual(JSON.parse(String(calls[0]!.init!.body)), { action: 'approve', artifactFingerprint: 'fp', reviewToken: 'tok' });
  calls = [];
  await decideApproval(row(), 'reject', 'Wrong logo', 'tok');
  assert.deepEqual(JSON.parse(String(calls[0]!.init!.body)), { action: 'reject', comment: 'Wrong logo', artifactFingerprint: 'fp' });
});

test('a refused decision carries the instance code', async () => {
  reset();
  router = () => json({ error: { code: 'ARTIFACT_NOT_LOADED', message: 'no' } }, 409);
  await assert.rejects(decideApproval(row(), 'approve', '', null), (e: Error & { code?: string; status?: number }) => e.code === 'ARTIFACT_NOT_LOADED' && e.status === 409);
});

test('an approved file not in my list still comes from the route, checked against its digest', async () => {
  reset();
  router = (url) => {
    if (url.endsWith('/api/v1/approvals')) return json({ approvals: [] });
    return new Response(BYTES, { headers: { etag: `"${SHA}"`, 'content-disposition': "attachment; filename*=UTF-8''card%20final.svg" } });
  };
  const got = await approvedFile('apr_theirs');
  assert.equal(got.name, 'card final.svg');
  assert.equal(got.blob.size, BYTES.length);
  assert.ok(calls.some(c => c.url.endsWith('/api/v1/approvals/apr_theirs/artifact')));
  reset();
  router = (url) => url.endsWith('/api/v1/approvals') ? json({ approvals: [] }) : new Response('tampered', { headers: { etag: `"${SHA}"` } });
  await assert.rejects(approvedFile('apr_theirs'), (e: Error & { code?: string }) => e.code === 'ARTIFACT_DIGEST_MISMATCH');
  reset();
  router = (url) => url.endsWith('/api/v1/approvals') ? json({ approvals: [] }) : json({ error: { code: 'ARTIFACT_NOT_RELEASED' } }, 403);
  await assert.rejects(approvedFile('apr_theirs'), (e: Error & { code?: string }) => e.code === 'ARTIFACT_NOT_RELEASED');
});

test('fileNameOf reads the encoded name and never throws', () => {
  assert.equal(fileNameOf("attachment; filename*=UTF-8''a%20b.png"), 'a b.png');
  assert.equal(fileNameOf("attachment; filename*=UTF-8''%E0%A4%A"), 'approved-file');
  assert.equal(fileNameOf(null), 'approved-file');
});

test('sessions: the newest open or approved request, mine only', () => {
  const rows = [
    row({ id: 'a', relation: 'mine', state: 'approved', createdAt: '2026-11-01T00:00:00Z', actions: [{ action: 'approve', actorName: 'B', at: '2026-11-02T00:00:00Z', step: 0 }] }, { sessionId: 's1' }),
    row({ id: 'b', relation: 'mine', state: 'in_review', createdAt: '2026-11-03T00:00:00Z' }, { sessionId: 's1' }),
    row({ id: 'c', relation: 'mine', state: 'approved', createdAt: '2026-11-01T00:00:00Z', actions: [{ action: 'approve', actorName: 'B', at: '2026-11-02T00:00:00Z', step: 0 }] }, { sessionId: 's2' }),
    row({ id: 'd', relation: 'mine', state: 'rejected', createdAt: '2026-11-05T00:00:00Z' }, { sessionId: 's2' }),
    row({ id: 'e', relation: 'inbox', state: 'in_review' }, { sessionId: 's3' }),
    row({ id: 'f', relation: 'mine', state: 'in_review' }),
  ];
  const states = sessionApprovals(rows);
  assert.deepEqual([...states.keys()].sort(), ['s1', 's2']);
  assert.equal(states.get('s1')!.state, 'in_review', 'the newer request leads');
  assert.equal(states.get('s2')!.state, 'approved', 'a later rejection says nothing about the approved file');
  assert.equal(states.get('s2')!.decidedAt, '2026-11-02T00:00:00Z');
});

test('decidedAt is the last action, or when it was raised', () => {
  assert.equal(decidedAt({ actions: [], createdAt: 'then' }), 'then');
  assert.equal(decidedAt({ actions: [{ action: 'approve', actorName: 'B', at: 'now', step: 0 }], createdAt: 'then' }), 'now');
});

test('queue: a request to decide, and my own request once decided', () => {
  const opened: string[] = [];
  const now = Date.parse('2026-11-05T00:00:00Z');
  const rows = [
    row({ id: 'r1' }),
    row({ id: 'r2', stepIndex: 1 }),
    row({ id: 'm1', relation: 'mine', state: 'in_review' }),
    row({ id: 'm2', relation: 'mine', state: 'approved', actions: [{ action: 'approve', actorName: 'B', at: '2026-11-04T00:00:00Z', step: 0 }] }),
    row({ id: 'm3', relation: 'mine', state: 'rejected', actions: [{ action: 'reject', actorName: 'B', at: '2026-11-04T00:00:00Z', step: 0, comment: 'No' }] }),
    row({ id: 'm4', relation: 'mine', state: 'approved', actions: [{ action: 'approve', actorName: 'B', at: new Date(now - DECISION_WINDOW_MS - 1000).toISOString(), step: 0 }] }),
    row({ id: 'm5', relation: 'mine', state: 'withdrawn' }),
  ];
  const entries = approvalNotifications(rows, 'https://i', id => { opened.push(id); }, () => {}, now);
  assert.deepEqual(entries.map(e => e.id), ['approval:https://i:r1:0', 'approval:https://i:r2:1', 'approval:https://i:m2:approved', 'approval:https://i:m3:rejected']);
  assert.equal(entries[0]!.action?.label, 'Review');
  assert.match(entries[0]!.title, /Launch card/);
  assert.equal(entries[2]!.action?.label, 'Get the file');
  assert.equal(entries[3]!.action?.label, 'See why');
  void entries[3]!.action?.run?.();
  assert.deepEqual(opened, ['m3']);
});

test('queue: a request title is data, kept as written', () => {
  const entries = approvalNotifications([row({ title: 'O\'Brien <b>&' })], 'i', () => {}, () => {});
  assert.equal(entries[0]!.title, 'Review O\'Brien <b>&');
});
