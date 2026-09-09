// SPDX-License-Identifier: MPL-2.0
/**
 * collab-live-mount - the registrant for `lib/collab-mount.ts`: a connected session
 * becomes a MOUNTED tool, on both sides of the ceremony (plan 100 section 5, section 6.2a, section 11.17,
 * section 12 Q3; wave 2.5).
 *
 * `collab-mount.ts`'s header ends with the contract this file fulfils:
 *
 * ```ts
 * const off = registerCollabMount(mountLiveSession);
 * for (const conn of takeParked()) void mountLiveSession(conn);   // adopt the race
 * ```
 *
 * {@link installLiveCollabMount} is exactly that, and `main.ts` imports this module for
 * that one effect. Everything heavy is behind a dynamic import, so a build that never
 * starts a collab pays for this file and nothing under it.
 *
 * ── The two roles, and why they are the same code ──────────────────────────────
 *
 * The acceptor is NOT in the tool yet: they arrived on `#/join` from a link, cold. The
 * inviter IS - they started the ceremony from the Share dialog of the tool they are
 * working in. So one navigates and one re-mounts, and both then run the identical mount:
 * a one-shot session factory is armed, the route is (re)entered, and `views/tool.ts`'s
 * existing acquisition picks the handle up at mount time. Nothing else in the shell
 * learns that a collab exists.
 *
 * The inviter's re-entry is the house `'lolly:remount'` force-nav (`main.ts` listens; the
 * drop router's `routeToConsumer` is the same dance for a stash that must be consumed at
 * mount time). It is REQUIRED, not a convenience: the tool route's dedup signature is
 * `tool:<id>` with the params deliberately stripped (`routeSignature`), so changing only
 * the query never remounts on its own.
 *
 * ── The seed: why URL-mode params, and not raw input values ────────────────────
 *
 * section 12 Q3 is resolved as transfer-on-connect, one path. The question this file had to
 * answer is what a "session seed" IS in the shell, and the answer is the currency the
 * whole app already round-trips state in: **URL-mode query parameters**.
 *
 *   1. It is the one serialisation that exists for every input type. `buildShareParams`
 *      (views/tool.ts) walks `runtime.getModel()` and encodes assets by id, blocks in
 *      their compact form, vectors as flat `id.field` params - and it is ALREADY handed
 *      to this feature: `CollabLaunchContext.baseParts` is its output, captured when the
 *      Share dialog (and so the ceremony) opened. That is the "serialise the current
 *      runtime model at ceremony start" step, and it needed no new code.
 *   2. It is the one that lands as `initialValues`. `views/tool.ts` parses the route's
 *      params with `parseUrlState(params, manifest)` BEFORE `createRuntime`, so the
 *      runtime is BORN with the state - hooks and the first render see it once. A patch
 *      applied after mount would render twice and run `onInit` against the wrong model.
 *   3. It is typed by the MANIFEST. A raw `Record<string, unknown>` handed across the
 *      wire would arrive as strings; `parseUrlState` coerces each param against its
 *      declared input type and drops what the tool does not declare - which is also the
 *      section 6.3 rule for a peer's payload ("values then flow through the same input-model
 *      validation URL mode already applies"). The seed is untrusted input, and this is
 *      the boundary we already trust for it.
 *
 * So a seed travels as a `Record<string, unknown>` of URL params ({@link CollabSeed}),
 * is minted from `baseParts`, rides the ops hello as a query string, and is spent by
 * putting it in the route the mount navigates to. A packed `z=` query survives that
 * round trip untouched (it is one param), so a big session is not a special case.
 *
 * ── …AND WHY THE INVITER'S OWN REMOUNT MUST NOT GO THROUGH IT ──────────────────
 *
 * Everything above is about what crosses the WIRE, where a URL-mode query is the only
 * currency both devices can agree on. It is the wrong currency for the inviter's own
 * device, and reading it as though it were is how "Start a collab" silently deleted
 * people's work.
 *
 * Both halves of that route are LOSSY, by design and for good reasons. `buildShareParams`
 * skips `user/` asset ids, drops a blocks input over 8000 chars, and drops ANY value
 * whose string form runs past 150 - a link has to stay a link. `syncUrl` writes only the
 * params the user has actually edited, skips `file` inputs outright (a picked file's bytes
 * are in memory; there is no URL for them), skips provenance-less baked refs, and rebuilds
 * a fresh `URLSearchParams` that never re-adds `slot`. So an uploaded logo, a picked file,
 * a 300-character paragraph and the resumed session id are exactly the values NEITHER
 * encoder writes - and the forced remount rebuilds the runtime from the route, so before
 * this they were simply gone, with no warning and no undo (the remount resets the history
 * stack too).
 *
 * The fix is not a better encoder. It is not to encode at all: the inviter is on the SAME
 * DEVICE, so the live model can be carried across the remount BY REFERENCE. `views/tool.ts`
 * hands it over in its `_cleanup` - {@link carryMountState}, one call it makes only when
 * {@link willRemountForCollab} says a remount for this tool is armed and is this device's
 * own - and the very next mount spends it through {@link takeCarriedMountState}, on top of
 * the route's values. Nothing is serialised, so nothing is lossy: a `FileRef`, a `user/`
 * asset id and a 40 KB paragraph all survive because they are the same objects.
 *
 * Two consequences worth stating. The seed merge stays exactly as it was - it is still
 * what the ACCEPTOR is born with, and it is still the inviter's fallback if the carry ever
 * misses. And the carry is scoped as narrowly as it can be: one tool id, one shot, only
 * while a non-ephemeral plan is armed, dropped whenever the plan is.
 *
 * ── Ephemerality (section 6.2a, section 11.17) ───────────────────────────────────────────────
 *
 * The acceptor's copy must never reach a slot on their device. The plan's ruling is one
 * interception point rather than an audit of every save: a memory-backed `host.state`
 * (`lib/ephemeral-state.ts`). This module ARMS one per ephemeral mount and hands it over
 * through {@link takeEphemeralState}; `views/tool.ts` spends it in the same place it
 * already clones the host for a manifest's `network.allowlist`, before the slot load and
 * before `createRuntime`, so the runtime, the actions bar and every save path in between
 * are looking at one object.
 *
 * ONE GAP IS KNOWN AND IS NOT CLOSED BY THAT SWAP. Filing a session into a folder
 * (`views/tool-actions.ts`) persists through `createFolderStore(host)`, which writes via
 * `host.profile.set` (`src/folders.ts`), not `host.state` - so an acceptor who FILES
 * their copy still writes a folder record to their own device. The session data itself
 * stays in memory; what leaks is a row pointing at a slot that does not exist. Closing it
 * means the same interception on `host.profile`, which is a wider blast radius (the
 * profile is identity, prefs and a11y, none of which should become ephemeral) and is
 * deliberately left for the wave that can scope it to the folder store alone.
 */

