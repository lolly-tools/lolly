// SPDX-License-Identifier: MPL-2.0
/**
 * The bottom bar's FIRST-RUN LABEL WINDOW (plans/163 F11).
 *
 * On a phone the four nav buttons collapse to bare glyphs. footerNav() marks the
 * bar `data-first-run` while the privacy notice is still unacknowledged, and
 * gallery.css shows each button's name underneath for exactly that window. The
 * markup gate is what this pins - open both ways, because the point of the fix is
 * that the steady-state bar goes back to being the quiet one:
 *   - unacknowledged  → the attribute is present (labels can show)
 *   - acknowledged    → the attribute is gone, and the markup matches what the bar
 *                       rendered before the fix (the four labels stay in the DOM
 *                       either way; only the attribute moves)
 *
 * Run directly:
 *   node --import ../../../../tests/css-stub.mjs --test shells/web/src/components/footer-nav.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><main id="view"></main></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;

const { footerNav } = await import('./footer-nav.ts');
const { ackPrivacyNotice } = await import('../views/privacy-notice.ts');

test('first-run window: the bar is marked while the privacy notice is unacknowledged', () => {
  localStorage.clear();
  const html = footerNav({ searchHtml: '' });
  assert.match(html, /<footer class="gallery-footer" data-first-run>/);
  // All four names are in the markup for the CSS to reveal.
  for (const name of ['Open', 'Dashboard', 'Verify', 'What?']) {
    assert.ok(html.includes(`<span class="gallery-nav-label">${name}</span>`), `missing label: ${name}`);
  }
});

test('window closed: acknowledging the notice drops the attribute, nothing else', () => {
  localStorage.clear();
  const firstRun = footerNav({ searchHtml: '' });
  ackPrivacyNotice();
  const steady = footerNav({ searchHtml: '' });
  assert.doesNotMatch(steady, /data-first-run/);
  // The ONLY difference between the two renders is the attribute.
  assert.equal(firstRun.replace(' data-first-run>', '>'), steady);
});
