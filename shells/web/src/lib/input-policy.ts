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
  /** Set only by the document layer ({@link setDocumentReadOnly}): the person may look
   *  but not change the document, so the control renders read-only and READABLE
   *  (lib/input-readonly.ts) instead of inert, and the lock is not a governed one:
   *  it never narrows a server-bound request or rewrites a model value. */
  readable?: boolean;
}

/** Non-select controls cannot express a restricted set of choices. */
export function policyLocksControl(control: string, policy: InputPolicy | undefined): boolean {
  return policy?.mode === 'locked' || (policy?.mode === 'choice' && control !== 'select');
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

// ── Document layer ───────────────────────────────────────────────────────────
// A whole document opened read-only (a viewer of a team project): every input of the
// tool is locked, readably. Its own layer, keyed by tool, because the registry above
// is a whole-set replace that a policy source clears on every mount and every
// re-apply (clearInputPolicies, then setToolInputPolicies per tool): a viewer lock
// kept there would vanish on the next org-config re-read, or drop the governed locks.
// Only its own setters change it; whoever sets it releases it when the mount ends.
const documentLayer = new Map<string, InputPolicy>();
/** Who set each tool's document layer wants to hear when an edit is refused. */
const refusedHandlers = new Map<string, () => void>();

/** Lock every input of `toolId` read-only for the document on screen. `note` is
 *  already localised ("View only"). A governed lock or a hidden input still wins.
 *  `onRefused` runs each time {@link refuseDocumentEdit} turns an edit away, so the
 *  setter can say why (and offer what the person can do instead). */
export function setDocumentReadOnly(toolId: string, note: string, onRefused?: () => void): void {
  if (!toolId) return;
  documentLayer.set(toolId, { mode: 'locked', note, readable: true });
  if (onRefused) refusedHandlers.set(toolId, onRefused);
  else refusedHandlers.delete(toolId);
}

/** Lift the document layer for `toolId`. Idempotent. */
export function clearDocumentReadOnly(toolId: string): void {
  documentLayer.delete(toolId);
  refusedHandlers.delete(toolId);
}

/**
 * Whether a person's edit of `toolId`'s document must be turned away: true while the
 * document layer holds the tool, after telling whoever set the layer. The read-only
 * controls are the visible half; this is the other half, asked where every editor's
 * writes arrive (the mounted tool's undo-recording `setInput`, views/tool/setup.ts),
 * so the Design inspector, top bar and stage, the canvas popovers and every other
 * surface that writes without consulting {@link getInputPolicy} refuse the same way.
 * An undo replay and a live collab's remote changes never ask. The instance's refusal
 * of a viewer's save stays the boundary; this keeps the document on screen honest.
 */
export function refuseDocumentEdit(toolId: string | undefined): boolean {
  if (!toolId || !documentLayer.has(toolId)) return false;
  const tell = refusedHandlers.get(toolId);
  if (tell) {
    try { tell(); } catch (e) { console.error(e); }
  }
  return true;
}

/**
 * `write` (a mounted tool's undo-recording `setInput`) behind the check
 * {@link refuseDocumentEdit}; views/tool/setup.ts installs the guarded setter on every
 * mounted tool. While `replaying()`
 * (an undo or redo, which only moves between states the document already had) every
 * write passes; otherwise a refused write never reaches `write`, and `settle` runs so
 * whatever drew the attempted edit (a dragged box, a typed field) goes back to the
 * model's values.
 */
export function guardDocumentEdits<A extends unknown[]>(
  toolId: string | undefined, write: (...args: A) => Promise<void>, replaying: () => boolean, settle: () => void,
): (...args: A) => Promise<void> {
  return (...args: A): Promise<void> => {
    if (!replaying() && refuseDocumentEdit(toolId)) {
      settle();
      return Promise.resolve();
    }
    return write(...args);
  };
}

/** The document layer's note for `toolId`, or null when the document is editable. */
export function documentReadOnlyNote(toolId: string | undefined): string | null {
  return (toolId && documentLayer.get(toolId)?.note) || null;
}

/** The governed policy alone: an explicit per-tool policy, else the fail-closed overlay. */
function governedPolicy(toolId: string, inputId: string): InputPolicy | undefined {
  const explicit = registry.size ? registry.get(toolId)?.get(inputId) : undefined;
  return explicit ?? failClosed ?? undefined;
}

/**
 * The policy for one input of one tool, or `undefined` when none is registered (the
 * default - the sidebar then behaves exactly as with no policy layer). An explicit
 * per-tool policy always wins; otherwise the global fail-closed overlay applies when
 * one is set, else `undefined`. The dormant common case (empty registry, no overlay)
 * still returns `undefined` with no per-input cost.
 *
 * The document layer sits under the governed locks: a governed `locked` or `hidden`
 * policy, and the fail-closed overlay, win over the document layer. A governed `choice` does not: a
 * person who may not change the document may not pick among allowed values either.
 */
export function getInputPolicy(toolId: string | undefined, inputId: string): InputPolicy | undefined {
  if (!toolId) return undefined;
  const governed = governedPolicy(toolId, inputId);
  if (!documentLayer.size || (governed && governed.mode !== 'choice')) return governed;
  return documentLayer.get(toolId) ?? governed;
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

// ── Tool mount hook ──────────────────────────────────────────────────────────
// The registry is swapped per mounted tool by whoever populates it, and that
// party has to hear about a mount BEFORE the sidebar's first render. The tool
// view announces its mount here and a policy source registers a hook, so the
// view never learns who governs it. Empty by default: with nothing registered a
// mount costs one Set walk over nothing.

type ToolMountHook = (toolId: string) => void;
const mountHooks = new Set<ToolMountHook>();
/** The tool most recently announced as mounted, so a hook registered after the
 *  mount (a policy source that finished loading late) is replayed it at once. */
let mountedToolId: string | null = null;

/** One hook's failure never reaches the mount path or the other hooks. */
function runMountHook(hook: ToolMountHook, toolId: string): void {
  try {
    hook(toolId);
  } catch (e) {
    console.error(e);
  }
}

/**
 * Register a hook to run with each mounted tool's id. If a tool is already mounted
 * the hook runs for it at once, so a late registration still governs the open tool
 * (the sidebar picks the policy up on its next sync). Returns the unregister.
 */
export function onToolInputMount(hook: ToolMountHook): () => void {
  mountHooks.add(hook);
  if (mountedToolId !== null) runMountHook(hook, mountedToolId);
  return () => {
    mountHooks.delete(hook);
  };
}

/** Announce a tool mount. The tool view calls this before its first sidebar render. */
export function notifyToolInputMount(toolId: string): void {
  mountedToolId = toolId;
  for (const hook of mountHooks) runMountHook(hook, toolId);
}

/** Structural equality for the small values an input holds (primitives, and the
 *  vectors / framing objects a locked value may be). */
function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * The values a tool's policies want the MODEL to hold, given the model's current
 * values: a `locked` policy's value where the model differs, and for a `choice`
 * whose current value is outside the allowed set, the policy's value when that is
 * allowed, else the first allowed option. Empty when nothing needs applying.
 *
 * The registry is a rendering overlay, but a locked value that only the sidebar
 * knows leaves the canvas, the saved session and any link carrying the value the
 * control says it is not. The host applies this to the runtime once after mount
 * so all four agree. `hidden` never reaches here: a hidden input keeps its value.
 */
export function policyValuesFor(
  toolId: string | undefined,
  inputs: ReadonlyArray<{ id: string; value?: unknown }>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!toolId) return out;
  for (const { id, value } of inputs) {
    const policy = governedPolicy(toolId, id);
    if (!policy) continue;
    if (policy.mode === 'locked') {
      if (policy.value !== undefined && !sameValue(value, policy.value)) out[id] = policy.value;
    } else if (policy.mode === 'choice' && policy.allow?.length && !policy.allow.some((a) => sameValue(a, value))) {
      const preferred = policy.value !== undefined && policy.allow.some((a) => sameValue(a, policy.value)) ? policy.value : policy.allow[0];
      out[id] = preferred;
    }
  }
  return out;
}

/**
 * The URL param keys (input id and its urlKey alias) of this tool's inputs that a
 * policy locks or hides, for a caller building a server-bound request: an
 * instance refuses a supplied locked or hidden param and bakes locked values
 * itself, so those keys are the caller's to leave out. Empty when ungoverned. The
 * document layer is not governance: a viewer's link and export carry every value.
 */
export function governedParamKeys(
  toolId: string | undefined,
  inputs: ReadonlyArray<{ id: string; urlKey?: string }>,
): Set<string> {
  const out = new Set<string>();
  if (!toolId) return out;
  for (const { id, urlKey } of inputs) {
    const mode = governedPolicy(toolId, id)?.mode;
    if (mode !== 'locked' && mode !== 'hidden') continue;
    out.add(id);
    if (urlKey) out.add(urlKey);
  }
  return out;
}

/** TEST-ONLY convenience: empty the registry (and lift any fail-closed overlay and
 *  document layer, drop every mount hook and forget the mounted tool) back to the
 *  dormant default. */
export function _clearInputPoliciesForTests(): void {
  registry.clear();
  documentLayer.clear();
  refusedHandlers.clear();
  failClosed = null;
  mountHooks.clear();
  mountedToolId = null;
}
