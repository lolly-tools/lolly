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
import type { ToolIntegrityOpts } from '../../../../engine/src/loader.ts';
import { instanceFetch, instancePath } from '../lib/instance.ts';
import type { CatalogSnapshot } from './snapshot.ts';
import { CatalogRefusedError, isAccessRefused, noteCatalogRefused } from '../lib/catalog-access.ts';

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

let cached: Promise<{ snapshot: CatalogSnapshot; integrity: ToolIntegrityOpts } | null> | null = null;
export const catalogVerificationAvailable = (): boolean => catalogVerificationRequired() && !!globalThis.crypto?.subtle;

/** Whether catalog reads need signature verification, without fetching the envelope. */
export const catalogVerificationRequired = (): boolean => TRUST_MODE === 'verified';

/** The engine verifier, loaded on first use. Only ever reached past a `PINNED_KEY`
 *  guard, so an unsigned build never fetches the chunk at all. */
const crypto = () => import('../../../../engine/src/catalog-integrity.ts');

async function load(): Promise<{ snapshot: CatalogSnapshot; integrity: ToolIntegrityOpts } | null> {
  if (TRUST_MODE === 'unsigned-dev') {
    markUnsignedDevelopmentBuild();
    return null;
  }
  if (!globalThis.crypto?.subtle) {
    markUncheckedCatalog();
    return null;
  }
  const publicKey = await (await crypto()).importSpkiOrJwkPublicKey(PINNED_KEY);
  const [{ fetchSignedCatalogSnapshot }, { readAcceptedCatalog, readLatestAcceptedCatalog, acceptCatalogSnapshot }] = await Promise.all([
    import('./snapshot.ts'), import('./trust-store.ts'),
  ]);
  const origin = new URL(instancePath('/catalog/tools/index.sig.json'), globalThis.location?.href ?? 'http://localhost/').origin;
  const snapshot = await fetchSignedCatalogSnapshot({
    publicKey,
    fetch: async (path, init) => {
      const resp = await instanceFetch(instancePath(path), init);
      if (isAccessRefused(resp.status)) {
        noteCatalogRefused();
        throw new CatalogRefusedError(resp.status, path);
      }
      return resp;
    },
    read: scope => readAcceptedCatalog(origin, scope),
    latest: () => readLatestAcceptedCatalog(origin),
    accept: (scope, pair) => acceptCatalogSnapshot(origin, scope, pair),
  });
  markAcceptedCatalog(snapshot);
  return { snapshot, integrity: { envelope: snapshot.envelope, publicKey } };
}

/** Recovery clears the refusal badge only after a complete authenticated pair. */
function markAcceptedCatalog(snapshot: CatalogSnapshot): void {
  if (typeof document === 'undefined' || !document.body) return;
  document.getElementById('lolly-catalog-refused')?.remove();
  document.getElementById('lolly-unchecked-catalog')?.remove();
  document.documentElement.dataset.catalogTrust = snapshot.assetText === undefined ? 'partially-verified' : snapshot.offline ? 'verified-offline' : 'verified';
  if (snapshot.assetText === undefined) trustBadge('lolly-catalog-state', 'Asset catalog integrity unchecked');
  else if (snapshot.offline) trustBadge('lolly-catalog-state', 'Offline · verified saved catalog');
  else document.getElementById('lolly-catalog-state')?.remove();
}

/** A compact status follows the loaded shell theme without shifting its layout. */
function trustBadge(id: string, message: string, alert = false): void {
  if (typeof document === 'undefined' || !document.body) return;
  let badge = document.getElementById(id);
  if (!badge) {
    badge = document.createElement('div');
    badge.id = id;
    badge.style.cssText = [
      'position:fixed', 'right:calc(12px + var(--safe-right, 0px))', 'bottom:calc(12px + var(--safe-bottom, 0px))',
      'z-index:2147483647', 'max-width:calc(100vw - 24px)', 'padding:6px 12px',
      'border-radius:var(--radius-pill, 999px)', 'border:1px solid hsl(var(--border, 210 15% 50%))',
      'background:hsl(var(--popover, 210 20% 12%))', 'color:hsl(var(--popover-foreground, 0 0% 100%))',
      'font:500 12px/1.4 var(--font-brand, system-ui)', 'overflow-wrap:anywhere', 'pointer-events:none',
    ].join(';');
    document.body.appendChild(badge);
  }
  badge.setAttribute('role', alert ? 'alert' : 'status');
  badge.textContent = message;
}

/** Plain HTTP LAN hosts remain usable, with an explicit integrity state. */
function markUncheckedCatalog(): void {
  if (typeof document === 'undefined' || !document.body) return;
  document.documentElement.dataset.catalogTrust = 'unchecked';
  trustBadge('lolly-unchecked-catalog', 'Catalog integrity unchecked on this connection');
}

/** Make an unsigned production preview impossible to mistake for a release.
 * The dev server is already visibly a developer surface, so the persistent
 * badge is reserved for built/previewed artifacts. */
function markUnsignedDevelopmentBuild(): void {
  if (!import.meta.env?.PROD || typeof document === 'undefined' || !document.body) return;
  document.documentElement.dataset.catalogTrust = 'unsigned-dev';
  trustBadge('lolly-unsigned-catalog', 'Unsigned development catalog');
}

/**
 * The signed envelope + imported public key for loadTool's `integrity` opts,
 * or null when no key is pinned (the unsigned/compat path). Cached; a failed
 * fetch clears the cache so the next sync retries instead of pinning failure.
 */
function catalogLoad(refresh = false): Promise<{ snapshot: CatalogSnapshot; integrity: ToolIntegrityOpts } | null> {
  if (refresh) cached = null;
  if (!cached) cached = load().catch((error: unknown) => { cached = null; throw error; });
  return cached;
}

export async function getToolIntegrity(): Promise<ToolIntegrityOpts | null> {
  return (await catalogLoad())?.integrity ?? null;
}

/** Sync refreshes the envelope; a cached tool load can reuse the accepted pair. */
export async function getCatalogSnapshot(refresh = false): Promise<CatalogSnapshot | null> {
  return (await catalogLoad(refresh))?.snapshot ?? null;
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

/** A trust failure remains visible even when a previously accepted catalog is saved. */
export function noteCatalogIntegrityFailure(error: unknown): void {
  if (typeof document === 'undefined' || !document.body) return;
  document.documentElement.dataset.catalogTrust = 'refused';
  document.getElementById('lolly-catalog-state')?.remove();
  trustBadge('lolly-catalog-refused', error instanceof Error ? error.message : 'The catalog could not be verified.', true);
}
