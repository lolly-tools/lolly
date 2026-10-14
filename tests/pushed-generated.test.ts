// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { pushedTips } from '../scripts/check-pushed-generated.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCRIPT = join(ROOT, 'scripts/check-pushed-generated.ts');
const WEB = 'scripts/gen-web-src-readme.ts';
const ENGINE = 'scripts/gen-engine-modules.ts';
const ZERO = '0'.repeat(40);
const OLD = 'f'.repeat(40);

function fixture(t: test.TestContext) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'lolly-pushed-generated-test-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (name: string, contents: string): void => {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), contents);
  };
  const git = (...args: string[]): string => {
    const result = spawnSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false',
      '-c', 'user.name=Generated check test', '-c', 'user.email=test@example.invalid', ...args],
    { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  const regenerate = (): void => {
    for (const generator of [WEB, ENGINE]) {
      const result = spawnSync(process.execPath, [join(root, generator)], { cwd: root, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
    }
  };
  const commit = (): string => {
    git('add', '.');
    git('commit', '-qm', 'fixture');
    return git('rev-parse', 'HEAD');
  };
  const run = (input: string, hook = false) => {
    const result = spawnSync(hook ? 'sh' : process.execPath,
      hook ? [join(ROOT, 'scripts/git-hooks/pre-push')] : [SCRIPT, '--pre-push'], {
        cwd: root, encoding: 'utf8', input,
        env: { ...process.env, LOLLY_NODE: process.execPath, PATH: `${join(root, 'bin')}:${process.env.PATH}` },
      });
    assert.ifError(result.error);
    return { status: result.status, output: result.stdout + result.stderr };
  };
  write('package.json', '{"type":"module"}\n');
  write('bin/pnpm', '#!/bin/sh\nprintf "package manager must not run\\n" >&2\nexit 99\n');
  chmodSync(join(root, 'bin/pnpm'), 0o755);
  write('.nvmrc', process.versions.node.split('.')[0] + '\n');
  write('shells/web/src/README.md', '<!-- web-src-dirs:start -->\n<!-- web-src-dirs:end -->\n' +
    '<!-- web-src-largest:start -->\n<!-- web-src-largest:end -->\n');
  write('shells/web/src/lib/widget.ts', 'export const widget = 1;\n');
  write('engine/src/index.ts', "export { engine } from './sample.ts';\n");
  write('engine/src/sample.ts', '/** Example module. */\nexport const engine = 1;\n');
  write('engine/README.md', '<!-- engine-modules:start -->\n<!-- engine-modules:end -->\n');
  write('tests/fuzz/targets.ts', 'export const targets = [];\n');
  for (const script of [WEB, ENGINE, 'scripts/check-pushed-generated.ts']) {
    write(script, readFileSync(join(ROOT, script), 'utf8'));
  }
  git('init', '-q', '-b', 'main');
  regenerate();
  const valid = commit();
  return { root, write, git, regenerate, commit, run, valid };
}

const update = (sha: string, ref = 'refs/heads/topic', old = ZERO): string => `${ref} ${sha} ${ref} ${old}\n`;

test('valid pushed source ignores and preserves staged, unstaged, untracked and generator edits', t => {
  const f = fixture(t);
  f.write('shells/web/src/lib/widget.ts', 'staged change\n');
  f.git('add', 'shells/web/src/lib/widget.ts');
  f.write('shells/web/src/lib/widget.ts', 'unstaged change\nwith extra lines\n');
  f.write('shells/web/src/lib/untracked.ts', 'untracked\n');
  f.write('shells/web/src/README.md', 'uncommitted README\n');
  f.write(WEB, 'throw new Error("wrong generator");\n');
  const beforeStatus = f.git('status', '--porcelain=v1');
  const beforeIndex = readFileSync(join(f.root, '.git/index'));
  const result = f.run(update(f.valid));
  assert.equal(result.status, 0, result.output);
  assert.deepEqual(readFileSync(join(f.root, '.git/index')), beforeIndex);
  assert.equal(f.git('status', '--porcelain=v1'), beforeStatus);
  assert.equal(readFileSync(join(f.root, 'shells/web/src/lib/widget.ts'), 'utf8'), 'unstaged change\nwith extra lines\n');
  assert.equal(readFileSync(join(f.root, 'shells/web/src/lib/untracked.ts'), 'utf8'), 'untracked\n');
  assert.equal(readFileSync(join(f.root, WEB), 'utf8'), 'throw new Error("wrong generator");\n');
});

test('a stale pushed ref fails even with a newer clean HEAD and working README', t => {
  const f = fixture(t);
  f.write('shells/web/src/lib/widget.ts', 'export const widget = 2;\n\n');
  const stale = f.commit();
  f.regenerate();
  const fixed = f.commit();
  const result = f.run(update(stale, 'refs/heads/stale', f.valid));
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /README.md stats are stale/);
  assert.match(result.output, /refs\/heads\/stale/);
  assert.match(result.output, /Uncommitted fixes do not change the pushed commit/);
  assert.equal(f.run(update(fixed, 'refs/heads/fixed', stale)).status, 0);
});

test('engine source, direct tests and fuzz metadata are checked from the pushed commit', t => {
  const f = fixture(t);
  f.write('engine/src/sample.ts', '/** Revised purpose. */\nexport const engine = 2;\n\n');
  f.write('tests/sample.test.ts', '// Direct module test.\n');
  f.write('tests/fuzz/targets.ts', "export const targets = [{\n  name: 'sample',\n}];\n");
  const stale = f.commit();
  const result = f.run(update(stale));
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /engine\/README.md module table is stale/);
  f.regenerate();
  assert.equal(f.run(update(f.commit())).status, 0);
});

