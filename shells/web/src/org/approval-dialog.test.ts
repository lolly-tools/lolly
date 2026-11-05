// SPDX-License-Identifier: MPL-2.0
/**
 * org/approval-dialog.ts - the "Request approval" flow.
 *
 * Pure helpers (filterApprovers / buildApprovalBody / subjectRefFor) are exercised
 * DOM-free. The dialog itself is driven under jsdom the way index.test.ts drives the
 * gate: a reassignable fetch router backs GET approvers + POST approvals, and the
 * open → fetch → render → filter → submit path is asserted end to end. jsdom has
 * no <dialog>.showModal, so the native-dialog primitive is shimmed minimally (open
 * flag + close), exactly the surface components/modal.ts touches.
 *
 * Run directly:  node --test shells/web/src/org/approval-dialog.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// ── Pure helpers (DOM-free) ─────────────────────────────────────────────────
import { filterApprovers, buildApprovalBody, buildExportReviewBody, subjectRefFor } from './approval-dialog.ts';
import { artifactFormat } from './approval-artifact.ts';

test('filterApprovers: empty query returns all; case-insensitive substring narrows', () => {
  const list = [{ id: 'u1', name: 'Alice Ng' }, { id: 'u2', name: 'Bob Fraser' }, { id: 'u3', name: 'Carol Ng' }];
  assert.equal(filterApprovers(list, '').length, 3);
  assert.equal(filterApprovers(list, '   ').length, 3, 'whitespace-only is treated as empty');
  assert.deepEqual(filterApprovers(list, 'ng').map(a => a.id), ['u1', 'u3']);
  assert.deepEqual(filterApprovers(list, 'BOB').map(a => a.id), ['u2']);
  assert.equal(filterApprovers(list, 'zzz').length, 0);
});

test('filterApprovers: falls back to id when a name is missing', () => {
  const list = [{ id: 'user-42', name: '' }];
  assert.deepEqual(filterApprovers(list, '42').map(a => a.id), ['user-42']);
});

test('buildApprovalBody assembles the documented POST shape (single nominee)', () => {
  assert.deepEqual(
    buildApprovalBody({ subjectRef: 'tool:event-badge', title: 'Q3 badge', chainId: 'brand-signoff', nominee: 'u2' }),
    { subjectType: 'asset', subjectRef: 'tool:event-badge', title: 'Q3 badge', chainId: 'brand-signoff', nominees: ['u2'] },
  );
});

test('buildExportReviewBody sends the recording choice only when the instance offered it', () => {
  const artifact = { blob: new Blob(['x']), name: 'card.png' };
  const base = { uploadId: 'upl_a', checksum: 'c'.repeat(64), toolId: 't', title: 'T', chainId: 'c', nominee: 'u', artifact };
  assert.equal(buildExportReviewBody(base).exportReview.recordInCredentials, undefined);
  assert.equal(buildExportReviewBody({ ...base, recordInCredentials: true }).exportReview.recordInCredentials, true);
  assert.equal(buildExportReviewBody({ ...base, recordInCredentials: false }).exportReview.recordInCredentials, false, 'an opt-out travels as a stated choice');
});

test('buildExportReviewBody names the sent file, reports the values and states no digest of them', () => {
  const blob = new Blob(['x'], { type: 'image/png' });
  const body = buildExportReviewBody({ uploadId: 'upl_a', checksum: 'c'.repeat(64), toolId: 'event-badge', title: 'Q3', chainId: 'brand', nominee: 'u2',
    artifact: { blob, name: 'q3 badge.PNG', query: 'name=Ana', sessionId: 's1' }, widthPx: 800, heightPx: 600 });
  assert.deepEqual(body, { subjectType: 'export-review', title: 'Q3', chainId: 'brand', nominees: ['u2'], exportReview: {
    uploadId: 'upl_a', checksum: 'c'.repeat(64), toolId: 'event-badge', format: 'png', name: 'q3 badge.PNG', query: 'name=Ana', sessionId: 's1', widthPx: 800, heightPx: 600 } });
  assert.ok(!('inputsDigest' in body.exportReview), 'the instance works the digest out for itself');
  const big = buildExportReviewBody({ uploadId: 'upl_a', checksum: 'c'.repeat(64), toolId: 't', title: 'T', chainId: 'c', nominee: 'u', artifact: { blob, name: 'a.png', query: 'x'.repeat(300 * 1024) } });
  assert.equal(big.exportReview.query, undefined, 'values too large for a request stay out');
});

test('artifactFormat reads the extension the export wrote', () => {
  assert.equal(artifactFormat('deck.ZIP'), 'zip');
  assert.equal(artifactFormat('card.final.jpg'), 'jpg');
  assert.equal(artifactFormat('noextension'), 'bin');
});

test('subjectRefFor: own ref wins, else tool-scoped default, else generic', () => {
  assert.equal(subjectRefFor({ subjectRef: 'session:abc', toolId: 'x' }), 'session:abc');
  assert.equal(subjectRefFor({ toolId: 'event-badge' }), 'tool:event-badge');
  assert.equal(subjectRefFor({}), 'asset');
});

// ── Dialog (jsdom) ──────────────────────────────────────────────────────────

const dom = new JSDOM('<!doctype html><html><body><div id="app"><main id="view"></main></div></body></html>', {
  url: 'https://instance.test/#/tool/event-badge',
  pretendToBeVisual: true,
});
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location as unknown as Location;
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => { setTimeout(() => cb(0), 0); return 0; }) as unknown as typeof requestAnimationFrame;

// jsdom has no dialog showModal/close - shim the surface mountModal uses.
const Dlg = dom.window.HTMLDialogElement.prototype as unknown as { showModal(): void; close(): void };
Dlg.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
Dlg.close = function (this: HTMLDialogElement) { this.removeAttribute('open'); };

// A reassignable fetch router + POST-body capture.
type Handler = (url: string, init?: RequestInit) => Response;
let router: Handler = () => new Response('', { status: 404 });
let postBodies: unknown[] = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if ((init?.method || 'GET').toUpperCase() === 'POST' && init?.body) {
    try { postBodies.push(JSON.parse(String(init.body))); } catch { /* ignore */ }
  }
  return router(url, init);
}) as typeof fetch;

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const { openApprovalDialog } = await import('./approval-dialog.ts');
const { setExportPolicy, _clearExportPolicyForTests } = await import('../lib/export-policy.ts');

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
function reset(): void {
  _clearExportPolicyForTests();
  postBodies = [];
  router = () => new Response('', { status: 404 });
  document.querySelectorAll('dialog').forEach((d) => d.remove());
}

