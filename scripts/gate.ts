#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * The pre-push gate: everything that has to be green before a deploy.
 *
 *   pnpm run gate            # run it on its own
 *   node scripts/gate.ts
 *
 * Ported from `do_build()` in scripts/subrepo/loldev, which the subrepo collapse
 * (plan 244) removed. Only the submodule plumbing died with the bash - the gate
 * itself had nothing to do with submodules, and scripts/ship.ts refuses to deploy
 * without it, so a ship script assembled from the deploy functions alone would be
 * a deploy with no gate.
 *
 * What it runs, in order, stopping at the first failure:
 *
 *   1. pnpm run typecheck                 every project
 *   2. pnpm run test                      the full node:test suite, log kept
 *   3. pnpm run build:catalog             once per ship-target profile
 *   4. pnpm run validate:catalog:all      every mounted profile
 *   5. pnpm run docs:shots --changed      capture + compare the docs screenshots
 *   6. pnpm run check:bundle              boot-JS byte budget
 *   7. pnpm run check:docs-size           built /info byte budget
 *
 * Two things carried over verbatim from the bash, because both were paid for:
 *
 *  - The test log is KEPT. Discarding it meant a failed gate cost a full re-run of
 *    `pnpm test` just to read WHICH test failed. The suite includes
 *    tests/no-trackers.test.ts, where the privacy policy's checkable claims (no
 *    analytics SDK, no DoH resolver, no CA issuance log) are enforced, so a gate
 *    that skipped the tests could let a deploy contradict the published policy.
 *  - The byte budgets are HARD failures, and both scripts MEASURE the last local
 *    build rather than making one, so a missing artifact fails too. An unmeasured
 *    budget is not a passed budget. Run `pnpm run build:web` before shipping so the
 *    numbers describe what is about to go out. Never raise a ceiling to pass this:
 *    the boot bundle drifted to 193.9 KB gz against its own 135 KB ceiling while CI
 *    printed the failure and every deploy went out anyway.
 *
 * What the resolver changed. The catalog loop used to switch the repo-root tools/
 * and catalog/ symlink views to each profile and restore the active one afterwards,
 * which mutated the developer's checkout for the duration of the gate. There are no
 * views any more: each catalog build runs as its own process with the profile pinned
 * in its environment, so nothing shared is touched and there is nothing to restore.
 */

import { spawnSync } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { repoRoot } from '../packages/node-shell/src/repo-root.ts';
import { err, info, ok, phase, step, warn } from './lib/log.ts';
import { shipProfiles } from './lib/ship-targets.ts';

const ROOT = repoRoot();

/** Where a failed gate leaves the test output, so the failure can be read once. */
export const GATE_TEST_LOG = join(tmpdir(), 'lolly-gate-test.log');

/**
 * Run a package script, inheriting stdio. True when it exited 0.
 *
 * `profile` pins the content profile for that one child process. It travels as
 * LOLLY_PROFILE rather than as a `--profile=<name>` argument because pnpm appends
 * forwarded arguments to the END of the script string, and `build:catalog` is three
 * `node` commands joined by `&&` - the flag would reach only the last of them. The
 * resolver reads LOLLY_PROFILE with the same precedence either way, and a child env
 * mutates nothing outside that process.
 */
function pnpmRun(script: string, profile?: string): boolean {
  const r = spawnSync('pnpm', ['--silent', 'run', script], {
    cwd: ROOT,
    stdio: 'inherit',
    env: profile ? { ...process.env, LOLLY_PROFILE: profile } : process.env,
  });
  return r.status === 0;
}

/** Run a package script with its output captured to GATE_TEST_LOG. Exit code only. */
function pnpmRunLogged(script: string): boolean {
  const fd = openSync(GATE_TEST_LOG, 'w');
  try {
    const r = spawnSync('pnpm', ['--silent', 'run', script], {
      cwd: ROOT,
      stdio: ['ignore', fd, fd],
    });
    return r.status === 0;
  } finally {
    closeSync(fd);
  }
}