import { getCollabMount, registerCollabMount, takeParked } from './collab-mount.ts';
import { registerCollabSessionSource } from './collab-session-source.ts';
import type { CollabConnection, CollabSeed } from './collab-mount.ts';
import type { CollabSessionHandle } from './collab-session.ts';
import type { WebStateAPI } from '../bridge/state.ts';
// TYPE-ONLY, all four, and that matters rather than being just tidy: this module is on the
// boot path (main.ts imports it for `installLiveCollabMount`'s side effect), and the
// beam stack under `collab/beam-ui.ts` reaches the protocol, the pack, the IndexedDB
// sink and the toast's stylesheet. A `import type` is erased, so the whole feature stays
// behind the one dynamic import in `attachCollabBeam` and a build that never beams pays
// for none of it.
import type { BeamPackHost } from './beam-pack.ts';
import type { CollabBeamLink, CollabBeamUi } from '../collab/beam-ui.ts';
import type { CollabPillAction } from '../components/collab-pill.ts';

/**
 * The most a peer-supplied seed may weigh, in characters of query text.
 *
 * A generous multiple of a real session (`buildShareParams` caps a single blocks input
 * at 8000 chars, and the address bar auto-packs above 1800) and a long way under the
 * transport's own 64 KB frame ceiling, so this is a floor on absurdity rather than a
 * budget anyone can hit honestly. Untrusted input gets a bound (section 11.21).
 */
export const MAX_SEED_CHARS = 32_000;

/** Keys no seed may carry, whatever a peer says. The same refusal `sdp-codec.ts` makes
 *  for tool ids and `op-guard.ts` makes for op payloads - a param named `__proto__` is
 *  never a tool input and is always someone probing. */
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * A query string as a seed record, or `undefined` when there is nothing usable in it.
 *
 * Deliberately NOT manifest-aware: coercion is `parseUrlState`'s job at mount time, and
 * duplicating it here would be a second, drifting copy of the input-model rules. This is
 * the transport-shaped half - decode, bound, and refuse the keys that are never inputs.
 */
export function seedFromQuery(query: string | null | undefined): CollabSeed | undefined {
  if (typeof query !== 'string') return undefined;
  const text = query.trim();
  if (!text || text.length > MAX_SEED_CHARS) return undefined;
  // Null-prototype: the forbidden-key refusal above is the policy, and a bare object is
  // what makes a miss in it harmless rather than a prototype write.
  const seed = Object.create(null) as CollabSeed;
  let count = 0;
  for (const [key, value] of new URLSearchParams(text)) {
    if (!key || FORBIDDEN_KEYS.has(key)) continue;
    seed[key] = value;
    count++;
  }
  return count > 0 ? seed : undefined;
}

