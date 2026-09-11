// SPDX-License-Identifier: MPL-2.0
/**
 * nearby - the seam between the collab ceremony and a *discovery* transport: a way
 * to find another Lolly device on the same network and hand it an invite without
 * anyone scanning a QR (plans/110 section 3).
 *
 * ── What this module is, and is deliberately not ────────────────────────────────
 *
 * It is a REGISTRY, exactly like `lib/collab-launch.ts` one purpose over. A provider
 * registers here; surfaces (the ceremony dialog, the share sheets) consult it to
 * decide whether a "Nearby" affordance can render at all. With no provider
 * registered - every plain web build - `listNearbyProviders()` is empty, nothing
 * renders, no timer runs, nothing touches the network. That dormancy is the whole
 * contract on the web side: a PWA cannot do mDNS/multicast/raw sockets, so the web
 * build registers nothing and is byte-identical to one without this file
 * (`lib/nearby-boot.ts` is the single import, and it is a no-op off Tauri).
 *
 * Two provider SOURCES are anticipated, and the registry holds one slot each so
 * they never shadow one another:
 *   - `'lan'` - a Tauri shell's native mDNS/DNS-SD discovery (desktop `nearby.rs`,
 *                Android NsdManager). Registered by `lib/nearby-boot.ts` when it
 *                detects the Tauri runtime. This is real device discovery.
 *   - `'org'` - a control-plane instance grouping connected members by network
 *                (lolly-work `plans/26` section 8). Registered from `org/nearby-source.ts`
 *                only on an instance that grants `collab.nearby`. A SORTING HINT,
 *                never true discovery, and its `exchangeInvite` deliberately refuses
 *                (a browser cannot hand a token to a peer without a server round the
 *                two already share, which is the room, not this).
 *
 * ── The trust boundary this does NOT move ───────────────────────────────────────
 *
 * Discovery replaces only the TRANSPORT of the invite/reply tokens. mDNS is
 * unauthenticated - anyone on a café network can advertise any name - so tapping a
 * discovered peer starts the SAME accept ceremony, and the SAS matching plates
 * remain the authentication (plans/110 section 3, plan 100 section 11.23). "Discoverable" never
 * means "trusted", and nothing here weakens the ceremony. The tokens exchanged are
 * the same opaque blobs a QR carries today; this module never inspects them.
 */

/** A device found nearby. `id` is a provider-scoped OPAQUE handle used only to call
 *  back into the provider - never a raw address, and never shown to the user. */
export interface NearbyPeer {
  readonly id: string;
  /** The peer's chosen display name (already length-capped by the provider). Shown. */
  readonly name: string;
  readonly kind: 'desktop' | 'mobile';
  readonly source: NearbySource;
  /** Only meaningful for `source: 'org'`: the instance's "likely on the same
   *  network" hint (a hint, never an identity claim - CGNAT/VPN make it approximate).
   *  A LAN peer is on the LAN by definition, so the `'lan'` provider omits it. */
  readonly near?: boolean;
}

export type NearbySource = 'lan' | 'org';

export type NearbyVisibilityMode = 'hidden' | 'timed' | 'standing';

/** How discoverable the local device currently is. `until` (epoch ms) is set only
 *  for a `'timed'` window - the AirDrop-style "visible for 10 minutes" default.
 *  `'standing'` is the opt-in "always visible on networks I join" for trusted LANs;
 *  it is the only mode that is persisted (on the profile), and even it advertises
 *  only while the app is running. */
export interface NearbyVisibility {
  readonly mode: NearbyVisibilityMode;
  readonly until?: number;
}

/** An invite that arrived FROM a nearby peer (this device is the acceptor). The
 *  consumer shows the normal accept ceremony over `token`, then calls exactly one of
 *  `respond`/`decline` - the provider holds the transport open until it does. */
export interface NearbyInboundInvite {
  /** The opaque invite token the peer sent (the same blob a QR would carry). */
  readonly token: string;
  /** The peer's chosen display name, for the accept card. Untrusted, display-only. */
  readonly fromName: string;
  /** Complete the exchange by sending our reply token back over the same transport. */
  respond(replyToken: string): void;
  /** Refuse; the peer sees an honest "declined". Idempotent with `respond`
   *  (whichever is called first wins; the second is a no-op). */
  decline(): void;
}

