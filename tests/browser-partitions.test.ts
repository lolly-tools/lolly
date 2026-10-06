// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  type BrowserPartitionReport,
  type TestSummary,
  browserPartitionFiles,
  parseBrowserPartition,
  validateBrowserPartitionReports,
} from '../scripts/browser-partitions.ts';
import { checkBrowserReports, validateBrowserSkips } from '../scripts/check-browser-partitions.ts';

const source = 'a'.repeat(40);
const inventory = Array.from({ length: 12 }, (_, index) => `tests/${String(index).padStart(2, '0')}.test.ts`);
const summary = (): TestSummary => ({
  success: true, durationMs: 10,
  counts: { tests: 1, passed: 1, failed: 0, cancelled: 0, skipped: 0, todo: 0 },
});
function reports(): BrowserPartitionReport[] {
  return [1, 2, 3, 4].map((index) => {
    const partition = { index, count: 4 };
    const files = browserPartitionFiles(inventory, partition);
    return {
      schemaVersion: 1, shard: 'browser', source, partition, files,
      summaries: files.map((file) => ({ ...summary(), file })), runSummary: summary(),
    };
  });
}

test('four browser partitions cover every file once regardless of input order', () => {
  const partitions = [1, 2, 3, 4].map((index) => browserPartitionFiles(inventory, { index, count: 4 }));
  assert.deepEqual(partitions.flat().sort(), inventory);
  assert.equal(new Set(partitions.flat()).size, inventory.length);
  for (const [index, files] of partitions.entries()) {
    assert.ok(files.length > 0);
    assert.deepEqual(browserPartitionFiles([...inventory].reverse(), { index: index + 1, count: 4 }), files);
  }
  assert.deepEqual(validateBrowserPartitionReports(inventory, reports().reverse(), source), inventory);
});

test('partition configuration refuses invalid ranges, duplicate paths and empty selections', () => {
  for (const value of ['0/4', '5/4', '1/3', '1', '01/4', '1/4/2']) assert.throws(() => parseBrowserPartition(value));
  assert.throws(() => browserPartitionFiles([...inventory, inventory[0]!], { index: 1, count: 4 }), /duplicate/);
  assert.throws(() => browserPartitionFiles(['../outside.test.ts'], { index: 1, count: 4 }), /invalid/);
  assert.throws(() => browserPartitionFiles(['tests/one.test.ts'], { index: 4, count: 4 }), /empty/);
});

const invalidReports: [string, (value: BrowserPartitionReport[]) => void, RegExp][] = [
  ['missing partition', (value) => { value.pop(); }, /missing or extra/],
  ['duplicate partition', (value) => { value[3] = value[0]!; }, /duplicate/],
  ['different source', (value) => { value[0]!.source = 'b'.repeat(40); }, /source/],
  ['wrong shard', (value) => { value[0]!.shard = 'contracts' as 'browser'; }, /shard/],
  ['omitted planned file', (value) => { value[0]!.files.pop(); }, /inventory/],
  ['duplicate planned file', (value) => { value[0]!.files.push(value[0]!.files[0]!); }, /duplicate/],
  ['file assigned to another partition', (value) => { value[0]!.files[0] = value[1]!.files[0]!; }, /inventory/],
  ['file never finished', (value) => { value[0]!.summaries.pop(); }, /inventory/],
  ['file finished twice', (value) => { value[0]!.summaries.push(value[0]!.summaries[0]!); }, /duplicate/],
  ['unexpected executed file', (value) => { value[0]!.summaries[0]!.file = 'tests/unexpected.test.ts'; }, /inventory/],
  ['unfinished final summary', (value) => { value[0]!.runSummary = null; }, /missing/],
  ['failed file', (value) => { value[0]!.summaries[0]!.success = false; }, /successfully/],
  ['cancelled case', (value) => { value[0]!.summaries[0]!.counts.cancelled = 1; }, /cancelled/],
  ['invalid test counts', (value) => { value[0]!.summaries[0]!.counts.tests = -1; }, /invalid/],
];
for (const [name, change, reason] of invalidReports) {
  test(`browser aggregate rejects ${name}`, () => {
    const value = reports();
    change(value);
    assert.throws(() => validateBrowserPartitionReports(inventory, value, source), reason);
  });
}

test('each partition can check its complete report without weakening the aggregate', () => {
  const value = reports();
  assert.deepEqual(validateBrowserPartitionReports(inventory, [value[1]!], source, parseBrowserPartition('2/4')), value[1]!.files);
  assert.throws(() => validateBrowserPartitionReports(inventory, [value[0]!], source, parseBrowserPartition('2/4')), /unexpected/);
  assert.throws(() => validateBrowserPartitionReports(inventory, value, 'not-a-commit'), /commit/);
});

test('combined browser skips reject duplicates, omissions and equal-count replacements', () => {
  const skip = { file: inventory[0]!, fullName: 'suite > case', reason: 'fixture absent', capability: 'fixture', owner: 'tests' };
  validateBrowserSkips(inventory, [skip], [skip]);
  assert.throws(() => validateBrowserSkips(inventory, [skip], [skip, skip]), /duplicate/);
  assert.throws(() => validateBrowserSkips(inventory, [skip], []), /stale/);
  assert.throws(() => validateBrowserSkips(inventory, [skip], [{ ...skip, fullName: 'different case' }]), /drift/);
  assert.throws(() => validateBrowserSkips(inventory, [], [{ ...skip, file: 'tests/unknown.test.ts' }]), /outside/);
  assert.throws(() => validateBrowserSkips(inventory, [], [{ ...skip, capability: 'unspecified' }]), /recognised/);
});

