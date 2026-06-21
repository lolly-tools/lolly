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

// label → the gallery `category` it shows/hides. (Categories live in tool.json.)
export const CATEGORY_FLAGS = [
  { id: 'cat-everyone',  label: 'Tools for everyone', category: 'everyone' },
  { id: 'cat-designer',  label: 'Designer tools',     category: 'designer' },
  { id: 'cat-developer', label: 'Useful utilities',   category: 'utility'  },
];

export const PRO_FLAG = { id: 'pro-batch', label: 'Pro (batch) mode' };

// Order shown in the profile's Feature flags section.
export const FEATURE_FLAGS = [...CATEGORY_FLAGS, PRO_FLAG];

/** A flag is ON unless it has been explicitly turned off. */
export function flagEnabled(profile, id) {
  return profile?.featureFlags?.[id] !== false;
}

/** Set of gallery categories to hide, given the profile's current flags. */
export function hiddenCategories(profile) {
  return new Set(
    CATEGORY_FLAGS.filter(f => !flagEnabled(profile, f.id)).map(f => f.category),
  );
}
