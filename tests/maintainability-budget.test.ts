// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import type { MaintainabilityBaseline } from '../scripts/check-maintainability-budget.ts';
import { changedProductionModules, compare, resolveChangeBase } from '../scripts/check-maintainability-budget.ts';

function baseline(lines = 2_100): MaintainabilityBaseline {
  return {
    version: 1,
    scope: 'shells/web/src',
    exclusions: [],
    modules: {
      'shells/web/src/views/hot.ts': {
        lines,
        largestFunctionLines: 200,
        importFanIn: 2,
        importFanOut: 3,
        typeEscapes: 4,
      },
    },
    cycles: [],
  };
}

test('hotspots cannot grow and improvements require ratcheting the baseline', () => {
  const grown = baseline(2_101);
  assert.match(compare(baseline(), grown, new Set()).errors.join('\n'), /hotspot grew/);

  const reduced = baseline(2_099);
  assert.match(compare(baseline(), reduced, new Set()).errors.join('\n'), /budget improved/);

  const belowReportingThreshold = baseline();
  delete belowReportingThreshold.modules['shells/web/src/views/hot.ts'];
  assert.match(
    compare(baseline(), belowReportingThreshold, new Set()).errors.join('\n'),
    /budget entry disappeared/,
  );
});

test('changed hotspot functions and type escapes cannot grow', () => {
  const current = baseline();
  current.modules['shells/web/src/views/hot.ts']!.largestFunctionLines = 201;
  current.modules['shells/web/src/views/hot.ts']!.typeEscapes = 5;
  const result = compare(baseline(), current, new Set(['shells/web/src/views/hot.ts']));
  assert.match(result.errors.join('\n'), /largest function grew/);
  assert.match(result.errors.join('\n'), /type-escape markers grew/);
});

test('new hard-limit modules and new cycles fail', () => {
  const current = baseline();
  current.modules['shells/web/src/views/new.ts'] = {
    lines: 2_501,
    largestFunctionLines: 20,
    importFanIn: 0,
    importFanOut: 0,
    typeEscapes: 0,
  };
  current.cycles = [['shells/web/src/a.ts', 'shells/web/src/b.ts']];
  const result = compare(baseline(), current, new Set());
  assert.match(result.errors.join('\n'), /new production module/);
  assert.match(result.errors.join('\n'), /new dependency cycle/);
});

// File selection. The function and type-escape ratchets judge only changed files, so a
// change that arrives committed (a pull request in CI, a push to main) must count, and a
// file that a merge brings in unchanged from main must not.

const A = 'shells/web/src/views/a.ts';
const B = 'shells/web/src/views/b.ts';
const C = 'shells/web/src/views/c.ts';
const D = 'shells/web/src/views/d.ts';

function fixture(t: test.TestContext) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'lolly-maintainability-test-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const work = join(root, 'work');
  // Only what git needs: no user config, no CI variables and no GIT_DIR from a calling hook.
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    HOME: root,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: join(root, 'no-global-gitconfig'),
    GIT_AUTHOR_NAME: 'Maintainability test',
    GIT_AUTHOR_EMAIL: 'test@example.invalid',
    GIT_COMMITTER_NAME: 'Maintainability test',
    GIT_COMMITTER_EMAIL: 'test@example.invalid',
  };
  const gitIn = (cwd: string, ...args: string[]): string => {
    const result = spawnSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false', ...args], {
      cwd,
      env,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
    return result.stdout.trim();
  };
  const git = (...args: string[]): string => gitIn(work, ...args);
  const write = (name: string, text: string): void => {
    mkdirSync(dirname(join(work, name)), { recursive: true });
    writeFileSync(join(work, name), text);
  };
  const commit = (message: string): string => {
    git('add', '-A');
    git('commit', '-qm', message);
    return git('rev-parse', 'HEAD');
  };
  /** Point origin/main at local main, as a fetch would. */
  const publish = (): void => {
    git('update-ref', 'refs/remotes/origin/main', 'refs/heads/main');
  };
  const select = (extra: NodeJS.ProcessEnv = {}, cwd = work): string[] =>
    [...changedProductionModules({ cwd, env: { ...env, ...extra } }).changed].sort();
  const base = (extra: NodeJS.ProcessEnv = {}) => resolveChangeBase({ cwd: work, env: { ...env, ...extra } });

  mkdirSync(work);
  git('init', '-q', '-b', 'main');
  write(A, 'export const a = 1;\n');
  write(B, 'export const b = 1;\n');
  write(C, 'export const c1 = 1;\n\n\n\n\nexport const c2 = 2;\n');
  write('shells/web/src/views/a.test.ts', 'export {};\n');
  write('engine/src/e.ts', 'export const e = 1;\n');
  commit('base');
  publish();
  return { root, work, env, git, gitIn, write, commit, publish, select, base };
}

