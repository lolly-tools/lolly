// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { RemoteBranch, RepoReport, Worktree } from '../scripts/branch-hygiene.ts';

const SHA = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);
const SCRIPT = new URL('../scripts/branch-hygiene.ts', import.meta.url).href;

/** Real CLI functions use only these fake executables; no real repository is created or pruned. */
function sandbox() {
  const home = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'lolly-hygiene-test-')));
  const root = path.join(home, 'repo');
  const bin = path.join(home, 'bin');
  const commonDir = path.join(root, '.git');
  mkdirSync(bin, { recursive: true });
  mkdirSync(commonDir, { recursive: true });
  const stateFile = path.join(home, 'state.json');
  const callsFile = path.join(home, 'calls.jsonl');
  const state: Record<string, unknown> = { root, commonDir, sha: SHA, other: OTHER, prs: [], protections: [[]], counts: {} };
  const fake = `#!${process.execPath}
import fs from 'node:fs';
import path from 'node:path';
const file = process.env.LOLLY_HYGIENE_TEST_STATE;
const s = JSON.parse(fs.readFileSync(file, 'utf8'));
const name = path.basename(process.argv[1]);
const a = process.argv.slice(2);
fs.appendFileSync(process.env.LOLLY_HYGIENE_TEST_CALLS, JSON.stringify({name,args:a,cwd:process.cwd()})+'\\n');
function emit(out='',status=0,err='') { process.stdout.write(out); process.stderr.write(err); process.exit(status); }
if (name==='lsof') {
  const i=s.counts.lsof||0; s.counts.lsof=i+1; fs.writeFileSync(file,JSON.stringify(s));
  if(s.ownCwd) emit('p'+process.ppid+'\\nn'+s.ownCwd+'\\n');
  const row=(s.lsof||[{stdout:'p123\\nn/elsewhere\\n',status:0}])[i] || {stdout:'p123\\nn/elsewhere\\n',status:0};
  emit(row.stdout,row.status,row.stderr||'');
}
if (name==='gh') {
  if(a[0]==='pr') emit(JSON.stringify(s.prs));
  if(a[0]==='api') emit(JSON.stringify(s.protections));
}
if (name==='git') {
  if(a[0]==='check-ignore') emit('',1);
  if(a[0]==='remote') emit((a.includes('--push')?(s.pushUrl||s.url||'git@github.com:owner/repo.git'):(s.url||'git@github.com:owner/repo.git'))+'\\n');
  if(a[0]==='fetch') emit();
  if(a[0]==='symbolic-ref') emit('origin/main\\n');
  if(a[0]==='ls-remote') emit(a.slice(3).map(ref=>(ref==='refs/heads/main'?(s.liveMain||s.sha):(s.liveBranch||s.sha))+'\\t'+ref).join('\\n')+'\\n');
  if(a[0]==='rev-parse') {
    if(a.includes('--show-toplevel')) emit(s.root+'\\n');
    if(a.includes('--git-common-dir')) emit(s.commonDir+'\\n');
    if(a.includes('--absolute-git-dir')) emit(path.join(process.cwd(),'.git')+'\\n');
    emit(s.sha+'\\n');
  }
  if(a[0]==='rev-list') emit(String(s.ahead||0)+'\\n');
  if(a[0]==='for-each-ref') emit('refs/remotes/origin/main\\t'+s.sha+'\\t2026-10-08\\n');
  if(a[0]==='worktree'&&a[1]==='list') emit(s.entries);
  if(a[0]==='status') emit((s.status||{})[process.cwd()]||'');
  if(a[0]==='push'||(a[0]==='worktree'&&a[1]==='remove')||(a[0]==='branch'&&a[1]==='-D')) emit();
}
emit('',91,'unexpected fake command: '+name+' '+JSON.stringify(a));
`;
  for (const cmd of ['git', 'gh', 'lsof']) {
    const target = path.join(bin, cmd);
    writeFileSync(target, fake);
    chmodSync(target, 0o700);
  }
  function worktree(name: string): Worktree {
    const p = path.join(root, '.worktrees', name);
    mkdirSync(path.join(p, '.git'), { recursive: true });
    const index = path.join(p, '.git', 'index');
    writeFileSync(index, 'fixture index');
    utimesSync(index, new Date(0), new Date(0));
    return {
      path: p, isMain: false, branch: `feat/${name}`, head: SHA, locked: false,
      missing: false, cwdPids: [], indexAgeMinutes: 90, dirty: [], ignoredKeep: [],
      submoduleInitialised: false, containsWorktree: false, headInMain: true,
      headOnRemote: [], noise: 0, notes: [], indexMtimeMs: statSync(index).mtimeMs,
      warnings: [], decision: { act: true, why: 'fixture candidate' },
    };
  }
  const a = worktree('a');
  const b = worktree('b');
  state.entries = [
    `worktree ${root}`, `HEAD ${SHA}`, 'branch refs/heads/main', '',
    ...[a, b].flatMap((w) => [`worktree ${w.path}`, `HEAD ${SHA}`, `branch refs/heads/${w.branch}`, '']), '',
  ].join('\0');
  const remote: RemoteBranch = { name: 'feat/merged', sha: SHA, date: '', verdict: { status: 'IN_MAIN', inMain: true, detail: '' }, ancestorOfMain: true, protectedBranch: false, warning: null, decision: { act: true, why: 'fixture candidate' } };
  const report: RepoReport = { root, commonDir, slug: 'owner/repo', remote: 'origin', mainBranch: 'main', mainSha: SHA, fetched: true, prsKnown: true, remoteBranches: [], localBranches: [], worktrees: [a], mainCheckout: null, warnings: [] };
  function run(code = `prune(${JSON.stringify(report)})`) {
    writeFileSync(stateFile, JSON.stringify(state));
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `import {prune,collectRepo,parseArgs} from ${JSON.stringify(SCRIPT)}; ${code}`], {
      cwd: root, env: { ...process.env, PATH: bin, LOLLY_HYGIENE_TEST_STATE: stateFile, LOLLY_HYGIENE_TEST_CALLS: callsFile },
      encoding: 'utf8', timeout: 15_000,
    });
    assert.equal(result.status, 0, result.stderr);
    return existsSync(callsFile) ? readFileSync(callsFile, 'utf8').trim().split('\n').map((line) => JSON.parse(line)) : [];
  }
  return { home, root, state, a, b, report, remote, run, close: () => rmSync(home, { recursive: true, force: true }) };
}

