// SPDX-License-Identifier: MPL-2.0
/**
 * The DTCG vendor-extension namespace, alone in its own module.
 *
 * One string constant does not need a file - the reason this one has it is the boot graph.
 * `design-version.ts` is reached from `bridge/assets.ts` at first paint, and it needs only
 * this name; importing it from `tokens.ts` anchored that whole cluster - `tokens.ts` plus
 * `css-color.ts`, `brand-derive.ts` and `color-faces.ts`, 115.8 KB of source and the entire
 * 12.9 KB gz `engine-util` chunk - to the render-blocking boot payload (measured 2026-08-26,
 * plans/155 WP-3). None of that colour code runs before first paint.
 *
 * This is the same trap `engine-bytes`, `engine-x509` and `engine-version` each already
 * document: a single edge from a boot module to one small export in a large one drags the
 * large one along. Two things keep the fix working, and BOTH are required - cutting one
 * edge and not the others buys nothing at all:
 *   - every boot-path importer takes `TOKEN_EXT` from HERE, not from `tokens.ts`;
 *   - `shells/web/vite.config.js` gives this file its own `advancedChunks` group, placed
 *     BEFORE the `engine-util` group, or rolldown co-locates the leaf back into the cluster
 *     and the edit is silently worthless.
 *
 * `tokens.ts` re-exports it, so callers that legitimately want the whole tokens module are
 * unaffected and there is still exactly one definition.
 */

// Vendor extension namespace for Lolly-specific token metadata (CMYK anchors,
// swatch grouping hints). Reverse-domain per the DTCG `$extensions` convention.
export const TOKEN_EXT = 'com.suse.lolly';
