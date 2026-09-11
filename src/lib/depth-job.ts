// SPDX-License-Identifier: MPL-2.0
import { aiAllowed, assertAiAllowed, guardAiWorker } from './ai-policy.ts';
/**
 * Monocular depth as a background JOB (plans/160 WP-A) - the sibling of
 * lib/matte-job.ts and lib/upscale-job.ts.
 *
 * A depth pass is multi-second wasm inference, so it rides the WP-F serial heavy
 * queue and the global candy-stripe toast (lib/job-toast.ts) owns its progress and
 * its cancel. One heavy job at a time is deliberate (lib/jobs.ts): two wasm runs in
 * one tab is the OOM the queue exists to prevent.
 *
 * WHAT THIS DOES NOT DO, unlike matte-job: it saves no asset and stamps no
 * credential. A depth map is an intermediate the tool renders WITH, not an output
 * the user keeps; the provenance is stamped on the tool's own export (plans/160
 * section 3.6, WP-E). So the job resolves the map and stops.
 *
 * THE CACHE is the reason a shared link feels instant: a computed map is stored
 * under (image checksum, model id) in the shared 'derived-media' store - derived,
 * evictable, regenerable, never part of the portable backup. Reopening a link
 * re-uses it; a cache miss re-infers. THE DEPTH MAP ITSELF NEVER TRAVELS IN A URL.
 *
 * The pinned Small graph is served from /models/depth/. Download, decode and
 * inference errors are surfaced through the job with a retryable message.
 */

import { startJob, type JobHandle } from './jobs.ts';
import { classifyMatteError, type MatteErrorKind } from './matte-error.ts';
import { openDB } from '../bridge/db.ts';
import { makeCanvas } from './ort.ts';
import { t } from '../i18n.ts';
import {
  DEPTH_DEFAULT_MODEL, DEPTH_MAX_WORK_EDGE, depthCacheKey,
  type DepthFrame, type DepthMap, type DepthModelId, type DepthProgress,
} from './depth-models.ts';
import type { DepthWorkerReply, DepthWorkerRequest, SerializableDepthOpts } from './depth-worker.ts';

// ── Request / seams ──────────────────────────────────────────────────────────

export interface DepthJobRequest {
  /** The decoded source, straight-alpha RGBA (what getImageData yields). */
  frame: DepthFrame;
  /**
   * A stable content hash of the SOURCE image bytes - the cache identity. The
   * caller owns it because it owns the bytes; `imageChecksum` is here for callers
   * that have nothing better.
   */
  checksum: string;
  model?: DepthModelId;
  /** Longest edge of the working image. Defaults to DEPTH_MAX_WORK_EDGE (2048) -
   *  the iOS memory cap, not a quality choice; the model sees 518px regardless. */
  maxEdge?: number;
}

/** Where computed maps are remembered between runs and between page loads. */
export interface DepthCache {
  get(key: string): Promise<DepthMap | null>;
  put(key: string, map: DepthMap): Promise<void>;
}

/** Injection seam so the whole driver is unit-testable with no worker, no model
 *  and no IndexedDB - the MatteJobDeps pattern. */
export interface DepthJobDeps {
  /** Runs the model. Defaults to the worker client below. */
  infer?: (frame: DepthFrame, opts: {
    model: DepthModelId; maxEdge: number; signal?: AbortSignal;
    onProgress?: (p: DepthProgress) => void;
  }) => Promise<DepthMap>;
  cache?: DepthCache;
}

/** What the driver reports back while it works, and how it learns it should stop. */
export interface DepthJobCtx {
  signal?: AbortSignal;
  isCancelled?: () => boolean;
  /** `total <= 0` means indeterminate, exactly as lib/jobs.ts defines it. */
  onProgress?: (done: number, total: number, note?: string) => void;
}

// ── Checksum ─────────────────────────────────────────────────────────────────

/** SHA-256 of the source bytes as lowercase hex - the cache identity half that
 *  is not the model id. Content-addressed on purpose: the same photo shared by
 *  two people hits the same key without either of them naming it. */
