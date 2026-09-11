// SPDX-License-Identifier: MPL-2.0
/**
 * The still-image MATTE (background removal) run as a background JOB
 * (plans/124 section 9, WP-F).
 *
 * The exact sibling of lib/upscale-job.ts, and the still counterpart of
 * lib/video-jobs.ts's `runVideoJobAsJob`: the dialog (views/matte-dialog.ts)
 * validates, consents and decodes, then hands the decoded frame here and CLOSES.
 * The model run, the encode, the credential and the user-asset save happen on the
 * WP-F serial heavy queue, so the global candy-stripe toast (lib/job-toast.ts)
 * owns progress and cancel, and the work survives navigating away. One heavy job
 * at a time is deliberate (lib/jobs.ts): two wasm matte runs in one tab is the OOM
 * the queue exists to prevent.
 *
 * WHY THE FRAME COMES IN ALREADY DECODED
 * The dialog needs the pixels anyway (its feasibility check is sized from them),
 * and decoding is the one step that must happen while the source is still on
 * screen. Handing the job a frame keeps this module free of the picker/asset
 * plumbing and makes the whole tail testable with a synthetic frame - the canvas
 * encode, the ingredient scan and the signer are all `deps` seams.
 *
 * PROVENANCE IS UNCHANGED (and must stay that way)
 * A matte INVENTS nothing: every RGB pixel is the original, only the alpha is
 * model-computed. So the result carries a plain `c2pa.edited` step naming the
 * operation ("Background removed with <model> <version> (on-device)"), keeps the
 * ORIGINAL as an ingredient (an AI image's credential survives the cut-out instead
 * of being erased), and is NOT flagged aiGenerated. The strings, the meta and the
 * asset id shape are byte-identical to the modal path they replace.
 */

import { chromaKeyAlpha, extractC2paStore, prepareC2paIngredientFromStore } from '@lolly/engine';
import { startJob, type JobHandle } from './jobs.ts';
import { CHROMA_DEFAULT_SOFTNESS, CHROMA_DEFAULT_SPILL, CHROMA_DEFAULT_TOLERANCE } from './video-jobs.ts';
import { classifyMatteError, type MatteErrorKind } from './matte-error.ts';
import { t, tRaw } from '../i18n.ts';
import type {
  AssetRef, HostV1, MatteFrame, MatteModelId, MatteModelInfo, MatteProgress,
} from '@lolly-tools/core/host-v1';

// ── Output format (a cutout needs alpha) ─────────────────────────────────────

// The alpha-capable output formats we can reliably encode from a canvas. A source
// in one of these keeps its format; anything else (JPEG, unknown) → PNG, the
// lossless safe default. AVIF encode is browser-dependent, so it falls back to
// PNG when canvas.toBlob can't produce it (handled in frameToBlob).
export const ALPHA_FORMATS = ['png', 'webp', 'avif'] as const;
export type OutFormat = (typeof ALPHA_FORMATS)[number];
const MIME: Record<OutFormat, string> = { png: 'image/png', webp: 'image/webp', avif: 'image/avif' };

/** The format the cutout should be saved as, from the source's format. */
export function outputFormatFor(sourceFormat: string | undefined): OutFormat {
  const f = (sourceFormat ?? '').toLowerCase().replace('jpeg', 'jpg');
  return (ALPHA_FORMATS as readonly string[]).includes(f) ? (f as OutFormat) : 'png';
}

/** RGBA cutout → a blob in `fmt`, falling back to PNG when the browser can't
 *  encode the requested format (AVIF on older browsers). */
export function frameToBlob(frame: MatteFrame, fmt: OutFormat): Promise<{ blob: Blob; format: OutFormat }> {
  const canvas = document.createElement('canvas');
  canvas.width = frame.width;
  canvas.height = frame.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('no 2d context'));
  const img = ctx.createImageData(frame.width, frame.height);
  img.data.set(frame.data);
  ctx.putImageData(img, 0, 0);
  const encode = (mime: string): Promise<Blob | null> =>
    new Promise((res) => canvas.toBlob((b) => res(b), mime));
  return encode(MIME[fmt]).then((blob) => {
    // toBlob returns the PNG fallback with the WRONG type when a format is
    // unsupported, so verify the produced type actually matches before trusting it.
    if (blob && blob.type === MIME[fmt]) return { blob, format: fmt };
    return encode('image/png').then((png) => {
      if (!png) throw new Error('toBlob failed');
      return { blob: png, format: 'png' as OutFormat };
    });
  });
}

