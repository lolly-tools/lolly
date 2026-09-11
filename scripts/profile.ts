#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Print the content profile this checkout resolves to, and where its content lives.
 *
 *   pnpm run profile                     # what am I looking at?
 *   pnpm run profile suse                # what would that profile resolve to?
 *   pnpm run profile --tools             # just the tool ids, one per line
 *
 * `pnpm run profile` used to be `node scripts/use-profile.ts`, which SWITCHED the
 * active profile by rewriting the repo-root tools/ and catalog/ symlink views. The
 * subrepo collapse (plan 244) removed the views, so there is nothing to switch: a
 * profile is resolved per process from profiles.json plus LOLLY_PROFILE, and the way
 * to run something under another brand is to say so on that command
 * (`LOLLY_PROFILE=suse pnpm run cli …`, or `--profile=suse` on a catalog script).
 *
 * What is left is the question people actually asked when they ran it: which brand am
 * I looking at, and which directories is it coming from. Answering that with the real
 * resolver also means this prints exactly what every script, shell and service will
 * see, rather than a second implementation of the same precedence rules.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { type ContentRoots, contentRoots, toolDirs } from '../packages/node-shell/src/content-roots.ts';
import { repoRoot } from '../packages/node-shell/src/repo-root.ts';

import { applyProfileArg } from './lib/profile-arg.ts';

interface Profile { label?: string; tools: string[]; catalog: string; exclude?: string[] }
interface ProfilesFile { default: string; profiles: Record<string, Profile> }

const ROOT = repoRoot();

/** Every profile in profiles.json with whether its packs are all on disk. */
function inventory(): { name: string; label: string; complete: boolean; missing: string[] }[] {
  const cfg = JSON.parse(readFileSync(join(ROOT, 'profiles.json'), 'utf8')) as ProfilesFile;
  return Object.entries(cfg.profiles).map(([name, p]) => {
    const missing = [...p.tools, p.catalog].filter((r) => !existsSync(join(ROOT, r)));
    return { name, label: p.label ?? '', complete: !missing.length, missing };
  });
}

function main(): void {
  // `--profile=<name>` is the form every catalog script takes; a bare name is
  // accepted too, because that is what this command has always been typed as.
  applyProfileArg();
  const named = process.argv.slice(2).find((a) => !a.startsWith('-'));
  if (named) process.env.LOLLY_PROFILE = named;
  const idsOnly = process.argv.includes('--tools');

  let roots: ContentRoots;
  try {
    roots = contentRoots();
  } catch (e) {
    // An unmounted profile is a normal answer to this question, not a crash: print
    // the resolver's own message and what is available instead of a stack trace.
    console.error(`✗ ${e instanceof Error ? e.message : e}`);
    console.error('');
    for (const p of inventory()) {
      console.error(`  ${p.name.padEnd(14)}${p.complete ? 'ready' : `needs ${p.missing.join(', ')}`}`);
    }
    process.exitCode = 1;
    return;
  }
  const ids = [...toolDirs(roots).keys()].sort();

  if (idsOnly) {
    for (const id of ids) console.log(id);
    return;
  }

  const rel = (abs: string): string => relative(ROOT, abs) || '.';
  console.log(`profile      ${roots.profile}`);
  console.log(`tool roots   ${roots.toolRoots.map(rel).join(', ')}`);
  console.log(`catalog      ${rel(roots.catalogRoot)}`);
  console.log(`tools        ${ids.length}`);
  if (roots.exclude.size) console.log(`excluded     ${[...roots.exclude].sort().join(', ')}`);

  const others = inventory().filter((p) => p.name !== roots.profile);
  if (others.length) {
    console.log('');
    console.log('other profiles in profiles.json:');
    for (const p of others) {
      const state = p.complete ? 'ready' : `needs ${p.missing.join(', ')}`;
      console.log(`  ${p.name.padEnd(14)}${p.label ? `${p.label} - ` : ''}${state}`);
    }
    console.log('');
    console.log('  run something under one of those with LOLLY_PROFILE=<name>, or pass');
    console.log('  --profile=<name> to a catalog script. Nothing is switched globally.');
  }
}

main();
