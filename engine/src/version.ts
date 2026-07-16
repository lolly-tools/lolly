// SPDX-License-Identifier: MPL-2.0
/**
 * The engine's HostV1 contract version.
 *
 * Lives in its own module (not index.ts) so the loader can import it to enforce
 * a tool's `engineVersion` range WITHOUT creating an index ↔ loader import
 * cycle. index.ts re-exports it, so every external consumer (`@lolly/engine`,
 * the shells, services, scripts) keeps importing `ENGINE_VERSION` from the
 * barrel unchanged. The changelog for each minor lives above the re-export in
 * index.ts — the public surface — not here.
 *
 * This is the *contract* version (what HostV1 level the engine implements), and
 * is DELIBERATELY decoupled from the product/release version. Do not collapse
 * them.
 */
export const ENGINE_VERSION = '1.56.0';
