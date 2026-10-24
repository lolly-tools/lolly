// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { assessJobs, classifyChanges, classifyDocsAndTests, DOCS_AND_TESTS_JOBS, hash, HEAVY_JOBS, inspectScope, PROVIDER_WINDOW_MS,
  PUBLIC_JOBS, qualify, RELEASE_JOBS, selectTier, touchesDependencies, validateScope, WORKFLOW } from '../scripts/ci-qualification.ts';
import type { Change, Identity, Job, Lane, Scope } from '../scripts/ci-qualification.ts';
import { PUBLIC_READY_UI_FILES } from '../scripts/run-public-ready-ui.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const id: Identity = { source: 'a'.repeat(40), tree: 'b'.repeat(40), base: 'c'.repeat(40), headSha: 'a'.repeat(40),
  repository: 'example/lolly', repositoryId: 17, headRepository: 'example/lolly', headBranch: 'main', event: 'push', runId: 1234, runAttempt: 2 };
const change = (path: string, beforeMode = '100644', afterMode = '100644'): Change => ({ path, beforeMode, afterMode });
const changes = [change('shells/web/src/styles/inputs.css')];
const scope = (eligible = true): Scope => ({ version: 1, ...id, publicReadyEligible: eligible, lane: eligible ? 'public-ready' : 'full',
  dependencyChange: false, policyCommit: id.base, policySha256: 'd'.repeat(64), changedPathsSha256: hash(JSON.stringify(changes)), changes, reasons: [] });
const docsChanges = [change('docs/i18n/de/using.md'), change('docs/shots/gallery.svg'), change('tests/url-mode.test.ts')];
const pr: Identity = { ...id, event: 'pull_request', headBranch: 'feature' };
const docsScope = (identity: Identity = pr, lane: Lane = 'docs-and-tests'): Scope => ({ version: 1, ...identity, publicReadyEligible: false, lane,
  dependencyChange: false, policyCommit: identity.base, policySha256: 'd'.repeat(64), changedPathsSha256: hash(JSON.stringify(docsChanges)),
  changes: docsChanges, reasons: [] });
const prRun = () => ({ ...run(), event: pr.event, head_branch: pr.headBranch });
const prJob = (name: string, index: number, status = 'completed', conclusion: unknown = 'success'): Job => ({ ...job(name, index, status, conclusion), head_branch: pr.headBranch });
/** A docs-and-tests pull request run: no heavy matrix entries, a skipped browser gate and a skipped release-ready. */
const docsJobs = () => [...DOCS_AND_TESTS_JOBS.map((name, index) => prJob(name, index)),
  prJob('test (browser)', 90, 'completed', 'skipped'), prJob('release-ready', 91, 'completed', 'skipped'),
  prJob('public-ready', 92, 'completed', 'skipped'), prJob('verified instance shell', 93, 'completed', 'skipped')];
const run = () => ({ id: id.runId, run_attempt: id.runAttempt, head_sha: id.headSha, path: WORKFLOW, event: id.event,
  head_branch: id.headBranch, repository: { full_name: id.repository, id: id.repositoryId },
  head_repository: { full_name: id.headRepository }, status: 'in_progress', conclusion: null });
const job = (name: string, index: number, status = 'completed', conclusion: unknown = 'success'): Job => ({
  id: 100 + index, name, status, conclusion, run_id: id.runId, run_attempt: id.runAttempt,
  head_sha: id.headSha, head_branch: id.headBranch, workflow_name: 'CI' });
