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
