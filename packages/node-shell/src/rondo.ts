// SPDX-License-Identifier: MPL-2.0
/**
 * Rondocode songs on Node: the CLI, the TUI and the MCP server render a song here.
 *
 * A song is source code and arrives from people Lolly does not know, so it is
 * untrusted on every surface. packages/rondo's `renderRondo` is the only way a song
 * becomes audio: the code runs in QuickJS, the `vm` execution class, and upstream's
 * fixed DSP reads only the validated data that comes out. This file owns the part
 * the vm cannot: the DSP render is synchronous, so it runs in a `worker_threads`
 * Worker (rondo-worker.ts) that is terminated when the wall clock runs out. Nothing
 * here runs song code in this realm, and a Worker that cannot start is a refusal,
 * never a fallback to rendering in-thread.
 *
 * The limits are data (`RondoCaps`). The CLI and a local MCP use `LOCAL_RONDO_CAPS`;
 * the public MCP server passes tighter ones, because one request must not be able
 * to hold the process: shorter songs, a fixed wall clock, a time budget for every
 * song one request renders, one render at a time and a short queue.
 *
 * A finished render is kept briefly (`CACHE_*`) because a tool commonly analyses
 * the same song twice in one render (a guess at the frame rate, then the real
 * pass), and rendering is the expensive part. The same song and length always give
 * the same samples, so a kept result is the result.
 */
import { Worker } from 'node:worker_threads';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { RONDO_LIMITS, type RondoLimits } from '@lolly-tools/rondo/limits';
import { rondoSourceBytes, type RondoSourceV1 } from '@lolly/engine';
import type { AudioFinding } from '@lolly-tools/core/host-v1';
import type { RondoWorkerJob, RondoWorkerReply } from './rondo-worker.ts';

/** The limits one host renders songs under. */
export interface RondoCaps {
  /** Longest render, seconds. Never above `RONDO_LIMITS.maxSeconds`. */
  maxSeconds: number;
  /** Wall clock for one render, ms. Omitted: 60 s plus 2 s for each second of audio. */
  timeoutMs?: number;
  /** Wall clock for every song one audio host renders, ms: one MCP request. Omitted: no total. */
  budgetMs?: number;
  /** Song renders running at once in this process. */
  maxConcurrent: number;
  /** Renders allowed to wait for a free slot; the next one is refused. */
  maxQueued: number;
  /** The render thread's V8 heap, MB. QuickJS's own heap is the vm's memory limit. */
  heapMb: number;
  /** Overrides for the vm's own budgets (src/limits.ts in packages/rondo). Tests shorten them. */
  vmLimits?: Partial<RondoLimits>;
}

/** The CLI, the TUI and an MCP server on the person's own machine. */
export const LOCAL_RONDO_CAPS: Readonly<RondoCaps> = Object.freeze({
  maxSeconds: RONDO_LIMITS.maxSeconds,
  maxConcurrent: 2,
  maxQueued: 8,
  heapMb: 1024,
});

/**
 * A public server. Rendering is the cost: measured on an M-series laptop
 * (2026-10-07), 30 s of each of upstream's 39 example songs took 1.2 to 18.6 s in
 * this Worker, median 3.8 s, with only two over 10 s (one is a convolution reverb).
 * 30 s of audio covers a social clip; a 20 s wall clock and a 20 s total per
 * request leave room inside a 30 s function for everything else the request does,
 * and a song that needs longer on a slower server core is refused by name. One
 * render at a time, because a render holds a whole core. The heaviest examples
 * render inside the 384 MB heap.
 */
export const HOSTED_RONDO_CAPS: Readonly<RondoCaps> = Object.freeze({
  maxSeconds: 30,
  timeoutMs: 20_000,
  budgetMs: 20_000,
  maxConcurrent: 1,
  maxQueued: 2,
  heapMb: 384,
});

