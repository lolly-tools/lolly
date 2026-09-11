#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Regenerate (and optionally validate) EVERY profile's catalog, not just the active one.
 *
 * WHY THIS EXISTS. `catalog/tools/index.json` is generated per BRAND, but `build:catalog`
 * and `validate:catalog` only ever see one profile. So editing a community tool's
 * manifest - one that every brand's index lists - updates that brand's index and
 * silently leaves the others stale. Worse, `validate:catalog` cannot see the drift
 * either, because it validates the same single profile. The failure surfaces somewhere
 * with no context: on a public clone (which has no `brands/suse`, so it resolves
 * `lolly-start`) or in CI, as `"audiogram" version "2.0.0" ≠ manifest "2.1.0"`.
 *
 * That is not hypothetical - it shipped. An audiogram manifest bump left the lolly-start
 * index a version behind for exactly this reason, and it took an adversarial review to
 * notice.
 *
 *   node scripts/build-catalog-all.ts              # rebuild every profile's catalog
 *   node scripts/build-catalog-all.ts --validate   # …and validate each one
 *   node scripts/build-catalog-all.ts --check      # validate only; fail on any drift (CI)
 *
 * NOTHING SHARED IS SWITCHED. This loop used to call scripts/use-profile.ts to rewrite
 * the repo-root `tools/` and `catalog/` symlink views per profile, and then restore the
 * developer's active profile in a `finally` - a dance that mutated the checkout for the
 * duration of the run and could strand someone on a profile they never chose if it
 * threw. The subrepo collapse (plan 244) removed the views: each child process is now
 * given `--profile=<name>` and resolves the packs itself, so there is no shared state to
 * restore and no active profile to preserve.
 *
 * A profile whose packs are not mounted is SKIPPED, not failed: `brands/suse` is a private
 * submodule (`update = none`), so a public clone and CI legitimately cannot build it.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

interface Profile { label?: string; tools: string[]; catalog: string }
interface ProfilesFile { default: string; profiles: Record<string, Profile> }

/** The per-profile catalog pipeline, exactly what `pnpm run build:catalog` runs. */
const BUILD = ['build-catalog-index.ts', 'checksum-assets.ts', 'build-preview-bundle.ts'];

function run(script: string, profile: string): string {
  return execFileSync('node', [join(ROOT, 'scripts', script), `--profile=${profile}`], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

function main(): void {
  const cfg = JSON.parse(readFileSync(join(ROOT, 'profiles.json'), 'utf8')) as ProfilesFile;
  const checkOnly = process.argv.includes('--check');
  const validate = checkOnly || process.argv.includes('--validate');

  const names = Object.keys(cfg.profiles);
  const runnable = names.filter((n) => {
    const p = cfg.profiles[n]!;
    return [...p.tools, p.catalog].every((r) => existsSync(join(ROOT, r)));
  });
  const skipped = names.filter((n) => !runnable.includes(n));

  if (!runnable.length) {
    console.error('✗ no profile has all its packs mounted - a private pack needs `git submodule update --init --checkout brands/suse`');
    process.exitCode = 1;
    return;
  }

  const failures: string[] = [];
  for (const name of runnable) {
    console.log(`\n── ${name} ${cfg.profiles[name]!.label ? `(${cfg.profiles[name]!.label})` : ''}`);
    if (!checkOnly) for (const s of BUILD) process.stdout.write(run(s, name));
    if (validate) {
      try {
        process.stdout.write(run('validate-catalog.ts', name));
      } catch {
        // The validator already printed its own findings to stderr; collect the profile
        // and keep going, so one broken brand does not hide the state of the others.
        failures.push(name);
      }
    }
  }

  if (skipped.length) {
    console.log(`\nℹ skipped (packs not mounted): ${skipped.join(', ')}`);
  }
  if (failures.length) {
    console.error(`\n✗ catalog validation failed for: ${failures.join(', ')}`);
    process.exitCode = 1;
    return;
  }
  console.log(`\n✓ ${checkOnly ? 'validated' : 'rebuilt'} ${runnable.length} profile(s): ${runnable.join(', ')}`);
}

main();
