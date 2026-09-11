// SPDX-License-Identifier: MPL-2.0
/**
 * color-namer.ts - deterministic human-readable colour names.
 * Run: node --test "shells/web/src/lib/color-namer.test.ts"
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameColor } from './color-namer.ts';

/** Every word title-cased (leading capital, no all-lower words). */
function isTitleCase(s: string): boolean {
  const words = s.split(' ');
  return words.length > 0 && words.every(w => w.length > 0 && w[0] === w[0]!.toUpperCase());
}

test('a saturated blue is named a Blue', () => {
  for (const hex of ['#0000ff', '#1d4ed8', '#3b82f6', '#2563eb']) {
    assert.match(nameColor(hex), /Blue/, `${hex} → ${nameColor(hex)}`);
  }
});

test('near-black → a dark-neutral name', () => {
  for (const hex of ['#000000', '#050505', '#0a0b0d']) {
    const name = nameColor(hex);
    assert.match(name, /Near Black|Charcoal/, `${hex} → ${name}`);
  }
});

test('near-white → a light-neutral name', () => {
  for (const hex of ['#ffffff', '#fefefe', '#f7f6f4']) {
    const name = nameColor(hex);
    assert.match(name, /White|Silver/, `${hex} → ${name}`);
  }
});

test('mid grey is a Grey (with an optional temperature)', () => {
  assert.match(nameColor('#808080'), /Grey/);
  assert.match(nameColor('#7d7a74'), /Grey/); // faintly warm neutral
});

test('deterministic - same hex always yields the same name', () => {
  for (const hex of ['#30ba78', '#4f83cc', '#000000', '#ffffff', '#ff8000', '#6a5acd']) {
    assert.equal(nameColor(hex), nameColor(hex));
    assert.equal(nameColor(hex), nameColor(hex.toUpperCase()));
  }
});

test('never returns an empty string, even for junk input', () => {
  for (const hex of ['#0000ff', '#ffffff', '#000000', 'not-a-colour', '', '#12', '#ff8000']) {
    const name = nameColor(hex);
    assert.equal(typeof name, 'string');
    assert.ok(name.length > 0, `empty name for ${JSON.stringify(hex)}`);
  }
});

test('output is title-cased words (≤3 of them)', () => {
  const samples = [
    '#ff0000', '#ff8000', '#ffbf00', '#ffff00', '#00ff00', '#008080',
    '#00ffff', '#0000ff', '#8000ff', '#ff00ff', '#ff66cc', '#30ba78',
    '#000000', '#ffffff', '#808080', '#6a5acd', '#4682b4', '#8b4513',
  ];
  for (const hex of samples) {
    const name = nameColor(hex);
    assert.ok(isTitleCase(name), `not title-case: ${hex} → "${name}"`);
    assert.ok(name.split(' ').length <= 3, `too many words: ${hex} → "${name}"`);
  }
});

test('hue names land on the right family for the primaries/secondaries', () => {
  assert.match(nameColor('#ff0000'), /Red/);
  assert.match(nameColor('#00ff00'), /Green|Lime|Emerald/);
  assert.match(nameColor('#ffff00'), /Yellow|Amber/);
  assert.match(nameColor('#ff8000'), /Orange|Amber/);
  assert.match(nameColor('#ff00ff'), /Magenta|Purple|Pink/);
});
