// SPDX-License-Identifier: MPL-2.0
/**
 * The image UPSCALE run as a background JOB (plans/124 section 9, WP-F).
 *
 * The still-image sibling of lib/video-jobs.ts's `runVideoJobAsJob`: the dialog
 * (views/upscale-dialog.ts) validates, consents and decodes, then hands the
 * decoded frame here and CLOSES. Everything after that - the model run (or the
 * local nearest-neighbour scale), the PNG encode, the provenance stamp and the
 * user-asset save - happens on the WP-F serial heavy queue, so the global toast
 * (lib/job-toast.ts) owns progress and the work survives navigating away.
 *
 * WHY THE FRAME COMES IN ALREADY DECODED
 * The dialog needs the pixels anyway (its feasibility check is sized from them),
 * and decoding is the one step that must happen while the source is still on
 * screen. Handing the job a frame keeps this module free of the picker/asset
 * plumbing and makes the whole tail testable with a synthetic frame.
 *
 * PROVENANCE IS UNCHANGED from the modal-blocking version, byte for byte:
 *   - model path → `c2pa.edited` + IPTC compositeWithTrainedAlgorithmicMedia
 *     ("Upscaled 4× with <model> <version> (on-device)"), the record flagged
 *     `aiGenerated: 'partial'` and `meta.aiUpscale = { model, version }` (the
 *     signal the engine runtime reads for the C2PA composite disclosure);
 *   - pixel-art path → a plain `c2pa.edited` ("Scaled 4× (nearest-neighbour,
 *     pixel art)") with NO genAI claim and NO Gen-AI pill: a deterministic,
 *     lossless integer scale invents nothing.
 * The source's own credential rides forward as an ingredient in both, so an AI
 * image upscaled stays declared as one.
 */

import { extractC2paStore, prepareC2paIngredientFromStore, COMPOSITE_SOURCE_TYPE } from '@lolly/engine';
import { startJob, type JobHandle } from './jobs.ts';
import { t, tRaw } from '../i18n.ts';
import type {
  AssetRef, HostV1, UpscaleFrame, UpscaleModelId, UpscaleProgress,
} from '@lolly-tools/core/host-v1';

/** The user-asset record this job writes (mirrors bridge/assets.ts's non-exported
 *  UserAssetRecord for the fields we set - same pattern as the picker's
 *  UserAssetRecordInput and video-jobs' VideoJobAssetRecordInput, plus the
 *  `aiGenerated` disclosure field). */
export interface UpscaleAssetRecordInput {
  id: string;
  type: AssetRef['type'];
  format: string;
  blob?: Blob;
  version?: string;
  width?: number;
  height?: number;
  meta?: Record<string, unknown>;
  aiGenerated?: 'full' | 'partial';
}

/** The web host surface this job touches: HostV1 (for `upscale`, `log`) plus the
 *  web-only upload helper. The picker's PickerHost satisfies it structurally, so
 *  the call sites pass what they already hold. */
export interface UpscaleJobHost extends HostV1 {
  assets: HostV1['assets'] & {
    _uploadUserAsset(record: UpscaleAssetRecordInput): Promise<void>;
  };
}

/** The model path's run options - exactly what the dialog's controls describe. */
export interface UpscaleModelParams {
  model: UpscaleModelId;
  scale: 2 | 4;
  /** 0..1, the general (WDN-pair) model only; undefined elsewhere. */
  denoise?: number;
  targetMaxEdge: number;
}

export interface UpscaleJobRequest {
  /** The decoded source, straight-alpha RGBA (what `getImageData` yields). */
  frame: UpscaleFrame;
  /** The decoded source's own name - the saved copy's credential title. */
  sourceName: string;
  /** Base for the saved asset's id + display name. Defaults to `sourceName`
   *  (the caller passes its own display name where it has one). */
  saveName?: string;
  /** The source's original file bytes, so its Content Credential carries forward
   *  as an ingredient rather than being erased. */
  sourceBytes?: Uint8Array | null;
  /** The model path. Exactly one of `model` / `pixel` must be present. */
  model?: UpscaleModelParams;
  /** The local nearest-neighbour path (pixel art): an integer scale, no model. */
  pixel?: { scale: number };
}

