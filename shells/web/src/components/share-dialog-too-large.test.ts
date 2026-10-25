// SPDX-License-Identifier: MPL-2.0
/**
 * share-dialog.ts with a document no link can carry (perf review C1 step 3).
 *
 * Past the pack limit the tool's address keeps a pointer to the copy saved on this
 * device, and the Share surface says so plainly: the link field holds that device link,
 * labelled as one, or nothing, the verdict points at the .lolly file, and Copy copies
 * the device link. A small document's link is unchanged.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/components/share-dialog-too-large.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.test/design', pretendToBeVisual: true });
const g = globalThis as unknown as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.location = dom.window.location;
for (const k of ['Element', 'HTMLElement', 'HTMLInputElement', 'HTMLDialogElement', 'Node', 'Event', 'CustomEvent', 'MutationObserver', 'getComputedStyle'] as const) {
  g[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
g.localStorage = dom.window.localStorage;
g.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0);
g.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
const copied: string[] = [];
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async (text: string) => { copied.push(text); } } } });

const { mountSharePanel } = await import('./share-dialog.ts');
const { LINK_CONTENT_MAX } = await import('../lib/url-budget.ts');

const DEVICE = 'https://lolly.test/design?slot=design%3Aabc';
const lolly = { build: async () => ({ blob: new Blob(), filename: 'x.lolly' }), save: async () => {} };
/** A blocks value past the pack limit, as `bx` (Design's boxes) rides the link. */
const huge = `bx=${'r'.repeat(LINK_CONTENT_MAX + 10)}`;

function mount(opts: Record<string, unknown>): HTMLElement {
  const container = document.createElement('div');
  document.body.replaceChildren(container);
  mountSharePanel(container, { toolId: 'design', manifest: { render: { formats: ['png'] } }, ...opts } as Parameters<typeof mountSharePanel>[1]);
  return container;
}
const field = (c: HTMLElement) => c.querySelector<HTMLInputElement>('.share-link-field')!;
const note = (c: HTMLElement) => c.querySelector<HTMLElement>('[data-device-link-note]')!;
const verdict = (c: HTMLElement) => c.querySelector<HTMLElement>('[data-share-warning]')!;
const copy = (c: HTMLElement) => c.querySelector<HTMLButtonElement>('.share-copy-btn')!;

test('a document past the pack limit offers the device link, labelled, and the .lolly file', async () => {
  const c = mount({ baseParts: [huge], lolly, deviceLink: DEVICE });
  assert.equal(field(c).value, DEVICE, 'never the cut-down or full content link');
  assert.equal(field(c).getAttribute('aria-label'), 'Link that opens this creation on this device only');
  assert.equal(note(c).hidden, false);
  assert.match(note(c).textContent!, /only on this device/);
  assert.equal(verdict(c).hidden, false);
  assert.ok(verdict(c).classList.contains('is-error'));
  assert.match(verdict(c).textContent!, /too large for a link\. The link above opens it only on this device\. To send the whole creation, download the \.lolly file below\./);
  assert.ok(c.querySelector('[data-share-file]')!.classList.contains('is-recommended'), 'the .lolly card is the recommended route');
  assert.equal(copy(c).hasAttribute('disabled'), false);
  copy(c).click();
  await new Promise(done => setTimeout(done, 0));
  assert.equal(copied.at(-1), DEVICE, 'Copy link copies the device link');
  assert.equal(c.querySelector<HTMLButtonElement>('.share-credit-btn')!.hasAttribute('disabled'), true, 'no credit caption for a device-only link');
});

test('without a saved copy no link is offered, only the .lolly file', () => {
  const c = mount({ baseParts: [huge], lolly });
  assert.equal(field(c).value, '');
  assert.equal(field(c).getAttribute('aria-label'), 'No link can carry this creation');
  assert.equal(copy(c).hasAttribute('disabled'), true);
  assert.equal(note(c).hidden, true);
  assert.match(verdict(c).textContent!, /too large for a link\. To send the whole creation, download the \.lolly file below\./);
});

test('a document whose pack is refused is treated the same way', async () => {
  // Under the content limit, but too random to compress into a token a link may carry.
  const noise = `bx=${randomBytes(120_000).toString('base64url')}`;
  assert.ok(noise.length < LINK_CONTENT_MAX);
  const c = mount({ baseParts: [noise], lolly, deviceLink: DEVICE });
  assert.notEqual(field(c).value, DEVICE, 'the readable link stands until the pack answers');
  for (let i = 0; i < 50 && field(c).value !== DEVICE; i++) await new Promise(done => setTimeout(done, 10));
  assert.equal(field(c).value, DEVICE);
  assert.match(verdict(c).textContent!, /too large for a link/);
});

test('a small document keeps its ordinary link, with no device label', () => {
  const c = mount({ baseParts: ['bx=shape,box,1,2,3,4'], lolly, deviceLink: DEVICE });
  assert.equal(field(c).value, 'https://lolly.test/t/design?bx=shape,box,1,2,3,4');
  assert.equal(field(c).getAttribute('aria-label'), 'Shareable link');
  assert.equal(note(c).hidden, true);
  assert.equal(verdict(c).hidden, true);
  assert.equal(copy(c).hasAttribute('disabled'), false);
});
