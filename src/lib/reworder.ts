// SPDX-License-Identifier: MPL-2.0
import { aiAllowed, assertAiAllowed, guardAiWorker, runAi } from './ai-policy.ts';
/**
 * Main-thread facade over the reword worker (plans/127) - the catalog UI's one
 * entry point to the model tier. Owns the worker lifecycle (spawn on first use,
 * terminate-then-drop on error like bridge/speech.ts), the id-keyed pending
 * map, and the status probe the consent UI needs. Returns RAW candidates; the
 * caller runs the engine's `rewordCandidates` gate before showing anything.
 *
 * The full surface is defined here from day one - status, reword, abort,
 * dispose - so a lazy call site can never quietly drop an optional method.
 */

import { REWORD_SYSTEM_PROMPT } from '@lolly/engine';
import type { TextWatermarkScore } from '@lolly/engine';
import {
  REWORD_STAGED, REWORD_MODEL_BYTES, REWORD_MODEL_CACHE_URL, REWORD_MODEL_DIR,
  REWORD_MODEL_FILES, REWORD_SAMPLES, REWORD_TEMPERATURE, REWORD_TOP_P,
  rewordMaxNewTokens,
} from './reword-models.ts';
import type { RewordWorkerReply, RewordWorkerRequest, RewordWorkerProgress } from './reword-worker.ts';
import { MODELS_BASE } from './models-base.ts';

/**
 * unstaged      - weights not vendored into this deploy; the UI stays absent.
 * need-download - staged and runnable, but the first use will download
 *                 REWORD_MODEL_BYTES; ask before spending that.
 * ready         - model bytes already in the transformers Cache API bucket;
 *                 offline from here on.
 */
export type RewordStatus = 'unstaged' | 'need-download' | 'ready';

export interface RewordProgress extends RewordWorkerProgress {}

interface Pending {
  resolve: (r: string[]) => void;
  reject: (e: unknown) => void;
  onProgress?: (p: RewordProgress) => void;
}

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, Pending>();
/** Watermark detections in flight - resolved with null on any failure, since a
 *  detection that cannot run is an absence of signal, never an error state. */
const pendingWm = new Map<number, (r: TextWatermarkScore | null) => void>();

function ensureWorker(): Worker {
  assertAiAllowed('reword');
  if (worker) return worker;
  worker = guardAiWorker('reword', () => new Worker(new URL('./reword-worker.ts', import.meta.url), { type: 'module' }));
  worker.onmessage = (e: MessageEvent<RewordWorkerReply>): void => {
    const { id, progress, result, wm, error } = e.data;
    const w = pendingWm.get(id);
    if (w) {
      if (progress) return;
      pendingWm.delete(id);
      w(wm ?? null);
      return;
    }
    const p = pending.get(id);
    if (!p) return; // late reply for an aborted request - already rejected
    if (progress) { p.onProgress?.(progress); return; }
    pending.delete(id);
    if (error || !result) p.reject(new Error(error ?? 'reword failed'));
    else p.resolve(result);
  };
  worker.onerror = (): void => {
    for (const p of pending.values()) p.reject(new Error('reword worker error'));
    pending.clear();
    for (const w of pendingWm.values()) w(null);
    pendingWm.clear();
    // Terminate, then drop, the dead worker so the next reword() spawns a fresh
    // one - detaching alone would leak the broken thread and its model session.
    if (worker) { worker.onmessage = null; worker.onerror = null; worker.terminate(); }
    worker = null;
  };
  return worker;
}

// ── The Tauri native path (plans/127 + plan 110's "meaningfully ahead") ──────
//
// On the desktop shell the sampling loop runs on NATIVE ONNX Runtime (src-tauri
// src/reword.rs) - measured 0.4-1.4 s per sample where single-thread wasm took
// minutes. Runtime probe, not a build-time override: lib/ modules are outside
// the tauri bridge-override map, and the probe (the website.ts idiom) degrades
// to the worker path on the web byte-identically. JS still owns consent, the
// download (fetch → reword_put_file materialises into app-data), the prompt
// (REWORD_SYSTEM_PROMPT - engine data, so shells cannot drift) and the gate.

interface TauriInternals {
  invoke(cmd: string, args?: unknown, opts?: { headers?: Record<string, string> }): Promise<unknown>;
}

function tauri(): TauriInternals | null {
  const t = (globalThis as { __TAURI_INTERNALS__?: TauriInternals }).__TAURI_INTERNALS__;
  return t && typeof t.invoke === 'function' ? t : null;
}

/** Native model presence, or null when there is no native side (web, or an
 *  older desktop build without the commands). */
async function nativeStaged(): Promise<boolean | null> {
  const t = tauri();
  if (!t) return null;
  try {
    return (await t.invoke('reword_probe')) === true;
  } catch {
    return null;
  }
}

/** Materialise the staged set into the native side's app-data dir: fetch each
 *  file (same-origin /models/, or wherever this deploy serves them) and hand
 *  the bytes to reword_put_file. Bytes-weighted progress over the known total. */
