// SPDX-License-Identifier: MPL-2.0
/**
 * A theme choice the tool ignored (plans/319 A4, manifest `tokenAxes`).
 *
 * A tool whose colours are its content can declare `"tokenAxes": { "colourway":
 * "ignore" }`, and then renders in the canonical colourway whatever `--_themes`
 * (or a colourway named by `--themes`) asks for. The runtime makes that decision
 * and keeps what it overrode in `runtime.ignoredTokenChoices`; this file turns
 * each into a warning, so the run says the choice was not applied instead of
 * writing a file in a colour nobody asked for without a word. Under `--strict`
 * it fails the run like every other usage warning.
 *
 * The sentence comes from the engine (`describeIgnoredTokenChoice`), the same one
 * the MCP render notes use.
 */
import { describeIgnoredTokenChoice, type IgnoredTokenChoice } from '@lolly/engine';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { followRuntimeSelection } from './bridge.ts';
import { warn } from './output.ts';

/** The warning code a machine reader keys on. */
export const THEME_CHOICE_IGNORED = 'THEME_CHOICE_IGNORED';

/** Warn once per ignored choice. Returns how many were reported. */
export function reportIgnoredThemeChoices(
  runtime: { readonly ignoredTokenChoices?: readonly IgnoredTokenChoice[] },
  toolName: string,
): number {
  const choices = runtime.ignoredTokenChoices ?? [];
  for (const choice of choices) {
    warn(THEME_CHOICE_IGNORED, describeIgnoredTokenChoice(choice, toolName), 'usage', {
      group: choice.group, kind: choice.kind, requested: choice.requested, applied: choice.canonical,
    });
  }
  return choices.length;
}

/**
 * What every `lolly run` does once its runtime is mounted: the bridge follows the
 * selection the runtime applied (bridge.ts `followRuntimeSelection`), so the canvas
 * variables, the export's CMYK palette and every other read after the mount draw the
 * option the tool renders in, and each requested choice the tool ignored is reported.
 * Returns how many were reported.
 */
export function settleThemeChoices(
  host: HostV1,
  runtime: { readonly tokenSelection?: Record<string, string>; readonly ignoredTokenChoices?: readonly IgnoredTokenChoice[] },
  linkSelection: Record<string, string> | undefined,
  toolName: string,
): number {
  followRuntimeSelection(host, runtime.tokenSelection, linkSelection);
  return reportIgnoredThemeChoices(runtime, toolName);
}
