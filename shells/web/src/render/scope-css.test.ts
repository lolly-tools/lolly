// SPDX-License-Identifier: MPL-2.0
// Contract tests for the real CSS scoper (finding 3: the old regex version
// corrupted nested rules — anything following a nested closing brace — and
// forced tool-side workarounds in digi-ad hooks and strip-data styles).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scopeCss } from './scope-css.ts';

// Collapse whitespace so structural assertions aren't byte-brittle.
const flat = (s: string): string => s.replace(/\s+/g, ' ').trim();

test('scopes a plain rule', () => {
  assert.equal(flat(scopeCss('h1 { color: red; }', '#s')), '#s h1 { color: red; }');
});

test('scopes every selector in a comma list', () => {
  assert.equal(
    flat(scopeCss('h1, .card > p { color: red; }', '#s')),
    '#s h1, #s .card > p { color: red; }',
  );
});

test('does not split on commas inside functional selectors', () => {
  assert.equal(
    flat(scopeCss(':is(h1, h2) { color: red; }', '#s')),
    '#s :is(h1, h2) { color: red; }',
  );
});

test('scopes rules inside @media without touching the prelude', () => {
  const out = scopeCss('@media (min-width: 600px) { h1 { color: red; } .b { x: y; } }', '#s');
  assert.equal(flat(out), '@media (min-width: 600px) { #s h1 { color: red; } #s .b { x: y; } }');
});

test('REGRESSION: a rule following a nested closing brace is scoped exactly once', () => {
  // The old regex treated "} .after" as its next selector boundary and also
  // corrupted the first rule after an at-rule block. Modeled on the
  // strip-data styles.css workaround (@media (prefers-color-scheme: dark)).
  const css = `
.exif-dm-anchor { color: inherit; }
@media (prefers-color-scheme: dark) {
  .exif { color: #e7e9ec; background: #15171c; }
  .exif-empty p { color: #9aa3ad; }
}
.after { color: blue; }`;
  const out = scopeCss(css, '#s');
  assert.match(out, /#s \.exif-dm-anchor/);
  assert.match(out, /#s \.exif \{/);
  assert.match(out, /#s \.exif-empty p/);
  assert.match(out, /#s \.after/);
  assert.doesNotMatch(out, /#s #s/);
  assert.doesNotMatch(out, /#s @media/);
});

test('recurses through @supports and @container', () => {
  const out = scopeCss('@supports (display: grid) { @container (min-width: 1px) { .a { x: y; } } }', '#s');
  assert.equal(flat(out), '@supports (display: grid) { @container (min-width: 1px) { #s .a { x: y; } } }');
});

test('REGRESSION: @keyframes frame selectors are never scoped (digi-ad workaround)', () => {
  const css = `@keyframes slide-in {
  0% { opacity: 0; transform: translateX(-10px); }
  50% { opacity: 0.5; }
  100% { opacity: 1; transform: none; }
}
.uses { animation: slide-in 1s; }`;
  const out = scopeCss(css, '#s');
  assert.match(out, /0% \{ opacity: 0/);
  assert.match(out, /50% \{ opacity: 0\.5/);
  assert.match(out, /100% \{ opacity: 1/);
  assert.doesNotMatch(out, /#s 0%/);
  assert.doesNotMatch(out, /#s 50%/);
  assert.doesNotMatch(out, /#s 100%/);
  assert.match(out, /#s \.uses/);
});

test('leaves @font-face, @page and @property untouched', () => {
  const css = `@font-face { font-family: "X"; src: url(x.woff2); }
@page { margin: 1cm; }
@property --p { syntax: "<length>"; inherits: false; initial-value: 0px; }`;
  const out = scopeCss(css, '#s');
  assert.equal(flat(out), flat(css));
});

test('leaves statement at-rules (@import, @charset) untouched but still scopes what follows', () => {
  const out = scopeCss(`@import url("x.css"); h1 { color: red; }`, '#s');
  assert.match(out, /@import url\("x\.css"\);/);
  assert.match(out, /#s h1/);
});

test('braces inside strings and url() do not confuse the parser', () => {
  const css = `.a { background: url("img{1}.png"); content: "}{"; }
.b { color: red; }`;
  const out = scopeCss(css, '#s');
  assert.match(out, /#s \.a/);
  assert.match(out, /url\("img\{1\}\.png"\)/);
  assert.match(out, /content: "\}\{"/);
  assert.match(out, /#s \.b/);
});

test('braces inside comments do not confuse the parser', () => {
  const css = `/* a comment with { braces } */ .a { color: red; } /* } */ .b { color: blue; }`;
  const out = scopeCss(css, '#s');
  assert.match(out, /#s \.a/);
  assert.match(out, /#s \.b/);
  assert.doesNotMatch(out, /#s \/\*/);
});

test('nested CSS (& rules) stays inside its scoped parent untouched', () => {
  const css = `.card { color: red; & .title { color: blue; } }`;
  const out = scopeCss(css, '#s');
  assert.match(flat(out), /#s \.card \{ color: red; & \.title \{ color: blue; \} \}/);
});

test(':root, html and body map to the scope root itself', () => {
  assert.equal(flat(scopeCss(':root { --x: 1; }', '#s')), '#s { --x: 1; }');
  assert.equal(flat(scopeCss('html { font-size: 16px; }', '#s')), '#s { font-size: 16px; }');
  assert.equal(flat(scopeCss('body h1 { color: red; }', '#s')), '#s h1 { color: red; }');
  assert.equal(flat(scopeCss('body.dark .x { color: red; }', '#s')), '#s.dark .x { color: red; }');
});

test('every declaration survives a full round-trip of a realistic sheet', () => {
  const css = `
:root { --brand: #30ba78; }
.header, .footer { padding: 4px; }
@media (max-width: 500px) {
  .header { padding: 2px; }
  @supports (gap: 1px) { .grid { gap: 1px; } }
}
@keyframes pulse { from { opacity: 0; } to { opacity: 1; } }
.card { background: var(--brand); animation: pulse 1s; }`;
  const out = scopeCss(css, '.canvas');
  for (const decl of ['--brand: #30ba78', 'padding: 4px', 'padding: 2px', 'gap: 1px', 'opacity: 0', 'opacity: 1', 'background: var(--brand)', 'animation: pulse 1s']) {
    assert.ok(out.includes(decl), `lost declaration: ${decl}`);
  }
  assert.match(out, /\.canvas \.header, \.canvas \.footer/);
  assert.match(out, /from \{ opacity: 0/);
});
