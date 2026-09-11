#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Bootstrap guard - refuse to `pnpm install` into a checkout with no content.
 *
 * Run as: pnpm install (preinstall)  /  node scripts/check-bootstrap.ts
 *
 * Until the subrepo collapse (plan 244) the shells, services, docs and the
 * community tool pack were git submodules, and this guard existed to turn a
 * clone made without `--recurse-submodules` into one clear instruction instead
 * of a failure deep inside pnpm's workspace resolver. Every pnpm workspace now
 * lives in this repository, so that failure mode is gone.
 *
 * What is left to check is the CONTENT. profiles.json names, per profile, the
 * tool roots and the brand catalog the catalog and profile scripts read right
 * after the install. At least one profile has to be complete on disk, or the
 * postinstall and every `build:catalog` after it have nothing to work with.
 * brands/suse is private and expected to be absent, which is why one complete
 * profile is the bar and not all of them: a public checkout has lolly-start.
 *
 * It is zero-dependency and imports nothing from the workspaces it is checking:
 * at preinstall time node_modules may not exist at all. Only node:fs, node:path
 * and node:url are used.
 *
 * SKIPPING. A guard that false-fails is worse than no guard, so this one only
 * speaks up when it is sure. It skips entirely when:
 *
 *   - LOLLY_SKIP_BOOTSTRAP_CHECK is set (explicit operator override),
 *   - the package is being installed as somebody else's dependency
 *     (this directory sits under a node_modules/, or npm_config_global is set),
 *   - VERCEL is set. The archive deploy tarballs the local tree and a git build
 *     clones the tree whole; the profile resolver owns the Vercel failure modes
 *     and fails loudly there.
 *
 * In CI (the CI env var) the check still runs but only WARNS: if content is
 * genuinely missing, the postinstall fails a second later anyway. Warning keeps
 * the diagnosis in the log without inventing a new way for CI to go red.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROFILES = 'profiles.json';

interface Profile { label?: string; tools?: string[]; catalog?: string }
interface Profiles { profiles?: Record<string, Profile> }

/** One profile and the paths it names that are not on disk. */
interface Report { name: string; missing: string[] }

/** True when we are being installed as a dependency of some other package. */
function installedAsDependency(): boolean {
  if (process.env.npm_config_global === 'true') return true;
  return ROOT.split(sep).includes('node_modules');
}

/** The reason to skip the check outright, or null to run it. */
function skipReason(): string | null {
  if (process.env.LOLLY_SKIP_BOOTSTRAP_CHECK) return 'LOLLY_SKIP_BOOTSTRAP_CHECK is set';
  if (process.env.VERCEL) return 'running on Vercel';
  if (installedAsDependency()) return 'installed as a dependency, not a checkout';
  return null;
}

/**
 * Every profile in profiles.json with the paths it names that are absent. An
 * empty `missing` is a complete profile. Returns null when profiles.json itself
 * cannot be read, which is a different failure with its own message.
 */
function profileReports(root = ROOT): Report[] | null {
  let parsed: Profiles;
  try {
    parsed = JSON.parse(readFileSync(join(root, PROFILES), 'utf8')) as Profiles;
  } catch {
    return null;
  }
  return Object.entries(parsed.profiles ?? {}).map(([name, profile]) => ({
    name,
    missing: [...(profile.tools ?? []), ...(profile.catalog ? [profile.catalog] : [])].filter(
      (path) => !existsSync(join(root, path)),
    ),
  }));
}

function main(): void {
  const skip = skipReason();
  if (skip) return;

  const reports = profileReports();
  if (reports?.some((report) => report.missing.length === 0)) return;

  const warnOnly = !!process.env.CI;
  const log = warnOnly ? console.warn.bind(console) : console.error.bind(console);
  const mark = warnOnly ? '⚠' : '✗';

  log('');
  if (!reports) {
    log(`${mark} This checkout has no readable ${PROFILES} - it is not a complete Lolly tree.`);
  } else if (reports.length === 0) {
    log(`${mark} ${PROFILES} declares no content profiles, so there is nothing to build.`);
  } else {
    log(`${mark} This checkout has no complete content profile - every one is missing files:`);
    log('');
    for (const report of reports) {
      for (const path of report.missing) log(`    ${report.name.padEnd(16)} (missing ${path})`);
    }
  }
  log('');
  log('  A content profile is a set of tool roots plus one brand catalog, named in');
  log(`  ${PROFILES}. The catalog and profile scripts read them immediately after the`);
  log('  install, so at least one profile has to be complete on disk.');
  log('');
  log('  Fix it with a fresh, complete clone:');
  log('');
  log('      git clone https://github.com/lolly-tools/lolly.git');
  log('');
  log('  ...then run `pnpm install` again.');
  log('');
  log('  See the "Getting started" section of README.md for the full first-run walkthrough.');
  log('  (brands/suse is private and is skipped on purpose - a public checkout uses the');
  log('  blank lolly-start profile and everything still builds.)');
  log('');
  log('  To bypass this check, set LOLLY_SKIP_BOOTSTRAP_CHECK=1.');
  log('');

  if (!warnOnly) process.exit(1);
}

main();
