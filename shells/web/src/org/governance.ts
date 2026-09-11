// SPDX-License-Identifier: MPL-2.0
/**
 * The one-function read `feature-flags.ts` needs from the optional control plane,
 * behind a registry so asking the question does not load the answer.
 *
 * `org/index.ts` is 47 KB of control-plane code (probe, session, gate,
 * policies, injectables, banner) that a deployment without a control plane -
 * which is every public one - never runs. But `orgFlagGovernance` is consulted
 * SYNCHRONOUSLY while resolving a flag, so feature-flags.ts imported that whole
 * module for it, and feature-flags.ts is first-paint work: one static edge put
 * ~5.4 KB gz of dormant code on the render-blocking preload set of every visit
 * (plans/155 WP-3, the same shape as the send-targets/nextcloud lesson).
 *
 * So the resolver is REGISTERED rather than imported. With no control plane
 * nothing ever registers and every read answers `null` - which is the same
 * answer org/index.ts gave when its `orgConfigState` was null, so dormancy is
 * byte-identical, not merely equivalent. `org/index.ts` registers itself at
 * module scope, so it governs from the moment it loads, however it was reached.
 */

/** What a control plane may say about one flag; null = it has no opinion. */
export type FlagGovernance = { default?: boolean; hidden?: boolean } | null;

let resolver: ((id: string) => FlagGovernance) | null = null;

/** Install the control plane's governance read (org/index.ts, at module scope).
 *  Last-wins, and `null` restores dormancy - which is what tests reset to. */
export function setOrgGovernanceResolver(fn: ((id: string) => FlagGovernance) | null): void {
  resolver = fn;
}

/** Control-plane governance for one feature flag, or null when no control plane
 *  is present or it has no opinion on this flag. */
export function orgFlagGovernance(id: string): FlagGovernance {
  return resolver ? resolver(id) : null;
}
