// SPDX-License-Identifier: MPL-2.0
/**
 * Base URL for the on-device ONNX model files (matte / upscale / trustmark).
 *
 * Default is '' (same-origin: files load from `/models/<dir>/<file>`, the vendored
 * copy vite ships in dist). Set VITE_MODELS_BASE at build time to any external base
 * URL to serve them from there instead, so the ~0.7 GB of model bytes are dropped
 * from the deploy upload (.vercelignore) and fetched on demand / pre-downloaded into
 * IndexedDB from the provider. Provider-agnostic on purpose: it is just a URL, so an
 * S3-compatible bucket, a cluster object store (MinIO on RKE2), or a static host all
 * work, and an internal (non-Vercel) deploy can leave it unset and self-serve
 * /models/ exactly like today. The trailing slash is stripped so callers append
 * `/models/...` uniformly.
 *
 * Speech and transformer workers use this base too, with remote Hub access
 * disabled. model-manifest.ts selects physical hashed directories; old aliases
 * are only reused after their bytes match the required model's full hash.
 *
 * When this is external, CSP connect-src must include the host (see vercel.json), and
 * the deploy MUST pass the same VITE_MODELS_BASE the .vercelignore exclusion assumes.
 */
/** A self-hosted install can move the base without a rebuild. A build made with
 *  VITE_MODELS_BASE_PROBE=/models-base.txt asks its own origin once, at startup, for
 *  that file. An empty 200 body means "this server", an https origin names another
 *  host, and anything else (404, the app shell's HTML, a network error) keeps the
 *  build-time value. Model files keep their size and sha256 checks either way. */
export function parseModelsBaseOverride(body: string): string | undefined {
  const value = body.trim().replace(/\/+$/, '');
  if (value === '') return '';
  return /^https:\/\/([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+(:\d{1,5})?$/.test(value) ? value : undefined;
}

function probeModelsBase(path: string): string | undefined {
  try {
    const origin = globalThis.location?.origin;
    if (typeof XMLHttpRequest === 'undefined' || !origin || origin === 'null') return undefined;
    // Synchronous on purpose: workers evaluate this module at import and several
    // read the base at top level, so there is no later moment to apply a result.
    const request = new XMLHttpRequest();
    request.open('GET', origin + path, false);
    request.send();
    return request.status === 200 ? parseModelsBaseOverride(request.responseText) : undefined;
  } catch { return undefined; }
}

const BUILT_BASE: string = (import.meta.env?.VITE_MODELS_BASE ?? '').replace(/\/+$/, '');
const PROBE_PATH: string = import.meta.env?.VITE_MODELS_BASE_PROBE ?? '';
export const MODELS_BASE: string = PROBE_PATH.startsWith('/') ? (probeModelsBase(PROBE_PATH) ?? BUILT_BASE) : BUILT_BASE;
