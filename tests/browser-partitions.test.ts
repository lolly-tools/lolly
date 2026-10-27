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
  type BrowserTiming,
  type TestSummary,
  BROWSER_ENGINE_FILES,
  BROWSER_ENGINE_PARTITION,
  BROWSER_ENTRY_POINT_FILES,
  BROWSER_PARTITION_COUNT,
  BROWSER_PARTITION_DUTY_MS,
  browserExecutionFiles,
  browserPartitionFiles,
  parseBrowserPartition,
  validateBrowserPartitionReports,
} from '../scripts/browser-partitions.ts';
import { checkBrowserReports, validateBrowserSkips } from '../scripts/check-browser-partitions.ts';

const source = 'a'.repeat(40);
const count = BROWSER_PARTITION_COUNT;
const indexes = Array.from({ length: count }, (_, index) => index + 1);
// The files the timing profile measured: an inventory the size of the real one, so the partitions that also run a
// conformance step still receive files. Small fixtures below pass an equal timing with no conformance steps.
const profile = JSON.parse(readFileSync(new URL('../scripts/data/browser-test-durations.json', import.meta.url), 'utf8')) as BrowserTiming;
const inventory = Object.keys(profile.durationMs).sort();
const equal: BrowserTiming = { durationMs: {}, partitionDutyMs: {} };
const summary = (): TestSummary => ({
  success: true, durationMs: 10,
  counts: { tests: 1, passed: 1, failed: 0, cancelled: 0, skipped: 0, todo: 0 },
});
function reports(): BrowserPartitionReport[] {
  return indexes.map((index) => {
    const partition = { index, count };
    const files = browserPartitionFiles(inventory, partition);
    return {
      schemaVersion: 1, shard: 'browser', source, partition, files,
      summaries: files.map((file) => ({ ...summary(), file })), runSummary: summary(),
    };
  });
}

test('the browser partitions cover every file once regardless of input order', () => {
  assert.equal(count, 8);
  const partitions = indexes.map((index) => browserPartitionFiles(inventory, { index, count }));
  assert.deepEqual(partitions.flat().sort(), inventory);
  assert.equal(new Set(partitions.flat()).size, inventory.length);
  for (const [index, files] of partitions.entries()) {
    assert.ok(files.length > 0);
    assert.deepEqual(browserPartitionFiles([...inventory].reverse(), { index: index + 1, count }), files);
  }
  assert.deepEqual(validateBrowserPartitionReports(inventory, reports().reverse(), source), inventory);
});

test('partition configuration refuses invalid ranges, duplicate paths and empty selections', () => {
  for (const value of ['0/8', '9/8', '1/4', '4/4', '1', '01/8', '1/8/2', '-1/8', '1/08']) {
    assert.throws(() => parseBrowserPartition(value), /browser partition must be/, value);
  }
  assert.deepEqual(parseBrowserPartition('8/8'), { index: 8, count: 8 });
  assert.throws(() => browserPartitionFiles([...inventory, inventory[0]!], { index: 1, count }), /duplicate/);
  assert.throws(() => browserPartitionFiles(['../outside.test.ts'], { index: 1, count }), /invalid/);
  assert.throws(() => browserPartitionFiles(['tests/one.test.ts'], { index: count, count }), /empty/);
});

test('entry checks lead only their assigned files, including partial inventories and new files', () => {
  for (let mask = 0; mask < 8; mask++) {
    const entryFiles = BROWSER_ENTRY_POINT_FILES.filter((_, index) => mask & (1 << index));
    const files = ['tests/z-new.test.ts', ...entryFiles, 'tests/a-new.test.ts'];
    const expected = [...entryFiles, 'tests/a-new.test.ts', 'tests/z-new.test.ts'];
    assert.deepEqual(browserExecutionFiles(files), expected);
    assert.deepEqual(browserExecutionFiles([...files].reverse()), expected);
    assert.deepEqual([...files].sort(), [...expected].sort());
  }
  assert.throws(() => browserExecutionFiles(['tests/a.test.ts', 'tests/a.test.ts']), /duplicate/);
});