const APPROVERS = { chainId: 'brand-signoff', step: 0, stepName: 'Brand sign-off', groups: ['brand'], approvers: [{ id: 'u2', name: 'Bob Fraser' }, { id: 'u3', name: 'Carol Ng' }] };

function servingApprovers(postStatus = 201, postBody: unknown = ''): void {
  setExportPolicy({ canDownload: false, canRequestApproval: true, chains: { 'event-badge': 'brand-signoff' } });
  router = (url, init) => {
    if (url.includes('/api/v1/approvals/approvers')) return json(APPROVERS);
    if (url.includes('/api/v1/approvals') && (init?.method || '').toUpperCase() === 'POST') {
      return postStatus === 201 ? new Response('', { status: 201 }) : json(postBody, postStatus);
    }
    return new Response('', { status: 404 });
  };
}

test('open → fetches approvers, shows step name, lists eligible people', async () => {
  reset();
  servingApprovers();
  openApprovalDialog({ toolId: 'event-badge', title: 'Q3 badge' });
  await tick();

  const dlg = document.querySelector('dialog.approval-dialog');
  assert.ok(dlg, 'dialog mounted');
  assert.match(dlg!.textContent || '', /Brand sign-off/, 'step name shown as context');
  const options = dlg!.querySelectorAll('[data-approver-id]');
  assert.equal(options.length, 2, 'both eligible approvers listed');
  // Requested the right chain.
  const submit = dlg!.querySelector<HTMLButtonElement>('[data-act="submit"]');
  assert.equal(submit!.disabled, true, 'submit disabled until a nominee is chosen');
});

test('nominee search filters the fetched list client-side (no re-fetch)', async () => {
  reset();
  servingApprovers();
  openApprovalDialog({ toolId: 'event-badge' });
  await tick();
  const dlg = document.querySelector('dialog.approval-dialog')!;
  const search = dlg.querySelector<HTMLInputElement>('[data-approver-search]')!;
  search.value = 'carol';
  search.dispatchEvent(new dom.window.Event('input'));
  const shown = dlg.querySelectorAll('[data-approver-id]');
  assert.equal(shown.length, 1);
  assert.equal(shown[0]!.getAttribute('data-approver-id'), 'u3');
});