/** Run a package script for its exit CODE, quietly. docs:shots uses 2 as a signal. */
function pnpmRunCode(script: string, args: string[] = []): number {
  const r = spawnSync('pnpm', ['--silent', 'run', script, ...args], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  return r.status ?? 1;
}

/**
 * The whole gate. True when every step passed; the first failure returns false
 * and prints what to do about it.
 */
export function gate(): boolean {
  phase('🔍', 'Build gate');

  step('type-checking every project');
  if (!pnpmRun('typecheck')) {
    err('typecheck failed - fix it before deploying');
    return false;
  }
  ok('typecheck passed');

  step('running the test suite');
  if (!pnpmRunLogged('test')) {
    err(`tests failed - see ${GATE_TEST_LOG} (or re-run: pnpm test)`);
    return false;
  }
  ok('tests passed');

  // build:catalog re-rolls catalog/previews/bundle.json (pure filesystem, no
  // browser). The heavy Playwright card/look render is a separate, opt-in
  // `pnpm run previews`. Every ship target feeds a live site, so build each
  // target profile's catalog rather than whichever profile this checkout resolves
  // to, and a push cannot break the site nobody is developing in.
  const profiles = shipProfiles();
  for (const profile of profiles) {
    step(`building the '${profile}' catalog`);
    if (!pnpmRun('build:catalog', profile)) {
      err(`build:catalog failed for profile '${profile}'`);
      return false;
    }
    ok(`'${profile}' catalog built`);
  }

  // Validation runs ONCE, after every ship-target catalog is rebuilt, and it
  // validates EVERY mounted profile rather than one. `validate:catalog` alone is
  // not enough: it sees a single profile, so a community tool.json edit that leaves
  // another brand's generated index a version behind passes it. That is the drift
  // that once left the lolly-start audiogram entry a version behind and only
  // surfaced on a public clone.
  step('validating every mounted profile catalog');
  if (!pnpmRun('validate:catalog:all')) {
    err('validate:catalog:all failed - a profile catalog is invalid or has drifted');
    return false;
  }
  ok('all mounted catalogs validated');

  // Docs screenshots - capture the web shell (pinned to the neutral lolly-start
  // brand by the script itself) at every url-shot recipe link written inline in
  // docs/*.md and compare against the committed docs/shots/ baselines. Chromium
  // plus a local vite build, so this only runs on a build machine, never on Vercel.
  // Exit 2 means the shots CHANGED: warn but keep going, because the committed
  // baselines are still valid and promoting new pixels is an explicit
  // `pnpm run docs:shots --accept`. Any other failure blocks the gate.
  //
  // --changed narrows to recipes whose docs page differs from origin/main, so a gate
  // run only re-shoots what a commit could have altered. The tradeoff: an app or
  // engine change that alters an UNCHANGED recipe will not be recaptured here - that
  // needs `pnpm run docs:shots --rebuild` after a renderer change.
  step('docs screenshots (capture + compare, lolly-start brand)');
  const shots = pnpmRunCode('docs:shots', ['--changed']);
  if (shots === 0) ok('docs screenshots verified');
  else if (shots === 2) warn('docs screenshots CHANGED - review, then promote with: pnpm run docs:shots --accept');
  else {
    err('docs screenshot capture failed');
    return false;
  }

  step('byte budgets (boot JS + built /info)');
  if (!pnpmRun('check:bundle')) {
    err('boot-JS budget failed (see the number above) - fix the boot path, do not raise the ceiling');
    return false;
  }
  if (!pnpmRun('check:docs-size')) {
    err('/info size budget failed (see the number above)');
    return false;
  }
  ok('byte budgets passed');

  return true;
}

function main(): void {
  const started = Date.now();
  const passed = gate();
  const secs = Math.round((Date.now() - started) / 1000);
  if (passed) {
    ok(`gate passed in ${secs}s`);
    info('next: pnpm run ship');
    return;
  }
  err(`gate failed after ${secs}s`);
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
