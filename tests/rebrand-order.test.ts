// SPDX-License-Identifier: MPL-2.0
/**
 * One string order for the rebrand modules (plan 274 sections 3.2 to 3.4): the
 * census, the plan, the colour solve, the archetype ranking and the compile sort
 * ids by UTF-16 code unit, never by the host's collation, so two machines with
 * different locales plan the same bytes the same way.
 *
 * Run with: node --test "tests/rebrand-order.test.ts"
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { compareCodeUnits } from '../engine/src/rebrand-order.ts';

test('ids with punctuation, digits and letters outside ASCII sort by code unit', () => {
  const ids = [
    'ppt/slides/slide10.xml.2:text',
    'ppt/slides/slide2.xml.10:fill',
    'ppt/slides/slide2.xml.1:text',
    'ppt/slides/slide2.xml.1-a',
    'Zebra',
    'apple',
    'Äpfel',
    'éclair',
    'e',
    '_under',
    '~tilde',
  ];
  const sorted = [...ids].sort(compareCodeUnits);
  // What a code-unit sort states, written out by hand: upper case before '_',
  // '_' before lower case, lower case before '~', every letter outside ASCII
  // after '~', and a digit before ':' so `1:` follows `10`. Collation would fold case, weigh accents apart and read digits
  // and punctuation by rules of its own.
  assert.deepEqual(sorted, [
    'Zebra',
    '_under',
    'apple',
    'e',
    'ppt/slides/slide10.xml.2:text',
    'ppt/slides/slide2.xml.1-a',
    'ppt/slides/slide2.xml.10:fill',
    'ppt/slides/slide2.xml.1:text',
    '~tilde',
    'Äpfel',
    'éclair',
  ]);
  for (let i = 1; i < sorted.length; i += 1) {
    const a = sorted[i - 1] as string;
    const b = sorted[i] as string;
    assert.ok(a < b, `${a} before ${b}`);
  }
  assert.equal(compareCodeUnits('same', 'same'), 0);
});

test('no rebrand or census module sorts by the host collation', () => {
  const dir = fileURLToPath(new URL('../engine/src/', import.meta.url));
  const modules = readdirSync(dir).filter((name) => /^(rebrand-|deck-census|deck-compile)/.test(name) && name.endsWith('.ts'));
  assert.ok(modules.length >= 10, `only ${modules.length} modules were read`);
  for (const name of modules) {
    const text = readFileSync(`${dir}${name}`, 'utf8');
    assert.equal(/\.localeCompare\(/.test(text), false, `${name} calls localeCompare`);
  }
});
