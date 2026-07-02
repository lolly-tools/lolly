// SPDX-License-Identifier: MPL-2.0
/**
 * Feature flags — local, per-user toggles that tailor the gallery.
 *
 * Stored on the profile (`profile.featureFlags`, keyed by flag id) so they ride
 * the normal profile persistence and sync. Every flag defaults to ON when unset.
 *
 * Two kinds:
 *  - CATEGORY_FLAGS hide a tool-category section from the gallery (nothing else).
 *  - PRO_FLAG hides the "Batch" link in the gallery footer (the /pro route itself
 *    still works via a deep link).
 */

import type { Profile } from '@lolly/engine';

export interface FeatureFlag {
  id: string;
  label: string;
  /** The gallery `category` this flag shows/hides (category flags only). */
  category?: string;
  /** Small badge shown beside the label in the profile view. */
  pill?: string;
}

// label → the gallery `category` it shows/hides. (Categories live in tool.json.)
export const CATEGORY_FLAGS: readonly FeatureFlag[] = [
  { id: 'cat-everyone',  label: 'Tools for Everyone', category: 'everyone' },
  { id: 'cat-designer',  label: 'Designer Tools',     category: 'designer' },
  { id: 'cat-event',     label: 'Event Kit',          category: 'event'    },
  // id stays 'cat-developer' (a persisted key); only the user-facing label changed.
  { id: 'cat-developer', label: 'Offline Utilities',  category: 'utility'  },
];

export const PRO_FLAG: FeatureFlag = { id: 'pro-batch', label: 'Pro', pill: 'batch mode' };

// Order shown in the profile's Feature flags section.
export const FEATURE_FLAGS: readonly FeatureFlag[] = [...CATEGORY_FLAGS, PRO_FLAG];

/** A flag is ON unless it has been explicitly turned off. */
export function flagEnabled(profile: Profile | null | undefined, id: string): boolean {
  return profile?.featureFlags?.[id] !== false;
}

/** Set of gallery categories to hide, given the profile's current flags. */
export function hiddenCategories(profile: Profile | null | undefined): Set<string> {
  return new Set(
    CATEGORY_FLAGS.filter(f => !flagEnabled(profile, f.id)).map(f => f.category ?? ''),
  );
}
