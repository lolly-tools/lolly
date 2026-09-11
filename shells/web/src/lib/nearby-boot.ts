// SPDX-License-Identifier: MPL-2.0
/**
 * nearby-boot - the one import `main.ts` makes to (maybe) wire up LAN discovery.
 *
 * On a plain web build there is nothing to wire: a PWA cannot do mDNS/multicast/raw
 * sockets, so `installNearbyBoot()` probes for the Tauri runtime and, finding none,
 * returns having registered nothing. The registry (`lib/nearby.ts`) then stays empty
 * and every Nearby affordance stays absent - the web bundle is byte-identical to one
 * without this feature.
 *
 * ── Why a runtime probe, not the vite bridge-override swap ───────────────────────
 *
 * The Tauri shells' `overrideBridgeModules()` plugin only rewrites imports made from
 * inside a `bridge/` dir (it matches the importer path), and this module is imported
 * from `main.ts`. Rather than bend that plugin or misfile this under `bridge/`, we use
 * the pattern the codebase already blesses for exactly this shape - the Design System
 * "Website" source (`lib/design-system/sources/website.ts`) reaches Tauri through its
 * own `__TAURI_INTERNALS__.invoke` global instead of a build-time swap, "the one that
 * cannot miss". Same here: detect the global, and talk to the native `nearby_*`
 * commands over it. The heavy native side is the Rust `nearby.rs`; the JS side is this
 * thin provider, so nothing Tauri-specific is statically imported and the web build
 * never pulls `@tauri-apps/api`.
 *
 * ── The native contract (all over `invoke`, poll-based) ─────────────────────────
 *
 * Discovery's wire - mDNS TXT records, the TCP invite exchange - is parsed
 * authoritatively in Rust (that is where the bytes are; a second TS codec would only
 * drift). Rust surfaces already-clean JSON:
 *   nearby_set_visible({name})     start advertising under a chosen name
 *   nearby_hide()                  stop advertising + the invite listener
 *   nearby_browse({on})            start/stop browsing for peers
 *   nearby_poll() -> {peers, invites}   current peer set + any pending inbound invites
 *   nearby_exchange_invite({peerId, token}) -> replyToken   (blocks until reply/timeout)
 *   nearby_send_reply({exchangeId, token})   answer an inbound invite
 *   nearby_decline({exchangeId})             refuse an inbound invite
 *
 * Even though Rust is ours, its output is validated/clamped here (peer-list length,
 * string lengths) - defence in depth, the same discipline every other boundary keeps.
 */

import {
  registerNearbyProvider,
  type NearbyProvider,
  type NearbyPeer,
  type NearbyVisibility,
  type NearbyInboundInvite,
  isVisibilityActive,
  visibilityRemainingMs,
} from './nearby.ts';

/** A minimal type for Tauri's invoke, so we never import `@tauri-apps/api`. */
export type TauriInvoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;

/** Reach Tauri's invoke via the global it always installs, or null off Tauri.
 *  Mirrors `detectSiteTransport`'s `tauriInvoke()` exactly. */
export function tauriInvoke(): TauriInvoke | null {
  const internals = (globalThis as { __TAURI_INTERNALS__?: { invoke?: unknown } }).__TAURI_INTERNALS__;
  const invoke = internals?.invoke;
  return typeof invoke === 'function' ? (invoke as TauriInvoke) : null;
}

// Clamps - Rust output is trusted but not blindly. A runaway peer list or an
// over-long name never reaches the UI.
const MAX_PEERS = 64;
const MAX_NAME_CHARS = 32;
const MAX_TOKEN_CHARS = 128 * 1024; // one control frame, matches the beam cap
const POLL_MS = 1200;

interface RawPeer { id?: unknown; name?: unknown; kind?: unknown }
interface RawInvite { exchangeId?: unknown; fromName?: unknown; token?: unknown }
interface RawPoll { peers?: unknown; invites?: unknown }

function str(v: unknown, cap: number): string | null {
  if (typeof v !== 'string' || v.length === 0 || v.length > cap) return null;
  return v;
}

function sanitizePeers(raw: unknown): NearbyPeer[] {
  if (!Array.isArray(raw)) return [];
  const out: NearbyPeer[] = [];
  for (const r of (raw as RawPeer[]).slice(0, MAX_PEERS)) {
    const id = str(r?.id, 512);
    const name = str(r?.name, MAX_NAME_CHARS);
    const kind = r?.kind === 'mobile' ? 'mobile' : 'desktop';
    if (id && name) out.push({ id, name, kind, source: 'lan' });
  }
  return out;
}

/** Injectable environment so the provider is unit-testable with a fake invoke and
 *  clock. `installNearbyBoot` supplies the real Tauri invoke + `window` timers. */
export interface NearbyLanEnv {
  invoke: TauriInvoke;
  now?: () => number;
  setTimeout?: (fn: () => void, ms: number) => unknown;
  clearTimeout?: (h: unknown) => void;
  setInterval?: (fn: () => void, ms: number) => unknown;
  clearInterval?: (h: unknown) => void;
}

/**
 * Build the `'lan'` provider over a native invoke. One internal poll loop runs
 * whenever anyone is watching (peers or invites) or we are advertising; it fans
 * `nearby_poll` out to peer- and invite-subscribers. A `timed` visibility window
 * schedules its own auto-hide, so advertising stops on time even if the UI that
 * opened it has closed.
 */
