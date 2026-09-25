// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { helpTip, unwireHelpTips, wireHelpTips } from './help-tip.ts';

test('help links reject executable and protocol-relative destinations', () => {
  for (const href of ['javascript:alert(1)', 'data:text/html,test', '//example.com', '/\\example.com']) {
    const { pop } = helpTip('Explanation', { href, text: 'More' });
    const doc = new JSDOM(pop).window.document;
    assert.equal(doc.querySelector('a'), null, href);
    assert.equal(doc.body.textContent, 'Explanation');
  }
});

test('help links preserve internal routes and escape external URLs and labels', () => {
  const internal = new JSDOM(helpTip('Explanation', { href: '#/settings' }).pop).window.document.querySelector('a')!;
  assert.equal(internal.getAttribute('href'), '#/settings');
  assert.equal(internal.hasAttribute('target'), false);
  const href = 'https://example.com/?a="test"&b=1';
  const doc = new JSDOM(helpTip('<Explanation>', { href, text: '<More>' }).pop).window.document;
  const external = doc.querySelector('a')!;
  assert.equal(external.getAttribute('href'), href);
  assert.equal(external.textContent, '<More>');
  assert.equal(external.getAttribute('rel'), 'noopener');
  assert.equal(doc.querySelector('More'), null);
});

// The X in an opened tip's corner. wireHelpTips installs its outside-click dismiss on
// the GLOBAL document, so this one needs jsdom's installed as that global.
test('the close button dismisses an opened tip and hands focus back to the (i)', () => {
  const { button, pop } = helpTip('Chroma is how vivid a colour is.');
  const dom = new JSDOM(
    `<!doctype html><body><div id="scope"><span class="help-tip-host">Chroma ${button}${pop}</span></div></body>`);
  globalThis.document = dom.window.document;
  const doc = dom.window.document;
  const scope = doc.getElementById('scope')!;
  wireHelpTips(scope);

  const info = doc.querySelector<HTMLButtonElement>('.help-tip-btn')!;
  const popEl = doc.querySelector<HTMLElement>('.help-tip-pop')!;
  const close = doc.querySelector<HTMLButtonElement>('.help-tip-close')!;

  // Pointer-only by design: a named close button would land in the accessible
  // DESCRIPTION of every control this pop is wired to (linkHelpDescriptions).
  assert.equal(close.getAttribute('aria-hidden'), 'true');
  assert.equal(close.getAttribute('tabindex'), '-1');
  assert.equal(popEl.textContent, 'Chroma is how vivid a colour is.');

  info.click();
  assert.equal(popEl.hidden, false);
  assert.equal(info.getAttribute('aria-expanded'), 'true');

  close.click();
  assert.equal(popEl.hidden, true);
  assert.equal(info.getAttribute('aria-expanded'), 'false');
  assert.equal(doc.activeElement, info);

  unwireHelpTips(scope);
});
