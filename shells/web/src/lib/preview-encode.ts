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
 * at once. A background picture (a gallery or featured look, an idle redraw) waits
 * its turn, one at a time: after the page's first idle moment following load, and
 * only while preview work is allowed (lib/preview-idle.ts `previewWorkAllowed`: a
 * visible tab, no tool opening or open, no export or batch render, no Performance UI,
 * no low battery or Save-Data) and no audio or video is playing. Between pictures it
 * yields to the page.
 *
 * When the worker cannot help (a browser without OffscreenCanvas runs the rule on the
 * main thread, as before; a worker that crashes or runs past its time limit is set
 * aside after two failures), a background picture is kept exactly as the render made
 * it, unencoded, so it is neither lost nor encoded on the main thread; a picture
 * someone asked for is encoded on the main thread, as before.
 */
import type { PreparedPicture } from '../bridge/preview-store.ts';
import type { WriterFacts } from './preview-writer.ts';
import type { PreviewEncodeReply, PreviewEncodeRequest } from './preview-encode-protocol.ts';

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
  /** Whether background work may start now. */
  allowed(): boolean;
  /** Resolves once the page has had its first idle moment after load. */
  ready(): Promise<void>;
  /** Call `fn` when something that may change `allowed()` has happened. */
  wake(fn: () => void): void;
  /** Yield to the page between background pictures. */
  yieldToPage(): Promise<void>;
  /** The rule on this thread. */
  inRealm(source: EncodeSource, facts: WriterFacts): Promise<PreparedPicture | null>;
  /** The render's own bytes, unencoded. */
  asRendered(source: Blob, facts: WriterFacts): Promise<PreparedPicture | null>;
  budgetMs?: number;
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
    const created = o.createWorker();
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

  function post(source: Blob | ImageBitmap, facts: WriterFacts): Promise<PreparedPicture | null> {
    const current = start();
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => retire(new Error('The preview encoder ran past its time limit.')), o.budgetMs ?? 30_000);
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

  async function encodeNow(source: EncodeSource, facts: WriterFacts, inBackground: boolean): Promise<PreparedPicture | null> {
    const capable = o.workerCapable();
    if (failures < MAX_FAILURES && capable) {
      const sent = await portable(source);
      if (sent) {
        try { const picture = await post(sent, facts); stats.worker++; return picture; } catch { /* below */ }
      }
    }
    // The worker failed, or was set aside after failing. A background render is kept
    // as it came rather than costing the main thread; a picture someone asked for,
    // or one in a browser that never had the worker, is encoded here, as before.
    if (capable && failures > 0 && inBackground && source instanceof Blob && source.type !== 'image/svg+xml') {
      stats.asRendered++;
      return o.asRendered(source, facts);
    }
    stats.inRealm++;
    return o.inRealm(source, facts);
  }

  async function whenAllowed(): Promise<void> {
    await o.ready();
    while (!o.allowed()) await new Promise<void>(resolve => o.wake(resolve));
  }

  /**
   * Encode one picture by the raster rule. `background` pictures queue behind each
   * other and wait until background work is allowed; others go at once.
   */
  function encode(source: EncodeSource, facts: WriterFacts = {}, options: { background?: boolean } = {}): Promise<PreparedPicture | null> {
    if (!options.background) return encodeNow(source, facts, false);
    const run = background.then(async () => {
      await whenAllowed();
      try { return await encodeNow(source, facts, true); } finally { await o.yieldToPage(); }
    });
    background = run.catch(() => undefined);
    return run;
  }

  return { encode, stats, dispose: () => { worker?.terminate(); worker = null; } };
}

/** Audio or video playing in the page. */
function mediaPlaying(): boolean {
  try { return [...document.querySelectorAll<HTMLMediaElement>('audio, video')].some(media => !media.paused && !media.ended); } catch { return false; }
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

function wakeOn(fn: () => void): void {
  let woken = false;
  const go = (): void => {
    if (woken) return;
    woken = true;
    window.removeEventListener('hashchange', go);
    document.removeEventListener('visibilitychange', go);
    clearTimeout(timer);
    fn();
  };
  window.addEventListener('hashchange', go);
  document.addEventListener('visibilitychange', go);
  // Exports, Performance UI and playback send no event here: look again shortly.
  const timer = setTimeout(go, 2000);
}

let shared: ReturnType<typeof createPreviewEncoder> | null = null;
let workAllowed: (() => boolean) | null = null;

/** The page's encoder. */
export function previewEncoder(): ReturnType<typeof createPreviewEncoder> {
  if (!workAllowed) {
    workAllowed = () => false;
    void import('./preview-idle.ts').then(m => { workAllowed = m.previewWorkAllowed; }).catch(() => { workAllowed = () => true; });
  }
  shared ??= createPreviewEncoder({
    createWorker: () => new Worker(new URL('./preview-encode.worker.ts', import.meta.url), { type: 'module' }) as unknown as EncodeWorker,
    workerCapable: () => typeof Worker === 'function' && typeof OffscreenCanvas === 'function' && typeof createImageBitmap === 'function',
    allowed: () => workAllowed!() && !mediaPlaying(),
    ready: afterFirstIdle,
    wake: wakeOn,
    yieldToPage: () => new Promise<void>(resolve => {
      const idle = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
      if (idle) idle(() => resolve(), { timeout: 1000 }); else setTimeout(resolve, 50);
    }),
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