/** Progress + cancellation, driven by the job handle (or a test). */
export interface UpscaleJobCtx {
  signal?: AbortSignal;
  isCancelled?: () => boolean;
  onProgress?: (done: number, total: number, note?: string) => void;
}

/** One disclosed edit step in the saved copy's credential. */
export interface UpscaleC2paAction {
  action: string;
  digitalSourceType?: string;
  description: string;
}

/** The stamp options runUpscaleJob assembles (a subset of stampDerivedC2pa's `o`). */
export interface UpscaleStampOpts {
  title?: string;
  tool: string;
  actions: UpscaleC2paAction[];
  ingredients?: unknown[];
  dimensions?: string;
}

/** Injection seam so the whole tail is unit-testable without a canvas or a model. */
export interface UpscaleJobDeps {
  /** RGBA frame → PNG bytes. Canvas by default (there is none under node). */
  encode?: (frame: UpscaleFrame) => Promise<Blob>;
  /** The local integer scale. Canvas by default. */
  scaleNearest?: (frame: UpscaleFrame, scale: number) => UpscaleFrame;
  /** The source's own credential as a C2PA ingredient, or null. */
  extractIngredient?: (bytes: Uint8Array) => unknown | null;
  /** Sign the output bytes with the assembled credential. */
  stamp?: (host: UpscaleJobHost, blob: Blob, format: string, o: UpscaleStampOpts) => Promise<Blob>;
}

/** Nearest-neighbour integer scale via canvas - the crisp, no-download, no-blur path
 *  for pixel art (a neural upscaler would smooth away the hard edges). Pure: source
 *  frame → a scale×-larger frame, imageSmoothingEnabled off so pixels stay square. */
export function pixelNearest(frame: UpscaleFrame, scale: number): UpscaleFrame {
  const src = document.createElement('canvas');
  src.width = frame.width; src.height = frame.height;
  const sctx = src.getContext('2d');
  if (!sctx) throw new Error('no 2d context');
  sctx.putImageData(new ImageData(new Uint8ClampedArray(frame.data), frame.width, frame.height), 0, 0);
  const outW = frame.width * scale, outH = frame.height * scale;
  const out = document.createElement('canvas');
  out.width = outW; out.height = outH;
  const octx = out.getContext('2d');
  if (!octx) throw new Error('no 2d context');
  octx.imageSmoothingEnabled = false;
  octx.drawImage(src, 0, 0, outW, outH);
  return { width: outW, height: outH, data: octx.getImageData(0, 0, outW, outH).data };
}

/** A larger RGBA frame back to a PNG blob (putImageData → toBlob). */
export function frameToPngBlob(frame: UpscaleFrame): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = frame.width;
  canvas.height = frame.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('no 2d context'));
  // Build the ImageData from the canvas (its buffer is a plain ArrayBuffer) and
  // copy the frame's pixels in - the frame's Uint8ClampedArray may be backed by a
  // SharedArrayBuffer (Worker transfer), which the ImageData constructor rejects.
  const img = ctx.createImageData(frame.width, frame.height);
  img.data.set(frame.data);
  ctx.putImageData(img, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), 'image/png');
  });
}

/** A file-safe id + a display name from the source name. */
export function upscaleAssetIds(sourceName: string, now: number): { id: string; name: string } {
  const base = sourceName.replace(/\.[a-z0-9]+$/i, '');
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return { id: `user/upscaled/${now}-${slug || 'image'}`, name: tRaw('Upscaled {name}', { name: base || t('image') }) };
}

/** Default ingredient extraction: the source image's preserved C2PA store. */
function defaultExtractIngredient(bytes: Uint8Array): unknown | null {
  const ex = extractC2paStore(bytes);
  return ex ? prepareC2paIngredientFromStore(ex.store, ex.format) : null;
}

/** Default stamp: the shared stampDerivedC2pa, lazily imported so this module stays
 *  cheap to load (and node-importable in tests). */
