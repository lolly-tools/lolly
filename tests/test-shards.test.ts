// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyTest, discoverTests, shardInventory, SHARDS } from '../scripts/run-test-suite.ts';
import { browserPartitionFiles } from '../scripts/browser-partitions.ts';

test('test shards are exhaustive, disjoint, deterministic and non-empty', () => {
  const all = discoverTests();
  const inventory = shardInventory();
  const flattened = SHARDS.flatMap((shard) => inventory[shard]);
  assert.deepEqual([...flattened].sort(), all);
  assert.equal(new Set(flattened).size, all.length);
  for (const shard of SHARDS) assert.ok(inventory[shard].length > 0, `${shard} must not be empty`);
  for (const file of all) assert.equal(classifyTest(file), classifyTest(file));
  const browserFiles = [1, 2, 3, 4].flatMap((index) => browserPartitionFiles(inventory.browser, { index, count: 4 }));
  assert.deepEqual(browserFiles.sort(), inventory.browser);
  assert.equal(new Set(browserFiles).size, inventory.browser.length);
});

test('transport-specific tests stay in their intended shard', () => {
  assert.equal(classifyTest('tests/tauri-security.test.ts'), 'tauri');
  assert.equal(classifyTest('tests/fuzz-regression.test.ts'), 'fuzz:regression');
  assert.equal(classifyTest('shells/web/src/bridge/hook-worker.test.ts'), 'security');
  assert.equal(classifyTest('packages/core/test/mock-host.test.ts'), 'contracts');
  assert.equal(classifyTest('tests/webmcp.browser.test.ts'), 'browser');
});
