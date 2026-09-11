// SPDX-License-Identifier: MPL-2.0
/**
 * extractHtmlText (views/doc-read.ts) - the HTML-prose input that BOTH the
 * verify text-signal panel and the docs reader's AI-scan donut analyse. The
 * point being pinned: markup and inline CSS never reach the analyser (raw page
 * bytes detect as docKind 'code', gating every prose tell off), while the
 * page's visible writing does.
 *
 * Run directly: node --test shells/web/src/views/doc-read.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// The module only touches DOMParser at call time; pin it before the import.
const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.DOMParser = dom.window.DOMParser;

const { extractHtmlText } = await import('./doc-read.ts');

test('keeps the visible prose, drops script and style text', () => {
  const text = extractHtmlText(`<!doctype html><html><head>
    <style>.hero{color:red;--x:1}</style>
    <script>window.__never = true;</script>
    <title>Page title</title>
  </head><body><h1>Real heading</h1><p>Body prose that a reader sees.</p></body></html>`);
  assert.ok(text.includes('Real heading'), 'headings survive');
  assert.ok(text.includes('Body prose that a reader sees.'), 'paragraphs survive');
  assert.ok(!text.includes('color:red'), 'style text never reaches the analyser');
  assert.ok(!text.includes('__never'), 'script text never reaches the analyser');
});

test('caps the extract at 64 KB and collapses blank-line runs', () => {
  const big = `<body><p>${'word '.repeat(40000)}</p><p>a\n\n\n\n\nb</p></body>`;
  const text = extractHtmlText(big);
  assert.ok(text.length <= 64 * 1024, 'output is capped');
  assert.ok(!/\n{3,}/.test(extractHtmlText('<body><p>a</p>\n\n\n\n\n<p>b</p></body>')), 'blank-line runs collapse');
});

test('an empty document extracts to an empty string', () => {
  assert.equal(extractHtmlText(''), '');
});
