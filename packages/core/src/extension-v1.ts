// SPDX-License-Identifier: MPL-2.0
/**
 * Chrome Extension Contract - v1.
 *
 * The typed SLOT contract: the host-v1 analog for CHROME slots. Lolly's founding
 * thesis is "tools are data, not bundled code - a contract + runtime hydration +
 * multiple channels, so new tools ship without an app rebuild". This applies the
 * same idea to chrome/governance surfaces instead of the tool canvas: core defines
 * named SLOTS with a typed contract; components are HYDRATED into them at runtime;
 * two supply channels (a control plane + the community) fill the same slots; an
 * empty slot renders nothing.
 *
 * Where this lives, and why in @lolly-tools/core: exactly like host-v1, the
 * CONTRACT lives in the neutral SDK package so BOTH supply channels can compile
 * against it without depending on the engine or the web shell (a control plane
 * lives in a separate private repo; a community author self-hosts). The runtime
 * REGISTRY + the DOM mount mechanism live in the shell (shells/web/src/lib/
 * extensions.ts), just as each shell implements host-v1. This module is types +
 * one data constant only - importing it pulls in no component code and no DOM.
 *
 * Additive like host-v1: slots/fields are ADDED in minor versions, never removed
 * or signature-changed; a breaking change is extension-v2, with v1 kept working.
 *
 * TRUST - stated honestly, no overclaim. A hydrated component runs in the SHELL
 * REALM, exactly like a tool `hooks.js` today: closure-scope injection of a
 * supported API, NOT a security sandbox. It can reach `window`/`document`/`fetch`
 * with the same power as the surrounding chrome. Therefore control-plane
 * extensions are ORG-TRUSTED (the org bundles and vouches for them) and community
 * extensions are OPT-IN BY THE DEPLOYER AT THEIR OWN RISK. Worker isolation is the
 * same future hardening that tool hooks await; when it lands it covers both. Core
 * provides the registration API + this contract + the mount site - NOT a bundle
 * loader and NOT a sandbox. Delivery (getting a module into the realm) is each
 * channel's own job.
 */

/**
 * The permanent, enumerable set of named slots. A slot id is a CONTRACT - like a
 * tool id or an asset id it is never renamed or reused, only added to.
 */
export type ExtensionSlotId =
  | 'cost-authoring'; // the first slot (see SLOT_REGISTRY). More added additively.

/** 'single' → one extension wins (deterministic priority); 'multi' → every
 *  registered extension renders, in resolved order. */
export type SlotCardinality = 'single' | 'multi';

/** WHO hydrated an extension - carried for governance + an honest provenance
 *  chip. NEVER a security boundary (see the trust note in the header). */
export type ExtensionChannel = 'control-plane' | 'community' | 'local';

/** The smallest teardown contract - matches every registry precedent in the
 *  shell (register → unregister, subscribe → unsubscribe). */
export type Disposer = () => void;

/**
 * One enumerable slot descriptor. SLOT_REGISTRY lists every slot so a control
 * plane or community deployer can DISCOVER what exists to fill - the chrome analog
 * of the tool catalog index. Pure data: no component code, no DOM.
 */
export interface SlotManifest {
  readonly id: ExtensionSlotId;
  readonly cardinality: SlotCardinality;
  /** Dev-facing purpose of the slot (not user copy). */
  readonly summary: string;
  /** The NAME of the per-slot typed context the mount site passes in; the
   *  concrete type lives beside the slot's consumer in the shell (it may touch
   *  DOM/Blob, which this neutral module must not). */
  readonly contextType: string;
}

/**
 * The enumerable catalog of slots. Data only - no component code, no DOM. Both
 * channels read it to know what slots exist; the shell's registry validates
 * against it.
 */