export async function imageChecksum(bytes: Uint8Array | ArrayBuffer): Promise<string> {
  const buf = bytes instanceof Uint8Array ? bytes.slice().buffer : bytes;
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

// ── The IndexedDB cache ──────────────────────────────────────────────────────
//
// 'derived-media' rather than a store of its own: a depth map is exactly what that
// store is for - bytes computed on device FROM a user asset, evictable, and
// regenerable by re-inferring. Records carry their own `key`, so it is a keyPath
// store. Every operation is best-effort: a cache that cannot be read or written
// must only ever cost time, never a run.

export const depthCache: DepthCache = {
  async get(key) {
    try {
      const db = await openDB();
      const rec = await db.get('derived-media', key) as
        { width?: number; height?: number; data?: Float32Array } | undefined;
      if (!rec?.data || !rec.width || !rec.height) return null;
      // A record whose payload doesn't match its declared size is a truncated or
      // half-migrated write - treat it as a miss rather than rendering garbage.
      if (rec.data.length !== rec.width * rec.height) return null;
      return { width: rec.width, height: rec.height, data: rec.data };
    } catch { return null; }
  },
  async put(key, map) {
    try {
      const db = await openDB();
      await db.put('derived-media', { key, width: map.width, height: map.height, data: map.data, at: Date.now() });
    } catch { /* best-effort: a failed write just means re-inferring next time */ }
  },
};

// ── Human errors ─────────────────────────────────────────────────────────────

/** A human, actionable message for a failed depth run - never the raw runtime
 *  string. Classification is shared with matte (lib/matte-error.ts): the failure
 *  modes are the same ORT ones, so a second classifier would only be a second
 *  place to forget `std::bad_alloc`. 'aborted' is the user's own cancel and is
 *  handled silently by the caller, so it is not mapped here. */
export function depthErrorMessage(kind: Exclude<MatteErrorKind, 'aborted'>): string {
  switch (kind) {
    case 'not-installed':
      return t("Couldn't download the depth model. Check your connection and try again.");
    case 'memory':
      return t('Ran out of memory reading depth. Try a smaller photo.');
    default:
      return t("Couldn't read depth from this photo. Try a different one.");
  }
}

// ── The worker client ────────────────────────────────────────────────────────
//
// The whole bridge half of the matte feature (bridge/matte.ts + matte-wasm-api.ts)
// collapsed to one function, because depth has exactly one consumer and one call.
// Discipline kept verbatim from there: the request TRANSFERS the source buffer, the
// terminal reply transfers the map back, abort is a message the worker polls, a
// late reply for a dropped id is silently ignored, and an onerror settles every
// pending promise so a crashed worker can never hang a caller.

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (m: DepthMap) => void; reject: (e: unknown) => void; onProgress?: (p: DepthProgress) => void }>();

function spawn(): Worker {
  assertAiAllowed('depth');
  if (worker) return worker;
  const w = guardAiWorker('depth', () => new Worker(new URL('./depth-worker.ts', import.meta.url), { type: 'module' }));
  w.onmessage = (e: MessageEvent<DepthWorkerReply>): void => {
    const r = e.data;
    if (r.id === 0) return; // the unsolicited backend warm-up
    const p = pending.get(r.id);
    if (!p) return;         // late reply for an aborted/dropped request
    if (r.progress) { p.onProgress?.(r.progress); return; }
    pending.delete(r.id);
    if (r.aborted) p.reject(Object.assign(new Error('The depth run was aborted.'), { name: 'AbortError' }));
    else if (r.error) p.reject(new Error(r.error));
    else if (r.map) p.resolve(r.map);
    else p.reject(new Error('depth worker returned nothing'));
  };
  w.onerror = (): void => {
    for (const p of pending.values()) p.reject(new Error('depth worker error'));
    pending.clear();
    try { w.terminate(); } catch { /* already gone */ }
    worker = null;
  };
  worker = w;
  return w;
}

function inferInWorker(
  frame: DepthFrame,
  opts: { model: DepthModelId; maxEdge: number; signal?: AbortSignal; onProgress?: (p: DepthProgress) => void },
): Promise<DepthMap> {
  const w = spawn();
  const id = ++seq;
  return new Promise<DepthMap>((resolve, reject) => {
    pending.set(id, { resolve, reject, ...(opts.onProgress ? { onProgress: opts.onProgress } : {}) });
    opts.signal?.addEventListener('abort', () => {
      if (!pending.has(id)) return;
      pending.delete(id);
      w.postMessage({ id, type: 'abort' } satisfies DepthWorkerRequest);
      reject(Object.assign(new Error('The depth run was aborted.'), { name: 'AbortError' }));
    }, { once: true });
    const serializable: SerializableDepthOpts = { model: opts.model, maxEdge: opts.maxEdge };
    w.postMessage({ id, type: 'run', frame, opts: serializable } satisfies DepthWorkerRequest, [frame.data.buffer]);
  });
}

// ── Progress ─────────────────────────────────────────────────────────────────

/** DepthProgress → the job's (done, total, note). A download reports bytes, the
 *  inference a fraction; neither is guaranteed, so an unknown fraction reports an
 *  indeterminate 0/0 and the toast pulses instead of lying about a percentage. */
function reportProgress(ctx: DepthJobCtx, p: DepthProgress): void {
  if (!ctx.onProgress) return;
  const frac = p.fraction ?? (p.phase === 'download' ? (p.total ? (p.loaded ?? 0) / p.total : null) : null);
  const note = p.phase === 'download' ? t('Downloading the model…') : t('Reading depth…');
  if (frac == null) { ctx.onProgress(0, 0, note); return; }
  ctx.onProgress(Math.round(Math.min(1, Math.max(0, frac)) * 100), 100, note);
}

