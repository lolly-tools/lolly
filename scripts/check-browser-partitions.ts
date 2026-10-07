// SPDX-License-Identifier: MPL-2.0
/** Check complete browser execution and exact reviewed skips across runners. */

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  type BrowserPartitionReport,
  type BrowserPartition,
  parseBrowserPartition,
  validateBrowserPartitionReports,
} from './browser-partitions.ts';
import { compareSkips } from './check-skip-identities.ts';
import { shardInventory } from './run-test-suite.ts';
import type { SkipIdentity } from '../tests/reporters/skip-identities.ts';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function reportFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) return reportFiles(filename);
    return entry.isFile() && (entry.name === 'browser-coverage.json' || entry.name === 'test-skips.json') ? [filename] : [];
  }).sort();
}

export function validateBrowserSkips(files: readonly string[], expected: readonly SkipIdentity[], actual: readonly SkipIdentity[]): void {
  const scope = new Set(files);
  const identities = new Set<string>();
  for (const skip of actual) {
    if (!scope.has(skip.file) || !skip.reason || skip.capability === 'unspecified') {
      throw new Error('browser skip is outside the completed files or lacks a recognised reason');
    }
    const identity = JSON.stringify([skip.file, skip.fullName, skip.reason, skip.capability, skip.owner]);
    if (identities.has(identity)) throw new Error('duplicate browser skip identity');
    identities.add(identity);
  }
  const diff = compareSkips(expected.filter((skip) => scope.has(skip.file)), [...actual]);
  if (diff.unexpected.length || diff.stale.length) {
    throw new Error(`browser skip identity drift: ${diff.unexpected.length} unexpected, ${diff.stale.length} stale`);
  }
}

export function checkBrowserReports(
  directory: string,
  inventory: readonly string[],
  expectedSkips: readonly SkipIdentity[],
  source: string,
  partition?: BrowserPartition,
): { files: number; skips: number; reports: number } {
  const paths = reportFiles(directory);
  const coveragePaths = paths.filter((filename) => path.basename(filename) === 'browser-coverage.json');
  const pairedSkipPaths = coveragePaths.map((filename) => path.join(path.dirname(filename), 'test-skips.json')).sort();
  const actualSkipPaths = paths.filter((filename) => path.basename(filename) === 'test-skips.json').sort();
  if (JSON.stringify(pairedSkipPaths) !== JSON.stringify(actualSkipPaths)) throw new Error('missing or extra browser skip reports');
  const reports = coveragePaths.map((filename) => JSON.parse(readFileSync(filename, 'utf8')) as BrowserPartitionReport);
  const files = validateBrowserPartitionReports(inventory, reports, source, partition);
  const skips: SkipIdentity[] = [];
  for (const [index, filename] of coveragePaths.entries()) {
    const skipReport = JSON.parse(readFileSync(path.join(path.dirname(filename), 'test-skips.json'), 'utf8')) as { schemaVersion: number; skips: SkipIdentity[] };
    if (skipReport.schemaVersion !== 1 || !Array.isArray(skipReport.skips)) throw new Error('browser skip report is missing or invalid');
    const planned = new Set(reports[index]?.files);
    if (skipReport.skips.some((skip) => !planned.has(skip.file))) throw new Error('browser skip report belongs to a different partition');
    if (skipReport.skips.length !== reports[index]?.runSummary?.counts.skipped) throw new Error('browser skip report does not match the observed skip count');
    skips.push(...skipReport.skips);
  }
  validateBrowserSkips(files, expectedSkips, skips);
  return { reports: reports.length, files: files.length, skips: skips.length };
}

export function main(argv = process.argv.slice(2)): number {
  const directory = argv.find((arg) => arg.startsWith('--reports-dir='))?.slice('--reports-dir='.length);
  const source = argv.find((arg) => arg.startsWith('--source='))?.slice('--source='.length);
  const partitionArg = argv.find((arg) => arg.startsWith('--partition='))?.slice('--partition='.length);
  if (!directory || !source) throw new Error('--reports-dir and --source are required');
  const checkedOutSource = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim();
  if (source !== checkedOutSource) throw new Error('browser report source differs from the aggregate checkout');
  const expected = JSON.parse(readFileSync(path.join(REPO, 'tests/expected-skips.json'), 'utf8')) as { skips: SkipIdentity[] };
  const result = checkBrowserReports(path.resolve(directory), shardInventory().browser, expected.skips, source, partitionArg ? parseBrowserPartition(partitionArg) : undefined);
  console.log(`browser partitions: ${result.reports} complete reports, ${result.files} files, ${result.skips} exact reviewed skips`);
  return 0;
}

const invoked = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invoked) {
  try { process.exitCode = main(); }
  catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
}
