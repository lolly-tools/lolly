// SPDX-License-Identifier: MPL-2.0
/**
 * The instance sheet's two ways in. Settings in a browser opens it at the address
 * step (plan 320 D1: the welcome no longer offers a workspace door), where Back
 * becomes Cancel and closes the sheet; the app's Change opens the full choice.
 *
 * Run directly (the module imports its stylesheet, so the CSS stub is required):
 *   node --import ./tests/css-stub.mjs --test shells/web/src/components/instance-sheet.test.ts
 *
 * jsdom with a real origin and showModal/close stubbed on the prototype, as in
 * welcome-dialog.test.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/#/profile' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.history = dom.window.history as unknown as typeof globalThis.history;
globalThis.location = dom.window.location as unknown as typeof globalThis.location;
globalThis.localStorage = dom.window.localStorage;
globalThis.Element = dom.window.Element;

const dialogProto = dom.window.HTMLDialogElement.prototype as unknown as Record<string, unknown>;
dialogProto.showModal = function showModal(this: { open: boolean }): void { this.open = true; };
dialogProto.close = function close(this: { open: boolean }): void { this.open = false; };

const { openInstanceSheet } = await import('./instance-sheet.ts');
type Host = Parameters<typeof openInstanceSheet>[0];

const sheet = (): HTMLElement => {
  const el = document.querySelector<HTMLElement>('.instance-sheet');
  assert.ok(el, 'the instance sheet should be mounted');
  return el;
};

test('a browser opens straight at the address step, and Cancel closes the sheet', async () => {
  const closed = openInstanceSheet({} as Host, { start: 'connect' });
  const el = sheet();
  assert.ok(el.querySelector('#instance-url'), 'the address field is the first thing shown');
  assert.equal(el.querySelector('[data-act="choose-bundled"]'), null, 'no bundled choice in a browser');
  const back = el.querySelector<HTMLButtonElement>('[data-act="connect-back"]')!;
  assert.equal(back.textContent?.trim(), 'Cancel');
  back.click();
  await closed;
  assert.equal(document.querySelector('.instance-sheet'), null);
});

test('without a start step the sheet opens at the choice, and Back returns to it', async () => {
  const closed = openInstanceSheet({} as Host);
  const el = sheet();
  el.querySelector<HTMLButtonElement>('[data-act="choose-connect"]')!.click();
  const back = el.querySelector<HTMLButtonElement>('[data-act="connect-back"]')!;
  assert.equal(back.textContent?.trim(), 'Back');
  back.click();
  assert.ok(el.querySelector('[data-act="choose-bundled"]'), 'Back returns to the choice');
  el.dispatchEvent(new dom.window.Event('cancel'));
  await closed;
});
