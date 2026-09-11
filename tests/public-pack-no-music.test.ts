// SPDX-License-Identifier: MPL-2.0
/**
 * The licensed music must not be tracked in a public pack.
 *
 * The PremiumBeat/Shutterstock beds under `catalog/assets/suse/music/` are licensed
 * for SUSE use and live in the PRIVATE brands/suse pack, which is a submodule with
 * `update = none` so a public clone never fetches it. Publishing them by accident is
 * not a build failure, it is a licence breach, and the only way to notice a
 * misplaced copy is to look for one.
 *
 * `scripts/subrepo/verify.sh` looked for one, but only when somebody ran it by hand,
 * and it went away with the rest of the bash in the subrepo collapse (plan 244). So
 * the check moved here, where every `pnpm test` run makes it.
 *
 * Why `git ls-files` over the whole repository is the right sweep. brands/suse is a
 * gitlink: its contents are tracked by that submodule, not by this repository, so
 * git never lists them here. Anything this sweep finds is therefore tracked in a
 * PUBLIC path by definition, which is exactly the condition to fail on. An untracked
 * working copy is somebody's local scratch and is not published by anything.
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Where the licensed beds live inside the private pack's catalog. */
const MUSIC_REL = 'assets/suse/music';

/** Audio containers a music bed could arrive in. */
const AUDIO = /\.(mp3|wav|flac|m4a|aac|ogg|opus|aiff?|wma)$/i;

/** Every path this repository tracks, submodule contents excluded by git itself. */
function trackedFiles(): string[] {
  const out = execFileSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return out.split('\n').filter(Boolean);
}

test('the sweep can see the tree it is checking', () => {
  // A negative assertion that runs against an empty list passes for the wrong
  // reason. Anchor it: git has to be answering, and with a plausible number of files.
  const tracked = trackedFiles();
  assert.ok(tracked.length > 1000, `git ls-files returned ${tracked.length} paths - the sweep below would be vacuous`);
  assert.ok(tracked.includes('profiles.json'), 'git ls-files did not list profiles.json - not a repository root?');
});

test('no licensed music path is tracked in this repository', () => {
  const hits = trackedFiles().filter((p) => p.includes(MUSIC_REL));
  assert.deepEqual(
    hits,
    [],
    `${MUSIC_REL} is licensed and belongs only in the private brands/suse pack. ` +
    `Tracked here: ${hits.join(', ')}`,
  );
});

test('no audio file sits in a music/ directory of a public pack', () => {
  // The broader form of the same rule: a bed copied under a different brand name is
  // still a bed. community/ and brands/lolly-start/ are the public packs, and
  // neither ships music - their audio arrives from a connected instance or a .lolly
  // pack. Tool-local sound effects would be a deliberate exception and should be
  // named here with a reason rather than being allowed by a loose pattern.
  const hits = trackedFiles().filter(
    (p) =>
      (p.startsWith('community/') || p.startsWith('brands/lolly-start/')) &&
      /(^|\/)music\//.test(p) &&
      AUDIO.test(p),
  );
  assert.deepEqual(hits, [], `audio tracked in a public pack's music/ directory: ${hits.join(', ')}`);
});