test('a committed change on a branch counts with a clean working tree', (t) => {
  const f = fixture(t);
  f.git('switch', '-qc', 'topic');
  f.write(A, 'export const a = 2;\n');
  f.commit('topic: a');
  assert.deepEqual(f.select(), [A]);
  assert.match(f.base().source, /^merge base of HEAD and origin\/main/);
});

test('uncommitted and untracked web modules count; tests and other packages do not', (t) => {
  const f = fixture(t);
  f.write(B, 'export const b = 2;\n');
  f.write(D, 'export const d = 1;\n');
  f.write('shells/web/src/views/a.test.ts', 'export const changed = true;\n');
  f.write('engine/src/e.ts', 'export const e = 2;\n');
  assert.deepEqual(f.select(), [B, D]);
});

test('a merge from main counts only the branch\'s own files, during and after the merge', (t) => {
  const f = fixture(t);
  f.git('switch', '-qc', 'topic');
  f.write(A, 'export const a = 2;\n');
  f.write(C, 'export const c1 = 10;\n\n\n\n\nexport const c2 = 2;\n');
  f.commit('topic: a and the top of c');
  f.git('switch', '-q', 'main');
  f.write(B, 'export const b = 2;\n');
  f.write(C, 'export const c1 = 1;\n\n\n\n\nexport const c2 = 20;\n');
  f.commit('main: b and the end of c');
  f.publish();
  f.git('switch', '-q', 'topic');

  // b.ts arrives unchanged from main. c.ts holds both sides, so the branch changes c.ts.
  f.git('merge', '--no-commit', '--no-ff', 'origin/main');
  assert.deepEqual(f.select(), [A, C]);
  assert.match(f.base().source, /^MERGE_HEAD, a merge from origin\/main in progress/);

  f.git('commit', '-q', '--no-edit');
  assert.deepEqual(f.select(), [A, C]);
});

test('a merge of another branch still counts the files it brings in', (t) => {
  const f = fixture(t);
  f.git('switch', '-qc', 'other');
  f.write(B, 'export const b = 3;\n');
  f.commit('other: b');
  f.git('switch', '-qc', 'topic', 'main');
  f.write(A, 'export const a = 2;\n');
  f.commit('topic: a');
  f.git('merge', '--no-commit', '--no-ff', 'other');
  assert.deepEqual(f.select(), [A, B]);
});

test('a push to main counts the files changed in that push, against the previous main', (t) => {
  const f = fixture(t);
  f.write(A, 'export const a = 2;\n');
  const before = f.commit('an earlier push');
  f.write(B, 'export const b = 2;\n');
  f.commit('this push, first commit');
  f.write(D, 'export const d = 1;\n');
  f.commit('this push, second commit');
  f.publish();
  const ci = { GITHUB_ACTIONS: 'true', MAINTAINABILITY_BASE: before };
  assert.deepEqual(f.select(ci), [B, D]);

  // A shallow CI checkout holds the replaced main commit without the history between.
  const shallow = join(f.root, 'shallow');
  f.gitIn(f.root, 'clone', '-q', '--depth=1', `file://${f.work}`, shallow);
  f.gitIn(shallow, 'fetch', '-q', '--no-tags', '--depth=1', 'origin', before);
  assert.deepEqual(f.select(ci, shallow), [B, D]);
});

test('a pull request\'s merge commit in CI counts the pull request\'s files', (t) => {
  const f = fixture(t);
  f.git('switch', '-qc', 'topic');
  f.write(A, 'export const a = 2;\n');
  f.commit('topic: a');
  f.git('switch', '-q', 'main');
  f.write(B, 'export const b = 2;\n');
  f.commit('main moves on');
  f.publish();
  // GitHub checks out a merge commit whose first parent is the target branch.
  f.git('switch', '-q', '--detach', 'main');
  f.git('merge', '-q', '--no-ff', '--no-edit', 'topic');
  assert.deepEqual(f.select({ GITHUB_ACTIONS: 'true', MAINTAINABILITY_BASE: 'HEAD^1' }), [A]);
  assert.deepEqual(f.select({ GITHUB_ACTIONS: 'true', GITHUB_BASE_REF: 'main' }), [A]);
});

test('CI fails when the base is missing; a local run without origin/main keeps the working-tree check', (t) => {
  const f = fixture(t);
  f.git('switch', '-qc', 'topic');
  f.write(A, 'export const a = 2;\n');
  f.commit('topic: a');
  f.write(B, 'export const b = 2;\n');
  f.git('update-ref', '-d', 'refs/remotes/origin/main');

  assert.throws(() => f.select({ GITHUB_ACTIONS: 'true' }), /cannot list the files this change touches/);
  assert.throws(() => f.select({ CI: 'true', MAINTAINABILITY_BASE: 'f'.repeat(40) }), /is not a commit/);
  assert.throws(() => f.select({ MAINTAINABILITY_BASE: 'no-such-branch' }), /is not a commit/);
  assert.deepEqual(f.select(), [B]);
  assert.equal(f.base().commit, 'HEAD');
});
