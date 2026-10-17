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
import { describeIgnoredTokenChoice, withTokenSelection, type IgnoredTokenChoice } from '@lolly/engine';
import type { HostV1 } from '@lolly-tools/core/host-v1';
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

/** Two selections name the same choices, whatever their key order. */
function sameSelection(a: Record<string, string> | undefined, b: Record<string, string> | undefined): boolean {
  const ka = Object.keys(a ?? {}), kb = Object.keys(b ?? {});
  return ka.length === kb.length && ka.every((key) => b?.[key] === a?.[key]);
}

/**
 * The host the canvas variables (`--brand-*`) are painted from. The CLI bridge is
 * scoped to the link's `_themes`; when the runtime holds another selection (a tool's
 * `tokenAxes` pinned a group), the canvas follows the runtime, as the web shell's
 * does, so a template's `var(--brand-primary)` and a hook's token read agree.
 */
export function canvasTokenHost(host: HostV1, runtimeSelection: Record<string, string> | undefined, bridgeSelection: Record<string, string> | undefined): HostV1 {
  return runtimeSelection && !sameSelection(runtimeSelection, bridgeSelection) ? withTokenSelection(host, runtimeSelection) : host;
}
