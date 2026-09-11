// SPDX-License-Identifier: MPL-2.0
/**
 * extensions - the runtime REGISTRY + MOUNT mechanism for the chrome extension
 * slots whose contract lives in @lolly-tools/core/extension-v1 (the door +
 * furniture-spec). This is the shell-side implementation of that contract, the
 * exact analog of how each shell implements host-v1.
 *
 * It is a sibling of lib/export-policy.ts and lib/share-sections.ts and follows
 * their dormancy discipline VERBATIM: EMPTY by default, register→unregister,
 * `_clear…ForTests`, no product vocabulary, no i18n of its own (copy comes from
 * whoever hydrates). With nothing registered and enabled, `mountSlot` leaves the
 * slot element untouched and returns a no-op - a build with no channel active is
 * byte-identical to today, and merely importing this module changes nothing.
 *
 * Where furniture comes from is NOT this module's concern (exactly as
 * export-policy knows nothing about src/org/). Two channels fill the same doors - 
 * a control plane and the community - each through `registerExtension`; delivery
 * (fetching + evaluating a module into the realm) is each channel's own job. Core
 * ships NO bundle loader and NO sandbox.
 *
 * TRUST: a hydrated component runs in the shell realm, same reach as a tool
 * `hooks.js` (not sandboxed). See the header of @lolly-tools/core/extension-v1.
 */

import {
  SLOT_REGISTRY, EXTENSION_CONTRACT_VERSION,
  type Extension, type ExtensionSlotId, type ExtensionChannel,
  type SlotHost, type Disposer,
} from '@lolly-tools/core/extension-v1';
import { satisfiesRange } from '@lolly/engine';
import { t } from '../i18n.ts';
import { announce } from '../a11y.ts';

/** The web shell binds the mount target to a real element. */
type WebExtension = Extension<any, HTMLElement>;

interface Registered {
  ext: WebExtension;
  channel: ExtensionChannel;
  /** Registration order - the final, stable tiebreak. */
  seq: number;
}

const registry = new Map<ExtensionSlotId, Registered[]>();
let seq = 0;

/** The AUTHORITATIVE priority within a slot: a control-plane extension always
 *  out-ranks a local one, which out-ranks a community one. This is the governance
 *  rank and it is compared FIRST in resolve() - author-supplied `order` can only
 *  break ties WITHIN a channel, never cross it - so a community (or local)
 *  extension can never silently override a governed one in a `single` slot,
 *  whatever `order` it declares. */
const CHANNEL_RANK: Record<ExtensionChannel, number> = {
  'control-plane': 0, local: 1, community: 2,
};

// ── Governance / enablement (dormant; the resolver over the registry) ──────────

/**
 * The reason a slot decision resolved the way it did - useful for a governance/
 * debug surface, never shown to end users.
 *   'control-plane' - a present control-plane policy decided (enable or disable).
 *   'deployer' - a deployer/local opt-in enabled it (no control-plane opinion).
 *   'core-default' - nothing enabled it: the dormant default is EMPTY.
 */
export interface SlotDecision {
  enabled: boolean;
  reason: 'control-plane' | 'deployer' | 'core-default';
}

/**
 * A control-plane governance policy: authoritative enable/disable for a given
 * (slot, channel, id), or `undefined` for "no opinion". DORMANT by default - a
 * plain OSS build installs none, so the control plane never has an opinion and the
 * resolver falls through to the deployer/local tier.
 */
export type SlotGovernancePolicy = (
  slot: ExtensionSlotId, channel: ExtensionChannel, id: string,
) => boolean | undefined;

/**
 * A deployer/local opt-in signal for the non-control-plane tier: `true` when the
 * deployer (community manifest) or the local operator has opted this extension in.
 * DORMANT by default - with none installed, community extensions do NOT hydrate
 * (opt-in polarity: hydrating third-party code is a deliberate act, never a
 * default). Control-plane and local channels are self-opting (see resolveSlot).
 */
export type SlotOptIn = (
  slot: ExtensionSlotId, channel: ExtensionChannel, id: string,
) => boolean;

let governance: SlotGovernancePolicy | undefined;
let optIn: SlotOptIn | undefined;

