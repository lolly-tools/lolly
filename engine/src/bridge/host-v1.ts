// SPDX-License-Identifier: MPL-2.0
/**
 * Capability Bridge — v1 (re-export).
 *
 * The canonical definition of the v1 contract now lives in the tool-author SDK,
 * `@lolly-tools/core`, so third parties can build tools against the exact same
 * interface WITHOUT depending on the engine. This module just forwards the
 * types. Single source of truth: packages/core/src/host-v1.ts.
 *
 * Engine modules keep importing `HostV1` (and its sub-types) from this path, so
 * the engine has one internal spelling for the contract. The shells and services
 * import `@lolly-tools/core/host-v1` directly instead, so following an import
 * lands on the documented contract rather than on this forwarder. Both spellings
 * resolve to the same declarations; the imports are type-only either way, so
 * nothing reaches a bundle.
 *
 * RULES (unchanged):
 * - Methods may be ADDED in a minor version. Never removed or signature-changed
 *   without a major version bump; when v2 ships, v1 must keep working.
 * - No platform-specific methods on the bridge — capability-gate them via
 *   tool.json `capabilities` instead, and expose a stub/error where unfulfillable.
 */
export type * from '@lolly-tools/core/host-v1';