test('the recording choice appears only where the instance offers it and starts ticked', async () => {
  const artifact = { blob: new Blob(['x'], { type: 'image/png' }), name: 'card.png' };
  const limits = { maxFileBytes: 1024, partBytes: 1024 };

  reset();
  servingApprovers();
  openApprovalDialog({ toolId: 'event-badge', artifact }, limits);
  await tick();
  assert.equal(document.querySelector('[data-record-approval]'), null, 'nothing is offered without the capability');

  reset();
  servingApprovers();
  openApprovalDialog({ toolId: 'event-badge', artifact }, { ...limits, recordInCredentials: true });
  await tick();
  const box = document.querySelector<HTMLInputElement>('[data-record-approval]');
  assert.ok(box, 'offered when the instance can write it');
  assert.equal(box!.checked, true, 'pre-checked, and visible at the moment of the action');
  assert.match(box!.closest('label')!.textContent || '', /Content Credentials/);
  assert.match(box!.closest('label')!.textContent || '', /No names/);

  reset();
  servingApprovers();
  openApprovalDialog({ toolId: 'event-badge' }, { ...limits, recordInCredentials: true });
  await tick();
  assert.equal(document.querySelector('[data-record-approval]'), null, 'with no file there is nothing to record into');
});

test('choose a nominee → submit POSTs the documented body, then closes on 201', async () => {
  reset();
  servingApprovers();
  openApprovalDialog({ toolId: 'event-badge', title: 'Q3 badge' });
  await tick();
  const dlg = document.querySelector('dialog.approval-dialog')!;

  dlg.querySelector<HTMLButtonElement>('[data-approver-id="u3"]')!.click();
  const submit = dlg.querySelector<HTMLButtonElement>('[data-act="submit"]')!;
  assert.equal(submit.disabled, false, 'submit enabled once a nominee is chosen');
  submit.click();
  await tick();

  assert.deepEqual(postBodies, [{
    subjectType: 'asset', subjectRef: 'tool:event-badge', title: 'Q3 badge', chainId: 'brand-signoff', nominees: ['u3'],
  }]);
  assert.equal(document.querySelector('dialog.approval-dialog'), null, 'dialog closed on success');
});

test('400 NOMINEE_NOT_ELIGIBLE surfaces in-dialog; dialog stays open', async () => {
  reset();
  servingApprovers(400, { error: 'NOMINEE_NOT_ELIGIBLE' });
  openApprovalDialog({ toolId: 'event-badge' });
  await tick();
  const dlg = document.querySelector('dialog.approval-dialog')!;
  dlg.querySelector<HTMLButtonElement>('[data-approver-id="u2"]')!.click();
  dlg.querySelector<HTMLButtonElement>('[data-act="submit"]')!.click();
  await tick();

  assert.ok(document.querySelector('dialog.approval-dialog'), 'dialog stays open on error');
  const err = dlg.querySelector<HTMLElement>('[data-error]')!;
  assert.equal(err.hidden, false, 'error line shown');
  assert.match(err.textContent || '', /can.t approve|choose someone/i);
});

test('no bound chain → friendly notice, no approvers fetch', async () => {
  reset();
  // Policy present but this tool has no chain bound.
  setExportPolicy({ canDownload: false, canRequestApproval: true, chains: {} });
  let approverHits = 0;
  router = (url) => { if (url.includes('/approvers')) approverHits++; return new Response('', { status: 404 }); };
  openApprovalDialog({ toolId: 'ungated' });
  await tick();

  assert.equal(approverHits, 0, 'no approvers request when no chain is bound');
  const dlg = document.querySelector('dialog.approval-dialog')!;
  assert.ok(dlg, 'a notice dialog is shown');
  assert.match(dlg.textContent || '', /isn.t set up/i);
  assert.equal(dlg.querySelector('[data-act="submit"]'), null, 'notice has no submit - nothing to file');
});

// ── The file goes with the request ─────────────────────────────────────────

