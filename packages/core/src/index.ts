// SPDX-License-Identifier: MPL-2.0
/**
 * @lolly-tools/core — the Lolly tool-author contract.
 *
 * Depend on this package to build a Lolly tool without cloning the platform:
 *   - Types: the `HostV1` capability bridge + the `tool.json` manifest shape.
 *   - validateTool(): validate a manifest against the authoritative JSON Schema.
 *   - createMockHost(): an in-memory HostV1 to unit-test your hooks headlessly.
 *   - defineTool() / defineHooks(): identity helpers for type-checked authoring.
 *
 * See README.md for the quickstart and examples/ for a complete tool.
 */
export type * from './contract.ts';

/** The canonical `FinishKind` spellings, as a value: the ONE list. `FinishKind`
 *  is derived from it, and `engine/src/preflight.ts` builds its recognised-finish
 *  set from it, so the open union and the check that reports an unrecognised
 *  spelling cannot drift apart. */
export { KNOWN_FINISH_KINDS } from './host-v1.ts';

export { validateTool } from './validate.ts';
export type { ValidationIssue, ValidationResult } from './validate.ts';

export { createMockHost } from './mock-host.ts';
export type {
  MockHost,
  MockHostInspection,
  CreateMockHostOpts,
  ExportCall,
  LogLine,
} from './mock-host.ts';

export type {
  Severity, UnknownReason, Fact, QuantityKind, QuantityUnit, Bound, Count,
  FindingId, Evidence, Finding, PreflightReport,
  ReportedDimension, ReportedSize, ReportedSettings, ReportedJob,
} from './preflight.ts';
export {
  SEVERITY_RANK, knownFact, unknownFact, PREFLIGHT_FORMAT, PREFLIGHT_FORMAT_VERSION,
} from './preflight.ts';

// Money — the currency-formatting helper and the serialised money-bearing artifact
// shape. A SIBLING of the preflight vocabulary (never inside `PreflightReport`),
// so a report can never carry a number that reads as a quote. There is no default
// currency and no fallback symbol anywhere in it. See `plans/preflight-and-cost.md`
// §6, and the header of `money.ts`.
export {
  formatMoney, formatFigure, monetaryFigure, minorUnitExponent,
  CurrencyError, MinorUnitError, COST_DISCLAIMER, COST_MEMBER,
} from './money.ts';
export type {
  MoneyInput, MonetaryFigure, SerializedCost, CostRatesFrom,
  SerializedWorkingRow, SerializedAdjustmentRow, SerializedUncostedLine,
} from './money.ts';

// money-policy — the pure decide-money-or-counts predicate. Keyed on per-selection
// provenance (own session vs reached-via-link), NOT on any URL param: the whole
// design keeps card identity and money out of URL space. See `money-policy.ts`.
export { canShowMoney } from './money-policy.ts';
export type { MoneyContext } from './money-policy.ts';

export { defineTool, defineHooks } from './define-tool.ts';
export type {
  HookContext,
  HookModelItem,
  HookResult,
  ToolHooks,
  ExportHookContext,
  ExportFileResult,
} from './define-tool.ts';

/** The `HostV1` contract version this SDK targets (matches `HostV1.version`). */
export const CONTRACT_VERSION = '1';
