#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Bootstrap guard — refuse to `npm install` into a half-cloned checkout.
 *
 * Run as: npm install (preinstall)  /  node scripts/check-bootstrap.ts
 *
 * Lolly is an umbrella repo: the shells, services, docs and the community tool
 * pack are git submodules (see .gitmodules). npm workspaces need every
 * workspace's package.json to be on disk before the install resolves, so a
 * clone made without `--recurse-submodules` fails deep inside npm's resolver
 * with a message that never mentions submodules. This guard turns that into one
 * clear instruction, printed before npm does any work.
 *
 * It is deliberately zero-dependency and imports nothing from the workspaces it
 * is checking: at preinstall time node_modules may not exist at all. Only
 * node:fs, node:path and node:url are used.
 *
 * SKIPPING. A guard that false-fails is worse than no guard, so this one only
 * speaks up when it is sure. It skips entirely when:
 *
 *   - LOLLY_SKIP_BOOTSTRAP_CHECK is set (explicit operator override),
 *   - the checkout has no .gitmodules or no .git (a published tarball, a
 *     `npm pack` extraction, a vendored copy — there are no submodules to
 *     initialise, so the sentinels legitimately may not be there),
 *   - the package is being installed as somebody else's dependency
 *     (this directory sits under a node_modules/, or npm_config_global is set),
 *   - VERCEL is set. The archive deploy (`loldev ship`) tarballs the local
 *     tree, and a git build clones submodules itself; scripts/use-profile.ts
 *     already owns the Vercel failure modes and fails loudly there.
 *
 * In CI (the CI env var) the check still runs but only WARNS: CI checks out
 * with `submodules: recursive`, and if it ever does not, `npm ci` fails on the
 * missing workspace package.json a second later anyway. Warning keeps the
 * diagnosis in the log without inventing a new way for CI to go red.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Paths that only exist once submodules are initialised. The workspace
 * package.json files are the ones npm itself trips over; docs/build.ts and the
 * community tool pack are what every catalog/profile script needs immediately
 * afterwards. Each entry names the submodule so the message can list them.
 */
interface Sentinel { path: string; submodule: string }

const SENTINELS: Sentinel[] = [
  { path: 'shells/web/package.json', submodule: 'shells/web' },
  { path: 'shells/cli/package.json', submodule: 'shells/cli' },
  { path: 'shells/tui/package.json', submodule: 'shells/tui' },
  { path: 'services/mcp/package.json', submodule: 'services/mcp' },
  { path: 'services/ca/package.json', submodule: 'services/ca' },
  { path: 'docs/build.ts', submodule: 'docs' },
  { path: 'community/_shared', submodule: 'community' },
];

/**
 * brands/suse is deliberately NOT a sentinel. It is `update = none` in
 * .gitmodules, so a public clone is *expected* not to have it and falls back to
 * the lolly-start profile. Failing on it would break every clone without SUSE
 * access.
 */

/** True when this checkout is a real git working tree with submodules declared. */
function looksLikeSubmoduleCheckout(): boolean {
  // .git is a directory in a normal clone and a file in a worktree/submodule.
  return existsSync(join(ROOT, '.git')) && existsSync(join(ROOT, '.gitmodules'));
}

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
  if (!looksLikeSubmoduleCheckout()) return 'not a git checkout with submodules';
  return null;
}

/**
 * Confirm the sentinel list still matches reality: every workspace declared in
 * the root package.json that lives inside a submodule should be covered. This
 * is advisory only (it can never fail the install) and exists so that adding a
 * workspace without adding a sentinel is visible during a normal run.
 */
function uncoveredWorkspaces(): string[] {
  let workspaces: string[] = [];
  let modulePaths: string[] = [];
  try {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    if (Array.isArray(pkg.workspaces)) workspaces = pkg.workspaces.filter((w: unknown) => typeof w === 'string');
  } catch { return []; }
  try {
    const gitmodules = readFileSync(join(ROOT, '.gitmodules'), 'utf8');
    modulePaths = [...gitmodules.matchAll(/^\s*path\s*=\s*(.+)$/gm)].map((m) => m[1]!.trim());
  } catch { return []; }
  const covered = new Set(SENTINELS.map((s) => s.submodule));
  return workspaces.filter(
    (w) => !w.includes('*') && modulePaths.includes(w) && !covered.has(w),
  );
}

function main(): void {
  const skip = skipReason();
  if (skip) return;

  const missing = SENTINELS.filter((s) => !existsSync(join(ROOT, s.path)));
  if (missing.length === 0) {
    for (const w of uncoveredWorkspaces()) {
      console.warn(`⚠ check-bootstrap: workspace "${w}" is a submodule with no sentinel — add one to scripts/check-bootstrap.ts`);
    }
    return;
  }

  const modules = [...new Set(missing.map((m) => m.submodule))];
  const warnOnly = !!process.env.CI;
  const log = warnOnly ? console.warn.bind(console) : console.error.bind(console);

  log('');
  log(`${warnOnly ? '⚠' : '✗'} This clone is incomplete — ${modules.length} submodule${modules.length === 1 ? '' : 's'} ${modules.length === 1 ? 'has' : 'have'} not been initialised:`);
  log('');
  for (const m of missing) log(`    ${m.submodule.padEnd(16)} (missing ${m.path})`);
  log('');
  log('  Lolly is an umbrella repo: the shells, services, docs and the community');
  log('  tool pack live in their own repositories, mounted here as git submodules.');
  log('  npm workspaces need every one of those package.json files on disk, so the');
  log('  install cannot succeed until they are checked out.');
  log('');
  log('  Fix it with:');
  log('');
  log('      git submodule update --init --recursive');
  log('');
  log('  ...then run `npm install` again. Fresh clones should use:');
  log('');
  log('      git clone --recurse-submodules https://github.com/lolly-tools/lolly.git');
  log('');
  log('  See the "Getting started" section of README.md for the full first-run walkthrough.');
  log('  (brands/suse is private and is skipped on purpose — you land on the blank');
  log('  lolly-start brand and everything still builds.)');
  log('');
  log('  To bypass this check deliberately, set LOLLY_SKIP_BOOTSTRAP_CHECK=1.');
  log('');

  if (!warnOnly) process.exit(1);
}

main();