// ── The driver ───────────────────────────────────────────────────────────────

/**
 * Compute one depth map: cache → infer → cache. Resolves the map, or null when
 * the run was aborted (a cancel is not a failure). Throws a HUMAN message on
 * failure, so whatever surfaces it (the toast) can show it as-is.
 */
export async function runDepthJob(
  req: DepthJobRequest, ctx: DepthJobCtx = {}, deps: DepthJobDeps = {},
): Promise<DepthMap | null> {
  if (!aiAllowed('depth')) return null;
  const model = req.model ?? DEPTH_DEFAULT_MODEL;
  const cache = deps.cache ?? depthCache;
  const key = depthCacheKey(req.checksum, model);

  const hit = await cache.get(key);
  if (!aiAllowed('depth')) return null;
  if (hit) return hit;
  if (ctx.isCancelled?.()) return null;

  let map: DepthMap;
  try {
    // The run TRANSFERS (neuters) the frame's buffer to the worker, so hand it a
    // FRESH COPY and leave the caller's frame intact - it is still on screen flat.
    const runFrame: DepthFrame = {
      width: req.frame.width, height: req.frame.height, data: new Uint8ClampedArray(req.frame.data),
    };
    map = await (deps.infer ?? inferInWorker)(runFrame, {
      model,
      maxEdge: req.maxEdge ?? DEPTH_MAX_WORK_EDGE,
      ...(ctx.signal ? { signal: ctx.signal } : {}),
      onProgress: (p) => reportProgress(ctx, p),
    });
  } catch (e) {
    const kind = classifyMatteError(e);
    if (kind === 'aborted') return null;
    throw new Error(depthErrorMessage(kind));
  }
  if (ctx.isCancelled?.()) return null;

  if (!aiAllowed('depth')) return null;
  await cache.put(key, map);
  return aiAllowed('depth') ? map : null;
}

/**
 * Drive a depth pass through a WP-F job (serial heavy queue + global toast).
 * Returns the JobHandle immediately; `onComplete` fires with the map, which is
 * the moment the tool inflates the flat photo into a scene.
 */
export function startDepthJob(
  req: DepthJobRequest,
  // onComplete is TOTAL - a cancel calls it with null rather than never calling
  // it, so a caller awaiting a map cannot be left hanging by the cancel button.
  hooks: { onComplete?: (map: DepthMap | null) => void; onError?: (err: unknown) => void } = {},
  deps: DepthJobDeps = {},
): JobHandle {
  const controller = new AbortController();
  const job = startJob({ title: t('Reading depth'), cancel: () => controller.abort(), heavy: true });
  void (async (): Promise<void> => {
    await job.started;
    if (job.cancelled) { hooks.onComplete?.(null); return; }
    try {
      const map = await runDepthJob(req, {
        signal: controller.signal,
        isCancelled: () => job.cancelled,
        onProgress: (done, total, note) => job.progress(done, total, note),
      }, deps);
      if (job.cancelled) { hooks.onComplete?.(null); return; }
      job.finish(map ?? undefined);
      hooks.onComplete?.(map);
    } catch (err) {
      // A cancel is not a failure: cancelJob() has already put the job in its
      // terminal state, and an abort surfaces here as an AbortError.
      if (job.cancelled || (err as Error | null)?.name === 'AbortError') { hooks.onComplete?.(null); return; }
      job.fail(err);
      hooks.onError?.(err);
    }
  })();
  return job;
}

// ── The body behind the tool-facing seam (plans/160 section 7) ───────────────
//
// `window.__lollyDepth` itself is published by lib/depth-seam.ts, which loads
// this module on the first request - see that file's header for why the two are
// split. What lives here is the work: decode the source, run the job, settle.
//
async function decodeToFrame(url: string): Promise<{ frame: DepthFrame; checksum: string } | null> {
  const resp = await fetch(url);
  if (!resp.ok) return null;
  const bytes = new Uint8Array(await resp.arrayBuffer());
  const checksum = await imageChecksum(bytes);
  const bmp = await createImageBitmap(new Blob([bytes as BlobPart]));
  try {
    const canvas = makeCanvas(bmp.width, bmp.height);
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
    if (!ctx) return null;
    ctx.drawImage(bmp as unknown as CanvasImageSource, 0, 0);
    const img = ctx.getImageData(0, 0, bmp.width, bmp.height);
    return { frame: { width: img.width, height: img.height, data: img.data }, checksum };
  } finally {
    bmp.close();
  }
}

/** What `window.__lollyDepth.forImage` runs. Never rejects - see DepthSeam. */
export function depthForImage(url: string): Promise<DepthMap | null> {
  return new Promise<DepthMap | null>((resolve) => {
    void decodeToFrame(url).then((decoded) => {
      if (!decoded) { resolve(null); return; }
      startDepthJob(decoded, { onComplete: resolve, onError: () => resolve(null) });
    }, () => resolve(null));
  });
}
