// SPDX-License-Identifier: MPL-2.0
/**
 * export-policy - a tiny, generic policy for what a tool may offer at export time.
 *
 * The third sibling alongside lib/field-policy.ts (profile fields) and
 * lib/input-policy.ts (tool inputs): where those govern how a control renders, this
 * governs the export/download AFFORDANCE. A neutral seam the tool view consults when
 * building its download control: may the caller download the result, must they route
 * it through an approval instead, or is output withheld entirely?
 *
 * It is a single slot, EMPTY (undefined) by default, so `getExportPolicy` returns
 * `undefined` and the export control renders exactly as it does today - this
 * primitive is dormant until a setter runs. `exportAffordance(undefined)` is
 * `'download'`, so the dormant path is byte-identical to a build without this module.
 *
 * Like its siblings, it knows nothing about WHERE a policy comes from: a deployment's
 * optional org-config module populates it (see src/org/), but the registry is a
 * standalone primitive with no dependency on that - a test or a future feature can
 * drive it just the same. It carries no product vocabulary and needs no i18n; any
 * user-facing copy is supplied by whoever consults it.
 */

export interface ExportPolicy {
  /** May the caller download/export the result directly (today's behaviour). */
  canDownload: boolean;
  /** May the caller instead file an approval request for the result. */
  canRequestApproval: boolean;
  /** The approval chain bound to a tool's outputs, or `undefined` when none is - 
   *  i.e. this tool's output isn't gated on this instance. */
  approvalChainFor(toolId: string): string | undefined;
  /** The export formats policy binds a tool to, or `undefined` when the tool is
   *  unrestricted. Cooperative narrowing, exactly like a choice input's allow
   *  list: the view intersects it with the tool's own declared formats and never
   *  renders an empty control from it. */
  formatsFor(toolId: string): string[] | undefined;
}

/** The plain data a host supplies to describe the policy (the setter builds the
 *  ExportPolicy - including its `approvalChainFor` lookup - from this). */
export interface ExportPolicySpec {
  canDownload: boolean;
  canRequestApproval: boolean;
  /** toolId → approval chain id bound to that tool's outputs. */
  chains?: Record<string, string>;
  /** toolId → the format subset that tool may export (absent = unrestricted). */
  formats?: Record<string, string[]>;
}

/** Which export affordance a policy resolves to. Dormant/`canDownload` → the
 *  ordinary download; withheld-but-requestable → an approval request; withheld
 *  with no request path → blocked (the view shows a note, not a dead button). */
export type ExportAffordance = 'download' | 'request-approval' | 'blocked';

let current: ExportPolicy | undefined;

/**
 * The active export policy, or `undefined` when dormant (the default - the export
 * control then behaves exactly as with no policy layer at all).
 */
export function getExportPolicy(): ExportPolicy | undefined {
  return current;
}

/**
 * Install (or, with `undefined`, clear) the export policy. Clearing restores the
 * dormant default. A whole-slot swap keeps the source of truth authoritative.
 */
export function setExportPolicy(spec: ExportPolicySpec | undefined): void {
  if (!spec) { current = undefined; return; }
  const chains = spec.chains ?? {};
  const formats = spec.formats ?? {};
  current = {
    canDownload: spec.canDownload,
    canRequestApproval: spec.canRequestApproval,
    approvalChainFor: (toolId: string) => chains[toolId],
    formatsFor: (toolId: string) => formats[toolId],
  };
}

/**
 * The affordance a policy resolves to. Pure - the single place the download-vs-
 * request-vs-blocked decision lives, so the view and its tests agree. `undefined`
 * (dormant) and `canDownload` both mean the ordinary download.
 */
export function exportAffordance(policy: ExportPolicy | undefined): ExportAffordance {
  if (!policy || policy.canDownload) return 'download';
  if (policy.canRequestApproval) return 'request-approval';
  return 'blocked';
}

/** TEST-ONLY convenience: clear the policy back to its dormant default. */
export function _clearExportPolicyForTests(): void {
  current = undefined;
}
