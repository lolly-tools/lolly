// SPDX-License-Identifier: MPL-2.0
/** The preview's fast deploy lanes: scripts/deploy-lane.ts, its fixtures, and fast-lanes.yml. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import {
  CI_WORKFLOW, DEPENDENCY_FILE, DOCS_CARD_CODE, DOCS_PAGES_ELSEWHERE, DOCS_POLICY_FILES, FAST_WORKFLOW, LANE_JOB, LANE_POLICY, laneOf,
  PROTECTED_NAME, qualify, WEB_EXCLUDED, type Change, type Provider,
} from '../scripts/deploy-lane.ts';
import { docsTests, parsePart, webUnitTests } from '../scripts/fast-lane-tests.ts';
import { classifyTest, discoverTests } from '../scripts/run-test-suite.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const CASES = 'tests/fixtures/deploy-lane/cases.json';
/**
 * The Python port in lolly-work (tests/test_preview_lane.py) pins the same digest of its copy of the cases.
 * A change to the rules changes the cases, this digest and that copy together.
 */
const CASES_SHA256 = 'c056c68f20f3eea3c78a7aadd5d413efd8406fe1ab9691aeed3870b58e44429f';

interface Case { name: string; lane: string; changes: [string, string, string][] }
const fixture = JSON.parse(read(CASES)) as { version: number; policy: string; cases: Case[] };
const changesOf = (rows: [string, string, string][]): Change[] => rows.map(([path, beforeMode, afterMode]) => ({ path, beforeMode, afterMode }));

test('the shared lane cases are the pinned copy and carry the current policy', () => {
  assert.equal(createHash('sha256').update(readFileSync(join(root, CASES))).digest('hex'), CASES_SHA256);
  assert.equal(fixture.version, 1);
  assert.equal(fixture.policy, LANE_POLICY);
  assert.equal(new Set(fixture.cases.map(c => c.name)).size, fixture.cases.length);
  for (const lane of ['docs', 'web', 'full']) assert.ok(fixture.cases.some(c => c.lane === lane), lane);
});

for (const item of fixture.cases) {
  test(`lane case: ${item.name}`, () => {
    const decision = laneOf(changesOf(item.changes));
    assert.equal(decision.lane, item.lane, decision.reasons.join('\n'));
    assert.equal(decision.reasons.length > 0, item.lane === 'full');
  });
}

test('every full decision says which path needs the full suite and why', () => {
  const decision = laneOf(changesOf([['docs/using.md', '100644', '100644'], ['shells/web/src/main.ts', '100644', '100644'],
    ['engine/src/runtime.ts', '100644', '100644']]));
  assert.equal(decision.lane, 'full');
  assert.equal(decision.reasons.length, 2);
  assert.match(decision.reasons[0]!, /^Full CI required: shells\/web\/src\/main\.ts \(boot path/);
  assert.match(decision.reasons[1]!, /^Full CI required: engine\/src\/runtime\.ts \(outside docs\/ and shells\/web\/\)/);
});

test('the dependency list and the protected names start from the CI qualification policy', () => {
  const policy = read('scripts/ci-qualification.ts');
  const dependency = /const DEPENDENCY_FILE = (\/.+\/);\n/.exec(policy)?.[1];
  assert.equal(dependency, String(DEPENDENCY_FILE));
  const words = /const protectedName = \/\(\?:\^\|\[\/_\.-\]\)\(\?:([a-z|]+)\)/.exec(policy)?.[1]?.split('|');
  assert.ok(words && words.length > 20);
  for (const word of words) assert.match(`shells/web/src/views/${word}.ts`, PROTECTED_NAME, word);
});

test('the pages docs/build.ts renders from outside docs/ are exactly the docs-lane pages kept there', () => {
  const sources = [...read('docs/build.ts').matchAll(/src: '\.\.\/([^']+)'/g)].map(match => match[1]).sort();
  assert.deepEqual(sources, [...DOCS_PAGES_ELSEWHERE].sort());
});

test('the docs code that needs the web lane is exactly what the card scripts of build:web import from docs/', () => {
  const docsImports = (file: string): string[] => [...read(file).matchAll(/^import [^;]* from '(\.{1,2}\/[^']+)';$/gm)]
    .map(match => join(dirname(file), match[1]!)).filter(path => path.startsWith('docs/'));
  const seen = new Set<string>();
  const queue = ['scripts/build-tool-og.ts', 'scripts/build-view-og.ts', 'scripts/build-og-base.ts'].flatMap(docsImports);
  while (queue.length) {
    const file = queue.shift()!;
    if (seen.has(file)) continue;
    seen.add(file); queue.push(...docsImports(file));
  }
  assert.deepEqual([...seen].sort(), [...DOCS_CARD_CODE].sort());
  assert.match(read('package.json'), /"build:web": "[^"]*node scripts\/build-tool-og\.ts && node scripts\/build-view-og\.ts/);
});

