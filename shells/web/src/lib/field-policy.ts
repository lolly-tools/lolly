// SPDX-License-Identifier: MPL-2.0
/**
 * field-policy - a tiny, generic per-field display-policy registry.
 *
 * A neutral seam any view can consult when rendering a form field: is this
 * field editable as usual, locked to a read-only value, or hidden entirely?
 * The registry is EMPTY by default, so `getFieldPolicy` returns `undefined` and
 * every consulting view renders exactly as it does today - this primitive is
 * dormant until something calls a setter.
 *
 * It intentionally knows nothing about WHERE a policy comes from: a deployment's
 * optional org-config module populates it (see src/org/), but the registry is a
 * standalone primitive with no dependency on that - a test, a future feature, or
 * a different host can drive it just the same. The human-readable `note` is
 * supplied by whoever sets the policy (already localised), so this file needs no
 * i18n and no product vocabulary.
 */

/** How a consulting view should present a field. */
export type FieldMode = 'editable' | 'locked' | 'hidden';

export interface FieldPolicy {
  mode: FieldMode;
  /** A short, already-localised note for a locked field (e.g. "Managed by Acme"). */
  note?: string;
  /** When set on a locked field, the value the view should display (and keep)
   *  instead of the user's stored value. */
  value?: unknown;
}

const registry = new Map<string, FieldPolicy>();

/**
 * The policy for a field, or `undefined` when none is registered (the default - 
 * the view then behaves exactly as it would with no policy layer at all).
 */
export function getFieldPolicy(fieldId: string): FieldPolicy | undefined {
  return registry.get(fieldId);
}

/** Set (or, with `undefined`, remove) one field's policy. */
export function setFieldPolicy(fieldId: string, policy: FieldPolicy | undefined): void {
  if (policy) registry.set(fieldId, policy);
  else registry.delete(fieldId);
}

/**
 * Replace the ENTIRE registry with the given map (host-side setter). Passing an
 * empty map - or omitting it - clears every policy, restoring the dormant
 * default. A whole-registry swap keeps the source of truth authoritative: a
 * field dropped from a fresh policy set is unlocked again, never left stale.
 */
export function setFieldPolicies(policies: Record<string, FieldPolicy> = {}): void {
  registry.clear();
  for (const [id, policy] of Object.entries(policies)) registry.set(id, policy);
}

/** TEST-ONLY convenience: empty the registry back to its dormant default. */
export function _clearFieldPoliciesForTests(): void {
  registry.clear();
}
