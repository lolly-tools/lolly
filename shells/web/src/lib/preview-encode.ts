// SPDX-License-Identifier: MPL-2.0
/**
 * Where the preview writer's raster rule runs (plan 373). The rule decodes a render,
 * encodes it, decodes the result again and compares the pixels with the source
 * (lib/preview-writer.ts `rasterPicture`); on a phone that is seconds of work for the
 * pictures the gallery draws on a visit. It runs in a worker
 * (lib/preview-encode.worker.ts), so the page's main thread only posts the render and
 * waits: a raster render goes as its encoded bytes and is decoded there with
 * createImageBitmap; a canvas or an image is copied into an ImageBitmap and
 * transferred.
 *
 * Two lanes. A picture someone asked for (the capture when a session is saved) goes
 * at once, with a short time limit so a stalled worker cannot use up the save's own
 * deadline. A background picture (a gallery, featured or chooser look) waits its
 * turn, one at a time: after the page's first idle moment following load, and while
 * the page is busy (lib/preview-work-gate.ts: a hidden tab, a tool opening, an export
 * or a batch render) or audio or video is playing. A tile is waiting for that
 * picture, so the wait is bounded: after 5 s, or at once when the device asks for
 * less work (Performance UI, a low battery, Save-Data), the render is kept as it
 * came, unencoded, and nothing is judged. Between pictures it yields one turn of the
 * event loop.
 *
 * When the worker cannot help (a browser without OffscreenCanvas runs the rule on the
 * main thread, as before; a worker that cannot start, answers with an error, crashes
 * or runs past its time limit; after two failures it is set aside), a background
 * picture is kept exactly as the render made it, so it is neither lost nor encoded on
 * the main thread; a picture someone asked for is encoded on the main thread, as
 * before.
 */
import type { PreparedPicture } from '../bridge/preview-store.ts';
import type { WriterFacts } from './preview-writer.ts';
import type { PreviewEncodeReply, PreviewEncodeRequest } from './preview-encode-protocol.ts';
import { mediaPlaying, previewDeviceConstrained, previewPageBusy, watchPreviewBattery, whenPreviewWorkMayResume } from './preview-work-gate.ts';

export interface EncodeWorker {
  onmessage: ((event: MessageEvent) => unknown) | null;
  onerror: ((event: ErrorEvent) => unknown) | null;
  postMessage(message: PreviewEncodeRequest, transfer: Transferable[]): void;
  terminate(): void;
}

export type EncodeSource = Blob | HTMLCanvasElement | OffscreenCanvas | ImageBitmap | HTMLImageElement;

export interface EncoderOptions {
  createWorker(): EncodeWorker;
  /** Whether this browser can run the rule in a worker. */
  workerCapable(): boolean;
  /** Whether background work may start now (false while the page is busy for now). */
  allowed(): boolean;
  /** Whether the device asks for less work: background renders are then kept as they came. */
  constrained(): boolean;
  /** Resolves once the page has had its first idle moment after load. */
  ready(): Promise<void>;
  /** Call `fn` when something that may change `allowed()` has happened, or after `ms`. */
  wake(fn: () => void, ms: number): void;
  /** Yield to the page between background pictures. */
  yieldToPage(): Promise<void>;
  /** The rule on this thread. */
  inRealm(source: EncodeSource, facts: WriterFacts): Promise<PreparedPicture | null>;
  /** The render's own bytes, unencoded. */
  asRendered(source: Blob, facts: WriterFacts): Promise<PreparedPicture | null>;
  /** Time limit for one background picture in the worker. */
  budgetMs?: number;
  /** Time limit for a picture someone asked for, before it is encoded here instead. */
  foregroundBudgetMs?: number;
  /** Longest a background picture waits for the page before it is kept as it came. */
  maxWaitMs?: number;
}

/** Failures after which the worker is set aside for the rest of the visit. */
const MAX_FAILURES = 2;