/** A song that could not be rendered, with a stable code (`rondo.vm.timeout`, `rondo.evaluate`, ...). */
export class RondoAudioError extends Error {
  override name = 'RondoAudioError';
  readonly code: string;
  readonly diagnostics: { message: string; line?: number; col?: number }[];
  constructor(message: string, code: string, diagnostics: { message: string; line?: number; col?: number }[] = []) {
    super(message);
    this.code = code;
    this.diagnostics = diagnostics;
  }
}

/** What ran a computed source, in the shape `AudioDecoded.run` carries. */
export interface ComputedAudioRunInfo {
  executionClass: string;
  source: string;
  version: string;
  seed?: number;
}

/** One song render, reported to whoever asked for audio so it can say what ran and what was silent. */
export interface ComputedAudioRun {
  /** Stable identity of this render (source digest, length, cap), so a caller can report it once. */
  key: string;
  source: 'rondocode';
  /** The song's display name. */
  name: string;
  /**
   * SHA-256 of the song's canonical `.rondo.json` bytes, as hex. The C2PA source
   * ingredient for the song carries it (song-provenance.ts), so a reader holding the
   * song file can match the two.
   */
  sourceDigest: string;
  seconds: number;
  sampleRate: number;
  /** Parts the render could not play, by name. Empty when everything played. */
  findings: AudioFinding[];
  run: ComputedAudioRunInfo;
  /** True when the samples came from this process's recent renders rather than a new one. */
  cached: boolean;
}

/** A song that did not render, reported beside the error a caller may catch. */
export interface ComputedAudioFailure {
  source: 'rondocode';
  /** The song's display name. */
  name: string;
  /** Stable code: `rondo.vm.timeout`, `rondo.evaluate`, `rondo.limits.seconds`, ... */
  code: string;
  message: string;
}

export interface RondoRendered {
  sampleRate: number;
  channels: [Float32Array, Float32Array];
  seconds: number;
  findings: AudioFinding[];
  run: ComputedAudioRunInfo;
  report: ComputedAudioRun;
}

/** Wall time spent rendering songs for one audio host, against `RondoCaps.budgetMs`. */
export interface RondoBudget {
  spentMs: number;
}

// ---- cache -----------------------------------------------------------------

/** Results kept, at most. */
const CACHE_ENTRIES = 4;
/** Samples kept across all entries (two channels counted), about 96 MB of float32. */
const CACHE_SAMPLES = 24 * 1024 * 1024;

interface Kept {
  sampleRate: number;
  channels: [Float32Array, Float32Array];
  seconds: number;
  findings: AudioFinding[];
  run: ComputedAudioRunInfo;
}

const kept = new Map<string, Kept>();
const inflight = new Map<string, Promise<Kept>>();

/**
 * Songs that failed for a reason that would repeat (the vm's own budgets, a song
 * that does not compile, a render past the wall clock), kept a few minutes so a
 * shell that renders a song before a tool mounts, and then the tool's own hook,
 * do not pay for the same failure twice. A busy slot, a spent budget and a
 * renderer that could not start are not kept: those depend on the moment.
 */
const FAILED_ENTRIES = 16;
const FAILED_MS = 5 * 60_000;
const failed = new Map<string, { error: RondoAudioError; at: number }>();
const TRANSIENT = new Set(['rondo.busy', 'rondo.limits.budget', 'rondo.vm.unavailable']);

function rememberFailure(key: string, error: RondoAudioError): void {
  if (TRANSIENT.has(error.code)) return;
  failed.delete(key);
  failed.set(key, { error, at: Date.now() });
  for (const oldest of failed.keys()) {
    if (failed.size <= FAILED_ENTRIES) break;
    failed.delete(oldest);
  }
}

function knownFailure(key: string): RondoAudioError | null {
  const hit = failed.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > FAILED_MS) {
    failed.delete(key);
    return null;
  }
  return new RondoAudioError(hit.error.message, hit.error.code, hit.error.diagnostics);
}

