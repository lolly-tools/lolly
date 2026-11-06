// SPDX-License-Identifier: MPL-2.0
/**
 * Refresh the browser timing profile (scripts/data/browser-test-durations.json) from
 * green CI runs on main.
 *
 * Each browser runner uploads browser-coverage.json with the measured duration of every
 * file it ran, and the jobs API gives the time of the conformance steps that only
 * runners 1 to 3 take on. The profile keeps the median of each over the chosen runs, so
 * one slow runner does not move a file. Files measured in none of the runs keep the
 * default weight. Without --write the script only prints the planned load of each
 * runner under the current profile and under the refreshed one.
 *
 *   node scripts/refresh-browser-durations.ts [--latest=10] [--runs=<id>,<id>] [--write]
 *
 * Needs the GitHub CLI, signed in with read access to the repository's Actions.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type BrowserPartitionReport,
  type BrowserTiming,
  BROWSER_PARTITION_COUNT,
  browserPartitionFiles,
} from './browser-partitions.ts';
import { REPO, shardInventory } from './run-test-suite.ts';

const PROFILE = path.join(REPO, 'scripts/data/browser-test-durations.json');

/** The CI steps one runner takes on besides its files (ci.yml), by partition index. */
export const DUTY_STEPS: Readonly<Record<string, readonly string[]>> = {
  1: ['Require geometry conformance'],
  2: [
    'Cache Firefox and WebKit (browser 2/8)',
    'Install Firefox and WebKit for geometry qualification',
    'Require one geometry answer in Chromium, Firefox and WebKit',
  ],
  3: ['Require drawing fidelity against the Design renderer'],
};

export interface RunSource { runId: number; runAttempt: number; source: string }
export interface RunTimings extends RunSource {
  /** Every file's measured duration in this run. */
  durationMs: Record<string, number>;
  /** The duty steps' measured time in this run, by partition index. */
  partitionDutyMs: Record<string, number>;
}
export interface TimingProfile extends BrowserTiming {
  schemaVersion: 1;
  defaultDurationMs: number;
  sources: RunSource[];
}

export function median(values: readonly number[]): number {
  if (!values.length) throw new Error('median of no values');
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/**
 * The median duration of each file and each duty over the runs. Only files in
 * `inventory` are kept, so a deleted or renamed file leaves the profile.
 */
export function timingProfile(runs: readonly RunTimings[], inventory: readonly string[], defaultDurationMs: number): TimingProfile {
  if (!runs.length) throw new Error('no runs to measure');
  const files = new Map<string, number[]>();
  const duties = new Map<string, number[]>();
  for (const run of runs) {
    for (const [file, value] of Object.entries(run.durationMs)) files.set(file, [...(files.get(file) ?? []), value]);
    for (const [index, value] of Object.entries(run.partitionDutyMs)) duties.set(index, [...(duties.get(index) ?? []), value]);
  }
  const listed = new Set(inventory);
  const durationMs = Object.fromEntries([...files].filter(([file]) => listed.has(file)).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([file, values]) => [file, Math.max(1, Math.round(median(values)))]));
  // Step times come from the jobs API in whole seconds.
  const partitionDutyMs = Object.fromEntries([...duties].sort(([a], [b]) => Number(a) - Number(b))
    .map(([index, values]) => [index, Math.max(1000, Math.round(median(values) / 1000) * 1000)]));
  return {
    schemaVersion: 1,
    defaultDurationMs,
    sources: runs.map(({ runId, runAttempt, source }) => ({ runId, runAttempt, source })).sort((a, b) => a.runId - b.runId),
    partitionDutyMs,
    durationMs,
  };
}

/** Each runner's planned load: the files `plan` gives it, weighed by `measured`, plus its duty. */
export function plannedLoads(inventory: readonly string[], plan: BrowserTiming, measured: BrowserTiming, defaultDurationMs: number): number[] {
  return Array.from({ length: BROWSER_PARTITION_COUNT }, (_, offset) => {
    const index = offset + 1;
    const files = browserPartitionFiles(inventory, { index, count: BROWSER_PARTITION_COUNT }, plan);
    return files.reduce((sum, file) => sum + (measured.durationMs[file] ?? defaultDurationMs), 0)
      + (measured.partitionDutyMs[String(index)] ?? 0);
  });
}

const gh = (args: string[]): string => execFileSync('gh', args, { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

function coverageReports(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) return coverageReports(filename);
    return entry.isFile() && entry.name === 'browser-coverage.json' ? [filename] : [];
  });
}

interface Step { name: string; conclusion: string | null; started_at: string | null; completed_at: string | null }
interface Job { name: string; conclusion: string | null; steps?: Step[] }