test('every exclusion and policy file names something that exists in the tree', () => {
  const tracked = execFileSync('git', ['ls-files', 'shells/web', 'docs'], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).split('\n');
  for (const { prefix } of WEB_EXCLUDED) assert.ok(tracked.some(path => path.startsWith(prefix)), prefix);
  for (const path of DOCS_POLICY_FILES) assert.ok(tracked.includes(path), path);
  // The stored formats the preview deploy tool reads before a rollback (lolly-work preview_anchors.py).
  for (const path of ['shells/web/src/bridge/db.ts', 'shells/web/src/bridge/revision-archive-format.ts', 'shells/web/src/collab/join-route.ts']) {
    assert.ok(tracked.includes(path), path);
    assert.equal(laneOf([{ path, beforeMode: '100644', afterMode: '100644' }]).lane, 'full', path);
  }
});

test('the lane script imports Node built-ins only, because the guard runs a copy outside the checkout', () => {
  const imports = [...read('scripts/deploy-lane.ts').matchAll(/^import [^;]* from '([^']+)';$/gm)].map(match => match[1]!);
  assert.ok(imports.length > 0);
  for (const name of imports) assert.match(name, /^node:/);
});

test('fast-lanes.yml runs on main pushes for every docs-lane path and exposes the two lane jobs by name', () => {
  const workflow = parse(read(FAST_WORKFLOW)) as any;
  assert.deepEqual(workflow.on.push.branches, ['main']);
  for (const path of ['docs/**', 'shells/web/**', ...DOCS_PAGES_ELSEWHERE]) assert.ok(workflow.on.push.paths.includes(path), path);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  const named = Object.entries<any>(workflow.jobs).filter(([, job]) => Object.values(LANE_JOB).includes(job.name));
  assert.deepEqual(named.map(([id, job]) => [id, job.name]).sort(), [['docs', LANE_JOB.docs], ['web', LANE_JOB.web]]);
  const web = workflow.jobs.web;
  assert.deepEqual([...web.needs].sort(), Object.keys(workflow.jobs).filter(id => id !== 'web').sort(), 'the web lane needs every other job');
  assert.match(web.if, /always\(\) && !cancelled\(\)/);
  assert.match(web.steps.at(-1).run, /all\(\.\[\]; \.result == "success"\)/);
  assert.match(web.steps.at(-1).run, /length == 4/);
  assert.equal(web.needs.length, 4);
  // A main push never cancels another: every commit keeps a result of its own.
  assert.match(workflow.concurrency['cancel-in-progress'], /pull_request/);
  assert.match(workflow.concurrency.group, /github\.sha/);
  for (const [id, job] of Object.entries<any>(workflow.jobs)) {
    assert.ok(Number(job['timeout-minutes']) > 0, `${id} has a time limit`);
    assert.equal(job.environment, undefined, `${id} uses no environment`);
    assert.doesNotMatch(JSON.stringify(job), /secrets\./, `${id} reads no secret`);
  }
});

test('the docs selection runs the docs tests, and the web parts split the unit:web shard exactly', () => {
  const docs = docsTests(root);
  for (const file of ['tests/docs-vernacular.test.ts', 'tests/docs-vernacular-ratchet.test.ts', 'tests/docs-nav.test.ts',
    'packages/docs-render/test/render.test.ts', 'shells/web/src/lib/editor-state.test.ts']) assert.ok(docs.includes(file), file);
  for (const file of docs) assert.ok(!['browser', 'tauri', 'conformance', 'fuzz:regression'].includes(classifyTest(file, root)), file);
  const shard = discoverTests(root).filter(file => classifyTest(file, root) === 'unit:web');
  const one = webUnitTests(parsePart('1/2'), root), two = webUnitTests(parsePart('2/2'), root);
  assert.deepEqual([...one, ...two].sort(), [...shard].sort());
  assert.equal(one.filter(file => two.includes(file)).length, 0);
  assert.ok(Math.abs(one.length - two.length) <= 1);
  for (const bad of ['0/2', '3/2', '1/9', 'all', undefined]) assert.throws(() => parsePart(bad), String(bad));
});

