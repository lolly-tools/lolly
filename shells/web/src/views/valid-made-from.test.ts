// SPDX-License-Identifier: MPL-2.0
/**
 * Verify's "Made from" panel. An export credential records menu, number, switch and
 * colour choices as readable values and typed text as a `sha256:` fingerprint
 * (engine summarizeInputDigests). The panel prints the choices as they are, says
 * "Text, fingerprinted" for a fingerprint with the hash kept for hover, and adds one
 * line on why the words are not in the file.
 *
 *   node --import ./tests/css-stub.mjs --test shells/web/src/views/valid-made-from.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inputsDigestHtml, seedValuesFromDigest } from './valid-made-from.ts';

const hash = `sha256:${'ab'.repeat(32)}`;

test('choices read as themselves and a fingerprint reads in words', () => {
  const html = inputsDigestHtml({ backdrop: 'depth', glow: '0.45', pedestal: 'false', colorA: '#033633', title: hash });
  for (const value of ['depth', '0.45', 'false', '#033633']) assert.match(html, new RegExp(`<span>${value}</span>`));
  assert.match(html, /valid-input-swatch" style="background:#033633"/);
  assert.match(html, /<dt>title<\/dt><dd><span class="valid-input-fingerprint" title="sha256:(ab){32}">Text, fingerprinted<\/span>/);
  assert.doesNotMatch(html.replace(/title="sha256:[0-9a-f]+"/, ''), /sha256:/, 'the hash appears only in the hover title');
  assert.match(html, /class="valid-input-note">Typed text is recorded only as a fingerprint/);
});

test('a record with no fingerprints carries no fingerprint note', () => {
  assert.doesNotMatch(inputsDigestHtml({ backdrop: 'depth' }), /valid-input-note/);
  assert.equal(inputsDigestHtml({}), '');
});

test('Recreate reads choices back by type and leaves fingerprinted text to the tool', () => {
  const types = new Map([['count', 'number'], ['glow', 'boolean'], ['look', 'select'], ['title', 'text']]);
  assert.deepEqual(seedValuesFromDigest({ count: '12 mm', glow: 'false', look: 'depth', title: hash }, types), { count: 12, glow: false, look: 'depth' });
});
