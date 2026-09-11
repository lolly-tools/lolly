// SPDX-License-Identifier: MPL-2.0
/**
 * input-policy - a generic per-input display-policy registry for the tool sidebar.
 *
 * The sibling of lib/field-policy.ts, one level up: where field-policy governs the
 * profile form's fixed fields, this governs a tool's declared inputs. A neutral
 * seam the sidebar renderer consults when building an input control: should this
 * input render as usual, be locked to a read-only value, be hidden entirely, or
 * have its choices narrowed to an allowed set?
 *
 * Keyed by (toolId, inputId) - a tool's inputs are namespaced by the tool, and the
 * registry mirrors that so a policy for one tool can never bleed into another. It
 * is EMPTY by default, so `getInputPolicy` returns `undefined` and the sidebar
 * renders exactly as it does today; this primitive is dormant until a setter runs.
 *
 * Like field-policy, it knows nothing about WHERE a policy comes from: a
 * deployment's optional org-config module populates it (see src/org/), but the
 * registry is a standalone primitive with no dependency on that. The human-readable
 * `note` arrives already localised from whoever sets the policy, so this file needs
 * no i18n and no product vocabulary.
 *
 * This is a RENDERING overlay only. The engine input model stays the single source
 * of truth - nothing here mutates it; the sidebar reads a policy alongside the
 * model and adjusts how it presents the control.
 */

/** How the sidebar should present an input. */
export type InputMode = 'locked' | 'hidden' | 'choice';

export interface InputPolicy {
  mode: InputMode;
  /** A short, already-localised note for a locked/choice input (e.g. "Managed by Acme"). */
  note?: string;
  /** The policy source's display name - WHICH rule did this, in the words of
   *  whoever wrote it. Data, not a sentence: the sidebar composes and localises
   *  the line it shows. Absent means "no attribution available", and the control
   *  then renders exactly as it did before this field existed. */
  by?: string;
  /** The policy author's free-text reason, when they wrote one. Shown with `by`;
   *  meaningless on its own, so a policy carrying a reason and no `by` attributes
   *  nothing. */
  reason?: string;
  /** For a locked input, the value the sidebar should display (and keep) instead of
   *  the model's stored value. Also carried on a `choice` for a pre-selected value. */
  value?: unknown;
  /** For a `choice` input, the option values a select-like control is restricted to. */
  allow?: readonly string[];
}

// toolId → (inputId → policy).
const registry = new Map<string, Map<string, InputPolicy>>();

/** A global fail-closed overlay: when set, every input that has no explicit policy of
 *  its own is treated as this (a locked read-only) policy - the more restrictive state.
 *  Off (null) by default, so the dormant path is untouched. Its purpose is a governed
 *  instance whose live policy is momentarily unknown and un-cached: the host installs
 *  it so gated inputs never fall open to editable while policy can't be confirmed. It
 *  is orthogonal to the per-tool registry and is NOT cleared by clearInputPolicies - 
 *  only its own setter (or the test reset) lifts it. */
let failClosed: InputPolicy | null = null;

/**
 * The policy for one input of one tool, or `undefined` when none is registered (the
 * default - the sidebar then behaves exactly as with no policy layer). An explicit
 * per-tool policy always wins; otherwise the global fail-closed overlay applies when
 * one is set, else `undefined`. The dormant common case (empty registry, no overlay)
 * still returns `undefined` with no per-input cost.
 */
export function getInputPolicy(toolId: string | undefined, inputId: string): InputPolicy | undefined {
  if (!toolId) return undefined;
  const explicit = registry.size ? registry.get(toolId)?.get(inputId) : undefined;
  return explicit ?? failClosed ?? undefined;
}

/**
 * Install (or, with `null`, lift) the global fail-closed overlay. When set, every input
 * without an explicit policy reads as the supplied (locked) policy. The note is supplied
 * already localised by the host, so this file stays product-neutral. Separate from the
 * per-tool registry: clearInputPolicies / setToolInputPolicies never touch it.
 */
export function setInputPolicyFailClosed(policy: InputPolicy | null): void {
  failClosed = policy;
}

/**
 * Replace ONE tool's entire input-policy set. An empty (or omitted) map removes that
 * tool's policies, restoring its dormant default. A whole-set swap keeps the source
 * of truth authoritative: an input dropped from a fresh set is unlocked again, never
 * left stale.
 */
export function setToolInputPolicies(toolId: string, policies: Record<string, InputPolicy> = {}): void {
  const entries = Object.entries(policies);
  if (!entries.length) { registry.delete(toolId); return; }
  registry.set(toolId, new Map(entries));
}

/** Clear every tool's policies, restoring the dormant default. */
export function clearInputPolicies(): void {
  registry.clear();
}

/** TEST-ONLY convenience: empty the registry (and lift any fail-closed overlay) back
 *  to the dormant default. */
export function _clearInputPoliciesForTests(): void {
  registry.clear();
  failClosed = null;
}
