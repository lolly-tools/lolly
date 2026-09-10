// SPDX-License-Identifier: MPL-2.0
/**
 * "Start with" - what a blank fresh open of a tool does (plans/226). Per tool, the profile
 * holds one of:
 *
 *   absent      ask - the chooser opens when the tool has templates at all (the default)
 *   "blank"     open on the manifest defaults, no chooser
 *   <ref>       seed this template directly, no chooser (`"<toolId>:<tid>"` or `"user:<id>"`)
 *
 * It applies to the interactive blank open and the Projects quick-add only. A link that
 * carries its own intent (`?template=`, a seeded share link, a resume, an auto-export) is
 * never touched, and URL mode, the CLI and MCP always render the manifest default - the
 * tool's `default` is a contract this setting must not move. The gallery card's "+ New"
 * keeps meaning "ask me" (it sends an empty `?template=`), so the chooser stays one click
 * away however this is set; and when a chosen template stops resolving, the shell clears
 * the setting rather than opening something else.
 *
 * Stored on the user PROFILE (`profile.templateStart`), like the hidden overlays.
 */

import type { HostV1, Profile } from '@lolly-tools/core/host-v1';
import { parseTemplateRef, type TemplateRef } from './template-ref.ts';

/** `set` is optional in the type so a plain HostV1 passes; a host without it cannot persist
 *  (the write is best-effort either way). */
type ProfileHost = HostV1 & { profile: { set?(p: Profile): Promise<void> } };

export const START_BLANK = 'blank';
export type TemplateStart = typeof START_BLANK | TemplateRef;

/** The stored setting for a tool, or null for "ask". Junk reads as null. */
export function loadTemplateStart(profile: Profile | null | undefined, toolId: string): TemplateStart | null {
  const map = profile?.templateStart;
  const raw = map && typeof map === 'object' ? (map as Record<string, unknown>)[toolId] : undefined;
  if (raw === START_BLANK) return START_BLANK;
  return parseTemplateRef(raw) ? (raw as TemplateRef) : null;
}

/**
 * Set (or clear with null) a tool's "Start with", mutating the passed profile so later
 * reads see it, then persisting best-effort. A bare template id is not accepted here: the
 * caller names the full ref, so the setting stays unambiguous across tools.
 */
export async function saveTemplateStart(host: ProfileHost, profile: Profile, toolId: string, value: TemplateStart | null): Promise<void> {
  const map: Record<string, string> = { ...(profile.templateStart ?? {}) };
  if (value === null) delete map[toolId];
  else if (value === START_BLANK || parseTemplateRef(value)) map[toolId] = value;
  else return;
  if (Object.keys(map).length) profile.templateStart = map; else delete profile.templateStart;
  try { await host.profile.set?.(profile); } catch { /* storage off / quota - non-fatal */ }
}
