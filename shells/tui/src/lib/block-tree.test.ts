// SPDX-License-Identifier: MPL-2.0
/**
 * Contract tests for the TUI's pure blocks-tree helpers (lib/block-tree.ts) - the module
 * the terminal block editor's row list, nesting gate and reparenting all read from. Pure
 * and DOM-free, so they run under `node --test` with nothing mounted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  slugRef, deriveBlockKeys, nestingActive, nestingConfig, blockParentIndex, blockTreeOrder,
} from './block-tree.ts';
import type { BlockRow } from './block-tree.ts';

test('slugRef lowercases, collapses non-alphanumerics and trims hyphens', () => {
  assert.equal(slugRef('  Hello, World!  '), 'hello-world');
  assert.equal(slugRef('A-B'), 'a-b');
  assert.equal(slugRef(''), '');
  assert.equal(slugRef(undefined), '');
  assert.equal(slugRef(42), '42');
});

test('deriveBlockKeys prefers keyField, falls back to labelField then an ordinal', () => {
  const rows: BlockRow[] = [
    { nodeId: 'Start', label: 'ignored' },
    { label: 'Second Step' },
    {},
  ];
  assert.deepEqual(deriveBlockKeys(rows), ['start', 'second-step', 'node-3']);
});

test('deriveBlockKeys de-duplicates collisions with -2/-3 suffixes', () => {
  const rows: BlockRow[] = [{ label: 'Step' }, { label: 'Step' }, { label: 'step' }];
  assert.deepEqual(deriveBlockKeys(rows), ['step', 'step-2', 'step-3']);
});

test('deriveBlockKeys honours a custom key/label/prefix config', () => {
  const rows: BlockRow[] = [{ id: 'A' }, { name: 'Bee' }, {}];
  assert.deepEqual(
    deriveBlockKeys(rows, { keyField: 'id', labelField: 'name', prefix: 'box-' }),
    ['a', 'bee', 'box-3'],
  );
});

test('deriveBlockKeys survives a non-array value', () => {
  assert.deepEqual(deriveBlockKeys(undefined as unknown as BlockRow[]), []);
});

test('nestingActive: no nesting config is never a tree', () => {
  assert.equal(nestingActive(undefined), false);
  assert.equal(nestingActive({}), false);
});

test('nestingActive: no activeWhen is always on; activeWhen gates on top-level values', () => {
  assert.equal(nestingActive({ nesting: { parentField: 'parent' } }), true);
  const input = { nesting: { parentField: 'parent', activeWhen: { kind: 'tree' } } };
  assert.equal(nestingActive(input, { kind: 'tree' }), true);
  assert.equal(nestingActive(input, { kind: 'flat' }), false);
  assert.equal(nestingActive(input, {}), false);
});

test('nestingActive: an array activeWhen value is membership', () => {
  const input = { nesting: { parentField: 'parent', activeWhen: { kind: ['tree', 'org'] } } };
  assert.equal(nestingActive(input, { kind: 'org' }), true);
  assert.equal(nestingActive(input, { kind: 'grid' }), false);
});

test('nestingConfig fills every default', () => {
  assert.deepEqual(nestingConfig(undefined), {
    parentField: 'parent', keyField: 'nodeId', labelField: 'label', prefix: 'node-',
  });
  assert.deepEqual(nestingConfig({ nesting: { parentField: 'boss', prefix: 'p-' } }), {
    parentField: 'boss', keyField: 'nodeId', labelField: 'label', prefix: 'p-',
  });
});

test('blockParentIndex maps parent refs to row indexes, -1 for roots', () => {
  const rows: BlockRow[] = [
    { label: 'Root' },
    { label: 'Child', parent: 'Root' },
    { label: 'Grand', parent: 'Child' },
  ];
  const keys = deriveBlockKeys(rows);
  assert.deepEqual(blockParentIndex(rows, keys, 'parent'), [-1, 0, 1]);
});

test('blockParentIndex refuses self-references and unknown refs', () => {
  const rows: BlockRow[] = [{ label: 'A', parent: 'A' }, { label: 'B', parent: 'nowhere' }];
  const keys = deriveBlockKeys(rows);
  assert.deepEqual(blockParentIndex(rows, keys, 'parent'), [-1, -1]);
});

test('blockTreeOrder walks pre-order with depth', () => {
  const rows: BlockRow[] = [{}, {}, {}, {}];
  //   0 → 1 → 3,  2 is a second root
  assert.deepEqual(blockTreeOrder(rows, [-1, 0, -1, 1]), [
    { idx: 0, depth: 0 }, { idx: 1, depth: 1 }, { idx: 3, depth: 2 }, { idx: 2, depth: 0 },
  ]);
});

test('blockTreeOrder promotes a cycle to a root instead of hanging', () => {
  const rows: BlockRow[] = [{}, {}];
  const order = blockTreeOrder(rows, [1, 0]);   // 0↔1, no root at all
  assert.equal(order.length, 2);
  assert.deepEqual(order.map(e => e.idx).sort(), [0, 1]);
});

test('blockTreeOrder emits every row exactly once even with an out-of-range parent', () => {
  const rows: BlockRow[] = [{}, {}, {}];
  const order = blockTreeOrder(rows, [-1, 99, 0]);
  assert.deepEqual(order.map(e => e.idx).sort(), [0, 1, 2]);
});
