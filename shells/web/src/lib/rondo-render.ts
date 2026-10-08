// SPDX-License-Identifier: MPL-2.0
/**
 * Main-thread client for the rondocode render worker (lib/rondo-worker.ts).
 *
 * A rondocode song is code, and code that is untrusted wherever it came from, so
 * every consumer in the web shell (the asset details sheet, the waveform
 * thumbnails, host.audio, the timeline preview, the export mix and the export
 * bar's soundtrack) renders a song through this one module and nothing else. It
 * owns three things:
 *
 *   - The worker, spawned lazily, one render at a time. Each render runs under a
 *     wall-clock budget, and a render that runs past it is stopped by
 *     terminating the worker: the native render is synchronous and cannot be
 *     pre-empted from inside the realm. The next render spawns a fresh worker.
 *   - A bounded cache keyed by (source digest, seconds), so a song placed on a
 *     timeline is rendered once for the waveform, the preview and the export
 *     rather than three times, and a long song cannot pin unbounded memory.
 *   - The length grid (`rondoTargetSec`). A timeline clip rounds the seconds it
 *     wants UP to a half-second grid before it asks, so the waveform, the preview
 *     and the export, asking for the same clip a float bit apart, share one
 *     render. The grid matters for more than the cache: upstream normalises the
 *     whole mix to its own peak, so two lengths of one song can differ in gain,
 *     and the preview and the export must hear the same render. A caller that
 *     asks for an exact length (host.audio.decode) gets exactly that length, the
 *     same bytes the CLI renders for the same request.
 *
 * Shaped like mod-render.ts and zzfxm-render.ts. Nothing heavy is imported
 * here: the worker chunk carries QuickJS and the staging bundle, and it loads only
 * when a song is first rendered.
 */
import { RONDO_LIMITS } from '@lolly-tools/rondo/limits';
import type { RondoFinding } from '@lolly-tools/rondo';
import {
  isRondoShareLink, rondoFromBytes, rondoFromFile, rondoFromShareLink, RONDO_MAX_SOURCE_BYTES,
  type RondoLang, type RondoSourceV1,
} from '../../../../engine/src/rondo-source.ts';
import { pcmToWavBlob } from './pcm-wav.ts';

export type { RondoFinding };

/** The song as the renderer needs it: its code and its language. */
export interface RondoSong {
  code: string;
  lang: RondoLang;
  /** Display name, for messages only. */
  name?: string;
}

/** How a render ran, for a credit line or a receipt. */
export interface RondoRunInfo {
  executionClass: string;
  seed: number;
  upstream: string;
  adapter: number;
}

/**
 * One rendered song. The channel arrays are SHARED with the cache: read them,
 * never write to them, and copy before transferring them to another worker.
 */
export interface RondoRendered {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
  seconds: number;
  cycles: number;
  cps: number;
  lang: 'js' | 'rondo';
  normalized: boolean;
  findings: RondoFinding[];
  run: RondoRunInfo;
}

/** A render that did not happen, with the renderer's stable code. */
export class RondoRenderError extends Error {
  override name = 'RondoRenderError';
  readonly code: string;
  readonly diagnostics: { message: string; line?: number; col?: number }[];
  constructor(message: string, code: string, diagnostics: { message: string; line?: number; col?: number }[] = []) {
    super(message);
    this.code = code;
    this.diagnostics = diagnostics;
  }
}

// ── the length grid ─────────────────────────────────────────────────────────

/** Requested lengths are rounded UP to this grid. See the header. */
export const RONDO_SECONDS_QUANTUM = 0.5;
/** Shortest render asked of the worker. A shorter clip reads its window out of this. */
export const RONDO_MIN_SECONDS = 1;
/** Slack subtracted before rounding up, so an on-grid length a float bit long stays on the grid. */
const SECONDS_EPS = 1e-6;

