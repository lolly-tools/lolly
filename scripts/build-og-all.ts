#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Rebuild the OG share cards for EVERY mounted profile, not just the active one.
 *
 * WHY THIS EXISTS. The per-tool cards (catalog/og/<id>.png) and per-view cards
 * (catalog/og/views/<slug>.png) are COMMITTED into each brand's catalog, but
 * `pnpm run og` (build-tool-og.ts + build-view-og.ts) only ever renders into one
 * profile's catalog - the same per-brand drift problem build-catalog-all.ts fixes
 * for tools/index.json. Editing a community tool's card inputs (name, description,
 * icon, preview) refreshed that brand's cards and silently left the other brand's
 * stale.
 *
 *   node scripts/build-og-all.ts               # rebuild every mounted profile's cards
 *   node scripts/build-og-all.ts --preserve    # keep existing cards, fill gaps only
 *
 * The stubs (shells/web/public/t/*.html, view/*.html) are gitignored and
 * per-deploy, so only the LAST profile's stubs remain on disk - the loop runs this
 * checkout's own profile last, so what is left matches what you had.
 *
 * NOTHING SHARED IS SWITCHED. This loop used to rewrite the repo-root tools/ and
 * catalog/ symlink views per profile and restore the active one in a `finally`; the
 * subrepo collapse (plan 244) removed the views, so each child process is given
 * `--profile=<name>` and resolves the packs itself. Profiles whose packs aren't
 * mounted are SKIPPED, not failed: brands/suse is a private submodule a public clone
 * legitimately lacks.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { contentRoots } from '../packages/node-shell/src/content-roots.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

interface Profile { label?: string; tools: string[]; catalog: string }
interface ProfilesFile { default: string; profiles: Record<string, Profile> }

/** The per-profile OG pipeline, exactly what `pnpm run og` runs. */
const OG = ['build-tool-og.ts', 'build-view-og.ts'];

// --preserve is forwarded to the card scripts (they also honour LOLLY_PRESERVE=1,
// for a caller that has to get the flag through an npm script chain).
const preserve = process.argv.includes('--preserve');

function run(script: string, profile: string, args: string[] = []): void {
  execFileSync('node', [join(ROOT, 'scripts', script), `--profile=${profile}`, ...args], {
    cwd: ROOT,
    stdio: 'inherit',
  });
}

function main(): void {
  const cfg = JSON.parse(readFileSync(join(ROOT, 'profiles.json'), 'utf8')) as ProfilesFile;

  // This checkout's own profile, used only to order the loop: the gitignored stubs
  // are overwritten per profile, so the last iteration should be the one whose stubs
  // a developer expects to find afterwards.
  let original: string | null = null;
  try { original = contentRoots().profile; } catch { /* no complete profile: reported below */ }

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

  // Run this checkout's own profile LAST so the gitignored stubs left on disk (and
  // any dev-server state) belong to the profile the user is actually on.
  if (original && runnable.includes(original)) {
    runnable.splice(runnable.indexOf(original), 1);
    runnable.push(original);
  }

  for (const name of runnable) {
    console.log(`\n── ${name} ${cfg.profiles[name]!.label ? `(${cfg.profiles[name]!.label})` : ''}`);
    for (const s of OG) run(s, name, preserve ? ['--preserve'] : []);
  }

  if (skipped.length) {
    console.log(`\nℹ skipped (packs not mounted): ${skipped.join(', ')}`);
  }
  console.log(`\n✓ rebuilt OG cards for ${runnable.length} profile(s): ${runnable.join(', ')}`);
}

main();
