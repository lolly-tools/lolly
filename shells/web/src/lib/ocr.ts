// SPDX-License-Identifier: MPL-2.0
/**
 * On-device OCR RUNNER (plans/125) - the ORT-heavy half of `host.ocr`, the twin of
 * lib/matter.ts. PP-OCRv5 is a two-graph pipeline: a DBNet detector finds text
 * regions, then a CRNN/SVTR recogniser reads each cropped line (CTC-decoded against
 * a character dictionary). onnxruntime-web, the weights and all pixel work load and
 * run HERE (in a worker, off the boot budget); the bridge only marshals messages.
 *
 * The MATHS is factored into pure, exported, unit-tested functions - the CTC greedy
 * decode, the DBNet connected-component boxing, the box unclip and the reading-order
 * sort - so the tricky parts are verified as data (tests/ocr.test.ts), model-free.
 * The ONLY impure parts are the ORT sessions and the OffscreenCanvas resize/crop.
 *
 * Nothing runs until a model is STAGED (ocr-models.ts): every fetch returns null →
 * a clean "not installed" throw, never a crash.
 */

import type {
  OcrBox, OcrFeasibility, OcrFrame, OcrLine, OcrModelId, OcrOpts, OcrProgress, OcrResult,
} from '@lolly-tools/core/host-v1';
import { createDebugLogger, createModelFetcher, loadOrt, makeCanvas, serializeSessionCreate } from './ort.ts';
import {
  OCR_DEFAULT_MODEL, OCR_MODEL_CACHE_VERSION, OCR_MODEL_DIR, OCR_MODEL_FILES, OCR_MODEL_SPEC,
  OCR_MODEL_STORE, type OcrModelSpec, stagedOcrModels,
} from './ocr-models.ts';
import {
  connectedComponentBoxes, ctcGreedyDecode, detSize, orderBoxesReadingOrder, packNchw, recWidthFor, unclipBox,
} from '../../../../packages/node-shell/src/ml/ocr-math.ts';

const dbg = createDebugLogger({ tag: 'ocr', storageKey: 'lolly:ocr:debug', globalFlag: '__OCR_DEBUG__' });

const fetchModelBytes = createModelFetcher({
  store: OCR_MODEL_STORE,
  dir: OCR_MODEL_DIR,
  version: OCR_MODEL_CACHE_VERSION,
  dbg,
});

// ─── Backend (OCR is WASM-only by design) ─────────────────────────────────────
//
// The models are small, and ort-web's GPU kernels reject ops the DBNet/CRNN graphs
// use (the same wall matte hit). So the backend is always 'wasm' once probed - the
// bridge's backend() reports it, and it never claims webgpu.

let backend: 'wasm' | null = null;

export function currentBackend(): 'wasm' | null {
  return backend;
}

export async function probeBackend(): Promise<'wasm' | null> {
  if (backend) return backend;
  try {
    await loadOrt();
    backend = 'wasm';
  } catch {
    backend = null;
  }
  return backend;
}

export function abortError(message = 'The text read was aborted.'): Error {
  return typeof DOMException !== 'undefined'
    ? new DOMException(message, 'AbortError')
    : Object.assign(new Error(message), { name: 'AbortError' });
}

// ─── Pure maths (unit-tested; no ORT, no DOM) ─────────────────────────────────
//
// The CTC decode, the DBNet boxing, the unclip, the reading-order sort, the
// detector input size and the channel packing MOVED to
// packages/node-shell/src/ml/ocr-math.ts (2026-09-03, plans/183 WS2) so the Node
// OCR runner reuses the exact same numbers instead of carrying a second copy.
// They are re-exported here unchanged: lib/ocr.test.ts and every call site below
// still import them from this module.
export {
  connectedComponentBoxes, ctcGreedyDecode, detSize, orderBoxesReadingOrder, packNchw, unclipBox,
} from '../../../../packages/node-shell/src/ml/ocr-math.ts';
export type { DetBox } from '../../../../packages/node-shell/src/ml/ocr-math.ts';

