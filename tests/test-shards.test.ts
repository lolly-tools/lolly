// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyTest, discoverTests, shardInventory, SHARDS } from '../scripts/run-test-suite.ts';
import { readFileSync } from 'node:fs';
import { BROWSER_ENGINE_FILES, BROWSER_ENTRY_POINT_FILES, BROWSER_PARTITION_COUNT, browserExecutionFiles, browserPartitionFiles } from '../scripts/browser-partitions.ts';

test('test shards are exhaustive, disjoint, deterministic and non-empty', () => {
  const all = discoverTests();
  const inventory = shardInventory();
  const flattened = SHARDS.flatMap((shard) => inventory[shard]);
  assert.deepEqual([...flattened].sort(), all);
  assert.equal(new Set(flattened).size, all.length);
  for (const shard of SHARDS) assert.ok(inventory[shard].length > 0, `${shard} must not be empty`);
  for (const file of all) assert.equal(classifyTest(file), classifyTest(file));
  const browserFiles = Array.from({ length: BROWSER_PARTITION_COUNT }, (_, index) => index + 1).flatMap((index) => {
    const assigned = browserPartitionFiles(inventory.browser, { index, count: BROWSER_PARTITION_COUNT });
    assert.ok(assigned.length > 0, `browser partition ${index} must not be empty`);
    const ordered = browserExecutionFiles(assigned);
    assert.deepEqual([...ordered].sort(), assigned, 'entry checks do not move between partitions');
    const first = BROWSER_ENTRY_POINT_FILES.filter(file => assigned.includes(file));
    assert.deepEqual(ordered.slice(0, first.length), first);
    return ordered;
  });
  assert.deepEqual(browserFiles.sort(), inventory.browser);
  assert.equal(new Set(browserFiles).size, inventory.browser.length);
  for (const file of BROWSER_ENTRY_POINT_FILES) assert.equal(browserFiles.filter(value => value === file).length, 1);
});

test('every browser file that looks for an installed Firefox or WebKit build runs where those builds are installed', () => {
  // A case gated on `executablePath()` of the Firefox or WebKit build skips on a runner without that build,
  // and only one browser runner installs those builds, so such a file has to be listed in BROWSER_ENGINE_FILES.
  const engine = /(?<![-\w])(?:webkit|firefox)(?![-\w])/;
  const found = shardInventory().browser.filter((file) => {
    const source = readFileSync(file, 'utf8');
    return /executablePath\(\)/.test(source) && engine.test(source);
  });
  assert.deepEqual(found, [...BROWSER_ENGINE_FILES].sort());
});

test('transport-specific tests stay in their intended shard', () => {
  assert.equal(classifyTest('tests/tauri-security.test.ts'), 'tauri');
  assert.equal(classifyTest('tests/fuzz-regression.test.ts'), 'fuzz:regression');
  assert.equal(classifyTest('shells/web/src/bridge/hook-worker.test.ts'), 'security');
  assert.equal(classifyTest('packages/core/test/mock-host.test.ts'), 'contracts');
  assert.equal(classifyTest('tests/webmcp.browser.test.ts'), 'browser');
  assert.equal(classifyTest('tests/topbar-tools-navigation.browser.test.ts'), 'browser');
  assert.equal(classifyTest('tests/emoji-tools.browser.test.ts'), 'browser');
  assert.equal(classifyTest('tests/action-icons.browser.test.ts'), 'security');
  assert.equal(classifyTest('tests/hook-worker-isolation.browser.test.ts'), 'security');
});