/** The saved cutout's permanent id + its display name. */
export function matteAssetIds(sourceName: string, now: number): { id: string; name: string } {
  const base = sourceName.replace(/\.[a-z0-9]+$/i, '');
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return { id: `user/matte/${now}-${slug || 'cutout'}`, name: tRaw('{name} - cutout', { name: base || t('image') }) };
}

/** A human, actionable message for a failed matte run - never the raw runtime
 *  string. 'aborted' is handled by the caller (silent), so it's not mapped here. */
export function matteErrorMessage(kind: Exclude<MatteErrorKind, 'aborted'>): string {
  switch (kind) {
    case 'not-installed':
      return t("Couldn't download the model. Check your connection and try again.");
    case 'memory':
      // canRun can't see a transformer's activation memory, so a run can still run
      // out after a green check - point at the two levers that actually help.
      return t('Ran out of memory removing the background. Try a smaller image, or the fast model, which needs the least.');
    default:
      return t("Couldn't remove the background. Try a smaller image, or a different model.");
  }
}

// ── The host surface + the request ───────────────────────────────────────────

/** The user-asset record this module writes (mirrors VideoJobAssetRecordInput). */
export interface MatteAssetRecordInput {
  id: string;
  type: AssetRef['type'];
  format: string;
  blob?: Blob;
  version?: string;
  width?: number;
  height?: number;
  meta?: Record<string, unknown>;
}

export interface MatteJobHost extends HostV1 {
  assets: HostV1['assets'] & {
    _uploadUserAsset(record: MatteAssetRecordInput): Promise<void>;
  };
}

export interface MatteJobRequest {
  /** The decoded source, straight-alpha RGBA (what `getImageData` yields). */
  frame: MatteFrame;
  /** The decoded source's own name - the saved cutout's credential title. */
  sourceName: string;
  /** Base for the saved asset's id + display name. Defaults to `sourceName`
   *  (the caller passes its own display name where it has one). */
  saveName?: string;
  /** The source's original file bytes, so its Content Credential carries forward
   *  as an ingredient rather than being erased. */
  sourceBytes?: Uint8Array | null;
  model: MatteModelId;
  /** The alpha-capable output format the user chose. */
  outFormat: OutFormat;
  /** 'model' (default) runs the staged AI matte. 'chroma' keys out a flat
   *  colour on-device with the engine's chromaKeyAlpha - no model, no
   *  download, works on any device (the video matte's second method, brought
   *  to stills: most of the time people just want the white gone). */
  method?: 'model' | 'chroma';
  /** Colour-key colour (sRGB bytes). Default white - the usual margin. */
  keyColor?: { r: number; g: number; b: number };
}

/** The container-level C2PA stamp options runMatteJob assembles (a subset of
 *  stampDerivedC2pa's `o`). */
export interface MatteStampOpts {
  title?: string;
  tool: string;
  actions: { action: string; description?: string }[];
  ingredients?: unknown[];
  dimensions?: string;
}

/** Injection seam so the run+save tail is unit-testable with no canvas, no model
 *  and no signer - the VideoJobDeps pattern. */
export interface MatteJobDeps {
  encode?: (frame: MatteFrame, fmt: OutFormat) => Promise<{ blob: Blob; format: OutFormat }>;
  /** Extract the source image's own credential as a C2PA ingredient, or null. */
  extractIngredient?: (bytes: Uint8Array) => unknown | null;
  /** Sign the output bytes with the assembled credential. */
  stamp?: (host: MatteJobHost, blob: Blob, format: string, o: MatteStampOpts) => Promise<Blob>;
}

/** What the driver reports back while it works, and how it learns it should stop. */
export interface MatteJobCtx {
  signal?: AbortSignal;
  isCancelled?: () => boolean;
  /** `total <= 0` means indeterminate, exactly as lib/jobs.ts defines it. */
  onProgress?: (done: number, total: number, note?: string) => void;
}

