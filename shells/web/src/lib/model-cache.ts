// SPDX-License-Identifier: MPL-2.0
// What is on this device in a model store, measured without loading the model runtime.
// lib/model-prefetch.ts (which pulls in ONNX Runtime) re-exports these; the export
// panel's durable-credential probe imports this module directly, so opening a tool no
// longer downloads the model runtime just to ask whether one IndexedDB key exists.
import { openDB } from '../bridge/db.ts';
import { modelStoredFileName } from './model-manifest.ts';
import { DURABLE_ENCODER_BYTES, DURABLE_ENCODER_FILE, DURABLE_MODEL_STORE } from './durable-model.ts';

// Measures what is ACTUALLY on device in a model store - filled by a prefetch OR
// by a dialog's own on-demand download - the twin of offline-manager's
// speechCacheBytes. Reads only the KEYS (filenames, cheap) and sums the roster's
// exact declared sizes, so it never deserialises the multi-hundred-MB ArrayBuffers
// just to weigh them. An aux file with no roster entry (the tiny face detector)
// counts 0 and folds into the meter's honest "Other" remainder.
//
// `scoped` counts ONLY the keys the map gives. A store with one owner counts every
// key (the default); the shared 'trustmark-models' store holds two parts' files, so
// the durable measurement scopes itself to its own encoder and leaves the deep-scan
// decoders out of its row.
export async function modelStoreBytes(
  store: string, sizeByFile: Map<string, number>, scoped = false,
): Promise<{ bytes: number; files: number }> {
  try {
    const db = await openDB();
    const keys = await db.getAllKeys(store);
    let bytes = 0, files = 0;
    for (const k of keys) {
      const size = sizeByFile.get(modelStoredFileName(String(k)));
      if (size === undefined && scoped) continue;
      bytes += size ?? 0;
      files++;
    }
    return { bytes, files };
  } catch { return { bytes: 0, files: 0 }; }
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
