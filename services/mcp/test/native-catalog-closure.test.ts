// SPDX-License-Identifier: MPL-2.0
/** Source catalog growth cannot hide missing, extra, reordered or duplicate recipes. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { assertNativeCatalogClosure } from '../scripts/native-catalog-closure.ts';

const previous = Array.from({ length: 67 }, (_, index) => ({ id: `recipe-${index}` }));
const current = [...previous, { id: 'compare' }];

test('the added Compare recipe qualifies only with the complete same-source catalog', () => {
  assertNativeCatalogClosure(previous, previous);
  assertNativeCatalogClosure(current, current.map((entry) => ({ ...entry })));
  assert.throws(() => assertNativeCatalogClosure(previous, current));
  assert.throws(() => assertNativeCatalogClosure([...current, { id: 'unreviewed' }], current));
});

test('a same-length changed or reordered catalog fails the ordered identity oracle', () => {
  const changed = current.map((entry) => ({ ...entry }));
  changed[changed.length - 1] = { id: 'different' };
  assert.throws(() => assertNativeCatalogClosure(changed, current));
  assert.throws(() => assertNativeCatalogClosure([...current].reverse(), current));
});

test('empty or duplicated source catalogs cannot qualify each other', () => {
  assert.throws(() => assertNativeCatalogClosure([], []));
  const duplicated = [...previous, { id: 'recipe-0' }];
  assert.throws(() => assertNativeCatalogClosure(duplicated, duplicated));
  assert.throws(() => assertNativeCatalogClosure(duplicated, current));
});
