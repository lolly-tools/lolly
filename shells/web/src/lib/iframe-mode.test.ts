// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { applyIframeModeAttr, iframeModeFromUrl, isIframeMode, setIframeModeForTest } from './iframe-mode.ts';

test('iframeModeFromUrl reads the flag from a hash route or a path route', () => {
  assert.equal(iframeModeFromUrl('https://lolly.tools/#/tool/sandbox?html=x&iframe'), true);
  assert.equal(iframeModeFromUrl('https://lolly.tools/#/tool/sandbox?iframe=1'), true, 'the value is ignored');
  assert.equal(iframeModeFromUrl('https://lolly.tools/t/sandbox?iframe'), true);
  assert.equal(iframeModeFromUrl('https://lolly.tools/#/tool/sandbox?full'), false);
  assert.equal(iframeModeFromUrl('https://lolly.tools/#/tool/sandbox?noiframe&iframes'), false, 'a longer name is not the flag');
  assert.equal(iframeModeFromUrl('https://lolly.tools/#/tool/sandbox?html=%3Ciframe%3E'), false, 'a value mentioning iframe is not the flag');
  assert.equal(iframeModeFromUrl('not a url at all ::'), false);
});

test('the answer is fixed for the life of the document, and stamps <html>', () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  try {
    setIframeModeForTest(false);
    applyIframeModeAttr(dom.window.document.documentElement);
    assert.equal(dom.window.document.documentElement.hasAttribute('data-lolly-iframe'), false);
    setIframeModeForTest(true);
    assert.equal(isIframeMode(), true);
    applyIframeModeAttr(dom.window.document.documentElement);
    assert.equal(dom.window.document.documentElement.hasAttribute('data-lolly-iframe'), true);
  } finally {
    setIframeModeForTest(undefined);
  }
});

test('the pre-paint mirror in index.html reads the same flag from the same two places', () => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  const script = /`\?iframe` \(lib\/iframe-mode\.ts is canonical[\s\S]*?\}\s*catch/.exec(html)?.[0] ?? '';
  assert.ok(script, 'the pre-paint iframe block is present');
  assert.match(script, /new URLSearchParams\(location\.search\)\.has\('iframe'\)/);
  assert.match(script, /location\.hash\.slice\(iq \+ 1\)\)\.has\('iframe'\)/);
  assert.match(script, /setAttribute\('data-lolly-iframe', ''\)/);
});