/** Clamp and quantise a wanted length to the grid the renderer is actually asked for. */
export function rondoTargetSec(wantedSec: number): number {
  const s = Number.isFinite(wantedSec) ? wantedSec : RONDO_MIN_SECONDS;
  const q = Math.ceil(Math.max(0, s - SECONDS_EPS) / RONDO_SECONDS_QUANTUM) * RONDO_SECONDS_QUANTUM;
  const clamped = Math.min(RONDO_LIMITS.maxSeconds, Math.max(RONDO_MIN_SECONDS, q));
  return Math.round(clamped * 2) / 2;
}

// ── reading a song ──────────────────────────────────────────────────────────

/** Largest stored song file read from a url: a canonical file is the code plus a small JSON frame. */
const MAX_SONG_FILE_BYTES = RONDO_MAX_SOURCE_BYTES * 2 + 4096;

/** A song from stored bytes (the canonical `.rondo.json`), or null when the bytes are not one. */
export function songFromBytes(bytes: Uint8Array, fileName = 'song.rondo.json'): RondoSong | null {
  try {
    const src = /\.rondo(?:\.json)?$/i.test(fileName) ? rondoFromFile(bytes, fileName) : rondoFromBytes(bytes);
    return { code: src.code, lang: src.lang, name: src.name };
  } catch {
    return null;
  }
}

/** The record a song's own source carries, for a details sheet. Null when unreadable. */
export function sourceFromBytes(bytes: Uint8Array): RondoSourceV1 | null {
  try {
    return rondoFromBytes(bytes);
  } catch {
    return null;
  }
}

/**
 * A song from a url: a rondocode share link is decoded in place (nothing is
 * fetched), anything else is fetched with a size ceiling and read as a song file.
 * Rejects with a plain message when it is not a song.
 */
export async function songFromUrl(url: string, signal?: AbortSignal): Promise<RondoSong> {
  if (isRondoShareLink(url)) {
    const src = rondoFromShareLink(url);
    return { code: src.code, lang: src.lang, name: src.name };
  }
  const res = await fetch(url, signal ? { signal } : {});
  if (!res.ok) throw new RondoRenderError('The song file could not be read.', 'rondo.source.fetch');
  const declared = Number(res.headers.get('content-length') ?? Number.NaN);
  if (Number.isFinite(declared) && declared > MAX_SONG_FILE_BYTES) {
    throw new RondoRenderError('The song file is too large.', 'rondo.limits.source');
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length > MAX_SONG_FILE_BYTES) throw new RondoRenderError('The song file is too large.', 'rondo.limits.source');
  const path = (url.split('#')[0] ?? '').split('?')[0] ?? '';
  const song = songFromBytes(bytes, /\.rondo(?:\.json)?$/i.test(path) ? path : 'song.rondo.json');
  if (!song) throw new RondoRenderError('That file is not a rondocode song.', 'rondo.source.invalid');
  return song;
}

// ── the worker and its queue ────────────────────────────────────────────────

interface WorkerReply {
  id: number;
  pcm?: RondoRendered;
  error?: { name: string; code: string; message: string; diagnostics?: { message: string; line?: number; col?: number }[] };
}

interface Job {
  id: number;
  probe: boolean;
  code?: string;
  lang?: RondoLang;
  seconds?: number;
  budgetMs: number;
  resolve: (r: RondoRendered | null) => void;
  reject: (e: unknown) => void;
}

/** Extra wall-clock allowance per second of audio for the native render, ms. */
const RENDER_MS_PER_SECOND = 1000;
/** Allowance for loading QuickJS and the staging bundle into a fresh worker, ms. */
const START_SLACK_MS = 15_000;

/**
 * The wall-clock budget for one render. The vm's own budgets bound the song's code
 * (src/limits.ts); this bounds the whole round trip, the native render included,
 * and is the backstop that stops anything that escapes them. A render with no
 * length asked for may run to the renderer's own ceiling, so it gets that budget.
 */