async function defaultStamp(host: UpscaleJobHost, blob: Blob, format: string, o: UpscaleStampOpts): Promise<Blob> {
  const { stampDerivedC2pa } = await import('../bridge/export.ts');
  return stampDerivedC2pa(host, blob, format, {
    ...(o.title ? { title: o.title } : {}),
    tool: o.tool,
    actions: o.actions as never,
    ...(o.ingredients ? { ingredients: o.ingredients as never } : {}),
    ...(o.dimensions ? { dimensions: o.dimensions } : {}),
  });
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/**
 * Run one image-upscale job end-to-end: enlarge → encode → stamp → save.
 * Reports progress and honours cancellation through `ctx`. Resolves the saved
 * AssetRef, or null when cancelled before anything was written.
 */
export async function runUpscaleJob(
  host: UpscaleJobHost, req: UpscaleJobRequest, ctx: UpscaleJobCtx = {}, deps: UpscaleJobDeps = {},
): Promise<AssetRef | null> {
  const cancelled = (): boolean => ctx.isCancelled?.() === true || ctx.signal?.aborted === true;

  // How to disclose THIS transform in the saved copy's credential, and whether it
  // counts as a Gen-AI edit. The two paths differ in kind, so their provenance does
  // too - this is the whole reason pixel art is a separate branch.
  let out: UpscaleFrame;
  let editAction: UpscaleC2paAction;
  let ai = false;
  let aiUpscaleMeta: { model: UpscaleModelId; version: string } | undefined;

  if (req.pixel) {
    // Pixel art: a LOCAL, deterministic nearest-neighbour integer scale. No model
    // invents anything, so it is disclosed as a plain edit - NEVER a genAI
    // credential or the Gen-AI pill (that would over-claim on a lossless resize).
    const scale = Math.max(2, Math.round(req.pixel.scale || 4));
    ctx.onProgress?.(0, 0, t('Scaling…'));
    out = (deps.scaleNearest ?? pixelNearest)(req.frame, scale);
    editAction = { action: 'c2pa.edited', description: `Scaled ${scale}× (nearest-neighbour, pixel art)` };
  } else if (req.model) {
    const upscale = host.upscale;
    if (!upscale) throw new Error(t('Upscaling isn’t available on this device.'));
    const p = req.model;
    const models = upscale.models();
    const info = models.find((m) => m.id === p.model) ?? models[0];
    if (!info) throw new Error(t('Upscaling isn’t available on this device.'));
    // run() TRANSFERS (neuters) the frame's buffer to the worker, so hand it a FRESH
    // COPY and leave the request's frame intact for the caller.
    const runFrame = { width: req.frame.width, height: req.frame.height, data: new Uint8ClampedArray(req.frame.data) };
    out = await upscale.run(runFrame, {
      model: p.model,
      scale: p.scale,
      denoise: p.denoise,
      targetMaxEdge: p.targetMaxEdge,
      ...(ctx.signal ? { signal: ctx.signal } : {}),
      onProgress: (pr: UpscaleProgress) => reportRunProgress(pr, ctx),
    });
    // A super-resolver INVENTS high-frequency detail from a trained model, so the
    // honest IPTC digitalSourceType is compositeWithTrainedAlgorithmicMedia (a real
    // image with model-inferred pixels), which aiKind reads back as 'partial'.
    editAction = {
      action: 'c2pa.edited',
      digitalSourceType: COMPOSITE_SOURCE_TYPE,
      description: `Upscaled ${info.scale}× with ${info.name} ${info.version} (on-device)`,
    };
    ai = true;
    aiUpscaleMeta = { model: p.model, version: info.version };
  } else {
    throw new Error('upscale job: neither a model nor a pixel scale was requested');
  }
  if (cancelled()) return null;

  ctx.onProgress?.(0, 0, t('Saving…'));
  const rawBlob = await (deps.encode ?? frameToPngBlob)(out);
  const now = Date.now();
  const { id, name } = upscaleAssetIds(req.saveName ?? req.sourceName, now);

  // Stamp the copy's own bytes so its embedded Content Credential discloses the
  // transform (not only the catalog listing). The source's own credential (e.g. an
  // AI image's) is preserved as an ingredient rather than erased. Best-effort: a
  // failed re-sign still ships the unstamped blob.
  let blob = rawBlob;
  try {
    const ingredient = req.sourceBytes ? (deps.extractIngredient ?? defaultExtractIngredient)(req.sourceBytes) : null;
    blob = await (deps.stamp ?? defaultStamp)(host, rawBlob, 'png', {
      title: req.sourceName,
      tool: 'Upscale',
      actions: [editAction],
      ...(ingredient ? { ingredients: [ingredient] } : {}),
      dimensions: `${out.width}×${out.height}`,
    });
  } catch (e) {
    host.log('warn', 'Upscale provenance stamp failed', { error: String(e) });
  }

  const record: UpscaleAssetRecordInput = {
    id,
    type: 'raster',
    format: 'png',
    blob,
    width: out.width,
    height: out.height,
    version: '1.0.0',
    // Gen-AI pill (bridge/assets.ts) only for the model path; the embedded
    // credential above carries the same disclosure into the file's own bytes.
    ...(ai ? { aiGenerated: 'partial' as const } : {}),
    meta: {
      name,
      bytes: blob.size,
      // The C2PA composite-disclosure signal the engine runtime reads
      // (ExportOpts.c2paAiUpscale): "AI-upscaled with <model> <version>".
      ...(aiUpscaleMeta ? { aiUpscale: aiUpscaleMeta } : {}),
    },
  };
  await host.assets._uploadUserAsset(record);
  return await host.assets.get(id);
}

/** Both run phases feed the one bar: the model download (bytes) and the tiled
 *  inference (tile of tiles). An unknowable fraction reports total 0, which the
 *  toast renders as an indeterminate bar. */
function reportRunProgress(p: UpscaleProgress, ctx: UpscaleJobCtx): void {
  if (!ctx.onProgress) return;
  if (p.phase === 'download') {
    const frac = p.fraction ?? (p.total ? (p.loaded ?? 0) / p.total : null);
    const note = t('Downloading the model…');
    if (frac == null) ctx.onProgress(0, 0, note);
    else ctx.onProgress(Math.round(clamp01(frac) * 100), 100, note);
    return;
  }
  const note = t('Upscaling…');
  if (p.tiles) { ctx.onProgress((p.tile ?? 0) + 1, p.tiles, note); return; }
  const frac = p.fraction ?? null;
  if (frac == null) ctx.onProgress(0, 0, note);
  else ctx.onProgress(Math.round(clamp01(frac) * 100), 100, note);
}

/**
 * Drive an image upscale through a WP-F job (serial heavy queue + global toast +
 * desktop notification). Returns the JobHandle immediately; the work runs in the
 * background and survives the dialog closing or the user navigating away.
 * `onComplete` fires with the saved AssetRef so a still-open view can refresh or
 * treat it as a pick.
 */
export function startUpscaleJob(
  host: UpscaleJobHost, req: UpscaleJobRequest,
  hooks: { onComplete?: (ref: AssetRef) => void; onError?: (err: unknown) => void } = {},
  deps: UpscaleJobDeps = {},
): JobHandle {
  const controller = new AbortController();
  const job = startJob({ title: t('Upscaling image'), cancel: () => controller.abort() });
  void (async (): Promise<void> => {
    await job.started;
    if (job.cancelled) return;
    try {
      const ref = await runUpscaleJob(host, req, {
        signal: controller.signal,
        isCancelled: () => job.cancelled,
        onProgress: (done, total, note) => job.progress(done, total, note),
      }, deps);
      if (job.cancelled) return;
      if (ref) { job.finish(ref); hooks.onComplete?.(ref); }
      else job.finish();
    } catch (err) {
      // A cancel is not a failure: cancelJob() has already put the job in its
      // terminal state, and the abort surfaces here as an AbortError.
      if (job.cancelled || (err as Error | null)?.name === 'AbortError') return;
      job.fail(err);
      hooks.onError?.(err);
    }
  })();
  return job;
}
