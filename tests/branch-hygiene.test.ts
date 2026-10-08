// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assignCwds,
  type BranchVerdict,
  branchNameWarning,
  checkFindings,
  checkedCwds,
  classifyBranch,
  classifyIgnored,
  decideLocal,
  decideRemote,
  decideWorktree,
  isNoise,
  parseArgs,
  parseGithubSlug,
  parseLsofCwd,
  parseStatusZ,
  parseWorktreePorcelain,
  renderMarkdown,
  type RepoReport,
  type WorktreeFacts,
  worktreeLocationWarnings,
} from '../scripts/branch-hygiene.ts';

const MAIN_TREE = 'a'.repeat(40);
const OTHER_TREE = 'b'.repeat(40);

const verdict = (status: BranchVerdict['status'], inMain = status === 'IN_MAIN'): BranchVerdict => ({ status, inMain, detail: '' });

test('renderMarkdown distinguishes represented changes from deletable history and preserves custody', () => {
  const report: RepoReport = {
    root: '/fixture/lolly', commonDir: '/fixture/lolly/.git', slug: 'owner/lolly',
    remote: 'origin', mainBranch: 'main', mainSha: MAIN_TREE, fetched: true, prsKnown: true,
    remoteBranches: [{
      name: 'feat/equivalent', sha: OTHER_TREE, date: '2026-10-08', protectedBranch: false,
      ancestorOfMain: false, verdict: { status: 'IN_MAIN', inMain: true, detail: '3 commits, changes already in main' },
      warning: null, decision: { act: false, why: 'unique history requires manual archival' },
    }],
    localBranches: [], worktrees: [], mainCheckout: null, warnings: [],
  };
  const markdown = renderMarkdown(report, []);
  assert.match(markdown, /feat\/equivalent.*IN_MAIN.*3 commits, changes already in main/);
  assert.match(markdown, /equivalent squash or rebase merges can still have unique commit history/);
  assert.match(markdown, /rechecks exact ancestry, live refs, PRs and protection/);
  assert.match(markdown, /before removing eligible clean worktrees/);
  assert.match(markdown, /Unique history, local branches, ignored files, notes and locked worktrees are retained/);
  assert.match(markdown, /Lock externally referenced worktrees until their deployment, recovery or other configuration references have moved/);
  assert.match(markdown, /coordinate cleanup with other users/);
  assert.doesNotMatch(markdown, /To delete them|matching local branches|each action can be undone/);
});

