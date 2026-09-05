// SPDX-License-Identifier: MPL-2.0
/** Discover and run deterministic, disjoint node:test shards. */

import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEST_ROOTS = [
  'tests',
  'packages/core/test',
  'packages/node-shell/test',
  'packages/docs-render/test',
  'shells/web/src',
  'shells/tui/src',
  'services/mcp/test',
] as const;

export const SHARDS = [
  'unit:engine',
  'unit:web',
  'contracts',
  'security',
  'tools',
  'browser',
  'tauri',
  'conformance',
  'fuzz:regression',
] as const;
export type TestShard = (typeof SHARDS)[number];

function walk(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory).sort()) {
    const absolute = path.join(directory, entry);
    const stats = statSync(absolute);
    if (stats.isDirectory()) files.push(...walk(absolute));
    else if (/\.test\.(?:ts|js)$/.test(entry)) files.push(absolute);
  }
  return files;
}

export function discoverTests(repo = REPO): string[] {
  return TEST_ROOTS.flatMap((root) => walk(path.join(repo, root)))
    .map((file) => path.relative(repo, file).replaceAll(path.sep, '/'))
    .sort();
}

const SECURITY = /(?:^|[-/.])(?:action|auth|ca-service|catalog-release|chrome-extension-relay|contentseal|csp|egress|gateway-security|hook-worker|integrity|locale-markup|oauth|password|rate-limit|redact|render-secret|scan-secrets|seal|security|ssrf|taint|trust|workflow-pins)(?:[-/.]|$)/;
const CONFORMANCE = /(?:^|[-/.])(?:c2pa|c2patool|conformance|foreign|qpdf|spec-conformance)(?:[-/.]|$)/;
const TOOLS = /(?:^|[-/.])(?:asset-ref|catalog|manifest|profile-tools|tool(?:-|s\.)|tool-render|tools)(?:[-/.]|$)/;
const BROWSER_NAME = /(?:^|[-/.])(?:browser|capture|dom-emitter|export-emitter-golden|playwright|screen-capture|svg-walker|walker)(?:[-/.]|$)/;

export function classifyTest(file: string, repo = REPO): TestShard {
  const normalized = file.replaceAll('\\', '/');
  if (normalized === 'tests/fuzz-regression.test.ts') return 'fuzz:regression';
  if (/tests\/(?:tauri-security|native-file-associations)\.test\.ts$/.test(normalized)) return 'tauri';
  if (CONFORMANCE.test(normalized)) return 'conformance';
  if (SECURITY.test(normalized)) return 'security';
  if (TOOLS.test(normalized)) return 'tools';

  // Browser-dependent tests have historically used many feature-specific names.
  // Classify by their explicit runtime dependency as well as the stable filename.
  const source = readFileSync(path.join(repo, normalized), 'utf8');
  if (
    BROWSER_NAME.test(normalized)
    || /(?:playwright(?:-core)?|LOLLY_BROWSER|no browser|Chromium not installed|shells\/web\/dist)/i.test(source)
  ) return 'browser';

  if (
    normalized.startsWith('packages/')
    || normalized.startsWith('shells/tui/')
    || normalized.startsWith('services/mcp/')
    || /(?:^|[-/.])(?:api-contract|contract|host-v1|parity|schema|snapshot)(?:[-/.]|$)/.test(normalized)
  ) return 'contracts';
  if (normalized.startsWith('shells/web/')) return 'unit:web';
  return 'unit:engine';
}

export function shardInventory(repo = REPO): Record<TestShard, string[]> {
  const inventory = Object.fromEntries(SHARDS.map((shard) => [shard, []])) as unknown as Record<TestShard, string[]>;
  for (const file of discoverTests(repo)) inventory[classifyTest(file, repo)].push(file);
  return inventory;
}

export function main(argv = process.argv.slice(2)): number {
  const requested = argv.find((arg) => !arg.startsWith('-')) ?? 'all';
  if (requested !== 'all' && !SHARDS.includes(requested as TestShard)) {
    console.error(`unknown test shard ${requested}; expected all or ${SHARDS.join(', ')}`);
    return 2;
  }
  const inventory = shardInventory();
  const files = requested === 'all' ? discoverTests() : inventory[requested as TestShard];
  if (argv.includes('--list')) {
    for (const shard of SHARDS) console.log(`${shard.padEnd(16)} ${inventory[shard].length}`);
    if (requested !== 'all') for (const file of files) console.log(`  ${file}`);
    console.log(`${'all'.padEnd(16)} ${discoverTests().length}`);
    return 0;
  }
  if (files.length === 0) {
    console.error(`test shard ${requested} is empty`);
    return 2;
  }
  const started = Date.now();
  const args = ['--import', './tests/css-stub.mjs', '--test'];
  if (process.env.LOLLY_SKIP_REPORT) args.push('--test-reporter=./tests/reporters/skip-identities.ts');
  args.push(...files);
  const result = spawnSync(process.execPath, args, {
    cwd: REPO,
    env: process.env,
    stdio: 'inherit',
  });
  const elapsedSeconds = Math.round((Date.now() - started) / 100) / 10;
  console.error(`test shard ${requested}: ${files.length} files in ${elapsedSeconds}s`);
  if (result.error) throw result.error;
  return result.status ?? 1;
}

const invoked = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invoked) process.exitCode = main();
