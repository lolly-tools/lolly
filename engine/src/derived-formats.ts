// SPDX-License-Identifier: MPL-2.0
/**
 * Derived export formats — the ones that are a trivial, lossless transform of a
 * format a tool already declares, so a tool that can emit the parent can emit the
 * child for free. Rather than hand-list them in all 68 `tool.json` manifests (and
 * keep 68 copies in sync), they are expanded ONCE here, at load time, so both shells'
 * export menus and the CLI's format gate agree on what a tool really offers.
 *
 *   svg  → svgz   gzip of the SVG bytes (engine/src/gzip.ts) — same markup, ~60-70% smaller
 *   emf  → wmf    the 16-bit Windows metafile off the SAME svgDomToIr vector IR as EMF
 *   png  → bmp    uncompressed Windows Bitmap off the same raster (either raster parent…)
 *   tiff → bmp    …is enough — both are lossless rasters the bitmap encoder can take
 *
 * Deliberately NOT expanded in the generated `catalog/tools/index.json` (the source of
 * the catalog CARD chips): these are convert-convenience targets, not headline formats
 * to advertise on every card, and expanding the index would churn every per-brand
 * index.json for no user-facing gain. The loaded manifest — what the export menu and the
 * CLI gate read — is the single place the expansion is applied.
 *
 * Pure, order-stable, idempotent: each child is appended once (if a parent is present
 * and the child is not already listed), never duplicated, and expanding an
 * already-expanded list is a no-op.
 */

/** [parent, child] pairs. A child appears once its first present parent is seen. */
const DERIVED: ReadonlyArray<readonly [string, string]> = [
  ['svg', 'svgz'],
  ['emf', 'wmf'],
  ['png', 'bmp'],
  ['tiff', 'bmp'],
];

/**
 * Return `formats` with any derivable child format appended. The input is not
 * mutated; the returned array preserves the original order and adds children at the
 * end in {@link DERIVED} order. Case-sensitive on the lower-case format ids the rest
 * of the engine uses.
 */
export function expandDerivedFormats(formats: readonly string[]): string[] {
  const out = [...formats];
  for (const [parent, child] of DERIVED) {
    if (out.includes(parent) && !out.includes(child)) out.push(child);
  }
  return out;
}
