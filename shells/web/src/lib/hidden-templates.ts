// SPDX-License-Identifier: MPL-2.0
/**
 * Hidden templates - the person's "hide this shipped starter" overlay, the template twin
 * of lib/hidden-tools.ts (plans/226). A shipped template is a file in the synced catalog,
 * so hiding is the only honest removal a client can do: the tile leaves the chooser, the
 * gallery's About dialog and the Projects Templates collection, sits behind a
 * "Hidden (N)" reveal with a Restore action, and `?template=` deep links, MCP and the CLI
 * keep working. A template the person saved is never hidden - it is deleted
 * (lib/user-templates.ts).
 *
 * Stored on the user PROFILE (`profile.hiddenTemplates`) as refs `"<toolId>:<tid>"`, with
 * the same seeding rule as hidden tools: the brand's `defaultHiddenTemplates` (catalog
 * asset index) merge in until the first edit, then the stored set is authoritative so an
 * un-hide sticks.
 */

import type { HostV1, Profile } from '@lolly-tools/core/host-v1';
import { parseTemplateRef, shippedTemplateRef } from './template-ref.ts';

/** `set` is optional in the type so a plain HostV1 passes; a host without it cannot persist
 *  (the write is best-effort either way). */
type ProfileHost = HostV1 & { profile: { set?(p: Profile): Promise<void> } };

const isShippedRef = (x: unknown): x is string => parseTemplateRef(x)?.kind === 'shipped';

/**
 * The hidden template refs for a profile. Until the profile is seeded, the brand's shipped
 * `defaults` are merged in; after the first edit the stored set is authoritative. Junk and
 * user refs are dropped - only a shipped template can be hidden.
 */
export function loadHiddenTemplates(profile: Profile | null | undefined, defaults: readonly string[] = []): Set<string> {
  const list = profile?.hiddenTemplates;
  const stored = Array.isArray(list) ? list.filter(isShippedRef) : [];
  const seed = defaults.filter(isShippedRef);
  return profile?.hiddenTemplatesSeeded ? new Set(stored) : new Set([...seed, ...stored]);
}

/** Is this shipped template hidden? */
export function isTemplateHidden(hidden: ReadonlySet<string>, toolId: string, tid: string): boolean {
  return hidden.has(shippedTemplateRef(toolId, tid));
}

/**
 * Write the hidden set back onto the profile and persist it, mutating the passed profile
 * (the cached instance host.profile.get() returned) so later reads see the change. Flags
 * the profile seeded, exactly as saveHiddenTools does, so the defaults never re-merge.
 * Best-effort: a failed write means the hide does not survive a reload.
 */
export async function saveHiddenTemplates(host: ProfileHost, profile: Profile, hidden: ReadonlySet<string>): Promise<void> {
  profile.hiddenTemplates = [...hidden].filter(isShippedRef);
  profile.hiddenTemplatesSeeded = true;
  try { await host.profile.set?.(profile); } catch { /* storage off / quota - non-fatal */ }
}