/** Default ingredient extraction: the source image's preserved C2PA store. */
function defaultExtractIngredient(bytes: Uint8Array): unknown | null {
  const ex = extractC2paStore(bytes);
  return ex ? prepareC2paIngredientFromStore(ex.store, ex.format) : null;
}

/** Default stamp: the shared stampDerivedC2pa, lazily imported so this module
 *  stays cheap to load. Never throws (it is try/catch internally). */
async function defaultStamp(host: MatteJobHost, blob: Blob, format: string, o: MatteStampOpts): Promise<Blob> {
  const { stampDerivedC2pa } = await import('../bridge/export.ts');
  return stampDerivedC2pa(host, blob, format, {
    ...(o.title ? { title: o.title } : {}),
    tool: o.tool,
    actions: o.actions as never,
    ...(o.ingredients ? { ingredients: o.ingredients as never } : {}),
    ...(o.dimensions ? { dimensions: o.dimensions } : {}),
  });
}

/** The chosen model's name + release string, for the credential and the meta. The
 *  same fallback the dialog used (first staged entry) when an id no longer resolves. */
function matteModelInfo(models: readonly MatteModelInfo[], id: MatteModelId): { name: string; version: string } {
  const m = models.find((x) => x.id === id) ?? models[0];
  return { name: m?.name ?? String(id), version: m?.version ?? '' };
}

/** MatteProgress → the job's (done, total, note). A download reports bytes, the
 *  inference a fraction; neither is guaranteed, so an unknown fraction reports an
 *  indeterminate 0/0 and the toast pulses instead of lying about a percentage. */
function reportProgress(ctx: MatteJobCtx, p: MatteProgress): void {
  if (!ctx.onProgress) return;
  const frac = p.fraction ?? (p.phase === 'download' ? (p.total ? (p.loaded ?? 0) / p.total : null) : null);
  const note = p.phase === 'download' ? t('Downloading the model…') : t('Removing background…');
  if (frac == null) { ctx.onProgress(0, 0, note); return; }
  ctx.onProgress(Math.round(Math.min(1, Math.max(0, frac)) * 100), 100, note);
}

// ── The driver ───────────────────────────────────────────────────────────────

/**
 * Run one still cut-out end-to-end: matte → encode → stamp → save. Resolves the
 * saved AssetRef, or null when the run was aborted (a cancel is not a failure).
 * Throws a HUMAN message on failure - never a raw runtime string, so whatever
 * surfaces it (the toast) can show it as-is.
 */