/**
 * The Share dialog's own serialisation of the live model as a seed.
 *
 * `baseParts` are pre-encoded `key=value` strings, so they are read through the same
 * `URLSearchParams` that will read them back - a round trip through one decoder cannot
 * disagree with itself, whereas hand-splitting on `=` would decode differently from the
 * parser the value is eventually handed to.
 */
export function seedFromBaseParts(baseParts: readonly string[] | undefined): CollabSeed | undefined {
  if (!baseParts || baseParts.length === 0) return undefined;
  return seedFromQuery(baseParts.join('&'));
}

/** A seed as the query string a route (or a hello frame) carries. Empty for no seed. */
export function seedToQuery(seed: CollabSeed | undefined): string {
  if (!seed) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(seed)) {
    if (!key || FORBIDDEN_KEYS.has(key) || value === undefined || value === null) continue;
    params.set(key, String(value));
  }
  return params.toString();
}

/**
 * Merge a seed under an existing query.
 *
 * The QUERY wins on a collision, and that ordering is the whole point for the inviter's
 * remount. `syncUrl` writes only the params the user has actually changed (`dirtyParams`)
 * - it is the fresher record of edits, including any made after the ceremony dialog
 * opened - while the seed carries the whole model, including the values that arrived
 * from a resumed slot, a template or a default and were never dirty. Seed first, bar on
 * top: nothing the user typed is reverted, and nothing the bar never wrote is lost.
 */
export function mergeSeedQuery(seed: CollabSeed | undefined, query: string): string {
  const params = new URLSearchParams(seedToQuery(seed));
  for (const [key, value] of new URLSearchParams(query)) {
    if (!key || FORBIDDEN_KEYS.has(key)) continue;
    params.set(key, value);
  }
  return params.toString();
}

// ── The one-shot mount plan ───────────────────────────────────────────────────

/** What one adopted connection owes the mount that is about to happen. */
interface MountPlan {
  readonly toolId: string;
  readonly handle: CollabSessionHandle;
  readonly ephemeral: boolean;
  /** Hang the session up - used when a plan is replaced or refused, never after it has
   *  been handed to a mount (which owns it from then on). */
  readonly close: () => void;
  /**
   * The memory bridge armed for an ephemeral mount.
   *
   * RETAINED after it is handed over, not dropped: it is the only place the acceptor's
   * work exists, and "Save a copy" reads it back out. `stateSpent` is what makes the
   * HANDOVER one-shot; the reference outliving it is the feature.
   */
  state: WebStateAPI | null;
  stateSpent: boolean;
  /** Cleared the moment the session source hands the handle over. */
  handleSpent: boolean;
  /** Teardown for the connection-state watch that disarms a plan whose session died
   *  before anyone mounted it. Dropped when the plan is spent or replaced. */
  watch: (() => void) | null;
  /**
   * The bulk lane this pair published, or `null` for a connection that has none.
   *
   * Read STRUCTURALLY off the connection (see {@link beamLinkOf}) so this seam stays
   * transport-agnostic: Track A publishes one, a work collab does not, and neither
   * shape leaks into `lib/collab-mount.ts`'s interface.
   */
  readonly beam: CollabBeamLink | null;
  /** The beam UI a mount built over that link, held so a replaced or torn-down plan
   *  takes its toast (and its staging) down with it. */
  ui: CollabBeamUi | null;
}

/** The plan awaiting its mount. At most one - a second collab replaces the first. */
let pending: MountPlan | null = null;
/** The plan a mount actually took, kept for "Save a copy" and for diagnostics. */
let adopted: MountPlan | null = null;
/** Teardown for the session-source registration this module made. */
let unregisterSource: (() => void) | null = null;

/**
 * What the inviter's outgoing mount handed across its own forced remount - the live
 * model BY REFERENCE, plus the slot it was resumed from. See the header's second
 * section for why the route cannot carry either.
 *
 * At most one, dropped whenever the plan it belongs to is (a carry with no remount
 * coming is just a reference to a model nobody will read).
 */
export interface CarriedMountState {
  readonly toolId: string;
  /** The saved-session slot the outgoing mount was on, or `null`. `syncUrl` never
   *  re-adds `slot` to the bar, so without this a collab started from a resumed
   *  session forgets which session it is and the first Save mints a duplicate. */
  readonly slot: string | null;
  /** Input id → value, exactly as the outgoing runtime held them. Not serialised. */
  readonly values: Record<string, unknown>;
}
let carried: CarriedMountState | null = null;

/** Disarm `plan`: drop the registry, the watch and (unless a mount already took it) the
 *  connection itself. Idempotent, and a no-op for a plan that is no longer the pending
 *  one - the newer plan owns the registry from the moment it was armed. */