test('artifact aggregation requires paired reports and rejects missing, duplicate and orphan artifacts', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'lolly-partition-artifacts-'));
  const values = reports();
  const write = () => {
    rmSync(directory, { recursive: true, force: true });
    mkdirSync(directory);
    for (const value of values) {
      const folder = path.join(directory, `partition-${value.partition.index}`);
      mkdirSync(folder);
      writeFileSync(path.join(folder, 'browser-coverage.json'), JSON.stringify(value));
      writeFileSync(path.join(folder, 'test-skips.json'), '{"schemaVersion":1,"skips":[]}');
    }
  };
  try {
    write();
    assert.deepEqual(checkBrowserReports(directory, inventory, [], source), { reports: 4, files: 12, skips: 0 });
    rmSync(path.join(directory, 'partition-4'), { recursive: true });
    assert.throws(() => checkBrowserReports(directory, inventory, [], source), /missing or extra/);
    write();
    rmSync(path.join(directory, 'partition-2/test-skips.json'));
    assert.throws(() => checkBrowserReports(directory, inventory, [], source), /missing or extra/);
    write();
    mkdirSync(path.join(directory, 'orphan'));
    writeFileSync(path.join(directory, 'orphan/test-skips.json'), '{"schemaVersion":1,"skips":[]}');
    assert.throws(() => checkBrowserReports(directory, inventory, [], source), /missing or extra/);
    write();
    mkdirSync(path.join(directory, 'duplicate'));
    writeFileSync(path.join(directory, 'duplicate/browser-coverage.json'), JSON.stringify(values[0]));
    writeFileSync(path.join(directory, 'duplicate/test-skips.json'), '{"schemaVersion":1,"skips":[]}');
    assert.throws(() => checkBrowserReports(directory, inventory, [], source), /missing or extra/);
    write();
    const changed = structuredClone(values[0]!);
    changed.runSummary!.counts.skipped = 1;
    writeFileSync(path.join(directory, 'partition-1/browser-coverage.json'), JSON.stringify(changed));
    assert.throws(() => checkBrowserReports(directory, inventory, [], source), /observed skip count/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

for (const failing of [false, true]) {
  test(`real serial reporter records entry files and ${failing ? 'rejects failed execution' : 'complete execution'}`, () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'lolly-partition-reporter-'));
    try {
      const files = ['a.test.js', 'e.test.js'];
      const fixtureInventory = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((name) => `${name}.test.js`);
      writeFileSync(path.join(directory, 'package.json'), '{"type":"module"}\n');
      writeFileSync(path.join(directory, 'shared.js'), "import test from 'node:test'; test('shared helper case', () => {});\n");
      writeFileSync(path.join(directory, 'a.test.js'), "import './shared.js'; import test from 'node:test'; test('fixture case', { skip: 'fixture absent' }, () => {});\n");
      writeFileSync(path.join(directory, 'e.test.js'), failing
        ? "import './shared.js'; import test from 'node:test'; test('failed case', () => { throw new Error('expected failure'); });\n"
        : "import './shared.js';\n");
      const reporter = fileURLToPath(new URL('./reporters/skip-identities.ts', import.meta.url));
      const childEnv = { ...process.env };
      delete childEnv.NODE_TEST_CONTEXT;
      const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', `--test-reporter=${reporter}`, ...files], {
        cwd: directory, encoding: 'utf8',
        env: {
          ...childEnv,
          LOLLY_SKIP_REPORT: path.join(directory, 'test-skips.json'),
          LOLLY_TEST_COVERAGE_REPORT: path.join(directory, 'browser-coverage.json'),
          LOLLY_TEST_COVERAGE_METADATA: JSON.stringify({ schemaVersion: 1, shard: 'browser', source, partition: { index: 1, count: 4 }, files }),
        },
      });
      assert.equal(result.status, failing ? 1 : 0, result.stderr + result.stdout);
      const report = JSON.parse(readFileSync(path.join(directory, 'browser-coverage.json'), 'utf8')) as BrowserPartitionReport;
      assert.deepEqual(report.summaries.map((item) => item.file).sort(), files);
      assert.equal(report.runSummary?.success, !failing);
      const skips = JSON.parse(readFileSync(path.join(directory, 'test-skips.json'), 'utf8')) as { skips: { file: string }[] };
      assert.equal(skips.skips.length, 1);
      assert.equal(skips.skips[0]?.file, 'a.test.js');
      assert.equal(report.runSummary?.counts.skipped, skips.skips.length);
      if (failing) assert.throws(() => validateBrowserPartitionReports(fixtureInventory, [report], source, { index: 1, count: 4 }), /successfully/);
      else assert.deepEqual(validateBrowserPartitionReports(fixtureInventory, [report], source, { index: 1, count: 4 }), files);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
}
