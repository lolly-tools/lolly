// SPDX-License-Identifier: MPL-2.0
/**
 * Main-thread PREFETCH of the on-device image-AI model weights (host.upscale,
 * host.matte) into the exact IndexedDB object stores their worker runners read - 
 * so the profile's "Available offline" section can pull them down in ANTICIPATION
 * of work, not only when a dialog first needs them.
 *
 * The twin of trustmark.ts's prefetchTrustmarkModels, and the reason it can live
 * outside the ORT-heavy worker modules (upscaler.ts / matter.ts): ort.ts imports
 * onnxruntime-web TYPE-ONLY, so `createModelFetcher` (fetch → IndexedDB, no ORT) is
 * a light main-thread import that never drags the runtime into the bundle.
 *
 * CACHE PARITY IS THE WHOLE POINT: the store / dir / version below MUST match the
 * worker fetchers (upscaler.ts, matter.ts) exactly, or the pre-downloaded bytes are
 * invisible to them and the dialog re-downloads on first use. They come from the
 * shared pure catalogue modules (upscale-models.ts / matte-models.ts) for exactly
 * that reason - one source of truth. The service worker bypasses `/models/`, so
 * there is only ever ONE on-device copy (the IDB one), never a duplicate SW-cache
 * copy - which is why this uses the model fetcher, not offline-manager's
 * downloadList (that would write an unread SW-cache bucket).
 *
 * The durable-credential encoder is MEASURED here too (durableCacheBytes /
 * durableModelCached) but downloaded by lib/trustmark-embed.ts, which must stay
 * dynamic-import-only. Its file names come from the pure lib/durable-model.ts, so
 * this module can name the same bytes without dragging ORT onto the boot path.
 */

import { createDebugLogger, createModelFetcher, type FetchProgress } from './ort.ts';
import { openDB } from '../bridge/db.ts';
import type { DownloadProgress } from './offline-manager.ts';
import {
  UPSCALE_MODEL_STORE, UPSCALE_MODEL_DIR, UPSCALE_MODEL_CACHE_VERSION, UPSCALE_MODEL_FILES,
  UPSCALE_FACE_DETECT_FILE, UPSCALE_WDN_FILE, UPSCALE_DENOISE_STAGED, stagedUpscaleModels,
} from './upscale-models.ts';
import {
  MATTE_MODEL_STORE, MATTE_MODEL_DIR, MATTE_MODEL_CACHE_VERSION, MATTE_MODEL_FILES, matteModelsFor,
} from './matte-models.ts';
import {
  OCR_MODEL_STORE, OCR_MODEL_DIR, OCR_MODEL_CACHE_VERSION, OCR_MODEL_FILES, ocrModelsFor,
} from './ocr-models.ts';
import {
  DURABLE_ENCODER_BYTES, DURABLE_ENCODER_FILE, DURABLE_MODEL_STORE,
} from './durable-model.ts';
import { isTauriShell } from './instance-choice.ts';

const upscaleFetch = createModelFetcher({
  store: UPSCALE_MODEL_STORE, dir: UPSCALE_MODEL_DIR, version: UPSCALE_MODEL_CACHE_VERSION,
  dbg: createDebugLogger({ tag: 'upscale-prefetch', storageKey: 'lolly:upscale:debug', globalFlag: '__UPSCALE_DEBUG__' }),
});
const matteFetch = createModelFetcher({
  store: MATTE_MODEL_STORE, dir: MATTE_MODEL_DIR, version: MATTE_MODEL_CACHE_VERSION,
  dbg: createDebugLogger({ tag: 'matte-prefetch', storageKey: 'lolly:matte:debug', globalFlag: '__MATTE_DEBUG__' }),
});
const ocrFetch = createModelFetcher({
  store: OCR_MODEL_STORE, dir: OCR_MODEL_DIR, version: OCR_MODEL_CACHE_VERSION,
  dbg: createDebugLogger({ tag: 'ocr-prefetch', storageKey: 'lolly:ocr:debug', globalFlag: '__OCR_DEBUG__' }),
});

export interface PrefetchResult { ok: boolean; bytes: number; files: number }
type OnProgress = (p: DownloadProgress) => void;

/** The upscale files the offline part vendors: every staged model, plus GFPGAN's
 *  small face-detector helper, plus the WDN denoise partner only when it's staged.
 *  The default (general) model is first - stagedUpscaleModels preserves roster order. */
