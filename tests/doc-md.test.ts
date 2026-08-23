// SPDX-License-Identifier: MPL-2.0
/**
 * Tests for engine/src/doc-md.ts - the two serialisers over the shared block
 * model (plan 139 WP4).
 *
 * The markdown side pins the dialect decisions: atx headings, two-space list
 * indent, `1.` for every ordered item, pipe tables with `\|` escaping, an
 * inline HTML table when a cell merges, a synthesised empty header row, `[^n]`
 * footnotes, and underline dropping to plain text.
 *
 * The HTML side pins the escape-first discipline: user text is escaped BEFORE a
 * tag wraps it, so a run containing markup or a quote character cannot emit a
 * live element or break out of an attribute, and a URL scheme outside the
 * allowlist loses its href entirely.
 *
 * Run with: node --test tests/doc-md.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mdFromBlocks, htmlFromBlocks } from '../engine/src/doc-md.ts';
import type { DocBlock, DocInline } from '../engine/src/doc-model.ts';

const t = (text: string): DocInline => ({ type: 'text', text });

// ─── markdown ────────────────────────────────────────────────────────────────

test('headings clamp to 1..6 and print as atx', () => {
  const md = mdFromBlocks([
    { type: 'heading', level: 1, inlines: [t('One')] },
    { type: 'heading', level: 3, inlines: [t('Three')] },
    { type: 'heading', level: 99, inlines: [t('Deep')] },
    { type: 'heading', level: 0, inlines: [t('Shallow')] },
  ]);
  assert.equal(md, '# One\n\n### Three\n\n###### Deep\n\n# Shallow');
});

test('lists indent two spaces per level and ordered items all print 1.', () => {
  const md = mdFromBlocks([
    {
      type: 'list',
      ordered: false,
      items: [
        { level: 0, inlines: [t('Alpha')] },
        { level: 1, inlines: [t('Nested')] },
        { level: 0, inlines: [t('Beta')] },
      ],
    },
    {
      type: 'list',
      ordered: true,
      items: [
        { level: 0, inlines: [t('First')] },
        { level: 0, inlines: [t('Second')] },
      ],
    },
  ]);
  assert.equal(md, '- Alpha\n  - Nested\n- Beta\n\n1. First\n1. Second');
});

test('emphasis maps to GFM and underline drops to plain text', () => {
  const md = mdFromBlocks([
    {
      type: 'para',
      inlines: [
        { type: 'strong', inlines: [t('bold')] },
        t(' '),
        { type: 'em', inlines: [t('italic')] },
        t(' '),
        { type: 'strike', inlines: [t('struck')] },
        t(' '),
        { type: 'underline', inlines: [t('under')] },
        t(' '),
        { type: 'code', text: 'a*b' },
      ],
    },
  ]);
  assert.equal(md, '**bold** *italic* ~~struck~~ under `a*b`');
});

test('a pipe inside a cell is escaped so the table survives', () => {
  const md = mdFromBlocks([
    {
      type: 'table',
      header: [{ inlines: [t('A')] }, { inlines: [t('B')] }],
      rows: [[{ inlines: [t('a|b')] }, { inlines: [t('c')] }]],
    },
  ]);
  assert.equal(md, '| A | B |\n| --- | --- |\n| a\\|b | c |');
});

test('a headerless table gets an empty header row (GFM needs one)', () => {
  const md = mdFromBlocks([
    {
      type: 'table',
      rows: [
        [{ inlines: [t('a1')] }, { inlines: [t('b1')] }],
        [{ inlines: [t('a2')] }, { inlines: [t('b2')] }],
      ],
    },
  ]);
  assert.equal(md, '|  |  |\n| --- | --- |\n| a1 | b1 |\n| a2 | b2 |');
});

test('a spanned table becomes inline HTML, the only tag markdown emits', () => {
  const md = mdFromBlocks([
    {
      type: 'table',
      header: [{ inlines: [t('Wide')], colspan: 2 }, { inlines: [t('C')] }],
      rows: [[{ inlines: [t('Tall')], rowspan: 2 }, { inlines: [t('b')] }, { inlines: [t('c')] }]],
      htmlSpans: true,
    },
  ]);
  assert.equal(
    md,
    '<table><thead><tr><th colspan="2">Wide</th><th>C</th></tr></thead>' +
      '<tbody><tr><td rowspan="2">Tall</td><td>b</td><td>c</td></tr></tbody></table>',
  );
});

test('a span discovered on a cell forces the HTML table even without htmlSpans', () => {
  const md = mdFromBlocks([
    { type: 'table', rows: [[{ inlines: [t('x')], colspan: 3 }]] },
  ]);
  assert.match(md, /^<table>/);
  assert.match(md, /colspan="3"/);
});

test('footnotes, images and quotes print in their GFM forms', () => {
  const md = mdFromBlocks([
    { type: 'para', inlines: [t('Claim'), { type: 'footnoteRef', id: '1' }] },
    { type: 'image', ref: 'media/1.png', alt: 'A green lolly' },
    { type: 'quote', inlines: [t('Quoted line')] },
    { type: 'code', lang: 'ts', text: 'const a = 1;' },
    { type: 'footnote', id: '1', inlines: [t('The note body.')] },
  ]);
  assert.equal(
    md,
    'Claim[^1]\n\n![A green lolly](media/1.png)\n\n> Quoted line\n\n' +
      '```ts\nconst a = 1;\n```\n\n[^1]: The note body.',
  );
});

test('a paragraph that begins with a block marker is neutralised', () => {
  const md = mdFromBlocks([
    { type: 'para', inlines: [t('1. Introduction')] },
    { type: 'para', inlines: [t('# not a heading')] },
    { type: 'para', inlines: [t('- not a list')] },
  ]);
  assert.equal(md, '\\1. Introduction\n\n\\# not a heading\n\n\\- not a list');
});

test('a link with a rejected scheme keeps its text and loses the destination', () => {
  const md = mdFromBlocks([
    {
      type: 'para',
      inlines: [
        { type: 'link', href: 'javascript:alert(1)', inlines: [t('click')] },
        t(' and '),
        { type: 'link', href: 'https://www.suse.com/', inlines: [t('SUSE')] },
      ],
    },
  ]);
  assert.equal(md, 'click and [SUSE](https://www.suse.com/)');
});

test('markdown output is never throwing on a malformed block list', () => {
  const bad = [null, undefined, {}, { type: 'nope' }, { type: 'para' }] as unknown as DocBlock[];
  assert.equal(mdFromBlocks(bad), '');
  assert.equal(mdFromBlocks(null as unknown as DocBlock[]), '');
});

// ─── HTML ────────────────────────────────────────────────────────────────────

test('every run is escaped before a tag wraps it', () => {
  const html = htmlFromBlocks([
    {
      type: 'para',
      inlines: [
        { type: 'strong', inlines: [t('<script>alert("x")</script>')] },
        t(" it's & done"),
      ],
    },
  ]);
  assert.equal(
    html,
    '<p><strong>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</strong> it&#39;s &amp; done</p>',
  );
  assert.ok(!html.includes('<script'), 'no live script tag may survive');
});

test('an attribute-breaking quote in a link cannot escape the href', () => {
  const html = htmlFromBlocks([
    {
      type: 'para',
      inlines: [
        { type: 'link', href: 'https://x.test/?a="b onmouseover=alert(1)', inlines: [t('q"uote')] },
      ],
    },
  ]);
  assert.equal(
    html,
    '<p><a href="https://x.test/?a=&quot;b onmouseover=alert(1)">q&quot;uote</a></p>',
  );
  assert.ok(!/href="[^"]*"\s+onmouseover/.test(html), 'the attribute must not break out');
});

test('a javascript: href is dropped and the label survives as text', () => {
  const html = htmlFromBlocks([
    { type: 'para', inlines: [{ type: 'link', href: 'java\tscript:alert(1)', inlines: [t('click')] }] },
  ]);
  assert.equal(html, '<p>click</p>');
});

test('an image keeps a data: URI but refuses another scheme', () => {
  const ok = htmlFromBlocks([{ type: 'image', ref: 'data:image/png;base64,AAAA', alt: 'a' }]);
  assert.equal(ok, '<img src="data:image/png;base64,AAAA" alt="a">');
  const no = htmlFromBlocks([{ type: 'image', ref: 'javascript:alert(1)', alt: 'a' }]);
  assert.equal(no, '');
});

test('lists nest by level in HTML', () => {
  const html = htmlFromBlocks([
    {
      type: 'list',
      ordered: false,
      items: [
        { level: 0, inlines: [t('a')] },
        { level: 1, inlines: [t('b')] },
        { level: 0, inlines: [t('c')] },
      ],
    },
  ]);
  assert.equal(html, '<ul><li>a<ul><li>b</li></ul></li><li>c</li></ul>');
});

test('spans stay real colspan/rowspan attributes in HTML', () => {
  const html = htmlFromBlocks([
    {
      type: 'table',
      header: [{ inlines: [t('H')], colspan: 2 }],
      rows: [[{ inlines: [t('r')], rowspan: 3 }, { inlines: [t('s')] }]],
      htmlSpans: true,
    },
  ]);
  assert.equal(
    html,
    '<table><thead><tr><th colspan="2">H</th></tr></thead>' +
      '<tbody><tr><td rowspan="3">r</td><td>s</td></tr></tbody></table>',
  );
});

test('headings, quotes, code and footnotes have HTML forms', () => {
  const html = htmlFromBlocks([
    { type: 'heading', level: 2, inlines: [t('Head')] },
    { type: 'quote', inlines: [t('Quoted')] },
    { type: 'code', lang: 'ts', text: 'a < b' },
    { type: 'para', inlines: [t('Claim'), { type: 'footnoteRef', id: '1' }] },
    { type: 'footnote', id: '1', inlines: [t('Body')] },
  ]);
  assert.equal(
    html,
    '<h2>Head</h2><blockquote><p>Quoted</p></blockquote>' +
      '<pre><code class="language-ts">a &lt; b</code></pre>' +
      '<p>Claim<sup><a href="#fn-1">1</a></sup></p>' +
      '<p class="footnote" id="fn-1"><sup>1</sup> Body</p>',
  );
});

test('HTML output never throws on a malformed block list', () => {
  const bad = [null, undefined, { type: 'nope' }, { type: 'list' }] as unknown as DocBlock[];
  assert.equal(htmlFromBlocks(bad), '<ul></ul>');
  assert.equal(htmlFromBlocks(null as unknown as DocBlock[]), '');
});