export function createPreviewEncoder(o: EncoderOptions) {
  let worker: EncodeWorker | null = null;
  let failures = 0;
  let sequence = 0;
  let background: Promise<unknown> = Promise.resolve();
  const pending = new Map<number, { resolve(picture: PreparedPicture | null): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>();
  const stats = { worker: 0, inRealm: 0, asRendered: 0 };

  function retire(error: Error): void {
    failures++;
    worker?.terminate();
    worker = null;
    for (const [id, job] of pending) { clearTimeout(job.timer); pending.delete(id); job.reject(error); }
  }

  function start(): EncodeWorker {
    if (worker) return worker;
    let created: EncodeWorker;
    try { created = o.createWorker(); } catch (error) { failures++; throw error; }
    created.onmessage = event => {
      const data = event.data as PreviewEncodeReply;
      const job = pending.get(data.id);
      if (!job) return;
      pending.delete(data.id);
      clearTimeout(job.timer);
      if (!data.ok) { job.reject(new Error(data.error)); return; }
      job.resolve(data.picture ? { ref: data.picture.ref, bytes: data.picture.bytes, ...(data.picture.verdict ? { verdict: data.picture.verdict } : {}) } : null);
    };
    created.onerror = event => { event.preventDefault?.(); retire(new Error(event.message || 'The preview encoder stopped.')); };
    worker = created;
    return created;
  }

  function post(source: Blob | ImageBitmap, facts: WriterFacts, budgetMs: number): Promise<PreparedPicture | null> {
    const current = start();
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => retire(new Error('The preview encoder ran past its time limit.')), budgetMs);
      (timer as { unref?: () => void }).unref?.();
      pending.set(id, { resolve, reject, timer });
      try { current.postMessage({ id, source, facts }, source instanceof Blob ? [] : [source]); }
      catch (error) { pending.delete(id); clearTimeout(timer); reject(error instanceof Error ? error : new Error(String(error))); }
    });
  }

  /** The source in a form a worker can take, or null: an SVG cannot be decoded there. */
  async function portable(source: EncodeSource): Promise<Blob | ImageBitmap | null> {
    if (source instanceof Blob) return source.type === 'image/svg+xml' ? null : source;
    if (typeof createImageBitmap !== 'function') return null;
    try { return await createImageBitmap(source as ImageBitmapSource); } catch { return null; }
  }

  /** A raster render that can be kept exactly as it came. */
  function keepable(source: EncodeSource): source is Blob {
    return source instanceof Blob && source.type !== 'image/svg+xml';
  }

  function keepAsRendered(source: Blob, facts: WriterFacts): Promise<PreparedPicture | null> {
    stats.asRendered++;
    return o.asRendered(source, facts);
  }

  async function encodeNow(source: EncodeSource, facts: WriterFacts, inBackground: boolean): Promise<PreparedPicture | null> {
    const capable = o.workerCapable();
    let workerFailed = false;
    if (failures < MAX_FAILURES && capable) {
      const sent = await portable(source);
      if (sent) {
        const budget = inBackground ? (o.budgetMs ?? 30_000) : (o.foregroundBudgetMs ?? 3_000);
        try { const picture = await post(sent, facts, budget); stats.worker++; return picture; } catch { workerFailed = true; }
      }
    }
    // The worker failed, or was set aside after failing. A background render is kept
    // as it came rather than costing the main thread; a picture someone asked for,
    // or one in a browser that never had the worker, is encoded here, as before.
    if (capable && (workerFailed || failures > 0) && inBackground && keepable(source)) return keepAsRendered(source, facts);
    stats.inRealm++;
    return o.inRealm(source, facts);
  }

  /** Wait for a background picture's turn: 'run' to judge it, 'keep' to keep it as it came. */
  async function turn(): Promise<'run' | 'keep'> {
    await o.ready();
    const until = Date.now() + (o.maxWaitMs ?? 5_000);
    for (;;) {
      if (o.constrained()) return 'keep';
      if (o.allowed()) return 'run';
      const left = until - Date.now();
      if (left <= 0) return 'keep';
      await new Promise<void>(resolve => o.wake(resolve, left));
    }
  }

  /**
   * Encode one picture by the raster rule. `background` pictures queue behind each
   * other and wait until background work is allowed; others go at once.
   */
  function encode(source: EncodeSource, facts: WriterFacts = {}, options: { background?: boolean } = {}): Promise<PreparedPicture | null> {
    if (!options.background) return encodeNow(source, facts, false);
    const run = background.then(async () => {
      const next = await turn();
      try {
        if (next === 'keep' && keepable(source)) return await keepAsRendered(source, facts);
        return await encodeNow(source, facts, true);
      } finally { await o.yieldToPage(); }
    });
    background = run.catch(() => undefined);
    return run;
  }

  return { encode, stats, dispose: () => { worker?.terminate(); worker = null; } };
}

let firstIdle: Promise<void> | null = null;
function afterFirstIdle(): Promise<void> {
  firstIdle ??= new Promise<void>(resolve => {
    const idle = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const go = (): void => { if (idle) idle(() => resolve(), { timeout: 3000 }); else setTimeout(resolve, 200); };
    if (typeof document === 'undefined' || document.readyState === 'complete') go();
    else window.addEventListener('load', go, { once: true });
  });
  return firstIdle;
}

let shared: ReturnType<typeof createPreviewEncoder> | null = null;

/** A module worker, in the shape the encoder uses. */
function encodeWorker(): EncodeWorker {
  const worker: Worker = new Worker(new URL('./preview-encode.worker.ts', import.meta.url), { type: 'module' });
  return worker;
}

/** The page's encoder. */
export function previewEncoder(): ReturnType<typeof createPreviewEncoder> {
  watchPreviewBattery();
  shared ??= createPreviewEncoder({
    createWorker: encodeWorker,
    workerCapable: () => typeof Worker === 'function' && typeof OffscreenCanvas === 'function' && typeof createImageBitmap === 'function',
    // Not held off the tool route as the idle work is: the template chooser shows
    // these looks there, and the work is on the worker.
    allowed: () => !previewPageBusy() && !mediaPlaying(),
    constrained: previewDeviceConstrained,
    ready: afterFirstIdle,
    // Exports and playback send no event here: look again shortly.
    wake: (fn, ms) => whenPreviewWorkMayResume(fn, Math.min(ms, 2000)),
    // The work is on the worker, so a turn of the event loop is enough: waiting for an
    // idle callback on a busy page held encoded looks back until the page closed, and
    // the next visit drew them again.
    yieldToPage: () => new Promise<void>(resolve => { setTimeout(resolve, 0); }),
    inRealm: async (source, facts) => (await import('./preview-writer.ts')).rasterPicture(source, facts),
    asRendered: async (source, facts) => {
      const { bytesPicture, WRITER_VERSION } = await import('./preview-writer.ts');
      const picture = await bytesPicture(source, facts);
      return picture ? { ...picture, verdict: { writer: WRITER_VERSION, encoding: 'as-rendered' } } : null;
    },
  });
  return shared;
}

/** Encode a raster picture by the writer's rule, off the main thread where it can. */
export function writeRaster(source: EncodeSource, facts: WriterFacts = {}, options: { background?: boolean } = {}): Promise<PreparedPicture | null> {
  return previewEncoder().encode(source, facts, options);
}