const mutations = (calls: Array<{ name: string; args: string[] }>) => calls.filter((c) => c.name === 'git' && (c.args[0] === 'push' || c.args[0] === 'branch' || (c.args[0] === 'worktree' && ['remove', 'prune'].includes(c.args[1]!))));

test('actual prune refuses failed or malformed lsof with partial stdout', () => {
  for (const row of [
    { stdout: 'p123\nn/elsewhere\n', status: 1 },
    { stdout: 'p123\nn/elsewhere\n', status: 1, stderr: 'ETIMEDOUT after partial output' },
    { stdout: 'p123\nn/elsewhere\n', status: 0, stderr: 'WARNING: process visibility incomplete' },
    { stdout: 'p123\nn/elsewhere\np456\n', status: 0 },
  ]) {
    const f = sandbox();
    try {
      f.state.lsof = [row];
      const calls = f.run();
      assert.equal(calls.filter((c) => c.name === 'lsof').length, 1, 'actual process guard reached');
      assert.deepEqual(mutations(calls), []);
    }
    finally { f.close(); }
  }
});

test('actual prune takes a new process inventory for each worktree', () => {
  const f = sandbox();
  try {
    f.report.worktrees = [f.a, f.b];
    f.state.lsof = [{ stdout: 'p123\nn/elsewhere\n', status: 0 }, { stdout: `p456\nn${f.b.path}\n`, status: 0 }];
    const calls = f.run();
    assert.deepEqual(mutations(calls).map((c) => c.args), [['worktree', 'remove', f.a.path]]);
    assert.equal(calls.filter((c) => c.name === 'lsof').length, 2);
    assert.ok(existsSync(f.a.path) && existsSync(f.b.path), 'fake mutation never removes any actual directory');
  } finally { f.close(); }
});

test('actual process guard resolves a working-directory symlink into the worktree', () => {
  const f = sandbox();
  try {
    const alias = path.join(f.home, 'alias');
    symlinkSync(f.a.path, alias, 'dir');
    f.state.lsof = [{ stdout: `p456\nn${alias}\n`, status: 0 }];
    const calls = f.run();
    assert.equal(calls.filter((c) => c.name === 'lsof').length, 1);
    assert.deepEqual(mutations(calls), []);
  } finally { f.close(); }
});

