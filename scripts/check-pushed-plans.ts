#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Refuse to publish a commit that adds or changes a file under plans/.
 *
 * plans/ is the maintainer's private working folder: gitignored and local to one
 * machine, while this repository is public. `git add -f` gets past the ignore
 * rule, so the ignore file alone does not keep those notes private. The pre-push
 * hook runs this on the commits a push would publish, the ones no remote-tracking
 * ref reaches yet, so a private file is stopped before it leaves the machine.
 *
 * Deleting a plans/ file is allowed, so the folder can be emptied. Side branches
 * are always followed (--full-history): the default simplification skips a side
 * branch whose merge leaves plans/ as it was, and that branch's commits are
 * published all the same. A merge counts only for what it changes on its own
 * (--cc), so a commit it brings in is checked once, as itself.
 * tests/no-tracked-plans.test.ts is the CI backstop for a push that skipped the hook.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { pushedTips } from './check-pushed-generated.ts';

const MAX_BUFFER = 64 * 1024 * 1024;

export interface PlansOffence { commit: string; path: string }

function git(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync('git', args, { encoding: 'utf8', maxBuffer: MAX_BUFFER });
  if (result.error) throw result.error;
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** The commit a pushed object names, or null for a tag on a blob or tree. */
function commitOf(object: string): string | null {
  const result = git(['rev-parse', '--verify', '--quiet', '--end-of-options', `${object}^{commit}`]);
  return result.status === 0 ? result.stdout.trim() : null;
}

/** Files under plans/ that commits reachable from `tip`, and from no remote-tracking ref, add or change. */
export function plansIn(tip: string): PlansOffence[] {
  const commit = commitOf(tip);
  if (!commit) return [];
  // The flags pin the output shape against user config such as diff.relative or log.showSignature.
  const result = git(['log', '--no-show-signature', '--no-relative', '--no-color', '--full-history', '--cc',
    '--diff-filter=d', '--name-only', '--format=commit %H', commit, '--not', '--remotes', '--', ':(top)plans/']);
  if (result.status !== 0) throw new Error(`git log failed: ${result.stderr.trim()}`);
  const offences: PlansOffence[] = [];
  let current = '';
  for (const line of result.stdout.split('\n')) {
    if (line.startsWith('commit ')) current = line.slice(7).trim();
    else if (line.trim() && current) offences.push({ commit: current, path: line.trim() });
  }
  return offences;
}

/** Every offence across the pushed tips, each commit and path reported once. */
export function findPlans(tips: string[]): PlansOffence[] {
  const seen = new Set<string>();
  return tips.flatMap(plansIn).filter(offence => {
    const key = `${offence.commit} ${offence.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length === 0) throw new Error('Usage: node scripts/check-pushed-plans.ts --pre-push < ref-updates\n' +
      '   or: node scripts/check-pushed-plans.ts <commit-or-ref> [...]');
    const tips = args[0] === '--pre-push' && args.length === 1
      ? pushedTips(readFileSync(0, 'utf8')).map(tip => tip.object)
      : args;
    const offences = findPlans(tips);
    if (offences.length) {
      console.error('✗ This push would publish private plans/ files:');
      for (const offence of offences) console.error(`  ${offence.commit.slice(0, 9)} ${offence.path}`);
      console.error('plans/ is gitignored and stays on this machine, and the repository is public.\n' +
        'Take the files out of those commits (git rm --cached <path>, then amend or rebase) and push again.');
      process.exitCode = 1;
    } else {
      console.log(`Private plans: no plans/ files in ${tips.length} pushed tip(s).`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
