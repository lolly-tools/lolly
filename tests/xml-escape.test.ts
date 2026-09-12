// SPDX-License-Identifier: MPL-2.0
/**
 * Pins escapeXml: the one XML text/attribute escaper shared by the document
 * writers (EPUB, ODT, AppStream). It must escape exactly the five entities
 * XML 1.0 names - no more, no less - because those writers rely on it to
 * produce well-formed XML from arbitrary user text (titles, descriptions,
 * author names) without also stripping control characters, which is a
 * separate, stricter concern left to the callers that need it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeXml } from '../engine/src/xml-escape.ts';

test('escapes the five XML 1.0 entities', () => {
  assert.equal(escapeXml('& < > " \''), '&amp; &lt; &gt; &quot; &apos;');
});

test('leaves ordinary text untouched', () => {
  assert.equal(escapeXml('Hello, world!'), 'Hello, world!');
});

test('escapes ampersand before the other four entities, so a literal < is not double-escaped', () => {
  // If '<' were escaped before '&', the '&lt;' it produces would then have its own
  // '&' escaped too, corrupting the output to '&amp;lt;&amp;' instead of '&lt;&amp;'.
  assert.equal(escapeXml('<&'), '&lt;&amp;');
  // Literal text that merely looks like an entity is not treated as already escaped -
  // its '&' still becomes '&amp;' regardless of ordering.
  assert.equal(escapeXml('&lt;'), '&amp;lt;');
});

test('escapes repeated occurrences, not just the first', () => {
  assert.equal(escapeXml('<<<'), '&lt;&lt;&lt;');
  assert.equal(escapeXml('"a" & "b"'), '&quot;a&quot; &amp; &quot;b&quot;');
});

test('empty string round-trips to empty string', () => {
  assert.equal(escapeXml(''), '');
});

test('does not touch control characters or non-ASCII text', () => {
  // Callers that need to also strip control chars (SCORM, Markdown docs) keep
  // their own stricter variant on purpose - this function must not do it for them.
  assert.equal(escapeXml('a\u0000b\tc'), 'a\u0000b\tc');
  assert.equal(escapeXml('café <em>naïve</em>'), 'café &lt;em&gt;naïve&lt;/em&gt;');
});