export function renderBudgetMs(seconds: number | undefined): number {
  const s = seconds ?? RONDO_LIMITS.maxSeconds;
  return RONDO_LIMITS.prepareBudgetMs + RONDO_LIMITS.scheduleBaseMs
    + s * (RONDO_LIMITS.scheduleMsPerSecond + RENDER_MS_PER_SECOND) + START_SLACK_MS;
}

let worker: Worker | null = null;
let seq = 0;
const queue: Job[] = [];
let running: Job | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function dropWorker(): void {
  if (!worker) return;
  worker.onmessage = null;
  worker.onerror = null;
  try { worker.terminate(); } catch { /* already gone */ }
  worker = null;
}

function finish(job: Job): void {
  if (running !== job) return;
  running = null;
  if (timer) { clearTimeout(timer); timer = null; }
}

function ensureWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(new URL('./rondo-worker.ts', import.meta.url), { type: 'module' });
  w.onmessage = (e: MessageEvent<WorkerReply>): void => {
    const job = running;
    if (!job || e.data.id !== job.id) return;         // a reply for a job already timed out
    finish(job);
    const { error, pcm } = e.data;
    if (error) job.reject(new RondoRenderError(error.message, error.code, error.diagnostics ?? []));
    else if (job.probe) job.resolve(null);
    else if (pcm) job.resolve(pcm);
    else job.reject(new RondoRenderError('The render returned nothing.', 'rondo.render.empty'));
    pump();
  };
  w.onerror = (ev: ErrorEvent): void => {
    ev.preventDefault?.();
    const job = running;
    dropWorker();
    if (job) {
      finish(job);
      job.reject(new RondoRenderError('The song renderer stopped unexpectedly.', 'rondo.worker.error'));
    }
    pump();
  };
  worker = w;
  return w;
}

function pump(): void {
  if (running) return;
  const job = queue.shift();
  if (!job) return;
  running = job;
  let w: Worker;
  try {
    w = ensureWorker();
  } catch {
    finish(job);
    job.reject(new RondoRenderError('This browser cannot start the song renderer.', 'rondo.vm.unavailable'));
    pump();
    return;
  }
  timer = setTimeout(() => {
    if (running !== job) return;
    // The only stop that always works: the render is synchronous inside the worker.
    dropWorker();
    finish(job);
    job.reject(new RondoRenderError('The song took too long to render and was stopped.', 'rondo.timeout'));
    pump();
  }, job.budgetMs);
  if (job.probe) w.postMessage({ id: job.id, probe: true });
  else w.postMessage({ id: job.id, code: job.code, lang: job.lang, ...(job.seconds !== undefined ? { seconds: job.seconds } : {}) });
}

function enqueue(job: Omit<Job, 'id' | 'resolve' | 'reject'>): Promise<RondoRendered | null> {
  return new Promise<RondoRendered | null>((resolve, reject) => {
    queue.push({ ...job, id: ++seq, resolve, reject });
    pump();
  });
}

let availability: Promise<boolean> | null = null;

/**
 * Can this browser run a song at all? Starts the worker and asks it to load QuickJS,
 * once per page. False when there is no Worker or WebAssembly, or the interpreter
 * fails to start.
 */
export function rondoRendererAvailable(): Promise<boolean> {
  if (availability) return availability;
  if (typeof Worker === 'undefined' || typeof WebAssembly === 'undefined') {
    availability = Promise.resolve(false);
    return availability;
  }
  availability = enqueue({ probe: true, budgetMs: 30_000 }).then(() => true, () => false);
  return availability;
}

// ── the cache ───────────────────────────────────────────────────────────────

/** Most renders kept. A render is a song at one length. */
export const RONDO_CACHE_MAX_ENTRIES = 6;
/** Most PCM kept, bytes. A render larger than this is returned and not kept. */
export const RONDO_CACHE_MAX_BYTES = 192 * 1024 * 1024;

const cache = new Map<string, RondoRendered>();
let cacheBytes = 0;
const inflight = new Map<string, Promise<RondoRendered>>();

