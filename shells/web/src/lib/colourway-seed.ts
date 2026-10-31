// SPDX-License-Identifier: MPL-2.0
/**
 * New work starts in the person's colourway (plans/331).
 *
 * The colourway a person took as theirs in Settings > Appearance
 * (lib/colourway-pref.ts) is where each new piece of work starts. The tool view
 * asks here once, before the runtime is made, and only for new work: a link
 * that carries a document, a saved session, a collaboration and a scripted
 * render all keep what they name, and when they name nothing they draw the
 * design system's canonical colourway as before.
 *
 * What comes back is a resolved choice, `{ colourway: "midnight" }`, never a
 * rule. The tool view stores it like any other theme choice: the runtime holds
 * it, the session saves it and the address carries it as `_themes`. So the piece
 * keeps its colourway when the person later chooses another, or when the design
 * system changes its canonical one (the binding rule of plans/319).
 */
import type { ToolTokenAxes } from '@lolly-tools/core';
import { colourwayAxis, withColourway } from '../../../../engine/src/colourway.ts';
import { personalColourway, type ColourwayPrefHost } from './colourway-pref.ts';

/**
 * The theme selection that starts a new piece in `choice`, or undefined when there
 * is nothing to start: the design system has no colourway group, the group does not
 * offer that colourway any more, or the tool's manifest ignores colourways
 * (`tokenAxes`), in which case its canvas keeps the canonical colourway.
 */
export function colourwaySeed(
  doc: unknown,
  choice: string | null | undefined,
  tokenAxes?: ToolTokenAxes | null,
): Record<string, string> | undefined {
  if (!choice || tokenAxes?.colourway === 'ignore') return undefined;
  const axis = colourwayAxis(doc);
  if (!axis || axis.options.length < 2 || !axis.options.some((option) => option.id === choice)) return undefined;
  return withColourway(undefined, { group: axis.group, option: choice });
}

/** The host slice the seed reads: the person's choice and the document it is checked against. */
export interface ColourwaySeedHost extends ColourwayPrefHost {
  tokens?: ColourwayPrefHost['tokens'] & {
    snapshot?(): Promise<{ document: unknown }>;
  };
}

/**
 * The selection a new piece of this tool starts with, read from the person's choice
 * for the active design system and checked against that system's document. Never
 * throws: a host without tokens or a profile starts the piece as before.
 */
export async function newWorkTokenSelection(
  host: ColourwaySeedHost,
  tokenAxes?: ToolTokenAxes | null,
): Promise<Record<string, string> | undefined> {
  if (tokenAxes?.colourway === 'ignore') return undefined;
  try {
    const choice = await personalColourway(host);
    if (!choice) return undefined;
    const snapshot = await host.tokens?.snapshot?.();
    return colourwaySeed(snapshot?.document, choice, tokenAxes);
  } catch { return undefined; }
}