export const SLOT_REGISTRY: readonly SlotManifest[] = [
  {
    id: 'cost-authoring',
    cardinality: 'single',
    summary:
      'Authoring/manage UI for supplier rate cards — org/deployer config, not ' +
      'core-individual config. Core keeps the preflight counts, the cost ' +
      'calculator, and card CONSUMPTION (CLI --rate-card, a supplied ' +
      'confidential catalog card); the AUTHORING furniture is hydrated.',
    contextType: 'CostAuthoringContext',
  },
];

/**
 * The typed surface a hydrated extension RECEIVES at mount - the host-v1 analog
 * for chrome. Deliberately MINIMAL and universal: slot-specific capability rides
 * in the typed `context`, NOT here, so this base never grows per feature. Generic
 * over the mount target (`El`) so a non-DOM shell could reuse the mechanism; the
 * web shell binds `El = HTMLElement`.
 */
export interface SlotHost<Ctx = unknown, El = unknown> {
  /** The element the slot owns. The extension mounts its DOM HERE and must not
   *  reach outside it. Empty when the extension mounts. */
  readonly el: El;
  /** Which slot this is (redundant with Extension.slot; handy when one component
   *  serves several slots). */
  readonly slot: ExtensionSlotId;
  /** Who supplied this extension - for a provenance chip + governance, not trust. */
  readonly channel: ExtensionChannel;
  /** The per-slot typed context + scoped app APIs the mount site passes in. This
   *  is where a slot's capability is SCOPED, keeping the base surface universal. */
  readonly context: Ctx;
  /** Localise a UI string (the shell's i18n `t`) - a hydrated component stays
   *  translatable without importing the shell's i18n module. */
  t(key: string, vars?: Record<string, string | number>): string;
  /** Announce to assistive tech (the shell's a11y live region). */
  announce(message: string): void;
}

/**
 * What a hydrated component PROVIDES. As small as a tool's contract: an id,
 * which slot it fills, a mount lifecycle.
 */
export interface Extension<Ctx = unknown, El = unknown> {
  /** Permanent, namespaced id - a CONTRACT like a tool id. Convention
   *  '<vendor-or-channel>:<feature>', e.g. 'lolly-work:cost-authoring',
   *  'community:acme-cost-authoring'. Unique within a slot. */
  readonly id: string;
  /** The slot this fills. Must be a member of SLOT_REGISTRY. */
  readonly slot: ExtensionSlotId;
  /** Required contract range (semver), checked at register time against
   * EXTENSION_CONTRACT_VERSION - the parallel of a tool manifest's engineVersion
   *  floor: a stale extension fails CLOSED (refused, logged) rather than calling a
   *  field that isn't there. OPTIONAL in the type for terse local/test extensions,
   *  but the fail-closed guarantee ONLY holds when it is declared: an extension
   *  authored against a newer contract that OMITS this registers on an older shell
   *  and then throws at mount() when it touches a field that isn't there. Any
   * extension that depends on a contract field it cannot be sure the host has -
   * i.e. every control-plane/community bundle - MUST pin a floor here. */
  readonly contract?: string;
  /** Ordering hint WITHIN A CHANNEL only (lower renders first). It is a tiebreak
   *  UNDER the channel governance rank (control-plane < local < community), never
   *  over it: an author cannot use `order` to make a community/local extension win
   *  a `single` slot ahead of a control-plane one. Defaults resolve by channel rank,
   *  then registration order. */
  readonly order?: number;
  /**
   * Hydrate into the slot. Returns an optional disposer - the smallest teardown
   * contract. May be async; the mount site awaits it before the slot is
   * considered live. Throwing is caught by the mount site and the slot degrades to
   * empty - an extension can NEVER break the surrounding chrome.
   */
  mount(host: SlotHost<Ctx, El>): void | Disposer | Promise<void | Disposer>;
  /** Explicit teardown, when a disposer return isn't convenient. Optional. */
  unmount?(host: SlotHost<Ctx, El>): void;
}

/** The extension contract version, bumped like ENGINE_VERSION but for THIS
 * surface - independent of ENGINE_VERSION and CONTRACT_VERSION (host-v1). */
export const EXTENSION_CONTRACT_VERSION = '1.0.0';