const bytesOf = (r: RondoRendered): number => r.left.byteLength + r.right.byteLength;

function remember(key: string, r: RondoRendered): void {
  const size = bytesOf(r);
  if (size > RONDO_CACHE_MAX_BYTES) return;
  cache.set(key, r);
  cacheBytes += size;
  while (cache.size > RONDO_CACHE_MAX_ENTRIES || cacheBytes > RONDO_CACHE_MAX_BYTES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    const gone = cache.get(oldest);
    cache.delete(oldest);
    if (gone) cacheBytes -= bytesOf(gone);
  }
}

/** A stable digest of what decides the render: the language and the code. */
async function digestOf(song: RondoSong): Promise<string> {
  const text = `${song.lang}\n${song.code}`;
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return `raw:${text}`;
  try {
    const hash = new Uint8Array(await subtle.digest('SHA-256', new TextEncoder().encode(text)));
    let hex = '';
    for (const b of hash) hex += b.toString(16).padStart(2, '0');
    return hex;
  } catch {
    return `raw:${text}`;
  }
}

/**
 * Render a song for exactly `seconds` (a timeline caller rounds with
 * `rondoTargetSec` first); omitted, the song plays its own arrangement, or 8
 * cycles when it has none, up to the renderer's ceiling.
 *
 * The result is shared with the cache: never write to its arrays. Rejects with
 * a `RondoRenderError` carrying the renderer's code.
 */
export async function renderRondoSong(song: RondoSong, opts: { seconds?: number } = {}): Promise<RondoRendered> {
  const seconds = opts.seconds;
  const key = `${await digestOf(song)}|${seconds ?? 'natural'}`;
  const hit = cache.get(key);
  if (hit) {
    // Least recently USED: re-insert so a song being edited outlives a preview of others.
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const running = inflight.get(key);
  if (running) return running;
  const run = enqueue({ probe: false, code: song.code, lang: song.lang, seconds, budgetMs: renderBudgetMs(seconds) })
    .then((r) => {
      if (!r) throw new RondoRenderError('The render returned nothing.', 'rondo.render.empty');
      remember(key, r);
      return r;
    })
    .finally(() => { inflight.delete(key); });
  inflight.set(key, run);
  return run;
}

/** Render a song and wrap it in a stereo AudioBuffer on `ctx`. */
export async function renderRondoToAudioBuffer(ctx: BaseAudioContext, song: RondoSong, seconds?: number): Promise<AudioBuffer> {
  const r = await renderRondoSong(song, seconds === undefined ? {} : { seconds });
  if (!r.left.length) throw new RondoRenderError('The song rendered no audio.', 'rondo.render.empty');
  const buf = ctx.createBuffer(2, r.left.length, r.sampleRate);
  buf.getChannelData(0).set(r.left);
  buf.getChannelData(1).set(r.right);
  return buf;
}

/** Render a song to a 16-bit WAV blob URL, the shape the URL-driven muxer and an <audio> element take. */
export async function renderRondoToWavUrl(song: RondoSong, seconds?: number): Promise<{ url: string; render: RondoRendered }> {
  const render = await renderRondoSong(song, seconds === undefined ? {} : { seconds });
  return { url: URL.createObjectURL(pcmToWavBlob(render)), render };
}

/** Fetch or decode a song url, render it and return a WAV blob URL (mirrors modUrlToWavBlobUrl). */
export async function rondoUrlToWavBlobUrl(url: string, seconds?: number): Promise<string> {
  return (await renderRondoToWavUrl(await songFromUrl(url), seconds)).url;
}

/** Test seam: forget the cache, the probe answer and the worker. */
export function _resetRondoRender(): void {
  cache.clear();
  cacheBytes = 0;
  inflight.clear();
  availability = null;
  queue.length = 0;
  running = null;
  if (timer) { clearTimeout(timer); timer = null; }
  dropWorker();
}
