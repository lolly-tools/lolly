// SPDX-License-Identifier: MPL-2.0
/**
 * The pure halves of the shell CSS editor (plan 112 M4): the tokenizer and the
 * autocomplete matcher. No DOM. Run directly: node --test shells/web/src/lib/css-code-editor.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { highlightCss, cssCompletions, CSS_PROPERTIES } from './css-code-editor.ts';

test('highlightCss: escapes HTML - never emits raw markup', () => {
  const html = highlightCss('.x { content: "</style><script>"; }');
  assert.ok(!html.includes('<script>'), 'no raw <script>');
  assert.ok(!html.includes('</style>'), 'no raw </style>');
  assert.ok(html.includes('&lt;script&gt;'), 'the angle brackets are escaped');
});

test('highlightCss: comments, strings, numbers, hex get their token class', () => {
  assert.match(highlightCss('/* hi */'), /tk-com/);
  assert.match(highlightCss('a { content: "x" }'), /tk-str/);
  assert.match(highlightCss('a { top: 12px }'), /tk-num/);
  assert.match(highlightCss('a { color: #30ba78 }'), /class="tk-num"[^<]*#30ba78/);
});

test('highlightCss: property vs selector vs value by block context', () => {
  const html = highlightCss('.card { color: red; }');
  // `.card` (before {) is a selector; `color` (before :) a property; `red` a value.
  assert.match(html, /tk-sel"[^>]*>card/);
  assert.match(html, /tk-prop"[^>]*>color/);
  assert.match(html, /tk-val"[^>]*>red/);
});

test('highlightCss: @keyframes block holds selectors, not properties', () => {
  const html = highlightCss('@keyframes spin { from { transform: rotate(0) } }');
  assert.match(html, /tk-at"[^>]*>@keyframes/);
  // `from` inside the keyframes rule-block is a selector (rule block), not a property.
  assert.match(html, /tk-sel"[^>]*>from/);
  // `transform` inside the nested decl block IS a property.
  assert.match(html, /tk-prop"[^>]*>transform/);
});

test('highlightCss: a function name is coloured as a function', () => {
  assert.match(highlightCss('a { transform: rotate(10deg) }'), /tk-fn"[^>]*>rotate/);
});

test('highlightCss: !important + custom properties', () => {
  assert.match(highlightCss('a { color: red !important }'), /tk-kw"[^>]*>!important/);
  assert.match(highlightCss(':root { --gap: 8px }'), /tk-prop"[^>]*>--gap/);
});

test('cssCompletions: property-name prefix match', () => {
  const c = cssCompletions('.x { colo');
  assert.ok(c, 'has completions');
  assert.equal(c!.kind, 'property');
  assert.equal(c!.token, 'colo');
  assert.ok(c!.options.includes('color'));
  assert.ok(c!.options.every((o) => o.startsWith('colo')));
});

test('cssCompletions: value hints for a known property', () => {
  const c = cssCompletions('.x { display: fl');
  assert.ok(c, 'has value completions');
  assert.equal(c!.kind, 'value');
  assert.equal(c!.token, 'fl');
  assert.ok(c!.options.includes('flex'));
});

test('cssCompletions: global values offered in a value context', () => {
  const c = cssCompletions('.x { color: inhe');
  assert.ok(c);
  assert.ok(c!.options.includes('inherit'));
});

test('cssCompletions: nothing to offer → null (empty token, unknown junk)', () => {
  assert.equal(cssCompletions('.x { '), null);       // no token yet
  assert.equal(cssCompletions('.x { display: zzzz'), null); // no matching value hint
});

test('CSS_PROPERTIES: sane, de-duplicated, all lowercase idents', () => {
  assert.ok(CSS_PROPERTIES.length > 120, 'a useful vocabulary');
  assert.equal(new Set(CSS_PROPERTIES).size, CSS_PROPERTIES.length, 'no duplicates');
  assert.ok(CSS_PROPERTIES.every((p) => /^[a-z-]+$/.test(p)), 'lowercase kebab idents only');
});
