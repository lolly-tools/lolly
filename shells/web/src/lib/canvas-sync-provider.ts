// SPDX-License-Identifier: MPL-2.0
/**
 * canvas-sync-provider - a generic registry for an EXTERNAL collaboration
 * transport for the live canvas.
 *
 * The sibling of session-source.ts (see its header for the pattern this
 * mirrors): a neutral seam the canvas presenter consults to sync ops beyond
 * this device. It is EMPTY by default, so `getCanvasSyncProvider()` returns
 * undefined and the canvas renders exactly as today - single-player, no
 * network, no server. This repo (`lolly`) ships no server, no socket, and no
 * persistence for collaboration (plans/99-canvas-op-contract.md section 1.1) - this
 * file is the dormant door for that, nothing more.
 *
 * It knows nothing about WHO registers a provider: a deployment's optional
 * control plane would register a Yjs-backed adapter so a team's edits sync
 * live (see src/org/ - lolly-work's collaboration layer, plans/14 there), but
 * the registry is a standalone primitive, same as session-source. A single
 * provider at a time (last registration wins), mirroring every other optional-
 * provider seam in this codebase.
 *
 * The registered value is a `CanvasSyncAdapter` (packages/core/src/canvas-op-v1.ts)
 * - the contract type both this shell and lolly-work's Yjs adapter compile
 * against without either depending on the other or on yjs. This file imports
 * only that type: no yjs, no network, no DOM concern beyond the interface
 * shape.
 *
 * FOLLOW-UP (deferred, not this task): nothing registers here yet.
 * `src/org/index.ts`'s member branch is where a real adapter would be wired in,
 * exactly like `registerSessionSource` is wired there today - but lolly-work
 * has no adapter to inject via the rail yet, so wiring the call site now would
 * be dead code with no registrant. Until then this seam is inert and behaviour
 * is byte-identical to single-player (plans/99 section 1.1).
 */

import type { CanvasSyncAdapter } from '@lolly-tools/core/canvas-op-v1';

let current: CanvasSyncAdapter | undefined;

/** Register the external canvas sync adapter; returns an unregister fn (last-wins). */
export function registerCanvasSyncProvider(adapter: CanvasSyncAdapter): () => void {
  current = adapter;
  return () => { if (current === adapter) current = undefined; };
}

/** The registered adapter, or undefined when dormant (no control plane). */
export function getCanvasSyncProvider(): CanvasSyncAdapter | undefined {
  return current;
}

/** TEST-ONLY: clear the registry back to its dormant default. */
export function _clearCanvasSyncProviderForTests(): void {
  current = undefined;
}