async function nativeStage(t: TauriInternals, onProgress: ((p: RewordProgress) => void) | undefined, signal: AbortSignal): Promise<void> {
  let loaded = 0;
  for (const file of REWORD_MODEL_FILES) {
    assertAiAllowed('reword');
    const res = await fetch(`${MODELS_BASE}/models/${REWORD_MODEL_DIR}/${file}`, { signal });
    if (!res.ok) throw new Error(`reword model file unavailable: ${file} (${res.status})`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    signal.throwIfAborted();
    await t.invoke('reword_put_file', bytes, { headers: { 'x-file': file } });
    loaded += bytes.byteLength;
    onProgress?.({ phase: 'download', loaded, total: REWORD_MODEL_BYTES, fraction: Math.min(1, loaded / REWORD_MODEL_BYTES) });
  }
}

async function nativeGenerate(
  t: TauriInternals,
  sentence: string,
  count: number,
  onProgress: ((p: RewordProgress) => void) | undefined,
  signal: AbortSignal,
): Promise<string[]> {
  if (!(await t.invoke('reword_probe'))) await nativeStage(t, onProgress, signal);
  signal.throwIfAborted();
  const raws = await t.invoke('reword_generate', {
    system: REWORD_SYSTEM_PROMPT,
    sentence,
    count,
    // No tokenizer on this side of the seam - a chars/4 estimate feeds the
    // same decode-budget rule the worker computes from real token counts.
    maxNewTokens: rewordMaxNewTokens(Math.ceil(sentence.length / 4)),
    temperature: REWORD_TEMPERATURE,
    topP: REWORD_TOP_P,
  });
  onProgress?.({ phase: 'generate', fraction: 1 });
  return Array.isArray(raws) ? raws.filter((r): r is string => typeof r === 'string') : [];
}

/** Can this environment even try? (Worker + wasm; false under jsdom.) */
export function rewordAvailable(): boolean {
  return aiAllowed('reword') && REWORD_STAGED && typeof WebAssembly !== 'undefined' && typeof Worker === 'function';
}

/** One-time download size for the consent line. */
export function rewordModelBytes(): number {
  return REWORD_MODEL_BYTES;
}

/** Where the model tier stands for this session - drives the consent UI. */
export async function rewordStatus(): Promise<RewordStatus> {
  if (!rewordAvailable()) return 'unstaged';
  // Desktop: the native side's disk is the cache that matters.
  const native = await nativeStaged();
  if (native !== null) return native ? 'ready' : 'need-download';
  if (typeof caches === 'undefined') return 'need-download';
  try {
    const c = await caches.open('transformers-cache');
    return (await c.match(REWORD_MODEL_CACHE_URL)) !== undefined ? 'ready' : 'need-download';
  } catch {
    return 'need-download'; // Cache API visible but sealed - treat as cold
  }
}

/**
 * Sample raw rewrite candidates for ONE sentence. The first call may download
 * the model (progress reports phase 'download'); later calls generate straight
 * away. Rejects on worker failure; resolves with whatever samples completed
 * if aborted mid-run.
 */
export function rewordSentence(
  sentence: string,
  opts: { count?: number; onProgress?: (p: RewordProgress) => void } = {},
): { done: Promise<string[]>; abort: () => void } {
  // Desktop-native first: seconds, not minutes, and no worker session held in
  // webview memory. Abort is a no-op there (a native run is short); the web
  // worker path keeps its cooperative abort.
  assertAiAllowed('reword');
  const t = tauri();
  if (t) {
    return {
      done: runAi('reword', (signal) => nativeGenerate(t, sentence, opts.count ?? REWORD_SAMPLES, opts.onProgress, signal)),
      abort: (): void => { /* native runs are short - nothing to abort */ },
    };
  }
  const w = ensureWorker();
  const id = ++seq;
  const done = new Promise<string[]>((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress: opts.onProgress });
  });
  w.postMessage({ id, type: 'reword', sentence, count: opts.count ?? REWORD_SAMPLES } satisfies RewordWorkerRequest);
  return {
    done,
    abort: (): void => {
      w.postMessage({ id, type: 'abort' } satisfies RewordWorkerRequest);
    },
  };
}

/**
 * Score a text against the reword watermark (engine text-watermark.ts, the
 * Kirchenbauer green-list scheme every reword sample is generated under).
 * Tokenizer-only - the worker never downloads the model for this - so it is
 * cheap enough for the verify view to run on every analysed text. Resolves
 * null wherever the check cannot run (models unstaged, no Worker, worker
 * failure): a missing check is an absence of signal, not a claim.
 *
 * The NATIVE desktop generate path (reword.rs) embeds the same scheme; this
 * detection path is the one detector for both, so it stays worker-side even
 * on desktop (the tokenizer files come from MODELS_BASE and cache).
 */
export function detectRewordWatermark(text: string): Promise<TextWatermarkScore | null> {
  if (!rewordAvailable() || !text.trim()) return Promise.resolve(null);
  const w = ensureWorker();
  const id = ++seq;
  return new Promise<TextWatermarkScore | null>((resolve) => {
    pendingWm.set(id, resolve);
    w.postMessage({ id, type: 'wm-detect', text } satisfies RewordWorkerRequest);
  });
}

/** Tear the worker down (view unmount) - pending requests reject. */
export function disposeReworder(): void {
  for (const p of pending.values()) p.reject(new Error('reworder disposed'));
  pending.clear();
  for (const w of pendingWm.values()) w(null);
  pendingWm.clear();
  if (worker) { worker.onmessage = null; worker.onerror = null; worker.terminate(); }
  worker = null;
}
