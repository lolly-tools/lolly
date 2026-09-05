// SPDX-License-Identifier: MPL-2.0
/** Compare a node:test skip report with the exact reviewed CI baseline. */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { SkipIdentity } from '../tests/reporters/skip-identities.ts';
import { classifyTest, SHARDS, type TestShard } from './run-test-suite.ts';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXPECTED = path.join(REPO, 'tests', 'expected-skips.json');

interface SkipManifest { schemaVersion: 1; environment: string; skips: SkipIdentity[] }
function key(skip: SkipIdentity): string {
  return `${skip.file}\0${skip.fullName}\0${skip.reason}\0${skip.capability}\0${skip.owner}`;
}

export function compareSkips(expected: SkipIdentity[], actual: SkipIdentity[]): { unexpected: SkipIdentity[]; stale: SkipIdentity[] } {
  const expectedKeys = new Set(expected.map(key));
  const actualKeys = new Set(actual.map(key));
  return {
    unexpected: actual.filter((skip) => !expectedKeys.has(key(skip))),
    stale: expected.filter((skip) => !actualKeys.has(key(skip))),
  };
}

function load(filename: string): SkipManifest {
  const parsed = JSON.parse(readFileSync(filename, 'utf8')) as SkipManifest;
  if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.skips)) throw new Error(`${filename} is not a skip manifest`);
  return parsed;
}

export function main(argv = process.argv.slice(2)): number {
  const reportArgs = argv.filter((arg) => arg.startsWith('--report=')).map((arg) => path.resolve(arg.slice('--report='.length)));
  const reports = reportArgs.length ? reportArgs : [path.resolve(process.env.LOLLY_SKIP_REPORT ?? 'artifacts/test-skips.json')];
  const loaded = reports.map(load);
  const actual: SkipManifest = {
    schemaVersion: 1,
    environment: loaded[0]?.environment ?? 'ci-ubuntu',
    skips: loaded.flatMap((report) => report.skips),
  };
  for (const skip of actual.skips) {
    if (!skip.reason) throw new Error(`${skip.file}: ${skip.fullName}: skipped without a reason`);
    if (skip.capability === 'unspecified') throw new Error(`${skip.file}: ${skip.fullName}: skip reason has no recognised capability`);
  }
  if (argv.includes('--write')) {
    writeFileSync(EXPECTED, `${JSON.stringify({ ...actual, environment: 'ci-ubuntu' }, null, 2)}\n`);
    console.log(`wrote ${actual.skips.length} exact skip identities to ${path.relative(REPO, EXPECTED)}`);
    return 0;
  }
  const expected = load(EXPECTED);
  const shardArg = argv.find((arg) => arg.startsWith('--shard='))?.slice('--shard='.length);
  if (shardArg && !SHARDS.includes(shardArg as TestShard)) throw new Error(`unknown test shard: ${shardArg}`);
  const inScope = (skip: SkipIdentity): boolean => !shardArg || classifyTest(skip.file) === shardArg;
  const expectedSkips = expected.skips.filter(inScope);
  const actualSkips = actual.skips.filter(inScope);
  const outOfScope = actual.skips.filter((skip) => !inScope(skip));
  if (outOfScope.length) throw new Error(`${outOfScope.length} reported skips do not belong to shard ${shardArg}`);
  const diff = compareSkips(expectedSkips, actualSkips);
  for (const skip of diff.unexpected) console.error(`unexpected skip: ${skip.file} :: ${skip.fullName} :: ${skip.reason}`);
  for (const skip of diff.stale) console.error(`stale expected skip: ${skip.file} :: ${skip.fullName} :: ${skip.reason}`);
  if (diff.unexpected.length || diff.stale.length) {
    console.error(`skip identity drift: ${diff.unexpected.length} unexpected, ${diff.stale.length} stale`);
    return 1;
  }
  console.log(`skip identities: ${actualSkips.length} exact CI skips match${shardArg ? ` for ${shardArg}` : ''}`);
  return 0;
}

const invoked = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invoked) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
