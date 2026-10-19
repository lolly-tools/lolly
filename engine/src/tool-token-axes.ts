// SPDX-License-Identifier: MPL-2.0
/**
 * A tool's opt-out from a kind of theme group (plans/319, manifest `tokenAxes`).
 *
 * Some tools draw colours that are their content: a tonal ramp, a palette pinned
 * to a dataset, a print piece that is always light. Such a tool declares
 *
 *   "tokenAxes": { "colourway": "ignore" }
 *
 * and every group of that kind resolves to its canonical option for this tool,
 * whatever a link (`_themes`), a saved session (`__tokenSelection`) or the design
 * system's own stored choice asks for. The runtime applies the pin when it mounts
 * and on every `setTokenSelection`, the web shell hides the group's control, and
 * the CLI and MCP report a requested choice the pin overrode.
 *
 * Which groups count as a kind: every group that declares the kind. For `mode`, the
 * ungrouped `''` group counts as well when no group declares `mode` and the `''`
 * group declares no other kind, the same rule `modeAxis` in token-axes.ts reads
 * light and dark by.
 *
 * Pure and bounded: nothing here reads a host, a clock or the DOM, and the inputs
 * are the resolver's own `TokenSelection`, so the web shell, the runtime and the
 * CLI all make the same decision from the same facts.
 */
import type { TokenAxisKind, TokenSelection } from './bridge/host-v1.ts';
import type { ToolTokenAxes } from '@lolly-tools/core';

export type { ToolTokenAxes };

/** One group a tool's `tokenAxes` pins, and the option it is pinned to. */
export interface IgnoredTokenAxis {
  group: string;
  kind: TokenAxisKind;
  canonical: string;
}

/** A requested choice that a tool's `tokenAxes` overrode. */
export interface IgnoredTokenChoice extends IgnoredTokenAxis {
  /** The option the link, session or caller asked for. */
  requested: string;
}

type Groups = readonly TokenSelection['groups'][number][];

/** True when the manifest map names at least one kind to ignore. */
export function ignoresTokenAxes(tokenAxes: ToolTokenAxes | null | undefined): tokenAxes is ToolTokenAxes {
  return !!tokenAxes && Object.values(tokenAxes).some((behaviour) => behaviour === 'ignore');
}

/**
 * The kind each group is treated as: its declared kind, or `mode` for the
 * ungrouped light and dark group when no group declares `mode` (see the module
 * comment). A group with neither is `null`.
 */
export function effectiveAxisKinds(groups: Groups): Map<string, TokenAxisKind | null> {
  const declaredMode = groups.some((group) => group.kind === 'mode');
  const kinds = new Map<string, TokenAxisKind | null>();
  for (const group of groups) {
    kinds.set(group.id, group.kind ?? (!declaredMode && group.id === '' ? 'mode' : null));
  }
  return kinds;
}

/** Every group of a kind the tool ignores, with the canonical option it renders in. */
export function ignoredTokenAxes(groups: Groups, tokenAxes: ToolTokenAxes | null | undefined): IgnoredTokenAxis[] {
  if (!ignoresTokenAxes(tokenAxes)) return [];
  const kinds = effectiveAxisKinds(groups);
  const out: IgnoredTokenAxis[] = [];
  for (const group of groups) {
    const kind = kinds.get(group.id);
    if (!kind || tokenAxes[kind] !== 'ignore' || !group.options.length) continue;
    const canonical = group.canonical && group.options.some((o) => o.id === group.canonical) ? group.canonical : group.options[0]!.id;
    out.push({ group: group.id, kind, canonical });
  }
  return out;
}

export interface PinnedTokenSelection {
  /**
   * The selection to apply. `requested` itself when nothing needed pinning (so a
   * tool with no colourway in play keeps the address and session it had), else
   * every group's choice in force with the ignored groups set to canonical. The
   * result is explicit because a given selection replaces the document's stored
   * choices whole: a partial pin would drop the stored mode.
   */
  selection: Record<string, string> | undefined;
  /** The requested choices the pin overrode, for a shell to report. */
  ignored: IgnoredTokenChoice[];
}

/**
 * Apply a tool's `tokenAxes` to a requested selection.
 *
 * `resolved` is what the resolver made of `requested` against the design system
 * (`resolveTokenSelection(doc, { selection: requested })`, or a host's
 * `inspect().selection`): its `choices` say which option each group is drawn in
 * now, including the design system's stored choice when `requested` names none.
 */
export function pinIgnoredTokenAxes(
  requested: Readonly<Record<string, string>> | undefined,
  resolved: Pick<TokenSelection, 'groups' | 'choices'>,
  tokenAxes: ToolTokenAxes | null | undefined,
): PinnedTokenSelection {
  const axes = ignoredTokenAxes(resolved.groups, tokenAxes);
  const keep = requested && Object.keys(requested).length ? { ...requested } : undefined;
  if (!axes.length) return { selection: keep, ignored: [] };
  const ignored: IgnoredTokenChoice[] = [];
  let needsPin = false;
  for (const axis of axes) {
    const asked = requested && Object.hasOwn(requested, axis.group) ? requested[axis.group] : undefined;
    // An option the group does not declare is the resolver's own diagnostic
    // ("Unknown choice"), not a choice this tool overrode.
    const declared = resolved.groups.find((g) => g.id === axis.group)?.options.some((o) => o.id === asked) ?? false;
    if (asked !== undefined && asked !== axis.canonical && declared) ignored.push({ ...axis, requested: asked });
    if (resolved.choices[axis.group] !== axis.canonical) needsPin = true;
  }
  if (!needsPin) return { selection: keep, ignored };
  const selection: Record<string, string> = { ...resolved.choices };
  for (const axis of axes) selection[axis.group] = axis.canonical;
  return { selection, ignored };
}

/** The group's id in a message, when the kind alone does not already name the group. */
const groupWords = (choice: IgnoredTokenAxis): string =>
  choice.group === '' ? '' : choice.group === choice.kind ? '' : ` (theme group ${choice.group})`;

/**
 * One sentence for a choice a tool ignored, shared by the CLI warning and the MCP
 * render notes so both say the same thing.
 */
export function describeIgnoredTokenChoice(choice: IgnoredTokenChoice, toolName: string): string {
  return `${toolName} ignores the ${choice.kind}${groupWords(choice)}, so ${choice.requested} was not applied. It renders in ${choice.canonical}, the canonical option.`;
}
