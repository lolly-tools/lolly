// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { assessJobs, classifyChanges, hash, inspectScope, PUBLIC_JOBS, qualify, RELEASE_JOBS, validateScope, WORKFLOW } from '../scripts/ci-qualification.ts';
import type { Change, Identity, Job, Scope } from '../scripts/ci-qualification.ts';
import { PUBLIC_READY_UI_FILES } from '../scripts/run-public-ready-ui.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const id: Identity = { source: 'a'.repeat(40), tree: 'b'.repeat(40), base: 'c'.repeat(40), headSha: 'a'.repeat(40),
  repository: 'example/lolly', repositoryId: 17, headRepository: 'example/lolly', headBranch: 'main', event: 'push', runId: 1234, runAttempt: 2 };
const change = (path: string, beforeMode = '100644', afterMode = '100644'): Change => ({ path, beforeMode, afterMode });
const changes = [change('shells/web/src/styles/inputs.css')];
const scope = (eligible = true): Scope => ({ version: 1, ...id, publicReadyEligible: eligible,
  policyCommit: id.base, policySha256: 'd'.repeat(64), changedPathsSha256: hash(JSON.stringify(changes)), changes, reasons: [] });
const run = () => ({ id: id.runId, run_attempt: id.runAttempt, head_sha: id.headSha, path: WORKFLOW, event: id.event,
  head_branch: id.headBranch, repository: { full_name: id.repository, id: id.repositoryId },
  head_repository: { full_name: id.headRepository }, status: 'in_progress', conclusion: null });
const job = (name: string, index: number, status = 'completed', conclusion: unknown = 'success'): Job => ({
  id: 100 + index, name, status, conclusion, run_id: id.runId, run_attempt: id.runAttempt,
  head_sha: id.headSha, head_branch: id.headBranch, workflow_name: 'CI' });
const jobs = () => RELEASE_JOBS.map((name, index) => job(name, index));
const page = (all: Job[]) => [{ total_count: all.length, jobs: all }];

test('UI source and canonical tokens qualify together with their focused tests', () => {
  const paths = [...changes, change('shells/web/design/chrome-tokens.json'), change('tests/chrome-tokens.test.ts'),
    change('shells/web/src/lib/edge-dock.ts'), change('shells/web/src/views/design-navigator.test.ts')];
  assert.deepEqual(classifyChanges(paths), { publicReadyEligible: true, reasons: [] });
  assert.equal(classifyChanges([]).publicReadyEligible, false);
  assert.equal(classifyChanges([change('tests/chrome-tokens.test.ts')]).publicReadyEligible, false);
});

for (const path of ['engine/src/runtime.ts', 'packages/node-shell/src/content-roots.ts', 'pnpm-lock.yaml', 'package.json',
  '.github/workflows/ci.yml', 'scripts/ci-qualification.ts', 'scripts/run-public-ready-ui.ts', 'security/lint-baseline.json',
  'shells/web/src/main.ts', 'shells/web/src/bridge/auth.ts', 'shells/web/src/catalog/sync.ts',
  'shells/web/src/views/account.ts', 'shells/web/src/views/auth/login.ts', 'shells/web/src/views/tool/session.ts',
  'shells/web/src/components/admin-menu.ts', 'shells/web/src/views/remote-identity.ts',
  'shells/web/src/views/profile.ts', 'shells/web/src/views/profile/chrome.ts', 'shells/web/src/views/profile/identity.ts',
  'shells/web/src/views/profile-connections.ts', 'shells/web/src/components/instance-sheet.ts', 'unknown.ts']) {
  test(`full tier is required for ${path}`, () => assert.equal(classifyChanges([...changes, change(path)]).publicReadyEligible, false));
}

test('symlinks, executable modes, traversal and control characters cannot enter the UI lane', () => {
  for (const value of [change(changes[0]!.path, '100644', '120000'), change(changes[0]!.path, '100644', '100755'),
    change('shells/web/src/styles/../views/x.css'), change('shells/web/src/styles/x\ny.css'),
    change('shells/web/src/styles\\x.css'), change('shells/web/src/styles//x.css')]) {
    assert.equal(classifyChanges([value]).publicReadyEligible, false);
  }
});

