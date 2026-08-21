#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Typecheck the two Tauri shells' bridge-overrides - the brand-gated pattern,
 * applied to a shell dependency instead of a brand pack.
 *
 * Run as: node scripts/typecheck-tauri.ts          (exit 1 on any tsc error)
 *         node scripts/typecheck-tauri.ts --strict (also exit 1 on a SKIP)
 *
 * WHY THIS IS NOT JUST TWO MORE `tsc -p` STEPS IN THE `typecheck` SCRIPT
 * `bridge-overrides/` is the entire application-specific surface of both Tauri
 * shells and was `.js`, outside every tsconfig, until 2026-07-30. Converting it
 * closed that gap - but those files import `@tauri-apps/api` and
 * `@tauri-apps/plugin-fs`, and the Tauri shells are deliberately NOT npm
 * workspaces (their Rust/CLI toolchain has no business in the root install), so
 * those packages live only in each shell's own node_modules. A root `npm ci`
 * does not create them.
 *
 * So a bare `tsc -p shells/tauri-desktop` in the `typecheck` script would fail
 * on every clone that had not separately run `npm --prefix shells/tauri-desktop
 * ci` - including CI, until its typecheck job installs them. A gate that fails
 * for a missing optional dependency is a gate people learn to ignore.
 *
 * Instead: skip with a logged reason when the shell's node_modules is absent,
 * exactly as tests/…/text-outline-golden.test.ts skips when brands/suse is not
 * mounted. CI installs both shells (production deps only - the types are all we
 * need, and that skips the Tauri CLI and Vite) so the gate is REAL there, and
 * `--strict` makes a skip fail so the CI job cannot silently degrade into a
 * no-op if that install step is ever dropped.
 *
 * The shared logic both shells call into (shells/tauri-shared/bridge-overrides/)
 * needs no Tauri packages - the dependency is inverted through an `fs` adapter
 * precisely so the parent repo can own it - so it has its own tsconfig and is
 * typechecked unconditionally by the main `typecheck` script. This script covers
 * only the two platform seams.
 */

import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The shells whose overrides need their own node_modules to typecheck. */
const SHELLS = ['shells/tauri-desktop', 'shells/tauri-mobile'];

/** A package each shell must have installed for its overrides to resolve. Named
 *  rather than just testing for node_modules/, so a half-finished install (the
 *  directory exists, the dependency does not) reports as a skip rather than
 *  failing with a wall of TS2307s. */
const PROBE = '@tauri-apps/api';

export interface ShellResult {
  shell: string;
  status: 'ok' | 'failed' | 'skipped';
  reason?: string;
}

function typecheckShell(shell: string): ShellResult {
  const dir = join(ROOT, shell);
  if (!existsSync(join(dir, 'tsconfig.json'))) {
    return { shell, status: 'skipped', reason: 'no tsconfig.json - shell submodule not checked out' };
  }
  if (!existsSync(join(dir, 'node_modules', PROBE))) {
    return {
      shell,
      status: 'skipped',
      reason: `${PROBE} not installed - run \`npm --prefix ${shell} ci\` (the Tauri shells are not npm workspaces)`,
    };
  }
  const tsc = join(ROOT, 'node_modules/.bin/tsc');
  const run = spawnSync(tsc, ['-p', dir], { stdio: 'inherit', cwd: ROOT });
  if (run.error) return { shell, status: 'failed', reason: String(run.error) };
  return run.status === 0 ? { shell, status: 'ok' } : { shell, status: 'failed', reason: `tsc exited ${run.status}` };
}

export function typecheckTauriShells(): ShellResult[] {
  return SHELLS.map(typecheckShell);
}

// Only run when invoked directly, so a test can import the pieces above
// (same guard as scripts/build-catalog-index.ts).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const strict = process.argv.includes('--strict');
  const results = typecheckTauriShells();
  for (const r of results) {
    if (r.status === 'ok') console.log(`✓ ${r.shell} - bridge-overrides typecheck clean`);
    else if (r.status === 'skipped') console.log(`- ${r.shell} - SKIPPED: ${r.reason}`);
    else console.error(`✗ ${r.shell} - ${r.reason}`);
  }
  const failed = results.filter((r) => r.status === 'failed');
  const skipped = results.filter((r) => r.status === 'skipped');
  if (failed.length) process.exit(1);
  if (strict && skipped.length) {
    console.error(
      `\n--strict: ${skipped.length} shell(s) skipped, but this run demanded real coverage.\n` +
        'Install them first: npm --prefix shells/tauri-desktop ci --omit=dev' +
        ' && npm --prefix shells/tauri-mobile ci --omit=dev',
    );
    process.exit(1);
  }
}