// qualify() against a real Git history and a provider that answers like GitHub.
const REPO = 'example/lolly';
function history(t: { after(fn: () => void): void }) {
  const directory = mkdtempSync(join(tmpdir(), 'lolly-deploy-lane-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const git = (...args: string[]) => execFileSync('git', args, { cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-q', '-b', 'main'); git('config', 'user.name', 'CI fixture'); git('config', 'user.email', 'ci@example.invalid');
  const commit = (files: Record<string, string>, message: string) => {
    for (const [path, text] of Object.entries(files)) { mkdirSync(dirname(join(directory, path)), { recursive: true }); writeFileSync(join(directory, path), text); }
    git('add', '.'); git('-c', 'core.hooksPath=/dev/null', 'commit', '-qm', message);
    return git('rev-parse', 'HEAD');
  };
  const base = commit({ 'docs/using.md': '# Using\n', 'shells/web/src/styles/a.css': 'a{}\n', 'engine/src/x.ts': 'export {};\n' }, 'base');
  return { directory, git, commit, base };
}

interface Run { id: number; path: string; event: string; head_branch: string; head_sha: string; status: string; conclusion: string | null; repository: { full_name: string }; head_repository: { full_name: string } }
const runOf = (id: number, sha: string, path: string, status = 'completed', conclusion: string | null = 'success', extra: Partial<Run> = {}): Run =>
  ({ id, path, event: 'push', head_branch: 'main', head_sha: sha, status, conclusion, repository: { full_name: REPO }, head_repository: { full_name: REPO }, ...extra });

function provider(runs: Run[], jobs: Record<number, { name: string; status: string; conclusion: string | null; head_sha?: string; run_id?: number }[]>): Provider & { calls: string[] } {
  const calls: string[] = [];
  const answer = async (path: string): Promise<unknown> => {
    calls.push(path);
    const listing = /^\/repos\/example\/lolly\/actions\/workflows\/([a-z-]+\.yml)\/runs\?head_sha=([a-f0-9]{40})&event=push&branch=main&per_page=20$/.exec(path);
    if (listing) return { workflow_runs: runs.filter(run => run.path === `.github/workflows/${listing[1]}` && run.head_sha === listing[2]) };
    const jobList = /^\/repos\/example\/lolly\/actions\/runs\/(\d+)\/jobs\?filter=latest&per_page=100$/.exec(path);
    if (jobList) {
      const run = runs.find(item => item.id === Number(jobList[1]))!;
      return { jobs: (jobs[run.id] ?? []).map((job, index) => ({ id: run.id * 10 + index, run_id: run.id, head_sha: run.head_sha, run_attempt: 1, ...job })) };
    }
    throw new Error(`unexpected read ${path}`);
  };
  return Object.assign(answer, { calls });
}

test('a docs change qualifies once its docs lane job passed, and records what it compared', async t => {
  const { directory, commit, base } = history(t);
  const source = commit({ 'docs/using.md': '# Using Lolly\n', 'tests/docs-using.test.ts': 'export {};\n' }, 'docs');
  const fast = runOf(70, source, FAST_WORKFLOW);
  const record = await qualify(base, source, REPO, provider([runOf(60, source, CI_WORKFLOW, 'in_progress', null), fast],
    { 70: [{ name: 'docs lane', status: 'completed', conclusion: 'success' }, { name: 'web lane', status: 'in_progress', conclusion: null }] }), directory);
  assert.equal(record.lane, 'docs');
  assert.equal(record.base, base);
  assert.equal(record.distance, 1);
  assert.equal(record.changes, 2);
  assert.equal(record.policy, LANE_POLICY);
  assert.deepEqual(record.fastJob, { run: 70, attempt: 1, job: 700, name: 'docs lane' });
  assert.deepEqual(record.sourceFullCi, [{ id: 60, status: 'in_progress', conclusion: null }]);
});

test('a web change needs the web lane job, not the docs lane job alone', async t => {
  const { directory, commit, base } = history(t);
  const source = commit({ 'shells/web/src/styles/a.css': 'a{color:red}\n' }, 'css');
  const runs = [runOf(70, source, FAST_WORKFLOW)];
  await assert.rejects(qualify(base, source, REPO, provider(runs, { 70: [{ name: 'docs lane', status: 'completed', conclusion: 'success' },
    { name: 'web lane', status: 'in_progress', conclusion: null }] }), directory), /"web lane" job of .* has not passed/);
  const record = await qualify(base, source, REPO, provider(runs, { 70: [{ name: 'docs lane', status: 'completed', conclusion: 'success' },
    { name: 'web lane', status: 'completed', conclusion: 'success' }] }), directory);
  assert.equal(record.lane, 'web');
});

test('a lane is refused for a broad change, a failed full run, a job from elsewhere, or a base off the first-parent line', async t => {
  const { directory, git, commit, base } = history(t);
  const passed = { 70: [{ name: 'docs lane', status: 'completed', conclusion: 'success' }, { name: 'web lane', status: 'completed', conclusion: 'success' }] };
  const broad = commit({ 'docs/using.md': '# Using it\n', 'engine/src/x.ts': 'export const x = 1;\n' }, 'broad');
  await assert.rejects(qualify(base, broad, REPO, provider([runOf(70, broad, FAST_WORKFLOW)], passed), directory),
    /needs its own full CI run:\n {2}Full CI required: engine\/src\/x\.ts/);
  git('reset', '-q', '--hard', base);
  const docs = commit({ 'docs/using.md': '# Using Lolly\n' }, 'docs');
  for (const conclusion of ['failure', 'timed_out', 'startup_failure']) {
    await assert.rejects(qualify(base, docs, REPO, provider([runOf(60, docs, CI_WORKFLOW, 'completed', conclusion), runOf(70, docs, FAST_WORKFLOW)], passed), directory),
      /a lane never overrides that/, conclusion);
  }
  // A cancelled full run (a newer push replaced it while queued) is no verdict.
  assert.equal((await qualify(base, docs, REPO, provider([runOf(60, docs, CI_WORKFLOW, 'completed', 'cancelled'), runOf(70, docs, FAST_WORKFLOW)], passed), directory)).lane, 'docs');
  // Lane jobs from a pull request, another branch, another repository or another workflow never count.
  for (const extra of [{ event: 'pull_request' }, { head_branch: 'feature' }, { repository: { full_name: 'fork/lolly' } },
    { head_repository: { full_name: 'fork/lolly' } }, { path: '.github/workflows/other.yml' }]) {
    await assert.rejects(qualify(base, docs, REPO, provider([runOf(70, docs, FAST_WORKFLOW, 'completed', 'success', extra)], passed), directory), /has not passed/,
      JSON.stringify(extra));
  }
  // A failed or unfinished lane job, or a job reported for another commit, never counts.
  for (const job of [{ status: 'completed', conclusion: 'failure' }, { status: 'in_progress', conclusion: null },
    { status: 'completed', conclusion: 'success', head_sha: base }, { status: 'completed', conclusion: 'success', run_id: 71 }]) {
    await assert.rejects(qualify(base, docs, REPO, provider([runOf(70, docs, FAST_WORKFLOW)], { 70: [{ name: 'docs lane', ...job }] }), directory), /has not passed/);
  }
  // The base must be a first-parent ancestor: not the source itself, not a later commit, not a side branch.
  await assert.rejects(qualify(docs, docs, REPO, provider([], passed), directory), /differs from the source/);
  await assert.rejects(qualify(docs, base, REPO, provider([], passed), directory), /first-parent/);
  git('checkout', '-q', '-b', 'side', base);
  const side = commit({ 'docs/side.md': '# Side\n' }, 'side');
  git('checkout', '-q', 'main');
  git('-c', 'core.hooksPath=/dev/null', 'merge', '-q', '--no-ff', '-m', 'merge side', 'side');
  const merged = git('rev-parse', 'HEAD');
  await assert.rejects(qualify(side, merged, REPO, provider([runOf(70, merged, FAST_WORKFLOW)], passed), directory), /first-parent/);
  assert.equal((await qualify(docs, merged, REPO, provider([runOf(70, merged, FAST_WORKFLOW)], passed), directory)).lane, 'docs');
});