for (const outcome of ['success', 'failure', 'exception', 'exit', 'cancelled'] as const) {
  test(`ordered browser launcher preserves isolation, preloads and reports for ${outcome}`, () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'lolly-browser-launcher-'));
    // With equal weights the files go round the eight runners in order, so a and i share partition 1.
    const files = ['i.test.ts', 'a.test.ts'];
    const fixtureInventory = 'abcdefghijklmnop'.split('').map(name => `${name}.test.ts`);
    const launcher = fileURLToPath(new URL('../scripts/run-browser-files.ts', import.meta.url));
    const prefix = `import test, {after} from 'node:test'; import assert from 'node:assert/strict';
      import { appendFileSync, mkdirSync, rmSync } from 'node:fs';
      assert.equal(globalThis.fixturePreload, true); assert.equal(globalThis.fixtureFromOtherFile, undefined);
      assert.equal(process.env.FIXTURE_BROWSER_ENV, 'inherited'); globalThis.fixtureFromOtherFile = true;
      mkdirSync('active-file'); after(() => rmSync('active-file', {recursive: true}));
      appendFileSync('execution.jsonl', JSON.stringify({file: import.meta.filename, pid: process.pid}) + '\\n');\n`;
    const body = outcome === 'success' ? "test('case', () => {});"
      : outcome === 'failure' ? "test('case', () => assert.fail('fixture failure'));"
        : outcome === 'exception' ? "throw new Error('fixture import failure');"
          : outcome === 'exit' ? 'process.exit(9);'
            : "test('case', {signal: AbortSignal.abort()}, () => {});";
    try {
      writeFileSync(path.join(directory, 'package.json'), '{"type":"module"}\n');
      writeFileSync(path.join(directory, 'preload.mjs'), 'globalThis.fixturePreload = true;\n');
      writeFileSync(path.join(directory, 'i.test.ts'), prefix + "test('serial barrier', async () => { await new Promise(resolve => setTimeout(resolve, 50)); });\ntest('skipped case', {skip: 'fixture absent'}, () => {});\n");
      writeFileSync(path.join(directory, 'a.test.ts'), prefix + body);
      const childEnv = { ...process.env };
      delete childEnv.NODE_TEST_CONTEXT;
      const result = spawnSync(process.execPath, ['--import', path.join(directory, 'preload.mjs'), launcher, ...files], {
        cwd: directory, encoding: 'utf8', env: { ...childEnv, FIXTURE_BROWSER_ENV: 'inherited',
          LOLLY_SKIP_REPORT: path.join(directory, 'test-skips.json'),
          LOLLY_TEST_COVERAGE_REPORT: path.join(directory, 'browser-coverage.json'),
          LOLLY_TEST_COVERAGE_METADATA: JSON.stringify({schemaVersion: 1, shard: 'browser', source, partition: {index: 1, count}, files}),
        },
      });
      assert.equal(result.status, outcome === 'success' ? 0 : 1, result.stderr + result.stdout);
      const executed = readFileSync(path.join(directory, 'execution.jsonl'), 'utf8').trim().split('\n')
        .map(line => JSON.parse(line) as {file: string; pid: number});
      assert.deepEqual(executed.map(row => path.basename(row.file)), files, 'the actual launches retain nonalphabetical order');
      assert.equal(new Set(executed.map(row => row.pid)).size, 2, 'each file runs in a separate process');
      const report = JSON.parse(readFileSync(path.join(directory, 'browser-coverage.json'), 'utf8')) as BrowserPartitionReport;
      const crashed = outcome === 'exception' || outcome === 'exit';
      assert.deepEqual(report.summaries.map(row => row.file), crashed ? [files[0]] : files);
      assert.equal(report.source, source);
      assert.equal(report.runSummary?.success, outcome === 'success');
      const skips = JSON.parse(readFileSync(path.join(directory, 'test-skips.json'), 'utf8')) as {skips: {file: string; fullName: string; reason: string}[]};
      assert.deepEqual(skips.skips.map(row => [row.file, row.fullName, row.reason]), [['i.test.ts', 'skipped case', 'fixture absent']]);
      assert.equal(report.runSummary?.counts.skipped, 1);
      if (outcome === 'success') assert.deepEqual(validateBrowserPartitionReports(fixtureInventory, [report], source, {index: 1, count}, equal), [...files].sort());
      else assert.throws(() => validateBrowserPartitionReports(fixtureInventory, [report], source, {index: 1, count}, equal), /successfully|cancelled|inventory/);
    } finally { rmSync(directory, {recursive: true, force: true}); }
  });
}

test('measured long files are spread across runners without dropping new or retaining deleted files', () => {
  const files = Array.from({ length: 32 }, (_, index) => `tests/${String(index).padStart(2, '0')}.test.ts`);
  // Alphabetical round-robin puts these eight long files on the same runner.
  const durationMs = Object.fromEntries(files.map((file, index) => [file, index % 4 === 0 ? 100_000 : 1000]));
  durationMs['tests/deleted.test.ts'] = 1_000_000;
  const timing = { durationMs, partitionDutyMs: {} };
  const partitions = indexes.map((index) => browserPartitionFiles(files, { index, count }, timing));
  assert.deepEqual(partitions.flat().sort(), files);
  const totals = partitions.map((part) => part.reduce((sum, file) => sum + durationMs[file]!, 0));
  assert.deepEqual(totals, indexes.map(() => 103_000));
  for (const [index, selected] of partitions.entries()) {
    assert.deepEqual(browserPartitionFiles([...files].reverse(), { index: index + 1, count }, timing), selected);
  }
  const withNew = [...files, 'tests/new.test.ts'];
  const observed = indexes.flatMap((index) => browserPartitionFiles(withNew, { index, count }, timing));
  assert.deepEqual(observed.sort(), withNew.sort());
  for (const invalid of [0, -1, NaN, Infinity]) {
    assert.throws(() => browserPartitionFiles(files, { index: 1, count }, { durationMs: { [files[0]!]: invalid }, partitionDutyMs: {} }), /duration/);
  }
  for (const invalid of [-1, NaN, Infinity]) {
    assert.throws(() => browserPartitionFiles(files, { index: 1, count }, { durationMs, partitionDutyMs: { 2: invalid } }), /duty/);
  }
});