const jobs = () => RELEASE_JOBS.map((name, index) => job(name, index));
const page = (all: Job[]) => [{ total_count: all.length, jobs: all }];
/** A GitHub Actions expression as the workflow spells it, built without a template placeholder in a plain string. */
const expression = (body: string) => ['$', '{{ ', body, ' }}'].join('');

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
  assert.equal(result.lane, 'public-ready'); assert.equal(result.dependencyChange, false);
  assert.equal(result.policySha256, hash(policy)); assert.equal(result.policyCommit, base);
  writeFileSync(join(directory, 'scripts/ci-qualification.ts'), Buffer.concat([policy, Buffer.from('\n// changed policy\n')]));
  assert.throws(() => inspectScope(exact, directory, join(directory, 'scripts/ci-qualification.ts')), /exact trusted base/);
  git('add', '.'); git('-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'policy');
  writeFileSync(join(directory, 'trusted-policy.ts'), policy);
  const broad = inspectScope({ ...exact, source: git('rev-parse', 'HEAD') }, directory, join(directory, 'trusted-policy.ts'));
  assert.equal(broad.publicReadyEligible, false); assert.equal(broad.lane, 'full');
});

test('scope inspection reads changed test files from Git to keep heavy-tier tests on the heavy tier', t => {
  const directory = mkdtempSync(join(tmpdir(), 'lolly-ci-lane-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const git = (...args: string[]) => execFileSync('git', args, { cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-q'); git('config', 'user.name', 'CI fixture'); git('config', 'user.email', 'ci@example.invalid');
  for (const folder of ['scripts', 'docs', 'tests']) mkdirSync(join(directory, folder), { recursive: true });
  const policy = readFileSync(join(root, 'scripts/ci-qualification.ts'));
  writeFileSync(join(directory, 'scripts/ci-qualification.ts'), policy);
  writeFileSync(join(directory, 'docs/using.md'), '# Using\n');
  writeFileSync(join(directory, 'tests/old.test.ts'), `// needs ${'LOLLY' + '_BROWSER'}\n`);
  git('add', '.'); git('-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'base');
  const base = git('rev-parse', 'HEAD');
  const inspect = () => inspectScope({ ...id, event: 'pull_request', headBranch: 'feature', base, source: git('rev-parse', 'HEAD'),
    tree: git('rev-parse', 'HEAD^{tree}') }, directory, join(directory, 'scripts/ci-qualification.ts'));
  writeFileSync(join(directory, 'docs/using.md'), '# Using Lolly\n');
  writeFileSync(join(directory, 'tests/units.test.ts'), 'import test from "node:test";\n');
  git('add', '.'); git('-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'docs and a unit test');
  const docs = inspect();
  assert.equal(docs.lane, 'docs-and-tests'); assert.equal(docs.publicReadyEligible, false); assert.equal(docs.dependencyChange, false);
  writeFileSync(join(directory, 'tests/units.test.ts'), `// starts ${'play' + 'wright'}\n`);
  git('add', '.'); git('-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'a browser test by its runtime');
  assert.equal(inspect().lane, 'full');
  git('rm', '-q', 'tests/units.test.ts', 'tests/old.test.ts');
  git('-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'delete a browser test');
  assert.equal(inspect().lane, 'full', 'a deleted test is read from the base, where it still asks for a browser');
});

test('scope binds exact run, commits, policy and inventory digest, and an attempt no later than the current one', () => {
  assert.equal(validateScope(scope(), id).publicReadyEligible, true);
  for (const difference of [{ source: 'e'.repeat(40) }, { policyCommit: 'e'.repeat(40) },
    { changedPathsSha256: 'e'.repeat(64) }, { policySha256: null }]) {
    assert.throws(() => validateScope({ ...scope(), ...difference }, id));
  }
  // id is attempt 2. An earlier attempt of the same run is accepted; a later, absent or malformed one is not.
  assert.equal(validateScope({ ...scope(), runAttempt: 1 }, id).runAttempt, 1);
  for (const runAttempt of [3, 0, -1, 1.5, '1', null, undefined]) {
    assert.throws(() => validateScope({ ...scope(), runAttempt }, id), /Scope runAttempt differs/, String(runAttempt));
  }
  const broad = [change('engine/src/runtime.ts')];
  assert.throws(() => validateScope({ ...scope(), changes: broad, changedPathsSha256: hash(JSON.stringify(broad)) }, id), /not eligible/);
  assert.equal(validateScope(docsScope(), pr).lane, 'docs-and-tests');
  for (const difference of [{ lane: 'docs-and-tests' }, { lane: 'unknown' }, { lane: undefined }, { dependencyChange: undefined }]) {
    assert.throws(() => validateScope({ ...scope(), ...difference }, id), /lane|dependency/);
  }
  assert.throws(() => validateScope({ ...docsScope(), changes: broad, changedPathsSha256: hash(JSON.stringify(broad)) }, pr), /Docs-and-tests scope/);
  const lock = [change('pnpm-lock.yaml')];
  assert.throws(() => validateScope({ ...scope(false), lane: 'full', changes: lock, changedPathsSha256: hash(JSON.stringify(lock)) }, id), /hides a dependency/);
  assert.equal(validateScope({ ...scope(false), lane: 'full', dependencyChange: true, changes: lock, changedPathsSha256: hash(JSON.stringify(lock)) }, id).dependencyChange, true);
});

test('a failed-only rerun qualifies with the scope receipt its first attempt wrote', async t => {
  // Run 39906275080: attempt 1 failed in browser 2/4; "Re-run failed jobs" carried the scope job over, so attempt 2
  // read the attempt-1 receipt and refused it with "Scope runAttempt differs" although every job then passed.
  const carried = { ...scope(false), runAttempt: 1 };
  assert.equal(id.runAttempt, 2);
  const accepted = validateScope(carried, id);
  // The provider re-lists every job of attempt 2, carried-over ones included, under attempt 2.
  assert.equal(assessJobs(run(), page(jobs()), id, accepted, 'release-ready').ready, true);
  const all = [...jobs(), job('release-ready', 100)];
  assert.equal(assessJobs(run(), page(all), id, accepted, 'release-ready', true).ready, true);
  // Never a receipt from another run, another commit or another repository, whatever its attempt.
  for (const difference of [{ runId: 999 }, { source: 'e'.repeat(40) }, { headSha: 'e'.repeat(40) }, { base: 'e'.repeat(40) },
    { tree: 'e'.repeat(40) }, { repository: 'attacker/lolly' }, { headRepository: 'attacker/lolly' }, { headBranch: 'other' },
    { event: 'pull_request' }]) {
    assert.throws(() => validateScope({ ...carried, ...difference }, id), /Scope .* differs/, JSON.stringify(difference));
  }
  // The receipt records the current attempt and which attempt classified the scope.
  const directory = mkdtempSync(join(tmpdir(), 'lolly-ci-rerun-'));
  const originalFetch = globalThis.fetch, originalToken = process.env.GH_TOKEN;
  t.after(() => { globalThis.fetch = originalFetch; if (originalToken === undefined) delete process.env.GH_TOKEN;
    else process.env.GH_TOKEN = originalToken; rmSync(directory, { recursive: true, force: true }); });
  process.env.GH_TOKEN = 'unit-fixture';
  globalThis.fetch = (async input => new Response(String(input).includes('/jobs?') ? JSON.stringify(page(all)[0]) : JSON.stringify(run()),
    { status: 200 })) as typeof fetch;
  await qualify(id, accepted, 'release-ready', directory, true);
  const report = JSON.parse(readFileSync(join(directory, 'qualification.json'), 'utf8'));
  assert.equal(report.runAttempt, 2); assert.equal(report.scope.runAttempt, 1); assert.equal(report.fullSuiteQualified, true);
  assert.equal(JSON.parse(readFileSync(join(directory, 'scope.json'), 'utf8')).runAttempt, 1);
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

test('aggregators wait through needs, never poll the matrix, and use trusted base policy', () => {
  const workflow = readFileSync(join(root, WORKFLOW), 'utf8');
  const block = (name: string) => workflow.split(`\n  ${name}:\n`)[1]!.split(/\n {2}[a-z][a-z-]+:\n/)[0]!;
  for (const name of ['public-ready', 'release-ready', 'qualification']) {
    const text = block(name);
    assert.match(text, /actions: read/); assert.doesNotMatch(text, /write/);
    assert.match(text, /git show "\$CI_BASE_SHA:scripts\/ci-qualification.ts"/);
    // Inputs are named by run so a failed-only rerun finds them; receipts keep the attempt for lolly-work.
    assert.match(text, /name: ci-scope-\$\{\{ github\.run_id \}\}\n/);
    assert.match(text, new RegExp(`name: ${name}-\\$\\{\\{ github\\.run_id \\}\\}-\\$\\{\\{ github\\.run_attempt \\}\\}`));
    assert.match(text, /timeout-minutes: 15\n/);
  }
  const fast = block('public-ready');
  assert.match(fast, /needs: \[deployment-scope, public-ready-ui, test-fast,/);
  assert.doesNotMatch(fast, /needs:.*(?:, test,|browser-gate|release-ready)/);
  const full = block('release-ready');
  assert.match(full, /needs: \[.*\btest\b.*browser-gate.*audit.*sast/);
  assert.match(full, /if: \$\{\{ always\(\) && !cancelled\(\) && needs\.deployment-scope\.outputs\.heavy-tier != 'skip' \}\}/);
  const gate = block('qualification');
  assert.match(gate, /if: \$\{\{ always\(\) && !cancelled\(\) \}\}/);
  assert.match(gate, /node "\$policy" gate auto scope\/ci-scope.json artifacts\/qualification/);
  assert.match(workflow, /Trusted base has no CI policy; full release required/);
  assert.match(workflow, /public-ready=false\\nlane=full\\ndependency-change=true\\n/);
  assert.doesNotMatch(workflow.replace(/name: (?:public-ready|release-ready|qualification)-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/g, ''),
    /github\.run_attempt/, 'only the three receipts are keyed by attempt');
  assert.ok(PROVIDER_WINDOW_MS <= 10 * 60 * 1000, 'the provider window covers API lag, not the test matrix');
});

test('qualification needs every other CI job, so a failure anywhere refuses it', () => {
  interface WorkflowJob { needs?: string | string[]; if?: string }
  const workflow = parse(readFileSync(join(root, WORKFLOW), 'utf8')) as { jobs: Record<string, WorkflowJob> };
  const others = Object.keys(workflow.jobs).filter(name => name !== 'qualification').sort();
  assert.deepEqual([...workflow.jobs.qualification!.needs as string[]].sort(), others);
});

test('main pushes are never cancelled once started; pull request pushes still cancel', () => {
  const workflow = parse(readFileSync(join(root, WORKFLOW), 'utf8')) as { concurrency: { group: string; 'cancel-in-progress': string } };
  assert.equal(workflow.concurrency.group, `ci-${expression('github.ref')}`);
  assert.equal(workflow.concurrency['cancel-in-progress'], expression("github.event_name == 'pull_request'"));
});

test('fast tests start before long suites, share exact steps, and preserve all original shards on failure', () => {
  interface Step { id?: string; name?: string; if?: string; env?: Record<string, string>; run?: string }
  interface WorkflowJob { needs?: string | string[]; if?: string; steps: Step[];
    strategy?: { matrix: { include: string | Array<{ shard: string; partition?: string; artifact: string }> } } }
  const workflow = parse(readFileSync(join(root, WORKFLOW), 'utf8')) as { jobs: Record<string, WorkflowJob> };
  assert.deepEqual(Object.keys(workflow.jobs).slice(0, 2), ['deployment-scope', 'public-ready-ui']);
  const fast = workflow.jobs['test-fast']!, long = workflow.jobs.test!;
  assert.equal(fast.needs, undefined);
  assert.deepEqual((fast.strategy!.matrix.include as Array<{ shard: string }>).map(value => value.shard), ['contracts', 'security']);
  assert.deepEqual(long.needs, ['deployment-scope', 'public-ready-ui']);
  assert.match(long.if!, /always\(\) && !cancelled\(\)/);
  assert.equal(long.strategy!.matrix.include, expression('fromJSON(needs.deployment-scope.outputs.test-shards)'));
  assert.strictEqual(fast.steps, long.steps, 'YAML alias must resolve to the one unchanged test-step list');
  assert.ok(fast.steps.some(step => step.name === 'Install Chromium (browser and security shards)'));
  assert.ok(fast.steps.some(step => step.name === 'Skipped tests must match exact CI identities'));
  const select = workflow.jobs['deployment-scope']!.steps.find(step => step.id === 'shards')!;
  assert.equal(select.if, 'always()', 'the matrix exists even when classification fails');
  const light = JSON.parse(select.env!.LIGHT_SHARDS!) as Array<{ shard: string; partition?: string; artifact: string }>;
  const heavy = JSON.parse(select.env!.HEAVY_SHARDS!) as typeof light;
  assert.deepEqual(light.map(value => value.shard), ['unit:engine', 'unit:web', 'tools']);
  assert.deepEqual([...new Set(heavy.map(value => value.shard))], ['browser', 'tauri', 'conformance', 'fuzz:regression']);
  const shards = [...fast.strategy!.matrix.include as typeof light, ...light, ...heavy];
  assert.equal(shards.length, 12); assert.equal(new Set(shards.map(value => value.artifact)).size, 12);
  assert.deepEqual(shards.filter(value => value.shard === 'browser').map(value => value.partition), ['1/4', '2/4', '3/4', '4/4']);
  // Only a pull request in the docs-and-tests lane leaves the heavy tier out; every other lane, unknown included, keeps the heavy tier.
  assert.match(select.run!, /if \[ "\$GITHUB_EVENT_NAME" = pull_request \] && \[ "\$LANE" = docs-and-tests \]; then\n\s+heavy=skip/);
  const heavyNames = heavy.map(value => value.partition ? `test (browser ${value.partition})` : `test (${value.shard})`);
  assert.deepEqual([...heavyNames, 'test (browser)'].sort(), [...HEAVY_JOBS].sort());
  assert.equal(workflow.jobs['browser-gate']!.if, expression("!cancelled() && needs.deployment-scope.outputs.heavy-tier != 'skip'"));
  for (const name of ['public-ready']) {
    const needs = workflow.jobs[name]!.needs as string[];
    assert.ok(needs.includes('test-fast')); assert.ok(needs.includes('public-ready-ui'));
    assert.ok(!needs.includes('test') && !needs.includes('browser-gate'));
  }
  assert.ok((workflow.jobs['release-ready']!.needs as string[]).includes('test-fast'));
  assert.ok((workflow.jobs['release-ready']!.needs as string[]).includes('test'));
});

test('browser reports and skip reports are named by run so a failed-only rerun can gate', () => {
  const workflow = readFileSync(join(root, WORKFLOW), 'utf8');
  assert.match(workflow, /name: test-skips-\$\{\{ matrix\.artifact \}\}-\$\{\{ github\.run_id \}\}\n/);
  assert.match(workflow, /pattern: test-skips-browser-\*-\$\{\{ github\.run_id \}\}\n/);
  assert.match(workflow, /name: public-ready-ui-\$\{\{ github\.run_id \}\}\n/);
});

test('the advisory lookup runs on main pushes and dependency changes, and every pull request keeps the lockfile gates', () => {
  interface Step { name?: string; if?: string; run?: string }
  const workflow = parse(readFileSync(join(root, WORKFLOW), 'utf8')) as { jobs: Record<string, { name?: string; needs?: string; if?: string; env?: Record<string, string>; steps: Step[] }> };
  const audit = workflow.jobs.audit!;
  assert.equal(audit.name, 'npm audit (high+critical)');
  assert.equal(audit.needs, 'deployment-scope'); assert.equal(audit.if, expression('!cancelled()'));
  assert.equal(audit.env!.ADVISORY_LOOKUP, expression("github.event_name != 'pull_request' || needs.deployment-scope.outputs.dependency-change != 'false'"));
  const step = (run: string) => audit.steps.find(value => value.run?.trim() === run)!;
  assert.equal(step('pnpm run audit:all').if, "env.ADVISORY_LOOKUP == 'true'");
  for (const run of ['pnpm run audit:all --check', 'pnpm run check:cargo-licenses']) assert.ok(step(run).if === undefined || step(run).if === 'always()', run);
  assert.ok(audit.steps.some(value => value.name?.startsWith('SBOM up to date') && value.if === undefined));
  assert.ok(audit.steps.every(value => !/cargo install/.test(value.run ?? '')), 'cargo-audit is a pinned binary, not a build');
  const nightly = readFileSync(join(root, '.github/workflows/dependency-audit.yml'), 'utf8');
  const triggers = (parse(nightly) as { on: Record<string, unknown> }).on;
  assert.ok(triggers.schedule && triggers.workflow_dispatch !== undefined && triggers.workflow_call !== undefined);
  assert.deepEqual((triggers.push as { tags: string[] }).tags, ['v*', 'cli-v*', 'core-v*', 'engine-v*']);
  assert.match(nightly, /run: pnpm run audit:all\n/);
});

test('the docs-and-tests lane takes documentation content, tests and reviewed baselines only', () => {
  assert.deepEqual(classifyDocsAndTests(docsChanges), { docsAndTestsEligible: true, reasons: [] });
  for (const path of ['docs/shots/design.png', 'docs/figures/lolly-demo-parts.html', 'docs/i18n/fr/install.md', 'docs/build.ts',
    'docs/navigation.ts', 'tests/fixtures/url/a.json', 'engine/src/units.test.ts', 'security/lint-baseline.json',
    'engine/README.md', 'shells/web/src/README.md',
    'scripts/vernacular-docs-baseline.json']) {
    assert.equal(classifyDocsAndTests([change(path)]).docsAndTestsEligible, true, path);
  }
  for (const path of ['engine/src/units.ts', 'shells/web/src/views/x.ts', 'shells/web/public/info/docs.abc.js',
    'README.md', 'package.json', 'docs/package.json', 'tests/fixtures/pkg/pnpm-lock.yaml', '.github/workflows/ci.yml',
    'scripts/ci-qualification.ts', 'security/dependency-roots.json', 'tests/expected-skips.json', 'tests/design-gpu.test.ts',
    'tests/foo.browser.test.ts', 'tests/c2pa-formats.test.ts', 'tests/fuzz-regression.test.ts', 'tests/tauri-security.test.ts',
    'tests/native-file-associations.test.ts', 'tests/browser-gpu.ts', 'shells/web/src/bridge/svg-walker.test.ts',
    'shells/web/README.md', 'engine/CHANGELOG.md', 'shells/web/src/views/README.md']) {
    assert.equal(classifyDocsAndTests([...docsChanges, change(path)]).docsAndTestsEligible, false, path);
  }
  assert.equal(classifyDocsAndTests([]).docsAndTestsEligible, false);
  for (const value of [change('docs/x.md', '100644', '120000'), change('docs/x.md', '100644', '100755'), change('docs/../x.md'),
    change('docs/x\ny.md'), change('docs\\x.md'), change('docs//x.md')]) {
    assert.equal(classifyDocsAndTests([value]).docsAndTestsEligible, false);
  }
  const reader = (text: string | null) => () => text;
  assert.equal(classifyDocsAndTests(docsChanges, reader('import test from "node:test";')).docsAndTestsEligible, true);
  assert.equal(classifyDocsAndTests(docsChanges, reader(`launches ${'Chromium not' + ' installed'}`)).docsAndTestsEligible, false);
  assert.equal(classifyDocsAndTests(docsChanges, reader(null)).docsAndTestsEligible, false, 'an unreadable test keeps the heavy tier');
});

test('dependency changes are found by manifest, lockfile, resolver settings and audit policy', () => {
  for (const path of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'shells/tauri-desktop/pnpm-lock.yaml',
    'shells/tauri-mobile/src-tauri/Cargo.lock', 'packages/node-shell/wasm/skera/Cargo.toml', '.npmrc', '.cargo/config.toml',
    'security/dependency-roots.json', 'scripts/audit-all.ts', 'docs/x\ny.md']) {
    assert.equal(touchesDependencies([change('docs/using.md'), change(path)]), true, path);
  }
  assert.equal(touchesDependencies(docsChanges), false);
  assert.equal(touchesDependencies([change('engine/src/runtime.ts'), change('scripts/audit-report.ts')]), false);
});

test('the tier follows the trusted lane, and only a pull request can use the docs-and-tests tier', () => {
  assert.equal(selectTier(scope(), id), 'public-ready');
  assert.equal(selectTier(scope(false), id), 'release-ready');
  assert.equal(selectTier(docsScope(), pr), 'docs-and-tests');
  assert.equal(selectTier(docsScope(id), id), 'release-ready', 'a main push in the docs lane still qualifies the full suite');
  assert.deepEqual([...DOCS_AND_TESTS_JOBS].sort(), RELEASE_JOBS.filter(name => !(HEAVY_JOBS as readonly string[]).includes(name)).sort());
  assert.ok(DOCS_AND_TESTS_JOBS.includes('npm audit (high+critical)') && DOCS_AND_TESTS_JOBS.includes('test (unit:engine)'));
  for (const name of PUBLIC_JOBS) assert.ok(DOCS_AND_TESTS_JOBS.includes(name), name);
});

test('a docs-and-tests pull request qualifies without the heavy tier and refuses every other gap', () => {
  const result = assessJobs(prRun(), page(docsJobs()), pr, docsScope(), 'docs-and-tests', true);
  assert.equal(result.ready, true); assert.deepEqual(result.required, [...DOCS_AND_TESTS_JOBS]);
  assert.throws(() => assessJobs(prRun(), page(docsJobs()), pr, docsScope(pr, 'full'), 'docs-and-tests', true), /docs-and-tests pull request/);
  assert.throws(() => assessJobs(prRun(), page(docsJobs()), pr, docsScope(pr, 'full'), 'release-ready', true), /Unreviewed skipped/);
  for (const name of ['npm audit (high+critical)', 'test (unit:web)', 'typecheck', 'opengrep (custom rules + new findings)']) {
    const missing = docsJobs().filter(value => value.name !== name);
    assert.equal(assessJobs(prRun(), page(missing), pr, docsScope(), 'docs-and-tests', true).ready, false, name);
    const failed = docsJobs().map(value => value.name === name ? { ...value, conclusion: 'failure' } : value);
    assert.throws(() => assessJobs(prRun(), page(failed), pr, docsScope(), 'docs-and-tests', true), /did not succeed|failed/);
  }
  for (const name of ['test (security)', 'api bundle drift']) {
    const skipped = docsJobs().map(value => value.name === name ? { ...value, conclusion: 'skipped' } : value);
    assert.throws(() => assessJobs(prRun(), page(skipped), pr, docsScope(), 'docs-and-tests', true), /Unreviewed skipped/, name);
  }
  const heavyRan = [...docsJobs(), prJob('test (tauri)', 94, 'completed', 'failure')];
  assert.throws(() => assessJobs(prRun(), page(heavyRan), pr, docsScope(), 'docs-and-tests', true), /did not succeed|failed/);
  const pushJobs = docsJobs().map(value => ({ ...value, head_branch: id.headBranch }));
  assert.throws(() => assessJobs({ ...run() }, page(pushJobs), id, docsScope(id), 'release-ready', true), /Unreviewed skipped/);
  assert.throws(() => assessJobs({ ...run() }, page(pushJobs), id, docsScope(id), 'docs-and-tests', true), /docs-and-tests pull request/);
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
