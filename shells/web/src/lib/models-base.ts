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
 * NOT the speech models: kokoro/whisper stay same-origin by design (the
 * `env.localModelPath = '/models/'` privacy pin in the speech workers, asserted by
 * speech-kokoro-privacy.test.ts). Only the createModelFetcher-sourced detectors move.
 *
 * When this is external, CSP connect-src must include the host (see vercel.json), and
 * the deploy MUST pass the same VITE_MODELS_BASE the .vercelignore exclusion assumes.
 */
export const MODELS_BASE: string = (import.meta.env?.VITE_MODELS_BASE ?? '').replace(/\/+$/, '');