test('actual prune retains the checkout used by its own calling process', () => {
  const f = sandbox();
  try {
    f.state.ownCwd = f.a.path;
    const calls = f.run();
    assert.equal(calls.filter((c) => c.name === 'lsof').length, 1);
    assert.deepEqual(mutations(calls), []);
  } finally { f.close(); }
});

test('actual prune refuses newly locked, nested, dirty or ignored worktrees', () => {
  for (const change of ['lock', 'nested', 'dirty', 'ignored', 'plans', 'main', 'history']) {
    const f = sandbox();
    try {
      if (change === 'lock') f.state.entries = String(f.state.entries).replace(`branch refs/heads/${f.a.branch}\0`, `branch refs/heads/${f.a.branch}\0locked another agent\0`);
      if (change === 'nested') f.state.entries = String(f.state.entries) + `worktree ${f.a.path}/nested\0HEAD ${SHA}\0detached\0\0`;
      if (['dirty', 'ignored', 'plans'].includes(change)) f.state.status = { [f.a.path]: change === 'dirty' ? '?? new-source.ts\0' : change === 'plans' ? '!! plans/\0' : '!! dist/\0' };
      if (change === 'main') f.state.liveMain = OTHER;
      if (change === 'history') f.state.ahead = 1;
      assert.deepEqual(mutations(f.run()), [], change);
    } finally { f.close(); }
  }
});

test('actual remote prune rechecks PR heads and bases, protection, authority and refs', () => {
  for (const change of ['head', 'base', 'protected', 'bad-protection', 'bad-pr', 'main', 'branch', 'host', 'push-host', 'push-multiple', 'history']) {
    const f = sandbox();
    try {
      f.report.remoteBranches = [f.remote];
      f.report.worktrees = [];
      if (change === 'head') f.state.prs = [{ number: 42, headRefName: f.remote.name, baseRefName: 'main' }];
      if (change === 'base') f.state.prs = [{ number: 42, headRefName: 'other', baseRefName: f.remote.name }];
      if (change === 'protected') f.state.protections = [[{ name: f.remote.name, protected: true }]];
      if (change === 'bad-protection') f.state.protections = [[{ name: f.remote.name }]];
      if (change === 'bad-pr') f.state.prs = [{ number: 42 }];
      if (change === 'main') f.state.liveMain = OTHER;
      if (change === 'branch') f.state.liveBranch = OTHER;
      if (change === 'host') f.state.url = 'https://evilgithub.com/owner/repo.git';
      if (change === 'push-host') f.state.pushUrl = 'https://github.com/other/repo.git';
      if (change === 'push-multiple') f.state.pushUrl = 'git@github.com:owner/repo.git\ngit@github.com:other/repo.git';
      if (change === 'history') f.state.ahead = 1;
      assert.deepEqual(mutations(f.run()), [], change);
    } finally { f.close(); }
  }
});

test('actual permitted remote command carries the exact SHA lease', () => {
  const f = sandbox();
  try {
    f.report.remoteBranches = [f.remote]; f.report.worktrees = [];
    const call = mutations(f.run());
    assert.equal(call.length, 1);
    assert.deepEqual(call[0]!.args, ['push', '--no-verify', '--quiet', `--force-with-lease=refs/heads/${f.remote.name}:${SHA}`, 'origin', `:refs/heads/${f.remote.name}`]);
  } finally { f.close(); }
});

test('actual prune never deletes local branches or globally prunes registrations', () => {
  const f = sandbox();
  try {
    f.report.worktrees = [{ ...f.a, missing: true }];
    const report = { ...f.report, localBranches: [{ ...f.remote, checkedOutIn: [], upstream: '', upstreamGone: true }] };
    assert.deepEqual(mutations(f.run(`prune(${JSON.stringify(report)})`)), []);
  } finally { f.close(); }
});

test('actual report fetch overrides pruning configuration and uses NUL worktree paths', () => {
  const f = sandbox();
  try {
    const calls = f.run(`collectRepo(${JSON.stringify(f.root)},parseArgs(['--remote-only']))`);
    assert.deepEqual(calls.find((c) => c.name === 'git' && c.args[0] === 'fetch')!.args, ['fetch', '--no-prune', '--quiet', '--no-recurse-submodules', 'origin']);
    assert.deepEqual(calls.find((c) => c.name === 'git' && c.args[0] === 'worktree')!.args, ['worktree', 'list', '--porcelain', '-z']);
    assert.deepEqual(mutations(calls), []);
  } finally { f.close(); }
});
