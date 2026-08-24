// SPDX-License-Identifier: MPL-2.0
/**
 * deriveExportFilename (engine/src/inputs.ts) - content-derived export filenames
 * (plans/140 S1). A manifest's render.filenameFrom lists input ids whose VALUES
 * name the exported file; the helper slugifies them in order and callers keep
 * their tool-name/tool-id fallback when it returns null.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveExportFilename } from '../engine/src/inputs.ts';

const m = (ids?: unknown) => ({ render: ids === undefined ? {} : { filenameFrom: ids } });

test('opts out without filenameFrom (and on empty/invalid declarations)', () => {
  assert.equal(deriveExportFilename({}, { a: 'x' }), null);
  assert.equal(deriveExportFilename(m(undefined), { a: 'x' }), null);
  assert.equal(deriveExportFilename(m([]), { a: 'x' }), null);
  assert.equal(deriveExportFilename(m('a'), { a: 'x' }), null);
});

test('joins listed values in declaration order, slugified', () => {
  assert.equal(
    deriveExportFilename(m(['firstname', 'lastname']), { firstname: 'Ana', lastname: 'Kovač', company: 'SUSE' }),
    'ana-kovac',
  );
});

test('empty and missing values are skipped; all-empty falls back to null', () => {
  assert.equal(deriveExportFilename(m(['a', 'b']), { a: '', b: 'Rivera' }), 'rivera');
  assert.equal(deriveExportFilename(m(['a', 'b']), {}), null);
  assert.equal(deriveExportFilename(m(['a']), { a: '   ' }), null);
});

test('a URL value names by host + path', () => {
  assert.equal(deriveExportFilename(m(['url']), { url: 'https://suse.com/events' }), 'suse-com-events');
  assert.equal(deriveExportFilename(m(['url']), { url: 'https://suse.com/' }), 'suse-com');
  // Not a parseable URL - slugified as plain text.
  assert.equal(deriveExportFilename(m(['url']), { url: 'not a url' }), 'not-a-url');
});

test('object values (asset refs, blocks) are skipped, never stringified', () => {
  assert.equal(deriveExportFilename(m(['logo', 'name']), { logo: { id: 'suse/logo/x' }, name: 'Ana' }), 'ana');
});

test('length is bounded and never ends in a dash', () => {
  const long = deriveExportFilename(m(['a']), { a: 'x'.repeat(200) })!;
  assert.ok(long.length <= 80);
  const joined = deriveExportFilename(m(['a', 'b']), { a: 'y'.repeat(60), b: 'z'.repeat(60) })!;
  assert.ok(joined.length <= 80);
  assert.ok(!joined.endsWith('-'));
});

test('numbers and booleans stringify; punctuation collapses to single dashes', () => {
  assert.equal(deriveExportFilename(m(['n', 's']), { n: 42, s: 'Q3 — Pipeline!' }), '42-q3-pipeline');
});
