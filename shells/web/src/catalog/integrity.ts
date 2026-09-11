// SPDX-License-Identifier: MPL-2.0
/**
 * Catalog integrity - web wiring for engine/src/catalog-integrity.ts.
 *
 * UNSIGNED DEVELOPMENT BY DEFAULT: everything here no-ops unless the build pins a catalog
 * public key via the VITE_CATALOG_PUBLIC_KEY_JWK env var (a P-256 public JWK
 * JSON string - printed by `node scripts/sign-catalog.ts --gen-key`). No key
 * ships in this repo; pinning one is a per-deployment decision, made where the
 * catalog is actually signed (sign-catalog.ts writes /catalog/tools/index.sig.json).
 *
 * When a key IS pinned, this fails CLOSED: a missing/unfetchable envelope or an
 * index.json that doesn't match its signed hash throws, and the signed envelope
 * + imported key are exposed (getToolIntegrity) for loadTool call sites to pass
 * as `integrity` opts so per-tool-file digests are enforced before hooks run.
 */

// The verifier itself is DYNAMICALLY imported (see `crypto()` below), not because
// it is slow but because it is inert: with no key pinned neither function is ever
// called, yet a static edge from here put engine/src/catalog-integrity.ts - and,
// through its pemToDer import, x509.ts + der-read.ts - on the web shell's boot
// chunk set. This module is reached at boot (bridge/tool-loader.ts, catalog/sync.ts),
// so the import has to be the lazy one. Both public functions below are already
// async, so the await is invisible to callers.
import type { CatalogSignatureEnvelope } from '../../../../engine/src/catalog-integrity.ts';
import type { ToolIntegrityOpts } from '../../../../engine/src/loader.ts';
import { instanceFetch, instancePath } from '../lib/instance.ts';

declare global {
  // Merge the optional pin into vite-env.d.ts's minimal ImportMetaEnv - Vite
  // only exposes VITE_-prefixed vars, and this one is unset by default.
  interface ImportMetaEnv {
    readonly VITE_CATALOG_PUBLIC_KEY_JWK?: string;
    readonly VITE_CATALOG_TRUST_MODE?: 'verified' | 'unsigned-dev';
  }
}

// Optional-chained on `env`, not just the var: under plain Node (the test
// runner imports this module via tool-loader.ts → picker.ts) `import.meta.env`
// itself is undefined and the bare read throws at module scope, killing every
// test file whose import graph touches the picker. Vite statically replaces
// `import.meta.env.VITE_*` either way, so the built app still gets the pin.
const PINNED_KEY: string = import.meta.env?.VITE_CATALOG_PUBLIC_KEY_JWK ?? '';
const TRUST_MODE = import.meta.env?.VITE_CATALOG_TRUST_MODE ?? (PINNED_KEY ? 'verified' : 'unsigned-dev');

if (TRUST_MODE !== 'verified' && TRUST_MODE !== 'unsigned-dev') {
  throw new Error(`catalog integrity: unsupported trust mode "${String(TRUST_MODE)}"`);
}
if (TRUST_MODE === 'verified' && !PINNED_KEY) {
  throw new Error('catalog integrity: verified mode has no pinned public key');
}
if (TRUST_MODE === 'unsigned-dev' && PINNED_KEY) {
  throw new Error('catalog integrity: unsigned-dev mode must not carry a catalog public key');
}

let cached: Promise<ToolIntegrityOpts | null> | null = null;

/** The engine verifier, loaded on first use. Only ever reached past a `PINNED_KEY`
 *  guard, so an unsigned build never fetches the chunk at all. */
const crypto = () => import('../../../../engine/src/catalog-integrity.ts');

async function load(): Promise<ToolIntegrityOpts | null> {
  if (TRUST_MODE === 'unsigned-dev') {
    markUnsignedDevelopmentBuild();
    return null;
  }
  const publicKey = await (await crypto()).importSpkiOrJwkPublicKey(PINNED_KEY);
  // Bypasses the service worker's /tools cache by construction (it's under
  // /catalog, which sw.js deliberately never caches; a remote-instance fetch is
  // cross-origin, which the SW ignores entirely) - the envelope is always as
  // fresh as the index it binds. Fetched through the instance base so a
  // key-pinned build verifies the REMOTE index against the remote's envelope:
  // an instance signed by a different key fails closed, as it must.
  const resp = await instanceFetch(instancePath('/catalog/tools/index.sig.json'));
  if (!resp.ok) {
    throw new Error(`catalog integrity: signature envelope missing (HTTP ${resp.status}) but a key is pinned`);
  }
  const envelope = await resp.json() as CatalogSignatureEnvelope;
  return { envelope, publicKey };
}

/** Make an unsigned production preview impossible to mistake for a release.
 * The dev server is already visibly a developer surface, so the persistent
 * badge is reserved for built/previewed artifacts. */
function markUnsignedDevelopmentBuild(): void {
  if (!import.meta.env?.PROD || typeof document === 'undefined' || !document.body) return;
  document.documentElement.dataset.catalogTrust = 'unsigned-dev';
  if (document.getElementById('lolly-unsigned-catalog')) return;
  const badge = document.createElement('div');
  badge.id = 'lolly-unsigned-catalog';
  badge.setAttribute('role', 'status');
  badge.textContent = 'Unsigned development catalog';
  badge.style.cssText = [
    'position:fixed', 'right:12px', 'bottom:12px', 'z-index:2147483647',
    'padding:6px 10px', 'border-radius:999px', 'pointer-events:none',
    'font:600 12px/1.2 system-ui,sans-serif', 'color:#fff',
    'background:#8b1e1e', 'box-shadow:0 1px 4px rgba(0,0,0,.35)',
  ].join(';');
  document.body.appendChild(badge);
}

/**
 * The signed envelope + imported public key for loadTool's `integrity` opts,
 * or null when no key is pinned (the unsigned/compat path). Cached; a failed
 * fetch clears the cache so the next sync retries instead of pinning failure.
 */
export function getToolIntegrity(): Promise<ToolIntegrityOpts | null> {
  if (!cached) {
    cached = load().catch((e: unknown) => {
      cached = null;
      throw e;
    });
  }
  return cached;
}

/**
 * Verify freshly-fetched /catalog/tools/index.json bytes against the pinned
 * signed envelope. Resolves silently when no key is pinned; throws on ANY
 * mismatch when one is - the caller treats it as a failed sync (fail closed).
 */
export async function assertToolIndexIntegrity(indexText: string): Promise<void> {
  const integrity = await getToolIntegrity();
  if (!integrity) return;
  const result = await (await crypto()).verifyCatalogEnvelope(
    integrity.envelope,
    new TextEncoder().encode(indexText),
    integrity.publicKey,
  );
  if (!result.ok) {
    throw new Error(`catalog integrity: tool index rejected - ${result.reason}`);
  }
}
