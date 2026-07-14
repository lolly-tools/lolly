// SPDX-License-Identifier: MPL-2.0
/**
 * Dependency-free SemVer range satisfaction (engine/src/semver-range.ts).
 *
 * This is the check that underwrites the engineVersion floor (P0-3): loadTool
 * refuses a tool whose declared `engineVersion` range excludes the running
 * ENGINE_VERSION. If this comparator is wrong, the whole fast-catalog /
 * slow-binary safety model is wrong, so it's exercised directly here.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { satisfiesRange, parseVersion } from '../engine/src/semver-range.ts';

test('parseVersion: full, partial, prefixed, and prerelease forms', () => {
  assert.deepEqual(parseVersion('1.52.0'), [1, 52, 0]);
  assert.deepEqual(parseVersion('v1.2'), [1, 2, 0]);
  assert.deepEqual(parseVersion('1'), [1, 0, 0]);
  assert.deepEqual(parseVersion('1.53.0-beta.2'), [1, 53, 0]); // prerelease dropped on the core
  assert.deepEqual(parseVersion('2.0.0+build'), [2, 0, 0]);
  assert.equal(parseVersion('not-a-version'), null);
  assert.equal(parseVersion(''), null);
});

test('caret: allows patch/minor up to the next major', () => {
  for (const v of ['1.0.0', '1.3.0', '1.52.0', '1.53.0', '1.999.999']) {
    assert.equal(satisfiesRange(v, '^1.0.0'), true, v);
  }
  assert.equal(satisfiesRange('2.0.0', '^1.0.0'), false);
  assert.equal(satisfiesRange('0.9.9', '^1.0.0'), false);
  // ^1.17.0 excludes anything below 1.17.0 but includes the current line.
  assert.equal(satisfiesRange('1.16.9', '^1.17.0'), false);
  assert.equal(satisfiesRange('1.17.0', '^1.17.0'), true);
  assert.equal(satisfiesRange('1.53.0', '^1.17.0'), true);
});

test('caret below 1.0 pins to the left-most non-zero element', () => {
  assert.equal(satisfiesRange('0.2.9', '^0.2.3'), true);
  assert.equal(satisfiesRange('0.3.0', '^0.2.3'), false); // minor bump not allowed under ^0.2.x
  assert.equal(satisfiesRange('0.0.3', '^0.0.3'), true);
  assert.equal(satisfiesRange('0.0.4', '^0.0.3'), false); // patch bump not allowed under ^0.0.x
});

test('tilde: patch-level when a minor is given, minor-level otherwise', () => {
  assert.equal(satisfiesRange('1.2.9', '~1.2.3'), true);
  assert.equal(satisfiesRange('1.3.0', '~1.2.3'), false);
  assert.equal(satisfiesRange('1.2.0', '~1.2'), true);
  assert.equal(satisfiesRange('1.3.0', '~1.2'), false);
  assert.equal(satisfiesRange('1.9.9', '~1'), true);
  assert.equal(satisfiesRange('2.0.0', '~1'), false);
});

test('comparators, exact, x-ranges, wildcard', () => {
  assert.equal(satisfiesRange('1.52.0', '>=1.30.0'), true);
  assert.equal(satisfiesRange('1.29.0', '>=1.30.0'), false);
  assert.equal(satisfiesRange('1.30.0', '>1.30.0'), false);
  assert.equal(satisfiesRange('1.30.0', '<=1.30.0'), true);
  assert.equal(satisfiesRange('1.29.9', '<1.30.0'), true);

  assert.equal(satisfiesRange('1.2.3', '1.2.3'), true);   // exact
  assert.equal(satisfiesRange('1.2.4', '1.2.3'), false);

  assert.equal(satisfiesRange('1.2.9', '1.2.x'), true);   // x-range
  assert.equal(satisfiesRange('1.3.0', '1.2.x'), false);
  assert.equal(satisfiesRange('1.9.9', '1.x'), true);
  assert.equal(satisfiesRange('2.0.0', '1.x'), false);

  assert.equal(satisfiesRange('1.52.0', '*'), true);      // wildcard / empty
  assert.equal(satisfiesRange('1.52.0', ''), true);
});

test('AND (space/comma) and OR (||) composition', () => {
  assert.equal(satisfiesRange('1.5.0', '>=1.0.0 <2.0.0'), true);
  assert.equal(satisfiesRange('2.0.0', '>=1.0.0 <2.0.0'), false);
  assert.equal(satisfiesRange('1.5.0', '>=1.0.0, <1.4.0'), false);
  assert.equal(satisfiesRange('0.9.0', '^1.0.0 || ^0.9.0'), true);
  assert.equal(satisfiesRange('3.0.0', '^1.0.0 || ^2.0.0'), false);
});

test('an unparseable range fails closed (never silently satisfied)', () => {
  assert.equal(satisfiesRange('1.52.0', 'garbage'), false);
  assert.equal(satisfiesRange('1.52.0', '>=oops'), false);
});