export function createNearbyLanProvider(env: NearbyLanEnv): NearbyProvider {
  const now = env.now ?? (() => Date.now());
  const setT = env.setTimeout ?? ((fn, ms) => setTimeout(fn, ms));
  const clrT = env.clearTimeout ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  const setI = env.setInterval ?? ((fn, ms) => setInterval(fn, ms));
  const clrI = env.clearInterval ?? ((h) => clearInterval(h as ReturnType<typeof setInterval>));
  const { invoke } = env;

  const peerSubs = new Set<(peers: readonly NearbyPeer[]) => void>();
  const inviteSubs = new Set<(inv: NearbyInboundInvite) => void>();
  const seenInvites = new Set<string>(); // exchangeIds already surfaced, so we fan each out once
  const answered = new Set<string>();     // exchangeIds already responded/declined

  let pollHandle: unknown = null;
  let polling = false;         // reentrancy guard for the async poll
  let browsing = false;        // whether we've told Rust to browse
  let advertising = false;
  let hideTimer: unknown = null;

  function wantLoop(): boolean {
    return peerSubs.size > 0 || inviteSubs.size > 0 || advertising;
  }

  function ensureLoop(): void {
    if (pollHandle || !wantLoop()) return;
    pollHandle = setI(() => { void poll(); }, POLL_MS);
    void poll(); // an immediate first read so the UI isn't blank for a poll interval
  }
  function maybeStopLoop(): void {
    if (pollHandle && !wantLoop()) { clrI(pollHandle); pollHandle = null; }
  }

  async function ensureBrowsing(on: boolean): Promise<void> {
    if (on === browsing) return;
    browsing = on;
    try { await invoke('nearby_browse', { on }); } catch { browsing = !on; }
  }

  async function poll(): Promise<void> {
    if (polling) return;
    polling = true;
    try {
      const raw = (await invoke('nearby_poll')) as RawPoll;
      if (peerSubs.size) {
        const peers = sanitizePeers(raw?.peers);
        for (const cb of peerSubs) cb(peers);
      }
      const invites = Array.isArray(raw?.invites) ? (raw.invites as RawInvite[]) : [];
      for (const r of invites) {
        const exchangeId = str(r?.exchangeId, 512);
        const token = str(r?.token, MAX_TOKEN_CHARS);
        const fromName = str(r?.fromName, MAX_NAME_CHARS) ?? '';
        if (!exchangeId || !token || seenInvites.has(exchangeId)) continue;
        seenInvites.add(exchangeId);
        if (!inviteSubs.size) continue; // no acceptor listening - let it time out natively
        const inv: NearbyInboundInvite = {
          token,
          fromName,
          respond(reply: string) {
            if (answered.has(exchangeId)) return;
            answered.add(exchangeId);
            void invoke('nearby_send_reply', { exchangeId, token: reply }).catch(() => {});
          },
          decline() {
            if (answered.has(exchangeId)) return;
            answered.add(exchangeId);
            void invoke('nearby_decline', { exchangeId }).catch(() => {});
          },
        };
        for (const cb of inviteSubs) cb(inv);
      }
    } catch {
      // A poll failure is transient (native side busy/reloading); the next tick retries.
    } finally {
      polling = false;
    }
  }

  return {
    source: 'lan',

    async setVisible(v: NearbyVisibility, name: string): Promise<void> {
      if (hideTimer) { clrT(hideTimer); hideTimer = null; }
      const active = isVisibilityActive(v, now());
      if (!active) { await this.hide(); return; }
      advertising = true;
      ensureLoop();
      try {
        await invoke('nearby_set_visible', { name: name.slice(0, MAX_NAME_CHARS) });
      } catch {
        advertising = false; maybeStopLoop(); throw new Error('nearby-advertise-failed');
      }
      if (v.mode === 'timed') {
        const remaining = visibilityRemainingMs(v, now());
        hideTimer = setT(() => { void this.hide(); }, remaining);
      }
    },

    async hide(): Promise<void> {
      if (hideTimer) { clrT(hideTimer); hideTimer = null; }
      if (!advertising) return;
      advertising = false;
      maybeStopLoop();
      try { await invoke('nearby_hide'); } catch { /* best-effort stop */ }
    },

    subscribePeers(cb): () => void {
      peerSubs.add(cb);
      void ensureBrowsing(true);
      ensureLoop();
      return () => {
        peerSubs.delete(cb);
        if (peerSubs.size === 0) void ensureBrowsing(false);
        maybeStopLoop();
      };
    },

    subscribeInvites(cb): () => void {
      inviteSubs.add(cb);
      ensureLoop();
      return () => { inviteSubs.delete(cb); maybeStopLoop(); };
    },

    async exchangeInvite(peerId: string, inviteToken: string): Promise<string> {
      const reply = await invoke('nearby_exchange_invite', { peerId, token: inviteToken });
      const s = str(reply, MAX_TOKEN_CHARS);
      if (!s) throw new Error('nearby-exchange-empty-reply');
      return s;
    },
  };
}

let installed = false;

/** Called once from `main.ts`. Registers the LAN provider when running under Tauri;
 *  a no-op on the web (the dormant default). Idempotent. */
export function installNearbyBoot(): void {
  if (installed) return;
  const invoke = tauriInvoke();
  if (!invoke) return; // web / CLI - nothing to register, stay dormant
  installed = true;
  registerNearbyProvider(createNearbyLanProvider({ invoke }));
}

/** TEST-ONLY: reset the install latch. */
export function _resetNearbyBootForTests(): void { installed = false; }