/** Install (or, with `undefined`, clear) the control-plane governance policy.
 *  Clearing restores the dormant default. */
export function setSlotGovernance(policy: SlotGovernancePolicy | undefined): void {
  governance = policy;
  notifyChanged(); // a policy change can flip what resolves - re-notify mount sites
}

/** Install (or clear) the deployer/local opt-in signal for community extensions. */
export function setSlotOptIn(signal: SlotOptIn | undefined): void {
  optIn = signal;
  notifyChanged(); // an opt-in change can flip what resolves - re-notify mount sites
}

/**
 * The pure enablement resolver - the SINGLE place the "is this (slot, channel, id)
 * enabled, and why" decision lives, so views and tests agree. Precedence, highest
 * first:
 *   1. CONTROL PLANE - a present policy's explicit `true`/`false` is authoritative
 *      (it can enable, or DISABLE a community extension a deployer opted in).
 *   2. DEPLOYER / LOCAL OPT-IN - with no control-plane opinion: a control-plane or
 *      local registration is self-opting (registering IS the deliberate act); a
 *      community registration hydrates only when the opt-in signal says so.
 *   3. CORE DEFAULT = EMPTY - nothing enabled it; the slot renders nothing.
 * Dormant when nothing is present: with no policy, no opt-in, and no registration,
 * every path bottoms out at `core-default`.
 */
export function resolveSlot(
  slot: ExtensionSlotId, channel: ExtensionChannel, id: string,
): SlotDecision {
  const cp = governance?.(slot, channel, id);
  if (cp === true) return { enabled: true, reason: 'control-plane' };
  if (cp === false) return { enabled: false, reason: 'control-plane' };
  // No control-plane opinion → the deployer/local tier.
  if (channel === 'control-plane' || channel === 'local') {
    return { enabled: true, reason: channel === 'control-plane' ? 'control-plane' : 'deployer' };
  }
  if (optIn?.(slot, channel, id)) return { enabled: true, reason: 'deployer' };
  return { enabled: false, reason: 'core-default' };
}

// ── The hydration API (register → unregister) ─────────────────────────────────

/**
 * Register a component into a slot; returns an unregister fn (share-sections
 * precedent). Refuses (logs, no-ops) an unknown slot or a stale `contract` range - 
 * fail closed, like loadTool's engineVersion floor. Registration alone does NOT
 * make an extension render: whether it hydrates is decided by resolveSlot at mount.
 */
export function registerExtension(ext: WebExtension, channel: ExtensionChannel): Disposer {
  if (!SLOT_REGISTRY.some(s => s.id === ext.slot)) {
    console.warn(`extensions: unknown slot "${ext.slot}" - refusing "${ext.id}"`);
    return () => {};
  }
  if (ext.contract && !satisfiesRange(EXTENSION_CONTRACT_VERSION, ext.contract)) {
    console.warn(
      `extensions: "${ext.id}" needs contract ${ext.contract}, have ${EXTENSION_CONTRACT_VERSION} - refusing`,
    );
    return () => {};
  }
  const list = registry.get(ext.slot) ?? [];
  // Ids are UNIQUE within a slot (extension-v1). A duplicate registration is a
  // caller error (double opt-in, a bundle re-injecting on reload) - refuse it
  // fail-closed rather than stack a second live record, which a `multi` slot would
  // double-mount and whose only guard today is the `single` slice(0,1).
  if (list.some(r => r.ext.id === ext.id)) {
    console.warn(`extensions: "${ext.id}" already registered in slot "${ext.slot}" - refusing duplicate`);
    return () => {};
  }
  const rec: Registered = { ext, channel, seq: seq++ };
  list.push(rec);
  registry.set(ext.slot, list);
  notifyChanged();
  return () => {
    const l = registry.get(ext.slot);
    if (l) {
      const i = l.indexOf(rec);
      if (i >= 0) { l.splice(i, 1); notifyChanged(); }
    }
  };
}

// ── Registry-change notification (so a mount site can hydrate on ASYNC delivery) ─

type ChangeListener = () => void;
const changeListeners = new Set<ChangeListener>();