export async function runMatteJob(
  host: MatteJobHost, req: MatteJobRequest, ctx: MatteJobCtx = {}, deps: MatteJobDeps = {},
): Promise<AssetRef | null> {
  let out: MatteFrame;
  /** The honest c2pa.edited description + the saved meta.matte record, per method. */
  let editDescription: string;
  let matteMeta: Record<string, unknown>;

  if (req.method === 'chroma') {
    // Colour key: pure per-pixel maths (engine chromaKeyAlpha), no capability, no
    // model, nothing to download - so none of the model path's gates apply. The
    // key/soft/spill constants are the video matte's, so the two methods cut the
    // same colour the same way on a still and a clip.
    const key = req.keyColor ?? { r: 255, g: 255, b: 255 };
    ctx.onProgress?.(0, 0, t('Removing background…'));
    const data = chromaKeyAlpha(req.frame.data, req.frame.width, req.frame.height, {
      keyColor: [key.r, key.g, key.b],
      tolerance: CHROMA_DEFAULT_TOLERANCE,
      softness: CHROMA_DEFAULT_SOFTNESS,
      spill: CHROMA_DEFAULT_SPILL,
    });
    out = { width: req.frame.width, height: req.frame.height, data };
    editDescription = 'Background removed with a colour key (on-device)';
    matteMeta = { method: 'chroma' };
  } else {
    const matte = host.matte;
    if (!matte?.isAvailable()) throw new Error(t("Couldn't remove the background. Try a smaller image, or a different model."));
    const info = matteModelInfo(matte.models(), req.model);
    editDescription = `Background removed with ${info.name} ${info.version} (on-device)`;
    matteMeta = { model: req.model, version: info.version };
    try {
      // run() TRANSFERS (neuters) the frame's buffer to the worker, so hand it a FRESH
      // COPY and leave the request's frame intact for the caller.
      const runFrame = { width: req.frame.width, height: req.frame.height, data: new Uint8ClampedArray(req.frame.data) };
      out = await matte.run(runFrame, {
        model: req.model,
        ...(ctx.signal ? { signal: ctx.signal } : {}),
        onProgress: (p) => reportProgress(ctx, p),
      });
    } catch (e) {
      // Belt-and-braces: never surface a raw runtime string (e.g. ort-web's
      // "failed to call OrtRun()… std::bad_alloc"). Classify to an actionable
      // message. An abort is the user's own cancel, so it is silent. See lib/matte-error.ts.
      const kind = classifyMatteError(e);
      if (kind === 'aborted') return null;
      host.log('error', 'Matte run failed', { error: String(e), kind });
      throw new Error(matteErrorMessage(kind));
    }
  }
  if (ctx.isCancelled?.()) return null;

  ctx.onProgress?.(0, 0, t('Saving…'));
  const { blob: rawBlob, format } = await (deps.encode ?? frameToBlob)(out, req.outFormat);

  // Provenance: stamp the operation and keep the original as an ingredient.
  // A matte invents nothing, so this is a c2pa.edited step, NOT an
  // AI-generated claim - and a source credential (e.g. an AI image's) is
  // preserved rather than erased. Never throws (stampDerivedC2pa is
  // try/catch internally); a failed re-sign still ships the cut-out.
  let blob = rawBlob;
  try {
    const ingredient = req.sourceBytes ? (deps.extractIngredient ?? defaultExtractIngredient)(req.sourceBytes) : null;
    blob = await (deps.stamp ?? defaultStamp)(host, rawBlob, format, {
      title: req.sourceName,
      tool: 'Remove background',
      actions: [{ action: 'c2pa.edited', description: editDescription }],
      ...(ingredient ? { ingredients: [ingredient] } : {}),
      dimensions: `${out.width}×${out.height}`,
    });
  } catch (e) {
    host.log('warn', 'Matte provenance stamp failed', { error: String(e) });
  }

  const now = Date.now();
  const { id, name } = matteAssetIds(req.saveName ?? req.sourceName, now);
  await host.assets._uploadUserAsset({
    id, type: 'raster', format, blob, width: out.width, height: out.height, version: '1.0.0',
    meta: {
      name,
      bytes: blob.size,
      // NOT aiGenerated: the RGB is 100% the original; only the alpha is
      // computed. The operation is disclosed in the credential as an edit.
      matte: matteMeta,
    },
  });
  return await host.assets.get(id);
}

/**
 * Drive a still cut-out through a WP-F job (serial heavy queue + global toast +
 * desktop notification). Returns the JobHandle immediately; the work runs in the
 * background and survives the dialog closing and the user navigating away.
 * `onComplete` fires with the saved AssetRef so a still-open view can refresh.
 *
 * Heavy (the default): a matte run is wasm inference over a whole photo, so it
 * queues behind any other heavy job rather than fighting it for the address space.
 */
export function startMatteJob(
  host: MatteJobHost, req: MatteJobRequest,
  hooks: { onComplete?: (ref: AssetRef) => void; onError?: (err: unknown) => void } = {},
  deps: MatteJobDeps = {},
): JobHandle {
  const controller = new AbortController();
  // A colour key is a pixel loop, not wasm inference - it must never hold the
  // heavy slot a model run queues on.
  const job = startJob({ title: t('Removing background'), cancel: () => controller.abort(), heavy: req.method !== 'chroma' });
  void (async (): Promise<void> => {
    await job.started;
    if (job.cancelled) return;
    try {
      const ref = await runMatteJob(host, req, {
        signal: controller.signal,
        isCancelled: () => job.cancelled,
        onProgress: (done, total, note) => job.progress(done, total, note),
      }, deps);
      if (job.cancelled) return;
      if (ref) { job.finish(ref); hooks.onComplete?.(ref); }
      else job.finish();
    } catch (err) {
      // A cancel is not a failure: cancelJob() has already put the job in its
      // terminal state, and an abort surfaces here as an AbortError.
      if (job.cancelled || (err as Error | null)?.name === 'AbortError') return;
      job.fail(err);
      hooks.onError?.(err);
    }
  })();
  return job;
}