function disarm(plan: MountPlan): void {
  if (pending === plan) {
    pending = null;
    unregisterSource?.();
    unregisterSource = null;
  }
  // `carried` is deliberately NOT dropped here. The only moment it can be non-null is
  // after `navigate` has already run (the outgoing view hands it over in `_cleanup`,
  // synchronously inside that navigate), so a pair that dies in the window between the
  // remount starting and the new mount reading it would take the user's live model with
  // it - the exact data loss this whole hand-off exists to prevent. It is one record,
  // spent on the next mount of that tool and replaced by the next ceremony.
  plan.watch?.();
  plan.watch = null;
  // A beam outlives neither its pair nor its mount: the toast comes off the page and
  // any half-received staging is discarded (section 11.18). Before the connection close below,
  // so a beam still in flight can write its own terminal frame down a live channel.
  try { plan.ui?.close(); } catch { /* an already-closed session is fine */ }
  plan.ui = null;
  // The transport under a 'closed' handle is already down, but `CollabConnection.close`
  // is deliberately MORE than `handle.close()` - Track A's ceremony effects and peer
  // connection, Track B's provider - and this is the only reference to it that exists
  // once the ceremony is gone. Not called for a spent plan: from the hand-off on, the
  // mount owns hanging up.
  if (!plan.handleSpent) { try { plan.close(); } catch { /* already gone is fine */ } }
}

/**
 * Arm the one-shot factory `views/tool.ts` will consult at mount time. Returns whether
 * the plan is STILL armed when it returns - see the re-entrancy note below.
 *
 * ONE-SHOT is the invariant, and it is enforced here rather than trusted: the factory
 * answers for exactly the tool the plan names, exactly once, and unregisters itself as
 * it answers. Two mounts of the same tool cannot both adopt the same transport - the
 * second is an ordinary single-player mount - and a mount of a DIFFERENT tool never
 * sees it at all (section 6.2a pins a private collab to the session it was started from; a
 * user in a collab still opens other tools single-player).
 *
 * ── THE WATCH IS RE-ENTRANT, AND BOTH REAL HANDLES MAKE IT SO ─────────────────
 *
 * `handle.events.subscribe(fn)` REPLAYS the current state synchronously, inside the
 * `subscribe()` call, on both shipping transports - `collab/rtc-handle.ts`'s emitter
 * (`fn(current())` before it returns) and `org/collab-handle.ts`'s events lane ("the
 * current state, immediately"). So for a handle that is ALREADY closed at arm time - 
 * Track A's acceptor waits up to `SEED_WAIT_MS` for the hello before it gets here, which
 * is ample time for the peer to hang up - the callback runs BEFORE the assignment that
 * was supposed to give it its own unsubscribe.
 *
 * That is why the order below is: register the source, subscribe, and only then decide.
 * The callback is written to work whether or not `plan.watch` exists yet (it sets a latch
 * this function reads back), and the source is registered FIRST so a synchronous close
 * disarms a COMPLETE plan instead of tearing down the previous registration and then
 * installing a fresh one for a plan that is already dead. Without both, the observed
 * result was: no pending plan, a permanently-registered session source (every later
 * single-player mount then allocates a context for an inert factory - the section 11.14
 * solo-cost rule), a leaked subscription, a connection nobody closed, and a user
 * navigated into a tool that is not a collab.
 */
function armPlan(plan: MountPlan): boolean {
  const previous = pending;
  pending = plan;
  // A new ceremony invalidates any model carried for the old one - that is the bound on
  // `carried`'s lifetime, and the reason `disarm` does not need to be (see its note).
  carried = null;
  if (previous && !previous.handleSpent) {
    // A ceremony completed while an earlier one was still waiting for its mount. The
    // older pair has no adopter coming (its route was never entered), and leaving it
    // open would be the leak `collab-mount.ts` bounds parking to avoid.
    previous.watch?.();
    previous.watch = null;
    try { previous.ui?.close(); } catch { /* same */ }
    previous.ui = null;
    try { previous.close(); } catch { /* an already-dead transport is fine */ }
  }
  unregisterSource?.();
  unregisterSource = registerCollabSessionSource((ctx) => {
    const armed = pending;
    if (!armed || armed.handleSpent || ctx.toolId !== armed.toolId) return null;
    armed.handleSpent = true;
    pending = null;
    adopted = armed;
    // The session belongs to the mount now - including the right to notice it close.
    armed.watch?.();
    armed.watch = null;
    // Back to dormant: `acquireCollabSession` allocates nothing again, and no later
    // mount of any tool can be handed a session that is already live in another view.
    unregisterSource?.();
    unregisterSource = null;
    return armed.handle;
  });

  // A pair can die between the hand-off and the mount (the peer closes the tab while
  // the tool chunk loads). Adopting a closed session would give the user a collab pill
  // that never goes live, so an unspent plan disarms itself instead.
  let closedSynchronously = false;
  const off = plan.handle.events.subscribe((state) => {
    if (state !== 'closed' || plan.handleSpent) return;
    if (plan.watch) disarm(plan);
    // Inside `subscribe` - there is no unsubscribe to call yet. Say so, and let the
    // caller finish the teardown the moment it has one.
    else closedSynchronously = true;
  });
  plan.watch = off;
  if (!closedSynchronously) return pending === plan;
  disarm(plan);
  return false;
}