test('files that need the Firefox and WebKit builds always go to the runner that installs them', () => {
  for (const file of BROWSER_ENGINE_FILES) {
    assert.ok(inventory.includes(file), file);
    assert.ok(browserPartitionFiles(inventory, { index: BROWSER_ENGINE_PARTITION, count }).includes(file), file);
  }
  const files = Array.from({ length: 16 }, (_, index) => `tests/${String(index).padStart(2, '0')}.test.ts`);
  const timing = { durationMs: { [files[0]!]: 100_000 }, partitionDutyMs: {} };
  // Without the pin the longest file would take the first runner; with the pin it goes to runner 5 whatever its weight.
  assert.ok(browserPartitionFiles(files, { index: 1, count }, timing, {}).includes(files[0]!));
  const pinned = indexes.map((index) => browserPartitionFiles(files, { index, count }, timing, { [files[0]!]: 5 }));
  assert.ok(pinned[4]!.includes(files[0]!));
  assert.deepEqual(pinned.flat().sort(), files);
  // A pin for a file outside the inventory changes nothing; a pin to a runner that does not exist is refused.
  assert.deepEqual(browserPartitionFiles(files, { index: 2, count }, timing, { 'tests/absent.test.ts': 2 }),
    browserPartitionFiles(files, { index: 2, count }, timing, {}));
  for (const index of [0, count + 1, 1.5]) {
    assert.throws(() => browserPartitionFiles(files, { index: 1, count }, timing, { [files[3]!]: index }), /pin/);
  }
});

test('a runner with a conformance step takes correspondingly fewer test files', () => {
  const files = Array.from({ length: 80 }, (_, index) => `tests/${String(index).padStart(2, '0')}.test.ts`);
  const durationMs = Object.fromEntries(files.map((file) => [file, 10_000]));
  const timing = { durationMs, partitionDutyMs: { 1: 60_000, 3: 20_000 } };
  const partitions = indexes.map((index) => browserPartitionFiles(files, { index, count }, timing));
  assert.deepEqual(partitions.flat().sort(), files);
  // 800 s of files and 80 s of steps over eight runners: 110 s each, the step included.
  assert.deepEqual(partitions.map((part) => part.length), [5, 11, 9, 11, 11, 11, 11, 11]);
  const loads = partitions.map((part, index) => part.length * 10_000 + (timing.partitionDutyMs[(index + 1) as 1 | 3] ?? 0));
  assert.deepEqual(loads, indexes.map(() => 110_000));
  // The measured profile lists only real partitions, and each conformance step ci.yml runs has a time there.
  assert.deepEqual(Object.keys(BROWSER_PARTITION_DUTY_MS).sort(), ['1', '2', '3']);
  const real = indexes.map((index) => browserPartitionFiles(inventory, { index, count }));
  const load = (part: string[], index: number) => part.reduce((sum, file) => sum + profile.durationMs[file]!, 0)
    + (BROWSER_PARTITION_DUTY_MS[String(index + 1)] ?? 0);
  const measured = real.map(load);
  const longest = Math.max(...Object.values(profile.durationMs));
  assert.ok(Math.max(...measured) - Math.min(...measured) <= longest, 'no runner is a whole file behind another');
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
  assert.deepEqual(validateBrowserPartitionReports(inventory, [value[1]!], source, parseBrowserPartition('2/8')), value[1]!.files);
  assert.throws(() => validateBrowserPartitionReports(inventory, [value[0]!], source, parseBrowserPartition('2/8')), /unexpected/);
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
    assert.deepEqual(checkBrowserReports(directory, inventory, [], source), { reports: count, files: inventory.length, skips: 0 });
    rmSync(path.join(directory, `partition-${count}`), { recursive: true });
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
      const files = ['a.test.js', 'i.test.js'];
      const fixtureInventory = 'abcdefghijklmnop'.split('').map((name) => `${name}.test.js`);
      writeFileSync(path.join(directory, 'package.json'), '{"type":"module"}\n');
      writeFileSync(path.join(directory, 'shared.js'), "import test from 'node:test'; test('shared helper case', () => {});\n");
      writeFileSync(path.join(directory, 'a.test.js'), "import './shared.js'; import test from 'node:test'; test('fixture case', { skip: 'fixture absent' }, () => {});\n");
      writeFileSync(path.join(directory, 'i.test.js'), failing
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
          LOLLY_TEST_COVERAGE_METADATA: JSON.stringify({ schemaVersion: 1, shard: 'browser', source, partition: { index: 1, count }, files }),
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
      if (failing) assert.throws(() => validateBrowserPartitionReports(fixtureInventory, [report], source, { index: 1, count }, equal), /successfully/);
      else assert.deepEqual(validateBrowserPartitionReports(fixtureInventory, [report], source, { index: 1, count }, equal), files);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
}
