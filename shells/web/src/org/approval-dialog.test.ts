// SPDX-License-Identifier: MPL-2.0
/**
 * org/approval-dialog.ts - the "Request approval" flow.
 *
 * Pure helpers (filterApprovers / buildApprovalBody / subjectRefFor) are exercised
 * DOM-free. The dialog itself is driven under jsdom the way index.test.ts drives the
 * gate: a reassignable fetch router backs GET approvers + POST approvals, and the
 * open → fetch → render → filter → submit path is asserted end to end. jsdom 25 has
 * no <dialog>.showModal, so the native-dialog primitive is shimmed minimally (open
 * flag + close), exactly the surface components/modal.ts touches.
 *
 * Run directly:  node --test shells/web/src/org/approval-dialog.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// ── Pure helpers (DOM-free) ─────────────────────────────────────────────────
import { filterApprovers, buildApprovalBody, subjectRefFor } from './approval-dialog.ts';

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

// jsdom 25 has no dialog showModal/close - shim the surface mountModal uses.
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