// ── Navigation ────────────────────────────────────────────────────────────────

/** The seam every DOM touch in this module goes through, so the mount is testable
 *  without a browser (node:test has no `window`, and this file is on the boot path so
 *  it cannot pull jsdom in to get one). */
export interface LiveMountEnvironment {
  /** The route query as the address bar currently holds it, in either URL form. */
  currentQuery(): string;
  /** True when the browser is already inside this tool (either routing form). */
  onToolRoute(toolId: string): boolean;
  /** Enter `#/tool/<id>?<query>`, forcing a remount when we are already there. */
  navigate(hash: string, force: boolean): void;
  /** Build the memory-backed `host.state` for an ephemeral mount. */
  makeEphemeralState(): Promise<WebStateAPI>;
}

/** Tool ids are `[a-z0-9-]`, so this is regex-safe - the same reads `lib/drop-router.ts`
 *  makes, kept identical on purpose: two routers disagreeing about "am I already there"
 *  is a double mount in one direction and a silently-ignored stash in the other. */
function browserEnvironment(): LiveMountEnvironment {
  return {
    currentQuery() {
      if (typeof window === 'undefined') return '';
      if (window.location.search) return window.location.search.slice(1);
      const at = window.location.hash.indexOf('?');
      return at >= 0 ? window.location.hash.slice(at + 1) : '';
    },
    onToolRoute(toolId) {
      if (typeof window === 'undefined') return false;
      return new RegExp(`^#/tool/${toolId}([?/]|$)`).test(window.location.hash)
        || new RegExp(`^/t/${toolId}([?/]|$)`).test(window.location.pathname);
    },
    navigate(hash, force) {
      if (typeof window === 'undefined') return;
      if (window.location.hash !== hash) window.location.hash = hash;
      // The tool route's dedup signature strips params, so a same-tool re-entry is a
      // no-op without this - and it is dispatched SYNCHRONOUSLY, before the async
      // `hashchange`, so the forced navigate reads the hash we just wrote and the
      // hashchange that follows dedupes against the mount it caused.
      if (force) window.dispatchEvent(new Event('lolly:remount'));
    },
    async makeEphemeralState() {
      const { createMemoryStateAPI } = await import('./ephemeral-state.ts');
      return createMemoryStateAPI();
    },
  };
}

let environment: LiveMountEnvironment | null = null;

/** Replace the DOM seam. TEST-ONLY - production never calls this. */
export function _setLiveMountEnvironmentForTests(next: LiveMountEnvironment | null): void {
  environment = next;
}

function env(): LiveMountEnvironment {
  return environment ?? browserEnvironment();
}

// ── The mount ─────────────────────────────────────────────────────────────────

/**
 * Turn a live connection into a mounted, co-editing tool.
 *
 * Async because two things it needs are lazy: the acceptor's seed arrives after the
 * hand-off (`CollabConnection.seedLater` - see `collab/rtc-connection.ts`), and the
 * memory state bridge is one dynamic import. Neither is on any single-player path.
 *
 * Failure is always the same shape: the connection is CLOSED. A pair we cannot mount is
 * a pair whose peer would otherwise sit at "live" forever watching nothing arrive.
 */
