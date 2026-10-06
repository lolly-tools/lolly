// SPDX-License-Identifier: MPL-2.0
/** Deterministic browser partitions and their observed execution contract. */

export const BROWSER_PARTITION_COUNT = 4;

export interface BrowserPartition { index: number; count: number }
export interface TestCounts {
  tests: number;
  passed: number;
  failed: number;
  cancelled: number;
  skipped: number;
  todo: number;
}
export interface TestSummary { success: boolean; durationMs: number; counts: TestCounts }
export interface FileSummary extends TestSummary { file: string }
export interface BrowserPartitionMetadata {
  schemaVersion: 1;
  shard: 'browser';
  source: string;
  partition: BrowserPartition;
  files: string[];
}
export interface BrowserPartitionReport extends BrowserPartitionMetadata {
  summaries: FileSummary[];
  runSummary: TestSummary | null;
}

export function parseBrowserPartition(value: string): BrowserPartition {
  const match = /^([1-4])\/4$/.exec(value);
  if (!match) throw new Error('browser partition must be 1/4, 2/4, 3/4 or 4/4');
  return { index: Number(match[1]), count: BROWSER_PARTITION_COUNT };
}

function uniqueFiles(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${label} must contain files`);
  const files: string[] = [];
  for (const file of value) {
    if (typeof file !== 'string' || !file || file.startsWith('/') || file.includes('\\')
      || file.split('/').some((segment) => !segment || segment === '.' || segment === '..')) {
      throw new Error(`${label} contains an invalid file path`);
    }
    files.push(file);
  }
  if (new Set(files).size !== files.length) throw new Error(`${label} contains duplicate files`);
  return files;
}

export function browserPartitionFiles(files: readonly string[], partition: BrowserPartition): string[] {
  parseBrowserPartition(`${partition.index}/${partition.count}`);
  const sorted = uniqueFiles([...files], 'browser inventory').sort();
  const selected = sorted.filter((_, index) => index % partition.count === partition.index - 1);
  if (!selected.length) throw new Error(`browser partition ${partition.index}/${partition.count} is empty`);
  return selected;
}

function sameFiles(actual: string[], expected: string[], label: string): void {
  if (JSON.stringify([...actual].sort()) !== JSON.stringify([...expected].sort())) {
    throw new Error(`${label} does not match the browser inventory`);
  }
}

function successfulSummary(value: unknown, label: string): asserts value is TestSummary {
  if (!value || typeof value !== 'object') throw new Error(`${label} is missing`);
  const summary = value as TestSummary;
  if (summary.success !== true || !Number.isFinite(summary.durationMs) || summary.durationMs < 0) {
    throw new Error(`${label} did not complete successfully`);
  }
  for (const key of ['tests', 'passed', 'failed', 'cancelled', 'skipped', 'todo'] as const) {
    if (!Number.isSafeInteger(summary.counts?.[key]) || summary.counts[key] < 0) {
      throw new Error(`${label} has invalid test counts`);
    }
  }
  if (summary.counts.failed || summary.counts.cancelled) throw new Error(`${label} has failed or cancelled tests`);
}

/** Require each selected file to finish once at the same checked-out source. */
export function validateBrowserPartitionReports(
  inventory: readonly string[],
  reports: readonly BrowserPartitionReport[],
  source: string,
  selectedPartition?: BrowserPartition,
): string[] {
  if (!/^[0-9a-f]{40}$/.test(source)) throw new Error('browser report source must be a Git commit');
  const expectedPartitions = selectedPartition
    ? [parseBrowserPartition(`${selectedPartition.index}/${selectedPartition.count}`)]
    : Array.from({ length: BROWSER_PARTITION_COUNT }, (_, index) => ({ index: index + 1, count: BROWSER_PARTITION_COUNT }));
  if (reports.length !== expectedPartitions.length) throw new Error('missing or extra browser partition reports');
  const seenPartitions = new Set<number>();
  const observed: string[] = [];
  for (const report of reports) {
    if (report?.schemaVersion !== 1 || report.shard !== 'browser' || report.source !== source) {
      throw new Error('browser partition report has the wrong schema, shard or source');
    }
    const partition = parseBrowserPartition(`${report.partition?.index}/${report.partition?.count}`);
    if (!expectedPartitions.some((expected) => expected.index === partition.index)) {
      throw new Error('unexpected browser partition report');
    }
    if (seenPartitions.has(partition.index)) throw new Error('duplicate browser partition report');
    seenPartitions.add(partition.index);
    const files = uniqueFiles(report.files, 'planned browser files');
    sameFiles(files, browserPartitionFiles(inventory, partition), 'planned browser files');
    if (!Array.isArray(report.summaries)) throw new Error('browser file summaries are missing');
    const completed = uniqueFiles(report.summaries.map((summary) => summary?.file), 'completed browser files');
    sameFiles(completed, files, 'completed browser files');
    for (const summary of report.summaries) successfulSummary(summary, summary.file);
    successfulSummary(report.runSummary, 'final browser run summary');
    observed.push(...completed);
  }
  uniqueFiles(observed, 'combined browser files');
  const expectedFiles = selectedPartition ? browserPartitionFiles(inventory, selectedPartition) : [...inventory];
  sameFiles(observed, expectedFiles, 'combined browser files');
  return observed.sort();
}
