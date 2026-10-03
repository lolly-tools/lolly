// SPDX-License-Identifier: MPL-2.0
/**
 * profile-sections - a generic registry of extra cards for the profile view's
 * instance section.
 *
 * A neutral seam, like lib/share-sections.ts, so views/profile/ stays unaware of any
 * particular feature: the view calls mountProfileSections() on the section body, and
 * each registered builder may add its own card there. The registry is EMPTY by
 * default, so the profile view is unchanged until something registers.
 *
 * It knows nothing about who registers. A deployment's optional control plane (src/org/)
 * registers the signed-in member's "Linked sign-ins" card; a test can drive it the
 * same way.
 */

/** Adds a card to `into`, or nothing. Errors stay inside the builder that threw. */
export type ProfileSectionBuilder = (into: HTMLElement) => void;

const builders: ProfileSectionBuilder[] = [];

/** Register a builder; returns an unregister function. */
export function registerProfileSection(builder: ProfileSectionBuilder): () => void {
  builders.push(builder);
  return () => {
    const i = builders.indexOf(builder);
    if (i >= 0) builders.splice(i, 1);
  };
}

/** Run every registered builder on `into`, in registration order. */
export function mountProfileSections(into: HTMLElement): void {
  for (const build of builders.slice()) {
    try { build(into); } catch (e) { console.error(e); }
  }
}

/** TEST-ONLY: empty the registry back to its dormant default. */
export function _clearProfileSectionsForTests(): void {
  builders.length = 0;
}