export async function mountLiveCollab(conn: CollabConnection): Promise<void> {
  const toolId = conn.toolId;
  if (!toolId) {
    // section 6.1: a private collab requires the tool present on both devices, and the invite
    // names it. No tool id means a malformed invite got past the ceremony - there is no
    // route to send anyone to.
    try { conn.close(); } catch { /* nothing left to close is fine */ }
    return;
  }

  // Carry the connection's negotiated shared-history requests onto the handle the tool
  // will mount, so the History panel can offer "Load from peer" (plan 221 section 9). Assigned
  // in place so the handle's live getters (role, hostClientId) are preserved.
  if (conn.requestPeerHistory) {
    Object.assign(conn.handle, {
      requestPeerHistory: conn.requestPeerHistory,
      ...(conn.requestPeerRevision ? { requestPeerRevision: conn.requestPeerRevision } : {}),
    });
  }

  const plan: MountPlan = {
    toolId,
    handle: conn.handle,
    ephemeral: conn.ephemeral,
    close: () => { conn.close(); },
    state: null,
    stateSpent: false,
    handleSpent: false,
    watch: null,
    beam: beamLinkOf(conn),
    ui: null,
  };

  try {
    // section 11.17: one interception point, armed BEFORE the route is entered so the mount
    // cannot start on the real (IndexedDB) state and swap later.
    if (conn.ephemeral) plan.state = await env().makeEphemeralState();

    // The seed, if this side is receiving one. `seedLater` resolves with `undefined`
    // rather than hanging when a peer sends none, so this cannot stall the mount (section 6.2:
    // convergence delivers the state either way, just later).
    const seed = conn.seed ?? (conn.seedLater ? await conn.seedLater : undefined);

    // A pair that died while we waited for that seed is disarmed (and hung up) by
    // `armPlan` itself. Navigating anyway would be the worst of both: an acceptor sent
    // to a tool that is not a collab, and - far worse - an INVITER force-remounted out
    // of their live model for a session that no longer exists.
    if (!armPlan(plan)) return;

    const already = env().onToolRoute(toolId);
    // The inviter is IN the tool: its live model is the seed, merged under whatever the
    // address bar has (see `mergeSeedQuery`). The acceptor is arriving cold, so the seed
    // IS the whole route - merging in `#/join?inv=…`'s params would carry the invite
    // token into the tool as if it were an input.
    const query = already ? mergeSeedQuery(seed, env().currentQuery()) : seedToQuery(seed);
    env().navigate(`#/tool/${toolId}${query ? `?${query}` : ''}`, already);
  } catch (e) {
    console.warn('[lolly:collab] live mount failed', e);
    disarm(plan);
  }
}

/**
 * Register {@link mountLiveCollab} and adopt whatever the ceremony parked while this
 * module was still being imported - `collab-mount.ts`'s documented stitch, verbatim.
 *
 * Idempotent-ish by the registry's own last-wins rule; returns the unregister so a test
 * can put the shell back to dormant.
 */
export function installLiveCollabMount(): () => void {
  const off = registerCollabMount(mountLiveCollab);
  // Deliberately after registration, and deliberately not inside it: a drain hidden in
  // `registerCollabMount` would fire re-entrantly during this module's own import.
  for (const conn of takeParked()) void mountLiveCollab(conn);
  return off;
}

// ── What the tool view spends ─────────────────────────────────────────────────

/**
 * The memory-backed `host.state` for an ephemeral mount, or `null` for every other
 * mount there has ever been.
 *
 * ONE-SHOT, like the session handle beside it: the second mount of the same tool is not
 * this collab and must not silently lose its saves to a memory store.
 *
 * THE CALL SITE is `views/tool.ts`, in the same place it already clones the host for a
 * manifest's `network.allowlist` - 
 *
 * ```ts
 * const ephemeralState = takeEphemeralState(toolId);
 * if (ephemeralState) host = { ...host, state: ephemeralState };
 * ```
 *
 * - which must sit BEFORE the `slot` load and `createRuntime`, so every save path in the
 * view and in the tool's own actions is looking at the same object. Cloning (rather than
 * mutating the boot host) is what keeps the swap scoped to this mount: bridge methods
 * are closures, not `this`-bound. See the header for the one path this does NOT cover
 * (filing into a folder, which persists through `host.profile`).
 */
export function takeEphemeralState(toolId: string): WebStateAPI | null {
  for (const plan of [pending, adopted]) {
    if (!plan || plan.toolId !== toolId || !plan.state || plan.stateSpent) continue;
    plan.stateSpent = true;
    return plan.state;
  }
  return null;
}

/**
 * Is a forced remount of `toolId` armed, for THIS device's own live model?
 *
 * The question `views/tool.ts`'s `_cleanup` asks before it hands anything over, and it
 * is deliberately the cheapest thing this module exports: three comparisons and no
 * allocation, so the single-player teardown path (which is every teardown) pays a
 * predicate and nothing else (section 11.14).
 *
 * `ephemeral` is what makes it "this device's own": an ACCEPTOR who happens to already
 * be in the same tool also remounts, and their local model is precisely what must NOT
 * survive that - their copy is seeded by the peer (section 6.2a) and then converged, so
 * carrying their stale pre-join values in would be a silent, unattributable edit to
 * somebody else's document.
 */
export function willRemountForCollab(toolId: string): boolean {
  return pending !== null && !pending.handleSpent && !pending.ephemeral && pending.toolId === toolId;
}

/**
 * Hand the outgoing mount's live model (and its slot) to the remount about to replace it.
 *
 * BY REFERENCE and one level shallow: the values are the runtime's own objects, which is
 * the point - a `FileRef`'s bytes, a `user/` asset id and an over-long paragraph
 * survive because nothing is encoded. The record itself is copied so a later mutation of
 * the caller's map cannot rewrite what the next mount will read.
 *
 * Ignored unless {@link willRemountForCollab} would have said yes, so a stray call can
 * never leave a model pinned in module state.
 */
