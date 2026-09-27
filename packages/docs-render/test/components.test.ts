// SPDX-License-Identifier: MPL-2.0
// Reading components (plan 277 step 3): the allowlisted ::: note|warning|check|details
// directives, the fence info string, the attribute escaper and the markdown twin.
// Run: node --test packages/docs-render/test/components.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mdToHtml, escAttr, parseComponentFence, parseFenceInfo, detailsBlock, noteBlock, unwrapComponentFences, mdDescription, hasCopyBlock,
  type DocsRenderContext,
} from '../src/index.ts';

function ctx(overrides: Partial<DocsRenderContext> = {}): DocsRenderContext {
  let seq = 0;
  return {
    lang: 'en', htmlLang: 'en', t: (en) => en,
    docIcon: (key) => `<i data-icon="${key}"></i>`, docLogo: () => '', docLogoBlock: () => '',
    nextCredId: () => `shot-cred-${++seq}`, localizedShot: () => null, darkShot: () => null, shotSize: () => null,
    credential: () => null, tryLink: () => null, showcase: () => null, art: () => null,
    ...overrides,
  } as DocsRenderContext;
}

test('escAttr escapes all five characters an attribute needs', () => {
  assert.equal(escAttr(`a"b'c<d>e&f`), 'a&quot;b&#39;c&lt;d&gt;e&amp;f');
});

test('a component fence parses its kind and title; anything else is not a component', () => {
  assert.deepEqual(parseComponentFence('note Saved in this browser'), { kind: 'note', title: 'Saved in this browser' });
  assert.deepEqual(parseComponentFence('details  More about folders '), { kind: 'details', title: 'More about folders' });
  assert.deepEqual(parseComponentFence('warning'), { kind: 'warning', title: '' });
  assert.equal(parseComponentFence('cols'), null);
  assert.equal(parseComponentFence('notes Title'), null);
  assert.equal(parseComponentFence('nota Título'), null, 'a translated keyword is not a component');
});

test('the fence info string keeps a safe language token and allowlisted flags only', () => {
  assert.deepEqual(parseFenceInfo('bash'), { lang: 'bash', flags: new Set() });
  assert.deepEqual(parseFenceInfo(' bash no-copy wrap bogus '), { lang: 'bash', flags: new Set(['no-copy', 'wrap']) });
  assert.equal(parseFenceInfo('js" onmouseover="x').lang, '', 'a quote never reaches the class attribute');
  assert.equal(parseFenceInfo('').lang, '');
});

test('a note renders as role=note with its glyph, a hidden kind word, a title that is not a paragraph, and its body', () => {
  const html = mdToHtml('::: warning Clearing site data removes saved work\nExport a backup **first**.\n:::', ctx());
  assert.match(html, /^<div class="doc-note doc-note--warning" role="note">/);
  assert.match(html, /<span class="doc-note-glyph" aria-hidden="true"><i data-icon="adm-alert"><\/i><\/span>/);
  assert.match(html, /<div class="doc-note-title"><span class="doc-visually-hidden">Warning: <\/span>Clearing site data removes saved work<\/div>/);
  assert.match(html, /<div class="doc-note-body"><p>Export a backup <strong>first<\/strong>\.<\/p><\/div>/);
  assert.ok(!/<aside/.test(html), 'no complementary landmark in either host');
  assert.ok(!/<p[^>]*>[^<]*Clearing/.test(html), 'the title is not a <p>, so narration ids after it stay put');
});

test('the kind word is translated through the render context', () => {
  const html = mdToHtml('::: note Vorher\nText.\n:::', ctx({ t: (en) => (en === 'Note' ? 'Hinweis' : en) }));
  assert.match(html, /<span class="doc-visually-hidden">Hinweis: <\/span>/);
});

test('a disclosure is a native details element with a stable id, icon and chevron slots', () => {
  const html = mdToHtml('::: details Organise with folders\nFolders nest.\n:::', ctx());
  assert.equal(html,
    '<details class="doc-details" id="organise-with-folders"><summary>'
    + '<span class="doc-details-glyph" aria-hidden="true"><i data-icon="adm-more"></i></span>'
    + '<span class="doc-details-title">Organise with folders</span>'
    + '<span class="doc-details-chev" aria-hidden="true"><i data-icon="adm-chevron"></i></span></summary>'
    + '<div class="doc-details-body"><p>Folders nest.</p></div></details>');
  assert.ok(!/aria-expanded/.test(html), 'the open state lives in the element, not a second flag');
});

