// SPDX-License-Identifier: MPL-2.0
/** Bakes one photo look off the main thread (plan 291 W7). One request per worker. */
import { bakePhotoLookInRealm, type PhotoLookBakeRequest } from './photo-look-raster.ts';

const scope = globalThis;
scope.onmessage = async ({ data }: MessageEvent<PhotoLookBakeRequest>) => {
  try {
    const blob = await bakePhotoLookInRealm(data);
    scope.postMessage({ ok: true, blob }, { transfer: [] });
  } catch (error) {
    scope.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) }, { transfer: [] });
  }
};
