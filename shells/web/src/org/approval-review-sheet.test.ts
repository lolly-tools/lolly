// SPDX-License-Identifier: MPL-2.0
/**
 * org/approval-review-sheet.ts - one request in the shell, driven under jsdom with a
 * fetch router standing in for the instance. The server's rules are the point: Approve
 * stays off until the bytes arrive with their token, and a requester gets bytes only
 * once approved.
 *
 * Run directly:  node --test shells/web/src/org/approval-review-sheet.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://instance.test/', pretendToBeVisual: true });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location as unknown as Location;
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => { setTimeout(() => cb(0), 0); return 0; }) as unknown as typeof requestAnimationFrame;
const Dlg = dom.window.HTMLDialogElement.prototype as unknown as { showModal(): void; close(): void };
Dlg.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
Dlg.close = function (this: HTMLDialogElement) { this.removeAttribute('open'); };
URL.createObjectURL = (() => 'blob:test') as typeof URL.createObjectURL;
URL.revokeObjectURL = (() => {}) as typeof URL.revokeObjectURL;

const BYTES = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');
const SHA = createHash('sha256').update(BYTES).digest('hex');

type Handler = (url: string, init?: RequestInit) => Response;
let router: Handler = () => new Response('', { status: 404 });
let calls: Array<{ url: string; body?: unknown; method: string }> = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  calls.push({ url, method: (init?.method ?? 'GET').toUpperCase(), ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}) });
  return router(url, init);
}) as typeof fetch;
const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const { openApprovalSheet, factsLine, standingLine, refusalWords } = await import('./approval-review-sheet.ts');
const { _resetApprovalsForTests, rowFromBody } = await import('./approval-work.ts');
const { ApprovalArtifactError } = await import('./approval-artifact.ts');

const wire = (over: Record<string, unknown> = {}, file: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'apr_1', title: 'Launch card', state: 'in_review', relation: 'inbox', stepIndex: 0, stepCount: 2, stepName: 'Brand', createdByName: 'Mia',
  createdAt: '2026-11-01T10:00:00.000Z', actions: [],
  exportReview: {
    sha256: SHA, size: BYTES.length, name: 'card.svg', format: 'svg', mediaType: 'image/svg+xml', preview: 'image', toolId: 'card', toolVersion: '1.0.0',
    fingerprint: 'fp', artifactUrl: '/api/v1/approvals/apr_1/artifact', widthPx: 600, heightPx: 400, ...file,
  },
  ...over,
});
const serving = (row: Record<string, unknown>, opts: { token?: string | null; act?: Response } = {}): void => {
  router = (url) => {
    if (url.endsWith('/api/v1/approvals')) return json({ approvals: [row] });
    if (url.endsWith('/artifact')) return new Response(BYTES, { headers: { 'content-type': 'image/svg+xml', ...(opts.token === null ? {} : { 'x-lolly-review-token': opts.token ?? 'tok' }) } });
    if (url.endsWith('/act')) return opts.act ?? json({});
    return new Response('', { status: 404 });
  };
};
const tick = async (): Promise<void> => { for (let i = 0; i < 12; i++) await new Promise(r => setTimeout(r, 0)); };
const reset = (): void => {
  router = () => new Response('', { status: 404 }); calls = [];
  _resetApprovalsForTests();
  for (const d of document.querySelectorAll('dialog')) d.remove();
};
const sheet = (): HTMLDialogElement => document.querySelector<HTMLDialogElement>('dialog.approval-review')!;
const button = (words: string): HTMLButtonElement => [...sheet().querySelectorAll('button')].find(b => b.textContent === words)!;
const fetched = (suffix: string): boolean => calls.some(c => c.url.endsWith(suffix));

test('the lines under the title and the file say the plain facts', () => {
  const row = rowFromBody(wire())!;
  assert.equal(standingLine(row), 'Asked by Mia · Brand · Step 1 of 2');
  assert.match(factsLine(row), /^SVG · 600 × 400 · .+ · card 1\.0\.0 · SHA-256 [a-f0-9]{12}…$/);
  assert.equal(standingLine(rowFromBody(wire({ relation: 'mine' }))!), 'In review · Brand · Step 1 of 2');
  assert.match(standingLine(rowFromBody(wire({ state: 'approved', actions: [{ action: 'approve', actorName: 'B', at: '2026-11-02T00:00:00Z', step: 1 }] }))!), /^Approved /);
});

test('a reviewer sees the file, and Approve stays off until it has arrived', async () => {
  reset();
  serving(wire());
  await openApprovalSheet('apr_1');
  assert.equal(button('Approve').disabled, true, 'nothing loaded yet');
  await tick();
  assert.equal(button('Approve').disabled, false);
  assert.ok(sheet().querySelector('.approval-file-stage img'), 'the file is drawn');
  button('Approve').click();
  await tick();
  const act = calls.find(c => c.url.endsWith('/act'))!;
  assert.deepEqual(act.body, { action: 'approve', artifactFingerprint: 'fp', reviewToken: 'tok' });
  assert.equal(sheet(), null, 'closes once decided');
});

test('no token with the bytes means no approving here, and it says where to go', async () => {
  reset();
  serving(wire(), { token: null });
  await openApprovalSheet('apr_1');
  await tick();
  assert.equal(button('Approve').disabled, true);
  assert.match(sheet().querySelector('.approval-error')!.textContent ?? '', /decide in the console/);
});

test('rejecting needs a reason, and works without the file', async () => {
  reset();
  router = (url) => {
    if (url.endsWith('/api/v1/approvals')) return json({ approvals: [wire()] });
    if (url.endsWith('/artifact')) return json({ error: { code: 'ARTIFACT_REMOVED' } }, 410);
    return url.endsWith('/act') ? json({}) : new Response('', { status: 404 });
  };
  await openApprovalSheet('apr_1');
  await tick();
  assert.equal(button('Approve').disabled, true, 'a file that will not load cannot be approved');
  button('Reject').click();
  await tick();
  assert.equal(calls.some(c => c.url.endsWith('/act')), false);
  const comment = sheet().querySelector<HTMLInputElement>('.approval-review-field input')!;
  assert.equal(comment.getAttribute('aria-invalid'), 'true');
  comment.value = 'Wrong logo';
  button('Reject').click();
  await tick();
  assert.deepEqual(calls.find(c => c.url.endsWith('/act'))!.body, { action: 'reject', comment: 'Wrong logo', artifactFingerprint: 'fp' });
});

test('a refused decision stays open and says why', async () => {
  reset();
  serving(wire(), { act: json({ error: { code: 'ARTIFACT_SUBJECT_CHANGED' } }, 409) });
  await openApprovalSheet('apr_1');
  await tick();
  button('Approve').click();
  await tick();
  assert.ok(sheet());
  assert.match(sheet().querySelector('.approval-error')!.textContent ?? '', /changed/);
  assert.equal(button('Reject').disabled, false);
});

test('my own request in review fetches no file', async () => {
  reset();
  serving(wire({ relation: 'mine' }));
  await openApprovalSheet('apr_1');
  await tick();
  assert.equal(fetched('/artifact'), false);
  assert.match(sheet().textContent ?? '', /You get it once it is approved/);
  assert.equal(sheet().querySelector('.approval-review-field'), null);
  assert.equal(button('Approve'), undefined);
});

test('my approved request offers the file and a project', async () => {
  reset();
  serving(wire({ relation: 'mine', state: 'approved', actions: [{ action: 'approve', actorName: 'Bruno', at: '2026-11-02T00:00:00Z', step: 1 }] }), { token: null });
  await openApprovalSheet('apr_1');
  await tick();
  assert.equal(button('Download approved file').disabled, false);
  assert.equal(button('Add to project').disabled, false);
  assert.ok(sheet().querySelector('.approval-file-stage img'));
});

test('my rejected request shows the reason and no file', async () => {
  reset();
  serving(wire({ relation: 'mine', state: 'rejected', actions: [{ action: 'reject', actorName: 'Bruno', at: '2026-11-02T00:00:00Z', step: 0, comment: 'Wrong logo' }] }));
  await openApprovalSheet('apr_1');
  await tick();
  assert.equal(fetched('/artifact'), false);
  const history = sheet().querySelector('.approval-review-history')!;
  assert.match(history.textContent ?? '', /Bruno did not approve/);
  assert.match(history.textContent ?? '', /Wrong logo/);
});

test('text from the instance is text, never markup', async () => {
  reset();
  serving(wire({ relation: 'mine', state: 'rejected', title: '<img src=x>', actions: [{ action: 'reject', actorName: '<b>B</b>', at: '2026-11-02T00:00:00Z', step: 0, comment: '<script>alert(1)</script>' }] }));
  await openApprovalSheet('apr_1');
  await tick();
  assert.equal(sheet().querySelector('.modal-title')!.textContent, '<img src=x>');
  assert.equal(sheet().querySelector('.modal-title img'), null);
  assert.equal(sheet().querySelector('script'), null);
  assert.equal(sheet().querySelector('.approval-review-history b'), null);
});

test('a large file waits for a click before it comes down', async () => {
  reset();
  serving(wire({}, { size: 32 * 1024 * 1024 }));
  await openApprovalSheet('apr_1');
  await tick();
  assert.equal(fetched('/artifact'), false);
  assert.equal(button('Approve').disabled, true);
});

test('a request that has gone opens nothing', async () => {
  reset();
  router = (url) => url.endsWith('/api/v1/approvals') ? json({ approvals: [] }) : new Response('', { status: 404 });
  await openApprovalSheet('apr_gone');
  assert.equal(sheet(), null);
});

test('refusal words: every code a person can meet has a sentence, and unknown ones a safe one', () => {
  for (const code of ['ARTIFACT_SUBJECT_CHANGED', 'ARTIFACT_NOT_LOADED', 'ARTIFACT_REMOVED', 'ARTIFACT_DIGEST_MISMATCH', 'SEPARATION_OF_DUTIES', 'NOT_ELIGIBLE']) {
    assert.notEqual(refusalWords(new ApprovalArtifactError(409, code)), refusalWords(new Error('x')), code);
  }
  assert.equal(refusalWords(new ApprovalArtifactError(500)), refusalWords(new Error('x')));
});
