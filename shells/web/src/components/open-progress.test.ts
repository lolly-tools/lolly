// SPDX-License-Identifier: MPL-2.0
/**
 * The "Opening…" card (components/open-progress.ts): when it appears, what it shows,
 * and how Cancel, Escape and a navigation stop the open.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/components/open-progress.test.ts
 *
 * jsdom has <dialog> but neither showModal() nor close(), so both are stubbed on the
 * prototype, as components/modal-back.test.ts does.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/#/p' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.history = dom.window.history as unknown as typeof globalThis.history;
globalThis.location = dom.window.location as unknown as typeof globalThis.location;
for (const k of ['HTMLElement', 'Element', 'Node', 'Event'] as const) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
const dialogProto = dom.window.HTMLDialogElement.prototype as unknown as Record<string, unknown>;
dialogProto.showModal = function showModal(this: { open: boolean }): void { this.open = true; };
dialogProto.close = function close(this: { open: boolean }): void { this.open = false; };

const { openProgress } = await import('./open-progress.ts');

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const card = (): HTMLDialogElement | null => document.querySelector<HTMLDialogElement>('dialog.open-progress');
const text = (sel: string): string => card()?.querySelector(sel)?.textContent?.trim() ?? '';

test('an open that finishes inside the delay never shows the card', async () => {
  const p = openProgress({ name: 'Deck', delayMs: 20 });
  p.close();
  await sleep(40);
  assert.equal(card(), null);
});

test('past the delay: the name, the step, the thumbnail and a focused Cancel', async () => {
  const before = window.history.length;
  const p = openProgress({ name: 'Quarterly deck', thumb: 'data:image/png;base64,AAAA', delayMs: 0 });
  await sleep(5);
  assert.ok(card()?.open, 'the card is up');
  assert.equal(text('.modal-title'), 'Opening Quarterly deck');
  assert.equal(text('.open-progress-step'), 'Reading the document');
  assert.ok(card()!.querySelector('.open-progress-thumb img'), 'the thumbnail is drawn');
  assert.equal(document.activeElement, card()!.querySelector('[data-act="cancel"]'), 'Cancel has focus');
  assert.equal(window.history.length, before, 'no history entry: the card is off the Back stack');
  p.phase('pages');
  assert.equal(text('.open-progress-step'), 'Preparing the pages');
  p.close();
  assert.equal(card(), null);
  assert.equal(p.stop(), null, 'an open that finished was never stopped');
});

test('no name reads as a document, and only an image the page made is drawn', async () => {
  for (const thumb of ['javascript:alert(1)', 'https://example.com/x.png', 'data:text/html,<b>x</b>']) {
    const p = openProgress({ thumb, delayMs: 0 });
    await sleep(5);
    assert.equal(text('.modal-title'), 'Opening document');
    assert.equal(card()!.querySelector('img'), null, `${thumb.slice(0, 20)} is not drawn`);
    p.close();
  }
});

test('Cancel stops the open, says so, and stays up until the mount lets go', async () => {
  const p = openProgress({ name: 'Deck', delayMs: 0 });
  await sleep(5);
  const btn = card()!.querySelector<HTMLButtonElement>('[data-act="cancel"]')!;
  btn.click();
  assert.equal(p.stop(), 'cancel');
  assert.equal(await p.stopped, 'cancel');
  assert.equal(text('.open-progress-step'), 'Stopping…');
  assert.equal(btn.disabled, true, 'the button cannot be pressed twice');
  p.phase('editor');
  assert.equal(text('.open-progress-step'), 'Stopping…', 'a later step does not overwrite it');
  assert.ok(card(), 'the card stays until the mount closes it');
  p.close();
  assert.equal(card(), null);
});

test('Escape is Cancel; a click on the backdrop is not', async () => {
  const p = openProgress({ delayMs: 0 });
  await sleep(5);
  const dlg = card()!;
  dlg.getBoundingClientRect = () => ({ left: 100, top: 100, right: 200, bottom: 200, width: 100, height: 100, x: 100, y: 100, toJSON: () => ({}) }) as DOMRect;
  dlg.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, clientX: 5, clientY: 5 }));
  assert.equal(p.stop(), null, 'a stray click throws nothing away');
  dlg.dispatchEvent(new dom.window.Event('cancel', { cancelable: true }));
  assert.equal(p.stop(), 'cancel');
  assert.ok(card(), 'and the card stays to say Stopping');
  p.close();
});

test('a navigation away stops the open and takes the card down at once', async () => {
  const p = openProgress({ delayMs: 0 });
  await sleep(5);
  p.left();
  assert.equal(p.stop(), 'left');
  assert.equal(await p.stopped, 'left');
  assert.equal(card(), null);
});

test('stopped before the card shows: it never appears', async () => {
  const p = openProgress({ delayMs: 20 });
  p.left();
  await sleep(40);
  assert.equal(card(), null);
});

test('text layout progress: the count and a filling bar, then back to the step', async () => {
  const p = openProgress({ delayMs: 0 });
  await sleep(5);
  const count = (): HTMLElement => card()!.querySelector<HTMLElement>('.open-progress-count')!;
  const bar = (): HTMLElement => card()!.querySelector<HTMLElement>('.job-bar')!;
  assert.equal(count().hidden, true, 'no count before any layout');
  assert.ok(bar().classList.contains('job-bar--indef'), 'an unknown length drifts');
  p.progress(3, 10);
  assert.equal(text('.open-progress-step'), 'Laying out text');
  assert.equal(count().hidden, false);
  assert.equal(count().textContent, '3 of 10');
  assert.equal(count().getAttribute('aria-hidden'), 'true', 'the per-story count stays out of the live region');
  assert.equal(bar().classList.contains('job-bar--indef'), false, 'a known length fills');
  assert.equal(card()!.querySelector<HTMLElement>('.job-bar-fill')!.style.width, '30%');
  assert.equal(bar().getAttribute('aria-valuenow'), '3');
  assert.equal(bar().getAttribute('aria-valuemax'), '10');
  p.phase('editor');
  assert.equal(text('.open-progress-step'), 'Laying out text', 'a mount step does not replace the layout count');
  p.progress(10, 10);
  assert.equal(text('.open-progress-step'), 'Building the editor', 'every story laid out: back to the step');
  assert.equal(count().hidden, true);
  p.close();
});

test('stopping hides the count and the card says Stopping', async () => {
  const p = openProgress({ delayMs: 0 });
  await sleep(5);
  p.progress(4, 10);
  card()!.querySelector<HTMLButtonElement>('[data-act="cancel"]')!.click();
  assert.equal(text('.open-progress-step'), 'Stopping…');
  assert.equal(card()!.querySelector<HTMLElement>('.open-progress-count')!.hidden, true);
  p.progress(6, 10);
  assert.equal(text('.open-progress-step'), 'Stopping…', 'later layouts do not undo it');
  p.close();
});

test('onClose runs once, however the card closes', async () => {
  let closes = 0;
  const p = openProgress({ delayMs: 0, onClose: () => { closes += 1; } });
  p.left();
  p.close();
  assert.equal(closes, 1);
});
