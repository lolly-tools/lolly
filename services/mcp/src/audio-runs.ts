// SPDX-License-Identifier: MPL-2.0
/**
 * Rondocode songs on the MCP server (plan 301): the limits a song renders under,
 * and the record of what ran, carried from the host that rendered it to the tool
 * result that answers the agent.
 *
 * A song is code from someone else. It reaches this server as an audio input (a
 * rondocode share link, or a `.rondo.json` asset) and is rendered by node-shell's
 * `host.audio` in a Worker, its code in the `vm` execution class. The server is
 * public, so one request must not hold the process: `rondoCapsFor` gives a hosted
 * deployment `HOSTED_RONDO_CAPS` (30 s of audio, a 20 s wall clock, 20 s of song
 * rendering per request, one render at a time and a queue of two). Its CPU also
 * counts against the daily budget, because `process.cpuUsage()` covers the
 * Worker's thread (usage-budget.ts).
 *
 * The scope is per request: `withAudioScope` holds the caps, one shared time
 * budget and the list of runs, and `withHost` (host.ts) reads it for every host it
 * builds in that request, so a render pass and its emoji census share one budget.
 * Outside a scope a host gets the hosted caps, the safe default.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { rondoRecordedSentence } from '@lolly/engine';
import {
  HOSTED_RONDO_CAPS, LOCAL_RONDO_CAPS,
  type ComputedAudioFailure, type ComputedAudioRun, type RondoBudget, type RondoCaps,
} from '@lolly-tools/node-shell/audio';

export interface AudioScope {
  caps: RondoCaps;
  budget: RondoBudget;
  runs: ComputedAudioRun[];
  failures: ComputedAudioFailure[];
}

/** What one request's songs did: the renders, and the songs that did not render. */
export interface AudioOutcome {
  runs: ComputedAudioRun[];
  failures: ComputedAudioFailure[];
}

const scope = new AsyncLocalStorage<AudioScope>();

/** The scope of the request running now, if there is one. */
export function currentAudioScope(): AudioScope | undefined {
  return scope.getStore();
}

/** Caps for a host built outside any request scope. */
export const DEFAULT_SCOPE_CAPS: Readonly<RondoCaps> = HOSTED_RONDO_CAPS;

/**
 * Run `fn` as one request: every host it builds renders songs under `caps` with
 * one shared time budget, and the runs come back beside the value.
 */
export async function withAudioScope<T>(
  caps: RondoCaps | undefined, fn: () => Promise<T>,
): Promise<{ value: T } & AudioOutcome> {
  const store: AudioScope = { caps: caps ?? DEFAULT_SCOPE_CAPS, budget: { spentMs: 0 }, runs: [], failures: [] };
  const value = await scope.run(store, fn);
  return { value, runs: distinctRuns(store.runs), failures: distinctFailures(store.failures) };
}

/** One entry per song and code: a song refused twice in a request is one failure. */
export function distinctFailures(failures: readonly ComputedAudioFailure[]): ComputedAudioFailure[] {
  const seen = new Set<string>();
  return failures.filter((f) => {
    const key = `${f.name}\u0000${f.code}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * The song limits for this deployment. A hosted server gets the hosted caps; one
 * on the person's own machine gets the CLI's. `LOLLY_MCP_RONDO_MAX_SECONDS`
 * (1 to 600) changes only the longest song, the way LOLLY_MCP_MAX_RASTER_PIXELS
 * changes only the raster cap.
 */
export function rondoCapsFor(env: NodeJS.ProcessEnv, hosted: boolean): RondoCaps {
  const base: RondoCaps = { ...(hosted ? HOSTED_RONDO_CAPS : LOCAL_RONDO_CAPS) };
  const raw = env.LOLLY_MCP_RONDO_MAX_SECONDS?.trim();
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 1 && n <= LOCAL_RONDO_CAPS.maxSeconds) base.maxSeconds = n;
  }
  return base;
}

/** One entry per distinct render: a song analysed twice in a request is one run. */
export function distinctRuns(runs: readonly ComputedAudioRun[]): ComputedAudioRun[] {
  const seen = new Set<string>();
  const out: ComputedAudioRun[] = [];
  for (const run of runs) {
    if (seen.has(run.key)) continue;
    seen.add(run.key);
    out.push(run);
  }
  return out;
}

/**
 * What a request's songs did, as the text a tool result carries: what ran, in which
 * class, what was silent, and each song that did not render, by stable code.
 */
export function audioRunText(outcome: Partial<AudioOutcome>): string {
  const runs = outcome.runs ?? [];
  const failed = (outcome.failures ?? []).map((f) => `Audio: song "${f.name}" was not rendered: ${f.code} - ${f.message}`);
  const ran = runs.map((run) => {
    const seed = run.run.seed !== undefined ? `, seed ${run.run.seed}` : '';
    const head = `Audio: song "${run.name}" rendered ${run.seconds.toFixed(2)} s in the ${run.run.executionClass} execution class `
      + `(${run.run.source} ${run.run.version}${seed}).`;
    const lines = run.findings.map((f) => `  ${f.code} - ${f.message}`);
    return [head, ...(lines.length ? lines : ['  Every part played.'])].join('\n');
  });
  return [...ran, ...failed].join('\n');
}

/**
 * What the delivered file's Content Credentials say about the songs it holds
 * (plan 301), from a reading of the final bytes. A song the file holds and the
 * credential does not name is said plainly, so an agent never passes the file on
 * believing the record is there.
 */
export function songCredentialText(songs: { expected: readonly string[]; recorded: readonly string[] } | undefined): string {
  if (!songs?.expected.length) return '';
  const lines: string[] = [];
  if (songs.recorded.length) lines.push(`Songs: ${rondoRecordedSentence(songs.recorded)}`);
  const missing = songs.expected.filter((name) => !songs.recorded.includes(name));
  if (missing.length) lines.push(`Songs: Content Credentials in this file do not record ${missing.map((n) => `"${n}"`).join(', ')}.`);
  return lines.join('\n');
}
