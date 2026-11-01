// SPDX-License-Identifier: MPL-2.0
// scripts/ci-local.ts mirrors the CI workflows by hand. These tests fail when the two drift.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { LANES, REPO, matchesGlob, runLane, selectLanes, changesFromRaw, parseArgs, type Lane, type Selection } from '../scripts/ci-local.ts';

interface Job { name?: string; steps?: { run?: string; env?: Record<string, string> }[]; strategy?: { matrix?: { include?: { shard?: string; partition?: string }[] } } }
const workflow = (file: string) => parse(readFileSync(join(REPO, '.github/workflows', file), 'utf8')) as { on: Record<string, { paths?: string[] }>; jobs: Record<string, Job> };
const squash = (text: string) => text.replace(/\\\n/g, ' ').replace(/\s+/g, ' ').trim();
const runText = (job: Job) => squash((job.steps ?? []).map(step => step.run ?? '').join('\n'));
const ci = workflow('ci.yml');
const fast = workflow('fast-lanes.yml');

test('every job in ci.yml and fast-lanes.yml has a lane, in workflow order', () => {
  for (const [file, wf] of [['ci.yml', ci], ['fast-lanes.yml', fast]] as const) {
    const expected = Object.keys(wf.jobs);
    const actual = [...new Set(LANES.filter(lane => lane.workflow === file).map(lane => lane.job))];
    assert.deepEqual(actual, expected, `${file}: lane jobs must match the workflow's jobs, in order`);
  }
});

test('the test shards and browser partitions match the workflow', () => {
  const fastShards = ci.jobs['test-fast']!.strategy!.matrix!.include!.map(entry => entry.shard);
  assert.deepEqual(LANES.filter(l => l.job === 'test-fast').map(l => l.id.replace('test:', '')), fastShards);
  const scope = ci.jobs['deployment-scope']!.steps!.find(step => step.env?.LIGHT_SHARDS)!.env!;
  const shards = [...JSON.parse(scope.LIGHT_SHARDS!), ...JSON.parse(scope.HEAVY_SHARDS!)] as { shard: string; partition?: string }[];
  const names = [...new Set(shards.map(entry => entry.shard))];
  assert.deepEqual(LANES.filter(l => l.job === 'test').map(l => l.id.replace('test:', '')), names);
  const partitions = shards.filter(entry => entry.partition).map(entry => entry.partition);
  const browser = LANES.find(l => l.id === 'test:browser')!;
  const local = browser.steps.map(step => /--partition=(\d+\/\d+)/.exec(step.cmd)?.[1]).filter(Boolean);
  assert.deepEqual(local, partitions);
});

test('each runnable step copies a command the workflow really runs', () => {
  for (const lane of LANES) {
    if (lane.skip) { assert.deepEqual(lane.steps, [], `${lane.id} is skipped, so it lists no steps`); continue; }
    const job = (lane.workflow === 'ci.yml' ? ci : fast).jobs[lane.job]!;
    const text = runText(job);
    for (const step of lane.steps) {
      // A step may chain commands; the workflow runs each.
      const wanted = squash(step.ci ?? step.cmd);
      assert.ok(text.includes(wanted), `${lane.id}: "${wanted}" is not in ${lane.workflow} job ${lane.job}`);
    }
  }
});

test('every skipped lane says why', () => {
  const skipped = LANES.filter(l => l.skip);
  assert.ok(skipped.length >= 7);
  for (const lane of skipped) assert.ok(lane.skip!.length > 20, lane.id);
});

test('the fast-lane path filters equal the workflow trigger', () => {
  const expected = fast.on.pull_request!.paths!;
  for (const lane of LANES.filter(l => l.workflow === 'fast-lanes.yml')) assert.deepEqual(lane.paths, expected, lane.id);
});

test('--changed picks lanes by path and leaves the heavy tier out for docs and tests changes', () => {
  const docs = changesFromRaw(':100644 100644 a b M\0docs/glossary.md\0');
  const picked = (changes: ReturnType<typeof changesFromRaw>) => selectLanes(LANES, changes).filter(s => s.selected && !s.lane.skip).map(s => s.lane.id);
  const forDocs = picked(docs);
  assert.ok(forDocs.includes('docs') && forDocs.includes('typecheck'));
  assert.ok(!forDocs.includes('test:browser') && !forDocs.includes('api-bundles') && !forDocs.includes('audit'));
  const code = picked(changesFromRaw(':100644 100644 a b M\0engine/src/runtime.ts\0'));
  assert.ok(code.includes('test:browser') && !code.includes('docs'));
  assert.ok(matchesGlob('shells/web/src/a.ts', 'shells/web/**') && !matchesGlob('docs/a.md', 'shells/web/**'));
});

test('--list ids and unknown arguments are validated', () => {
  assert.throws(() => parseArgs(['--only=nope']), /Unknown lane/);
  assert.throws(() => parseArgs(['--wat']), /Unknown argument/);
  assert.equal(parseArgs(['--changed', '--list']).list, true);
});

test('a missing browser or WebGPU adapter is reported as not run, never as passed', () => {
  const lane = LANES.find(l => l.id === 'test:browser') as Lane;
  const selection: Selection = { lane, selected: true, why: 'test' };
  const ran: string[] = [] as string[];
  const exec = (step: { cmd: string }) => { ran.push(step.cmd); return { status: 0 }; };
  const noBrowser = runLane(lane, selection, () => 'missing', exec);
  assert.equal(noBrowser.status, 'not run');
  assert.equal(ran.length, 0);
  // Chromium present but the WebGPU conformance step fails: the rest of the lane stays not run.
  ran.length = 0;
  const failing = runLane(lane, selection, requirement => (requirement === 'webgpu' ? 'no adapter' : null),
    (step) => { ran.push(step.cmd); return { status: step.cmd === 'pnpm run test:webgpu' ? 1 : 0 }; });
  assert.notEqual(failing.status, 'passed');
  assert.ok(failing.steps.some(s => s.status === 'not run'));
});

test('a lane passes only when every step ran and passed', () => {
  const lane = LANES.find(l => l.id === 'smoke') as Lane;
  const selection: Selection = { lane, selected: true, why: 'test' };
  assert.equal(runLane(lane, selection, () => null, () => ({ status: 0 })).status, 'passed');
  assert.equal(runLane(lane, selection, () => null, () => ({ status: 1 })).status, 'failed');
  assert.equal(runLane(lane, { ...selection, selected: false }, () => null, () => ({ status: 0 })).status, 'unselected');
});
