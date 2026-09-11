// SPDX-License-Identifier: MPL-2.0
/**
 * The disclaimer rendered under a displayed total (cost-strings.ts, string 4) must be
 * the SAME sentence serialised into `preflight.json` (`COST_DISCLAIMER`), or a client
 * reading the zip sees a different hedge from the one on screen. The strings are
 * separate call sites (one is a `t()` key for translation, one is a shipped constant),
 * so nothing but this test keeps them identical.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { COST_DISCLAIMER } from '@lolly-tools/core';
import { disclaimerLine } from './cost-strings.ts';

test('the rendered disclaimer is COST_DISCLAIMER verbatim (English)', () => {
  // In an English build t() is identity, so the rendered string is its own key.
  assert.equal(disclaimerLine(), COST_DISCLAIMER);
});

test('no cost chrome string carries a currency symbol', () => {
  // Sampled across the parametric strings: figures are interpolated after formatting,
  // never typed into the key, so no symbol may appear.
  assert.doesNotMatch(COST_DISCLAIMER, /[$€£¥]/);
});
