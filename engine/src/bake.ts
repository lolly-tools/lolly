// SPDX-License-Identifier: MPL-2.0
/**
 * Bake — freeze a composed render into a static asset, plus the shared
 * compose recursion policy (the depth/cycle guard every shell bridge enforces).
 *
 * A baked ref is a renderUrl result made self-sufficient: its bytes ride in a
 * `data:` URL, so it resolves on every mount without a bridge call, consumes no
 * compose depth, and never live-re-renders. Provenance rides in `meta.bakedFrom`
 * (the canonical embed URL) so a shell can offer "re-bake" on demand.
 * `meta.toolUrl` is deliberately REMOVED — it is the key that drives every
 * live-edit affordance, and a baked ref must present as a plain image.
 *
 * Pure data transforms only (this module must stay DOM/network-free).
 */

import { isToolUrl } from './tool-url.ts';
import type { AssetRef } from './bridge/host-v1.ts';

/** Shared default compose nesting budget — one policy for every shell bridge. */
export const MAX_COMPOSE_DEPTH = 3;

/** Ceiling on a baked ref's data: URL length (~9MB of bytes as base64). */
export const MAX_BAKED_URL_CHARS = 12_000_000;

/** Thrown by assertComposeStack: a compose cycle or an over-deep nesting. */
export class ComposeGuardError extends Error {
  code: 'cycle' | 'depth';
  /** The offending compose path, ancestors first, the rejected tool last. */
  path: string[];
  constructor(code: 'cycle' | 'depth', path: string[], message: string) {
    super(message);
    this.name = 'ComposeGuardError';
    this.code = code;
    this.path = path;
  }
}

/**
 * The engine-owned compose recursion guard. Bridges call this before rendering
 * a child (`stack` = tool ids already on the compose path, `toolId` = the tool
 * about to render) so cycle/depth policy can never drift between shells.
 * Throws ComposeGuardError; passing is a no-op.
 */
export function assertComposeStack(
  stack: readonly string[],
  toolId: string,
  maxDepth = MAX_COMPOSE_DEPTH,
): void {
  const path = [...stack, toolId];
  if (stack.includes(toolId)) {
    throw new ComposeGuardError('cycle', path, `cycle ${path.join(' → ')}`);
  }
  if (stack.length >= maxDepth) {
    throw new ComposeGuardError('depth', path, `max depth ${maxDepth} (${path.join(' → ')})`);
  }
}

/** True when `v` is a baked asset ref (an object whose meta.baked === true). */
export function isBakedRef(v: unknown): boolean {
  if (!v || typeof v !== 'object') return false;
  const meta = (v as { meta?: unknown }).meta;
  return !!meta && typeof meta === 'object' && (meta as { baked?: unknown }).baked === true;
}

// Typed throw helper — bake failures carry a machine-readable `code` so callers
// can branch (offer "render smaller" on TOO_LARGE, "render first" on the other).
function bakeError(code: 'BAKE_NOT_SELF_CONTAINED' | 'BAKE_TOO_LARGE', message: string): never {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  throw err;
}

/**
 * Freeze a renderUrl result into a baked ref (pure transform — the render has
 * already happened; this only rewrites identity + meta):
 *   - id becomes 'baked/<base36 ms>' — NOT a tool URL, so the runtime's
 *     re-resolve path can never mistake it for a live embed;
 *   - meta gains { baked, bakedAt, bakedFrom? } and LOSES toolUrl plus any
 *     blob:-valued entry (posterUrl/animationUrl — blob: dies across sessions);
 *   - bakedFrom = meta.toolUrl when present, else the ref's own id when that is
 *     a tool URL, else omitted (re-bake unavailable, the bytes still stand).
 * Requires a self-contained `data:` URL under MAX_BAKED_URL_CHARS; throws an
 * Error with code 'BAKE_NOT_SELF_CONTAINED' / 'BAKE_TOO_LARGE' otherwise.
 */
export function bakeAssetRef(ref: AssetRef, opts: { now?: number } = {}): AssetRef {
  if (typeof ref?.url !== 'string' || !ref.url.startsWith('data:')) {
    bakeError('BAKE_NOT_SELF_CONTAINED', `bake: asset url must be a data: URL (got ${String(ref?.url).slice(0, 32)}…)`);
  }
  if (ref.url.length > MAX_BAKED_URL_CHARS) {
    bakeError('BAKE_TOO_LARGE', `bake: data: URL is ${ref.url.length} chars (max ${MAX_BAKED_URL_CHARS})`);
  }

  const now = opts.now ?? Date.now();
  const source = ref.meta ?? {};
  const bakedFrom = typeof source.toolUrl === 'string' ? source.toolUrl
    : isToolUrl(ref.id) ? ref.id
      : undefined;

  const meta: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(source)) {
    if (k === 'toolUrl') continue;                          // the live-edit key — baked refs are inert
    if (typeof v === 'string' && v.startsWith('blob:')) continue; // session-scoped bytes, dead on reload
    meta[k] = v;
  }
  meta.baked = true;
  meta.bakedAt = now;
  if (bakedFrom !== undefined) meta.bakedFrom = bakedFrom;

  return { ...ref, source: 'remote', id: `baked/${now.toString(36)}`, meta };
}