const samplesOf = (k: Kept): number => k.channels[0].length + k.channels[1].length;

function keep(key: string, k: Kept): void {
  if (samplesOf(k) > CACHE_SAMPLES / 2) return;
  kept.delete(key);
  kept.set(key, k);
  let total = 0;
  for (const v of kept.values()) total += samplesOf(v);
  for (const [oldest, v] of kept) {
    if (kept.size <= CACHE_ENTRIES && total <= CACHE_SAMPLES) break;
    kept.delete(oldest);
    total -= samplesOf(v);
  }
}

/** Test seam: forget every kept render and every kept failure. */
export function clearRondoCache(): void {
  kept.clear();
  failed.clear();
}

// ---- slots -----------------------------------------------------------------

let running = 0;
const waiters: { cap: number; wake: () => void }[] = [];

function pump(): void {
  for (let i = 0; i < waiters.length;) {
    const w = waiters[i]!;
    if (running < w.cap) {
      waiters.splice(i, 1);
      running += 1;
      w.wake();
    } else i += 1;
  }
}

/** Wait for a render slot. Resolves to the release function; rejects `rondo.busy`. */
async function acquire(caps: RondoCaps, waitMs: number): Promise<() => void> {
  let released = false;
  const release = (): void => {
    if (released) return;
    released = true;
    running -= 1;
    pump();
  };
  if (running < caps.maxConcurrent && waiters.length === 0) {
    running += 1;
    return release;
  }
  const busy = (): RondoAudioError => new RondoAudioError(
    'Another song is rendering on this server, so this one was not started. Try again shortly.',
    'rondo.busy',
  );
  if (waiters.length >= caps.maxQueued) throw busy();
  await new Promise<void>((resolve, reject) => {
    const waiter = {
      cap: caps.maxConcurrent,
      wake: (): void => {
        clearTimeout(timer);
        resolve();
      },
    };
    const timer = setTimeout(() => {
      const at = waiters.indexOf(waiter);
      if (at >= 0) waiters.splice(at, 1);
      reject(busy());
    }, Math.max(0, waitMs));
    waiters.push(waiter);
  });
  return release;
}

// ---- the worker --------------------------------------------------------------

/**
 * The render thread's entry. From source it is rondo-worker.ts beside this file; in
 * a bundled serverless function scripts/build-mcp-fn.ts writes it beside the bundle
 * as `_rondo-worker.js` (the underscore keeps it from becoming a route).
 */
function workerUrl(): URL {
  const candidates = [new URL('./rondo-worker.ts', import.meta.url), new URL('./_rondo-worker.js', import.meta.url)];
  for (const url of candidates) {
    if (url.protocol === 'file:' && existsSync(fileURLToPath(url))) return url;
  }
  throw new RondoAudioError('The song renderer is missing from this installation, so the song was not rendered.', 'rondo.vm.unavailable');
}

const STDERR_KEEP = 2048;

/** Render threads that have started and not yet exited. */
const live = new Set<Worker>();

/** How many render threads are alive now: a terminated one is gone once it has exited. */
export function liveRondoWorkers(): number {
  return live.size;
}

