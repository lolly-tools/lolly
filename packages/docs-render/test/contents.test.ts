// SPDX-License-Identifier: MPL-2.0
// The page's contents (contents.ts): the rail and the floating control both readers ship.
// Run: node --test packages/docs-render/test/contents.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasContents, contentsRailHtml, contentsControlHtml, type ContentsHeading } from '../src/index.ts';

const labels = { title: 'On this page', button: 'Contents', top: 'Back to top' };
const heads: ContentsHeading[] = [
  { id: 'make-the-code', text: 'Make the code', level: 2 },
  { id: 'colours', text: 'Colours & <contrast>', level: 3 },
  { id: 'download', text: 'Download the file', level: 2 },
];

test('two sections make a list; one section, or subsections alone, do not', () => {
  assert.equal(hasContents(heads), true);
  assert.equal(hasContents(heads.slice(0, 2)), false, 'one h2 plus an h3 is not a contents list');
  assert.equal(hasContents([]), false);
});

test('the rail lists sections and subsections as plain #id links, escaped', () => {
  const html = contentsRailHtml(heads, labels);
  assert.match(html, /^<nav class="docs-toc" aria-label="On this page">/);
  assert.match(html, /<a class="docs-toc-link is-h2" href="#make-the-code" data-contents-target="make-the-code">Make the code<\/a>/);
  assert.match(html, /class="docs-toc-link is-h3" href="#colours" data-contents-target="colours">Colours &amp; &lt;contrast&gt;<\/a>/);
  // The visible heading is presentation; the nav's name carries it for assistive tech.
  assert.match(html, /<p class="docs-toc-head" aria-hidden="true">On this page<\/p>/);
});

test('the floating control lists sections only, starts closed and names its panel', () => {
  const html = contentsControlHtml({ headings: heads, labels, glyph: '<svg></svg>' });
  assert.match(html, /<button type="button" class="doc-contents-btn" aria-expanded="false" aria-controls="docContentsPanel">/);
  assert.match(html, /<span>Contents<\/span><\/button>/, 'the button carries a visible word, not a bare glyph');
  assert.match(html, /<div class="doc-contents-panel" id="docContentsPanel" hidden>/);
  assert.ok(!/data-contents-target="colours"/.test(html), 'a subsection reached the phone panel');
  assert.match(html, /data-contents-target="download"/);
  assert.match(html, /<a class="doc-contents-top" href="#top" data-contents-target="">Back to top<\/a><\/div><\/div>$/);
});

test('an id or label cannot break out of its attribute', () => {
  const html = contentsRailHtml([{ id: 'a"onmouseover="x', text: 't', level: 2 }, { id: 'b', text: 'u', level: 2 }], { ...labels, title: 'On "this" page' });
  assert.ok(!/"onmouseover=/.test(html));
  assert.match(html, /aria-label="On &quot;this&quot; page"/);
});