test('a request with a file shows it, sends it in parts and names it; the older path says it is not attached', async () => {
  reset();
  const { ARTIFACT_RETRY_DELAYS_MS } = await import('./approval-artifact.ts');
  ARTIFACT_RETRY_DELAYS_MS.length = 0;

  let revoked = 0;
  (globalThis.URL as unknown as { createObjectURL: (b: unknown) => string }).createObjectURL = () => 'blob:file';
  (globalThis.URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => { revoked++; };

  setExportPolicy({ canDownload: false, canRequestApproval: true, chains: { 'event-badge': 'brand-signoff' } });
  const puts: string[] = [];
  router = (target, init) => {
    const method = (init?.method || 'GET').toUpperCase();
    if (target.includes('/api/v1/approvals/approvers')) return json(APPROVERS);
    if (target.endsWith('/api/v1/uploads') && method === 'POST') return json({ upload: { id: 'upl_1' }, partBytes: 4 }, 201);
    if (/\/api\/v1\/uploads\/upl_1\/parts\/\d+$/.test(target) && method === 'PUT') { puts.push(target); return new Response(null, { status: 204 }); }
    if (target.endsWith('/api/v1/uploads/upl_1/finalize')) return json({ upload: { id: 'upl_1', ready: true } });
    if (target.endsWith('/api/v1/approvals') && method === 'POST') return new Response('{}', { status: 201 });
    return new Response('', { status: 404 });
  };
  const blob = new Blob(['0123456789'], { type: 'image/png' });
  openApprovalDialog({ toolId: 'event-badge', title: 'Badge', artifact: { blob, name: 'badge.png', query: 'name=Ana' } }, { maxFileBytes: 1024, partBytes: 4 });
  await tick(); await tick();
  const dialogEl = document.querySelector('dialog')!;
  assert.ok(dialogEl.querySelector('[data-file-stage] img'), 'the file is the first thing in the dialog');
  for (let i = 0; i < 20 && !/SHA-256/.test(dialogEl.querySelector('[data-file-facts]')!.textContent ?? ''); i++) await tick();
  assert.match(dialogEl.querySelector('[data-file-facts]')!.textContent ?? '', /^PNG · 10 B · SHA-256 [a-f0-9]{12}…$/);
  dialogEl.querySelector<HTMLElement>('[data-approver-id]')!.click();
  dialogEl.querySelector<HTMLButtonElement>('[data-act="submit"]')!.click();
  for (let i = 0; i < 40 && document.querySelector('dialog'); i++) await tick();
  assert.equal(document.querySelector('dialog'), null, 'sent and closed');
  assert.equal(puts.length, 3, 'ten bytes in four-byte parts');
  const begin = postBodies.find((b) => (b as { scope?: string }).scope === 'approval-artifact') as { size: number; parts: unknown[] };
  assert.equal(begin.size, 10);
  assert.equal(begin.parts.length, 3);
  const request = postBodies.find((b) => (b as { subjectType?: string }).subjectType === 'export-review') as { exportReview: Record<string, unknown>; nominees: string[]; chainId: string };
  assert.equal(request.chainId, 'brand-signoff');
  assert.equal(request.exportReview.uploadId, 'upl_1');
  assert.equal(request.exportReview.format, 'png');
  assert.equal(request.exportReview.query, 'name=Ana');
  assert.ok(revoked >= 1, 'the picture is released with the dialog');

  // The older path: the instance takes no file.
  reset();
  servingApprovers();
  openApprovalDialog({ toolId: 'event-badge', title: 'Badge' });
  await tick(); await tick();
  assert.match(document.querySelector('dialog')!.textContent ?? '', /The file is not attached, so reviewers see only the title\./);
  document.querySelector<HTMLButtonElement>('dialog [data-act="cancel"]')!.click();
});

test('a file over the limit says so and cannot be sent', async () => {
  reset();
  (globalThis.URL as unknown as { createObjectURL: (b: unknown) => string }).createObjectURL = () => 'blob:file';
  (globalThis.URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => {};
  servingApprovers();
  openApprovalDialog({ toolId: 'event-badge', artifact: { blob: new Blob(['0123456789'], { type: 'image/png' }), name: 'badge.png' } }, { maxFileBytes: 4, partBytes: 4 });
  await tick(); await tick();
  const dialogEl = document.querySelector('dialog')!;
  assert.match(dialogEl.querySelector('[data-error]')!.textContent ?? '', /This file is 10 B\. This workspace takes up to 4 B for review\./);
  dialogEl.querySelector<HTMLElement>('[data-approver-id]')!.click();
  assert.equal(dialogEl.querySelector<HTMLButtonElement>('[data-act="submit"]')!.disabled, true);
  dialogEl.querySelector<HTMLButtonElement>('[data-act="cancel"]')!.click();
});

test('a PDF shows its name, then the first page the view can draw', async () => {
  reset();
  (globalThis.URL as unknown as { createObjectURL: (b: unknown) => string }).createObjectURL = () => 'blob:page';
  (globalThis.URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => {};
  servingApprovers();
  let finish: (page: Blob | null) => void = () => {};
  const firstPage = () => new Promise<Blob | null>((resolve) => { finish = resolve; });
  openApprovalDialog({ toolId: 'event-badge', artifact: { blob: new Blob(['%PDF-1.7'], { type: 'application/pdf' }), name: 'badge.pdf', firstPage } }, { maxFileBytes: 1024, partBytes: 4 });
  await tick();
  const dialogEl = document.querySelector('dialog')!;
  const stage = dialogEl.querySelector('[data-file-stage]')!;
  assert.equal(stage.textContent, 'badge.pdf');
  finish(new Blob(['<svg/>'], { type: 'image/svg+xml' }));
  await tick(); await tick();
  assert.equal(stage.querySelector('img')?.getAttribute('src'), 'blob:page');
  dialogEl.querySelector<HTMLButtonElement>('[data-act="cancel"]')!.click();
});
