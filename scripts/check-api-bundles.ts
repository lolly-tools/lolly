#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Compare the committed api/ function bundles with a fresh build (run after
 * build:mcp-fn, build:ca-fn and build:penpot-fn, as CI's "api bundle drift" job does).
 *
 * A push, a tag or any event other than a pull request is strict: drift fails, so a
 * main commit whose committed bundles differ from their sources never qualifies, and
 * nothing that requires a successful main push run can take that commit. A pull request is
 * responsible only for its own changes: if it changes anything the bundles are built
 * from, the bundles must match; if it changes none of that, drift can only come from
 * earlier merges, so it is a warning. .github/workflows/generated-readmes.yml rebuilds
 * the bundles after each merge and proposes them in its single bot pull request.
 *
 *   node scripts/check-api-bundles.ts   (reads GITHUB_EVENT_NAME and CI_BASE_SHA)
 */
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/**
 * Paths whose change can change an api/ bundle: a deliberate superset of what the four
 * builds read, measured from their esbuild inputs on 2026-10-24 (engine, packages,
 * services, schemas, shells/cli and, through the embedded page walk, shells/web/src),
 * plus the build scripts, workspace manifests, lockfiles and compiler settings.
 * Documentation and test files are never bundled.
 */
const INPUTS = [
  /^api\//,
  /^(?:engine|packages|services|schemas)\//,
  /^shells\/(?:cli|web\/src)\//,
  /^scripts\/(?:build-(?:mcp|ca|penpot)-fn|mcp-fn-[a-z-]+)\.ts$/,
  /^scripts\/lib\//,
  /(?:^|\/)(?:package\.json|tsconfig[^/]*\.json)$/,
  /^(?:pnpm-lock\.yaml|pnpm-workspace\.yaml|\.npmrc)$/,
];
const NEVER_BUNDLED = [/\.md$/, /\.test\.(?:ts|js|mjs)$/, /(?:^|\/)(?:test|tests|fixtures)\//];

/** True when a changed path can change what an api/ bundle contains. */
export function isBundleInput(path: string): boolean {
  if (path.startsWith('api/')) return true;
  return INPUTS.some(re => re.test(path)) && !NEVER_BUNDLED.some(re => re.test(path));
}

export type Verdict = { status: 'clean' | 'fail' | 'warn'; inputs: string[] };

/**
 * `changed` is the pull request's own changed paths, or null when they are unknown
 * (not a pull request, or its base commit is unavailable), which keeps the check strict.
 */
export function judge(drift: boolean, event: string | undefined, changed: string[] | null): Verdict {
  if (!drift) return { status: 'clean', inputs: [] };
  if (event !== 'pull_request' || changed === null) return { status: 'fail', inputs: [] };
  const inputs = changed.filter(isBundleInput);
  return { status: inputs.length ? 'fail' : 'warn', inputs };
}

const git = (...args: string[]): string => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

/** The pull request's changed paths: its merge commit against the base it merges into. */
function pullRequestChanges(base: string | undefined): string[] | null {
  if (!base || !/^[0-9a-f]{40}$/.test(base)) return null;
  try {
    // CI checks out GitHub's merge commit, whose first parent is the base.
    if (git('rev-parse', 'HEAD^1').trim() !== base) return null;
    return git('diff', '--name-only', '--no-renames', base, 'HEAD').split('\n').filter(Boolean);
  } catch { return null; }
}

function main(): void {
  const changedBundles = git('status', '--porcelain', '--untracked-files=all', '--', 'api/').split('\n').filter(Boolean);
  const event = process.env.GITHUB_EVENT_NAME;
  const verdict = judge(changedBundles.length > 0, event,
    event === 'pull_request' ? pullRequestChanges(process.env.CI_BASE_SHA) : null);
  const annotate = process.env.GITHUB_ACTIONS === 'true';
  if (verdict.status === 'clean') { console.log('The committed api/ bundles match their sources.'); return; }
  console.log(git('--no-pager', 'diff', '--stat', '--', 'api/'));
  if (verdict.status === 'warn') {
    const note = 'The committed api/ bundles differ from their sources, but this pull request changes nothing they are built from, '
      + 'so the drift came from earlier merges. Nothing to do here: .github/workflows/generated-readmes.yml proposes the '
      + 'rebuilt bundles after each merge, and main stays strict until they merge.';
    console.log(annotate ? `::warning title=api bundle drift from earlier merges::${note}` : note);
    return;
  }
  const why = verdict.inputs.length
    ? `this pull request changes what they are built from (${verdict.inputs.slice(0, 5).join(', ')}${verdict.inputs.length > 5 ? ', ...' : ''})`
    : `a ${event ?? 'local'} run is strict, because deployment and release qualification take the exact main commit`;
  const message = `The committed api/ bundles differ from their sources and ${why}. `
    + 'Run pnpm run build:mcp-fn && pnpm run build:ca-fn && pnpm run build:penpot-fn and commit api/.';
  console.error(annotate ? `::error title=api bundle drift::${message}` : message);
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
