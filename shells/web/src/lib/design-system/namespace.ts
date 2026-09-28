// SPDX-License-Identifier: MPL-2.0
/**
 * namespace.ts - moving an asset id between design-system namespaces, and the
 * references to it with it (plans/186 sections 3.2 and 3.6).
 *
 * The id grammar itself is the engine's (engine/src/design-system.ts): which
 * system an id belongs to, and the prefix a system mints under. This module is
 * the handful of prefix swaps built on it that more than one writer needs: the
 * brand pack re-keys a portable `user/logo/…` into the system it is imported
 * into and back out again on export, and the logo ownership pass gives a system
 * its own copy of a logo another system's namespace holds. One reading of the
 * swap for both, so an id is never written under a prefix the engine would not read
 * back as the same material.
 *
 * DOM-free and pure: no asset IO, no registry.
 */
import { designMaterialOf, designSystemNamespace } from '../../../../../engine/src/design-system.ts';
import { FROZEN_PREFIX } from '../../bridge/version-assets-contract.ts';

/** The legacy namespace: the migrated default system's, and the shape every
 *  brand pack is written in, whichever system it came from. */
export const LEGACY_NS = 'user/';

/** How one asset id is renamed. Returns the id unchanged when it stays put. */
export type Rekey = (id: string) => string;

/** A legacy id in `ns`. Frozen bytes are content-keyed and SHARED between
 *  systems, so they are never re-keyed (plans/186 section 3.2). */
export function nsId(ns: string, id: string): string {
  if (id.startsWith(FROZEN_PREFIX) || !id.startsWith(LEGACY_NS)) return id;
  return ns + id.slice(LEGACY_NS.length);
}

/** The reverse: one system's id back to the portable legacy shape, so a pack
 *  exported from `user/ds/acme/` re-imports into whatever namespace it goes to. */
export function legacyId(ns: string, id: string): string {
  if (!ns || ns === LEGACY_NS || !id.startsWith(ns)) return id;
  return LEGACY_NS + id.slice(ns.length);
}

/**
 * The same piece of design material, addressed in the system `systemId`: a
 * logo at `user/logo/icon` becomes `user/ds/acme/logo/icon` for `acme`, and
 * `user/ds/beta/logo/icon` becomes `user/logo/icon` for `default`.
 *
 * Null for anything that is not a user system's design material (a personal
 * upload, a frozen row, a catalog id): those have no home in a namespace, so
 * there is nothing to move. Null too for the shipped system, which mints nothing.
 */
export function rehomeMaterialId(id: string, systemId: string): string | null {
  const material = designMaterialOf(id);
  if (!material) return null;
  const from = designSystemNamespace(material.systemId);
  const to = designSystemNamespace(systemId);
  if (!from || !to || !id.startsWith(from)) return null;
  return to + id.slice(from.length);
}

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * A tokens document with every renamed asset id rewritten under `$value`.
 *
 * Walked generically rather than at the known paths: the logo tokens live at
 * `asset.logo.*` today, but a themed document nests them under a set name and
 * nothing stops a system from putting an asset ref somewhere else entirely. A
 * `$value` the rekey leaves alone is written back as it was, so the walk cannot
 * invent a reference. The version list under `$extensions` records each pin
 * under `id`, never `$value`, so a published version's record is not touched.
 */
export function rewriteAssetRefs(node: unknown, rekey: Rekey): unknown {
  const remap = (v: unknown): unknown =>
    typeof v === 'string' ? rekey(v)
      : Array.isArray(v) ? v.map(remap)
        : v;
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk);
    if (!isRec(value)) return value;
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) out[key] = key === '$value' ? remap(v) : walk(v);
    return out;
  };
  return walk(node);
}