// ─── ORT sessions + pixel work (impure) ───────────────────────────────────────

type Ort = Awaited<ReturnType<typeof loadOrt>>;
type InferenceSession = Awaited<ReturnType<Ort['InferenceSession']['create']>>;

interface Loaded {
  det: InferenceSession;
  rec: InferenceSession;
  /** charset[0] is the CTC blank; [1..N] the dictionary; a space is appended. */
  charset: string[];
  spec: OcrModelSpec;
}

/** First tensor output of a session run (PP-OCR graphs have one). */
function firstOutput(out: Record<string, unknown>): { data: ArrayLike<number>; dims: readonly number[] } {
  const v = Object.values(out)[0] as { data: ArrayLike<number>; dims: readonly number[] } | undefined;
  if (!v) throw new Error('The OCR model returned no output.');
  return v;
}

const loadedByModel = new Map<OcrModelId, Promise<Loaded>>();

/** Whether a model's three files are already on-device. Never downloads. */
export async function modelCached(id: OcrModelId): Promise<boolean> {
  const files = OCR_MODEL_FILES[id];
  if (!files) return false;
  for (const f of [files.det, files.rec, files.dict]) {
    if (!(await fetchModelBytes(f, true))) return false;
  }
  return true;
}

async function createSession(bytes: ArrayBuffer): Promise<InferenceSession> {
  const ort = await loadOrt();
  return serializeSessionCreate(() =>
    ort.InferenceSession.create(new Uint8Array(bytes), { executionProviders: ['wasm'], graphOptimizationLevel: 'all' }),
  );
}

async function load(id: OcrModelId, onProgress?: (p: OcrProgress) => void): Promise<Loaded> {
  const existing = loadedByModel.get(id);
  if (existing) return existing;
  const files = OCR_MODEL_FILES[id];
  const spec = OCR_MODEL_SPEC[id];
  if (!files || !spec) throw new Error(`Unknown OCR model: ${id}`);
  const p = (async (): Promise<Loaded> => {
    const report = (loaded: number, total: number): void => onProgress?.({ phase: 'download', loaded, total, fraction: total ? loaded / total : undefined });
    const detBytes = await fetchModelBytes(files.det, false, (fp) => report(fp.loaded, fp.total ?? 0));
    const recBytes = await fetchModelBytes(files.rec, false, (fp) => report(fp.loaded, fp.total ?? 0));
    const dictBytes = await fetchModelBytes(files.dict, false);
    if (!detBytes || !recBytes || !dictBytes) {
      const e: Error & { code?: string } = new Error('The OCR model is not installed.');
      e.code = 'not-installed';
      throw e;
    }
    const lines = new TextDecoder('utf-8').decode(dictBytes).split(/\r?\n/).filter((l) => l.length > 0);
    // PP-OCR CTCLabelDecode: [blank] + dictionary + [space].
    const charset = ['', ...lines, ' '];
    const [det, rec] = await Promise.all([createSession(detBytes), createSession(recBytes)]);
    return { det, rec, charset, spec };
  })();
  loadedByModel.set(id, p);
  try { return await p; } catch (err) { loadedByModel.delete(id); throw err; }
}

/** The whole source frame on its own canvas - drawn once, cropped/scaled from repeatedly. */
function sourceCanvas(frame: OcrFrame): OffscreenCanvas | HTMLCanvasElement {
  const c = makeCanvas(frame.width, frame.height);
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(frame.data), frame.width, frame.height), 0, 0);
  return c;
}

/** Scale a source-canvas region into a w×h RGBA buffer. */
function regionRgba(src: OffscreenCanvas | HTMLCanvasElement, sx: number, sy: number, sw: number, sh: number, w: number, h: number): Uint8ClampedArray {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src as unknown as CanvasImageSource, sx, sy, sw, sh, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h).data;
}

export interface OcrRunCtx {
  onProgress?: (p: OcrProgress) => void;
  checkAbort?: () => void;
}