export function upscaleOfflineFiles(): string[] {
  const files = stagedUpscaleModels().map(m => UPSCALE_MODEL_FILES[m.id]);
  files.push(UPSCALE_FACE_DETECT_FILE);
  if (UPSCALE_DENOISE_STAGED) files.push(UPSCALE_WDN_FILE);
  return files;
}

/** The matte files the offline part vendors: every model THIS shell can actually
 *  run (matteModelsFor mirrors the picker). A native-only model is withheld where it
 *  can't run - pre-downloading bytes you can't use would be dishonest. Nothing on
 *  today's roster is native-only, so web and desktop currently vendor the same two
 *  files (~30 MB), down from ~145 MB before the BiRefNet pair was removed. */
export function matteOfflineFiles(): string[] {
  return matteModelsFor(isTauriShell()).map(m => MATTE_MODEL_FILES[m.id]);
}

/** The one file the durable-credential part vendors: the TrustMark ENCODER the
 *  export toggle runs (lib/trustmark-embed.ts). A list of one, kept in this shape
 *  so it reads like the other families and a second encoder variant (P) is a
 *  one-line change. The DECODERS in the same IDB store belong to the separate
 *  "Verify deep scan" part - see offline-manager's verifyModelKeys. */
export function durableOfflineFiles(): string[] {
  return [DURABLE_ENCODER_FILE];
}

/** The OCR files the offline part vendors: every staged model's THREE files - a
 *  detector, a recogniser and its character dictionary (all needed to run). */
export function ocrOfflineFiles(): string[] {
  return ocrModelsFor(isTauriShell()).flatMap(m => {
    const f = OCR_MODEL_FILES[m.id];
    return f ? [f.det, f.rec, f.dict] : [];
  });
}

/**
 * Fetch a list of model files into one detector's IDB store, reporting a single
 * running-total bar across them (a cache hit / 404 folds its file's size in without
 * a per-chunk callback, so the bar only ever reflects observed bytes; `total` goes
 * null the moment any file never reports a Content-Length). `required` names the
 * files that must succeed for the part to count as complete - aux helpers are
 * best-effort. The fetchers take no AbortSignal (they finish a file in flight), so
 * a cancel lands between files at the latest.
 */
async function prefetchList(
  fetcher: (file: string, cacheOnly?: boolean, onProgress?: (p: FetchProgress) => void) => Promise<ArrayBuffer | null>,
  files: string[],
  required: ReadonlySet<string>,
  opts: { signal?: AbortSignal; onProgress?: OnProgress },
): Promise<PrefetchResult> {
  const { signal, onProgress } = opts;
  const count = files.length;
  // doneBytes/doneTotal accrue only on SETTLE (a file's final byteLength); during a
  // file's stream the bar shows the settled totals plus this file's live figures, so
  // it never double-counts and never jumps backwards. `unknownTotal` latches null.
  let doneBytes = 0, doneTotal = 0, unknownTotal = false, done = 0, missingRequired = 0;
  const onFile = (p: FetchProgress): void => {
    if (p.total == null) unknownTotal = true;
    onProgress?.({ loaded: doneBytes + p.loaded, total: unknownTotal ? null : doneTotal + (p.total ?? 0), done, count });
  };
  const settle = (bytes: ArrayBuffer | null, file: string): void => {
    if (bytes) { doneBytes += bytes.byteLength; doneTotal += bytes.byteLength; }
    else { unknownTotal = true; if (required.has(file)) missingRequired++; }
    done++;
    onProgress?.({ loaded: doneBytes, total: unknownTotal ? null : doneTotal, done, count });
  };
  for (const file of files) {
    signal?.throwIfAborted();
    const bytes = await fetcher(file, false, onFile).catch(() => null);
    settle(bytes, file);
  }
  signal?.throwIfAborted();
  return { ok: missingRequired === 0, bytes: doneBytes, files: done };
}

/** Pre-download every staged upscale model into the `upscale-models` IDB store.
 *  `ok` is true only when all staged MODEL files landed (the face-detector is
 *  best-effort). */
export function prefetchUpscaleModels(opts: { signal?: AbortSignal; onProgress?: OnProgress } = {}): Promise<PrefetchResult> {
  const required = new Set(stagedUpscaleModels().map(m => UPSCALE_MODEL_FILES[m.id]));
  return prefetchList(upscaleFetch, upscaleOfflineFiles(), required, opts);
}