test('test-only coverage changes invalidate the engine table', t => {
  const f = fixture(t);
  f.write('tests/indirect.test.ts', "// Imports engine/src/sample.ts\n");
  const result = f.run(update(f.commit()));
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /engine\/README.md module table is stale/);
});

test('multiple updates check every distinct tip and peel annotated tags', t => {
  const f = fixture(t);
  f.git('tag', '-a', 'valid-tag', '-m', 'tag', f.valid);
  const tag = f.git('rev-parse', 'valid-tag');
  f.write('shells/web/src/lib/widget.ts', 'export const widget = 2;\n\n');
  const stale = f.commit();
  const result = f.run(update(f.valid, 'refs/heads/valid') + update(tag, 'refs/tags/valid-tag') +
    update(stale, 'refs/heads/stale', OLD) + update(ZERO, 'refs/heads/deleted', stale));
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /2 distinct commit tip\(s\) checked/);
  assert.match(result.output, /refs\/heads\/valid, refs\/tags\/valid-tag/);
  assert.match(result.output, /README.md stats are stale/);
});

test('new branches and unknown or non-fast-forward remote baselines need no fetch', t => {
  const f = fixture(t);
  f.write('shells/web/src/lib/widget.ts', 'export const widget = 2;\n\n');
  const stale = f.commit();
  for (const old of [ZERO, OLD, stale]) {
    const result = f.run(update(f.valid, 'refs/heads/rewound', old));
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /1 distinct commit tip\(s\) checked/);
  }
});

test('empty pushes, unchanged refs and deletes skip source and wording checks', t => {
  const f = fixture(t);
  f.write(WEB, 'throw new Error("must not run");\n');
  for (const input of ['', update(ZERO, 'refs/heads/deleted', OLD), update(f.valid, 'refs/heads/same', f.valid)]) {
    const result = f.run(input, true);
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /0 distinct commit tip\(s\) checked/);
    assert.doesNotMatch(result.output, /vernacular gate/);
  }
});

