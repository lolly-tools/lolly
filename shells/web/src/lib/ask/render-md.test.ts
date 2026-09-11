// SPDX-License-Identifier: MPL-2.0
/**
 * The escape-first answer renderer (plans/103 M0). Pins that hostile markup is
 * neutralised (the docs are first-party, but the renderer is the safety net for
 * the innerHTML sink in views/ask.ts), that the supported subset renders, and
 * that external links are demoted to text while in-app links survive.
 *
 * Run directly:  node --test shells/web/src/lib/ask/render-md.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderAnswerMd } from './render-md.ts';

test('escapes HTML - no raw tag, attribute or entity survives as markup', () => {
  const out = renderAnswerMd('A <script>alert(1)</script> and <img src=x onerror=alert(1)>.');
  assert.ok(!/<script/i.test(out));
  assert.ok(!/<img/i.test(out));
  assert.ok(out.includes('&lt;script&gt;'));
});

test('paragraphs, bold, italic and inline code render in the subset', () => {
  const out = renderAnswerMd('Use **bold** and *italic* and `code` here.');
  assert.ok(out.includes('<strong>bold</strong>'));
  assert.ok(out.includes('<em>italic</em>'));
  assert.ok(out.includes('<code>code</code>'));
  assert.ok(out.startsWith('<p>'));
});

test('bullet and numbered lists render as ul/ol', () => {
  assert.ok(renderAnswerMd('- one\n- two').includes('<ul><li>one</li><li>two</li></ul>'));
  assert.ok(renderAnswerMd('1. first\n2. second').includes('<ol><li>first</li><li>second</li></ol>'));
});

test('fenced code renders verbatim and escaped, no inline processing inside', () => {
  const out = renderAnswerMd('```\n<b>&*not*</b>\n```');
  assert.ok(out.includes('<pre class="ask-code"><code>'));
  assert.ok(out.includes('&lt;b&gt;&amp;*not*&lt;/b&gt;'));
  assert.ok(!out.includes('<em>')); // '*not*' inside a fence is not italicised
});

test('a pipe table renders, dropping the separator row', () => {
  const out = renderAnswerMd('| A | B |\n|---|---|\n| 1 | 2 |');
  assert.ok(out.includes('<table class="ask-table">'));
  assert.ok(out.includes('<th>A</th>'));
  assert.ok(out.includes('<td>1</td>'));
  assert.ok(!out.includes('---'));
});

test('in-app and /info links stay anchors; external links become plain text', () => {
  const infoLink = renderAnswerMd('See [URL Mode](/info/url-mode.html).');
  assert.ok(infoLink.includes('<a href="/info/url-mode.html">URL Mode</a>'));

  const toolLink = renderAnswerMd('Open [QR](/t/qr-code).');
  assert.ok(toolLink.includes('<a href="/t/qr-code">QR</a>'));

  const external = renderAnswerMd('Visit [evil](https://evil.test/x).');
  assert.ok(external.includes('evil'));
  assert.ok(!external.includes('<a '), 'external links must not render as anchors');
  assert.ok(!external.includes('evil.test'));

  const js = renderAnswerMd('Click [x](javascript:alert(1)).');
  assert.ok(!js.includes('<a '), 'javascript: links must not render as anchors');
});

test('images are dropped (a docs screenshot recipe is useless here)', () => {
  const out = renderAnswerMd('Before ![a shot](/t/url-shot?x=1) after.');
  assert.ok(!out.includes('url-shot'));
  assert.ok(out.includes('Before'));
  assert.ok(out.includes('after'));
});