export function carryMountState(toolId: string, slot: string | null, values: Record<string, unknown>): void {
  if (!willRemountForCollab(toolId)) return;
  carried = { toolId, slot, values: { ...values } };
}

/**
 * ONE-SHOT: what the remount must restore, or `null` for every mount that is not one.
 *
 * Spent on read, exactly like {@link takeEphemeralState} beside it and for the same
 * reason - a second mount of the same tool is a different session, and silently
 * re-seeding it from a collab that has moved on is worse than starting clean.
 */
export function takeCarriedMountState(toolId: string): CarriedMountState | null {
  if (!carried || carried.toolId !== toolId) return null;
  const state = carried;
  carried = null;
  return state;
}

/**
 * "Save a copy" (section 6.2a): the acceptor's ephemeral session, written into their own store
 * as a disclosed fork.
 *
 * The acceptor's saves land in the memory bridge above, so a copy is a straight read
 * from it into the real one - `lib/ephemeral-state.ts` is the REAL `createStateAPI` over
 * a memory driver precisely so this is a copy and not a re-implementation of a save.
 *
 * The caller runs the tool's ordinary Save first (which writes into the memory bridge,
 * because that is what the mount handed the runtime), then calls this - the source is
 * found on its own, because the plan keeps holding the bridge after handing it to the
 * mount. Returns the slot written, or `null` when the ephemeral session holds nothing to
 * copy (which is "you have not saved anything yet", not an empty session in Projects).
 *
 * NOT wired to a control yet. The blocker it used to name is gone - `collab-pill.ts` now
 * takes an `actions` list, and {@link attachCollabBeam} below is its first user - so
 * "Save a copy" is one more {@link CollabPillAction} kind plus its two strings, and is
 * left to the wave that owns the section 6.2a copy rather than smuggled in beside the beam.
 */
export async function saveCollabCopy(
  target: WebStateAPI,
  opts: { readonly from?: WebStateAPI; readonly slot?: string } = {},
): Promise<string | null> {
  const source = opts.from ?? adopted?.state ?? pending?.state ?? null;
  if (!source) return null;
  const entries = await source.list();
  if (entries.length === 0) return null;
  // The newest, by the same `updatedAt` the Projects view sorts on.
  const newest = entries.reduce((a, b) => ((b.updatedAt ?? '') > (a.updatedAt ?? '') ? b : a));
  const data = await source.load(newest.slot);
  if (!data) return null;
  const slot = opts.slot ?? `collab-copy-${Date.now().toString(36)}`;
  await target.save(slot, data, newest.thumb ?? null);
  return slot;
}

/** TEST-ONLY: drop the armed plan and the session-source registration. */
export function _clearLiveCollabForTests(): void {
  pending?.watch?.();
  adopted?.watch?.();
  try { pending?.ui?.close(); } catch { /* a suite tearing down does not care */ }
  try { adopted?.ui?.close(); } catch { /* same */ }
  pending = null;
  adopted = null;
  carried = null;
  unregisterSource?.();
  unregisterSource = null;
  environment = null;
}

/** Diagnostics: is a mount armed and unspent? (Also how a test proves one-shot.) */
export function pendingLiveCollab(): { toolId: string; ephemeral: boolean } | null {
  return pending ? { toolId: pending.toolId, ephemeral: pending.ephemeral } : null;
}

/** Diagnostics: is this module the registered mount? */
export function liveCollabMountInstalled(): boolean {
  return getCollabMount() === mountLiveCollab;
}

// ── The beam (plan 100 section 6.4) ──────────────────────────────────────────────────

/**
 * The beam link a connection published, or `null`.
 *
 * A hand-written duck-type rather than `collab/beam-ui.ts`'s own `beamLinkOf`, for the
 * reason the import block above gives: importing that module for a VALUE would drag the
 * beam protocol, the pack, the IndexedDB sink and the toast's stylesheet onto the boot
 * path, for a feature that most sessions never touch. Six lines here buy the whole
 * lazy-chunk discipline; the shape they check is stated once, in `beam-ui.ts`.
 */
function beamLinkOf(conn: CollabConnection): CollabBeamLink | null {
  const link = (conn as { beam?: CollabBeamLink }).beam;
  if (!link || typeof link !== 'object') return null;
  const transport = link.transport as { beam?: { isOpen?: unknown }; on?: unknown } | null | undefined;
  if (!transport || typeof transport.on !== 'function' || typeof transport.beam?.isOpen !== 'function') return null;
  return link;
}