function runWorker(job: RondoWorkerJob, caps: RondoCaps, timeoutMs: number, limitText: string): Promise<Kept> {
  const url = workerUrl();
  return new Promise<Kept>((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(url, {
        workerData: job,
        // Nothing in this process's environment is the song's business.
        env: {},
        execArgv: [],
        // Kept off this process's stdout, which is the payload (CLI) or the
        // JSON-RPC channel (MCP over stdio).
        stdout: true,
        stderr: true,
        resourceLimits: { maxOldGenerationSizeMb: caps.heapMb },
      });
    } catch (e) {
      reject(new RondoAudioError(`The song renderer could not start: ${e instanceof Error ? e.message : String(e)}`, 'rondo.vm.unavailable'));
      return;
    }
    live.add(worker);
    worker.once('exit', () => live.delete(worker));
    let stderr = '';
    worker.stdout.resume();
    worker.stderr.on('data', (chunk: Buffer) => {
      if (stderr.length < STDERR_KEEP) stderr += chunk.toString('utf8').slice(0, STDERR_KEEP - stderr.length);
    });
    let settled = false;
    const finish = (err: RondoAudioError | null, value?: Kept): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      if (err) reject(err);
      else resolve(value!);
    };
    const timer = setTimeout(() => {
      finish(new RondoAudioError(`The song ran past ${limitText} and was stopped.`, 'rondo.vm.timeout'));
    }, timeoutMs);
    worker.on('message', (reply: RondoWorkerReply) => {
      if (!reply || typeof reply !== 'object') {
        finish(new RondoAudioError('The song renderer answered with nothing.', 'rondo.render.error'));
        return;
      }
      if (!reply.ok) {
        finish(new RondoAudioError(reply.message, reply.code, reply.diagnostics ?? []));
        return;
      }
      const { left, right } = reply;
      if (!(left instanceof Float32Array) || !(right instanceof Float32Array) || left.length !== right.length) {
        finish(new RondoAudioError('The song renderer answered with unreadable audio.', 'rondo.render.error'));
        return;
      }
      finish(null, {
        sampleRate: reply.sampleRate,
        channels: [left, right],
        seconds: reply.seconds,
        findings: reply.findings.map(f => ({ code: f.code, message: f.message, parts: [...f.parts] })),
        run: {
          executionClass: reply.run.executionClass,
          source: 'rondocode',
          version: `${reply.run.upstream.slice(0, 12)}+lolly.${reply.run.adapter}`,
          seed: reply.run.seed,
        },
      });
    });
    worker.on('error', (e: Error & { code?: string }) => {
      if (e.code === 'ERR_WORKER_OUT_OF_MEMORY') {
        finish(new RondoAudioError(`The song needed more than this host's ${caps.heapMb} MB of memory to render and was stopped.`, 'rondo.vm.memory'));
      } else if (e.code === 'ERR_MODULE_NOT_FOUND' || e.code === 'ERR_WORKER_INIT_FAILED') {
        finish(new RondoAudioError(`The song renderer could not start: ${e.message}`, 'rondo.vm.unavailable'));
      } else {
        finish(new RondoAudioError(`The song renderer failed: ${e.message}`, 'rondo.render.error'));
      }
    });
    worker.on('exit', (code) => {
      const tail = stderr.trim() ? ` (${stderr.trim().split('\n').slice(-1)[0]})` : '';
      finish(new RondoAudioError(`The song renderer stopped before it answered, exit code ${code}${tail}.`, 'rondo.render.error'));
    });
  });
}

// ---- the render --------------------------------------------------------------

const secondsText = (ms: number): string => (ms < 10_000 ? (ms / 1000).toFixed(1) : String(Math.round(ms / 1000)));

const digestOf = (song: RondoSourceV1): string =>
  createHash('sha256').update(`${song.lang}\u0000${song.code}`).digest('hex');

const copyOf = (k: Kept): Kept => ({
  ...k,
  channels: [k.channels[0].slice(), k.channels[1].slice()],
  findings: k.findings.map(f => ({ ...f, parts: [...f.parts] })),
});

/**
 * Render one song for `seconds` (omitted: its own arrangement, or 8 cycles) under
 * `caps`. `budget` is the running total for one audio host, checked against
 * `caps.budgetMs`. Rejects with a `RondoAudioError` carrying a stable code.
 */