test('scope inspection uses the exact base policy and captures real Git changes and modes', t => {
  const directory = mkdtempSync(join(tmpdir(), 'lolly-ci-policy-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const git = (...args: string[]) => execFileSync('git', args, { cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-q'); git('config', 'user.name', 'CI fixture'); git('config', 'user.email', 'ci@example.invalid');
  mkdirSync(join(directory, 'scripts'), { recursive: true }); mkdirSync(join(directory, 'shells/web/src/styles'), { recursive: true });
  const policy = readFileSync(join(root, 'scripts/ci-qualification.ts'));
  writeFileSync(join(directory, 'scripts/ci-qualification.ts'), policy);
  writeFileSync(join(directory, changes[0]!.path), 'body { color: black; }\n');
  git('add', '.'); git('-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'base');
  const base = git('rev-parse', 'HEAD');
  writeFileSync(join(directory, changes[0]!.path), 'body { color: white; }\n');
  git('add', '.'); git('-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'UI');
  const exact = { ...id, base, source: git('rev-parse', 'HEAD'), tree: git('rev-parse', 'HEAD^{tree}') };
  const result = inspectScope(exact, directory, join(directory, 'scripts/ci-qualification.ts'));
  assert.equal(result.publicReadyEligible, true); assert.deepEqual(result.changes, changes);
  assert.equal(result.policySha256, hash(policy)); assert.equal(result.policyCommit, base);
  writeFileSync(join(directory, 'scripts/ci-qualification.ts'), Buffer.concat([policy, Buffer.from('\n// changed policy\n')]));
  assert.throws(() => inspectScope(exact, directory, join(directory, 'scripts/ci-qualification.ts')), /exact trusted base/);
  git('add', '.'); git('-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'policy');
  writeFileSync(join(directory, 'trusted-policy.ts'), policy);
  const broad = inspectScope({ ...exact, source: git('rev-parse', 'HEAD') }, directory, join(directory, 'trusted-policy.ts'));
  assert.equal(broad.publicReadyEligible, false);
});

test('scope binds exact source, attempt, policy and inventory digest', () => {
  assert.equal(validateScope(scope(), id).publicReadyEligible, true);
  for (const difference of [{ source: 'e'.repeat(40) }, { runAttempt: 1 }, { policyCommit: 'e'.repeat(40) },
    { changedPathsSha256: 'e'.repeat(64) }, { policySha256: null }]) {
    assert.throws(() => validateScope({ ...scope(), ...difference }, id));
  }
  const broad = [change('engine/src/runtime.ts')];
  assert.throws(() => validateScope({ ...scope(), changes: broad, changedPathsSha256: hash(JSON.stringify(broad)) }, id), /not eligible/);
});

test('public-ready can finish while full unit and browser suites remain pending', () => {
  const all = jobs().map(value => PUBLIC_JOBS.includes(value.name as typeof PUBLIC_JOBS[number]) ? value : { ...value, status: 'in_progress', conclusion: null });
  assert.equal(assessJobs(run(), page(all), id, scope(), 'public-ready').ready, true);
  assert.equal(assessJobs(run(), page(all), id, scope(), 'release-ready').ready, false);
  assert.equal(assessJobs(run(), page(all), id, scope(), 'public-ready', true).ready, false);
  all.push(job('public-ready', 100));
  assert.equal(assessJobs(run(), page(all), id, scope(), 'public-ready', true).ready, true);
});

test('missing required checks remain pending and broad changes cannot select public-ready', () => {
  assert.equal(assessJobs(run(), page(jobs().slice(1)), id, scope(), 'public-ready').ready, false);
  assert.throws(() => assessJobs(run(), page(jobs()), id, scope(false), 'public-ready'), /Broad changes/);
});

for (const conclusion of ['failure', 'cancelled', 'timed_out', 'action_required', 'neutral', 'skipped', 'stale']) {
  test(`an unselected background job with ${conclusion} prevents public qualification`, () => {
    const all = jobs(); all.push(job('unselected future suite', 100, 'completed', conclusion));
    assert.throws(() => assessJobs(run(), page(all), id, scope(), 'public-ready'));
  });
}

test('only the expected instance skip and broad-scope public-ready skip are accepted', () => {
  const all = [...jobs(), job('verified instance shell', 100, 'completed', 'skipped')];
  assert.equal(assessJobs(run(), page(all), id, scope(), 'public-ready').ready, true);
  all.push(job('public-ready', 101, 'completed', 'skipped'));
  assert.throws(() => assessJobs(run(), page(all), id, scope(), 'public-ready'), /Unreviewed skipped/);
  assert.equal(assessJobs(run(), page(all), id, scope(false), 'release-ready').ready, true);
});

test('run and every job must match the immutable provider identity', () => {
  for (const difference of [{ id: 999 }, { run_attempt: 1 }, { head_sha: 'e'.repeat(40) }, { path: 'other.yml' },
    { event: 'workflow_dispatch' }, { head_branch: 'other' }, { repository: { full_name: id.repository, id: 999 } },
    { head_repository: { full_name: 'attacker/lolly' } }]) {
    assert.throws(() => assessJobs({ ...run(), ...difference }, page(jobs()), id, scope(), 'public-ready'), /identity differs/);
  }
  for (const difference of [{ run_id: 999 }, { run_attempt: 1 }, { head_sha: 'e'.repeat(40) },
    { head_branch: 'other' }, { workflow_name: 'Untrusted' }]) {
    const all = jobs(); all[0] = { ...all[0]!, ...difference };
    assert.throws(() => assessJobs(run(), page(all), id, scope(), 'public-ready'), /identity differs/);
  }
});

test('complete paginated job inventory is required without duplicate identities or names', () => {
  const all = jobs(), half = Math.floor(all.length / 2);
  const pages = [{ total_count: all.length, jobs: all.slice(0, half) }, { total_count: all.length, jobs: all.slice(half) }];
  assert.equal(assessJobs(run(), pages, id, scope(), 'release-ready').ready, true);
  assert.throws(() => assessJobs(run(), pages.slice(0, 1), id, scope(), 'public-ready'), /Incomplete/);
  assert.throws(() => assessJobs(run(), [pages[0], { ...pages[1], total_count: 999 }], id, scope(), 'public-ready'), /pagination/);
  assert.throws(() => assessJobs(run(), page([...all, all[0]!]), id, scope(), 'public-ready'), /duplicate/);
  assert.throws(() => assessJobs(run(), page([...all, { ...all[0]!, id: 9999 }]), id, scope(), 'public-ready'), /duplicate/);
});

test('provider failure and incomplete completed status are refused', () => {
  assert.throws(() => assessJobs({ ...run(), status: 'completed', conclusion: 'failure' }, page(jobs()), id, scope(), 'public-ready'), /known failure/);
  assert.throws(() => assessJobs({ ...run(), status: 'completed' }, page(jobs()), id, scope(), 'public-ready'), /did not succeed/);
  const all = jobs(); all[0] = { ...all[0]!, conclusion: null };
  assert.throws(() => assessJobs(run(), page(all), id, scope(), 'public-ready'), /did not succeed/);
});

test('workflow keeps fast qualification independent of the full matrix and uses trusted base policy', () => {
  const workflow = readFileSync(join(root, WORKFLOW), 'utf8');
  for (const name of ['public-ready', 'qualification']) {
    const block = workflow.split(`\n  ${name}:\n`)[1]!.split(/\n {2}[a-z][a-z-]+:\n/)[0]!;
    assert.match(block, /needs: \[deployment-scope, public-ready-ui, test-fast,/);
    assert.doesNotMatch(block, /needs:.*(?:, test,|browser-gate|release-ready)/);
    assert.match(block, /actions: read/); assert.doesNotMatch(block, /write/);
    assert.match(block, /git show "\$CI_BASE_SHA:scripts\/ci-qualification.ts"/);
    assert.match(block, /github.run_id.*github.run_attempt/);
  }
  const full = workflow.split('\n  release-ready:\n')[1]!.split('\n  qualification:\n')[0]!;
  assert.match(full, /needs: \[.*\btest\b.*browser-gate.*audit.*sast/);
  const focused = workflow.split('\n  public-ready-ui:\n')[1]!.split(/\n {2}[a-z][a-z-]+:\n/)[0]!;
  assert.doesNotMatch(focused, /^ {4}if:/m); assert.match(focused, /node scripts\/run-public-ready-ui.ts/);
  assert.match(workflow, /Trusted base has no CI policy; full release required/);
  assert.match(workflow, /public-ready=false/);
});

test('fast tests start before long suites, share exact steps, and preserve all original shards on failure', () => {
  interface WorkflowJob { needs?: string[]; if?: string; steps: Array<{ name?: string }>;
    strategy?: { matrix: { include: Array<{ shard: string; partition?: string; artifact: string }> } } }
  const workflow = parse(readFileSync(join(root, WORKFLOW), 'utf8')) as { jobs: Record<string, WorkflowJob> };
  assert.deepEqual(Object.keys(workflow.jobs).slice(0, 2), ['deployment-scope', 'public-ready-ui']);
  const fast = workflow.jobs['test-fast']!, long = workflow.jobs.test!;
  assert.equal(fast.needs, undefined);
  assert.deepEqual(fast.strategy!.matrix.include.map(value => value.shard), ['contracts', 'security']);
  assert.deepEqual(long.needs, ['deployment-scope', 'public-ready-ui']);
  assert.match(long.if!, /always\(\) && !cancelled\(\)/);
  assert.strictEqual(fast.steps, long.steps, 'YAML alias must resolve to the one unchanged test-step list');
  assert.ok(fast.steps.some(step => step.name === 'Install Chromium (browser and security shards)'));
  assert.ok(fast.steps.some(step => step.name === 'Skipped tests must match exact CI identities'));
  const shards = [...fast.strategy!.matrix.include, ...long.strategy!.matrix.include];
  assert.equal(shards.length, 12); assert.equal(new Set(shards.map(value => value.artifact)).size, 12);
  assert.deepEqual(shards.filter(value => value.shard === 'browser').map(value => value.partition), ['1/4', '2/4', '3/4', '4/4']);
  for (const name of ['public-ready', 'qualification']) {
    const needs = workflow.jobs[name]!.needs!;
    assert.ok(needs.includes('test-fast')); assert.ok(needs.includes('public-ready-ui'));
    assert.ok(!needs.includes('test') && !needs.includes('browser-gate'));
  }
  assert.ok(workflow.jobs['release-ready']!.needs!.includes('test-fast'));
  assert.ok(workflow.jobs['release-ready']!.needs!.includes('test'));
});

test('focused UI set includes canonical-token drift and contains no browser-only tests', () => {
  assert.equal(PUBLIC_READY_UI_FILES.length, 5);
  assert.ok(PUBLIC_READY_UI_FILES.includes('tests/chrome-tokens.test.ts'));
  for (const file of PUBLIC_READY_UI_FILES) {
    assert.doesNotMatch(file, /browser/); assert.ok(readFileSync(join(root, file)).length > 0);
  }
});

test('manual request pins the same Work workflow and operator source without production authority', () => {
  const workflow = readFileSync(join(root, '.github/workflows/shell-deployment-request.yml'), 'utf8');
  const pinned = workflow.match(/uses: lolly-tools\/lolly-work\/\.github\/workflows\/shell-deployment-request.yml@([a-f0-9]{40})/);
  assert.ok(pinned);
  assert.match(workflow, new RegExp(`operator_source: ${pinned[1]}(?:\\n|$)`));
  assert.match(workflow, /workflow_dispatch:/); assert.match(workflow, /github.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /contents: read/); assert.match(workflow, /actions: read/);
  assert.doesNotMatch(workflow, /secrets:|write|concurrency:/);
  for (const input of ['source', 'ci_run', 'ci_attempt', 'tier']) assert.ok(workflow.includes(`${input}: \${{ inputs.${input} }}`));
});

test('qualification preserves exact provider bytes and emits source-bound publication evidence', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'lolly-ci-evidence-'));
  const originalFetch = globalThis.fetch, originalToken = process.env.GH_TOKEN;
  t.after(() => { globalThis.fetch = originalFetch; if (originalToken === undefined) delete process.env.GH_TOKEN;
    else process.env.GH_TOKEN = originalToken; rmSync(directory, { recursive: true, force: true }); });
  process.env.GH_TOKEN = 'unit-fixture';
  const rawRun = `${JSON.stringify(run(), null, 2)}\n`, rawJobs = JSON.stringify(page(jobs())[0]);
  const urls: string[] = [];
  globalThis.fetch = (async input => {
    const url = String(input); urls.push(url);
    return new Response(url.includes('/jobs?') ? rawJobs : rawRun, { status: 200 });
  }) as typeof fetch;
  await qualify(id, scope(), 'public-ready', directory, false);
  const report = JSON.parse(readFileSync(join(directory, 'qualification.json'), 'utf8'));
  assert.equal(report.status, 'CI_QUALIFIED'); assert.equal(report.qualificationTier, 'public-ready');
  assert.equal(report.fullSuiteQualified, false); assert.equal(report.productionMutation, false);
  assert.equal(report.publicationEligible, true); assert.equal(report.knownFailuresRejected, true);
  assert.equal(report.lateFailureCheckRequired, true); assert.equal(report.source, id.source);
  assert.equal(report.runAttempt, id.runAttempt); assert.equal(report.scope.policyCommit, id.base);
  assert.equal(report.provider.run.sha256, hash(rawRun)); assert.equal(report.provider.jobs[0].sha256, hash(rawJobs));
  assert.equal(readFileSync(join(directory, 'run.original.json'), 'utf8'), rawRun);
  assert.equal(readFileSync(join(directory, 'jobs-1.original.json'), 'utf8'), rawJobs);
  assert.ok(urls[1]!.includes('/attempts/2/jobs?'));
  assert.deepEqual(report.requiredJobs.map((value: Job) => value.name), PUBLIC_JOBS);
});
