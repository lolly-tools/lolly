// SPDX-License-Identifier: MPL-2.0
/**
 * Pins the canonical HTML-escaping behavior. Every interpolation into an HTML
 * string (element text or double/single-quoted attribute values) relies on
 * exactly this mapping, so it is contract, not implementation detail.
 * Run directly:  node --experimental-strip-types --test shells/web/src/utils.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escape } from './utils.ts';

test('escape: replaces the five HTML-special characters', () => {
  assert.equal(escape('&'), '&amp;');
  assert.equal(escape('<'), '&lt;');
  assert.equal(escape('>'), '&gt;');
  assert.equal(escape('"'), '&quot;');
  assert.equal(escape("'"), '&#39;');
  assert.equal(
    escape(`<img src="x" onerror='alert(1)' & co>`),
    '&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39; &amp; co&gt;',
  );
});

test('escape: passes ordinary text through untouched', () => {
  assert.equal(escape('SUSE — Open. Für alle. 100%'), 'SUSE — Open. Für alle. 100%');
  assert.equal(escape('`backticks` stay'), '`backticks` stay');
});

test('escape: ampersands are not double-escaped structurally', () => {
  // Each source char maps once; pre-escaped text IS re-escaped (by design).
  assert.equal(escape('&amp;'), '&amp;amp;');
});

test('escape: nullish and non-string inputs coerce like String()', () => {
  assert.equal(escape(null), '');
  assert.equal(escape(undefined), '');
  assert.equal(escape(0), '0');
  assert.equal(escape(false), 'false');
});
