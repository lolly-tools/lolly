// SPDX-License-Identifier: MPL-2.0
/**
 * org/catalog-submit.ts - the "Submit to <workspace>" dialog.
 *
 * The pure helpers are exercised DOM-free; the dialog is driven under jsdom with a
 * reassignable fetch router, the approval-dialog test's harness.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/org/catalog-submit.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { latestFor, stateText, submitQuery } from './catalog-submit.ts';
import { templateSubject, uploadSubject } from '../lib/catalog-submit.ts';

const tpl = templateSubject({ id: 't1', toolId: 'design', name: 'Poster', values: { doc: '{}' }, createdAt: '', updatedAt: '' });

test('submitQuery carries the form, the kind, the tool and the client reference', () => {
  const q = submitQuery(tpl, { name: ' Poster 2 ', description: '', tags: 'launch, , social', note: 'For Q4' });
  assert.equal(q.get('name'), 'Poster 2');
  assert.equal(q.get('description'), null);
  assert.equal(q.get('tags'), 'launch,social');
  assert.equal(q.get('type'), 'template');
  assert.equal(q.get('toolId'), 'design');
  assert.equal(q.get('note'), 'For Q4');
  assert.equal(q.get('clientRef'), 'template:t1');
  const upload = submitQuery(uploadSubject({ id: 'user/a', url: 'blob:x', type: 'raster', format: 'png', source: 'user' } as never), { name: 'A', description: '', tags: '', note: '' });
  assert.equal(upload.get('type'), null, 'an upload lets the server decide its type');
});

test('the newest earlier submission is found by reference, and its state reads in words', () => {
  const rows = [
    { id: 'inst/1', state: 'returned' as const, clientRef: 'template:t1', comment: 'wrong logo', at: '2026-10-01' },
    { id: 'inst/2', state: 'submitted' as const, clientRef: 'template:t1', at: '2026-10-05' },
    { id: 'inst/3', state: 'live' as const, clientRef: 'template:other', at: '2026-10-06' },
  ];
  assert.equal(latestFor(rows, 'template:t1')?.id, 'inst/2');
  assert.equal(latestFor(rows, 'template:none'), null);
  assert.equal(stateText(rows[1]!), 'Waiting for review');
  assert.equal(stateText(rows[0]!), 'Returned: wrong logo');
  assert.equal(stateText(rows[2]!), 'Live');
});

// ── the dialog (jsdom) ──────────────────────────────────────────────────────

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://work.test/#/assets', pretendToBeVisual: true });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location as unknown as Location;
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => { setTimeout(() => cb(0), 0); return 0; }) as unknown as typeof requestAnimationFrame;
const Dlg = dom.window.HTMLDialogElement.prototype as unknown as { showModal(): void; close(): void };
Dlg.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
Dlg.close = function (this: HTMLDialogElement) { this.removeAttribute('open'); };

let posted: { url: string; type: string; text: string } | null = null;
let earlier: unknown[] = [];
let answer: { status: number; body: unknown } = { status: 201, body: { state: 'submitted', duplicate: false } };
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (url.includes('/api/v1/catalog/submissions')) return new Response(JSON.stringify({ submissions: earlier }), { status: 200 });
  if (url.includes('/api/v1/catalog/submit') && init?.method === 'POST') {
    const body = init.body as Blob;
    posted = { url, type: String(new Headers(init.headers).get('content-type')), text: await body.text() };
    return new Response(JSON.stringify(answer.body), { status: answer.status });
  }
  return new Response('', { status: 404 });
}) as typeof fetch;

const { openCatalogSubmitDialog } = await import('./catalog-submit.ts');
const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 10));

test('the dialog shows an earlier submission, sends the JSON, and says it is waiting for review', async () => {
  earlier = [{ id: 'inst/1', state: 'returned', clientRef: 'template:t1', comment: 'wrong logo', at: '2026-10-01' }];
  openCatalogSubmitDialog(tpl, 'Acme');
  await settle();
  const dlg = document.querySelector('dialog.catalog-submit-dialog')!;
  assert.equal(dlg.querySelector('.modal-title')?.textContent, 'Submit to Acme');
  assert.equal(dlg.querySelector<HTMLInputElement>('[data-name]')?.value, 'Poster');
  assert.equal(dlg.querySelector('[data-state]')?.textContent, 'Already submitted: Returned: wrong logo');
  dlg.querySelector<HTMLTextAreaElement>('[data-note]')!.value = 'Fixed the logo';
  dlg.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
  await settle();
  assert.ok(posted, 'posted');
  assert.match(posted!.url, /type=template/);
  assert.match(posted!.url, /note=Fixed\+the\+logo/);
  assert.equal(posted!.type, 'application/json');
  assert.equal(JSON.parse(posted!.text).toolId, 'design');
  assert.equal(dlg.querySelector('[data-state]')?.textContent, 'Sent. It is waiting for review.');
  assert.equal(dlg.querySelector<HTMLFormElement>('form')!.hidden, true);
  dlg.querySelector<HTMLButtonElement>('.modal-actions:last-child button')!.click();
  assert.equal(document.querySelector('dialog.catalog-submit-dialog'), null, 'Done closes it');
});

test('a refusal keeps the form and shows the server’s reason', async () => {
  earlier = [];
  answer = { status: 422, body: { error: { message: 'this catalog has no tool "design"' } } };
  openCatalogSubmitDialog(tpl, 'Acme');
  await settle();
  const dlg = document.querySelector('dialog.catalog-submit-dialog')!;
  dlg.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
  await settle();
  assert.equal(dlg.querySelector('[data-error]')?.textContent, 'this catalog has no tool "design"');
  assert.equal(dlg.querySelector<HTMLButtonElement>('[data-act="submit"]')!.disabled, false);
  dlg.remove();
});