/**
 * Subscribe to registry/governance changes - fired whenever the resolved set for
 * ANY slot may have changed (register, unregister, governance/opt-in install).
 * Returns an unsubscribe disposer. A mount site subscribes so an extension
 * delivered ASYNCHRONOUSLY (a control-plane/community bundle fetched + evaluated
 * after first paint) still hydrates its slot, rather than latching an empty door.
 */
export function onExtensionsChanged(listener: ChangeListener): Disposer {
  changeListeners.add(listener);
  return () => { changeListeners.delete(listener); };
}

function notifyChanged(): void {
  for (const l of changeListeners) {
    try { l(); } catch (e) { console.error('extensions: change listener failed', e); }
  }
}

/** Whether any registered + governance-enabled extension currently resolves into
 *  the slot. A mount site gates its (latching) mount on this so it never latches
 *  an EMPTY door and then misses an extension delivered moments later. */
export function slotHasResolved(slot: ExtensionSlotId): boolean {
  return resolve(slot).length > 0;
}

/**
 * Resolve which registrations render, in order: governance-enabled only, then by
 * channel rank (control-plane < local < community - the AUTHORITATIVE governance
 * ordering), then the author's explicit `order` as a WITHIN-CHANNEL tiebreak, then
 * registration order. Channel rank is compared before `order` so an author cannot
 * use `order` to jump a governed extension in a `single` slot. A `single` slot
 * yields at most the top one.
 */
function resolve(slot: ExtensionSlotId): Registered[] {
  const enabled = (registry.get(slot) ?? []).filter(
    r => resolveSlot(slot, r.channel, r.ext.id).enabled,
  );
  enabled.sort((a, b) =>
    CHANNEL_RANK[a.channel] - CHANNEL_RANK[b.channel]
    || (a.ext.order ?? Infinity) - (b.ext.order ?? Infinity)
    || a.seq - b.seq);
  const single = SLOT_REGISTRY.find(s => s.id === slot)?.cardinality === 'single';
  return single ? enabled.slice(0, 1) : enabled;
}

// ── The mount site primitive ───────────────────────────────────────────────────

/**
 * THE MOUNT SITE. Core calls this at a named place in the chrome with the slot's
 * element + typed context. Renders every resolved (governance-enabled) extension
 * into it (multi → each into its own appended child so they never collide) and
 * returns an aggregate disposer.
 *
 * DORMANT: an empty/none-enabled slot returns a no-op disposer and leaves `el`
 * UNTOUCHED - nothing renders. This is the common path, and the byte-identical
 * guarantee. Per-extension errors are isolated: a throwing/rejecting mount
 * degrades THAT extension to empty, never the surrounding chrome.
 */
export async function mountSlot<Ctx>(
  slot: ExtensionSlotId, el: HTMLElement, context: Ctx,
): Promise<Disposer> {
  const chosen = resolve(slot);
  if (!chosen.length) return () => {};                    // ← dormancy, the common path
  const disposers: Disposer[] = [];
  for (const { ext, channel } of chosen) {
    const target = chosen.length > 1 ? el.appendChild(document.createElement('div')) : el;
    const host: SlotHost<Ctx, HTMLElement> = { el: target, slot, channel, context, t, announce };
    try {
      const d = await ext.mount(host);
      // A returned disposer TAKES PRECEDENCE; `unmount` is only the fallback for
      // when returning one isn't convenient - never run both, or a non-idempotent
      // teardown double-removes listeners/nodes.
      if (typeof d === 'function') disposers.push(d);
      else if (ext.unmount) disposers.push(() => ext.unmount!(host));
    } catch (e) {
      console.error(`extension "${ext.id}" failed to mount`, e);
      target.replaceChildren();                            // degrade to empty
    }
  }
  return () => { for (const d of disposers) { try { d(); } catch { /* teardown is best-effort */ } } };
}

/** Enumerate registered extensions for a slot (a governance/debug surface). A copy,
 *  so iteration is stable across un/registration. */
export function extensionsFor(slot: ExtensionSlotId): readonly Registered[] {
  return (registry.get(slot) ?? []).slice();
}

/** TEST-ONLY: empty the registry + governance back to the dormant default. */
export function _clearExtensionsForTests(): void {
  registry.clear();
  governance = undefined;
  optIn = undefined;
  changeListeners.clear();
  seq = 0;
}