/** One run's timings, or the reason the run cannot be used. */
function readRun(source: RunSource, scratch: string): RunTimings | string {
  const directory = path.join(scratch, String(source.runId));
  try {
    gh(['run', 'download', String(source.runId), '--pattern', 'test-skips-browser-*', '--dir', directory]);
  } catch {
    return 'no browser artifacts';
  }
  const reports = coverageReports(directory).map((file) => JSON.parse(readFileSync(file, 'utf8')) as BrowserPartitionReport);
  const indexes = reports.map((report) => report.partition?.index).sort((a, b) => a - b);
  if (indexes.join() !== Array.from({ length: BROWSER_PARTITION_COUNT }, (_, offset) => offset + 1).join()) {
    return `${reports.length} of ${BROWSER_PARTITION_COUNT} browser reports`;
  }
  if (reports.some((report) => report.source !== source.source)) return 'a report from another commit';
  const durationMs: Record<string, number> = {};
  for (const report of reports) {
    for (const summary of report.summaries) {
      if (!summary.success || !Number.isFinite(summary.durationMs)) return `${summary.file} did not pass`;
      durationMs[summary.file] = summary.durationMs;
    }
  }
  const jobs = (JSON.parse(gh(['api', `repos/{owner}/{repo}/actions/runs/${source.runId}/attempts/${source.runAttempt}/jobs?per_page=100`])) as { jobs: Job[] }).jobs;
  const partitionDutyMs: Record<string, number> = {};
  for (const [index, names] of Object.entries(DUTY_STEPS)) {
    const job = jobs.find((candidate) => candidate.name === `test (browser ${index}/${BROWSER_PARTITION_COUNT})`);
    if (job?.conclusion !== 'success') return `browser job ${index} did not pass`;
    let total = 0;
    for (const name of names) {
      const step = job.steps?.find((candidate) => candidate.name === name);
      if (!step?.started_at || !step.completed_at || step.conclusion !== 'success') return `step "${name}" missing or not passed`;
      total += Date.parse(step.completed_at) - Date.parse(step.started_at);
    }
    partitionDutyMs[index] = total;
  }
  return { ...source, durationMs, partitionDutyMs };
}

/** The latest successful pushes to main, newest first. */
function latestRuns(limit: number): RunSource[] {
  const listed = JSON.parse(gh(['run', 'list', '--workflow=ci.yml', '--branch=main', '--event=push', '--status=success',
    `--limit=${limit}`, '--json=databaseId,attempt,headSha'])) as { databaseId: number; attempt: number; headSha: string }[];
  return listed.map((run) => ({ runId: run.databaseId, runAttempt: run.attempt, source: run.headSha }));
}

const minutes = (ms: number): string => (ms / 60_000).toFixed(1);

export function main(argv = process.argv.slice(2)): number {
  const value = (name: string): string | undefined => argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const want = Number(value('latest') ?? 10);
  if (!Number.isSafeInteger(want) || want < 1) throw new Error('--latest must be a positive whole number');
  const requested = value('runs')?.split(',').filter(Boolean).map(Number);
  const current = JSON.parse(readFileSync(PROFILE, 'utf8')) as TimingProfile;
  const inventory = shardInventory().browser;
  // Runs listed by id are read from their latest attempt; the listing below supplies attempt and commit.
  const candidates = requested?.length
    ? requested.map((runId) => {
      const run = JSON.parse(gh(['run', 'view', String(runId), '--json=databaseId,attempt,headSha'])) as { databaseId: number; attempt: number; headSha: string };
      return { runId: run.databaseId, runAttempt: run.attempt, source: run.headSha };
    })
    : latestRuns(want * 3);
  const scratch = mkdtempSync(path.join(tmpdir(), 'lolly-browser-durations-'));
  const runs: RunTimings[] = [];
  try {
    for (const candidate of candidates) {
      if (runs.length >= (requested?.length || want)) break;
      const run = readRun(candidate, scratch);
      if (typeof run === 'string') console.log(`skip run ${candidate.runId} (${candidate.source.slice(0, 9)}): ${run}`);
      else { runs.push(run); console.log(`read run ${run.runId} (${run.source.slice(0, 9)}): ${Object.keys(run.durationMs).length} files`); }
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  const refreshed = timingProfile(runs, inventory, current.defaultDurationMs);
  const unmeasured = inventory.filter((file) => !Object.hasOwn(current.durationMs, file));
  console.log(`\n${inventory.length} browser files; ${unmeasured.length} had no entry in the current profile and counted ${current.defaultDurationMs / 1000} s each.`);
  console.log(`Duty steps: ${Object.entries(refreshed.partitionDutyMs).map(([index, ms]) => `runner ${index} ${ms / 1000} s`).join(', ')}.`);
  // Both plans are weighed by the refreshed medians, the best estimate of what each runner will take.
  const before = plannedLoads(inventory, current, refreshed, current.defaultDurationMs);
  const after = plannedLoads(inventory, refreshed, refreshed, current.defaultDurationMs);
  console.log('\nPlanned minutes per runner, files plus duty steps, weighed by the refreshed medians:');
  console.log(`  runner   ${before.map((_, offset) => String(offset + 1).padStart(5)).join('')}`);
  console.log(`  current  ${before.map((ms) => minutes(ms).padStart(5)).join('')}   range ${minutes(Math.min(...before))} to ${minutes(Math.max(...before))}`);
  console.log(`  refreshed${after.map((ms) => minutes(ms).padStart(5)).join('')}   range ${minutes(Math.min(...after))} to ${minutes(Math.max(...after))}`);
  if (argv.includes('--write')) {
    writeFileSync(PROFILE, `${JSON.stringify(refreshed, null, 2)}\n`);
    console.log(`\nWrote ${path.relative(REPO, PROFILE)} from ${runs.length} runs.`);
  } else console.log('\nRun again with --write to save the refreshed profile.');
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();
