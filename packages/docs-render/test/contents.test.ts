// SPDX-License-Identifier: MPL-2.0
// The page's contents (contents.ts): the rail and the page bar both readers ship.
// Run: node --test packages/docs-render/test/contents.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasContents, contentsRailHtml, pageBarHtml, type ContentsHeading } from '../src/index.ts';

const labels = { title: 'On this page' };
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

const bar = (o: Partial<Parameters<typeof pageBarHtml>[0]> = {}) => pageBarHtml({
  section: 'Create', page: 'Export a file', headings: heads,
  labels: { title: 'On this page', sections: 'Documentation sections' },
  sectionsHtml: '<a class="docs-pathway active" href="/info/creators.html" aria-current="true">Create</a>',
  pages: { title: 'Create', html: '<div class="docs-compact-list"><a class="active" href="/info/create/exporting.html">Export a file</a></div>' },
  chevron: '<svg></svg>', ...o,
});

test('the page bar names the section and the page, and its sheet starts closed', () => {
  const html = bar();
  assert.match(html, /^<div class="doc-pagebar" data-doc-contents><button type="button" class="doc-contents-btn doc-pagebar-btn" aria-expanded="false" aria-controls="docContentsPanel">/);
  assert.match(html, /<span class="doc-pagebar-section">Create<\/span><span class="doc-pagebar-chev" aria-hidden="true"><svg><\/svg><\/span><span class="doc-pagebar-page">Export a file<\/span><\/button>/);
  assert.match(html, /<div class="doc-contents-panel" id="docContentsPanel" hidden>/);
});

test('the sheet holds the sections, this page\'s sections (not subsections) and the pages, in that order', () => {
  const html = bar();
  const at = (re: RegExp) => html.search(re);
  assert.ok(at(/class="doc-sheet-sections" aria-label="Documentation sections"/) > 0);
  assert.ok(at(/aria-label="On this page"/) > at(/doc-sheet-sections/), 'the headings come after the sections');
  assert.ok(at(/aria-label="Create"><p class="doc-contents-title"/) > at(/aria-label="On this page"/), 'the pages come after the headings');
  assert.ok(!/data-contents-target="colours"/.test(html), 'a subsection reached the phone sheet');
  assert.match(html, /data-contents-target="download"/);
});

test('a hub page shows its section once, and a page with one section has no headings group', () => {
  assert.ok(!/doc-pagebar-page/.test(bar({ page: 'Create' })), 'the hub read "Create v Create"');
  const one = bar({ headings: heads.slice(0, 2) });
  assert.ok(!/aria-label="On this page"/.test(one));
  assert.match(one, /doc-sheet-sections/, 'the sections stay even with no headings');
});

test('an id or label cannot break out of its attribute', () => {
  const html = contentsRailHtml([{ id: 'a"onmouseover="x', text: 't', level: 2 }, { id: 'b', text: 'u', level: 2 }], { ...labels, title: 'On "this" page' });
  assert.ok(!/"onmouseover=/.test(html));
  assert.match(html, /aria-label="On &quot;this&quot; page"/);
});