test('a disclosure whose title has no Latin letters gets its own positional id, not a heading ordinal', () => {
  const html = mdToHtml('## 概要\n\n::: details 詳細\n本文。\n:::\n\n## 次へ', ctx());
  assert.match(html, /<details class="doc-details" id="details-1">/);
  assert.match(html, /<h2 id="section-1">/);
  assert.match(html, /<h2 id="section-2">/, 'the heading after the disclosure keeps its ordinal');
});

test('builder output stays attribute-safe for a hostile id', () => {
  const html = detailsBlock({ id: 'a" onclick="x', titleHtml: 't', bodyHtml: 'b', glyph: '', chevron: '' });
  assert.match(html, /id="a&quot; onclick=&quot;x"/);
  assert.match(noteBlock({ kind: 'check', kindWord: 'Check', titleHtml: 'Done', bodyHtml: '', glyph: '' }), /doc-note--check/);
});

test('a component needs a title and refuses a heading in its body', () => {
  assert.throws(() => mdToHtml('::: note\nBody.\n:::', ctx()), /needs a title/);
  assert.throws(() => mdToHtml('::: details More\n## Not here\n:::', ctx()), /contains a heading/);
  // A heading-like line inside a code sample is code, not a heading.
  assert.doesNotThrow(() => mdToHtml('::: note Example\n```bash\n# a shell comment\n```\n:::', ctx()));
});

test('an unknown directive still renders its body, and says so at build time', (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  const html = mdToHtml('::: nota Título\nCuerpo.\n:::', ctx());
  assert.equal(html, '<p>Cuerpo.</p>');
  assert.equal(warn.mock.callCount(), 1);
  assert.match(String(warn.mock.calls[0]!.arguments[0]), /unknown ::: directive "nota Título"/);
});

test('the known directives render exactly as before, with no warning', (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  mdToHtml('::: timeline\n- a\n:::\n\n::: cols\n## A\nx\n## B\ny\n:::', ctx());
  assert.equal(warn.mock.callCount(), 0);
});

test('the markdown twin keeps every title and body and drops the fence lines', () => {
  const md = [
    'Intro.',
    '',
    '::: warning Clearing site data removes saved work',
    'Export a backup first.',
    ':::',
    '',
    '::: details Organise with folders',
    'Folders nest.',
    '',
    '```bash',
    ':::',
    '```',
    ':::',
    '',
    '::: figure trust-chain',
    'Caption.',
    ':::',
  ].join('\n');
  assert.equal(unwrapComponentFences(md), [
    'Intro.',
    '',
    '**Warning: Clearing site data removes saved work**',
    '',
    'Export a backup first.',
    '',
    '**Organise with folders**',
    '',
    'Folders nest.',
    '',
    '```bash',
    ':::',
    '```',
    '',
    '::: figure trust-chain',
    'Caption.',
    ':::',
  ].join('\n'));
});

test('a page description never starts from a directive line', () => {
  assert.equal(mdDescription('::: note Before you start\nOpen a terminal.\n:::\n\nMake a file from a command.'), 'Make a file from a command.');
});

test('a page whose only copyable blocks are shell commands still counts as having Copy', () => {
  // The static build carries the Copy words (translated labels, the glyph, the denial
  // help) only on pages this says yes to; shell blocks mark themselves differently.
  assert.equal(hasCopyBlock(mdToHtml('```bash\npnpm install\n```', ctx())), true);
  assert.equal(hasCopyBlock(mdToHtml('```js\nconst x = 1;\n```', ctx())), true);
  assert.equal(hasCopyBlock(mdToHtml('```text\nplain\n```\n\nNo code.', ctx())), false);
  assert.equal(hasCopyBlock('<button data-copy-src="a">'), false, 'another feature\'s attribute is not the marker');
});