/** A discovery transport. Implemented natively per shell (`'lan'`) or by the control
 *  plane (`'org'`); consumed generically by the ceremony and share sheets. */
export interface NearbyProvider {
  readonly source: NearbySource;
  /** Advertise this device under `name` per the visibility window (or stop, for
   *  `mode: 'hidden'`). Advertising happens ONLY inside an open window. */
  setVisible(v: NearbyVisibility, name: string): Promise<void>;
  /** Stop advertising immediately (shorthand for `setVisible({mode:'hidden'}, …)`). */
  hide(): Promise<void>;
  /** Observe the live peer set while subscribed (browsing runs only while at least
   *  one subscriber is active). Returns an unsubscribe fn. The callback receives the
   *  full current set on every change, newest membership included. */
  subscribePeers(cb: (peers: readonly NearbyPeer[]) => void): () => void;
  /** Observe invites arriving from peers while subscribed. Returns an unsubscribe fn. */
  subscribeInvites(cb: (invite: NearbyInboundInvite) => void): () => void;
  /** Hand our invite token to a discovered peer and resolve with their reply token.
   *  Rejects on timeout, decline, or an unreachable peer. The `'org'` provider
   *  rejects unconditionally (see the header). */
  exchangeInvite(peerId: string, inviteToken: string): Promise<string>;
}

const providers = new Map<NearbySource, NearbyProvider>();

/** Register a source's provider; returns an unregister fn. A later register for the
 *  SAME source replaces the current one (last wins), matching `collab-launch`. */
export function registerNearbyProvider(p: NearbyProvider): () => void {
  providers.set(p.source, p);
  return () => { if (providers.get(p.source) === p) providers.delete(p.source); };
}

/** The provider for a source, or undefined. */
export function getNearbyProvider(source: NearbySource): NearbyProvider | undefined {
  return providers.get(source);
}

/** All registered providers, in a stable order ('lan' before 'org'). Empty on the
 *  web (the dormant default) - the ceremony gate reads `.length`. */
export function listNearbyProviders(): readonly NearbyProvider[] {
  const out: NearbyProvider[] = [];
  const lan = providers.get('lan');
  const org = providers.get('org');
  if (lan) out.push(lan);
  if (org) out.push(org);
  return out;
}

/** Whether any discovery transport is available at all - the single gate a surface
 *  checks (alongside the `nearby-discovery` flag) before rendering a Nearby row. */
export function anyNearbyAvailable(): boolean {
  return providers.size > 0;
}

/** TEST-ONLY: drop every registered provider, restoring the dormant default. */
export function _clearNearbyProvidersForTests(): void {
  providers.clear();
}

// ── Pure visibility-window helpers (no DOM, no timers - the UI owns the clock) ────

/** Whether a visibility window is currently advertising, at time `now` (epoch ms).
 *  `hidden` never; `standing` always; `timed` until its deadline passes. A `timed`
 *  window with no `until` is treated as expired (defensive - a malformed window must
 *  not advertise forever). */
export function isVisibilityActive(v: NearbyVisibility, now: number): boolean {
  switch (v.mode) {
    case 'hidden': return false;
    case 'standing': return true;
    case 'timed': return typeof v.until === 'number' && v.until > now;
  }
}

/** Milliseconds remaining in a `timed` window (for the countdown), clamped at 0.
 *  0 for every non-timed or expired window. */
export function visibilityRemainingMs(v: NearbyVisibility, now: number): number {
  if (v.mode !== 'timed' || typeof v.until !== 'number') return 0;
  return Math.max(0, v.until - now);
}

/** The default visible window: `'timed'`, 10 minutes from `now`. The one place the
 *  duration is defined, so a re-arm and the initial arm agree. */
export const NEARBY_WINDOW_MS = 10 * 60 * 1000;
export function timedWindow(now: number, durationMs: number = NEARBY_WINDOW_MS): NearbyVisibility {
  return { mode: 'timed', until: now + durationMs };
}
