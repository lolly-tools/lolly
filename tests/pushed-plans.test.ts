// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCRIPT = join(ROOT, 'scripts/check-pushed-plans.ts');
const ZERO = '0'.repeat(40);

function fixture(t: test.TestContext) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'lolly-pushed-plans-test-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const work = join(root, 'work');
  const git = (...args: string[]): string => {
    const result = spawnSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false',
      '-c', 'user.name=Plans check test', '-c', 'user.email=test@example.invalid', ...args],
    { cwd: work, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  const write = (name: string, contents: string): void => {
    mkdirSync(dirname(join(work, name)), { recursive: true });
    writeFileSync(join(work, name), contents);
  };
  // `git add -f` is how a private file gets past the ignore rule.
  const commit = (message: string, ...paths: string[]): string => {
    git('add', '-f', '--', ...(paths.length ? paths : ['.']));
    git('commit', '-qm', message);
    return git('rev-parse', 'HEAD');
  };
  const run = (input: string, args = ['--pre-push']) => {
    const result = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: work, encoding: 'utf8', input });
    assert.ifError(result.error);
    return { status: result.status, output: result.stdout + result.stderr };
  };
  mkdirSync(work);
  spawnSync('git', ['init', '-q', '--bare', join(root, 'remote.git')]);
  git('init', '-q', '-b', 'main');
  git('remote', 'add', 'origin', join(root, 'remote.git'));
  write('.gitignore', 'plans/\n');
  write('README.md', 'fixture\n');
  const base = commit('base');
  return { root, work, git, write, commit, run, base };
}

const update = (sha: string, ref = 'refs/heads/topic', old = ZERO): string => `${ref} ${sha} ${ref} ${old}\n`;

test('a pushed commit that adds a plans/ file fails and reports the commit and path', t => {
  const f = fixture(t);
  f.write('plans/312-private-notes.md', 'private\n');
  const added = f.commit('add notes', 'plans/312-private-notes.md');
  f.write('README.md', 'later\n');
  const tip = f.commit('later change');
  const result = f.run(update(tip));
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /would publish private plans\/ files/);
  assert.match(result.output, new RegExp(`${added.slice(0, 9)} plans/312-private-notes\\.md`));
  assert.match(result.output, /git rm --cached/);
});

test('editing a tracked plan or renaming a file into plans/ is caught, deleting a plan is allowed', t => {
  const f = fixture(t);
  f.write('plans/old.md', 'already tracked\n');
  f.commit('tracked plan', 'plans/old.md');
  f.git('push', '-q', 'origin', 'main');
  f.write('plans/old.md', 'edited\n');
  const edited = f.commit('edit plan', 'plans/old.md');
  assert.equal(f.run(update(edited)).status, 1);

  f.git('reset', '-q', '--hard', 'origin/main');
  f.write('docs/note.md', 'public note\n');
  f.commit('public note');
  f.git('push', '-q', 'origin', 'main');
  f.git('mv', 'docs/note.md', 'plans/note.md');
  const renamed = f.commit('rename into plans');
  const result = f.run(update(renamed));
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /plans\/note\.md/);

  f.git('reset', '-q', '--hard', 'origin/main');
  f.git('rm', '-q', 'plans/old.md');
  const deleted = f.commit('remove plan');
  const removal = f.run(update(deleted));
  assert.equal(removal.status, 0, removal.output);
  assert.match(removal.output, /no plans\/ files in 1 pushed tip\(s\)/);
});

test('plans/ files that a remote-tracking ref already reaches are not reported again', t => {
  const f = fixture(t);
  f.write('plans/published.md', 'already public\n');
  f.commit('published plan', 'plans/published.md');
  f.git('push', '-q', 'origin', 'main');
  f.write('README.md', 'unrelated\n');
  const tip = f.commit('unrelated change');
  const result = f.run(update(tip, 'refs/heads/main', f.git('rev-parse', 'origin/main')));
  assert.equal(result.status, 0, result.output);
});

