// SPDX-License-Identifier: MPL-2.0
/**
 * The privacy strip's pin and its one flag (plans/137 A2).
 *
 * The bug this pins: the strip is `bottom: calc(var(--footer-h) - 1px)` above a
 * FIXED footer, so writing a zero height parks it at -1px, behind that footer and
 * out of sight - which is what a hidden or just-replaced search bar measured to.
 * A zero must leave the property unset so the sheet's own fallback applies.
 * jsdom reports every offsetHeight as 0, so it exercises exactly that path.
 *
 * Run directly:  node --test shells/web/src/views/privacy-notice.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/#/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;

const { privacyNoticeMarkup, privacyNoticeAcknowledged, ackPrivacyNotice, mountPrivacyNotice } =
  await import('./privacy-notice.ts');

/** A gallery view with the notice in it, plus the shell's footer singleton. */
function mount(opts: { footerHidden?: boolean } = {}): HTMLElement {
  localStorage.clear();
  document.body.innerHTML = `<div id="view" class="app-view gallery-view"></div>`;
  const footer = document.createElement('footer');
  footer.className = 'gallery-footer';
  footer.hidden = !!opts.footerHidden;
  document.body.append(footer);
  const view = document.getElementById('view') as HTMLElement;
  view.innerHTML = privacyNoticeMarkup();
  mountPrivacyNotice(view);
  return view;
}

test('an unmeasurable footer leaves --footer-h unset rather than pinning at -1px', () => {
  const view = mount({ footerHidden: true });
  const notice = view.querySelector<HTMLElement>('.privacy-notice');
  assert.ok(notice, 'the notice renders while unacknowledged');
  assert.equal(notice.style.getPropertyValue('--footer-h'), '');
  assert.ok(view.classList.contains('has-privacy-notice'));
});

test('dismissing acknowledges, and an acknowledged notice never renders again', () => {
  const view = mount();
  view.querySelector<HTMLButtonElement>('.privacy-notice-dismiss')?.click();
  assert.equal(view.querySelector('.privacy-notice'), null);
  assert.equal(view.classList.contains('has-privacy-notice'), false);
  assert.ok(privacyNoticeAcknowledged());
  assert.equal(privacyNoticeMarkup(), '');
});

test('the welcome can acknowledge on the notice\'s behalf', () => {
  localStorage.clear();
  assert.equal(privacyNoticeAcknowledged(), false);
  ackPrivacyNotice();
  assert.ok(privacyNoticeAcknowledged());
});