export async function renderRondoSong(
  song: RondoSourceV1,
  opts: { seconds?: number; caps?: RondoCaps; budget?: RondoBudget } = {},
): Promise<RondoRendered> {
  const caps = opts.caps ?? LOCAL_RONDO_CAPS;
  const maxSeconds = Math.min(caps.maxSeconds, RONDO_LIMITS.maxSeconds);
  const { seconds } = opts;
  if (seconds !== undefined && (!Number.isFinite(seconds) || seconds <= 0)) {
    throw new RondoAudioError('The length must be a positive number of seconds.', 'rondo.limits.seconds');
  }
  if (seconds !== undefined && seconds > maxSeconds) {
    throw new RondoAudioError(`This host renders songs up to ${maxSeconds} s long; ${seconds} s was asked for.`, 'rondo.limits.seconds');
  }
  const key = `${digestOf(song)}|${seconds ?? 'natural'}|${maxSeconds}`;
  const sourceDigest = createHash('sha256').update(rondoSourceBytes(song)).digest('hex');
  const report = (k: Kept, cached: boolean): RondoRendered => ({
    sampleRate: k.sampleRate,
    channels: k.channels,
    seconds: k.seconds,
    findings: k.findings,
    run: k.run,
    report: {
      key, source: 'rondocode', name: song.name, sourceDigest, seconds: k.seconds, sampleRate: k.sampleRate,
      findings: k.findings.map(f => ({ ...f, parts: [...f.parts] })), run: { ...k.run }, cached,
    },
  });

  const hit = kept.get(key);
  if (hit) {
    kept.delete(key);
    kept.set(key, hit);
    return report(copyOf(hit), true);
  }
  const pending = inflight.get(key);
  if (pending) return report(copyOf(await pending), true);

  const budget = opts.budget;
  const remaining = caps.budgetMs === undefined ? Number.POSITIVE_INFINITY : caps.budgetMs - (budget?.spentMs ?? 0);
  if (remaining <= 0) {
    throw new RondoAudioError(
      `This request has used its ${Math.round(caps.budgetMs! / 1000)} s of song rendering, so this song was not started.`,
      'rondo.limits.budget',
    );
  }
  const nominal = caps.timeoutMs ?? 60_000 + 2_000 * (seconds ?? maxSeconds);
  // A failure is kept per wall clock too: a song that ran out of a short one may
  // finish under a longer one.
  const failureKey = `${key}|${nominal}|${JSON.stringify(caps.vmLimits ?? {})}`;
  const known = knownFailure(failureKey);
  if (known) throw known;
  const wallClock = Math.min(nominal, remaining);
  const job: RondoWorkerJob = {
    code: song.code,
    lang: song.lang,
    ...(seconds !== undefined ? { seconds } : {}),
    limits: { ...caps.vmLimits, maxSeconds },
  };

  // True once the render started with the host's whole wall clock in hand.
  let fullClock = false;
  const work = (async (): Promise<Kept> => {
    const started = Date.now();
    let release: (() => void) | null = null;
    try {
      // Stop waiting while a useful second of the wall clock is still left.
      release = await acquire(caps, Math.max(0, wallClock - 1_000));
      const waited = Date.now() - started;
      const left = Math.max(1, wallClock - waited);
      fullClock = wallClock === nominal && waited <= 100;
      // Name the limit that actually applies: the host's own, or what the request
      // had left after earlier songs and the wait for a slot.
      const limitText = wallClock < nominal || waited > 100
        ? `the ${secondsText(left)} s of rendering time this request had left`
        : `this host's ${secondsText(nominal)} s time limit`;
      return await runWorker(job, caps, left, limitText);
    } finally {
      release?.();
      // Waiting for a slot is time the request spent too.
      if (budget) budget.spentMs += Date.now() - started;
    }
  })();
  inflight.set(key, work);
  let fresh: Kept;
  try {
    fresh = await work;
  } catch (e) {
    // Only a failure that would repeat is kept, and only when the whole wall clock
    // was available: a render cut short by a request's remaining budget, or by a
    // wait for a slot, proves nothing about the song.
    if (e instanceof RondoAudioError && fullClock) rememberFailure(failureKey, e);
    throw e;
  } finally {
    inflight.delete(key);
  }
  keep(key, fresh);
  return report(kept.has(key) ? copyOf(fresh) : fresh, false);
}
