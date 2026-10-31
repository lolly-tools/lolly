// SPDX-License-Identifier: MPL-2.0
/**
 * The person's own colourway, per design system (plans/331).
 *
 * Inside one brand, a department or a product often has a colourway of its own.
 * Settings > Appearance lets a person take one as theirs: it leads the app's
 * chrome on this device, and each new piece of work starts in that colourway. Work already
 * made keeps the colourway it stores, and so does a link or a session that names
 * one, because a document never changes colour after it is made (plans/319).
 *
 * Stored on the profile, the canonical store for every preference, as
 * `colourways`: design-system id to colourway id, so a person who works in two
 * design systems keeps a choice in each. Only a choice other than the design
 * system's canonical colourway is stored. Choosing the canonical one removes the
 * entry, so "the design system's own" means following the design system, and a
 * profile that never chose stays exactly as it was.
 *
 * Not declared on the SDK's `Profile`: no portable host reads it (the CLI, MCP and
 * TUI have no personal choice), and the web record already carries the theme the
 * same way. There is no localStorage mirror either. The pre-paint script restores
 * the chrome sheet last painted, which already carries this colourway, and the
 * painter reads the profile before it paints. The web profile bridge keeps the
 * record in memory, so that read costs nothing on a repaint.
 *
 * A stored id that the design system no longer offers is not an error. Every
 * reader checks the id against the design system in force and falls back to the
 * canonical colourway without a word.
 *
 * No engine imports: the chrome painter (brand-vars.ts) imports this on the boot path.
 */

/** The profile field the choices live in. */
export const COLOURWAYS_FIELD = 'colourways';

/** A design-system id, as engine/src/design-system.ts writes them (48 characters at most). */
const SYSTEM_ID = /^[a-z0-9][a-z0-9-]{0,47}$/;
/** Longer than any theme id a design system writes. */
const MAX_OPTION_LENGTH = 128;
/** More design systems than any person keeps, so a damaged record cannot grow without bound. */
const MAX_SYSTEMS = 64;

/** A theme option id as a design system may write it: `id`, else the theme's name, so an
 *  imported file's ids can hold spaces. Any short, trimmed, non-empty string. */
function isOptionId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_OPTION_LENGTH && value.trim() === value;
}

/** The host slice this module reads: the profile record, and which design system is active. */
export interface ColourwayPrefHost {
  profile?: {
    get(): Promise<object>;
    set?(profile: object): Promise<unknown>;
  };
  tokens?: {
    active?(): Promise<{ id: string } | null>;
  };
}

/** The choices on a stored profile value, keyed by design system. Total: junk reads as absent. */
export function readColourwayChoices(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  let kept = 0;
  for (const [system, option] of Object.entries(value)) {
    if (kept >= MAX_SYSTEMS) break;
    if (!SYSTEM_ID.test(system) || !isOptionId(option)) continue;
    out[system] = option;
    kept += 1;
  }
  return out;
}

/** The id of the design system in force, or null when the host names none. */
export async function activeSystemId(host: ColourwayPrefHost): Promise<string | null> {
  try {
    const id = (await host.tokens?.active?.())?.id;
    return typeof id === 'string' && SYSTEM_ID.test(id) ? id : null;
  } catch { return null; }
}

/**
 * The colourway the person chose for a design system (the active one when no id
 * is given), or null when they chose none. The id is not checked against the
 * design system here: each reader checks it against the document it draws from.
 */
export async function personalColourway(host: ColourwayPrefHost, systemId?: string | null): Promise<string | null> {
  if (!host.profile) return null;
  const system = systemId === undefined ? await activeSystemId(host) : systemId;
  if (!system) return null;
  try {
    const profile = await host.profile.get() as Record<string, unknown>;
    return readColourwayChoices(profile?.[COLOURWAYS_FIELD])[system] ?? null;
  } catch { return null; }
}

/**
 * Save the colourway for one design system, or clear it with null (the person
 * chose the design system's own). Best effort, like every other preference: a
 * failed write never blocks the work, and the caller has already repainted.
 */
export async function setPersonalColourway(host: ColourwayPrefHost, systemId: string, option: string | null): Promise<void> {
  if (!host.profile?.set || !SYSTEM_ID.test(systemId)) return;
  if (option !== null && !isOptionId(option)) return;
  try {
    const profile = await host.profile.get() as Record<string, unknown>;
    const choices = readColourwayChoices(profile?.[COLOURWAYS_FIELD]);
    if (option === null) delete choices[systemId];
    else choices[systemId] = option;
    const next: Record<string, unknown> = { ...profile };
    if (Object.keys(choices).length) next[COLOURWAYS_FIELD] = choices;
    else delete next[COLOURWAYS_FIELD];
    await host.profile.set(next);
  } catch { /* a preference save is best effort */ }
}
