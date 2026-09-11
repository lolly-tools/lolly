// SPDX-License-Identifier: MPL-2.0
// The invisible-character naming + rendering shared by verify and the catalog:
// names for everything the analyser's byte tier flags, chips in the HTML path,
// and untouched visible text. Fixtures are \u-escaped - raw invisibles in
// source are the very artifact under test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { invisibleCharName, visibleTextHtml } from './invisible-chars.ts';

test('names every class the byte tier flags', () => {
  assert.equal(invisibleCharName('​'), 'ZWSP');
  assert.equal(invisibleCharName('‮'), 'RLO');
  assert.equal(invisibleCharName(' '), 'NBSP');
  assert.equal(invisibleCharName(' '), 'SP');          // width-variant space (em space)
  assert.equal(invisibleCharName('︁'), 'VS2');
  assert.equal(invisibleCharName('\u{E0105}'), 'VS22');     // supplementary selector
  assert.equal(invisibleCharName('\u{E0041}'), 'TAG');      // tag char (smuggled 'A')
  assert.equal(invisibleCharName(''), 'PUA');         // leaked model delimiter range
});

test('visible characters are never renamed', () => {
  for (const ch of ['a', 'Z', '.', ' ', '\n', '\t', 'é', '中', '\u{1F642}']) {
    assert.equal(invisibleCharName(ch), null, JSON.stringify(ch));
  }
});

test('visibleTextHtml chips the invisibles and escapes everything', () => {
  const html = visibleTextHtml('a​b <x>', 'chip');
  assert.equal(html, 'a<span class="chip" title="ZWSP · U+200B">ZWSP</span>b &lt;x&gt;');
});

test('plain text passes through as one escaped run', () => {
  assert.equal(visibleTextHtml('no hidden chars & such', 'chip'), 'no hidden chars &amp; such');
});