test('classifyBranch: main, merged, squash-merged, unique, conflicting and open PR', () => {
  const base = { name: 'feat/x', isMain: false, ahead: 0, mergedTree: null, mainTree: MAIN_TREE, openPrs: [] };
  assert.equal(classifyBranch({ ...base, name: 'main', isMain: true }).status, 'MAIN');
  // No commits beyond main: an ancestor of main.
  assert.deepEqual(classifyBranch(base), { status: 'IN_MAIN', inMain: true, detail: 'no commits beyond main' });
  // Commits whose merge gives back main's tree: squash or rebase merged.
  assert.deepEqual(classifyBranch({ ...base, ahead: 3, mergedTree: MAIN_TREE }), {
    status: 'IN_MAIN', inMain: true, detail: '3 commits, changes already in main',
  });
  assert.deepEqual(classifyBranch({ ...base, ahead: 1, mergedTree: OTHER_TREE }), {
    status: 'UNIQUE', inMain: false, detail: '1 commit not in main',
  });
  // A merge that conflicts cannot be in main.
  assert.equal(classifyBranch({ ...base, ahead: 2, mergedTree: null }).status, 'UNIQUE');
  // An open pull request wins, and the verdict still records whether main holds the changes.
  const pr = classifyBranch({ ...base, openPrs: [12, 15] });
  assert.equal(pr.status, 'OPEN_PR');
  assert.equal(pr.inMain, true);
  assert.match(pr.detail, /^open PR #12, #15; /);
});

test('decideRemote deletes only an IN_MAIN branch with known pull requests and fresh refs', () => {
  const ctx = { mainBranch: 'main', prsKnown: true, refsFresh: true, protectionKnown: true };
  const branch = (name: string, v: BranchVerdict, protectedBranch = false, ancestorOfMain = true) => ({ name, verdict: v, protectedBranch, ancestorOfMain });
  assert.equal(decideRemote(branch('feat/x', verdict('IN_MAIN')), ctx).act, true);
  assert.equal(decideRemote(branch('main', verdict('MAIN')), ctx).act, false);
  // Even when classified IN_MAIN, a main branch is kept by name.
  for (const name of ['main', 'master', 'HEAD']) assert.equal(decideRemote(branch(name, verdict('IN_MAIN')), ctx).act, false);
  assert.equal(decideRemote(branch('trunk', verdict('IN_MAIN')), { ...ctx, mainBranch: 'trunk' }).act, false);
  assert.equal(decideRemote(branch('feat/x', verdict('OPEN_PR', true)), ctx).act, false);
  assert.equal(decideRemote(branch('feat/x', verdict('UNIQUE')), ctx).act, false);
  assert.equal(decideRemote(branch('feat/x', verdict('IN_MAIN'), false, false), ctx).act, false);
  assert.equal(decideRemote(branch('release/1', verdict('IN_MAIN'), true), ctx).act, false);
  assert.deepEqual(decideRemote(branch('feat/x', verdict('IN_MAIN')), { ...ctx, prsKnown: false }), {
    act: false, why: 'open pull requests could not be read',
  });
  assert.equal(decideRemote(branch('feat/x', verdict('IN_MAIN')), { ...ctx, refsFresh: false }).act, false);
  assert.equal(decideRemote(branch('feat/x', verdict('IN_MAIN')), { ...ctx, protectionKnown: false }).act, false);
});

const idle: WorktreeFacts = {
  path: '/repo/.worktrees/a',
  isMain: false,
  branch: 'feat/a',
  head: 'c'.repeat(40),
  locked: false,
  missing: false,
  cwdPids: [],
  indexAgeMinutes: 90,
  dirty: [],
  ignoredKeep: [],
  submoduleInitialised: false,
  containsWorktree: false,
  headInMain: true,
  headOnRemote: [],
};
const wctx = { idleMinutes: 30, prunedRemotes: new Set<string>() };

test('decideWorktree removes an idle, clean worktree whose HEAD is safe', () => {
  assert.deepEqual(decideWorktree(idle, wctx), { act: true, why: 'idle, clean, HEAD in main' });
  const pushed = { ...idle, headInMain: false, headOnRemote: ['feat/a'] };
  assert.equal(decideWorktree(pushed, wctx).act, false);
});

test('decideWorktree keeps anything in use, recent, dirty or not saved elsewhere', () => {
  const kept: Array<[string, Partial<WorktreeFacts>, RegExp]> = [
    ['main checkout', { isMain: true }, /main checkout/],
    ['locked', { locked: true }, /locked/],
    ['process check failed', { cwdPids: null }, /could not check/],
    ['a shell inside', { cwdPids: [4242] }, /in use \(pid 4242\)/],
    ['index age unknown', { indexAgeMinutes: null }, /index age unknown/],
    ['index touched recently', { indexAgeMinutes: 29.9 }, /index changed 29 min ago/],
    ['clock skew', { indexAgeMinutes: -0.5 }, /index changed 0 min ago/],
    ['nested worktree', { containsWorktree: true }, /another worktree/],
    ['initialised submodule', { submoduleInitialised: true }, /submodule/],
    ['uncommitted work', { dirty: ['src/a.ts', 'src/b.ts'] }, /2 uncommitted files/],
    ['HEAD only local', { headInMain: false, headOnRemote: [] }, /HEAD is not in pinned main/],
    ['ignored files not scanned', { ignoredKeep: null }, /not scanned/],
    ['ignored files to keep', { ignoredKeep: ['keys/', '.env', 'a.log', 'b.log'] }, /keys\/, \.env, a\.log and 1 more/],
  ];
  for (const [label, change, why] of kept) {
    const decision = decideWorktree({ ...idle, ...change }, wctx);
    assert.equal(decision.act, false, label);
    assert.match(decision.why, why, label);
  }
});

test('decideWorktree does not count a remote branch this run deletes as a home for HEAD', () => {
  const onRemote = { ...idle, headInMain: false, headOnRemote: ['feat/a'] };
  assert.equal(decideWorktree(onRemote, { idleMinutes: 30, prunedRemotes: new Set(['feat/a']) }).act, false);
  const twoHomes = { ...onRemote, headOnRemote: ['feat/a', 'feat/b'] };
  assert.equal(decideWorktree(twoHomes, { idleMinutes: 30, prunedRemotes: new Set(['feat/a']) }).act, false);
});

test('decideWorktree retains vanished worktree registrations for manual custody checks', () => {
  const gone = { ...idle, missing: true, cwdPids: null, indexAgeMinutes: null, ignoredKeep: null };
  assert.equal(decideWorktree(gone, wctx).act, false);
  const detachedLocal = { ...gone, branch: null, headInMain: false, headOnRemote: [] };
  assert.equal(decideWorktree(detachedLocal, wctx).act, false);
  assert.equal(decideWorktree({ ...detachedLocal, headOnRemote: ['feat/b'] }, wctx).act, false);
  assert.equal(decideWorktree({ ...gone, locked: true }, wctx).act, false);
});

test('decideLocal retains local branches even when their changes are in main', () => {
  const ctx = { mainBranch: 'main', removedWorktrees: new Set(['/repo/.worktrees/a']) };
  const local = (name: string, v: BranchVerdict, checkedOutIn: string[] = []) => ({ name, verdict: v, checkedOutIn });
  assert.equal(decideLocal(local('feat/x', verdict('IN_MAIN')), ctx).act, false);
  assert.equal(decideLocal(local('main', verdict('IN_MAIN')), ctx).act, false);
  assert.equal(decideLocal(local('feat/x', verdict('IN_MAIN'), ['/repo/.worktrees/b']), ctx).act, false);
  // Even when its only checkout is nominated, local deletion stays manual.
  assert.equal(decideLocal(local('feat/x', verdict('IN_MAIN'), ['/repo/.worktrees/a']), ctx).act, false);
  assert.equal(decideLocal(local('feat/x', verdict('OPEN_PR', true)), ctx).act, false);
  assert.equal(decideLocal(local('feat/x', verdict('UNIQUE')), ctx).act, false);
});

test('isNoise does not discard changed files based on directory or bundle names', () => {
  const submodules = new Set(['brands/suse']);
  const noise = (code: string, p: string) => isNoise({ code, path: p }, submodules);
  assert.equal(noise('??', 'node_modules'), false);
  assert.equal(noise('??', 'engine/node_modules'), false);
  assert.equal(noise('??', 'shells/web/public/info/docs.E2-5K81LvdRXRXyK.css'), false);
  assert.equal(noise(' D', 'shells/web/public/info/docs.0zoAklZtW3jeg7pK.js'), false);
  // An absent, uninitialised submodule directory.
  assert.equal(noise(' D', 'brands/suse'), false);
  // A moved submodule pointer, a staged submodule removal or ordinary work is never noise.
  assert.equal(noise(' M', 'brands/suse'), false);
  assert.equal(noise('D ', 'brands/suse'), false);
  assert.equal(noise(' M', 'scripts/branch-hygiene.ts'), false);
  assert.equal(noise('??', 'docs/new-page.md'), false);
  assert.equal(noise(' M', 'shells/web/public/info/ask-vectors.json'), false);
  assert.equal(noise(' D', 'engine/src/runtime.ts'), false);
});

test('classifyIgnored keeps all ignored artifacts, including secrets in build directories', () => {
  for (const p of ['plans/', 'plans/notes.md']) assert.equal(classifyIgnored(p), 'notes', p);
  for (const p of [
    'node_modules/', 'packages/node-shell/node_modules/', 'dist/', 'packages/x/dist/', '.vercel/',
    'shells/web/public/info/index.html', 'shells/web/public/ort/', 'community/emoji-packs/noto-color.json.gz',
    'shells/tauri-desktop/src-tauri/target/', 'tsconfig.tsbuildinfo', '.DS_Store',
    'dist/.env', 'target/recovery.sql', '.cache/customer-assets.bin', '.vercel/.env.production.local',
  ]) assert.equal(classifyIgnored(p), 'keep', p);
  for (const p of ['keys/', '.env', 'instance.json', 'secret.key', 'packs/oss-view/', 'debug.log', 'data/']) {
    assert.equal(classifyIgnored(p), 'keep', p);
  }
});

test('checkedCwds refuses failed, warning, timeout and malformed partial visibility', () => {
  const partial = 'p100\nfcwd\nn/repo\n';
  assert.deepEqual(checkedCwds({ status: 0, stdout: partial, stderr: '' }), [{ pid: 100, path: '/repo' }]);
  for (const result of [
    { status: 1, stdout: partial, stderr: '' },
    { status: -1, stdout: partial, stderr: 'Error: spawnSync lsof ETIMEDOUT' },
    { status: 0, stdout: partial, stderr: 'WARNING: cannot stat process' },
    { status: 0, stdout: `${partial}p200\n`, stderr: '' },
    { status: 0, stdout: 'partial output', stderr: '' },
    { status: 0, stdout: 'p100\nnrelative/path\n', stderr: '' },
    { status: 0, stdout: '', stderr: '' },
  ]) assert.equal(checkedCwds(result), null);
});

test('parseStatusZ reads porcelain v1 -z, including a rename source field', () => {
  const text = [' M engine/src/a.ts', 'R  new.ts', 'old.ts', '?? node_modules', '!! plans/', ''].join('\0');
  assert.deepEqual(parseStatusZ(text), [
    { code: ' M', path: 'engine/src/a.ts' },
    { code: 'R ', path: 'new.ts' },
    { code: '??', path: 'node_modules' },
    { code: '!!', path: 'plans/' },
  ]);
  assert.deepEqual(parseStatusZ(''), []);
});

test('parseWorktreePorcelain reads branches, detached heads, locks and missing worktrees', () => {
  const text = [
    'worktree /repo', 'HEAD 1111111111111111111111111111111111111111', 'branch refs/heads/main', '',
    'worktree /repo/.worktrees/a', 'HEAD 2222222222222222222222222222222222222222', 'detached', 'locked reason here', '',
    'worktree /tmp/gone', 'HEAD 3333333333333333333333333333333333333333', 'branch refs/heads/feat/gone', 'prunable gitdir file points to non-existent location', '',
  ].join('\n');
  const entries = parseWorktreePorcelain(text);
  assert.equal(entries.length, 3);
  assert.deepEqual(entries[0], { path: '/repo', head: '1'.repeat(40), branch: 'main', locked: false, prunable: false, bare: false });
  assert.equal(entries[1]?.branch, null);
  assert.equal(entries[1]?.locked, true);
  assert.equal(entries[2]?.branch, 'feat/gone');
  assert.equal(entries[2]?.prunable, true);
  const unusual = '/repo/.worktrees/unicode é\nsecond line';
  assert.equal(parseWorktreePorcelain(`worktree ${unusual}\0HEAD ${'1'.repeat(40)}\0detached\0\0`)[0]?.path, unusual);
});

test('parseLsofCwd and assignCwds give each process to the deepest worktree', () => {
  const lsof = 'p100\nfcwd\nn/repo\np200\nfcwd\nn/repo/.worktrees/a/src\np300\nfcwd\nn/repo/.worktrees/ab\np400\nfcwd\nn/elsewhere\n';
  const cwds = parseLsofCwd(lsof);
  assert.deepEqual(cwds, [
    { pid: 100, path: '/repo' },
    { pid: 200, path: '/repo/.worktrees/a/src' },
    { pid: 300, path: '/repo/.worktrees/ab' },
    { pid: 400, path: '/elsewhere' },
  ]);
  const owners = assignCwds(['/repo', '/repo/.worktrees/a', '/repo/.worktrees/b'], cwds);
  // .worktrees/ab is not inside .worktrees/a, so pid 300 counts for the surrounding main checkout.
  assert.deepEqual(owners.get('/repo'), [100, 300]);
  assert.deepEqual(owners.get('/repo/.worktrees/a'), [200]);
  assert.deepEqual(owners.get('/repo/.worktrees/b'), []);
});

test('worktreeLocationWarnings flags temporary directories, plans/ and strays', () => {
  assert.deepEqual(worktreeLocationWarnings('/repo/.worktrees/a', '/repo'), []);
  const tmp = worktreeLocationWarnings('/private/tmp/claude-501/x', '/repo');
  assert.equal(tmp.length, 2);
  assert.match(tmp[0] ?? '', /temporary directory/);
  assert.match(tmp[1] ?? '', /outside repo\/\.worktrees\//);
  assert.match(worktreeLocationWarnings('/tmp/x', '/repo')[0] ?? '', /temporary/);
  assert.ok(worktreeLocationWarnings('/repo/plans/wt', '/repo').some((w) => w.includes('plans/')));
});

test('branchNameWarning flags backup, scratch, deploy, integrate and archive branches', () => {
  for (const name of ['backup/x', 'scratch/y', 'deploy/z', 'integrate/w', 'archive/v']) {
    assert.match(branchNameWarning(name) ?? '', /archive\/\* tag/, name);
  }
  assert.equal(branchNameWarning('feat/backup-tool'), null);
  assert.equal(branchNameWarning('main'), null);
});

test('parseGithubSlug reads SSH and HTTPS remotes', () => {
  assert.equal(parseGithubSlug('git@github.com:lolly-tools/lolly.git'), 'lolly-tools/lolly');
  assert.equal(parseGithubSlug('https://github.com/lolly-tools/lolly-work.git'), 'lolly-tools/lolly-work');
  assert.equal(parseGithubSlug('https://github.com/lolly-tools/suse-lolly'), 'lolly-tools/suse-lolly');
  assert.equal(parseGithubSlug('ssh://git@github.com/owner/repo.name.git'), 'owner/repo.name');
  assert.equal(parseGithubSlug('/srv/git/remote.git'), null);
  assert.equal(parseGithubSlug('https://gitlab.com/owner/repo.git'), null);
  for (const url of [
    'https://notgithub.com/lolly-tools/lolly.git',
    'ssh://git@evilgithub.com/lolly-tools/lolly.git',
    'https://github.com.evil.test/owner/repo',
    'https://token@github.com/owner/repo',
    'https://github.com/owner/repo?redirect=other',
    'ssh://other@github.com/owner/repo',
    'git@evilgithub.com:owner/repo.git',
  ]) assert.equal(parseGithubSlug(url), null, url);
});

test('checkFindings reports too many branches and merged branches left on the remote', () => {
  const branch = (name: string, status: BranchVerdict['status'], protectedBranch = false) => ({ name, verdict: verdict(status), protectedBranch });
  const open = Array.from({ length: 10 }, (_, i) => branch(`feat/${i}`, 'OPEN_PR'));
  assert.deepEqual(checkFindings([branch('main', 'MAIN'), ...open], 10), []);
  assert.deepEqual(checkFindings([branch('main', 'MAIN'), ...open, branch('feat/u', 'UNIQUE')], 10), [
    '11 non-main branches on the remote (limit 10)',
  ]);
  assert.deepEqual(checkFindings([branch('main', 'MAIN'), branch('feat/m', 'IN_MAIN'), branch('release/1', 'IN_MAIN', true)], 10), [
    '1 branch already in main still on the remote: feat/m',
  ]);
});

test('parseArgs defaults to a report of the current checkout', () => {
  assert.deepEqual(parseArgs([]), {
    repos: ['.'], prune: false, fetch: true, remoteOnly: false, remote: 'origin', main: null,
    idleMinutes: 30, format: 'text', check: false, maxBranches: 10,
  });
  const options = parseArgs(['.', '../lolly-work', '--prune', '--no-fetch', '--idle-minutes=60', '--markdown', '--check', '--max-branches=5', '--remote=upstream', '--main=trunk']);
  assert.deepEqual(options.repos, ['.', '../lolly-work']);
  assert.equal(options.prune, true);
  assert.equal(options.fetch, false);
  assert.equal(options.idleMinutes, 60);
  assert.equal(options.format, 'markdown');
  assert.equal(options.maxBranches, 5);
  assert.equal(options.remote, 'upstream');
  assert.equal(options.main, 'trunk');
  assert.throws(() => parseArgs(['--delete-everything']), /unknown option/);
  assert.throws(() => parseArgs(['--idle-minutes=soon']), /whole number/);
});
