// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classificationArguments, classifyApplicationRelease, parseApplicationReleaseInventory } from '../scripts/classify-application-release.ts';

function git(repo: string, ...args: string[]): string {
  const result = spawnSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false', ...args],
    { cwd: repo, encoding: 'utf8', timeout: 15000 });
  assert.equal(result.status, 0, result.stderr); return result.stdout.trim();
}
function write(repo: string, path: string, content = 'export const value = 1;\n'): void {
  mkdirSync(dirname(join(repo, path)), { recursive: true }); writeFileSync(join(repo, path), content);
}
function commit(repo: string): string {
  git(repo, 'add', '--all'); git(repo, 'commit', '--quiet', '--allow-empty', '-m', 'Classifier fixture'); return git(repo, 'rev-parse', 'HEAD');
}
function fixture(run: (repo: string, base: string) => void, kind: 'lolly' | 'lolly-work' = 'lolly'): void {
  const repo = realpathSync(mkdtempSync(join(tmpdir(), 'lolly-classifier-')));
  try {
    git(repo, 'init', '--quiet', '--initial-branch=main');
    git(repo, 'config', 'user.name', 'Release classifier fixture'); git(repo, 'config', 'user.email', 'fixture@example.invalid');
    write(repo, 'package.json', JSON.stringify({ name: kind, type: 'module' }));
    const paths = kind === 'lolly' ? ['engine/src/version.ts', 'packages/core/src/host-v1.ts', 'schemas/tool.schema.json',
      'profiles.json', 'shells/web/src/main.ts'] : ['engine-pin.json', 'server/src/main.ts', 'deploy/helm/Chart.yaml'];
    for (const path of paths) write(repo, path);
    run(repo, commit(repo));
  } finally { rmSync(repo, { recursive: true, force: true }); }
}
test('real committed web changes are advisory with immutable trees and complete raw inventory', () => fixture((repo, base) => {
  write(repo, 'shells/web/src/components/profile-menu.ts');
  write(repo, 'shells/web/src/README.md', 'Generated module counts.\n');
  write(repo, 'tests/profile-menu.browser.test.ts');
  const candidate = commit(repo), result = classifyApplicationRelease({ repo, base, candidate });
  assert.equal(result.classification, 'web-shell-only'); assert.equal(result.base, base); assert.equal(result.candidate, candidate);
  assert.equal(result.baseTree, git(repo, 'rev-parse', `${base}^{tree}`));
  assert.equal(result.candidateTree, git(repo, 'rev-parse', `${candidate}^{tree}`));
  assert.deepEqual(result.changedPaths.map(change => change.path), ['shells/web/src/README.md',
    'shells/web/src/components/profile-menu.ts', 'tests/profile-menu.browser.test.ts']);
  assert.ok(result.changedPaths.every(change => change.status === 'A' && change.beforeMode === '000000' && change.afterMode === '100644'));
  assert.match(result.changedPathsSha256, /^[a-f0-9]{64}$/);
  assert.equal(result.advisory, true); assert.equal(result.normalCiRequired, true);
  assert.equal(result.privateCompatibilityReviewRequired, true); assert.equal(result.artifactReuseAuthorized, false);
  assert.equal(result.promotionAuthorized, false);
  assert.deepEqual(classifyApplicationRelease({ repo, base, candidate }), result);
}));
for (const path of ['engine/src/version.ts', 'packages/core/src/host-v1.ts', 'packages/node-shell/src/content-roots.ts',
  'schemas/tool.schema.json', 'community/design/tool.json', 'tools/qr-code/hooks.js', 'brands/suse/catalog/tools/index.json',
  'catalog/tools/index.json', 'profiles.json', 'pnpm-lock.yaml', 'shells/web/package.json', 'deploy/docker/web.Dockerfile',
  'services/mcp/src/http.ts', 'scripts/webgpu-release-gate.ts', 'docs/supported-environments.md',
  'shells/web/src/browser-support.ts', 'tests/webgpu-release-gate.test.ts', 'tests/browser-support.browser.test.ts',
  '.github/workflows/ci.yml', 'unexpected/new.txt']) {
  test(`web plus ${path} refuses the narrow scope`, () => fixture((repo, base) => {
    write(repo, 'shells/web/src/main.ts', 'export const web = 2;\n'); write(repo, path, 'changed\n');
    const result = classifyApplicationRelease({ repo, base, candidate: commit(repo) });
    assert.equal(result.classification, 'full-or-paired-required'); assert.equal(result.promotionAuthorized, false);
    assert.ok(result.changedPaths.some(change => change.path === path));
  }));
}
for (const path of ['tests/only.browser.test.ts', 'docs/deployment.md', 'shells/web/src/README.md', 'shells/web/src/widget.test.ts']) {
  test(`${path} alone cannot request a web release`, () => fixture((repo, base) => {
    write(repo, path); const result = classifyApplicationRelease({ repo, base, candidate: commit(repo) });
    assert.equal(result.classification, 'full-or-paired-required'); assert.equal(result.promotionAuthorized, false);
  }));
}
test('identical tree commits report no-change without promotion authority', () => fixture((repo, base) => {
  const candidate = commit(repo), result = classifyApplicationRelease({ repo, base, candidate });
  assert.notEqual(base, candidate); assert.equal(result.baseTree, result.candidateTree);
  assert.equal(result.classification, 'no-change'); assert.deepEqual(result.changedPaths, []); assert.equal(result.promotionAuthorized, false);
}));
test('Work server changes stay broader until a maintained backend rule exists', () => fixture((repo, base) => {
  write(repo, 'server/src/main.ts', 'export const server = 2;\n');
  assert.equal(classifyApplicationRelease({ repo, base, candidate: commit(repo) }).classification, 'full-or-paired-required');
}, 'lolly-work'));
test('renaming web code into shared engine records both paths and requires broader qualification', () => fixture((repo, base) => {
  write(repo, 'shells/web/src/widget.ts'); const previous = commit(repo);
  assert.notEqual(previous, base); git(repo, 'mv', 'shells/web/src/widget.ts', 'engine/src/new.ts');
  const result = classifyApplicationRelease({ repo, base: previous, candidate: commit(repo) });
  assert.equal(result.classification, 'full-or-paired-required');
  assert.deepEqual(result.changedPaths.map(change => [change.path, change.status]), [['engine/src/new.ts', 'A'], ['shells/web/src/widget.ts', 'D']]);
}));
test('symlink web input cannot be classified as regular UI code', () => fixture((repo, base) => {
  symlinkSync('../../../engine/src/version.ts', join(repo, 'shells/web/src/widget.ts'));
  const result = classifyApplicationRelease({ repo, base, candidate: commit(repo) });
  assert.equal(result.classification, 'full-or-paired-required'); assert.equal(result.changedPaths[0]?.afterMode, '120000');
}));
for (const untracked of [false, true]) {
  test(`${untracked ? 'untracked' : 'tracked'} dirty inputs refuse`, () => fixture((repo, base) => {
    write(repo, untracked ? 'untracked.txt' : 'shells/web/src/main.ts', 'dirty\n');
    assert.throws(() => classifyApplicationRelease({ repo, base, candidate: base }), /changes refuse/);
  }));
}
test('moving refs, short hashes, trees, tags and checkout mismatch refuse', () => fixture((repo, base) => {
  for (const invalid of ['main', base.slice(0, 12), base.toUpperCase(), '--all', '0'.repeat(40)]) {
    assert.throws(() => classifyApplicationRelease({ repo, base, candidate: invalid }));
  }
  const tree = git(repo, 'rev-parse', `${base}^{tree}`);
  assert.throws(() => classifyApplicationRelease({ repo, base: tree, candidate: base }), /commit objects/);
  git(repo, 'tag', '-a', 'fixture-tag', '-m', 'Tag');
  assert.throws(() => classifyApplicationRelease({ repo, base: git(repo, 'rev-parse', 'fixture-tag'), candidate: base }), /commit objects/);
  write(repo, 'shells/web/src/main.ts', 'new\n'); const candidate = commit(repo);
  git(repo, 'checkout', '--quiet', '--detach', base);
  assert.throws(() => classifyApplicationRelease({ repo, base, candidate }), /exact candidate/);
}));
test('divergent immutable commits refuse rather than silently use a merge base', () => fixture((repo, base) => {
  write(repo, 'shells/web/src/main.ts', 'branch one\n'); const left = commit(repo);
  git(repo, 'checkout', '--quiet', '--detach', base);
  write(repo, 'shells/web/src/main.ts', 'branch two\n'); const right = commit(repo);
  assert.throws(() => classifyApplicationRelease({ repo, base: left, candidate: right }));
}));
for (const path of ['shells/web/src/bad\nname.ts', 'shells/web/src/bad\\name.ts', 'shells/web/src/bad\u202ename.ts']) {
  test('unsafe committed filename refuses the entire inventory', () => fixture((repo, base) => {
    write(repo, path); assert.throws(() => classifyApplicationRelease({ repo, base, candidate: commit(repo) }), /changed path/);
  }));
}
test('unknown package identity and absent contract layout refuse', () => fixture((repo, base) => {
  write(repo, 'package.json', '{"name":"unrelated"}'); let candidate = commit(repo);
  assert.throws(() => classifyApplicationRelease({ repo, base, candidate }), /repository layouts/);
  write(repo, 'package.json', '{"name":"lolly"}'); rmSync(join(repo, 'profiles.json')); candidate = commit(repo);
  assert.throws(() => classifyApplicationRelease({ repo, base, candidate }), /repository layout/);
}));
test('submodule gitlink changes cannot be classified as shell-only', () => fixture((repo, base) => {
  write(repo, 'shells/web/src/main.ts', 'web changed\n'); git(repo, 'add', '--all');
  mkdirSync(join(repo, 'brands/suse'), { recursive: true });
  git(repo, 'update-index', '--add', '--cacheinfo', `160000,${base},brands/suse`);
  git(repo, 'commit', '--quiet', '-m', 'Commit gitlink fixture');
  const result = classifyApplicationRelease({ repo, base, candidate: git(repo, 'rev-parse', 'HEAD') });
  assert.equal(result.classification, 'full-or-paired-required');
  assert.equal(result.changedPaths.find(change => change.path === 'brands/suse')?.afterMode, '160000');
}));
test('changed-path count and byte limits refuse without truncating advisory output', () => fixture((repo, base) => {
  for (let i = 0; i < 4097; i++) write(repo, `shells/web/src/part-${i}.ts`);
  assert.throws(() => classifyApplicationRelease({ repo, base, candidate: commit(repo) }), /oversized changed-path inventory/);
}));
test('raw invalid UTF-8 filename refuses on every host rather than replacement-decoding', () => {
  const header = `:000000 100644 ${'0'.repeat(40)} ${'1'.repeat(40)} A\0`;
  const invalid = Buffer.concat([Buffer.from(header + 'shells/web/src/bad-'), Buffer.from([0xff]), Buffer.from('.ts\0')]);
  assert.throws(() => parseApplicationReleaseInventory(invalid), /valid UTF-8/);
});
test('truncated, duplicate, oversized and ambiguous raw inventory refuses', () => {
  const record = `:000000 100644 ${'0'.repeat(40)} ${'1'.repeat(40)} A\0shells/web/src/widget.ts\0`;
  for (const malformed of [record.slice(0, -1), record + record, record.replace(' A\0', ' R100\0'),
    record.replace(' A\0', ' M\0'),
    record.replace('widget.ts', 'x'.repeat(1025))]) assert.throws(() => parseApplicationReleaseInventory(Buffer.from(malformed)));
  assert.throws(() => parseApplicationReleaseInventory(Buffer.alloc(2 * 1024 * 1024 + 1)), /byte bound/);
});
test('ambient Git relocation cannot redirect inspected objects or status', () => fixture((repo, base) => {
  const previous = process.env.GIT_DIR;
  process.env.GIT_DIR = '/nonexistent/ambient-git-directory';
  try { assert.equal(classifyApplicationRelease({ repo, base, candidate: base }).classification, 'no-change'); }
  finally { if (previous === undefined) delete process.env.GIT_DIR; else process.env.GIT_DIR = previous; }
}));
test('local graft metadata refuses and Git replacement objects cannot alter the immutable diff', () => fixture((repo, base) => {
  write(repo, 'shells/web/src/main.ts', 'actual web change\n'); const candidate = commit(repo);
  git(repo, 'replace', base, candidate);
  const result = classifyApplicationRelease({ repo, base, candidate });
  assert.equal(result.classification, 'web-shell-only'); assert.equal(result.changedPaths.length, 1);
  write(repo, '.git/info/grafts', `${base}\n`);
  assert.throws(() => classifyApplicationRelease({ repo, base, candidate }), /ancestry grafts/);
}));
test('repository subdirectories and symlink aliases refuse', () => fixture((repo, base) => {
  assert.throws(() => classifyApplicationRelease({ repo: join(repo, 'shells'), base, candidate: base }), /working-tree root/);
  const alias = `${repo}-alias`; symlinkSync(repo, alias);
  try { assert.throws(() => classifyApplicationRelease({ repo: alias, base, candidate: base }), /canonical directory/); }
  finally { rmSync(alias); }
}));
test('CLI refuses duplicate or unknown flags and emits no raw Git stderr', () => fixture((repo, base) => {
  assert.deepEqual(classificationArguments(['--base', base, '--candidate', base, '--repo', repo]), { repo, base, candidate: base });
  for (const args of [['--repo', repo, '--base', base, '--base', base], ['--repo', repo, '--base', base, '--unsafe', base], []]) {
    assert.throws(() => classificationArguments(args));
  }
  const script = fileURLToPath(new URL('../scripts/classify-application-release.ts', import.meta.url));
  const success = spawnSync(process.execPath, [script, '--repo', repo, '--base', base, '--candidate', base], { encoding: 'utf8' });
  assert.equal(success.status, 0); assert.equal(JSON.parse(success.stdout).classification, 'no-change');
  const refused = spawnSync(process.execPath, [script, '--repo', repo, '--base', base, '--candidate', 'secret-ref-input'], { encoding: 'utf8' });
  assert.equal(refused.status, 1); assert.equal(refused.stdout, ''); assert.equal(JSON.parse(refused.stderr).status, 'REFUSED');
  assert.ok(!refused.stderr.includes('secret-ref-input'));
}));