/** Pre-download every staged matte model into the `matte-models` IDB store. */
export function prefetchMatteModels(opts: { signal?: AbortSignal; onProgress?: OnProgress } = {}): Promise<PrefetchResult> {
  const required = new Set(matteOfflineFiles());
  return prefetchList(matteFetch, matteOfflineFiles(), required, opts);
}

/** Pre-download every staged OCR model (det + rec + dict) into `ocr-models` IDB. */
export function prefetchOcrModels(opts: { signal?: AbortSignal; onProgress?: OnProgress } = {}): Promise<PrefetchResult> {
  const required = new Set(ocrOfflineFiles());
  return prefetchList(ocrFetch, ocrOfflineFiles(), required, opts);
}

// ─── Measurement (for the /profile storage-reconciliation meter) ──────────────
//
// Measures what is ACTUALLY on device in a model store - filled by this prefetch OR
// by the dialog's own on-demand download - the twin of offline-manager's
// speechCacheBytes. Reads only the KEYS (filenames, cheap) and sums the roster's
// exact declared sizes, so it never deserialises the multi-hundred-MB ArrayBuffers
// just to weigh them. An aux file with no roster entry (the tiny face detector)
// counts 0 and folds into the meter's honest "Other" remainder.
//
// `scoped` counts ONLY the keys the map names. A store with one owner counts every
// key (the default); the shared 'trustmark-models' store holds two parts' files, so
// the durable measurement scopes itself to its own encoder and leaves the deep-scan
// decoders out of its row.
async function modelStoreBytes(
  store: string, sizeByFile: Map<string, number>, scoped = false,
): Promise<{ bytes: number; files: number }> {
  try {
    const db = await openDB();
    const keys = await db.getAllKeys(store);
    let bytes = 0, files = 0;
    for (const k of keys) {
      const size = sizeByFile.get(String(k));
      if (size === undefined && scoped) continue;
      bytes += size ?? 0;
      files++;
    }
    return { bytes, files };
  } catch { return { bytes: 0, files: 0 }; }
}

/** Bytes of the staged upscale models currently cached in `upscale-models` IDB. */
export function upscaleCacheBytes(): Promise<{ bytes: number; files: number }> {
  const sizeByFile = new Map(stagedUpscaleModels().map(m => [UPSCALE_MODEL_FILES[m.id], m.approxBytes]));
  return modelStoreBytes(UPSCALE_MODEL_STORE, sizeByFile);
}

/** Bytes of the offered matte models currently cached in `matte-models` IDB
 *  (matteModelsFor mirrors matteOfflineFiles, so the meter and the download agree). */
export function matteCacheBytes(): Promise<{ bytes: number; files: number }> {
  const sizeByFile = new Map(matteModelsFor(isTauriShell()).map(m => [MATTE_MODEL_FILES[m.id], m.approxBytes]));
  return modelStoreBytes(MATTE_MODEL_STORE, sizeByFile);
}

/** Bytes of the durable-credential encoder cached in `trustmark-models` IDB. Only
 *  the encoder key is counted - the deep-scan decoders share the store and are the
 *  Verify part's bytes, not this part's. */
export function durableCacheBytes(): Promise<{ bytes: number; files: number }> {
  return modelStoreBytes(DURABLE_MODEL_STORE, new Map([[DURABLE_ENCODER_FILE, DURABLE_ENCODER_BYTES]]), true);
}

/** Is the durable encoder on this device already? Reads only the store's KEYS, so
 *  it never deserialises the ~33 MB blob just to answer - the same trick
 *  trustmark.ts's readiness marker exists for. It cannot see the cache VERSION
 *  (that lives inside the record), so a stale-version entry reads as present and
 *  the next export re-fetches it; the export gate wants "is there a route", not
 *  "are these bytes current". */
export async function durableModelCached(): Promise<boolean> {
  const { files } = await durableCacheBytes();
  return files > 0;
}

/** Bytes of the offered OCR models cached in `ocr-models` IDB. approxBytes covers a
 *  model's three files together, so it is attributed to the detector and the other
 *  two count 0 - the sum equals the roster size exactly when a whole model is present. */
export function ocrCacheBytes(): Promise<{ bytes: number; files: number }> {
  const sizeByFile = new Map<string, number>();
  for (const m of ocrModelsFor(isTauriShell())) {
    const f = OCR_MODEL_FILES[m.id];
    if (f) { sizeByFile.set(f.det, m.approxBytes); sizeByFile.set(f.rec, 0); sizeByFile.set(f.dict, 0); }
  }
  return modelStoreBytes(OCR_MODEL_STORE, sizeByFile);
}
