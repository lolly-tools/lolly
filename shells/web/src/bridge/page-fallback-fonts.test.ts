// SPDX-License-Identifier: MPL-2.0
/**
 * Where the live page puts a fallback font in a family stack (page-fallback-fonts.ts): after
 * the design system's named families, so a brand font still draws every character it has,
 * and before the generic ones, so the browser reaches it before any system font.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { withFallbackFamilies } from './page-fallback-fonts.ts';

test('fallback families go after the named families and before the generics', () => {
  assert.equal(withFallbackFamilies("'Outfit', 'SUSE', ui-sans-serif, system-ui, sans-serif", ['Lolly Fallback Noto Sans Arabic']),
    `'Outfit', 'SUSE', "Lolly Fallback Noto Sans Arabic", ui-sans-serif, system-ui, sans-serif`);
  assert.equal(withFallbackFamilies('"SUSE Mono", monospace', ['Lolly Fallback Noto Sans', 'Lolly Fallback Noto Sans Hebrew']),
    '"SUSE Mono", "Lolly Fallback Noto Sans", "Lolly Fallback Noto Sans Hebrew", monospace');
  assert.equal(withFallbackFamilies('Brand Face', ['Lolly Fallback Noto Sans Thai']), 'Brand Face, "Lolly Fallback Noto Sans Thai"', 'a stack with no generic takes them last');
});

test('the page reads a stack without its own families, so a recheck gives the same answer', () => {
  const once = withFallbackFamilies("'Outfit', sans-serif", ['Lolly Fallback Noto Sans Arabic']);
  assert.equal(withFallbackFamilies(once, []), "'Outfit', sans-serif");
  assert.equal(withFallbackFamilies(once, ['Lolly Fallback Noto Sans Arabic']), once);
});