test('a side branch that adds and then removes a plan is caught through its merge', t => {
  const f = fixture(t);
  f.git('push', '-q', 'origin', 'main');
  f.git('checkout', '-q', '-b', 'side');
  f.write('plans/brief.md', 'private\n');
  const added = f.commit('add brief', 'plans/brief.md');
  f.git('rm', '-q', 'plans/brief.md');
  f.commit('remove brief');
  f.git('checkout', '-q', 'main');
  f.write('README.md', 'main moves on\n');
  f.commit('main change');
  f.git('merge', '-q', '--no-edit', 'side');
  const result = f.run(update(f.git('rev-parse', 'HEAD')));
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, new RegExp(`${added.slice(0, 9)} plans/brief\\.md`));
});

test('a merge counts for what it adds itself, not for remote history it brings in', t => {
  const f = fixture(t);
  f.git('checkout', '-q', '-b', 'shared');
  f.write('plans/shared.md', 'already public\n');
  f.commit('shared plan', 'plans/shared.md');
  f.git('push', '-q', 'origin', 'shared');
  f.git('checkout', '-q', 'main');
  f.write('README.md', 'local change\n');
  f.commit('local change');
  f.git('merge', '-q', '--no-edit', 'origin/shared');
  const clean = f.run(update(f.git('rev-parse', 'HEAD')));
  assert.equal(clean.status, 0, clean.output);

  f.git('checkout', '-q', '-b', 'other', f.base);
  f.write('docs/other.md', 'other\n');
  f.commit('other change');
  f.git('checkout', '-q', 'main');
  f.git('merge', '-q', '--no-commit', 'other');
  f.write('plans/merge-only.md', 'added while merging\n');
  const merged = f.commit('merge with a private file', 'plans/merge-only.md');
  const result = f.run(update(merged));
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, new RegExp(`${merged.slice(0, 9)} plans/merge-only\\.md`));
  assert.doesNotMatch(result.output, /plans\/shared\.md/);
});

test('every tip is checked, deletes and unchanged refs are skipped and a blob tag is ignored', t => {
  const f = fixture(t);
  f.git('push', '-q', 'origin', 'main');
  f.git('checkout', '-q', '-b', 'leak');
  f.write('plans/leak.md', 'private\n');
  const leak = f.commit('leak', 'plans/leak.md');
  f.git('checkout', '-q', 'main');
  const blob = f.git('rev-parse', `${f.base}:README.md`);
  f.git('tag', 'blob-tag', blob);
  const clean = update(f.base, 'refs/heads/same', f.base) + update(ZERO, 'refs/heads/gone', leak) +
    update(blob, 'refs/tags/blob-tag');
  const passed = f.run(clean);
  assert.equal(passed.status, 0, passed.output);
  assert.match(passed.output, /no plans\/ files in 1 pushed tip\(s\)/);
  const failed = f.run(clean + update(leak, 'refs/heads/leak'));
  assert.equal(failed.status, 1, failed.output);
  assert.match(failed.output, /plans\/leak\.md/);
});

test('empty input passes, malformed input fails and refs work as arguments', t => {
  const f = fixture(t);
  const empty = f.run('');
  assert.equal(empty.status, 0, empty.output);
  assert.match(empty.output, /no plans\/ files in 0 pushed tip\(s\)/);
  const malformed = f.run('refs/heads/topic not-a-sha refs/heads/topic ' + ZERO + '\n');
  assert.equal(malformed.status, 1, malformed.output);
  assert.match(malformed.output, /Malformed pre-push update/);
  f.write('plans/manual.md', 'private\n');
  f.commit('manual', 'plans/manual.md');
  const manual = f.run('', ['HEAD']);
  assert.equal(manual.status, 1, manual.output);
  assert.match(manual.output, /plans\/manual\.md/);
  assert.equal(f.run('', []).status, 1);
});
