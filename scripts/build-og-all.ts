#!/usr/bin/env node
/**
 * Rebuild the OG share cards for EVERY mounted profile, not just the active one.
 *
 * WHY THIS EXISTS. The per-tool cards (catalog/og/<id>.png) and per-view cards
 * (catalog/og/views/<slug>.png) are COMMITTED into each brand's catalog, but
 * `npm run og` (build-tool-og.ts + build-view-og.ts) only ever renders into the
 * active profile's catalog/ view — the exact per-brand drift problem
 * build-catalog-all.ts fixes for tools/index.json. Editing a community tool's
 * card inputs (name, description, icon, preview) refreshed the active brand's
 * cards and silently left the other brand's stale.
 *
 *   node scripts/build-og-all.ts               # rebuild every mounted profile's cards
 *   node scripts/build-og-all.ts --preserve    # keep existing cards, fill gaps only
 *
 * The stubs (shells/web/public/t/*.html, view/*.html) are gitignored and
 * per-deploy, so only the LAST profile's stubs remain on disk — the loop runs the
 * original/active profile last so what's left matches what you had. THE ACTIVE
 * PROFILE IS ALWAYS RESTORED, including when a render throws (same contract as
 * build-catalog-all.ts). Profiles whose packs aren't mounted are SKIPPED, not
 * failed: brands/suse is a private submodule a public clone legitimately lacks.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STATE_FILE = join(ROOT, '.lolly-profile');

interface Profile { label?: string; tools: string[]; catalog: string }
interface ProfilesFile { default: string; profiles: Record<string, Profile> }

/** The per-profile OG pipeline, exactly what `npm run og` runs. */
const OG = ['build-tool-og.ts', 'build-view-og.ts'];

// --preserve is forwarded to the card scripts (they also honour LOLLY_PRESERVE=1,
// which loldev exports so the flag survives the npm chain).
const preserve = process.argv.includes('--preserve');

function run(script: string, args: string[] = []): void {
  execFileSync('node', [join(ROOT, 'scripts', script), ...args], {
    cwd: ROOT,
    stdio: 'inherit',
  });
}

function main(): void {
  const cfg = JSON.parse(readFileSync(join(ROOT, 'profiles.json'), 'utf8')) as ProfilesFile;

  // Read the active profile BEFORE anything switches, so the restore below targets
  // what the user actually had rather than whatever the loop left behind.
  const original = existsSync(STATE_FILE) ? readFileSync(STATE_FILE, 'utf8').trim() : null;

  const names = Object.keys(cfg.profiles);
  const runnable = names.filter((n) => {
    const p = cfg.profiles[n]!;
    return [...p.tools, p.catalog].every((r) => existsSync(join(ROOT, r)));
  });
  const skipped = names.filter((n) => !runnable.includes(n));

  if (!runnable.length) {
    console.error('✗ no profile has all its packs mounted — run `git submodule update --init --recursive`');
    process.exitCode = 1;
    return;
  }

  // Run the active profile LAST so the gitignored stubs left on disk (and any
  // dev-server state) belong to the profile the user is actually on.
  if (original && runnable.includes(original)) {
    runnable.splice(runnable.indexOf(original), 1);
    runnable.push(original);
  }

  try {
    for (const name of runnable) {
      console.log(`\n── ${name} ${cfg.profiles[name]!.label ? `(${cfg.profiles[name]!.label})` : ''}`);
      run('use-profile.ts', [name]);
      for (const s of OG) run(s, preserve ? ['--preserve'] : []);
    }
  } finally {
    // Compare against where the loop ACTUALLY left us — a throw mid-loop can strand
    // us on a profile the user didn't choose.
    const now = existsSync(STATE_FILE) ? readFileSync(STATE_FILE, 'utf8').trim() : null;
    if (original && now !== original) {
      console.log(`\n↩ restoring active profile "${original}"`);
      // Best-effort: a restore that throws must not mask the real error from the loop.
      try { run('use-profile.ts', [original]); }
      catch { console.error(`⚠ could not restore profile "${original}" — run \`npm run profile:${original}\``); }
    }
  }

  if (skipped.length) {
    console.log(`\nℹ skipped (packs not mounted): ${skipped.join(', ')}`);
  }
  console.log(`\n✓ rebuilt OG cards for ${runnable.length} profile(s): ${runnable.join(', ')}`);
}

main();