/** Honest feasibility - the models are small, so this only refuses a zero-size frame. */
export function canRunOcr(src: { width: number; height: number }): OcrFeasibility {
  if (!stagedOcrModels().length) return { ok: false, reason: 'no-backend', message: 'No OCR model is installed yet.' };
  if (src.width < 1 || src.height < 1) return { ok: false, reason: 'too-large', message: 'That image has no pixels to read.' };
  return { ok: true };
}

/**
 * Read the text in a frame. Detection → per-line crop → recognition → assembled
 * `OcrResult` in reading order. `singleLine` skips detection and reads the whole
 * frame as one line. Cooperatively abortable between stages.
 */
export async function runOcr(frame: OcrFrame, opts: OcrOpts = {}, ctx: OcrRunCtx = {}): Promise<OcrResult> {
  const id = opts.model ?? OCR_DEFAULT_MODEL;
  const { det, rec, charset, spec } = await load(id, ctx.onProgress);
  ctx.checkAbort?.();

  const ort = await loadOrt();
  const source = sourceCanvas(frame);
  const bounds = { w: frame.width, h: frame.height };
  let boxes: OcrBox[];
  if (opts.singleLine) {
    boxes = [{ x: 0, y: 0, w: frame.width, h: frame.height }];
  } else {
    ctx.onProgress?.({ phase: 'detect' });
    const { dw, dh } = detSize(frame.width, frame.height, spec.det.limitSide);
    const nchw = packNchw(regionRgba(source, 0, 0, frame.width, frame.height, dw, dh), dw, dh, spec.det.mean, spec.det.std);
    const detOut = await det.run({ [spec.det.inputName]: new ort.Tensor('float32', nchw, [1, 3, dh, dw]) });
    ctx.checkAbort?.();
    const first = firstOutput(detOut);
    const ph = first.dims[2] ?? dh;
    const pw = first.dims[3] ?? dw;
    const mapBoxes = connectedComponentBoxes(first.data, pw, ph, {
      binThresh: spec.det.binThresh, minArea: spec.det.minBoxArea, boxThresh: spec.det.boxThresh,
    });
    // Map boxes from the (scaled) det map back to source pixels, then unclip.
    const sx = frame.width / pw;
    const sy = frame.height / ph;
    boxes = orderBoxesReadingOrder(
      mapBoxes.map((b) => unclipBox(
        { x: Math.round(b.x * sx), y: Math.round(b.y * sy), w: Math.round(b.w * sx), h: Math.round(b.h * sy) },
        spec.det.unclipRatio, bounds,
      )),
    );
  }

  ctx.onProgress?.({ phase: 'recognize' });
  const lines: OcrLine[] = [];
  const min = opts.minConfidence ?? 0;
  for (let i = 0; i < boxes.length; i++) {
    ctx.checkAbort?.();
    const box = boxes[i];
    if (!box || box.w < 2 || box.h < 2) continue;
    // Crop the box, resize to the recogniser's fixed height keeping aspect (capped).
    const rw = recWidthFor(box, spec.rec.height, spec.rec.maxWidth);
    const recRgba = regionRgba(source, box.x, box.y, box.w, box.h, rw, spec.rec.height);
    const recNchw = packNchw(recRgba, rw, spec.rec.height, spec.rec.mean, spec.rec.std);
    const recOut = await rec.run({ [spec.rec.inputName]: new ort.Tensor('float32', recNchw, [1, 3, spec.rec.height, rw]) });
    const ro = firstOutput(recOut);
    const T = ro.dims[1] ?? 0;
    const C = ro.dims[2] ?? 0;
    const { text, confidence } = ctcGreedyDecode(ro.data, T, C, charset);
    if (text.trim() && confidence >= min) lines.push({ text: text.trim(), confidence, box });
    ctx.onProgress?.({ phase: 'recognize', fraction: (i + 1) / boxes.length });
  }

  return { text: lines.map((l) => l.text).join('\n'), lines, lang: stagedOcrModels().find((m) => m.id === id)?.languages[0] ?? 'en' };
}