/** What a mounted tool gets back when its collab can beam. */
export interface CollabBeamAttachment {
  /**
   * Pill controls for this collab, ready for `mountCollabPill`'s `actions` slot.
   *
   * Never empty when this object exists, and the object only exists for a pair whose
   * transport published a bulk lane - so "is there a send button" and "is there a beam"
   * are the same question, answered once.
   */
  readonly actions: readonly CollabPillAction[];
  /** Toast off the page, beam session closed, staging discarded. Idempotent. */
  close(): void;
}

export interface CollabBeamAttachOptions {
  /** The tool this mount is for - the same id the plan was armed with. */
  readonly toolId: string;
  /**
   * The bridge slice a RECEIVED beam is landed into - the real library, always.
   *
   * section 6.4 is explicit that received items "land attributed ('From Priya') in the
   * receiver's library, storage meter updated honestly", and that holds for an acceptor
   * too: section 11.17's ephemerality covers their borrowed copy of the INVITER's document, not
   * a separate pack they were asked about by name and said yes to. Handing the memory
   * clone in here landed the session in a store that dies with the mount while its assets
   * went to the real one through `host.assets` - half a pack kept, and a toast reporting
   * both.
   */
  readonly host?: BeamPackHost | null;
  /**
   * The bridge slice an OUTGOING pack is built from. Defaults to {@link host}, which is
   * what every mount but an acceptor's wants (they are the same object).
   *
   * For an ACCEPTOR this is the memory-backed clone (`views/tool.ts` swaps `host.state`
   * before `createRuntime`, section 11.17), so their working copy packs and sends through the
   * identical call as a saved one - without a slot on their device ever existing.
   */
  readonly packHost?: BeamPackHost | null;
  /** What "this session, right now" is. Read at press time, never cached. */
  readonly currentSession: () => { readonly slot: string } | { readonly state: Record<string, unknown>; readonly label?: string } | null;
  /** Where the toast mounts; defaults to a div appended to `document.body`. */
  readonly container?: HTMLElement | null;
}

/**
 * Give this mount's collab a beam, or answer `null` for one that cannot have one.
 *
 * THE CALL SITE is `views/tool-collab.ts`, beside the pill it hands the actions to, and
 * it is there rather than at the ceremony because a beam needs three things only a
 * mounted tool holds: the host bridge it packs from, the live model it sends, and a page
 * to hang the toast on. `null` covers three honest cases, none of which is an error - a
 * work collab (Track B publishes no lane), a mount that is not this collab's, and a beam
 * stack that failed to load.
 *
 * The returned handle is the MOUNT's to close, in the same teardown that takes down the
 * rest of the presence chrome. The plan keeps its own reference so a pair that dies (or
 * is replaced by a second ceremony) takes the toast with it either way.
 */
export async function attachCollabBeam(opts: CollabBeamAttachOptions): Promise<CollabBeamAttachment | null> {
  // `adopted` first: by the time a tool is mounting, the session source has already
  // handed the handle over. `pending` is the belt-and-braces case (a caller that
  // attaches before the runtime asked for a session).
  const plan = [adopted, pending].find(p => p && p.toolId === opts.toolId && p.beam) ?? null;
  const link = plan?.beam ?? null;
  if (!plan || !link) return null;

  // A second attach for the same plan replaces the first - a remount must not leave a
  // toast subscribed to a lane through a session nobody holds.
  try { plan.ui?.close(); } catch { /* already gone is fine */ }
  plan.ui = null;

  let ui: CollabBeamUi;
  try {
    const { createCollabBeamUi } = await import('../collab/beam-ui.ts');
    ui = createCollabBeamUi({
      link,
      host: opts.host ?? null,
      // Undefined, not null, when the caller named only one host: `null` would mean "pack
      // from nothing" and refuse every send, where absent means "the same one".
      ...(opts.packHost != null ? { packHost: opts.packHost } : {}),
      currentSession: opts.currentSession,
      container: opts.container ?? null,
    });
  } catch (e) {
    // The collab itself is unharmed: co-editing does not run through the bulk lane.
    console.warn('[lolly:collab] the beam failed to attach', e);
    return null;
  }
  plan.ui = ui;

  return {
    actions: [{
      kind: 'send-session',
      // The lane, live. A pair that drops takes the control with it on the next paint.
      available: () => ui.isOpen(),
      async onSelect() {
        const result = await ui.sendCurrentSessionNow();
        // A refusal before the offer frame has nothing to show in the toast (it paints
        // from `offer-received` onward), so it is thrown for the pill to announce.
        // Everything that fails AFTER that is the toast's, with its typed reason.
        if (!result.ok) throw new Error(`beam: ${result.reason}${result.detail ? ` - ${result.detail}` : ''}`);
      },
    }],
    close() {
      if (plan.ui === ui) plan.ui = null;
      ui.close();
    },
  };
}