test('tags targeting non-commit objects are explicitly skipped', t => {
  const f = fixture(t);
  const blob = f.git('rev-parse', `${f.valid}:package.json`);
  f.git('tag', 'blob-tag', blob);
  const result = f.run(update(blob, 'refs/tags/blob-tag'));
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /non-commit object/);
  assert.match(result.output, /0 distinct commit tip\(s\) checked/);
});

test('missing generators and symlinked inputs fail without following external paths', t => {
  const f = fixture(t);
  f.git('rm', WEB);
  let result = f.run(update(f.commit()));
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /Missing generator/);
  copyFileSync(join(ROOT, WEB), join(f.root, WEB));
  symlinkSync(join(f.root, 'package.json'), join(f.root, 'shells/web/src/lib/external.ts'));
  result = f.run(update(f.commit()));
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /must be a regular file/);
});

test('Git archive attributes cannot hide stale generator inputs', t => {
  const f = fixture(t);
  f.write('.gitattributes', 'shells/web/src/lib/widget.ts export-ignore\nengine/src/sample.ts export-subst\n');
  f.write('shells/web/src/lib/widget.ts', 'export const widget = 2;\n\n');
  const result = f.run(update(f.commit()));
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /README.md stats are stale/);
});

test('hook forwards ref updates and uses Node directly before wording checks', t => {
  const f = fixture(t);
  f.write('scripts/check-code-comment-vernacular.ts', 'console.log("code wording checked");\n');
  f.write('scripts/check-docs-vernacular.ts', 'console.log("docs wording checked");\n');
  const result = f.run(update(f.valid), true);
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /code wording checked/);
  assert.match(result.output, /docs wording checked/);
  assert.ok(result.output.indexOf('distinct commit tip') < result.output.indexOf('code wording checked'));
  f.write('shells/web/src/lib/widget.ts', 'export const widget = 2;\n\n');
  const failed = f.run(update(f.commit()), true);
  assert.equal(failed.status, 1, failed.output);
  assert.doesNotMatch(failed.output, /code wording checked/);
});

test('malformed updates fail and SHA-256 deletion records parse correctly', () => {
  assert.throws(() => pushedTips('refs/heads/topic invalid refs/heads/topic ' + ZERO), /Malformed/);
  assert.throws(() => pushedTips(update(OLD).trim() + ' extra'), /Malformed/);
  assert.deepEqual(pushedTips(update('0'.repeat(64), 'refs/heads/deleted', 'a'.repeat(64))), []);
  assert.deepEqual(pushedTips(update('a'.repeat(64), 'refs/heads/new', '0'.repeat(64))),
    [{ object: 'a'.repeat(64), ref: 'refs/heads/new' }]);
});

test('coverage fallback retains custom notes and handles sibling, imported and uncovered files', t => {
  const f = fixture(t);
  f.write('shells/web/src/lib/widget.test.ts', 'export {};\n');
  f.write('shells/web/src/lib/imported.ts', 'export {};\n');
  f.write('shells/web/src/lib/indirect.test.ts', "import './imported.ts';\n");
  f.write('shells/web/src/lib/uncovered.ts', 'export {};\n');
  f.write('shells/web/src/lib/custom.ts', 'export {};\n');
  f.write('shells/web/src/README.md', '<!-- web-src-dirs:start -->\n<!-- web-src-dirs:end -->\n' +
    '<!-- web-src-largest:start -->\n| 1 | `lib/custom.ts` | Hand-written detail |\n<!-- web-src-largest:end -->\n');
  f.regenerate();
  const readme = readFileSync(join(f.root, 'shells/web/src/README.md'), 'utf8');
  assert.match(readme, /`lib\/widget.ts` \| yes \|/);
  assert.match(readme, /`lib\/imported.ts` \| yes \|/);
  assert.match(readme, /`lib\/uncovered.ts` \| \*\*none\*\* \|/);
  assert.match(readme, /`lib\/custom.ts` \| Hand-written detail \|/);
  f.regenerate();
  assert.equal(readFileSync(join(f.root, 'shells/web/src/README.md'), 'utf8'), readme);
});
