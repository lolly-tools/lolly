#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Regenerate (and optionally validate) EVERY profile's catalog, not just the active one.
 *
 * WHY THIS EXISTS. `catalog/tools/index.json` is generated per BRAND, but `build:catalog`
 * and `validate:catalog` only ever see the active profile's view. So editing a community
 * tool's manifest - one that every brand's index lists - updates the active brand's index
 * and silently leaves the others stale. Worse, `validate:catalog` cannot see the drift
 * either, because it validates the active view too. The failure surfaces somewhere with no
 * context: on a public clone (which has no `brands/suse`, so it falls back to
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
 * THE ACTIVE PROFILE IS ALWAYS RESTORED, including when a rebuild throws - switching
 * profiles rewrites the repo-root `tools/` and `catalog/` views, and leaving someone on a
 * profile they did not choose is a worse outcome than the error that caused it.
 *
 * A profile whose packs are not mounted is SKIPPED, not failed: `brands/suse` is a private
 * submodule (`update = none`), so a public clone and CI legitimately cannot build it.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STATE_FILE = join(ROOT, '.lolly-profile');

interface Profile { label?: string; tools: string[]; catalog: string }
interface ProfilesFile { default: string; profiles: Record<string, Profile> }

/** The per-profile catalog pipeline, exactly what `npm run build:catalog` runs. */
const BUILD = ['build-catalog-index.ts', 'checksum-assets.ts', 'build-preview-bundle.ts'];

function run(script: string, args: string[] = []): string {
  return execFileSync('node', [join(ROOT, 'scripts', script), ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

function main(): void {
  const cfg = JSON.parse(readFileSync(join(ROOT, 'profiles.json'), 'utf8')) as ProfilesFile;
  const checkOnly = process.argv.includes('--check');
  const validate = checkOnly || process.argv.includes('--validate');

  // Read the active profile BEFORE anything switches, so the restore below targets what
  // the user actually had rather than whatever the loop left behind.
  const original = existsSync(STATE_FILE) ? readFileSync(STATE_FILE, 'utf8').trim() : null;

  const names = Object.keys(cfg.profiles);
  const runnable = names.filter((n) => {
    const p = cfg.profiles[n]!;
    return [...p.tools, p.catalog].every((r) => existsSync(join(ROOT, r)));
  });
  const skipped = names.filter((n) => !runnable.includes(n));

  if (!runnable.length) {
    console.error('✗ no profile has all its packs mounted - run `git submodule update --init --recursive`');
    process.exitCode = 1;
    return;
  }

  const failures: string[] = [];
  try {
    for (const name of runnable) {
      console.log(`\n── ${name} ${cfg.profiles[name]!.label ? `(${cfg.profiles[name]!.label})` : ''}`);
      run('use-profile.ts', [name]);
      if (!checkOnly) for (const s of BUILD) process.stdout.write(run(s));
      if (validate) {
        try {
          process.stdout.write(run('validate-catalog.ts'));
        } catch {
          // The validator already printed its own findings to stderr; collect the profile
          // and keep going, so one broken brand does not hide the state of the others.
          failures.push(name);
        }
      }
    }
  } finally {
    // Compare against where the loop ACTUALLY left us, not against where it would have
    // ended had it completed: a throw on the first profile can leave us there while the
    // last-profile check says "already correct" and skips the restore.
    const now = existsSync(STATE_FILE) ? readFileSync(STATE_FILE, 'utf8').trim() : null;
    if (original && now !== original) {
      console.log(`\n↩ restoring active profile "${original}"`);
      // Best-effort: a restore that throws must not mask the real error from the loop.
      try { run('use-profile.ts', [original]); }
      catch { console.error(`⚠ could not restore profile "${original}" - run \`npm run profile:${original}\``); }
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
