// SPDX-License-Identifier: MPL-2.0
/**
 * The full Lolly tool-author contract as a single type-only entry point: the
 * `HostV1` capability bridge plus the `tool.json` manifest authoring types.
 *
 * The engine re-exports the host contract from here (so there is a single source
 * of truth for `HostV1`), and tool authors can pull everything type-level with:
 *
 *   import type { HostV1, ToolManifest } from '@lolly-tools/core/contract';
 */
export type * from './host-v1.ts';
export type * from './manifest.ts';
