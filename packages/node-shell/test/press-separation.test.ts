// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DEVICE_SEPARATION } from '@lolly/engine';
import { BUNDLED_PRESS_PROFILE, usesBundledPressProfile } from '../src/press-separation.ts';
import { pressSeparationFor, bundledPressSeparation } from '../src/press-separation-node.ts';

test('the bundled profile on disk is the one the constants describe', () => {
  const bytes = readFileSync(new URL(`../icc/${BUNDLED_PRESS_PROFILE.file}`, import.meta.url));
  assert.equal(bytes.length, BUNDLED_PRESS_PROFILE.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), BUNDLED_PRESS_PROFILE.sha256);
});

test('only Coated FOGRA39 and the values that fall back to it use the bundled profile', () => {
  for (const v of ['fogra39', undefined, null, 'srgb', 'none', 'unknown']) assert.equal(usesBundledPressProfile(v), true, String(v));
  for (const v of ['fogra51', 'swop', 'gracol']) assert.equal(usesBundledPressProfile(v), false, v);
});

test('the Node shells separate FOGRA39 through the bundled profile and other conditions by formula', async () => {
  const sep = await bundledPressSeparation();
  assert.ok(sep);
  assert.equal(sep.method, 'icc');
  assert.equal((await pressSeparationFor('fogra39')).method, 'icc');
  assert.equal((await pressSeparationFor(undefined)).method, 'icc');
  assert.equal(await pressSeparationFor('swop'), DEVICE_SEPARATION);
  assert.deepEqual(sep.separate(0, 0, 0), [0, 0, 0, 1]);
});
