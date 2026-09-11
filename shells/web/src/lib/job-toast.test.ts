// SPDX-License-Identifier: MPL-2.0
/**
 * Global job toast (lib/job-toast.ts) - it must OUTLIVE a router view teardown.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/lib/job-toast.test.ts
 *
 * The toast mounts on document.body OUTSIDE main#view; the router only ever
 * replaces #view's own contents (viewEl._cleanup + innerHTML swap), so a job's
 * progress keeps showing after the user navigates away. This simulates that swap
 * and asserts the toast node is still in the body and still live.
 *
 * (Notification gating lives in the sibling job-toast-notify.test.ts so each gets
 * a fresh module instance - the "asked for permission" flag is module state.)
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><main id="view"></main></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.MouseEvent = dom.window.MouseEvent;
globalThis.KeyboardEvent = dom.window.KeyboardEvent;

let mountJobToast: typeof import('./job-toast.ts').mountJobToast;
let startJob: typeof import('./jobs.ts').startJob;

before(async () => {
  ({ mountJobToast } = await import('./job-toast.ts'));
  ({ startJob } = await import('./jobs.ts'));
});

test('the toast survives a router view swap and stays live', () => {
  mountJobToast();
  const toast = document.querySelector<HTMLElement>('.job-toast')!;
  assert.ok(toast, 'toast mounted');
  assert.equal(toast.parentElement?.className, 'float-cluster', 'mounted in the floating cluster');
  assert.equal(toast.parentElement?.parentElement, document.body, 'cluster sits directly on body, outside #view');
  assert.equal(toast.hidden, true, 'hidden while there are no jobs');

  // A heavy job appears - the toast shows it.
  const job = startJob({ title: 'Removing background', cancel: () => {} });
  assert.equal(toast.hidden, false);
  assert.match(toast.textContent ?? '', /Removing background/);

  // Simulate the router tearing down and replacing the mounted view (main.ts
  // does `view._cleanup?.()` then rewrites #view). This must NOT touch the toast.
  const view = document.getElementById('view')!;
  view.innerHTML = '<section>a completely different view</section>';

  assert.ok(document.body.contains(toast), 'toast still in the document after the swap');
  assert.equal(toast.parentElement?.parentElement, document.body, 'cluster still a direct child of body');
  assert.equal(document.querySelector('#view .job-toast'), null, 'never lived inside #view');

  // …and still LIVE: a progress update repaints its candy bar in place.
  job.progress(5, 10, 'frame 5');
  const fill = toast.querySelector<HTMLElement>('.job-bar-fill')!;
  assert.ok(fill, 'bar present');
  assert.equal(fill.style.width, '50%', 'progress reached the DOM after the swap');

  // Finishing flips it to the completed state (still visible during retention).
  job.finish();
  assert.match(toast.textContent ?? '', /Done/);
});

test('expanding then Escape collapses the toast', () => {
  // Continues from the previous test's mounted toast + finished job (retained).
  const job = startJob({ title: 'Second job', cancel: () => {} });
  const toast = document.querySelector<HTMLElement>('.job-toast')!;
  // Expand via the pill button.
  toast.querySelector<HTMLElement>('[data-act="expand"]')!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.ok(toast.querySelector('.job-panel'), 'expanded to the panel');

  // Escape collapses it (no modal is open, so the toast owns the key).
  document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(toast.querySelector('.job-panel'), null, 'collapsed back to the pill');
  assert.ok(toast.querySelector('.job-pill'), 'pill is back');
  job.finish();
});
