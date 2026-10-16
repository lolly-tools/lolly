// SPDX-License-Identifier: MPL-2.0
/**
 * plans/ stays off the public repository.
 *
 * plans/ is gitignored and local to the maintainer's machine, but `git add -f`
 * still commits a file there. The pre-push hook (scripts/check-pushed-plans.ts)
 * stops a new commit that adds one. These tests are the backstop for a push
 * that skipped the hook: qualification fails while any plans/ path is tracked
 * or the ignore rule is gone.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function git(...args: string[]): { status: number | null; stdout: string } {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  assert.ifError(result.error);
  return { status: result.status, stdout: result.stdout };
}

test('no file under plans/ is tracked', () => {
  const listed = git('ls-files', '-z', '--', ':(top)plans');
  assert.equal(listed.status, 0, 'git ls-files failed: is this a Git checkout?');
  const tracked = listed.stdout.split('\0').filter(Boolean);
  assert.deepEqual(tracked, [], [
    `${tracked.length} private plans/ file(s) are tracked:`,
    ...tracked.map(path => `  - ${path}`),
    'plans/ is gitignored and local to one machine, and this repository is public.',
    'Untrack them with git rm --cached <path>; the files stay on disk.',
  ].join('\n'));
});

test('.gitignore still ignores plans/', () => {
  const ignored = git('check-ignore', '-q', '--no-index', '--', 'plans/example.md');
  assert.equal(ignored.status, 0, 'plans/ must stay in .gitignore');
});
