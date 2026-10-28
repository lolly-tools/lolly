// SPDX-License-Identifier: MPL-2.0
/**
 * The test files fast-lanes.yml runs for the preview's fast deploy lanes (scripts/deploy-lane.ts).
 *
 *   node scripts/fast-lane-tests.ts docs [--list]              # every test that reads the docs
 *   node scripts/fast-lane-tests.ts web-unit 1/2 [--list]      # one part of the unit:web shard
 *
 * The docs selection is every test file that is about the docs by name, or that reads a file under
 * docs/, outside the shards that need a browser, Tauri, conformance tools or the fuzz corpus. A web unit
 * test that reads a docs page (editor-state.test.ts reads docs/url-app-links.md) belongs here too, so a
 * docs-only change still runs that test. The web parts split the unit:web shard of scripts/run-test-suite.ts
 * by position, so two runners finish it in about half the time.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyTest, discoverTests, REPO, type TestShard } from './run-test-suite.ts';

/** Shards whose tests need tools the fast lanes do not install. */
const NEEDS_MORE: ReadonlySet<TestShard> = new Set(['browser', 'tauri', 'conformance', 'fuzz:regression']);
const DOCS_NAME = /(?:^|[/_.-])(?:docs?|info|vernacular|glossary)(?:[/_.-]|$)/;
/** A quoted or relative path into the repository's docs/ directory. */
const DOCS_REFERENCE = /(?:['"`/]|\.\.\/)docs\/|['"`]docs['"`]/;

export function docsTests(repo = REPO): string[] {
  return discoverTests(repo).filter(file => !NEEDS_MORE.has(classifyTest(file, repo))
    && (DOCS_NAME.test(file) || file.startsWith('packages/docs-render/')
      || DOCS_REFERENCE.test(readFileSync(path.join(repo, file), 'utf8'))));
}

export function parsePart(text: string | undefined): { index: number; count: number } {
  const match = /^([1-9][0-9]*)\/([1-9][0-9]*)$/.exec(text ?? '');
  const index = Number(match?.[1]), count = Number(match?.[2]);
  if (!match || index > count || count > 8) throw new Error('Expected a part such as 1/2');
  return { index, count };
}

export function webUnitTests(part: { index: number; count: number }, repo = REPO): string[] {
  return discoverTests(repo).filter(file => classifyTest(file, repo) === 'unit:web')
    .filter((_file, position) => position % part.count === part.index - 1);
}

/** The same node:test arguments scripts/run-test-suite.ts uses for an unpartitioned shard. */
export function runFiles(files: string[]): number {
  if (!files.length) throw new Error('No test files selected');
  const args = ['--import', './tests/css-stub.mjs', '--test'];
  if (process.env.LOLLY_WEBGPU_TEST_ADAPTER) args.push('--import', './tests/browser-gpu.ts');
  const started = Date.now();
  const result = spawnSync(process.execPath, [...args, ...files], { cwd: REPO, stdio: 'inherit', env: process.env });
  console.error(`${files.length} test files in ${Math.round((Date.now() - started) / 1000)} s`);
  if (result.error) throw result.error;
  return result.status ?? 1;
}

export function main(argv = process.argv.slice(2)): number {
  const [selection, part] = argv.filter(arg => !arg.startsWith('--'));
  const files = selection === 'docs' ? docsTests()
    : selection === 'web-unit' ? webUnitTests(parsePart(part))
      : (() => { throw new Error('Usage: fast-lane-tests.ts docs | web-unit <n/count> [--list]'); })();
  if (argv.includes('--list')) {
    for (const file of files) console.log(file);
    return 0;
  }
  return runFiles(files);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();
